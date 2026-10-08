#!/usr/bin/env bash
# test-durabilidad-senal-de-ejecucion.sh — `_reply_resolvio_el_gate` decide el veredicto del gate de
# durabilidad post-restart, y hasta hoy NO TENÍA TEST. Esto es ese test.
#
# 🔴 POR QUÉ EXISTE (2026-10-08, el mismo día que el fix de `BL-B1` entró a `main` en #985).
# `BL-B1` arregló un defecto real: el verde se decidía por AUSENCIA de dos firmas de fallo, así que
# un «Listo 👍» de una rama rota nueva pasaba VERDE sin que `execute_tool` hubiera corrido. El fix
# agregó la señal POSITIVA `card.confirmed_tool`. Correcto.
#
# Pero exigió `status == "ok"`, y eso ató el veredicto de DURABILIDAD al ÉXITO de una integración
# externa. Resultado, en el PRIMER deploy posterior: el gate salió **ROJO con la durabilidad
# INTACTA** — el callback post-restart reingresó al gate, `confirmed=True`,
# `activity='execute_tool'` — sólo porque `calendar_book` devolvió `status='error'`: el tenant e2e
# no tiene Google Calendar conectado (`card.kind='requiere_conexion'`). Un falso rojo que acusa al
# moat (la orquestación durable) por una conexión OAuth que este E2E nunca provisiona.
#
# ⚠️ Lo que hace esto un test y no un parche: la sobreespecificación **se contradecía con la
# documentación de su propio PR** — el docstring de `_confirmed_tool_de` ya declaraba el shape como
# `status: <'ok'|'error'|...>`. Nadie lo cazó porque la función que decide el veredicto del gate no
# tenía dónde fallar: su único ejercicio era `--control-negativo`, que entra por el camino (2) y da
# ROJO antes de llegar a (3). Un chequeo sin test propio no se revisa, se hereda.
#
# LA DISTINCIÓN QUE EL TEST FIJA, y es la razón de todo:
#   «la tool EJECUTÓ»  (lo que prueba durabilidad)  ≠  «la tool TUVO ÉXITO» (negocio + integración)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
echo "test-durabilidad-senal-de-ejecucion"

# El módulo importa `requests` sólo para hablar HTTP con prod; el veredicto es función pura. Se
# stubea para que el test corra en cualquier parte (CI, PC, VPS) sin instalar nada: si el test
# necesitara la red, no se correría — y un test que no se corre no protege nada.
cat > "$T/casos.py" <<'PY'
import sys, types, importlib.util, pathlib
sys.modules.setdefault("requests", types.ModuleType("requests"))

destino = sys.argv[1]
spec = importlib.util.spec_from_file_location("durab", destino)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

FIRMA = m._TEXTO_CALLBACK_SIN_GATE
def card(**kw):
    return [{"reply_text": "ok", "choices": None, "card": {"confirmed_tool": kw}}]

CASOS = [
    # (etiqueta, replies, esperado)
    ("sin confirmed_tool (el defecto que BL-B1 cerro)",
     [{"reply_text": "Listo", "choices": None, "card": None}], False),
    ("status=ok",
     card(activity="execute_tool", confirmed=True, status="ok", name="t"), True),
    ("status=error -> EJECUTO: la durabilidad vale (el caso medido en prod)",
     card(activity="execute_tool", confirmed=True, status="error", name="calendar_book"), True),
    ("status ausente -> no se puede afirmar que termino",
     card(activity="execute_tool", confirmed=True, name="t"), False),
    ("status=pending -> no terminal",
     card(activity="execute_tool", confirmed=True, status="pending", name="t"), False),
    ("activity distinta de execute_tool",
     card(activity="otra_activity", confirmed=True, status="ok", name="t"), False),
    ("confirmed=False",
     card(activity="execute_tool", confirmed=False, status="ok", name="t"), False),
    ("repite choice confirm: -> ROJO aunque la señal positiva este",
     [{"reply_text": "x", "choices": [{"value": "confirm:abc"}],
       "card": {"confirmed_tool": {"activity": "execute_tool", "confirmed": True, "status": "ok"}}}],
     False),
    ("firma exacta de la rama sin gate -> ROJO aunque la señal positiva este",
     [{"reply_text": FIRMA, "choices": None,
       "card": {"confirmed_tool": {"activity": "execute_tool", "confirmed": True, "status": "ok"}}}],
     False),
]

fallos = 0
for etiqueta, replies, esperado in CASOS:
    try:
        got = m._reply_resolvio_el_gate(replies)
    except Exception as e:
        print("  [X] %-62s EXCEPCION %r" % (etiqueta, e)); fallos += 1; continue
    if got is esperado:
        print("  [ok] %-62s -> %s" % (etiqueta, got))
    else:
        print("  [X] %-62s -> %s (esperaba %s)" % (etiqueta, got, esperado)); fallos += 1
sys.exit(1 if fallos else 0)
PY

SUJETO="$ROOT/scripts/e2e_g6_durabilidad_worker_restart.py"
python "$T/casos.py" "$SUJETO"
rc_real=$?
[ "$rc_real" -eq 0 ] && echo "  ✅ los 9 casos pasan sobre el script de produccion" \
                     || echo "  ❌ el script de produccion NO pasa sus propios casos"

# ── MUTANTE: restaurar el `status == "ok"` que causo el falso rojo ────────────────────────────
# Sin esto el test prueba que hoy funciona, no que ACREDITA la distincion. El mutante tiene que
# tumbar EXACTAMENTE un caso: el de `status=error`.
cp "$SUJETO" "$T/mutante.py"
python - "$T/mutante.py" <<'MUT'
import io, sys
p = sys.argv[1]
s = io.open(p, encoding="utf-8").read()
V = 'confirmed_tool.get("status") in _STATUS_TERMINALES'
if s.count(V) != 1:
    print("  ABORTO: no pude mutar (ancla %d veces)" % s.count(V)); sys.exit(2)
io.open(p, "w", encoding="utf-8", newline="\n").write(
    s.replace(V, 'confirmed_tool.get("status") == "ok"'))
MUT
rc_mut_prep=$?
if [ "$rc_mut_prep" -ne 0 ]; then
  echo "  ❌ no se pudo preparar el mutante — el control positivo NO corrio"
  exit 1
fi

salida_mut="$(python "$T/casos.py" "$T/mutante.py" 2>&1)"
rc_mut=$?
caidos="$(printf '%s\n' "$salida_mut" | grep -c '^  \[X\]')"
if [ "$rc_mut" -ne 0 ] && [ "$caidos" -eq 1 ] && printf '%s' "$salida_mut" | grep -q 'status=error.*\[X\]\|\[X\].*status=error'; then
  echo "  ✅ MUTANTE (status == \"ok\"): cae 1 caso, y es el de status=error — el test acredita la distincion"
elif [ "$rc_mut" -eq 0 ]; then
  echo "  ❌ MUTANTE: el test paso con el defecto restaurado ⇒ no mide lo que cree"
  exit 1
else
  echo "  ❌ MUTANTE: cayeron $caidos caso(s), esperaba exactamente 1 (el de status=error)"
  printf '%s\n' "$salida_mut" | grep '^  \[X\]'
  exit 1
fi

[ "$rc_real" -eq 0 ] || exit 1
echo
echo "VERDE — test-durabilidad-senal-de-ejecucion: 9 casos + mutante"
