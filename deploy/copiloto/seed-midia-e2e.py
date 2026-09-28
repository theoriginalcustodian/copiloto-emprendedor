"""Siembra datos REALES minimos para que `mi_dia_orquestador.avanzar_tablero` genere al menos una
tarjeta de cada una de las 8 reglas de `mi_dia_detector.py`, en el tenant CANONICO de pruebas
`e2e-device@copiloto.test` — nunca otro (regla dura R-9). No inventa una tabla nueva ni toca
"mi_dia_tarjetas" a mano: reusa los stores de produccion (PresupuestoStore, AfipComprobanteStore,
CobroStore, GastoStore, TrabajoStore, MpCredentialStore, AfipCredentialStore) para que el detector
real encuentre los datos reales, y despues llama al orquestador real para que las tarjetas nazcan
por el mismo camino que en produccion. Nunca toca ARCA ni MercadoPago reales: todo lo que se
"emite"/"conecta" es un registro local con `idem_key` fijo, cifrado con la clave real del tenant
donde corresponde (Fernet), pero jamas viaja a un proveedor externo.

Pedido: coordinacion/abierto/2026-09-23_pedido_planificacion-a-backend_reponer-datos-en-mi-dia-del-tenant-e2e.md

DRY-RUN POR DEFECTO. Para aplicar: `--ejecutar`. Idempotente: cada dato nace con un `idem_key`
fijo (`seed-midia-*`) y los stores reales ya deduplican por indice unico — correrlo dos veces no
duplica nada; el presupuesto ademas se re-backdatea al mismo valor cada vez (UPDATE, no INSERT).

    /opt/uc-copiloto-venv/bin/python deploy/copiloto/seed-midia-e2e.py
    /opt/uc-copiloto-venv/bin/python deploy/copiloto/seed-midia-e2e.py --ejecutar
"""
from __future__ import annotations

import datetime
import os
import subprocess
import sys
import time

EMAIL_CANONICO = "e2e-device@copiloto.test"
UNIT = "uc-copiloto-web.service"
CUIT_SEED = "20111111112"
PUNTO_VENTA_SEED = 9

HOY = datetime.date.today()


def _heredar_env_del_proceso(unit: str) -> None:
    pid = subprocess.check_output(["systemctl", "show", unit, "-p", "MainPID", "--value"]).decode().strip()
    if not pid or pid == "0":
        sys.exit(f"{unit} no esta corriendo")
    with open(f"/proc/{pid}/environ", "rb") as fh:
        for entrada in fh.read().split(b"\x00"):
            if b"=" in entrada:
                clave, valor = entrada.decode("utf-8", "replace").split("=", 1)
                os.environ.setdefault(clave, valor)


def _generar_cert_fake(dias_para_vencer: int) -> tuple[str, str]:
    """Certificado autofirmado, valido como PEM, que NUNCA se manda a ARCA — sólo se cifra y
    guarda para que `AfipCredentialStore.vencimientos()` lo lea de verdad (parsea `notAfter` del
    X.509 real, no un campo inventado)."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    nombre = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "seed-midia-e2e")])
    ahora = datetime.datetime.utcnow()
    cert = (
        x509.CertificateBuilder()
        .subject_name(nombre).issuer_name(nombre)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(ahora - datetime.timedelta(days=1))
        .not_valid_after(ahora + datetime.timedelta(days=dias_para_vencer))
        .sign(key, hashes.SHA256())
    )
    cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode()
    key_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    return cert_pem, key_pem


def _siguiente_nro(conn_factory, cid: str, *, tipo_cbte: int) -> int:
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COALESCE(MAX(nro), 0) FROM uc_factory.afip_comprobantes "
            "WHERE cliente_id=%s AND cuit=%s AND tipo_cbte=%s AND punto_venta=%s",
            (cid, CUIT_SEED, tipo_cbte, PUNTO_VENTA_SEED))
        return cur.fetchone()[0] + 1


def _comprobante_seed(store, conn_factory, cid, *, idem_key, fecha_emision, cae_vto, total) -> int:
    """Devuelve siempre el `id` (int) del comprobante, fresco o preexistente."""
    existente = store.por_idem_key(idem_key)
    if existente:
        return existente["id"]
    nro = _siguiente_nro(conn_factory, cid, tipo_cbte=6)
    return store.registrar(
        cuit=CUIT_SEED, tipo_cbte=6, punto_venta=PUNTO_VENTA_SEED, nro=nro,
        cae=f"SEEDCAE{nro:08d}", cae_vto=cae_vto, fecha_emision=fecha_emision,
        doc_tipo=80, doc_nro="20111111112", total=total,
        receptor_nombre="Cliente Seed Mi Dia", idem_key=idem_key)


def sembrar(conn_factory, cid: str) -> None:
    from afip_comprobante_store import AfipComprobanteStore
    from afip_credential_store import AfipCredentialStore
    from clients.agent.providers.crypto import FernetCrypto
    from cobro_store import CobroStore
    from gasto_store import GastoStore
    from mp_credential_store import MpCredentialStore
    from presupuesto_store import PresupuestoStore
    from trabajo_store import TrabajoStore

    crypto = FernetCrypto()
    comprobantes = AfipComprobanteStore(conn_factory, cid)
    presupuestos = PresupuestoStore(conn_factory, cid)
    cobros = CobroStore(conn_factory, cid)
    gastos = GastoStore(conn_factory, cid)
    trabajos = TrabajoStore(conn_factory, cid)
    mp = MpCredentialStore(conn_factory, cid, crypto)
    afip_cred = AfipCredentialStore(conn_factory, cid, crypto)

    # 1. presupuestos_enfriandose: pendiente, sin_respuesta (>30 dias), total > 0
    pres, _ = presupuestos.crear_idem(
        concepto="Seed Mi dia - presupuesto enfriandose",
        receptor={"nombre": "Cliente Seed Mi Dia"},
        items=[{"descripcion": "Servicio seed", "cantidad": 1, "precio_unitario": "50000"}],
        idem_key="seed-midia-presupuesto-enfriandose")
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute("UPDATE uc_factory.copiloto_presupuestos SET fecha = now() - interval '35 days' "
                    "WHERE id = %s", (pres["id"],))
    print(f"1. presupuesto enfriandose: id={pres['id']} (backdateado a 35 dias)")

    # 2. facturas_impagas_viejas: comprobante emitido hace >30 dias, sin ningun cobro
    fecha_vieja = HOY - datetime.timedelta(days=45)
    c_impaga = _comprobante_seed(comprobantes, conn_factory, cid,
                                  idem_key="seed-midia-factura-impaga-vieja",
                                  fecha_emision=fecha_vieja, cae_vto=fecha_vieja + datetime.timedelta(days=365),
                                  total="70000")
    print(f"2. factura impaga vieja: id={c_impaga} fecha_emision={fecha_vieja}")

    # 3. trabajo_margen_negativo: cobrado > 0 y gastado > cobrado
    c_margen = _comprobante_seed(comprobantes, conn_factory, cid,
                                  idem_key="seed-midia-trabajo-margen-negativo",
                                  fecha_emision=HOY, cae_vto=HOY + datetime.timedelta(days=365),
                                  total="100000")
    cobros.registrar(c_margen, monto=30000, idem_key="seed-midia-trabajo-margen-cobro")
    g_margen = gastos.crear_idem(monto=80000, categoria="servicios",
                                  descripcion="Seed gasto margen negativo",
                                  idem_key="seed-midia-gasto-margen-negativo")[0]
    trabajos.imputar(g_margen["id"], "comprobante", c_margen)
    print(f"3. trabajo margen negativo: comprobante={c_margen} cobrado=30000 gastado=80000")

    # 4. trabajo_sin_ingreso: gasto imputado hace >15 dias, sin ningun cobro
    c_sin_ingreso = _comprobante_seed(comprobantes, conn_factory, cid,
                                       idem_key="seed-midia-trabajo-sin-ingreso",
                                       fecha_emision=HOY - datetime.timedelta(days=20),
                                       cae_vto=HOY + datetime.timedelta(days=365), total="50000")
    g_sin_ingreso = gastos.crear_idem(monto=20000, categoria="servicios",
                                       fecha=HOY - datetime.timedelta(days=20),
                                       descripcion="Seed gasto sin ingreso",
                                       idem_key="seed-midia-gasto-sin-ingreso")[0]
    trabajos.imputar(g_sin_ingreso["id"], "comprobante", c_sin_ingreso)
    print(f"4. trabajo sin ingreso: comprobante={c_sin_ingreso} gasto fecha=-20d")

    # 5. gasto_del_mes_alto: mes actual > 1.5x mes anterior
    mes_anterior = (HOY.replace(day=1) - datetime.timedelta(days=1)).replace(day=5)
    gastos.crear_idem(monto=10000, categoria="otros", fecha=mes_anterior,
                       descripcion="Seed gasto mes anterior",
                       idem_key="seed-midia-gasto-mes-anterior")
    gastos.crear_idem(monto=50000, categoria="otros", fecha=HOY,
                       descripcion="Seed gasto mes actual alto",
                       idem_key="seed-midia-gasto-mes-actual-alto")
    print(f"5. gasto del mes alto: anterior({mes_anterior})=10000 actual({HOY})=50000")

    # 6. cae_por_vencer: cae_vto dentro de [0, 14] dias
    c_cae = _comprobante_seed(comprobantes, conn_factory, cid,
                               idem_key="seed-midia-cae-por-vencer",
                               fecha_emision=HOY, cae_vto=HOY + datetime.timedelta(days=7),
                               total="15000")
    print(f"6. CAE por vencer: comprobante={c_cae} cae_vto=+7d")

    # 7. certificado_por_vencer: cert autofirmado con notAfter dentro de 30 dias. Vacio hoy en
    #    e2e-device (verificado read-only: 0 filas), asi que activarlo no pisa ninguna credencial
    #    real usada por otro E2E.
    cert_pem, key_pem = _generar_cert_fake(dias_para_vencer=10)
    afip_cred.save(CUIT_SEED, cert=cert_pem, key=key_pem, ambiente="dev", activar=True)
    print(f"7. certificado por vencer: cuit={CUIT_SEED} ambiente=dev notAfter=+10d")

    # 8. conexion_caida: mp_credentials con reauth_desde seteado. Vacio hoy en e2e-device
    #    (verificado read-only: 0 filas).
    mp.save("seed-midia-mp", access_token="seed-token", refresh_token="seed-refresh",
            expires_at=int(time.time()) + 3600)
    mp.marcar_reauth("seed-midia-mp")
    print("8. conexion caida: seller_user_id=seed-midia-mp reauth_desde=now()")


def main() -> int:
    ejecutar = "--ejecutar" in sys.argv
    _heredar_env_del_proceso(UNIT)

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "apps", "copiloto"))
    from _paths import ensure_paths
    ensure_paths()

    import psycopg2

    def conn_factory():
        return psycopg2.connect(os.environ["DATABASE_URL"])

    conn = conn_factory()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT cliente_id::text FROM uc_factory.tenants WHERE email = %s", (EMAIL_CANONICO,))
        filas = cur.fetchall()
    if len(filas) != 1:
        print(f"ABORT: {EMAIL_CANONICO} resuelve {len(filas)} fila(s), esperaba 1")
        return 2
    cid = filas[0][0]
    print(f"{EMAIL_CANONICO} cliente_id resuelto (1 fila confirmada)")

    if not ejecutar:
        print("dry-run: no se sembro nada (usar --ejecutar). Dominios a sembrar: 8 "
              "(presupuesto enfriandose, factura impaga vieja, trabajo margen negativo, "
              "trabajo sin ingreso, gasto del mes alto, CAE por vencer, certificado por vencer, "
              "conexion caida)")
        return 0

    from contexto_tenant import conexion_con_tenant, declarar_tenant

    def _conn_cruda():
        c = psycopg2.connect(os.environ["DATABASE_URL"])
        c.autocommit = True
        return c

    conn_factory_auto = conexion_con_tenant(_conn_cruda)
    declarar_tenant(cid)

    sembrar(conn_factory_auto, cid)

    print("\navanzando el tablero real (mi_dia_orquestador.avanzar_tablero)...")
    from mi_dia_orquestador import avanzar_tablero
    resultado = avanzar_tablero(conn_factory_auto, cid)
    print(f"avanzar_tablero => {resultado}")

    with conn_factory_auto().cursor() as cur:
        cur.execute("SELECT regla, count(*) FROM uc_factory.copiloto_mi_dia_tarjetas "
                    "WHERE cliente_id=%s::uuid AND estado <> 'hecha' GROUP BY regla ORDER BY regla",
                    (cid,))
        filas = cur.fetchall()
    print("\nmi_dia_tarjetas activas por regla:")
    for regla, n in filas:
        print(f"  {regla}: {n}")
    total = sum(n for _, n in filas)
    print(f"TOTAL midia-tarjeta-* = {total}")
    return 0 if total > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
