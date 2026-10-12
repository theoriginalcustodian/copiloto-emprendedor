#!/usr/bin/env python3
"""M-00 — la pregunta que hasta hoy no tenia instrumento: **que ids del padron de 54 NO tienen
veredicto en mobile**, por nombre y no por cifra.

POR QUE EXISTE
--------------
Habia dos instrumentos y ninguno contestaba esto (medido 2026-10-11):
  - `criterio3-cruce.sh` emite LISTA con nombres, pero cuenta «con veredicto por cualquier via» y
    **no mira plataforma** (su unico flag es `--tsv`, `:21`).
  - `contar-veredictos.py` **si** sabe de plataforma (`web 54/54 · mobile 13/54`) pero emite
    **cifra**, no lista.
Los dos estan BIEN y ninguno falla: contestan preguntas distintas de la que hace el criterio. Es la
costura clasica de este repo — cada lado verifica su mitad y el hueco no es de nadie.

POR QUE NO ES UN SCRIPT NUEVO SINO UN AGREGADOR
----------------------------------------------
La lista por plataforma YA la calcula `contar-veredictos.py --json`, **por lote**
(`/lotes/<doc>/ids_cerrados_por_plataforma/<plataforma>`). Lo que faltaba era unirla sobre los 20
documentos del corpus y restarla del padron. Re-implementar el parseo de los cierres habria sido
fabricar una segunda definicion de «tiene veredicto», que puede divergir de la que cita el criterio.

EL DISENO QUE HABIA BAJADO ERA CONTRA UNA FORMA IMAGINADA
---------------------------------------------------------
El doc de arranque del 08/10 decia «localizar la columna `plataforma` por su NOMBRE en el encabezado
de cada tabla», con el mapa «lote A = campo 4 de 4 · lote B = campo 5 de 8». Medido hoy, el registro
vive en **CUATRO** formas, no dos:
  1. lote A, los ~14 medidos: NO estan en ninguna tabla — son secciones `### id` y la plataforma es
     un token en prosa (`· plataforma: web`). 21 apariciones, **todas web**.
  2. lote A, tabla «Declaradas sin medir»: plataforma = campo 4 de 4. 2 filas, las dos `mobile`.
  3. lote B, tabla 1 (`:15`): plataforma = campo 5 de 8. 15 filas (11 web, 4 mobile).
  4. lote B, tabla 2 (`:72`, el backfill `medido_contra`): plataforma = campo **2 de 4**. 16 filas,
     todas web — y es la tabla con MAS filas de las dos.
Un filtro que busque la columna en el encabezado de «cada tabla» lee 2, 3 y 4 y es **ciego a 1**,
que es la poblacion mas grande. Y la cifra de arranque («lote A, 4 de 4») salio de leer el
encabezado de la tabla de declaradas y suponer que las 14 filas medidas estaban adentro: tiene 2.

QUE EMITE
---------
Las tres poblaciones del padron respecto de una plataforma, con sus ids:
  - CON_COMPARACION      : hay veredicto en esa plataforma y al menos uno es una comparacion real.
  - SOLO_NO_COMPARACION  : hay veredicto pero TODOS son NO_MEDIBLE / FUERA-DE-REFERENCIA /
                           NO_REPRODUCIBLE_SIN_EFECTO / PENDIENTE_DEVICE. Cuenta como «cubierto» en
                           la cifra 13/54 y **no** como comparado. Es la mitad que la cifra esconde.
  - SIN_NADA             : ningun veredicto de esa plataforma en los documentos del corpus.

Uso:  python scripts/evidencia/falta-en-mobile.py [--tsv] [--plataforma web|mobile]
Exit: 0 = ok · 1 = un control fallo (la salida NO es confiable) · 2 = falta una fuente
"""
import json
import pathlib
import shutil
import subprocess
import sys

# `bash` a secas NO alcanza en Windows: CreateProcess lo resuelve a `System32\bash.exe` (WSL) aunque
# `shutil.which("bash")` diga Git bash, y WSL no ve las rutas `C:/...`. Peor: su queja sale por
# **stdout** en UTF-16 y deja `stderr` VACIO, asi que un diagnostico que mire solo stderr informa
# «la fuente fallo» sin decir por que — dos causas distintas con el mismo exit code, y el mensaje
# elige la equivocada. Se resuelve el binario una vez y se pasa su ruta absoluta.
BASH = shutil.which("bash") or r"C:\Program Files\Git\usr\bin\bash.exe"

AQUI = pathlib.Path(__file__).resolve().parents[2]
CONTADOR = AQUI / "scripts" / "evidencia" / "contar-veredictos.py"
PADRON = AQUI / "scripts" / "evidencia" / "criterio3-padron.sh"

def morir(msg, code=2):
    """Un fallo de FUENTE sale 2; un control que falla sale 1. No se mezclan: `sys.exit("texto")`
    sale 1 y se confundiria con «un control fallo», que es un estado distinto — uno dice «no pude
    medir», el otro «medi y la medicion no es confiable»."""
    print("x " + msg, file=sys.stderr)
    sys.exit(code)


PLATAFORMA = "mobile"
FORMATO = "md"
args = sys.argv[1:]
while args:
    a = args.pop(0)
    if a == "--tsv":
        FORMATO = "tsv"
    elif a == "--plataforma":
        if not args:
            morir("--plataforma necesita un valor (web|mobile)")
        PLATAFORMA = args.pop(0)
        if PLATAFORMA not in ("web", "mobile"):
            morir("plataforma no reconocida: " + PLATAFORMA + " (web|mobile)")
    else:
        morir("argumento no reconocido: " + a + "\nuso: [--tsv] [--plataforma web|mobile]")


# --- El padron: se reutiliza el script que YA lo establece, no se re-implementa -------------------
if not PADRON.exists():
    morir("no existe el padron: " + str(PADRON))
p = subprocess.run([BASH, str(PADRON), "--tsv"], capture_output=True, text=True,
                   encoding="utf-8", errors="replace")
if p.returncode != 0:
    # Los DOS canales: el fallo que mas cuesta diagnosticar acá (bash equivocado) no escribe una
    # sola linea en stderr. Un reporte de error que solo mira un canal se queda mudo justo cuando
    # la causa es la que no esperabas.
    morir("el padron no se pudo establecer (exit " + str(p.returncode) + ").\n  stderr: "
          + (p.stderr or "")[:600] + "\n  stdout: " + (p.stdout or "")[:300])
padron = sorted({l.split("\t")[0] for l in p.stdout.splitlines() if l.strip()})
if not padron:
    morir("el padron salio VACIO. Eso no es 'cero ids': es una fuente que no se leyo.")

# --- Los veredictos por plataforma: del --json del contador, que es quien define la unidad --------
if not CONTADOR.exists():
    morir("no existe el contador: " + str(CONTADOR))
c = subprocess.run([sys.executable, str(CONTADOR), "--json"], capture_output=True, text=True,
                   encoding="utf-8", errors="replace")
if c.returncode != 0:
    morir("el contador fallo. Su error:\n" + (c.stderr or "")[-2000:])
try:
    datos = json.loads(c.stdout)
except json.JSONDecodeError as e:
    morir("el --json del contador no parsea (" + str(e) + "). NO se asume vacio.")

lotes = datos.get("lotes") or {}
if not lotes:
    morir("el contador no reporto ni un lote. Fuente faltante, no 'cero veredictos'.")


def cerrados_de(doc, plat):
    return set((doc.get("ids_cerrados_por_plataforma") or {}).get(plat) or [])


def solo_nc_de(doc, plat):
    return set((doc.get("ids_solo_no_comparacion_por_plataforma") or {}).get(plat) or [])


cerrados = set()
solo_nc = set()
for doc in lotes.values():
    cerrados |= cerrados_de(doc, PLATAFORMA)
    solo_nc |= solo_nc_de(doc, PLATAFORMA)

# Un id cuenta como comparado si ALGUN documento le dio una comparacion real. `solo_nc` es por
# documento: la union de «solo no-comparacion» no implica que el id no tenga comparacion en otro.
# Por eso se filtra, no se acumula — SOLO_NO_COMPARACION son los cubiertos cuyos aportes son TODOS
# no-comparacion en TODOS los documentos que los nombran. Acumular daria un hueco inflado, y un
# backlog inflado manda a medir de nuevo algo que ya se midio.
nc_en_todos = set()
for idd in solo_nc:
    docs_que_lo_nombran = [d for d in lotes.values() if idd in cerrados_de(d, PLATAFORMA)]
    if docs_que_lo_nombran and all(idd in solo_nc_de(d, PLATAFORMA) for d in docs_que_lo_nombran):
        nc_en_todos.add(idd)

enp = set(padron)
con_comp = sorted((cerrados & enp) - nc_en_todos)
solo_ncl = sorted(nc_en_todos & enp)
sin_nada = sorted(enp - cerrados)
fuera = sorted(cerrados - enp)   # dato, no error: veredicto de un id que la spec no reconoce

# --- CONTROLES, antes de cualquier conteo --------------------------------------------------------
fallos = []
# 1. DE SUMA: las tres poblaciones son disjuntas y cubren el padron entero.
if len(con_comp) + len(solo_ncl) + len(sin_nada) != len(padron):
    fallos.append("las poblaciones no suman el padron: "
                  + "+".join(str(len(x)) for x in (con_comp, solo_ncl, sin_nada))
                  + " != " + str(len(padron)))
# 2. POSITIVO del filtro: `web` y `mobile` no pueden dar el MISMO conjunto. Si el filtro no filtra,
#    las dos dan lo mismo y el verde seria el de un instrumento que no mira la columna. Un gate que
#    nunca se vio disparar no se sabe si existe.
otra = "web" if PLATAFORMA == "mobile" else "mobile"
cerrados_otra = set()
for doc in lotes.values():
    cerrados_otra |= cerrados_de(doc, otra)
if cerrados_otra == cerrados:
    fallos.append("CONTROL POSITIVO: '" + PLATAFORMA + "' y '" + otra + "' dan el MISMO conjunto ("
                  + str(len(cerrados)) + " ids) -> el filtro no esta filtrando")
# 3. NEGATIVO: un id inventado no puede aparecer en ninguna poblacion.
if "zznomatchzz" in (cerrados | enp):
    fallos.append("CONTROL NEGATIVO: un id inventado aparecio en el corpus")
# 4. DE CEGUERA: lineas con plataforma que el contador declaro no haber podido leer. Si no es cero,
#    hay filas cayendo en el silencio y «faltan N» podria ser «N que no supe leer».
ciegas = sum(len(d.get("plataforma_sin_leer_lineas") or []) for d in lotes.values())

if fallos:
    for f in fallos:
        print("x " + f, file=sys.stderr)
    print("La salida NO es confiable. No se emite conteo.", file=sys.stderr)
    sys.exit(1)

if FORMATO == "tsv":
    for i in con_comp:
        print(i + "\tCON_COMPARACION")
    for i in solo_ncl:
        print(i + "\tSOLO_NO_COMPARACION")
    for i in sin_nada:
        print(i + "\tSIN_NADA")
else:
    print("| poblacion (" + PLATAFORMA + ") | cuantos | ids |")
    print("|---|---|---|")
    print("| **comparados de verdad** | " + str(len(con_comp)) + " | " + " ".join(con_comp) + " |")
    print("| **cubiertos SIN comparacion** | " + str(len(solo_ncl)) + " | " + " ".join(solo_ncl) + " |")
    print("| **sin ningun veredicto** | " + str(len(sin_nada)) + " | " + " ".join(sin_nada) + " |")
    if fuera:
        print("| (dato) veredicto FUERA del padron | " + str(len(fuera)) + " | " + " ".join(fuera) + " |")

print("", file=sys.stderr)
print("PADRON: " + str(len(padron)) + " ids · corpus: " + str(len(lotes)) + " documentos",
      file=sys.stderr)
print("CUBIERTOS en " + PLATAFORMA + " (la cifra que se cita): "
      + str(len(con_comp) + len(solo_ncl)) + " de " + str(len(padron)), file=sys.stderr)
print("  -> de esos, COMPARADOS de verdad: " + str(len(con_comp)), file=sys.stderr)
print("FALTA MEDIR en " + PLATAFORMA + ": " + str(len(solo_ncl) + len(sin_nada)) + " ("
      + str(len(sin_nada)) + " sin nada + " + str(len(solo_ncl))
      + " con veredicto que no compara)", file=sys.stderr)
print("lineas de plataforma que el contador no pudo leer: " + str(ciegas)
      + ("  <- hay filas cayendo en el silencio" if ciegas else ""), file=sys.stderr)
