"""El ciclo con reintento informado — la pieza que persigue el 12/12.

Todo acá corre con dobles: el punto es probar la LÓGICA del reintento (qué feedback viaja, cuándo se
corta, cuándo se rinde) sin gastar un centavo de LLM. La medición contra el modelo real vive aparte,
en el banco de C0 — son dos preguntas distintas y mezclarlas haría que ninguna se conteste bien.
"""
from __future__ import annotations

from dataclasses import dataclass

from ciclo_autosanacion import MAX_INTENTOS, reparar


@dataclass
class _Aplicacion:
    """Mismos nombres de campo que `forjador_parches.Aplicacion` — a propósito. Un doble con nombres
    propios habría dejado pasar el `AttributeError` que reventó las 12 corridas del banco de C0: el
    doble validaba mi suposición en vez del contrato real."""
    ok: bool
    contenido: str
    detalle: str


def _prompt_inicial(**kw) -> str:
    return f"INICIAL::{kw['archivo']}"


def _prompt_reintento(**kw) -> str:
    # Se serializa TODO lo que recibe para poder afirmar qué viajó de verdad al reintento.
    return (f"REINTENTO::previo={kw['intento_previo']}::motivo={kw['motivo_rechazo']}"
            f"::regresiones={list(kw['regresiones'])}")


def _armar(*, forjas, aplica=True, auditor=None, auditores=None, pruebas):
    """Devuelve los callables y un registro de los prompts que recibió el forjador.

    `auditores` es una COLA (una respuesta por intento); `auditor` fija la misma para todos. La cola
    hace falta para el caso «el auditor rechaza el 1º y aprueba el 2º»: con una respuesta fija, el
    ciclo nunca sale del auditor y el test no mide lo que dice medir.
    """
    vistos: list[str] = []
    cola_forjas = list(forjas)
    cola_pruebas = list(pruebas)
    cola_auditores = list(auditores) if auditores is not None else None

    def forjar(prompt: str) -> str:
        vistos.append(prompt)
        return cola_forjas.pop(0)

    def aplicar(texto: str, contenido: str) -> _Aplicacion:
        if aplica:
            return _Aplicacion(True, contenido + f"\n# {texto}", "1 bloque")
        return _Aplicacion(False, contenido, "fragmento no encontrado")

    def auditar(texto: str, archivo: str):
        if cola_auditores is not None:
            return cola_auditores.pop(0)
        return auditor if auditor is not None else (True, "ok")

    def probar(contenido: str):
        return cola_pruebas.pop(0)

    return vistos, dict(forjar=forjar, aplicar=aplicar, auditar=auditar, probar=probar,
                        prompt_inicial=_prompt_inicial, prompt_reintento=_prompt_reintento)


def _correr(**kw):
    return reparar(archivo="fingerprint.py", contenido="x = 1", salida_pytest="FAILED test_a",
                   no_romper="la firma pública", **kw)


# ======================================================================================
# El camino feliz y su control
# ======================================================================================
def test_si_el_primer_intento_pasa_el_gate_NO_hay_reintento():
    """Control positivo de todo el módulo: si el ciclo reintentara siempre, los tests de abajo
    pasarían igual y no estarían midiendo la lógica de corte."""
    vistos, cbs = _armar(forjas=["parche-A"], pruebas=[(True, "ACEPTADO", ())])
    r = _correr(**cbs)
    assert r.exitoso is True and r.cantidad_intentos == 1
    assert vistos == ["INICIAL::fingerprint.py"]


def test_el_2do_intento_ACIERTA_y_el_ciclo_termina_bien():
    """El caso que justifica el módulo entero: el forjador falla 1 de 12 por variabilidad del
    modelo. Con reintento, ese fallo deja de ser un fallo del CICLO — que es el objetivo 12/12."""
    vistos, cbs = _armar(forjas=["malo", "bueno"],
                         pruebas=[(False, "RECHAZADO: rompió cosas", ("tests/a.py::test_1",)),
                                  (True, "ACEPTADO", ())])
    r = _correr(**cbs)
    assert r.exitoso is True and r.cantidad_intentos == 2
    assert r.parche_final == "bueno"


# ======================================================================================
# Qué viaja al reintento — el feedback LOCALIZADO
# ======================================================================================
def test_el_reintento_lleva_el_parche_previo_el_motivo_Y_los_nodeids():
    """Los tres juntos. Sin el parche previo el modelo re-emite el mismo (es su respuesta de máxima
    probabilidad para el mismo input) y el reintento es una tirada idéntica. Sin los nodeids el
    feedback es genérico, que empíricamente AUMENTA las regresiones."""
    vistos, cbs = _armar(forjas=["parche-malo", "parche-bueno"],
                         pruebas=[(False, "rompió 2 tests", ("tests/a.py::test_1", "tests/b.py::test_2")),
                                  (True, "ACEPTADO", ())])
    _correr(**cbs)
    segundo = vistos[1]
    assert "previo=parche-malo" in segundo
    assert "motivo=rompió 2 tests" in segundo
    assert "tests/a.py::test_1" in segundo and "tests/b.py::test_2" in segundo


def test_un_rechazo_del_AUDITOR_viaja_con_su_motivo_no_como_falla_generica():
    """Los tres motivos de rechazo son distintos y accionables distinto. Colapsarlos en «falló»
    perdería justo la información que hace útil al reintento."""
    vistos, cbs = _armar(forjas=["toca-lo-fiscal", "acotado"],
                         auditores=[(False, "toca el dominio fiscal"), (True, "ok")],
                         pruebas=[(True, "ACEPTADO", ())])
    r = _correr(**cbs)
    assert "el auditor lo rechazó: toca el dominio fiscal" in vistos[1]
    # Y el ciclo TERMINA BIEN tras el rechazo del auditor: un veredicto negativo alimenta el
    # reintento, no aborta el ciclo. Sin este assert, el test pasaría con un ciclo que se rinde.
    assert r.exitoso is True and r.cantidad_intentos == 2


def test_un_parche_INAPLICABLE_reintenta_con_el_motivo_del_aplicador():
    vistos, cbs = _armar(forjas=["formato-roto", "formato-roto-2", "formato-roto-3"],
                         aplica=False, pruebas=[])
    r = _correr(**cbs)
    assert r.exitoso is False
    assert "no se pudo aplicar" in vistos[1]


# ======================================================================================
# Cuándo se rinde — el ciclo no puede quemar cuota para siempre
# ======================================================================================
def test_agota_los_intentos_y_se_RINDE_sin_lanzar():
    """Rendirse es un resultado legítimo, no una excepción: si el bug excede al forjador, el trauma
    queda para un humano. Lanzar acá llenaría Temporal de ejecuciones rojas que no son errores."""
    vistos, cbs = _armar(forjas=["a", "b", "c"],
                         pruebas=[(False, "rojo", ()), (False, "rojo", ()), (False, "rojo", ())])
    r = _correr(**cbs)
    assert r.exitoso is False and r.cantidad_intentos == MAX_INTENTOS
    assert "agotados" in r.motivo


def test_NUNCA_forja_mas_veces_que_max_intentos():
    """El tope es de COSTO: cada intento son 2 llamadas al LLM más una corrida de la suite. Un ciclo
    que reintenta sin techo quema la cuota — y ya nos pasó que un 429 matara un workflow en silencio."""
    vistos, cbs = _armar(forjas=["a", "b"], pruebas=[(False, "rojo", ()), (False, "rojo", ())])
    r = reparar(archivo="f.py", contenido="x", salida_pytest="", no_romper="", max_intentos=2, **cbs)
    assert len(vistos) == 2 and r.exitoso is False


def test_el_registro_de_intentos_deja_ver_POR_QUE_fallo_cada_uno():
    """Sin esto, un ciclo que se rinde es una caja negra y nadie puede corregir el prompt."""
    vistos, cbs = _armar(forjas=["a", "b", "c"],
                         pruebas=[(False, "rompió X", ("t::1",)), (False, "rompió Y", ("t::2",)),
                                  (False, "rompió Z", ("t::3",))])
    r = _correr(**cbs)
    assert [i.numero for i in r.intentos] == [1, 2, 3]
    assert r.intentos[0].regresiones == ("t::1",)
    assert all(i.aceptado_gate is False for i in r.intentos)
