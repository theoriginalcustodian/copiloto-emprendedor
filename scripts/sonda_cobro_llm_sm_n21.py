#!/usr/bin/env python3
"""SM-N21 / SM-N20 — sonda con LLM REAL de `marcar_factura_cobrada` (la que la ficha dejaba sin hacer).

Por qué no existía: la sonda CONSUME su sujeto (un cobro deja la factura cobrada). Se resuelve con:
  · un tenant de PRUEBA, nunca el canónico ni el del operador: el tenant vacío de SM-N15
    (`e2e-vacio@copiloto.test`, autorizado como tenencia de prueba). Se EXIGE que esté vacío antes de tocar nada.
  · sujetos DESCARTABLES marcados (`MARCA`): facturas sintéticas que la sonda inserta y borra por esa marca.
  · reversión en `finally` (no al final del happy-path) + respaldo en disco ANTES de mutar, y verificación de
    que el tenant volvió a 0 comprobantes. Borrar por marca y no por id cubre también el crash entre el INSERT
    y el respaldo.

Qué mide:
  A) POSITIVO: pide por /chat «me pagaron la factura de X» (N facturas distintas, importes con formatos
     difíciles). El esperado es que el reply sea el literal del código, BYTE A BYTE: 0 de N distinto.
     (No «parecido»: `$70,000` vs `$70.000` es justo el defecto que la opción C vino a cerrar.)
  B) NEGATIVO (lo que la ficha pide y no se salta): una pregunta que NO mueve plata («cuánto me deben»)
     sigue redactada por el LLM → su reply NO es un literal del código. Sin esta mitad el verde de A pasa
     igual si el literal se aplicó a todo.

Uso:  UC_ENV_E2E=<ruta .env.e2e> python scripts/sonda_cobro_llm_sm_n21.py     (corre desde la PC; la BD, por ssh)
La password nunca se imprime. Exit 1 al primer control que falle.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import uuid
from decimal import Decimal
from pathlib import Path

import requests

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

BASE = os.environ.get("UC_BASE", "https://copilotoemprendedor.duckdns.org")
RAIZ = Path(__file__).resolve().parent.parent
ENV_E2E = Path(os.environ.get("UC_ENV_E2E", RAIZ / ".env.e2e"))
SSH = os.environ.get("UC_SSH_HOST", "unreal-copilot")
RESPALDO = Path(os.environ.get("UC_SONDA_RESPALDO", RAIZ / ".sonda-cobro-respaldo.json"))
MARCA = f"SONDA-N21-{uuid.uuid4().hex[:6]}"   # única POR CORRIDA: dos corridas no se borran el sujeto entre sí
ESPERA_REPLY_S = 150
# (receptor, total, nro): formatos difíciles a propósito (miles, centavos, millones con centavos)
SUJETOS = [(f"{MARCA} Panadería", "70000.00", 990001),
           (f"{MARCA} Ferretería", "25000.50", 990002),
           (f"{MARCA} Estudio", "1234567.89", 990003)]


def log(m: str) -> None:
    print(f"[sonda-n21] {m}")


def fallo(m: str) -> None:
    print(f"[sonda-n21] ❌ {m}")
    sys.exit(1)


def plata_corta(monto: str) -> str:
    """Espejo de `datos_card.plata_corta` (es-AR): `$70.000`, `$25.000,50`. Si difiere del real, el control
    positivo sale rojo y es el hallazgo, no un falso verde."""
    d = Decimal(monto)
    entero, dec = f"{d:.2f}".split(".")
    miles = f"{int(entero):,}".replace(",", ".")
    return f"${miles}" if dec == "00" else f"${miles},{dec}"


def leer_env() -> dict[str, str]:
    out: dict[str, str] = {}
    for linea in ENV_E2E.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if linea and not linea.startswith("#") and "=" in linea:
            k, _, v = linea.partition("=")
            out[k.strip()] = v.strip()
    return out


def vps_sql(sql: str, params: tuple, cliente_id: str, *, fetch: bool = True):
    """Una consulta con la GUC del tenant (RLS FORCE) por ssh. Los parámetros viajan como JSON por stdin."""
    datos = json.dumps({"cid": cliente_id, "sql": sql, "params": list(params), "fetch": fetch})
    codigo = chr(10).join([
        "import json,psycopg2",
        "e=dict(l.split('=',1) for l in open('/etc/unreal-copilot/fusion-pg.env') if '=' in l and not l.startswith('#'))",
        "c=psycopg2.connect(e['DATABASE_URL'].strip());c.autocommit=True",
        f"p=json.loads({datos!r});cur=c.cursor()",
        "cur.execute(\"select set_config('request.jwt.claims', %s, false)\",(json.dumps({'cliente_id':p['cid']}),))",
        "cur.execute('set search_path to uc_factory')",
        "cur.execute(p['sql'],p['params'])",
        "print(json.dumps(cur.fetchall() if p['fetch'] else cur.rowcount, default=str))",
    ])
    # El script viaja por STDIN (sin pasar por el quoting de la shell remota); los parámetros, embebidos como JSON.
    r = subprocess.run(["ssh", SSH, "/opt/uc-copiloto-venv/bin/python", "-"], input=codigo,
                       capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        fallo(f"consulta en el VPS falló: {r.stderr.strip()[:200]}")
    return json.loads(r.stdout.strip().splitlines()[-1])


def login(email: str, password: str) -> str:
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=20)
    r.raise_for_status()
    return r.json()["access_token"]


def api(token: str, metodo: str, ruta: str, **kw) -> requests.Response:
    return requests.request(metodo, f"{BASE}{ruta}", headers={"Authorization": f"Bearer {token}"}, timeout=30, **kw)


def conversar(token: str, texto: str) -> list[str]:
    """POST /chat fire-and-forget + polling de /reply (contrato del backend). Devuelve los textos de los replies."""
    sid = f"sonda-n21-{uuid.uuid4()}"
    r = api(token, "POST", "/chat", json={"session_id": sid, "text": texto})
    if r.status_code != 200:
        fallo(f"/chat devolvió {r.status_code}: {r.text[:160]}")
    t0, vistos, after = time.time(), [], 0
    while time.time() - t0 < ESPERA_REPLY_S:
        j = api(token, "GET", "/reply", params={"session_id": sid, "after_id": after}).json()
        for row in j["replies"]:
            vistos.append(str(row.get("reply_text") or ""))
        after = j["next_id"]
        if vistos and time.time() - t0 > 8:     # margen para un 2º reply del mismo turno
            break
        time.sleep(3)
    return vistos


def main() -> int:
    env = leer_env()
    if not env.get("E2E_VACIO_PASSWORD"):
        fallo("falta E2E_VACIO_PASSWORD en .env.e2e (correr antes scripts/provision_usuario_vacio_sm_n15.py)")
    tok = login(env.get("E2E_VACIO_EMAIL", "e2e-vacio@copiloto.test"), env["E2E_VACIO_PASSWORD"])
    cid = api(tok, "GET", "/me").json()["cliente_id"]
    if cid == "4f3ecb78-2e36-4044-a56e-0e7ef6c4a655":
        fallo("el tenant resolvió al CANÓNICO: la sonda no muta el canónico, nunca")

    # PRECONDICIÓN: tenant vacío (si alguien ya lo usa para medir, NO se toca)
    previos = vps_sql("select count(*) from afip_comprobantes where cliente_id=%s", (cid,), cid)[0][0]
    if previos != 0:
        fallo(f"el tenant de prueba tiene {previos} comprobantes: no está vacío, no se muta")
    log(f"tenant de prueba {cid[:8]}… vacío ✔ (precondición)")

    RESPALDO.write_text(json.dumps({"cliente_id": cid, "marca": MARCA, "nota": "si la sonda murió, borrar por marca"}),
                        encoding="utf-8")
    resultados: list[dict] = []
    try:
        for receptor, total, nro in SUJETOS:
            vps_sql("insert into afip_comprobantes (cliente_id,cuit,tipo_cbte,punto_venta,nro,cae,cae_vto,"
                    "fecha_emision,doc_tipo,doc_nro,receptor_nombre,total,estado) "
                    "values (%s,'20000000001',11,9,%s,'70000000000001',current_date+10,current_date,99,'0',%s,%s,'emitida')",
                    (cid, nro, receptor, total), cid, fetch=False)
        impagos = api(tok, "GET", "/afip/comprobantes/impagos").json()["comprobantes"]
        if len(impagos) != len(SUJETOS):
            fallo(f"CONTROL POSITIVO: el endpoint real ve {len(impagos)} impagas, esperaba {len(SUJETOS)} — "
                  f"el sujeto no existe para el tool, la sonda mediría el vacío")
        log(f"sujetos descartables insertados: {len(impagos)} impagas visibles por el endpoint real ✔")

        for receptor, total, nro in SUJETOS:
            rs = conversar(tok, f"me pagaron la factura de {receptor}")
            esperado = f"Registré {plata_corta(total)} de la factura {nro} ({receptor})."
            resultados.append({"receptor": receptor, "esperado": esperado, "replies": rs,
                               "exacto": any(esperado == x.strip() for x in rs)})

        # B) NEGATIVO: tras los cobros no queda deuda → se inserta UNA impaga más para la pregunta de listado
        vps_sql("insert into afip_comprobantes (cliente_id,cuit,tipo_cbte,punto_venta,nro,cae,cae_vto,fecha_emision,"
                "doc_tipo,doc_nro,receptor_nombre,total,estado) values (%s,'20000000001',11,9,990004,"
                "'70000000000001',current_date+10,current_date,99,'0',%s,'45000.00','emitida')",
                (cid, f"{MARCA} Libreria"), cid, fetch=False)
        neg = conversar(tok, "¿cuánto me deben en total?")
    finally:
        borrados_c = vps_sql("delete from copiloto_cobros where cliente_id=%s and comprobante_id in "
                             "(select id from afip_comprobantes where cliente_id=%s and receptor_nombre like %s)",
                             (cid, cid, f"{MARCA}%"), cid, fetch=False)
        borrados_f = vps_sql("delete from afip_comprobantes where cliente_id=%s and receptor_nombre like %s",
                             (cid, f"{MARCA}%"), cid, fetch=False)
        quedan = vps_sql("select count(*) from afip_comprobantes where cliente_id=%s", (cid,), cid)[0][0]
        log(f"reversión: {borrados_f} facturas y {borrados_c} cobros borrados; comprobantes que quedan = {quedan}")
        if quedan != 0:
            print(f"[sonda-n21] ❌ REVERSIÓN INCOMPLETA: quedan {quedan} comprobantes en el tenant de prueba")
        else:
            RESPALDO.unlink(missing_ok=True)

    malos = [r for r in resultados if not r["exacto"]]
    for r in resultados:
        log(f"{'✔' if r['exacto'] else '✖'} {r['receptor']}: esperado «{r['esperado']}» · replies={r['replies']}")
    log(f"A) cobro con LLM real: distinto del literal {len(malos)}/{len(resultados)} (esperado 0)")
    log(f"B) negativo «cuánto me deben» → {neg}")
    literal_en_neg = any(x.strip().startswith("Registré") for x in neg)
    if not neg:
        fallo("B) el control negativo no obtuvo reply: no se puede afirmar nada")
    if literal_en_neg:
        fallo("B) la pregunta que NO mueve plata devolvió un literal de cobro: el mecanismo está donde no debe")
    if malos:
        fallo(f"A) {len(malos)} cobros NO salieron como el literal del código")
    log("✅ cobro: 0 distinto del literal; negativo redactado libre; tenant de prueba devuelto a 0")
    return 0


if __name__ == "__main__":
    sys.exit(main())
