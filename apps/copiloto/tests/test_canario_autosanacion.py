"""El canario: que deposite de verdad, y que el ciclo NO intente repararlo.

Las dos mitades tienen que valer a la vez. Un canario que no deposita no vigila nada; uno que el ciclo
repara genera un PR basura por cada prueba de vida y termina desactivado por molesto.
"""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

import autosanacion_gates as gates
import canario_autosanacion as canario
from contexto_tenant import declarar_tenant
from deposito_traumas import fabrica_desde
from handler_errores_web import registrar_captura_global
from trauma_store import TraumaStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")


def test_la_marca_del_gate_y_la_del_canario_no_pueden_separarse():
    """El contrato entre dos módulos que NO se importan entre sí.

    `autosanacion_gates` copia el literal en vez de importar `canario_autosanacion` (los gates corren
    dentro del workflow y no deben arrastrar el módulo del endpoint). Esa copia es exactamente la
    clase de acoplamiento que se rompe en silencio: alguien renombra la marca de un lado, el gate deja
    de reconocer al canario, y el único síntoma es un PR basura una semana después.
    """
    assert gates.MARCA_CANARIO == canario.MARCA
    assert canario.MARCA in canario.RUTA, \
        "la ruta del canario tiene que contener la marca: es lo que el gate mira"


def test_el_gate_RECHAZA_reparar_el_canario():
    decision = gates.puede_reparar(ruta=f"POST {canario.RUTA}", reparaciones_hoy=0,
                                   categoria="business_error")
    assert decision.permitido is False
    assert "canario" in decision.motivo.lower()


def test_el_rechazo_del_canario_NO_es_reintentable():
    """El canario se CIERRA, no se suelta: si vuelve a la cola, termina tapándola.

    Medido en prod el 2026-08-02: el ciclo toma UN trauma por corrida
    (`tomar_un_bug_distinto`, `ORDER BY dedupe_count DESC`). El canario rechazado se soltaba a
    `pendiente` y volvía en CADA corrida — las de las 02, 04, 06 y 08 salieron todas
    `rechazado_por_gate` con el mismo `trauma_id: 14`. Peor a futuro: cada prueba de vida comparte
    fingerprint, así que su `dedupe_count` crece y a los pocos disparos se quedaría con todas las
    corridas. El vigilante impidiendo trabajar al sistema que vigila — y el síntoma sería "el
    autohealing no repara nada", indistinguible de "no hay nada que reparar".
    """
    decision = gates.puede_reparar(ruta=f"POST {canario.RUTA}", reparaciones_hoy=0,
                                   categoria="business_error")
    assert decision.reintentable is False


def test_CONTROL_un_rechazo_TRANSITORIO_si_es_reintentable(monkeypatch):
    """El control que hace significativo al de arriba.

    Sin él, un `reintentable=False` cableado en todos lados pasaría aquel test y descartaría bugs
    REALES en silencio cada vez que el kill switch estuviera activo o el tope alcanzado — que es el
    daño opuesto y mucho peor. El kill switch es transitorio por definición: cuando se apague, ese
    trauma tiene que seguir ahí.
    """
    monkeypatch.setenv(gates.ENV_KILL_SWITCH, "1")
    decision = gates.puede_reparar(ruta="POST /presupuestos", reparaciones_hoy=0,
                                   categoria="business_error")
    assert decision.permitido is False, "el kill switch no frenó: el control no está midiendo"
    assert decision.reintentable is True


def test_CONTROL_el_gate_PERMITE_reparar_una_ruta_normal():
    """El control que hace significativo al test de arriba.

    Sin él, un `puede_reparar` que devolviera `False` siempre —un gate roto hacia el "no"— pasaría el
    test anterior con honores y apagaría el ciclo entero sin que nadie se enterara.
    """
    decision = gates.puede_reparar(ruta="POST /presupuestos", reparaciones_hoy=0,
                                   categoria="business_error")
    assert decision.permitido is True, decision.motivo


def test_disparar_lanza_el_error_deliberado():
    with pytest.raises(canario.ErrorDeCanario) as capturado:
        canario.disparar("tenant-de-prueba")
    assert "DELIBERADO" in str(capturado.value), \
        "el mensaje tiene que decir que es a propósito: alguien lo va a leer en la DLQ a las 3 AM"


def test_apagado_por_env_no_lanza(monkeypatch):
    monkeypatch.setenv(canario.ENV_APAGADO, "1")
    canario.disparar("tenant-de-prueba")  # no lanza


def test_el_canario_esta_ENCENDIDO_por_default(monkeypatch):
    """Un vigilante que nace apagado no vigila, y nadie se entera de que no vigila."""
    monkeypatch.delenv(canario.ENV_APAGADO, raising=False)
    assert canario.apagado() is False


@pytest.fixture
def tenant_de_prueba(conn_de_tenant):
    cid = str(uuid.uuid4())
    yield cid
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM uc_factory.copiloto_traumas WHERE cliente_id = %s", (cid,))
    conn.close()


@necesita_pg
def test_el_canario_DEPOSITA_en_la_dlq_por_el_camino_real(tenant_de_prueba, conn_de_tenant):
    """La prueba de que el canario prueba algo.

    Monta el borde como producción —dependencia async que declara el tenant, sin middleware
    inventado— y exige la fila. Si esto falla, el canario no sirve como prueba de vida: estaría
    reportando salud sin haber recorrido el camino que dice vigilar.
    """
    cid = tenant_de_prueba
    app = FastAPI()

    async def _tenant_del_borde() -> str:
        declarar_tenant(cid)
        return cid

    registrar_captura_global(app, traumas=fabrica_desde(conn_de_tenant(cid)))

    @app.post(canario.RUTA)
    def _canario(cliente_id: str = Depends(_tenant_del_borde)):  # noqa: ANN202, B008
        canario.disparar(cliente_id)

    respuesta = TestClient(app, raise_server_exceptions=False).post(canario.RUTA)

    assert respuesta.status_code == 500, "el canario tiene que salir como un error normal, no especial"
    codigo = respuesta.json()["codigo"]

    traumas = TraumaStore(conn_de_tenant(cid), cid).listar()
    assert traumas, "el canario no llegó a la DLQ: el cable que viene a vigilar está cortado"
    assert traumas[0]["fingerprint"] == codigo
    assert traumas[0]["error_type"] == "ErrorDeCanario"
    assert traumas[0]["costura"] == "http_handler"
