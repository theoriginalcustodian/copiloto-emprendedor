#!/usr/bin/env python
"""Fabrica un corpus SINTETICO para que el gate de CI mida el CODIGO y no el estado del buzon.

EL DEFECTO QUE CIERRA (LINTALCANCE, medido 3 veces el 2026-10-05). `contar-veredictos.py` tiene dos
clases de ratchet que el gate corria juntas:

  · de CODIGO   -- el parser lee las formas, el padron se cruza, la cobertura cierra, los lotes
                   rinden sus pisos. Todo esto lo determina el commit.
  · de ESTADO   -- «hay un documento del buzon sin clasificar» (exit 8). Esto lo determina el
                   CORPUS: `coordinacion/`, que es vivo, compartido entre cuatro sesiones y NO
                   versionado.

Correr el segundo dentro del gate de merge tiene tres consecuencias que se midieron el mismo dia:
  1. una emision de OTRA sesion pone rojo el `lint` de TODAS las ramas, sobre commits intactos. Paso
     tres veces en una hora (la tercera, un `hallazgo_` de auditoria a los minutos de publicarse);
  2. el mismo `lint.sh` da DISTINTO segun la rama -- 5 documentos sin clasificar en una, 1 en otra --
     porque la clasificacion vive en el codigo de cada rama y el corpus es uno y compartido;
  3. en GitHub Actions `coordinacion/` no existe, asi que el contador aborta con 2, el test saltea
     entero y el gate NO MIDE NADA en el unico lugar donde es obligatorio.

Un gate cuyo veredicto depende de un estado que el commit no controla no es un gate: es ruido con
autoridad de bloqueo. El ratchet de estado sigue existiendo -- se mudo a `auditar-corpus-vivo.sh`,
que corre en el ciclo de vigilancia de planificacion (duena de clasificar) y puede ponerse rojo sin
trabar el merge de nadie.

POR QUE EL CORPUS SE DERIVA DEL CODIGO Y NO SE VERSIONA A MANO:

  · `coordinacion/` esta gitignored a proposito (CLAUDE.md §3.quater: versionarla la duplicaria por
    worktree y el mensaje de una sesion no existiria para la otra). Copiar documentos reales ahi
    adentro seria versionar el buzon por la puerta de atras.
  · Los NOMBRES ya viven en el codigo (`MEDICIONES_DECLARADAS`), que es publico. El CONTENIDO es
    sintetico: tablas minimas con ids del padron. Nada del buzon se copia.
  · Derivarlo del codigo lo hace CONVERGENTE: el dia que alguien declara un documento nuevo, el
    fixture lo incluye sin que haya que acordarse de nada. Un fixture escrito a mano envejece y
    empieza a certificar un estado que ya no existe -- el mismo modo de falla del piso viejo.
  · Los PISOS del control positivo (`lote-A` >= 15, `lote-B` >= 10) se LEEN del fuente del contador.
    Hardcodearlos aca haria que el dia que suban, el fixture siga pasando mintiendo.

LO QUE ESTE FIXTURE NO PUEDE MEDIR, dicho explicito para que nadie lo lea como cobertura total: la
cifra real «web N de 54» es del corpus vivo y no se computa aca -- ese dato es de ESTADO y su dueno
es `auditar-corpus-vivo.sh`. Aca se mide que el instrumento SABE computarla.

Uso:  python scripts/evidencia/fabricar-corpus-fixture.py <dir>   ->  imprime la ruta del corpus
"""
import ast
import importlib.util
import io
import re
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CONTADOR = RAIZ / "scripts" / "evidencia" / "contar-veredictos.py"

# Windows corta en 260 y lo hace EN SILENCIO: `git clone` ya dejo carpetas de skills incompletas con
# exit 0 en este mismo workspace. Un fixture a medias es peor que ninguno -- los ratchets que no
# alcanzan a leer su documento disparan con la causa equivocada. Se mide antes de escribir.
MAX_PATH = 260


def _literal(fuente, nombre):
    """El literal de `nombre` por balance de llaves. Una regex greedy se come los comentarios, que
    en este fuente traen llaves adentro; una no-greedy corta en la primera llave de un motivo."""
    m = re.search(nombre + r"\s*=\s*([\{\(])", fuente)
    if not m:
        sys.exit(f"NO PUEDO FABRICAR: no encontre el literal {nombre} - cambio de forma?")
    i, prof = m.end() - 1, 0
    for j in range(i, len(fuente)):
        if fuente[j] in "{(":
            prof += 1
        elif fuente[j] in "})":
            prof -= 1
            if prof == 0:
                return ast.literal_eval(fuente[i:j + 1])
    sys.exit(f"NO PUEDO FABRICAR: el literal {nombre} no cierra")


def fabricar(destino):
    if not CONTADOR.exists():
        sys.exit(f"NO PUEDO FABRICAR: falta {CONTADOR}")
    fuente = io.open(CONTADOR, encoding="utf-8").read()
    declarados = sorted(_literal(fuente, "MEDICIONES_DECLARADAS"))
    if not declarados:
        sys.exit("NO PUEDO FABRICAR: MEDICIONES_DECLARADAS vacio - un corpus de 0 documentos pasaria"
                 " los ratchets por vacuidad y el gate certificaria la nada")

    # El padron sale de la SPEC via el propio contador, no de una copia: si el universo cambia, el
    # fixture cambia con el. Se importa tolerando el SystemExit de su `main`.
    spec = importlib.util.spec_from_file_location("_cv_fixture", CONTADOR)
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except SystemExit:
        pass
    try:
        ids = sorted(mod.universo_de_sujetos())
    except SystemExit as e:
        sys.exit(f"NO PUEDO FABRICAR: el contador no pudo leer la spec ({e}) - sin padron el fixture"
                 f" seria un corpus de ids inventados")
    if len(ids) < 15:
        sys.exit(f"NO PUEDO FABRICAR: el padron dio {len(ids)} ids (<15): es el mismo control que el"
                 f" contador tiene adentro, y un fixture sobre un padron roto no prueba nada")

    pisos = {p: int(n) for p, n in re.findall(r'\("(lote-[AB])",\s*(\d+)\)', fuente)}
    if not pisos:
        sys.exit("NO PUEDO FABRICAR: no pude leer los pisos de los lotes del fuente del contador")

    corpus = Path(destino) / "corpus-fixture"
    if corpus.exists():
        shutil.rmtree(corpus)                      # idempotente: se regenera, no se parcha
    (corpus / "abierto").mkdir(parents=True)

    largo = max(len(str(corpus / "abierto" / n)) for n in declarados)
    if largo >= MAX_PATH:
        sys.exit(f"NO PUEDO FABRICAR: la ruta mas larga del fixture mide {largo} y el techo de"
                 f" Windows es {MAX_PATH}. Elegi un <dir> mas corto - escribirlo igual dejaria un"
                 f" corpus incompleto Y SILENCIOSO.")

    for k, nombre in enumerate(declarados):
        # Cuantas filas: 4 por defecto; los dos lotes reciben su piso +1, leido del codigo. El
        # desfase `k * 7` reparte ids distintos por documento para que el agregado no sea un solo id
        # repetido 19 veces -- eso pasaria los pisos sin ejercitar el cruce contra el padron.
        cuantas = 4
        for pat, piso in pisos.items():
            if pat in nombre:
                cuantas = piso + 1
        mios = [ids[(k * 7 + z) % len(ids)] for z in range(cuantas)]
        filas = "\n".join(f"| `{i}` | web | COHERENTE | fixture sintetico |" for i in mios)
        io.open(corpus / "abierto" / nombre, "w", encoding="utf-8", newline="\n").write(
            "# FIXTURE SINTETICO - generado por fabricar-corpus-fixture.py\n\n"
            "No es el documento real: el nombre viene de `MEDICIONES_DECLARADAS` y el contenido es\n"
            "una tabla minima con ids del padron. No copiar nada del buzon aca.\n\n"
            "| sujeto | plataforma | veredicto | nota |\n|---|---|---|---|\n" + filas + "\n")

    escritos = len(list((corpus / "abierto").glob("*.md")))
    if escritos != len(declarados):
        sys.exit(f"NO PUEDO FABRICAR: escribi {escritos} de {len(declarados)} documentos. Contar los"
                 f" archivos contra el origen es obligatorio en Windows: `mkdir`/`write` fallan por"
                 f" MAX_PATH con exit 0 y dejan la carpeta a medias.")
    return corpus


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("uso: python scripts/evidencia/fabricar-corpus-fixture.py <dir>")
    print(fabricar(sys.argv[1]))
