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
# La cabecera DECLARA donde vive el sujeto (`camino`) y el enumerador ocupa la primera celda. Es la
# forma del `cierre_` de frontend2 del 30/09, invisible dos dias: no era una medicion nueva, era una
# que el lector no podia atribuir, y por ser sus UNICOS sujetos el documento no llegaba a candidato.
CAB_COL = "| # | camino | veredicto |\n|---|---|---|\n"
# La MISMA forma con una cabecera que NO declara columna de sujeto. El lector no puede leerla —y no
# debe inventarla— pero el DETECTOR si tiene que verla: ese margen entre los dos ES el mecanismo.
CAB_SIN = "| # | nota | veredicto |\n|---|---|---|\n"
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
    # H-5: el sujeto NO esta en la primera celda; la cabecera dice en cual esta.
    ("H-5 sujeto en la columna que la cabecera nombra",
     CAB_COL + "| A-1 | `factura` / wizard con borrador | COHERENTE |\n", "factura", "COHERENTE"),
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

# ── COLUMNA DE SUJETO: la cabecera es RED, no AUTORIDAD ───────────────────────────────────────
# NEGATIVO 5 -- el caso que decide si el fallback es un fix o una relajacion. `camino` nombra DOS
# cosas en este corpus: la columna donde vive el id, y la dimension `camino A`/`camino B` de un id
# que vive en la celda 1 (el caso MAYORITARIO). Si la cabecera ganara, cada tabla con columna
# `camino` empezaria a leer el sujeto de la columna equivocada -- y con `card` en la celda 1 el
# error ni siquiera daria rojo: daria OTRO sujeto.
_, meds5, _ = cv.mediciones_de(CAB_COL + "| `card` (gasto) | camino A | COHERENTE |\n", ids=IDS)
f5 = [(m["id"], m["forma_decl"]) for m in meds5]
ok5 = f5 == [("card", "celda")]
print("%s\tNEGATIVO la celda 1 GANA sobre la columna de la cabecera\t%s (esperado [('card','celda')])"
      % ("OK" if ok5 else "FAIL", f5))

# NEGATIVO 6 -- sin cabecera que declare columna de sujeto, el lector NO inventa. `nota` no declara
# nada, y el id de la celda 2 no puede leerse por adivinanza: seria exactamente la tabla de
# taxonomia donde los ids del padron estan en rol de EJEMPLO (medida en el buzon: 3 filas asi).
_, meds6, _ = cv.mediciones_de(CAB_SIN + "| A-1 | `factura` / wizard | COHERENTE |\n", ids=IDS)
print("%s\tNEGATIVO sin columna declarada no se inventa sujeto\tsujetos=%s"
      % ("OK" if not meds6 else "FAIL", [m["id"] for m in meds6]))

# NEGATIVO 7 -- el ancla `^` sigue separando SUJETO de REFERENCIA tambien en la columna nombrada.
_, meds7, _ = cv.mediciones_de(CAB_COL + "| A-1 | ver `factura` mas arriba | COHERENTE |\n", ids=IDS)
print("%s\tNEGATIVO mencion en rol de referencia tampoco cuenta en la columna\tsujetos=%s"
      % ("OK" if not meds7 else "FAIL", [m["id"] for m in meds7]))

# ── EL DETECTOR ES MAS ANCHO QUE EL LECTOR ────────────────────────────────────────────────────
# Este par es el diseno entero. Un detector tan ancho como su lector no puede avisar de la ceguera
# de su lector: por eso `filas_ciegas_de` acepta el id del padron en CUALQUIER celda, y el lector
# solo en la primera y en la que la cabecera nombra. El hueco entre los dos es la alarma.
d_pos = cv.filas_ciegas_de(CAB_SIN + "| A-1 | `factura` / wizard | COHERENTE |\n", IDS)
print("%s\tDETECTOR ve la fila que el lector NO puede leer\tfilas=%s (esperado 1)"
      % ("OK" if len(d_pos) == 1 else "FAIL", d_pos))

d_neg = cv.filas_ciegas_de(CAB_COL + "| A-1 | `factura` / wizard | COHERENTE |\n", IDS)
print("%s\tDETECTOR callado cuando el lector SI la lee\tfilas=%s (esperado 0)"
      % ("OK" if not d_neg else "FAIL", d_neg))

# Y no dispara con un id FUERA del padron: el padron cerrado es lo que impide que esto marque
# cualquier palabra citada entre backticks en cualquier celda.
d_neg2 = cv.filas_ciegas_de(CAB_SIN + "| A-1 | `inventado` / x | COHERENTE |\n", IDS)
print("%s\tDETECTOR no dispara con un id fuera del padron\tfilas=%s (esperado 0)"
      % ("OK" if not d_neg2 else "FAIL", d_neg2))
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
if [ "$fallos" -ne 0 ]; then exit 1; fi
echo "✅ todas las formas de tabla vistas ($(echo "$corrida" | grep -c '^OK') casos)"

# ── CANARIO DEL ALFABETO: el padron contra su lector ───────────────────────────────────────────
#
# Los casos de arriba prueban FORMAS que yo elijo. Esto prueba algo distinto y que ninguno de
# ellos puede: que **los 54 ids que el padron realmente contiene** son legibles por este parser.
# La diferencia no es de grado — `(home)` fue ilegible 8 dias con todos los casos de forma en
# verde, porque ninguno usaba un id del padron con parentesis. Y la falla no daba sintoma: un
# documento cuyo UNICO sujeto es ilegible no llega a ser candidato, asi que no aparece ni entre
# los medidos ni entre los descartados, y el ratchet `exit 8` nunca se entera.
#
# El padron es GENERADO (`criterio3-padron.sh:59` normalizo `*(vacio)* Mi dia` -> `(home)`), asi
# que la proxima spec puede fabricar otro id raro. El canario falla **al construir**, no 8 dias
# despues. Escrito por auditoria, con sus dos controles horneados (lector ciego inyectado /
# token fuera del padron); se llama desde aca para que lo corra el gate y no la memoria de nadie.
#
# Su exit 2 se trata como ROJO a proposito: aca dentro «no pude establecer la precondicion» es un
# fallo del gate, no una excusa. Lo contrario seria un vacio absolviendo
# (`memoria/vacio-no-es-hallazgo-correr-el-control.md`).
echo
CANARIO="$(dirname "${BASH_SOURCE[0]}")/canario-alfabeto-padron.py"
if [ ! -f "$CANARIO" ]; then
  echo "❌ falta el canario del alfabeto ($CANARIO) — el cruce padron<->lector no se esta midiendo"
  exit 1
fi
if python "$CANARIO"; then
  echo "✅ canario del alfabeto: el padron y su lector comparten el alfabeto"
else
  rc_can=$?
  echo "❌ canario del alfabeto: exit $rc_can — hay ids del padron que este parser NO puede leer"
  echo "   (exit 1 = ilegibles, nombrados arriba · exit 2 = precondicion; las dos son rojo del gate)"
  exit 1
fi

