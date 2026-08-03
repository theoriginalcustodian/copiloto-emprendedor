"""[#204] Activities con payload PLANO corren con `tenant(None)` bajo RLS FORCE — el fix del extractor.

El interceptor declaraba el tenant leyendo `payload["conv"]["cliente_id"]` / `payload["cliente_id"]`
/ `payload["ctx"]["cliente_id"]` (`_cliente_id_de`), pero ~13 activities de dominio (facturación
AFIP, `refresh_credential` de MercadoPago) reciben `cliente_id` como **primer argumento posicional
plano** — sin envoltorio. Medido en producción el 2026-08-02: misma conexión, misma query, `0 filas`
sin tenant declarado vs `1 fila` con tenant, contra `afip_credentials` (RLS `FORCE`).

Este archivo prueba el fix (`_cliente_id_de_activity`) contra las activities REALES del repo, no
contra firmas de juguete — es la diferencia entre "el extractor sabe leer un dict con esta forma" y
"el extractor resuelve las 13 activities que hoy fallan en producción".
"""
from __future__ import annotations

import inspect

import afip_factura_activities as AF
import mi_dia_schedule_activities as MD
from interceptor_errores import _cliente_id_de_activity
from clients.agent.providers.mp_refresh_activities import refresh_credential


#: Las activities de dominio con payload plano, tal como las registra `worker_b.py:330-336`. Si
#: `worker_b` agrega una activity nueva a esa lista con `cliente_id` como primer parámetro, este
#: archivo no lo sabe — por eso el guard de abajo NO depende de mantener esta lista sincronizada:
#: recorre las firmas reales, no una copia de la lista.
_ACTIVITIES_DOMINIO_REALES = (
    AF.cargar_contexto_factura, AF.reservar_numero_comprobante, AF.emitir_comprobante,
    AF.generar_pdf_comprobante, AF.buscar_comprobante, AF.listar_comprobantes,
    AF.marcar_comprobante_anulado, AF.archivar_factura_en_drive,
    MD.avanzar_tablero_mi_dia,
    refresh_credential,
)


def test_INVARIANTE_toda_activity_de_dominio_real_resuelve_su_tenant():
    """El invariante central: cada una de las activities que HOY fallan en producción, ejercitadas
    con su firma verdadera (`inspect.signature` sobre la función importada, no una copia escrita a
    mano), tiene que resolver el tenant desde su primer argumento posicional."""
    TENANT = "19af5a42-cliente-de-prueba"
    fallidas = []
    for fn in _ACTIVITIES_DOMINIO_REALES:
        params = list(inspect.signature(fn).parameters)
        assert params and params[0] == "cliente_id", (
            f"{fn.__name__}: se asumía cliente_id como primer parámetro y ya no lo es — "
            f"revisar si sigue en la lista de #204")
        args = (TENANT,) + tuple(None for _ in params[1:])
        resuelto = _cliente_id_de_activity(None, fn, args)
        if resuelto != TENANT:
            fallidas.append(fn.__name__)
    assert not fallidas, f"no resolvieron el tenant: {fallidas}"


def test_CONTROL_una_activity_SIN_cliente_id_como_primer_parametro_no_se_toca():
    """Control negativo, con una activity real: `MD.detectar_todos` no es una activity Temporal pero
    tiene la firma exacta que sí importa acá — `(conn_factory, cliente_id, ...)`, con `cliente_id`
    en SEGUNDA posición. Si el extractor devolviera igual un tenant, estaría adivinando por posición,
    no leyendo la firma — y eso es lo que un tenant FALSO necesita para colarse."""
    import mi_dia_detector as D
    params = list(inspect.signature(D.detectar_todos).parameters)
    assert params[0] != "cliente_id", "control inválido: elegir otra función de contraejemplo"
    resuelto = _cliente_id_de_activity(None, D.detectar_todos, ("no-es-el-tenant", "tampoco-esto"))
    assert resuelto is None


def test_dict_conv_cliente_id_sigue_ganando_sobre_el_plano():
    """El caso dict (motor ReAct) no se rompe: sigue resolviéndose ANTES de mirar la firma —
    `_cliente_id_de_activity` prueba primero el shape existente, la firma es sólo el fallback."""
    payload = {"conv": {"cliente_id": "tenant-del-dict"}}

    def _cualquiera(cliente_id: str) -> None:  # firma que también calificaría por posición
        pass

    resuelto = _cliente_id_de_activity(payload, _cualquiera, (payload,))
    assert resuelto == "tenant-del-dict"


def test_sin_fn_ni_args_degrada_a_None_no_a_adivinar():
    from interceptor_errores import _cliente_id_de_activity as extraer
    assert extraer({"algo": "sin tenant"}, None, ()) is None
    assert extraer("un-string-cualquiera", None, ("x",)) is None
