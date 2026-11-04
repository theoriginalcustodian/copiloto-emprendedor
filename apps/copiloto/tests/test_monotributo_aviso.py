"""SM-N37 -- aviso proactivo al acercarse al tope de monotributo.

Tres modos de falla que NO dan síntoma y por eso tienen test propio:
  1. disparar con `tope == null` (un «estás al X %» contra un tope desconocido es un número inventado);
  2. avisar en cada corrida del detector (ruido: se aprende a ignorarlo);
  3. avisar UNA vez en la vida: si el % baja del umbral y vuelve a cruzar, no avisar nunca más.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import date
from decimal import Decimal

import pytest

import escala_monotributo as em
import mi_dia_detector as det
import mi_dia_orquestador as orq
from mi_dia_detector import AvisosEmitidosStore, _evaluar_monotributo_cerca_del_limite as evaluar

REGLA = det.REGLA_MONOTRIBUTO_CERCA_DEL_LIMITE
TOPES = {c: str(1_000_000 * (i + 1)) for i, c in enumerate(em.CATEGORIAS)}   # sintéticos: NO son cifras de ARCA
ESCALA = {"vigencia_desde": "2026-08-01", "vigencia_hasta": "2027-01-31",
          "fuente": "https://example.test/escala-de-prueba", "topes": TOPES}
HOY = date(2026, 11, 3)


def _config(tmp_path, aviso_pct=80, escalas=None):
    p = tmp_path / "escala.json"
    p.write_text(json.dumps({"umbrales": {"amarillo_pct": 80, "rojo_pct": 95, "aviso_pct": aviso_pct},
                             "escalas": [ESCALA] if escalas is None else escalas}), encoding="utf-8")
    return em.cargar(p)


# --- la regla pura -----------------------------------------------------------------------------------------

def test_bajo_el_umbral_no_dispara(tmp_path):
    assert evaluar("A", Decimal("799000.00"), _config(tmp_path), HOY) == []      # 79,9 %


def test_el_umbral_se_compara_contra_el_porcentaje_que_MUESTRA_la_pantalla(tmp_path):
    """79,9999 % se muestra como 80,0 % (1 decimal, `medidor`): avisar ahí es coherente con la pantalla; no
    avisar dejaría un medidor que dice 80,0 % sin aviso."""
    assert evaluar("A", Decimal("799999.00"), _config(tmp_path), HOY) != []


def test_en_el_umbral_o_encima_dispara_con_la_forma_que_consume_el_orquestador(tmp_path):
    [c] = evaluar("A", Decimal("800000.00"), _config(tmp_path), HOY)
    assert c["regla"] == REGLA and c["entidad_tipo"] == "monotributo"
    assert c["entidad_id"] == "A:2026-08-01"
    assert c["dias_silencio"] is None            # silencio para siempre: se libera al BAJAR, no por reloj
    assert c["datos"] == {"categoria": "A", "porcentaje": 80.0, "tope": "1000000.00",
                          "facturado": "800000.00", "semaforo": "amarillo"}


def test_el_umbral_es_config_no_codigo(tmp_path):
    assert evaluar("A", Decimal("500000"), _config(tmp_path, aviso_pct=50), HOY) != []
    assert evaluar("A", Decimal("500000"), _config(tmp_path, aviso_pct=51), HOY) == []


def test_pasar_de_amarillo_a_rojo_es_el_MISMO_cruce_misma_entidad(tmp_path):
    cfg = _config(tmp_path)
    amarillo = evaluar("A", Decimal("850000"), cfg, HOY)[0]
    rojo = evaluar("A", Decimal("990000"), cfg, HOY)[0]
    assert amarillo["entidad_id"] == rojo["entidad_id"]       # no re-avisa por subir de color


@pytest.mark.parametrize("caso", ["sin_categoria", "sin_escala", "escala_vencida", "escala_futura", "categoria_basura"])
def test_NUNCA_dispara_con_tope_null_aunque_lo_facturado_sea_enorme(tmp_path, caso):
    """El control adversarial: $999.999.999 facturados y aun así NO avisa si no hay tope contra qué medir."""
    cfg = _config(tmp_path, escalas=[] if caso == "sin_escala" else None)
    categoria = {"sin_categoria": None, "categoria_basura": "Z"}.get(caso, "A")
    hoy = {"escala_vencida": date(2027, 2, 1), "escala_futura": date(2026, 7, 31)}.get(caso, HOY)
    assert evaluar(categoria, Decimal("999999999"), cfg, hoy) == []


def test_otra_categoria_o_escala_nueva_es_otra_situacion_avisa_de_nuevo(tmp_path):
    cfg = _config(tmp_path)
    assert evaluar("A", Decimal("900000"), cfg, HOY)[0]["entidad_id"] != \
        evaluar("B", Decimal("1800000"), cfg, HOY)[0]["entidad_id"]


# --- el orquestador: UNA vez por cruce, y re-arma al bajar -------------------------------------------------

class _Tarjetas:
    def __init__(self):
        self.creadas, self.cierres = [], []

    def __call__(self, conn_factory, cliente_id):
        return self

    def crear_si_no_existe(self, regla, entidad_tipo, entidad_id, texto, datos=None):
        self.creadas.append((regla, str(entidad_id), texto))

    def cerrar_resueltas(self, regla, vigentes):
        self.cierres.append((regla, frozenset(vigentes)))
        return 0

    def listar_tablero(self):
        return {"para_hoy": [], "haciendo": [], "hecha": []}


class _AvisosEnMemoria:
    """Mismo contrato que `AvisosEmitidosStore`, en memoria: aísla la lógica del orquestador."""
    def __init__(self):
        self.silencio = set()

    def __call__(self, conn_factory, cliente_id):
        return self

    def silenciados(self, regla):
        return {e for r, e in self.silencio if r == regla}

    def emitir(self, regla, entidad_tipo, entidad_id, *, dias_silencio, datos=None):
        self.silencio.add((regla, str(entidad_id)))

    def liberar_ausentes(self, regla, vigentes):
        self.silencio = {(r, e) for r, e in self.silencio if r != regla or e in vigentes}
        return 0


def _corrida(monkeypatch, avisos, tarjetas, candidatos):
    crudos = {REGLA: candidatos}
    monkeypatch.setattr(orq, "detectar_todos", lambda cf, cid, **kw: crudos)
    monkeypatch.setattr(orq, "AvisosEmitidosStore", avisos)
    monkeypatch.setattr(orq, "TarjetaStore", tarjetas)
    orq.avanzar_tablero(None, "cid-A")


def _cand(tmp_path, doce):
    return evaluar("A", Decimal(doce), _config(tmp_path), HOY)


def test_una_vez_por_cruce_y_si_el_porcentaje_baja_y_vuelve_a_cruzar_AVISA_DE_NUEVO(monkeypatch, tmp_path):
    avisos, tarjetas = _AvisosEnMemoria(), _Tarjetas()
    _corrida(monkeypatch, avisos, tarjetas, _cand(tmp_path, "850000"))     # cruza 80 %: avisa
    assert len(tarjetas.creadas) == 1
    _corrida(monkeypatch, avisos, tarjetas, _cand(tmp_path, "900000"))     # sigue arriba: NO repite
    _corrida(monkeypatch, avisos, tarjetas, _cand(tmp_path, "990000"))     # llega a rojo: tampoco
    assert len(tarjetas.creadas) == 1
    _corrida(monkeypatch, avisos, tarjetas, _cand(tmp_path, "500000"))     # BAJA del umbral: se re-arma
    assert avisos.silencio == set()
    assert tarjetas.cierres[-1] == (REGLA, frozenset())                    # y la tarjeta se cierra por el hecho
    _corrida(monkeypatch, avisos, tarjetas, _cand(tmp_path, "820000"))     # vuelve a cruzar: avisa otra vez
    assert len(tarjetas.creadas) == 2


def test_texto_de_la_tarjeta_dice_la_categoria_y_el_porcentaje(monkeypatch, tmp_path):
    avisos, tarjetas = _AvisosEnMemoria(), _Tarjetas()
    _corrida(monkeypatch, avisos, tarjetas, _cand(tmp_path, "850000"))
    texto = tarjetas.creadas[0][2]
    assert "85.0 %" in texto and "categoría A" in texto


# --- el store contra Postgres REAL (corre en el VPS) -------------------------------------------------------

DATABASE_URL = os.environ.get("DATABASE_URL")
necesita_pg = pytest.mark.skipif(not DATABASE_URL, reason="requiere DATABASE_URL (corre en el VPS)")


@pytest.fixture
def tenants_pg():
    return str(uuid.uuid4()), str(uuid.uuid4())


@pytest.fixture
def limpiar_avisos(conn_de_tenant, tenants_pg):
    yield
    for t in tenants_pg:
        with conn_de_tenant(t)().cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_avisos_emitidos WHERE cliente_id = %s", (t,))


@necesita_pg
def test_pg_liberar_ausentes_re_arma_solo_lo_que_ya_no_esta_vigente(conn_de_tenant, tenants_pg, limpiar_avisos):
    a, _ = tenants_pg
    st = AvisosEmitidosStore(conn_de_tenant(a), a)
    st.emitir(REGLA, "monotributo", "A:2026-08-01", dias_silencio=None)
    st.emitir(REGLA, "monotributo", "B:2026-08-01", dias_silencio=None)
    st.emitir(det.REGLA_CAE_POR_VENCER, "comprobante", "7", dias_silencio=14)      # OTRA regla: no se toca
    assert st.liberar_ausentes(REGLA, {"A:2026-08-01"}) == 1
    assert st.silenciados(REGLA) == {"A:2026-08-01"}
    assert st.silenciados(det.REGLA_CAE_POR_VENCER) == {"7"}
    assert st.liberar_ausentes(REGLA, set()) == 1
    assert st.silenciados(REGLA) == set()


@necesita_pg
def test_pg_ADVERSARIAL_liberar_los_avisos_de_A_no_toca_los_de_B(conn_de_tenant, tenants_pg, limpiar_avisos):
    a, b = tenants_pg
    sa, sb = AvisosEmitidosStore(conn_de_tenant(a), a), AvisosEmitidosStore(conn_de_tenant(b), b)
    sa.emitir(REGLA, "monotributo", "A:2026-08-01", dias_silencio=None)
    sb.emitir(REGLA, "monotributo", "A:2026-08-01", dias_silencio=None)
    sa.liberar_ausentes(REGLA, set())
    assert sa.silenciados(REGLA) == set()
    assert sb.silenciados(REGLA) == {"A:2026-08-01"}      # el de B sigue ahí
