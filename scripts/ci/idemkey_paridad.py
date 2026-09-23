#!/usr/bin/env python3
"""IDEM-gasto/PARID: paridad mobile<->web del patrón "idemKey deriva de mensajeId".

El bug de origen (`IDEM-gasto-duplica-plata`): una card de propuesta que remonta (scroll, reload,
reapertura) con una `idemKey` que nace en el montaje genera una clave NUEVA por instancia, y el
backend ve dos intenciones donde hubo una -> duplica. El fix es derivar la clave del `mensajeId`
(`ChatMessage.id`, estable entre remounts). Se aplicó a mano en 4 archivos (gasto x2, presupuesto
x2); nada impedía que el PRÓXIMO fix -- o un formulario nuevo -- entrara por un solo lado y quedara
callado ahí, que es exactamente el patrón `el-mismo-defecto-vivia-dos-veces`.

El ESCANEO es siempre del script (nunca a mano): descubre los `Formulario*.tsx` de
`apps/{mobile,copiloto-web}/src/modules/*/` que usan `idemKey` en AL MENOS un lado -- ese es el
universo real del patrón, no una lista de 4 rutas hardcodeadas. Para cada uno clasifica el archivo
en un estado por plataforma:
  - "ausente"     -- no usa `idemKey` en absoluto (no es candidato de este patrón)
  - "sin_derivar" -- usa `idemKey` pero la clave nace del GESTO/montaje (`useRef` + `generarId()`),
                     no de `mensajeId` -- mismo bug de origen, si el formulario vive detrás de una
                     card de chat con remount
  - "deriva"      -- `idemKey` se construye con `mensajeId` en la expresión (heurística: ventana de
                     líneas alrededor del uso de `idemKey`; no es un parser AST, mismo trade-off
                     pragmático que `testid_paridad.py` con sus ids dinámicos)

Lo que importa para el ratchet es la PARIDAD, no que las dos plataformas usen `mensajeId` ya hoy:
- mobile y web en el MISMO estado (deriva/deriva, sin_derivar/sin_derivar) -> verde. Un formulario
  que ninguno de los dos lados derivó todavía (hoy: Cliente, Ingreso) es deuda conocida y visible,
  no una asimetría -- se reporta aparte, nunca como par ni como falta.
- mobile y web en estados DISTINTOS, o el archivo falta de un lado -> ROJO, nombrando el archivo.
  Esto es lo que agarra "el fix entró por un solo lado" el día que alguien lo escriba a mano.

Uso:
    idemkey_paridad.py --check                     # gate: exit 1 si hay drift sin excepción o trinquete roto
    idemkey_paridad.py --inventario                 # inventario completo (JSON, a stdout)

Fail-closed (control negativo del propio DoD): si el archivo de excepciones no existe, está vacío
de forma o no parsea como JSON con la forma esperada, --check falla igual que si hubiera drift real.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

MOBILE_MODULES = "apps/mobile/src/modules"
WEB_MODULES = "apps/copiloto-web/src/modules"

FORMULARIO_GLOB = "Formulario*.tsx"
_ARNES_DE_TEST_RE = re.compile(r"\.(test|spec)\.tsx$")

IDEMKEY_RE = re.compile(r"\bidemKey\b")
MENSAJEID_RE = re.compile(r"\bmensajeId\b")

EXCEPCIONES_DEFAULT = "scripts/ci/idemkey-paridad-excepciones.json"

# Ventana de líneas alrededor de cada uso de `idemKey` en la que se busca `mensajeId`. El patrón
# real (`FormularioGasto.tsx`/`FormularioPresupuesto.tsx`) los tiene en la MISMA línea; el margen
# cubre variantes envueltas (ternario multilínea) sin salirse del bloque que arma la clave.
VENTANA = 3


def _es_arnes_de_test(f: Path) -> bool:
    return bool(_ARNES_DE_TEST_RE.search(f.name)) or "__tests__" in f.parts


_COMENTARIO_RE = re.compile(r"^\s*(//|\*(?!/)|/\*)")


def _sin_comentarios(lineas: list[str]) -> list[str]:
    """Vacía (no borra -- mantiene los índices) las líneas de comentario de bloque/línea.

    Control positivo real (repo, no fixture): FormularioGasto.tsx tiene un docstring de prop
    ("mismo mecanismo que mensajeId ... la idemKey se DERIVA de ...") que menciona las dos
    palabras en la MISMA línea del comentario -- sin este filtro, sacar la derivación real del
    cuerpo del componente seguía dando "deriva" por el docstring, y el control positivo del DoD
    quedó en verde cuando debía estar rojo. No es un parser de JS: sólo tapa el estilo de
    comentario que domina este repo (línea que empieza con //, * o /*), mismo trade-off
    pragmático que testid_paridad.py con los ids dinámicos."""
    return ["" if _COMENTARIO_RE.match(l) else l for l in lineas]


def estado_de_texto(texto: str) -> str:
    lineas = _sin_comentarios(texto.splitlines())
    usos = [i for i, l in enumerate(lineas) if IDEMKEY_RE.search(l)]
    if not usos:
        return "ausente"
    for i in usos:
        desde = max(0, i - VENTANA)
        hasta = min(len(lineas), i + VENTANA + 1)
        if any(MENSAJEID_RE.search(l) for l in lineas[desde:hasta]):
            return "deriva"
    return "sin_derivar"


def _escanear_plataforma(root: Path, modules_rel: str) -> dict[str, tuple[str, str]]:
    """basename -> (path relativo al repo, estado)."""
    out: dict[str, tuple[str, str]] = {}
    base = root / modules_rel
    if not base.exists():
        return out
    for f in sorted(base.glob(f"*/{FORMULARIO_GLOB}")):
        if _es_arnes_de_test(f):
            continue
        texto = f.read_text(encoding="utf-8", errors="ignore")
        rel = str(f.relative_to(root)).replace("\\", "/")
        out[f.name] = (rel, estado_de_texto(texto))
    return out


def escanear(root: Path):
    mobile = _escanear_plataforma(root, MOBILE_MODULES)
    web = _escanear_plataforma(root, WEB_MODULES)
    return mobile, web


def comparar(mobile: dict[str, tuple[str, str]], web: dict[str, tuple[str, str]]):
    """Devuelve (drift, sin_asimetria). Sólo entran al universo los basenames con `idemKey` en
    AL MENOS un lado -- un Formulario ajeno al patrón (ausente en los dos) no es candidato."""
    universo = set()
    for nombre, (_, estado) in mobile.items():
        if estado != "ausente":
            universo.add(nombre)
    for nombre, (_, estado) in web.items():
        if estado != "ausente":
            universo.add(nombre)

    drift: dict[str, dict] = {}
    sin_asimetria: dict[str, dict] = {}
    for nombre in sorted(universo):
        m = mobile.get(nombre)
        w = web.get(nombre)
        if m is None:
            drift[nombre] = {"falta_en": "mobile", "en": w[0], "estado": w[1]}
            continue
        if w is None:
            drift[nombre] = {"falta_en": "web", "en": m[0], "estado": m[1]}
            continue
        (m_path, m_estado), (w_path, w_estado) = m, w
        if m_estado != w_estado:
            drift[nombre] = {
                "falta_en": None,
                "mobile": {"path": m_path, "estado": m_estado},
                "web": {"path": w_path, "estado": w_estado},
            }
        elif m_estado == "sin_derivar":
            sin_asimetria[nombre] = {"mobile": m_path, "web": w_path, "estado": m_estado}
    return drift, sin_asimetria


def cargar_excepciones(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or "excepciones" not in data or not isinstance(data["excepciones"], dict):
        return None
    return data["excepciones"]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=".")
    ap.add_argument("--excepciones", default=EXCEPCIONES_DEFAULT)
    ap.add_argument("--check", action="store_true", help="gate para lint.sh")
    ap.add_argument("--inventario", action="store_true", help="imprime el inventario completo (JSON)")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    mobile, web = escanear(root)
    drift, sin_asimetria = comparar(mobile, web)

    if args.inventario:
        print(json.dumps({
            "mobile": {k: {"path": v[0], "estado": v[1]} for k, v in mobile.items()},
            "web": {k: {"path": v[0], "estado": v[1]} for k, v in web.items()},
            "drift": drift,
            "sin_asimetria_pero_sin_derivar": sin_asimetria,
        }, ensure_ascii=False, indent=2))
        return 0

    if args.check:
        excepciones = cargar_excepciones(root / args.excepciones)
        if excepciones is None:
            print(f"[FAIL-CLOSED] {args.excepciones} no existe, esta vacio de forma o no parsea "
                  "como JSON -- un inventario ilegible no da verde.", file=sys.stderr)
            return 1

        errores: list[str] = []

        for nombre, info in drift.items():
            if nombre in excepciones:
                continue
            if info["falta_en"] is not None:
                errores.append(
                    f"[NUEVO] {nombre} -- existe en {'web' if info['falta_en'] == 'mobile' else 'mobile'} "
                    f"({info['en']}, estado={info['estado']}), falta el gemelo en {info['falta_en']}"
                )
            else:
                errores.append(
                    f"[NUEVO] {nombre} -- mobile={info['mobile']['estado']} ({info['mobile']['path']}) "
                    f"!= web={info['web']['estado']} ({info['web']['path']})"
                )

        for nombre in excepciones:
            if nombre not in drift:
                errores.append(f"[STALE] {nombre} -- ya no es drift real (paridad restaurada o el archivo "
                                "desapareció), sacala del baseline")

        if errores:
            print(f"[FAIL] paridad idemKey mobile<->web -- {len(errores)} problema(s):", file=sys.stderr)
            for e in errores:
                print(f"  - {e}", file=sys.stderr)
            return 1

        print(f"[OK] paridad idemKey mobile<->web -- {len(mobile) + len(web)} formularios candidatos, "
              f"{len(excepciones)} excepciones vigentes, 0 sin cubrir, 0 excepciones obsoletas. "
              f"{len(sin_asimetria)} formulario(s) sin derivar en NINGUN lado (deuda conocida, no falta "
              f"de paridad): {', '.join(sorted(sin_asimetria)) or '-'}.")
        return 0

    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
