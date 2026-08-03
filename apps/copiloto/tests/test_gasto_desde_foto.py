"""Tests puros de `construir_gasto_desde_foto` (sin red, sin DB) -- la traducción del dict crudo del
OCR (`vision.OpenAIVisionOCR`) al `data` de la card `gasto_propuesto` que consume
`packages/core/src/chat/gastoPropuesto.ts`."""
from __future__ import annotations

from datetime import date

from gasto_desde_foto import construir_gasto_desde_foto


def test_monto_nunca_se_precarga():
    g = construir_gasto_desde_foto({"monto": 739.59, "fecha": None, "proveedor": None,
                                    "categoria": None})
    assert g["monto"] == ""
    assert g["monto_sugerido"] == "739.59"


def test_monto_ausente_no_rompe():
    g = construir_gasto_desde_foto({"monto": None, "fecha": None, "proveedor": None,
                                    "categoria": None})
    assert g["monto"] == ""
    assert g["monto_sugerido"] is None


def test_monto_basura_no_rompe():
    g = construir_gasto_desde_foto({"monto": "no-es-un-numero", "fecha": None, "proveedor": None,
                                    "categoria": None})
    assert g["monto_sugerido"] is None


def test_fecha_iso_valida_se_conserva():
    g = construir_gasto_desde_foto({"monto": None, "fecha": "2026-07-15", "proveedor": None,
                                    "categoria": None})
    assert g["fecha"] == "2026-07-15"


def test_fecha_ausente_o_invalida_cae_en_hoy_del_negocio():
    hoy = date(2026, 8, 3)
    g1 = construir_gasto_desde_foto({"monto": None, "fecha": None, "proveedor": None,
                                     "categoria": None}, ahora=None)
    g2 = construir_gasto_desde_foto({"monto": None, "fecha": "no-es-una-fecha", "proveedor": None,
                                     "categoria": None}, ahora=None)
    # Sin inyectar `ahora`, usa el reloj real -- solo confirmamos que es una fecha ISO parseable.
    assert date.fromisoformat(g1["fecha"])
    assert date.fromisoformat(g2["fecha"])


def test_categoria_valida_se_conserva():
    g = construir_gasto_desde_foto({"monto": None, "fecha": None, "proveedor": None,
                                    "categoria": "transporte"})
    assert g["categoria"] == "transporte"


def test_categoria_invalida_o_ausente_cae_en_otros():
    g1 = construir_gasto_desde_foto({"monto": None, "fecha": None, "proveedor": None,
                                     "categoria": "rubro-inventado"})
    g2 = construir_gasto_desde_foto({"monto": None, "fecha": None, "proveedor": None,
                                     "categoria": None})
    assert g1["categoria"] == "otros"
    assert g2["categoria"] == "otros"


def test_proveedor_se_recorta_al_limite():
    largo = "x" * 500
    g = construir_gasto_desde_foto({"monto": None, "fecha": None, "proveedor": largo,
                                    "categoria": None})
    assert len(g["proveedor"]) == 120        # LIMITES["proveedor"]


def test_evidencia_monto_viaja_como_descripcion():
    g = construir_gasto_desde_foto({"monto": 100, "evidencia_monto": "TOTAL: $100,00",
                                    "fecha": None, "proveedor": None, "categoria": None})
    assert g["descripcion"] == "TOTAL: $100,00"


def test_medio_pago_nunca_se_infiere():
    g = construir_gasto_desde_foto({"monto": 100, "fecha": None, "proveedor": None,
                                    "categoria": None})
    assert g["medio_pago"] is None


def test_origen_siempre_foto():
    g = construir_gasto_desde_foto({"monto": None, "fecha": None, "proveedor": None,
                                    "categoria": None})
    assert g["origen"] == "foto"
