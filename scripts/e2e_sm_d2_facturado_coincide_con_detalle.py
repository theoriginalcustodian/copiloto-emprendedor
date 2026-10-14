#!/usr/bin/env python3
"""E2E de SM-D2 (#1018) -- el «Facturado este mes» de mobile coincide con el detalle del MISMO mes.

Lectura pura contra prod, con el usuario canónico (`e2e-device@copiloto.test`). No escribe nada.

Las tres cifras que mobile pinta de «lo facturado», pedidas al mismo tiempo:
  (a) `GET /inteligencia/portada`                 -> mes.facturado   (bloque «Facturado este mes», ResumenFacturado)
  (b) `GET /inteligencia/graficos/facturacion`    -> serie[mes actual].total   (la barra del gráfico 1)
  (c) `GET /inteligencia/graficos/facturacion?detalle=<mes>` -> suma de filas[].total   (el detalle de esa barra)

🔴 Control de ceguera: con 0 filas las tres dan "0.00" y la igualdad es trivial. Códigos de salida:
0 = coinciden CON filas en el mes en curso · 1 = no coinciden · 2 = ningún mes con filas (NO DISCRIMINA) ·
3 = el mes en curso no tiene filas (la portada no queda acreditada; sólo barra == detalle en meses
cerrados). Un verde que no pudo ver nada no es verde.

Uso:  python -I -X utf8 scripts/e2e_sm_d2_facturado_coincide_con_detalle.py
      (`E2E_ENV_FILE` apunta al .env.e2e si el script corre desde un worktree sin él)
"""
from __future__ import annotations

import os
import sys
from decimal import Decimal
from pathlib import Path

import requests

BASE = "https://copilotoemprendedor.duckdns.org"
RAIZ = Path(__file__).resolve().parent.parent
ENV_E2E = Path(os.environ.get("E2E_ENV_FILE", RAIZ / ".env.e2e"))


def _env() -> dict[str, str]:
    out: dict[str, str] = {}
    for linea in ENV_E2E.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if linea and not linea.startswith("#") and "=" in linea:
            k, _, v = linea.partition("=")
            out[k.strip()] = v.strip()
    return out


def main() -> int:
    env = _env()
    r = requests.post(f"{BASE}/auth/login", timeout=15,
                      json={"email": env["E2E_DEVICE_EMAIL"], "password": env["E2E_DEVICE_PASSWORD"]})
    r.raise_for_status()
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}

    portada = requests.get(f"{BASE}/inteligencia/portada", headers=h, timeout=20)
    portada.raise_for_status()
    p = portada.json()
    fecha_corte = p["caja"]["fecha_corte"]            # YYYY-MM-DD: el «hoy» del negocio, no el de la PC
    mes = fecha_corte[:7]
    a = Decimal(p["mes"]["facturado"])

    serie = requests.get(f"{BASE}/inteligencia/graficos/facturacion", headers=h, timeout=20)
    serie.raise_for_status()
    barra = next((x for x in serie.json()["serie"] if x["mes"] == mes), None)
    if barra is None:
        print(f"FALLA: el gráfico 1 no trae la barra de {mes}: {[x['mes'] for x in serie.json()['serie']]}")
        return 1
    b = Decimal(barra["total"])

    det = requests.get(f"{BASE}/inteligencia/graficos/facturacion", headers=h, timeout=20,
                       params={"detalle": mes})
    det.raise_for_status()
    filas = det.json()["filas"]
    c = sum((Decimal(f["total"]) for f in filas), Decimal("0"))

    print(f"mes={mes}  (fecha_corte del negocio={fecha_corte})")
    print(f"(a) portada.mes.facturado          = {a}")
    print(f"(b) gráfico 1, barra {mes}          = {b}  (cantidad={barra['cantidad']})")
    print(f"(c) detalle {mes}: suma de {len(filas):>3} filas = {c}")
    for f in filas:
        print(f"      {f['fecha']}  {f['numero']}  {f['total']:>14}  {f['cliente']}")

    fallas: list[str] = []
    if not (a == b == c):
        fallas.append(f"{mes}: portada={a} barra={b} detalle={c}")

    # La portada sólo responde por el mes en curso. Para los meses cerrados, barra == detalle es lo
    # que se puede verificar en vivo: es el mismo predicado (`facturado_filtro_sql`) en dos queries.
    con_datos = 0
    for punto in serie.json()["serie"]:
        if punto["mes"] == mes or punto["cantidad"] == 0:
            continue
        d = requests.get(f"{BASE}/inteligencia/graficos/facturacion", headers=h, timeout=20,
                         params={"detalle": punto["mes"]})
        d.raise_for_status()
        filas_m = d.json()["filas"]
        suma = sum((Decimal(f["total"]) for f in filas_m), Decimal("0"))
        con_datos += 1
        marca = "ok " if suma == Decimal(punto["total"]) and len(filas_m) == punto["cantidad"] else "XX "
        print(f"{marca}{punto['mes']}: barra={punto['total']} (cant {punto['cantidad']})  detalle={suma} ({len(filas_m)} filas)")
        if marca == "XX ":
            fallas.append(f"{punto['mes']}: barra={punto['total']}/{punto['cantidad']} detalle={suma}/{len(filas_m)}")

    if fallas:
        for falla in fallas:
            print("FALLA:", falla)
        return 1
    if not filas and con_datos == 0:
        print("NO DISCRIMINA: ningún mes con filas -- las cifras son 0.00 y la igualdad es trivial")
        return 2
    if not filas:
        print(f"PARCIAL: el mes en curso ({mes}) tiene 0 filas -- (a)=(b)=(c)=0.00 es trivial y NO acredita "
              f"la portada; barra==detalle sí se verificó en {con_datos} mes(es) cerrado(s)")
        return 3
    print(f"OK: {len(filas)} filas en {mes}; portada, barra y detalle coinciden = {a}; "
          f"{con_datos} mes(es) cerrado(s) también")
    return 0


if __name__ == "__main__":
    sys.exit(main())
