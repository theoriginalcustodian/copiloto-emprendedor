"""Pool de conexiones detrás de `conn_factory` (C4, auditoría lote C) — capa PLATAFORMA, agnóstica
de tenant. No sabe qué es un cliente; sólo sabe reciclar sockets.

## El problema

Los 3 procesos (`serve.py`, `worker_b.py`, `worker_soporte.py`) arman su `conn_factory` con
`psycopg2.connect(db_url)` **directo**: cada una de las ~60 llamadas a `self._conn_factory()` de los
10 stores que no usan `with` abre una conexión TCP + auth nueva contra Postgres. Ni siquiera los
sitios que SÍ usan `with self._conn_factory() as conn` la devuelven — el `__enter__`/`__exit__` de
psycopg2 sólo maneja la transacción (commit/rollback), nunca el socket. El único cierre real hoy
pasa por el GC de CPython, que en general es rápido pero no es un contrato.

## El fix, en un solo lugar — no se toca ninguno de los ~60 sitios

Este módulo reemplaza el `psycopg2.connect` **dentro** de la fábrica cruda, antes de que
`conexion_con_tenant` (`contexto_tenant.py`) la envuelva. Lo que hoy es "abrí un socket nuevo" pasa a
ser "tomé uno prestado del pool"; lo que hoy es "dejé que el GC lo cierre" pasa a ser "dejé que el GC
lo devuelva". Ningún store, ningún call-site, se entera del cambio — la interfaz de `conn_factory()`
es idéntica.

## Por qué esto es seguro con RLS `FORCE` (y por qué un PgBouncer en modo *transaction* NO lo sería)

`declarar_en_conexion` corre en **cada** llamada a `conn_factory()`, no una vez por conexión física
— así que reusar el socket entre tenants distintos es seguro: el claim (`request.jwt.claims`) se
pisa en cada préstamo, antes de que el store ejecute una sola query. Un PgBouncer clásico en modo
*transaction pooling* rompería exactamente esta garantía: el `SET` de sesión (`set_config(..., false)`,
no `SET LOCAL` — ver `contexto_tenant.py`) no sobrevive el multiplexado de transacciones de clientes
distintos sobre el mismo backend, y una conexión reciclada podría heredar el claim de OTRO tenant sin
que nadie lo vuelva a declarar. Es el mismo bug que `contexto_tenant.py` ya documentó una vez en prod
(2026-07-31: una query sin JWT devolvió filas de 3 tenants). Por eso el pool vive DENTRO del proceso
Python, no como un proxy de red delante de todos: acá la re-declaración por préstamo es parte del
mismo mecanismo que la otorga, no depende de que un tercero (PgBouncer) coopere con un supuesto que
no conoce. Validado con test adversarial, no supuesto — ver
`test_conn_pool.py::test_ADVERSARIAL_prestamos_intercalados_de_dos_tenants_no_cruzan_el_claim`.

## El agotamiento NO puede ser un error — tiene que ser una espera corta

`ThreadedConnectionPool.getconn()` sola NO espera si no hay cupo: tira `PoolError` al instante
(medido acá mismo, con el test de carga de abajo -- 20 hilos contra `maxconn=3` hicieron explotar
17 de 20 préstamos antes de este fix). Sin arreglarlo, un pico de concurrencia normal se convertiría
en 500 para el emprendedor, que es peor que el problema que este módulo vino a resolver: la conexión
sin pool nunca REHUSABA un request, sólo lo hacía más caro. El semáforo de abajo lo convierte en
backpressure de verdad: agotado el pool, el préstamo **espera** hasta `timeout` segundos en vez de
fallar server-hasta.
"""
from __future__ import annotations

import threading
from typing import Callable

import psycopg2
import psycopg2.pool


class _ConexionPooleada:
    """Proxy transparente sobre una conexión real del pool.

    Todo se reenvía tal cual al objeto envuelto (`.cursor()`, `.autocommit`, `.closed`, el
    `__enter__`/`__exit__` de la transacción) salvo `close()`, que **devuelve la conexión al pool en
    vez de cortar el socket** — tanto si se llama a mano (3 stores lo hacen hoy) como si dispara sola
    vía `__del__` cuando el GC recolecta la variable (el resto de los sitios, que nunca llaman
    `close()`). Cubre los dos idiomas que ya existen en el código sin que ninguno tenga que cambiar.
    """

    __slots__ = ("_conn", "_pool", "_cupo", "_devuelta")

    def __init__(self, conn, pool: "psycopg2.pool.AbstractConnectionPool",
                 cupo: threading.Semaphore) -> None:
        object.__setattr__(self, "_conn", conn)
        object.__setattr__(self, "_pool", pool)
        object.__setattr__(self, "_cupo", cupo)
        object.__setattr__(self, "_devuelta", False)

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def __setattr__(self, name, value):
        setattr(self._conn, name, value)

    def __enter__(self):
        self._conn.__enter__()
        return self

    def __exit__(self, exc_type, exc, tb):
        return self._conn.__exit__(exc_type, exc, tb)

    def close(self) -> None:
        if self._devuelta:
            return
        object.__setattr__(self, "_devuelta", True)
        conn, pool = self._conn, self._pool
        try:
            # Si la conexión real ya quedó cerrada (error de red, o el except de
            # `conexion_con_tenant` que la cierra si no pudo declarar el tenant), `close=True` le
            # dice al pool que la descarte en vez de reofrecerla — una conexión rota devuelta como
            # si sirviera envenenaría el próximo préstamo.
            pool.putconn(conn, close=bool(conn.closed))
        except Exception:
            # El pool mismo pudo haber sido descartado (shutdown del proceso). No hay a quién
            # devolverle nada, y una excepción acá durante un `__del__` sólo ensucia el log sin
            # ningún llamador que la vaya a atender.
            pass
        finally:
            # Libera el cupo SIEMPRE, incluso si `putconn` explotó -- si no, un fallo ahí filtraría
            # un cupo perdido para siempre y el pool se agotaría de a poco aunque la conexión real
            # ya no exista.
            self._cupo.release()

    def __del__(self) -> None:
        self.close()


def pool_de_conexiones(db_url: str, *, minconn: int = 1, maxconn: int = 10,
                        timeout: float = 10.0) -> Callable:
    """Fábrica cruda respaldada por un `ThreadedConnectionPool` — pensada para reemplazar un
    `psycopg2.connect(db_url)` suelto, no para usarse sola: el llamador la envuelve con
    `conexion_con_tenant` exactamente igual que antes.

    `ThreadedConnectionPool` y no `SimpleConnectionPool`: los stores corren en threads
    (`asyncio.to_thread`, ver el docstring de `contexto_tenant.py`), y el pool tiene que ser seguro
    entre threads.

    Un `Semaphore(maxconn)` delante de `pool.getconn()`: agotado el pool, el préstamo espera hasta
    `timeout` segundos (backpressure) en vez de que `getconn()` tire `PoolError` al instante, que es
    lo que hace sola -- ver el docstring del módulo.

    Un pool por PROCESO. Los 3 procesos (`serve.py`, `worker_b.py`, `worker_soporte.py`) llaman esto
    una sola vez al arrancar, cada uno con el suyo — un pool no cruza procesos ni se comparte.
    """
    pool = psycopg2.pool.ThreadedConnectionPool(minconn, maxconn, db_url)
    cupo = threading.Semaphore(maxconn)

    def conn_factory():
        if not cupo.acquire(timeout=timeout):
            raise TimeoutError(
                f"pool de conexiones agotado: sin cupo tras esperar {timeout}s (maxconn={maxconn})")
        try:
            conn = pool.getconn()
        except Exception:
            cupo.release()
            raise
        if not conn.autocommit:
            conn.autocommit = True
        return _ConexionPooleada(conn, pool, cupo)

    return conn_factory
