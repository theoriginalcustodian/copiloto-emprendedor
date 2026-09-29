#!/usr/bin/env python3
"""Inventario de ANCLAS AMBIGUAS: testids que no identifican una sola pantalla.

Por qué existe (contrato BL-Q3 v2 §8.1, 2026-09-28): una fila de la matriz declara su `camino` con
`path:línea`, pero el instrumento que saca la captura se ancla a un **testid**. Si ese testid se monta
en más de una pantalla, la fila puede estar fotografiando otra y nada falla. El contrato lo dice sin
rodeos: «sin eso, el `camino` del §2 se declara pero el instrumento no lo verifica».

Y no lo caza ningún gate existente, por una razón de diseño, no por un bug: `scripts/ci/testid_
paridad.py` compara paridad web↔mobile **por pantalla** — su propiedad 4 tolera a propósito el mismo
id en pantallas distintas. Correcto para lo suyo, y justamente lo que vuelve el problema invisible
para la matriz. El hueco vive en la junta entre los dos, y la junta no tenía dueño.

Tres clases, que piden arreglos distintos:

  DUPLICADO              el mismo testid escrito en 2+ archivos     -> desambiguar o unificar
  REUSABLE_MULTIPANTALLA 1 definición, en un componente montado     -> la fila NO puede anclarse al
                         desde 2+ pantallas                            testid solo: contenedor + testid
  UNICO                  identifica una sola pantalla               -> se puede anclar sin más

CONTROL POSITIVO, horneado en el script: `mic-funcion` tiene **1 definición** (`MicFuncion.tsx:83`) y
se monta en **4** pantallas de web — `ClientesScreen`, `GastosScreen`, `IngresosScreen`,
`PresupuestosScreen`. Si el script no reproduce ese par, aborta: un inventario que no reproduce un
valor verificado no se lee.

⚠️ Ese 4 NO es la cifra que circulaba. El contrato citaba «ocho archivos», y la primera corrida de
este script abortó por eso. **El que estaba mal era el valor de referencia**: los 8 salen de contar el
símbolo `MicFuncion` en cualquier posición, y dos de ellos lo nombran **en un comentario**
(`Bubble.tsx:18`, `MicButton.tsx:12`, ambos con cero `<MicFuncion`), más dos que lo importan sin
montarlo en JSX. Contando la FORMA —el uso como elemento— son 4, y las 4 son pantallas.
Moraleja operativa, que es el motivo de que el umbral no se haya «ajustado para que pase»: un control
positivo que falla puede estar acusando al valor esperado, no al instrumento, y averiguar cuál de los
dos es exige ir a mirar. Ver `memoria/contar-un-simbolo-no-dice-en-que-rol-aparece.md` y
`memoria/el-guard-se-satisface-con-su-propio-comentario.md`.

Read-only. Uso: python scripts/evidencia/anclas-ambiguas.py [--json]
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
APPS = {"web": RAIZ / "apps/copiloto-web/src", "mobile": RAIZ / "apps/mobile/src"}
DEF = re.compile(r"""(?:data-testid|testID)\s*=\s*["']([^"'{}]+)["']""")
# Una "pantalla" es lo que el usuario percibe como tal. Las dos convenciones del repo, medidas:
# `*Screen.tsx` en web, `Pantalla*.tsx` en mobile (más las de web que usan el prefijo castellano).
ES_PANTALLA = re.compile(r"(Screen|Pantalla[A-Z])[^/]*\.tsx$")
CONTROL = {"testid": "mic-funcion", "defs": 1, "montajes_web": 4}


def archivos(base):
    return [p for p in base.rglob("*.tsx") if ".test." not in p.name] if base.is_dir() else []


def recolectar(base):
    """testid -> {archivo: [líneas]}, y el texto de cada archivo para el pase de imports."""
    defs, texto = defaultdict(lambda: defaultdict(list)), {}
    for p in archivos(base):
        try:
            src = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        texto[p] = src
        for n, linea in enumerate(src.splitlines(), 1):
            for tid in DEF.findall(linea):
                defs[tid][p].append(n)
    return defs, texto


def montajes(componente, texto):
    """Archivos que usan <Componente ...> o lo importan por nombre. Un nivel, no transitivo:
    alcanza para decir «más de una pantalla» y no inventa un grafo que no medí."""
    nombre = componente.stem
    usos = set()
    marca = re.compile(r"<%s[\s/>]|from\s+['\"][^'\"]*%s['\"]" % (re.escape(nombre), re.escape(nombre)))
    for p, src in texto.items():
        if p != componente and marca.search(src):
            usos.add(p)
    return usos


def clasificar(app, base):
    defs, texto = recolectar(base)
    filas = []
    for tid, porArchivo in sorted(defs.items()):
        archs = sorted(porArchivo)
        if len(archs) > 1:
            filas.append({"testid": tid, "clase": "DUPLICADO", "app": app,
                          "donde": [f"{a.relative_to(RAIZ).as_posix()}:{porArchivo[a][0]}" for a in archs],
                          "pantallas": len([a for a in archs if ES_PANTALLA.search(a.as_posix())])})
            continue
        a = archs[0]
        rel = f"{a.relative_to(RAIZ).as_posix()}:{porArchivo[a][0]}"
        if ES_PANTALLA.search(a.as_posix()):
            filas.append({"testid": tid, "clase": "UNICO", "app": app, "donde": [rel], "pantallas": 1})
            continue
        usos = montajes(a, texto)
        pant = sorted(u for u in usos if ES_PANTALLA.search(u.as_posix()))
        filas.append({
            "testid": tid,
            "clase": "REUSABLE_MULTIPANTALLA" if len(pant) > 1 else "UNICO",
            "app": app, "donde": [rel], "pantallas": len(pant), "montajes": len(usos),
            "desde": [p.name for p in pant],
        })
    return filas


todo = [f for app, base in APPS.items() for f in clasificar(app, base)]
if not todo:
    print("0 testids: el instrumento no midio nada. No es un hallazgo — revisá las rutas.", file=sys.stderr)
    sys.exit(2)

# --- control positivo antes de imprimir un solo resultado -------------------------------------
ctl = [f for f in todo if f["testid"] == CONTROL["testid"] and f["app"] == "web"]
if len(ctl) != CONTROL["defs"] or ctl[0].get("pantallas") != CONTROL["montajes_web"]:
    got = f"{len(ctl)} def(s), {ctl[0].get('pantallas') if ctl else '-'} montajes"
    print(f"CONTROL POSITIVO FALLA: `{CONTROL['testid']}` deberia dar "
          f"{CONTROL['defs']} def / {CONTROL["montajes_web"]} pantallas (verificado por forma, "
          f"no por conteo del simbolo) y da {got}. El inventario NO se lee hasta reproducir ese par.",
          file=sys.stderr)
    sys.exit(3)
print(f"CONTROL POSITIVO OK: `{CONTROL['testid']}` = {CONTROL['defs']} def / "
      f"{CONTROL["montajes_web"]} pantallas, verificado por forma (uso JSX), no por conteo del simbolo.\n")

if "--json" in sys.argv:
    print(json.dumps(todo, ensure_ascii=False, indent=2))
    sys.exit(0)

for clase in ("DUPLICADO", "REUSABLE_MULTIPANTALLA"):
    filas = [f for f in todo if f["clase"] == clase]
    print(f"=== {clase}: {len(filas)} ===")
    for f in filas:
        extra = f" <- {f['pantallas']} pantallas: {', '.join(f.get('desde', []))}" if f.get("desde") else ""
        print(f"  [{f['app']:6}] {f['testid']:34} {' · '.join(f['donde'])}{extra}")
    print()

print("=== resumen ===")
for app in APPS:
    porClase = defaultdict(int)
    for f in todo:
        if f["app"] == app:
            porClase[f["clase"]] += 1
    total = sum(porClase.values())
    amb = porClase["DUPLICADO"] + porClase["REUSABLE_MULTIPANTALLA"]
    print(f"  {app:6} {total:4} testids · {amb} ambiguos "
          f"({porClase['DUPLICADO']} duplicados + {porClase['REUSABLE_MULTIPANTALLA']} reusables)")
print()
print("Una fila de la matriz anclada a un testid AMBIGUO no verifica su propio `camino`: el ancla")
print("no dice en que pantalla esta. Arreglo sin tocar la app: anclar al contenedor de la pantalla")
print("Y al testid dentro de el. Arreglo de raiz: el componente lleva el contexto en su testid.")
