import json
import os

import pytest

import reply_store


class _FakeCursor:
    def __init__(self, store): self.store = store; self._rows = []
    def execute(self, sql, params=None):
        s = sql.strip().upper()
        if s.startswith("INSERT"):
            cid, sess, text, choices, card, idem = params
            # Emula el índice único PARCIAL `(cliente_id, idem_key) WHERE idem_key IS NOT NULL`: con
            # clave repetida no entra; sin clave, siempre entra. La semántica REAL se verificó contra
            # el Postgres del VPS (`test_el_indice_parcial_deduplica_de_verdad`, con TEMP TABLE y
            # rollback) — este fake sólo mantiene honesto al resto de la suite, que corre sin base.
            if idem is not None and any(r["cliente_id"] == cid and r.get("idem_key") == idem
                                        for r in self.store):
                return
            self.store.append({"id": len(self.store) + 1, "cliente_id": cid, "session_id": sess,
                               "reply_text": text, "choices": json.loads(choices) if choices else None,
                               "card": json.loads(card) if card else None, "idem_key": idem,
                               "created_at": "t"})
        elif s.startswith("SELECT"):
            cid, sess, after = params
            self._rows = [(r["id"], r["reply_text"], r["choices"], r["card"], r["created_at"])
                          for r in self.store
                          if r["cliente_id"] == cid and r["session_id"] == sess and r["id"] > after]
    def fetchall(self): return self._rows
    def __enter__(self): return self
    def __exit__(self, *a): return False


class _FakeConn:
    def __init__(self, store): self.store = store; self.autocommit = True
    def cursor(self): return _FakeCursor(self.store)


def test_sink_is_per_request_writes_and_read_returns_after_cursor():
    """make_pg_reply_sink(conn_factory) SIN cliente_id horneado: el sink devuelto recibe cliente_id por llamada."""
    store = []
    conn = _FakeConn(store)
    cf = lambda: conn
    cid = "00000000-0000-4000-8000-0000000000aa"
    sink = reply_store.make_pg_reply_sink(cf)
    sink(cid, "s1", "primer reply", [{"label": "Confirmar", "value": "confirm"}])
    sink(cid, "s1", "segundo reply", None)
    rows = reply_store.read_replies(cf, cid, "s1", after_id=0)
    assert [r["reply_text"] for r in rows] == ["primer reply", "segundo reply"]
    assert rows[0]["choices"] == [{"label": "Confirmar", "value": "confirm"}]
    rows2 = reply_store.read_replies(cf, cid, "s1", after_id=rows[0]["id"])
    assert [r["reply_text"] for r in rows2] == ["segundo reply"]      # cursor avanza


def test_sink_isolates_cross_tenant_same_session_id():
    """Aislamiento adversarial: el MISMO sink (per-worker, no horneado) usado para 2 tenants con el MISMO
    session_id -> el reply de A no es visible para B y viceversa (regla dura multitenant)."""
    store = []
    conn = _FakeConn(store)
    cf = lambda: conn
    cid_a = "00000000-0000-4000-8000-0000000000aa"
    cid_b = "00000000-0000-4000-8000-0000000000bb"
    sink = reply_store.make_pg_reply_sink(cf)
    sink(cid_a, "s1", "reply de A", None)
    sink(cid_b, "s1", "reply de B", None)                # mismo session_id, tenant distinto
    rows_a = reply_store.read_replies(cf, cid_a, "s1", after_id=0)
    rows_b = reply_store.read_replies(cf, cid_b, "s1", after_id=0)
    assert [r["reply_text"] for r in rows_a] == ["reply de A"]
    assert [r["reply_text"] for r in rows_b] == ["reply de B"]


def test_card_roundtrips_and_defaults_none():
    """El `card` (metadata de presentación del reply HITL) se persiste y vuelve en read_replies; omitirlo -> None."""
    store = []
    conn = _FakeConn(store)
    cf = lambda: conn
    cid = "00000000-0000-4000-8000-0000000000aa"
    sink = reply_store.make_pg_reply_sink(cf)
    sink(cid, "s1", "confirmá el doc", [{"label": "Confirmar", "value": "confirm"}],
         {"service": "googledocs", "label": "Google Docs"})
    sink(cid, "s1", "sin card", None)                        # card omitido -> None
    rows = reply_store.read_replies(cf, cid, "s1", after_id=0)
    assert rows[0]["card"] == {"service": "googledocs", "label": "Google Docs"}
    assert rows[1]["card"] is None


def test_el_reintento_con_la_misma_idem_key_NO_deja_un_segundo_reply():
    """EL TEST QUE IMPORTA. La activity `send_channel_message` se reintenta: si el envío se concretó y
    el worker murió antes de reportarlo, sin clave el emprendedor veía el mismo mensaje dos veces."""
    store = []
    cf = lambda: _FakeConn(store)                                                      # noqa: E731
    cid = "00000000-0000-4000-8000-0000000000aa"
    sink = reply_store.make_pg_reply_sink(cf)

    sink(cid, "s1", "tu factura está lista", None, idem_key="wf-1:run-1:5")
    sink(cid, "s1", "tu factura está lista", None, idem_key="wf-1:run-1:5")   # reintento

    assert len(reply_store.read_replies(cf, cid, "s1", after_id=0)) == 1


def test_control_sin_idem_key_se_insertan_los_dos():
    """Control diferencial: el índice es PARCIAL a propósito. Si dedupeara también las filas sin clave,
    dos mensajes legítimamente iguales ("listo", "listo") se perderían — y todas las filas anteriores a
    la migración, que no tienen clave, colisionarían entre sí."""
    store = []
    cf = lambda: _FakeConn(store)                                                      # noqa: E731
    cid = "00000000-0000-4000-8000-0000000000aa"
    sink = reply_store.make_pg_reply_sink(cf)

    sink(cid, "s1", "listo", None)
    sink(cid, "s1", "listo", None)

    assert len(reply_store.read_replies(cf, cid, "s1", after_id=0)) == 2


def test_dos_envios_distintos_del_mismo_tenant_conviven():
    """Control: la clave identifica el ENVÍO, no el texto. Dos activities distintas tienen claves
    distintas y sus dos replies tienen que entrar."""
    store = []
    cf = lambda: _FakeConn(store)                                                      # noqa: E731
    cid = "00000000-0000-4000-8000-0000000000aa"
    sink = reply_store.make_pg_reply_sink(cf)

    sink(cid, "s1", "primero", None, idem_key="wf-1:run-1:5")
    sink(cid, "s1", "segundo", None, idem_key="wf-1:run-1:9")

    assert len(reply_store.read_replies(cf, cid, "s1", after_id=0)) == 2


# ── la evidencia real: la deduplicación la hace Postgres, no el fake ──────────────────────────────

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@necesita_pg
def test_el_indice_parcial_deduplica_de_verdad():
    """Los fakes de arriba emulan el índice; esto lo EJERCITA. Sin este test, la suite podría estar
    verde con una sintaxis que Postgres rechaza en el deploy — y el `ON CONFLICT ... WHERE` con
    inferencia de índice parcial es justo el tipo de SQL que se escribe de memoria y sale mal.

    Va sobre una `TEMP TABLE` y termina en `ROLLBACK`: no toca ninguna tabla real, ni siquiera
    apuntando a la base de producción (que hoy es la única URL disponible).
    """
    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        cur = conn.cursor()
        cur.execute("CREATE TEMP TABLE t_replies (id bigserial, cliente_id uuid NOT NULL, "
                    "idem_key text, txt text);"
                    "CREATE UNIQUE INDEX t_replies_uk ON t_replies (cliente_id, idem_key) "
                    "WHERE idem_key IS NOT NULL;")
        cid = "11111111-1111-1111-1111-111111111111"
        ins = ("INSERT INTO t_replies (cliente_id, idem_key, txt) VALUES (%s,%s,%s) "
               "ON CONFLICT (cliente_id, idem_key) WHERE idem_key IS NOT NULL DO NOTHING")
        cur.execute(ins, (cid, "k1", "primero"))
        cur.execute(ins, (cid, "k1", "reintento"))          # mismo envío
        cur.execute(ins, (cid, None, "sin clave 1"))        # filas previas a la migración
        cur.execute(ins, (cid, None, "sin clave 2"))

        cur.execute("SELECT count(*), count(*) FILTER (WHERE idem_key IS NULL) FROM t_replies")
        total, sin_clave = cur.fetchone()
        assert total == 3, f"el reintento duplicó la fila: {total}"
        assert sin_clave == 2, "el índice parcial bloqueó filas sin clave: no era parcial"
    finally:
        conn.rollback()
        conn.close()
