"""`avanzar_tablero` — la reconciliación (contrato §2.1), con fakes de las 3 dependencias (detector,
silencio, tarjetas). Es la parte más fácil de romper del hito 7: si "cerrar lo resuelto" mirara la
lista YA filtrada por silencio en vez de la CRUDA, un candidato silenciado (sigue siendo verdad,
sólo no toca avisar de nuevo) se leería como "ya no dispara" y cerraría una tarjeta activa por error.
Estos tests existen para que ESE bug, si vuelve, rompa acá y no en producción.
"""
from __future__ import annotations

import mi_dia_orquestador as orq
from mi_dia_detector import (REGLA_FACTURAS_IMPAGAS_VIEJAS, REGLA_PRESUPUESTOS_ENFRIANDOSE,
                             REGLA_TRABAJO_MARGEN_NEGATIVO)


class _AvisosFake:
    def __init__(self, silenciados_por_regla: dict[str, set[str]] | None = None) -> None:
        self._silenciados = silenciados_por_regla or {}
        self.emitidos: list[tuple] = []

    def __call__(self, conn_factory, cliente_id):  # actúa como el constructor
        return self

    def silenciados(self, regla: str) -> set[str]:
        return self._silenciados.get(regla, set())

    def emitir(self, regla, entidad_tipo, entidad_id, *, dias_silencio, datos=None) -> None:
        self.emitidos.append((regla, entidad_tipo, str(entidad_id), dias_silencio))


class _TarjetasFake:
    def __init__(self) -> None:
        self.creadas: list[tuple] = []
        self.cierres: list[tuple[str, frozenset]] = []

    def __call__(self, conn_factory, cliente_id):
        return self

    def crear_si_no_existe(self, regla, entidad_tipo, entidad_id, texto, datos=None) -> None:
        self.creadas.append((regla, entidad_tipo, str(entidad_id), texto))

    def cerrar_resueltas(self, regla: str, vigentes: set[str]) -> int:
        self.cierres.append((regla, frozenset(str(v) for v in vigentes)))
        return 0

    def listar_tablero(self) -> dict:
        return {"para_hoy": [], "haciendo": [], "hecha": []}


def _candidato(regla, entidad_id, **datos):
    return {"regla": regla, "entidad_tipo": "x", "entidad_id": entidad_id,
            "dias_silencio": 14, "datos": datos}


def _correr(monkeypatch, crudos: dict, avisos: _AvisosFake, tarjetas: _TarjetasFake):
    monkeypatch.setattr(orq, "detectar_todos", lambda cf, cid: crudos)
    monkeypatch.setattr(orq, "AvisosEmitidosStore", avisos)
    monkeypatch.setattr(orq, "TarjetaStore", tarjetas)
    return orq.avanzar_tablero(conn_factory=None, cliente_id="cid-A")


def test_candidato_nuevo_no_silenciado_crea_tarjeta_y_emite_silencio(monkeypatch):
    crudos = {REGLA_PRESUPUESTOS_ENFRIANDOSE: [_candidato(REGLA_PRESUPUESTOS_ENFRIANDOSE, 1)],
             REGLA_FACTURAS_IMPAGAS_VIEJAS: [], REGLA_TRABAJO_MARGEN_NEGATIVO: []}
    avisos, tarjetas = _AvisosFake(), _TarjetasFake()
    _correr(monkeypatch, crudos, avisos, tarjetas)
    assert len(tarjetas.creadas) == 1
    assert tarjetas.creadas[0][:3] == (REGLA_PRESUPUESTOS_ENFRIANDOSE, "x", "1")
    assert len(avisos.emitidos) == 1


def test_candidato_silenciado_no_crea_tarjeta_ni_re_emite(monkeypatch):
    crudos = {REGLA_PRESUPUESTOS_ENFRIANDOSE: [_candidato(REGLA_PRESUPUESTOS_ENFRIANDOSE, 1)],
             REGLA_FACTURAS_IMPAGAS_VIEJAS: [], REGLA_TRABAJO_MARGEN_NEGATIVO: []}
    avisos = _AvisosFake({REGLA_PRESUPUESTOS_ENFRIANDOSE: {"1"}})
    tarjetas = _TarjetasFake()
    _correr(monkeypatch, crudos, avisos, tarjetas)
    assert tarjetas.creadas == []
    assert avisos.emitidos == []


def test_reglas_auto_cierre_reciben_la_lista_CRUDA_no_la_filtrada_por_silencio(monkeypatch):
    """🔴 EL test que blinda el bug que ya se evitó una vez: el candidato #1 está silenciado (sigue
    vigente, sólo no toca re-avisar) — `cerrar_resueltas` tiene que recibir igual `{"1"}` como
    vigente, o cerraría una tarjeta que sigue activa."""
    crudos = {REGLA_PRESUPUESTOS_ENFRIANDOSE: [_candidato(REGLA_PRESUPUESTOS_ENFRIANDOSE, 1)],
             REGLA_FACTURAS_IMPAGAS_VIEJAS: [], REGLA_TRABAJO_MARGEN_NEGATIVO: []}
    avisos = _AvisosFake({REGLA_PRESUPUESTOS_ENFRIANDOSE: {"1"}})  # silenciado, PERO sigue en crudos
    tarjetas = _TarjetasFake()
    _correr(monkeypatch, crudos, avisos, tarjetas)
    cierres = dict(tarjetas.cierres)
    assert cierres[REGLA_PRESUPUESTOS_ENFRIANDOSE] == frozenset({"1"})  # NO vacío


def test_candidato_que_desaparece_de_crudos_cierra_su_tarjeta(monkeypatch):
    """El presupuesto #1 ya no aparece (se resolvió) — `cerrar_resueltas` recibe el set vacío para
    esa regla, así la tarjeta #1 (que ya no está en `vigentes`) se cierra."""
    crudos = {REGLA_PRESUPUESTOS_ENFRIANDOSE: [], REGLA_FACTURAS_IMPAGAS_VIEJAS: [],
             REGLA_TRABAJO_MARGEN_NEGATIVO: []}
    avisos, tarjetas = _AvisosFake(), _TarjetasFake()
    _correr(monkeypatch, crudos, avisos, tarjetas)
    cierres = dict(tarjetas.cierres)
    assert cierres[REGLA_PRESUPUESTOS_ENFRIANDOSE] == frozenset()
    assert cierres[REGLA_FACTURAS_IMPAGAS_VIEJAS] == frozenset()


def test_trabajo_con_margen_negativo_nunca_se_reconcilia_por_ausencia(monkeypatch):
    """Contrato §1.bis: es un hecho cerrado, no tiene "acción que lo resuelva" — no está en
    `REGLAS_AUTO_CIERRE`, así que `cerrar_resueltas` no se llama nunca para esta regla."""
    crudos = {REGLA_PRESUPUESTOS_ENFRIANDOSE: [], REGLA_FACTURAS_IMPAGAS_VIEJAS: [],
             REGLA_TRABAJO_MARGEN_NEGATIVO: [_candidato(REGLA_TRABAJO_MARGEN_NEGATIVO, "presupuesto:5")]}
    avisos, tarjetas = _AvisosFake(), _TarjetasFake()
    _correr(monkeypatch, crudos, avisos, tarjetas)
    assert REGLA_TRABAJO_MARGEN_NEGATIVO not in dict(tarjetas.cierres)
    assert len(tarjetas.creadas) == 1


def test_devuelve_el_tablero_ya_actualizado(monkeypatch):
    crudos = {REGLA_PRESUPUESTOS_ENFRIANDOSE: [], REGLA_FACTURAS_IMPAGAS_VIEJAS: [],
             REGLA_TRABAJO_MARGEN_NEGATIVO: []}
    resultado = _correr(monkeypatch, crudos, _AvisosFake(), _TarjetasFake())
    assert resultado == {"para_hoy": [], "haciendo": [], "hecha": []}
