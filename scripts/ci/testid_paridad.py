#!/usr/bin/env python3
"""BL-Q1: paridad de testID (mobile) <-> data-testid (web), por PANTALLA.

Barre ambos árboles con regex y agrupa cada id por "pantalla" (mapeo ruta -> módulo, reusa la
convención ya existente `modules/<feature>[/<submodulo>]` que web y mobile ya comparten 1:1; fuera
de `modules/` cae al primer segmento bajo `src/`, y las rutas de `app/` de mobile quedan en su
propio namespace `app/...` porque web no tiene equivalente). El ESCANEO es siempre del script
(nunca a mano: "una allowlist manual no puede saber lo que le falta"); lo único manual es declarar,
por pantalla+id, que una ausencia unilateral está aceptada -- con motivo y fecha, en
`testid-paridad-excepciones.json`.

Cuatro propiedades del gate (pedidas por planificación tras la v1):
 1. TRINQUETE -- sólo baja. Una excepción cuyo id ya no existe en ningún lado, o que ya tiene su
    par en su misma pantalla, es ROJA ("sacala del baseline"): el archivo no puede crecer en silencio.
 2. Un id NUEVO unilateral (no está en las excepciones) es ROJO aunque haya 493 perdonados --
    las excepciones perdonan ids puntuales, no aplacan el gate entero.
 3. Ids dinámicos (`testID={...}`, `data-testid={...}`) no los ve un regex de literales: se cuentan
    y se reportan como "no medidos" (nunca como par ni como falta -- fail-open sería mentir con un
    verde que no midió nada).
 4. La comparación es POR PANTALLA, no un set global: dos ids iguales en pantallas distintas no se
    dan por buenos entre sí.

Uso:
    testid_paridad.py --check                     # gate: exit 1 si hay drift sin excepción o trinquete roto
    testid_paridad.py --inventario                 # inventario completo por pantalla (JSON, a archivo)

Fail-closed (control negativo del propio DoD): si el archivo de excepciones no existe, está vacío
o no parsea como JSON con la forma esperada, --check falla igual que si hubiera drift real.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# (root relativo, prefijo de namespace) -- mobile tiene dos raíces; web una sola.
MOBILE_SUBROOTS = [("apps/mobile/app", "app"), ("apps/mobile/src", "src")]
WEB_SUBROOTS = [("apps/copiloto-web/src", "src")]

LITERAL_MOBILE_RE = re.compile(r'testID="([^"]+)"')
LITERAL_WEB_RE = re.compile(r'data-testid="([^"]+)"')
DINAMICO_MOBILE_RE = re.compile(r'testID=\{')
DINAMICO_WEB_RE = re.compile(r'data-testid=\{')

EXCEPCIONES_DEFAULT = "scripts/ci/testid-paridad-excepciones.json"


def pantalla_de(rel_bajo_subroot: str, prefijo: str) -> str:
    partes = rel_bajo_subroot.replace("\\", "/").split("/")
    if prefijo == "app":
        return f"app/{partes[0]}" if len(partes) > 1 else "app/raiz"
    # prefijo == "src"
    if "modules" in partes:
        i = partes.index("modules")
        resto = partes[i + 1:-1][:2]  # hasta 2 niveles de submódulo (ajustes/afip vs ajustes/negocio)
        return "modules/" + "/".join(resto) if resto else "modules/raiz"
    return f"src/{partes[0]}" if len(partes) > 1 else "src/raiz"


_ARNES_DE_TEST_RE = re.compile(r'\.(test|spec)\.tsx$')


def _es_arnes_de_test(f: Path) -> bool:
    """Un id que sólo vive en el arnés de test (`*.test.tsx`, `*.spec.tsx`, `__tests__/`) no es UI --
    es un id fabricado por el test para ubicar un nodo (ver hallazgo #616: `sonda-cierre`, `entrada-
    stub`). Contarlo como paridad real produce falsos rojos que nadie puede resolver del lado de UI."""
    return bool(_ARNES_DE_TEST_RE.search(f.name)) or "__tests__" in f.parts


def _escanear_plataforma(root: Path, subroots: list[tuple[str, str]], literal_re: re.Pattern, dinamico_re: re.Pattern):
    """Devuelve (por_pantalla: {pantalla: {id: [archivo,...]}}, dinamicos: {archivo: n})."""
    por_pantalla: dict[str, dict[str, list[str]]] = {}
    dinamicos: dict[str, int] = {}
    for sub, prefijo in subroots:
        base = root / sub
        if not base.exists():
            continue
        for f in sorted(base.rglob("*.tsx")):
            if _es_arnes_de_test(f):
                continue
            rel_full = str(f.relative_to(root)).replace("\\", "/")
            rel_bajo = str(f.relative_to(base)).replace("\\", "/")
            texto = f.read_text(encoding="utf-8", errors="ignore")
            pant = pantalla_de(rel_bajo, prefijo)
            for m in literal_re.finditer(texto):
                por_pantalla.setdefault(pant, {}).setdefault(m.group(1), []).append(rel_full)
            n = len(dinamico_re.findall(texto))
            if n:
                dinamicos[rel_full] = n
    return por_pantalla, dinamicos


def escanear(root: Path):
    mobile, dyn_mobile = _escanear_plataforma(root, MOBILE_SUBROOTS, LITERAL_MOBILE_RE, DINAMICO_MOBILE_RE)
    web, dyn_web = _escanear_plataforma(root, WEB_SUBROOTS, LITERAL_WEB_RE, DINAMICO_WEB_RE)
    return mobile, web, dyn_mobile, dyn_web


def drift_por_pantalla(mobile: dict, web: dict) -> dict[str, dict[str, list[str]]]:
    """Para cada pantalla presente en mobile y/o web: ids unilaterales (clave 'pantalla::id')."""
    drift: dict[str, dict[str, list[str]]] = {}
    pantallas = set(mobile) | set(web)
    for pant in sorted(pantallas):
        m_ids = set(mobile.get(pant, {}))
        w_ids = set(web.get(pant, {}))
        for i in sorted(w_ids - m_ids):
            drift[f"{pant}::{i}"] = {"pantalla": pant, "id": i, "falta_en": "mobile", "en": web[pant][i]}
        for i in sorted(m_ids - w_ids):
            drift[f"{pant}::{i}"] = {"pantalla": pant, "id": i, "falta_en": "web", "en": mobile[pant][i]}
    return drift


def cargar_excepciones(path: Path) -> dict | None:
    """None = inválido/ausente (fail-closed). dict (incluso {}) = válido."""
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or "excepciones" not in data or not isinstance(data["excepciones"], dict):
        return None
    return data["excepciones"]


def existe_en_algun_lado(clave_o_id: str, mobile: dict, web: dict) -> bool:
    pant, _, id_ = clave_o_id.partition("::")
    return id_ in mobile.get(pant, {}) or id_ in web.get(pant, {})


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=".")
    ap.add_argument("--excepciones", default=EXCEPCIONES_DEFAULT)
    ap.add_argument("--check", action="store_true", help="gate para lint.sh")
    ap.add_argument("--inventario", action="store_true", help="imprime el inventario completo por pantalla (JSON)")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    mobile, web, dyn_mobile, dyn_web = escanear(root)
    drift = drift_por_pantalla(mobile, web)

    if args.inventario:
        comunes = 0
        for pant in set(mobile) | set(web):
            comunes += len(set(mobile.get(pant, {})) & set(web.get(pant, {})))
        print(json.dumps({
            "comunes_por_pantalla": comunes,
            "drift": drift,
            "no_medidos": {"mobile": dyn_mobile, "web": dyn_web,
                            "total_mobile": sum(dyn_mobile.values()), "total_web": sum(dyn_web.values())},
        }, ensure_ascii=False, indent=2))
        return 0

    if args.check:
        excepciones = cargar_excepciones(root / args.excepciones)
        if excepciones is None:
            print(f"[FAIL-CLOSED] {args.excepciones} no existe, esta vacio de forma o no parsea "
                  "como JSON -- un inventario ilegible no da verde.", file=sys.stderr)
            return 1

        errores: list[str] = []

        # (2) drift real sin excepción -- incluye ids NUEVOS aunque haya cientos perdonados.
        for clave, info in drift.items():
            if clave not in excepciones:
                errores.append(f"[NUEVO] {clave} -- esta en {'web' if info['falta_en']=='mobile' else 'mobile'}, "
                                f"falta en {info['falta_en']} -- {info['en']}")

        # (1) trinquete: cada excepción declarada tiene que seguir siendo drift real, en la misma pantalla.
        for clave in excepciones:
            if "::" not in clave:
                errores.append(f"[FORMA] excepcion '{clave}' no tiene forma 'pantalla::id' -- sacala o corregila")
                continue
            if not existe_en_algun_lado(clave, mobile, web):
                errores.append(f"[STALE] {clave} -- el id ya no existe en ningun lado, sacala del baseline")
            elif clave not in drift:
                errores.append(f"[STALE] {clave} -- ya tiene su par en la misma pantalla, sacala del baseline")

        if errores:
            print(f"[FAIL] paridad testID/data-testid -- {len(errores)} problema(s):", file=sys.stderr)
            for e in errores:
                print(f"  - {e}", file=sys.stderr)
            return 1

        total_no_medidos = sum(dyn_mobile.values()) + sum(dyn_web.values())
        print(f"[OK] paridad por pantalla -- {len(excepciones)} excepciones vigentes, 0 sin cubrir, "
              f"0 excepciones obsoletas. {total_no_medidos} usos de id dinamico NO medidos "
              f"({sum(dyn_mobile.values())} mobile / {sum(dyn_web.values())} web) -- no cuentan como par ni como falta.")
        return 0

    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
