"""Bootstrap del motor para pytest — un solo lugar (Fase 1, boundary del motor).

Reemplaza los `sys.path.insert(...)` inline que estaban repetidos en ~40 archivos de test.
pytest auto-carga este conftest (está en la raíz del código del copiloto, por encima de tests/)
ANTES de colectar cualquier test, así que todos los tests encuentran el motor + el propio código
del copiloto sin bootstrapear a mano.
"""
import sys
from pathlib import Path

# apps/copiloto en sys.path para poder importar `_paths` y los módulos del copiloto (worker_b,
# context_factory, services.*, dispatcher_emprendedor, ...) desde los tests.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from _paths import ensure_paths  # noqa: E402

ensure_paths()


# ---------------------------------------------------------------------------
# Higiene: los tests de integración escriben en la MISMA base que sirve a los usuarios
# ---------------------------------------------------------------------------
#
# No hay base de test separada: `DATABASE_URL` apunta a la de producción, y varios tests de
# integración insertan filas con `cliente_id` inventados. Los de AFIP limpiaban lo suyo; los de
# MercadoPago nunca lo hicieron, y para el 2026-07-21 había 539 filas huérfanas acumuladas —
# suficientes para que un muestreo al azar de "credenciales" devolviera basura de test y me hiciera
# perseguir un bug de cifrado que no existía.
#
# El riesgo no es el ruido: es que los tests escriben en la tabla que el worker lee en producción.
# Hoy los UUID aleatorios no colisionan; nada lo garantiza.
#
# DOS condiciones para borrar, no una:
#   1. `cliente_id` sin tenant real (la fila es inalcanzable para la app: todo se filtra por tenant), Y
#   2. creada DESPUÉS de que arrancó esta corrida de pytest.
#
# La segunda es la que importa. Sin ella, esto sería un DELETE masivo automático contra la base
# productiva disparado por correr tests: bastaría con que alguien borrara un tenant para que la
# siguiente corrida se llevara puestos todos sus datos históricos. Con ella, el barrido sólo puede
# tocar lo que la propia corrida creó.
#
# Es la red de seguridad, no el reemplazo de que cada test limpie lo suyo — la solución de raíz
# (schema o base separada para tests) es infra y está escalada.

import os  # noqa: E402

import pytest  # noqa: E402

# tabla -> columna de tiempo que marca cuándo se escribió la fila
_TABLAS_CON_TENANT = {
    "mp_credentials": "updated_at",
    "mp_payments": "created_at",
    "afip_credentials": "updated_at",
    "afip_perfil": "updated_at",
    "afip_secret_handoff": "created_at",
    "afip_comprobantes": "created_at",
    "copiloto_metering": "created_at",
    "copiloto_cobros": "created_at",
    "copiloto_conceptos": "created_at",
}


# ---------------------------------------------------------------------------
# La conexión de los tests tiene que ser LA MISMA que la de producción
# ---------------------------------------------------------------------------
#
# Hasta el 2026-07-31, 16 archivos de test repetían su propio `_conn_factory()` con
# `psycopg2.connect(DATABASE_URL)` crudo. Producción NO usa eso: `serve.py` y `worker_b.py` envuelven
# la fábrica con `conexion_con_tenant(...)`, que declara el tenant a la conexión. O sea que los tests
# ejercitaban un camino **que no existe en producción** — y por eso ninguno podía haber detectado que
# el RLS no estaba aplicando: no pasaban por la pieza que lo hace aplicar.
#
# Este fixture es esa fábrica, atada a un tenant explícito. `factory_de(cid)` es el equivalente exacto
# de lo que hace el borde real (`require_tenant` en HTTP, la costura C3 en activities): declarar de
# quién es la operación ANTES de tocar la base. El tenant sigue sin ser un parámetro del store — se
# declara alrededor de la conexión, igual que en producción.
@pytest.fixture
def conn_de_tenant():
    """`conn_de_tenant(cliente_id)` → conn_factory que declara ESE tenant, como el borde real.

    Usar en vez de un `psycopg2.connect` crudo: con `FORCE ROW LEVEL SECURITY` una conexión sin
    tenant declarado no lee ni escribe **nada**, que es precisamente el punto del mecanismo.
    """
    import psycopg2

    from contexto_tenant import conexion_con_tenant, tenant

    def factory_de(cliente_id: str):
        envuelta = conexion_con_tenant(lambda: psycopg2.connect(os.environ["DATABASE_URL"]))

        def factory():
            # El scope se abre y se cierra alrededor de la APERTURA: `conexion_con_tenant` lee el
            # ContextVar ahí y lo fija en la conexión con `set_config(..., false)`, que sobrevive al
            # scope. Así la conexión queda atada a su tenant aunque el test siga con otro.
            with tenant(cliente_id):
                return envuelta()

        return factory

    return factory_de


@pytest.fixture(scope="session", autouse=True)
def _barrer_huerfanas_de_test():
    """Borra al final SOLO lo que esta corrida creó y quedó sin tenant."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        yield
        return
    try:
        import psycopg2
    except ImportError:
        yield
        return

    inicio = None
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT now()")      # el reloj de la BASE, no el de esta máquina
            inicio = cur.fetchone()[0]
        conn.close()
    except Exception:  # noqa: BLE001
        pass

    yield

    if inicio is None:
        return
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        borradas = 0
        with conn.cursor() as cur:
            for tabla, col_tiempo in _TABLAS_CON_TENANT.items():
                cur.execute(
                    f"DELETE FROM uc_factory.{tabla} x "
                    f"WHERE x.{col_tiempo} >= %s AND NOT EXISTS "
                    f"(SELECT 1 FROM uc_factory.tenants t WHERE t.cliente_id = x.cliente_id)",
                    (inicio,))
                borradas += cur.rowcount or 0
        conn.close()
        if borradas:
            print(f"\n[conftest] barridas {borradas} filas huérfanas creadas por esta corrida",
                  flush=True)
    except Exception as exc:  # noqa: BLE001 — la higiene no puede tumbar la corrida de tests
        print(f"\n[conftest] no se pudo barrer ({type(exc).__name__}); revisar a mano", flush=True)
