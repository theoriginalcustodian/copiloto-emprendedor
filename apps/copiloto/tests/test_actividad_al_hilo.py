"""SM-P19 mitad B: la frase y la card del turno de actividad, sin base (la integración vive en
`test_adversarial_multitenant.py::*sm_p19*`)."""
import pytest

import actividad_al_hilo as ah


def _sink():
    filas = []

    def sink(cliente_id, session_id, text, choices, card=None, *, idem_key=None):
        filas.append({"cliente_id": cliente_id, "session_id": session_id, "text": text, "card": card,
                      "idem_key": idem_key})
    return sink, filas


def test_publica_la_card_con_su_idem_key():
    sink, filas = _sink()
    ah.make_publicar_actividad(sink)("cli-A", "sess-1", "gasto", 7, {"id": 7, "monto": "2500.00"})
    assert filas == [{"cliente_id": "cli-A", "session_id": "sess-1", "text": "Anoté un gasto de $2.500.",
                      "card": {"kind": "actividad_registrada", "tipo": "gasto", "id": 7,
                               "resumen": {"id": 7, "monto": "2500.00"}},
                      "idem_key": "act-gasto-7"}]


def test_sin_session_id_no_publica():
    sink, filas = _sink()
    ah.make_publicar_actividad(sink)("cli-A", None, "gasto", 7, {})
    ah.make_publicar_actividad(sink)("cli-A", "", "gasto", 7, {})
    assert filas == []


def test_un_sink_roto_no_rompe_el_guardado(monkeypatch):
    monkeypatch.setattr(ah, "log_error", lambda *a, **k: "fp")

    def roto(*a, **k):
        raise RuntimeError("db caída")
    ah.make_publicar_actividad(roto)("cli-A", "s", "gasto", 1, {"monto": "1"})   # no levanta


def test_un_tipo_desconocido_es_error_de_programacion():
    sink, _ = _sink()
    with pytest.raises(ValueError):
        ah.make_publicar_actividad(sink)("cli-A", "s", "venta", 1, {})


@pytest.mark.parametrize("tipo, resumen, esperado", [
    ("gasto", {"monto": "2500.50", "proveedor": "Corralón"}, "Anoté un gasto de $2.500,50 (Corralón)."),
    ("cobro", {"ingreso": {"monto": "85000.00", "cliente_nombre": "Kiosco", "falta": []}},
     "Anoté un cobro de $85.000 de Kiosco."),
    ("cobro", {"cobro": {"monto": "400.00", "cliente_nombre": "", "falta": []}, "comprobante": {}},
     "Anoté un cobro de $400."),
    ("cobro", {"ingreso": {"monto": "100.00", "cliente_nombre": "", "falta": ["cliente", "medio"]}},
     "Anoté un cobro de $100. Si querés, después completás de quién y cómo te pagaron."),
    ("presupuesto", {"presupuesto": {"numero": 8, "total": "100000.00", "receptor": {"nombre": "Los Tilos"}}},
     "Guardé el presupuesto N° 8 por $100.000 para Los Tilos."),
    ("cliente", {"id": 3, "nombre": "Ferretería El Tornillo"}, "Agregué a Ferretería El Tornillo a tus clientes."),
    ("factura", {"ok": True, "aceptado": True}, "Mandé a emitir la factura. Te aviso acá cuando ARCA la autorice."),
])
def test_frases(tipo, resumen, esperado):
    assert ah.frase(tipo, resumen) == esperado
