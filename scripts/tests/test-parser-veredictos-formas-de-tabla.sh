#!/usr/bin/env bash
# Canario DIFERENCIAL de las formas de tabla que el parser de veredictos tiene que ver.
#
# Por que existe: auditoria (C3-25, 2026-09-29) midio que `contar-veredictos.py` era CIEGO a dos
# formas y que eso producia un falso verde REAL -- el unico veredicto legible para `cuenta`/`detalle`
# era un COHERENTE que una re-medicion posterior ya habia bajado. La re-medicion existia; el
# instrumento no la podia leer. Un instrumento de auditoria que fabrica el falso verde que audita es
# el peor de los casos, asi que cada forma queda clavada con un caso.
#
# La UNICA variable entre casos es la forma (ancho de tabla / backticks / grafia del token): si un
# caso falla y el POSITIVO sigue verde, el defecto es de la forma, no del fixture. Y si el POSITIVO
# falla, TODA la tanda es invalida -- ese error se cometio dos veces el mismo dia leyendo casos con
# el positivo en rojo (`memoria/un-control-positivo-prueba-que-el-instrumento-ve-no-que-mira-donde-hay-que-mirar.md`).
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
PY="${PYTHON:-python}"
CONTADOR="scripts/evidencia/contar-veredictos.py"
[ -f "$CONTADOR" ] || { echo "❌ no existe $CONTADOR"; exit 1; }

fallos=0
corrida="$("$PY" - <<'PYEOF'
# -*- coding: utf-8 -*-
import importlib.util, pathlib, sys
sys.stdout.reconfigure(encoding="utf-8")
SRC = pathlib.Path("scripts/evidencia/contar-veredictos.py").resolve()
spec = importlib.util.spec_from_file_location("cv", str(SRC)); cv = importlib.util.module_from_spec(spec)
sys.argv = ["cv"]
try: spec.loader.exec_module(cv)
except SystemExit: pass

# `(home)` esta en el padron REAL (54 ids) y lo fabrica este mismo repo: `criterio3-padron.sh:59`
# lo genera normalizando la celda `*(vacio)* Mi dia` del SPEC. Empieza con parentesis, y los dos
# patrones de celda exigen `[a-z0-9]` al inicio -- o sea que el universo y su lector no compartian
# el alfabeto. Medido el 2026-09-30: ilegible en las TRES formas, veredicto huerfano, y por lo tanto
# la ultima fila del criterio 3 no podia cerrarse nunca: por bien que alguien midiera la home, la
# cifra se quedaba en 53 de 54.
IDS = {"factura", "card", "cuenta", "detalle", "(home)"}

def med(t):
    # `ids=IDS` no es decoracion: la forma SIN backticks solo cuenta si el id esta en el
    # padron (el backtick es la declaracion del autor; la prosa necesita autorizacion).
    _, meds, _ = cv.mediciones_de(t, ids=IDS)
    ids = sorted({m["id"] for m in meds if m["id"] in IDS})
    vs  = sorted({v for m in meds for v in m["veredictos"] if m["id"] in IDS})
    return ids, vs

CAB3 = "| sujeto | veredicto | notas |\n|---|---|---|\n"
CAB2 = "| sujeto | veredicto |\n|---|---|\n"
CASOS = [
    # rotulo,                        texto,                                     id esperado, veredicto esperado
    ("POSITIVO 3col backtick",       CAB3 + "| `factura` (ARCA) | COHERENTE | ok |\n",   "factura", "COHERENTE"),
    ("H-1 2col backtick",            CAB2 + "| `card` (gasto) | COHERENTE |\n",          "card",    "COHERENTE"),
    ("H-2 3col sin backtick",        CAB3 + "| card (gasto) | COHERENTE | ok |\n",       "card",    "COHERENTE"),
    ("H-1+H-2 2col sin backtick",    CAB2 + "| card | COHERENTE |\n",                    "card",    "COHERENTE"),
    ("H-3 REQUIERE_TRIAGE",          CAB3 + "| `cuenta` (Mi cuenta) | REQUIERE_TRIAGE | x |\n", "cuenta", "REQUIERE_TRIAGE"),
    ("H-3 REQUIRES_TRIAGE (alias)",  CAB3 + "| `cuenta` (Mi cuenta) | REQUIRES_TRIAGE | x |\n", "cuenta", "REQUIERE_TRIAGE"),
    ("H-3 INCOMPLETO",               CAB3 + "| `detalle` (Mi dia) | INCOMPLETO | x |\n", "detalle", "INCOMPLETO"),
    # Las tres formas del id RARO que el propio padron fabrico. Antes del fix: las tres ilegibles.
    ("H-4 id del padron con bt",     CAB3 + "| `(home)` (Mi dia) | COHERENTE | ok |\n",  "(home)", "COHERENTE"),
    ("H-4 id del padron pelado",     CAB3 + "| (home) | COHERENTE | ok |\n",             "(home)", "COHERENTE"),
    ("H-4 id del padron en negrita", CAB3 + "| **`(home)`** | COHERENTE | ok |\n",       "(home)", "COHERENTE"),
]
for rot, txt, id_esp, v_esp in CASOS:
    ids, vs = med(txt)
    ok = (id_esp in ids) and (v_esp in vs)
    print("%s\t%s\tid=%s v=%s" % ("OK" if ok else "FAIL", rot, ids, vs))

# CONTROL NEGATIVO: la CABECERA no es una medicion. Al relajar los backticks, `sujeto`/`veredicto`
# empiezan a matchear SUJ_CELDA -- si el parser cuenta la cabecera, infla las mediciones en silencio.
_, meds, _ = cv.mediciones_de(CAB3 + "| `factura` (ARCA) | COHERENTE | ok |\n")
cab = [m["id"] for m in meds if m["id"] in ("sujeto", "s", "veredicto")]
print("%s\tNEGATIVO cabecera no es medicion\tcabeceras_contadas=%s" % ("OK" if not cab else "FAIL", cab))

# CONTROL NEGATIVO 3 -- el que decide si el fix de `(home)` es correcto o es una relajacion. La
# pertenencia al padron autoriza el token EXACTO, no su APARICION: una celda que apenas MENCIONA un
# id del padron (rol de referencia, no de sujeto) no puede volverse una medicion, o el parser
# empieza a inventar sujetos leyendo prosa. Es la misma distincion que #721 dejo escrita: el rol de
# la cita se escribe, no se infiere.
_, meds3, _ = cv.mediciones_de(CAB3 + "| ver `(home)` mas arriba | COHERENTE | ok |\n", ids=IDS)
ref = [m["id"] for m in meds3 if m["id"] == "(home)"]
print("%s\tNEGATIVO mencion en rol de referencia no es sujeto\tsujetos=%s" % ("OK" if not ref else "FAIL", ref))

# CONTROL NEGATIVO 4: un token con forma rara que NO esta en el padron sigue siendo ilegible. Si
# pasara, el fix no seria "acepto lo que el padron declara" sino "acepto cualquier cosa".
_, meds4, _ = cv.mediciones_de(CAB3 + "| `(inventado)` | COHERENTE | ok |\n", ids=IDS)
inv = [m["id"] for m in meds4 if "inventado" in m["id"]]
print("%s\tNEGATIVO forma rara FUERA del padron sigue ilegible\tsujetos=%s" % ("OK" if not inv else "FAIL", inv))

# CONTROL NEGATIVO 2: un separador de DOS columnas sigue siendo separador, no una fila.
_, meds2, _ = cv.mediciones_de(CAB2 + "| `card` (gasto) | COHERENTE |\n")
print("%s\tNEGATIVO separador 2col no es fila\tmediciones=%d (esperado 1)"
      % ("OK" if len(meds2) == 1 else "FAIL", len(meds2)))
PYEOF
)"
echo "$corrida"
if echo "$corrida" | grep -q '^FAIL'; then
  fallos=$(echo "$corrida" | grep -c '^FAIL')
  echo "❌ $fallos caso(s) en rojo"
fi
if ! echo "$corrida" | grep -q '^OK.POSITIVO'; then
  echo "🛑 EL POSITIVO ESTA EN ROJO: la tanda entera es invalida, no leas los otros casos."
  exit 1
fi
[ "$fallos" -eq 0 ] && { echo "✅ todas las formas de tabla vistas ($(echo "$corrida" | grep -c '^OK') casos)"; exit 0; }
exit 1
