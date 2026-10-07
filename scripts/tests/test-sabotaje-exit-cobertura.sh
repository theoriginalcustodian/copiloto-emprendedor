#!/usr/bin/env bash
# Sabotaje de los códigos de cobertura del contador: 6 (REGRESIÓN) vs 12 (PISO VIEJO).
#
# POR QUÉ EXISTE (deuda SABOTEXIT, declarada en `4edcfbc3` el 2026-09-30 y pagada acá):
# los dos códigos se partieron porque el `exit 6` decía dos cosas OPUESTAS —«la matriz dejó de
# cubrir X, NO toques el piso» y «el piso quedó viejo, sacá X del piso»— y un código compartido
# cuyas acciones son inversas no pierde información: ELIGE MAL por el lector. Ese día me hizo
# traer un commit ajeno que invirtió el fallo (rc 0 -> 6). Partirlos sin probar que cada uno
# dispara es un «mecanismo roto hacia el NO» sin control positivo: los códigos existen en el
# fuente y nadie había medido que se eligieran bien.
#
# CÓMO SE SABOTEA, Y POR QUÉ ASÍ: apuntando `COPILOTO_PISO` a un piso de fixture. Antes de esto el
# único modo era copiar el script a otro árbol, que es EXACTAMENTE la trampa que causó el
# incidente (`RAIZ = parents[2]` hace que el sujeto lo decida dónde está el archivo). Un test que
# necesita la trampa para probar el arreglo no prueba nada.
#
# Todo corre dentro de un solo Python a propósito: mezclar Git Bash y Python de Windows en un
# mismo comando hace que `/tmp/x` sea dos archivos distintos y el tramo que acredita sea el que
# corrió bien (caso del 2026-10-05, en `prometer-no-es-ejecutar-el-gate-media-la-palabra`).
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1

PYTHONIOENCODING=utf-8 python - <<'PY'
import ast, io, os, re, subprocess, sys
from pathlib import Path

EV = Path("scripts/evidencia")
CONTADOR, MATRIZ = EV / "contar-veredictos.py", EV / "criterio3-matriz.mjs"
for p in (CONTADOR, MATRIZ):
    if not p.exists():
        print(f"NO PUEDO MEDIR: falta {p}"); sys.exit(1)

fuente = CONTADOR.read_text(encoding="utf-8")
m = re.search(r"CIEGOS_DECLARADOS = (\{.*?\n\})", fuente, re.S)
if not m:
    print("NO PUEDO MEDIR: no encontré el literal CIEGOS_DECLARADOS — ¿cambió de forma?")
    sys.exit(1)
piso = ast.literal_eval(m.group(1))

# Un id que la matriz SÍ captura y que NO está en el piso: es el único que puede provocar un 12
# legítimo. Inventar un id cualquiera también daría 12, pero por una razón falsa — probaría que el
# código dispara con basura, no que distingue «el piso quedó viejo».
claves = set(re.findall(r"^\s{2}([a-z][a-z0-9-]{1,30})\s*:", MATRIZ.read_text(encoding="utf-8"), re.M))
cubiertos = sorted(claves - piso)
if not cubiertos:
    print("NO PUEDO MEDIR: la matriz no cubre ningún id fuera del piso, no hay cebo para el 12")
    sys.exit(1)
cebo = cubiertos[0]

def corre(entorno, etiqueta):
    env = dict(os.environ); env["PYTHONIOENCODING"] = "utf-8"; env.update(entorno)
    r = subprocess.run([sys.executable, str(CONTADOR)], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", env=env)
    return r.returncode, (r.stderr or "")

casos, malos = [], 0

# CONTROL NEGATIVO primero: si el árbol real ya está en 6 o 12, los otros dos casos no se pueden
# leer — un sabotaje que "dispara" sobre un árbol ya roto no prueba que lo haya causado él.
rc, err = corre({}, "limpio")
ok = rc not in (6, 12)
casos.append(("CONTROL NEGATIVO: sin sabotaje no hay 6 ni 12", ok, f"rc={rc}"))
if not ok:
    print(f"CONTROL NEGATIVO FALLÓ (rc={rc}): el árbol ya tiene el ratchet desalineado, "
          f"el resto de la tanda NO se puede leer.\n{err[:400]}")
    sys.exit(1)

# Dirección 1 — la matriz dejó de cubrir ids que el piso ya no declara  =>  6
rc, err = corre({"COPILOTO_PISO": ""}, "piso vacío")
ok = rc == 6 and "REGRESI" in err
casos.append(("piso VACÍO => 6 (REGRESIÓN)", ok, f"rc={rc}"))
malos += not ok

# Dirección 2 — un id que la matriz SÍ cubre sigue declarado como ciego  =>  12
rc, err = corre({"COPILOTO_PISO": " ".join(sorted(piso)) + " " + cebo}, "piso + cebo")
ok = rc == 12 and "PISO QUED" in err
casos.append((f"piso + «{cebo}» (cubierto por la matriz) => 12 (PISO VIEJO)", ok, f"rc={rc}"))
malos += not ok

# El 6 GANA sobre el 12 cuando los dos aplican, porque se evalúa antes. No es un defecto —la
# regresión es más grave que el piso viejo— pero hay que fijarlo: si algún día se invierte el
# orden, un ciego nuevo se reportaría como «sacá el id del piso», que es la acción que lo empeora.
rc, err = corre({"COPILOTO_PISO": cebo}, "ambos a la vez")
ok = rc == 6
casos.append(("los DOS a la vez => gana el 6, no el 12 (orden de evaluación fijado)", ok, f"rc={rc}"))
malos += not ok

for nombre, ok, detalle in casos:
    print(f"  [{'OK ' if ok else 'MAL'}] {nombre}  ({detalle})")
print(f"\n{len(casos) - malos}/{len(casos)} casos OK")

# DEUDA DECLARADA, no fingida: el exit 13 (RETIRADOS_DECLARADOS) no se puede sabotear todavía —
# esa lista no tiene override y el único modo sería copiar el script, la trampa que este test
# existe para no necesitar. Queda en PLAN.md como parte de SABOTEXIT.
print("nota: el exit 13 queda sin sabotear — RETIRADOS_DECLARADOS no tiene override (ver SABOTEXIT)")
sys.exit(1 if malos else 0)
PY
