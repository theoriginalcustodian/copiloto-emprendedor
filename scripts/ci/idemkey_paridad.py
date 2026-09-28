#!/usr/bin/env python3
"""Ratchets de drift silencioso entre plataformas/lenguajes -- IDEM-gasto/PARID y BL-O6/LEGAL.

Dos chequeos independientes, un solo runner (el escaneo dinámico + filtro de comentarios se
reutiliza para ambos; el pedido de LEGAL fue explícito: "extendé ese patrón, no inventes otro
runner"):

  1. PARID -- paridad mobile<->web del patrón "idemKey deriva de mensajeId" (ver abajo).
  2. LEGAL -- paridad de la versión legal entre `packages/core/src/legal.ts` (TS, lo que el front
     manda), `apps/copiloto/tenant_legal_store.py` (Python, lo que el backend exige) y
     `scripts/e2e_bl_o6_legal_aceptacion.py` (E2E, la hardcodea para pegarle a prod). Los tres
     literales viajan por CONVENCIÓN -- no hay import cruzado posible entre TS y Python -- así que
     nada los compara salvo este script. Si el operador bumpea uno y no los otros dos, el backend
     rechaza TODA aceptación con 409 `legal_version_desactualizada` y ningún tester completa el
     alta; el síntoma no aparece al editar el texto, aparece en el primer alta.

## PARID -- paridad mobile<->web del patrón "idemKey deriva de mensajeId".

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

## LEGAL -- paridad de la versión legal (TS <-> Python <-> E2E).

Extrae el literal de cada archivo con una regex anclada al NOMBRE de la constante (no a la fecha:
un ratchet que busque "2026-09-22" se desactualiza con lo que vigila), filtrando comentarios antes
de buscar -- mismo riesgo ya pagado en PARID: los tres archivos se citan por nombre entre sí en
comentarios (`tenant_legal_store.py` menciona "apps/copiloto-web"/"apps/mobile", el E2E comenta
"apps/copiloto/tenant_legal_store.py" en la misma línea del literal), así que sin el filtro un
literal viejo dejado en un comentario podría matchear antes que el real.

Sobre el E2E: se decidió sumarlo como TERCER literal a la misma comparación de igualdad, en vez de
hacer que importe `tenant_legal_store.py` como fuente de verdad. Es un script HTTP standalone
pensado para correr aislado contra prod (ver su propio docstring) -- acoplarlo a un import interno
del backend le cambia la naturaleza para resolver el mismo riesgo que comparar el literal ya
resuelve sin tocarlo. No hay ratchet de excepciones para LEGAL (a diferencia de PARID): una
divergencia entre estos tres literales nunca es "por diseño", siempre es un bump que se hizo a
medias -- por eso es un chequeo de igualdad estricta, no un archivo de excepciones con trinquete.

Uso:
    idemkey_paridad.py --check                     # gate: exit 1 si hay drift (PARID) o desalineación (LEGAL)
    idemkey_paridad.py --inventario                 # inventario completo (JSON, a stdout)

Fail-closed (control negativo del propio DoD): si el archivo de excepciones de PARID no existe,
está vacío de forma o no parsea como JSON con la forma esperada, --check falla igual que si hubiera
drift real. Ídem LEGAL si falta cualquiera de los 3 archivos o ninguno define el literal esperado
(constante renombrada/movida) -- un chequeo que no pudo leer no es un chequeo verde, es un salto.
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


_COMENTARIO_RE = re.compile(r"^\s*(//|\*(?!/)|/\*|#)")


def _sin_comentarios(lineas: list[str]) -> list[str]:
    """Vacía (no borra -- mantiene los índices) las líneas de comentario de bloque/línea.

    Control positivo real (repo, no fixture): FormularioGasto.tsx tiene un docstring de prop
    ("mismo mecanismo que mensajeId ... la idemKey se DERIVA de ...") que menciona las dos
    palabras en la MISMA línea del comentario -- sin este filtro, sacar la derivación real del
    cuerpo del componente seguía dando "deriva" por el docstring, y el control positivo del DoD
    quedó en verde cuando debía estar rojo. No es un parser de JS/Python: sólo tapa los estilos de
    comentario de línea de este repo (//, * y /* del lado TS; # del lado Python, para el chequeo
    LEGAL), mismo trade-off pragmático que testid_paridad.py con los ids dinámicos. No cubre
    comentarios trailing en la misma línea del código (`valor = "x"  # nota`) porque ahí el literal
    real precede al comentario -- la regex de extracción matchea igual y el riesgo que esto
    filtra es el opuesto: un comentario que MENCIONA el literal sin ser la asignación real."""
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


LEGAL_TS = "packages/core/src/legal.ts"
LEGAL_PY = "apps/copiloto/tenant_legal_store.py"
LEGAL_E2E = "scripts/e2e_bl_o6_legal_aceptacion.py"

# Ancladas al NOMBRE de la constante, no a la fecha que vigilan -- extraer, no hardcodear.
_LEGAL_TS_RE = re.compile(r"\bLEGAL_VERSION\s*=\s*['\"]([^'\"]+)['\"]")
_LEGAL_PY_RE = re.compile(r"\bLEGAL_VERSION_VIGENTE\s*=\s*[\"']([^\"']+)[\"']")
_LEGAL_E2E_RE = _LEGAL_PY_RE  # mismo nombre de constante, mismo estilo de asignación (Python)


def _extraer_literal_legal(root: Path, rel_path: str, patron: re.Pattern) -> tuple[str | None, str | None]:
    """(valor, motivo_si_no_se_pudo_extraer). Filtra comentarios antes de matchear -- ver
    `_sin_comentarios`: los tres archivos legales se citan por nombre entre sí en comentarios."""
    f = root / rel_path
    if not f.exists():
        return None, f"{rel_path} no existe"
    texto = f.read_text(encoding="utf-8", errors="ignore")
    for linea in _sin_comentarios(texto.splitlines()):
        m = patron.search(linea)
        if m:
            return m.group(1), None
    return None, f"{rel_path} no define el literal esperado (¿se renombró o movió la constante?)"


def chequear_version_legal(root: Path):
    """(ok, mensaje, valores). Chequeo de IGUALDAD estricta entre los 3 literales -- no hay
    excepciones/trinquete acá (a diferencia de PARID): una divergencia entre estos tres nunca es
    "por diseño", siempre es un bump que se hizo a medias. Fail-closed: si falta cualquiera de los
    3 archivos o no se pudo extraer su literal, es error, no salto silencioso."""
    ts_val, ts_err = _extraer_literal_legal(root, LEGAL_TS, _LEGAL_TS_RE)
    py_val, py_err = _extraer_literal_legal(root, LEGAL_PY, _LEGAL_PY_RE)
    e2e_val, e2e_err = _extraer_literal_legal(root, LEGAL_E2E, _LEGAL_E2E_RE)

    errores_extraccion = [e for e in (ts_err, py_err, e2e_err) if e]
    valores = {LEGAL_TS: ts_val, LEGAL_PY: py_val, LEGAL_E2E: e2e_val}
    if errores_extraccion:
        return False, "; ".join(errores_extraccion), valores

    if len({ts_val, py_val, e2e_val}) > 1:
        detalle = ", ".join(f"{k}={v!r}" for k, v in valores.items())
        return False, f"version legal DESALINEADA -- {detalle}", valores

    return True, f"version legal alineada en TS/PY/E2E: {ts_val!r}", valores


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
    legal_ok, legal_msg, legal_valores = chequear_version_legal(root)

    if args.inventario:
        print(json.dumps({
            "mobile": {k: {"path": v[0], "estado": v[1]} for k, v in mobile.items()},
            "web": {k: {"path": v[0], "estado": v[1]} for k, v in web.items()},
            "drift": drift,
            "sin_asimetria_pero_sin_derivar": sin_asimetria,
            "legal": {"ok": legal_ok, "mensaje": legal_msg, "valores": legal_valores},
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

        if not legal_ok:
            errores.append(f"[LEGAL] {legal_msg}")

        if errores:
            print(f"[FAIL] paridad idemKey/legal mobile<->web -- {len(errores)} problema(s):", file=sys.stderr)
            for e in errores:
                print(f"  - {e}", file=sys.stderr)
            return 1

        print(f"[OK] paridad idemKey mobile<->web -- {len(mobile) + len(web)} formularios candidatos, "
              f"{len(excepciones)} excepciones vigentes, 0 sin cubrir, 0 excepciones obsoletas. "
              f"{len(sin_asimetria)} formulario(s) sin derivar en NINGUN lado (deuda conocida, no falta "
              f"de paridad): {', '.join(sorted(sin_asimetria)) or '-'}. {legal_msg}.")
        return 0

    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
