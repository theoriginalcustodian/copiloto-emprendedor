"""FACTID — ¿sostiene la idempotencia de facturación una alta REALMENTE concurrente?

**El pedido** (`coordinacion/abierto/2026-09-23_pedido_planificacion-a-backend_spike-idempotencia-de-facturacion.md`):
"la factura es la operación menos reintentable y es la única sin `idemKey`". Tres preguntas, con
evidencia EJECUTABLE, no lectura de código:

  1. ¿`POST /afip/facturas` acepta `idem_key`?
  2. ¿la idempotencia del store aguanta concurrencia real? Dos altas simultáneas con la MISMA
     `idem_key` contra el mecanismo real (no un mock) — contar las filas.
  3. ¿qué pasa si el workflow reintenta la emisión hoy?

**Lo que la lectura de código adelantó (y este spike verifica empíricamente):**

- `NuevaFacturaBody` (`afip_web.py:121-122`) sólo tiene `cuit`. No hay `idem_key` en el contrato HTTP.
- Peor: el workflow arma su PROPIO "idem_key" — es `factura_id`, y en el camino manual
  (`make_iniciar_factura`, `web.py:256`) es `uuid.uuid4().hex` **fresco en cada llamada**. Aunque el
  store SÍ tenga un chequeo por `idem_key` (Capa 1, `_emitir_sync` en `afip_factura_activities.py:97-99`),
  ese chequeo nunca puede encontrar coincidencia acá: la "clave de idempotencia" no es una clave de
  idempotencia real, es un identificador de instancia que cambia en cada toque de botón.
- El `ON CONFLICT` de `registrar()` (`afip_comprobante_store.py:56`) apunta a
  `(cliente_id, cuit, tipo_cbte, punto_venta, nro)` — la clave natural de AFIP. El índice único de
  `idem_key` (`afip_indexes.sql`, `afip_comprobantes_idem`) es OTRO índice, que ese `ON CONFLICT` NO
  contempla. Si dos filas comparten `idem_key` pero difieren en `nro`, el segundo INSERT no cae en el
  `DO UPDATE`: choca contra el índice de `idem_key` con un `UniqueViolation` sin capturar en
  `_emitir_sync` (no hay try/except alrededor de `store.registrar()`, líneas 146-151).

**Qué mide este spike, contra Postgres REAL (no mock):**

  Experimento A — la pregunta CENTRAL del pedido: dos threads llaman `_emitir_sync` con la MISMA
  `idem_key`, sincronizados con un `threading.Barrier` para que AMBOS pasen la consulta de Capa 1
  (`por_idem_key`) antes de que cualquiera registre — la ventana de carrera clásica de
  check-then-act. Gateway FAKE que nunca toca ARCA real y modela el peor caso ("AFIP no coordina":
  cada emisión exitosa devuelve un `nro`/`cae` NUEVO). Se cuentan filas resultantes y emisiones reales
  simuladas.

  Experimento B — el escenario que REALMENTE ocurre hoy en `/afip/facturas`: dos toques del botón =
  dos `idem_key` DISTINTOS (cada uno es un `uuid.uuid4()` fresco), incluso sin ninguna carrera de
  base de datos. Mide el daño de fondo, independiente del Experimento A.

**Restricción dura del pedido, respetada:** ningún experimento llama a ARCA real. El gateway es 100%
fake. Si esto no pudiera medirse sin emitir un comprobante real, el spike se detendría acá — no fue
necesario.

**Cómo correrlo:** requiere Postgres real con el schema `uc_factory` provisionado (los índices de
`afip_indexes.sql` aplicados) — corre en el VPS, nunca en la PC (sin `psycopg2` local). Usa
`DATABASE_URL` del entorno, igual que `conftest.py`. `cliente_id` es un UUID sintético sin tenant real
(mismo criterio que `_barrer_huerfanas_de_test`): el spike limpia sus propias filas al final, siempre
—éxito o excepción— así no le deja ruido a la base compartida.
"""
from __future__ import annotations

import itertools
import os
import sys
import threading
import uuid
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "apps", "copiloto"))
from _paths import ensure_paths  # noqa: E402

ensure_paths()

import psycopg2  # noqa: E402

import afip_factura_activities as act  # noqa: E402
from afip_comprobante_store import AfipComprobanteStore  # noqa: E402
from contexto_tenant import conexion_con_tenant, tenant  # noqa: E402

CUIT = "20269996065"
PAYLOAD_BASE = {"PtoVta": 1, "CbteTipo": 11, "DocTipo": 96, "DocNro": "20111111112",
                "ImpTotal": 100.0, "CbteFch": "20260923"}


def _store_real(cliente_id: str) -> AfipComprobanteStore:
    envuelta = conexion_con_tenant(lambda: psycopg2.connect(os.environ["DATABASE_URL"]))

    def conn_factory():
        with tenant(cliente_id):
            return envuelta()

    return AfipComprobanteStore(conn_factory, cliente_id)


class StoreConBarrera:
    """Envuelve el store REAL: fuerza que ambos threads pasen la Capa 1 antes de que cualquiera
    registre — la ventana de carrera de un check-then-act, hecha determinística para medirla."""

    def __init__(self, real: AfipComprobanteStore, barrera: threading.Barrier) -> None:
        self._real, self._barrera = real, barrera

    def por_idem_key(self, idem_key):
        r = self._real.por_idem_key(idem_key)
        self._barrera.wait(timeout=15)
        return r

    def registrar(self, **kw):
        return self._real.registrar(**kw)


class GatewayNoCoordina:
    """Peor caso real de AFIP (WSFE `createNextVoucher`, `afip_gateway.py:205-254`): el llamador NO
    puede pedir un número puntual — AFIP asigna el siguiente, y dos emisiones exitosas se llevan
    números DISTINTOS. Nunca toca ARCA — esto es 100% en memoria."""

    def __init__(self, base_nro: int) -> None:
        self._contador = itertools.count(base_nro)
        self._lock = threading.Lock()
        self.emisiones: list[int] = []

    def ultimo_comprobante(self, *, punto_venta, tipo_cbte):
        return next(self._contador) - 1

    def existe_comprobante(self, *, numero, punto_venta, tipo_cbte):
        return False  # nadie coordinó todavía: ninguno de los dos intentos fue autorizado antes

    def info_comprobante(self, *, numero, punto_venta, tipo_cbte):
        return {}

    def emitir(self, payload):
        with self._lock:
            nro = next(self._contador)
        self.emisiones.append(nro)

        class Res:
            cae = f"CAE-FAKE-{nro}"
            numero = nro
            resultado = "A"
            cae_vto = date(2026, 10, 23)

        return Res()


def _cablear(store, gateway) -> None:
    act._comprobante_store_factory = lambda cid: store
    act._cred_store_factory = lambda cid: type(
        "C", (), {"get": lambda self, c: {"cert": "x", "key": "y", "ambiente": "dev"}})()
    act._gateway_factory = lambda *a, **k: gateway


def _conn_del_tenant(cliente_id: str):
    """Con `FORCE ROW LEVEL SECURITY` una conexión sin `request.jwt.claims` declarado ve 0 filas
    SIEMPRE, mienta o no haya datos — es el mismo instrumento ciego por RLS que ya se documentó en
    `memoria/un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo.md`. `_limpiar`/`_filas` tienen
    que declarar el tenant igual que el store real, o miden "no veo" y lo informan como "no hay"."""
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT set_config('request.jwt.claims', %s, false)",
                    (f'{{"cliente_id":"{cliente_id}"}}',))
    return conn


def _limpiar(cliente_id: str) -> None:
    conn = _conn_del_tenant(cliente_id)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM uc_factory.afip_comprobantes WHERE cliente_id=%s", (cliente_id,))
    conn.close()


def _filas(cliente_id: str) -> list[tuple]:
    conn = _conn_del_tenant(cliente_id)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, nro, idem_key, cae FROM uc_factory.afip_comprobantes "
            "WHERE cliente_id=%s ORDER BY id", (cliente_id,))
        filas = cur.fetchall()
    conn.close()
    return filas


def experimento(nombre: str, *, misma_idem_key: bool) -> dict:
    cliente_id = str(uuid.uuid4())
    gateway = GatewayNoCoordina(base_nro=100)
    real_store = _store_real(cliente_id)
    store = StoreConBarrera(real_store, threading.Barrier(2))
    _cablear(store, gateway)

    idem_a = "idem-fijo" if misma_idem_key else f"idem-{uuid.uuid4().hex}"
    idem_b = "idem-fijo" if misma_idem_key else f"idem-{uuid.uuid4().hex}"

    resultados: dict[str, object] = {}
    excepciones: dict[str, str] = {}

    def _correr(etiqueta: str, idem_key: str) -> None:
        try:
            resultados[etiqueta] = act._emitir_sync(
                cliente_id, CUIT, dict(PAYLOAD_BASE), idem_key, f"wf-{etiqueta}",
                "Cliente Spike", nro_reservado=100)
        except Exception as exc:  # noqa: BLE001 — se captura para MEDIR, no para ocultar
            excepciones[etiqueta] = f"{type(exc).__name__}: {exc}"

    t1 = threading.Thread(target=_correr, args=("t1", idem_a))
    t2 = threading.Thread(target=_correr, args=("t2", idem_b))
    try:
        t1.start(); t2.start()
        t1.join(timeout=20); t2.join(timeout=20)
        filas = _filas(cliente_id)
    finally:
        # Limpieza incondicional: esta corrida escribe en la MISMA base que producción (no hay base de
        # test separada, igual que `conftest.py`). `cliente_id` es un UUID sintético sin tenant real —
        # nunca puede ser alcanzado por la app — pero igual no debe sobrevivir al spike.
        _limpiar(cliente_id)

    print(f"\n=== {nombre} ===")
    print(f"  idem_key t1={idem_a!r} t2={idem_b!r}")
    print(f"  emisiones reales (fake) del gateway: {gateway.emisiones}")
    print(f"  resultados OK: {list(resultados.keys())}")
    print(f"  excepciones: {excepciones}")
    print(f"  filas en afip_comprobantes: {len(filas)} -> {filas}")

    return {
        "emisiones": len(gateway.emisiones),
        "filas": len(filas),
        "excepciones": excepciones,
    }


def main() -> int:
    if not os.environ.get("DATABASE_URL"):
        print("FALTA DATABASE_URL — este spike corre contra Postgres real (VPS), no en la PC.")
        return 2

    a = experimento("Experimento A — MISMA idem_key, carrera forzada (la pregunta central del pedido)",
                     misma_idem_key=True)
    b = experimento("Experimento B — idem_key DISTINTA por llamada (lo que ocurre HOY en /afip/facturas)",
                     misma_idem_key=False)

    print("\n=== VEREDICTO ===")
    fallas = []

    if a["filas"] == 1:
        print("A: 1 fila -> hay una restricción real detrás del idem_key (el índice único la sostuvo).")
    elif a["filas"] == 2:
        fallas.append("A: 2 FILAS con la misma idem_key -> la ventana existe, Capa 1 NO alcanza.")
    else:
        fallas.append(f"A: estado inesperado ({a['filas']} filas)")
    if a["excepciones"]:
        fallas.append(f"A: una emisión REAL (fake) quedó sin registrar limpio -> {a['excepciones']}")

    if b["emisiones"] == 2 and b["filas"] == 2:
        fallas.append("B: doble toque hoy = DOS facturas reales emitidas y registradas, sin ningún "
                       "error visible para nadie -> el 'idem_key' que genera el workflow no es "
                       "idempotencia real, es un id de instancia.")

    print()
    if fallas:
        print("FACTID: la ventana existe / el gap es real.")
        for f in fallas:
            print(f"  - {f}")
        return 1
    print("FACTID: no se pudo reproducir daño.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
