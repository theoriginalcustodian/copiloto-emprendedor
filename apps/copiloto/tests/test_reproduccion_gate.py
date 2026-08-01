"""El gate que distingue *arregla* de *no rompe* — el test de reproducción.

POR QUÉ EXISTE. El PR #179 fue el primero que el ciclo abrió solo: CI 5/5, `mergeState: CLEAN`, y un
parche **semánticamente equivalente al original**. Un no-op no rompe nada, así que la no-regresión lo
aprueba con honores. La única forma de separar las dos cosas es un test que **falle sin el parche y
pase con él**, corrido las dos veces.

Lo que se cuida acá, y que es fácil de perder de vista: las fallas del **instrumento** (el test no
corre, o no reproduce) NO pueden rechazar el parche. Si un forjador flojo escribiendo tests pudiera
tumbar parches correctos, el ciclo se apagaría solo — y un mecanismo que falla hacia el "no" no da
síntoma ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]). Sólo `parche_no_arregla` rechaza.
"""
from __future__ import annotations

import sys
import textwrap
from pathlib import Path

import pytest

from forjador_parches import extraer_test
from sandbox_tests import (DEMOSTRADO, NO_ARREGLA, NO_REPRODUCE, TEST_INVALIDO, Resultado, Resumen,
                           evaluar_reproduccion, nombre_de_test_de_reproduccion)


def _resultado(*, corridos: int, fallaron: int = 0, errores: int = 0, expiro: bool = False,
               salida: str = "") -> Resultado:
    """Una corrida sintética. `verde` lo deriva `Resumen`, no se fuerza a mano."""
    return Resultado(
        resumen=Resumen(pasaron=corridos - fallaron - errores, fallaron=fallaron, errores=errores),
        rc=0 if not (fallaron or errores) else 1, salida=salida, expiro=expiro)


# ============================================================== la decisión (pura)

def test_falla_sin_el_parche_y_pasa_con_el_es_lo_UNICO_que_demuestra_un_arreglo():
    d = evaluar_reproduccion(_resultado(corridos=1, fallaron=1), _resultado(corridos=1))

    assert d.estado == DEMOSTRADO
    assert d.demostrado is True
    assert d.rechaza is False


def test_el_test_que_PASA_sin_el_parche_no_prueba_nada_y_NO_rechaza_el_parche():
    """Es el caso del PR #179. El test no ejercita el bug, así que no puede demostrar el arreglo —
    pero tampoco es culpa del parche: se descarta el test y se sigue por no-regresión."""
    d = evaluar_reproduccion(_resultado(corridos=1), _resultado(corridos=1))

    assert d.estado == NO_REPRODUCE
    assert d.demostrado is False
    assert d.rechaza is False, "un test malo no puede tumbar un parche: apagaría el ciclo"


def test_el_test_que_SIGUE_fallando_con_el_parche_SI_rechaza():
    """El único rechazo de esta vía, y el que le da sentido a todo: el parche no arregla el bug."""
    d = evaluar_reproduccion(_resultado(corridos=1, fallaron=1), _resultado(corridos=1, fallaron=1))

    assert d.estado == NO_ARREGLA
    assert d.rechaza is True
    assert d.demostrado is False


def test_cero_recolectados_es_TEST_INVALIDO_no_es_que_no_reproduzca():
    """Dos causas opuestas que desde afuera se ven igual (en ninguna hay un rojo). Confundirlas
    manda a corregir el prompt del forjador cuando el problema es un import roto."""
    d = evaluar_reproduccion(_resultado(corridos=0, salida="ImportError: no module named x"),
                             _resultado(corridos=1))

    assert d.estado == TEST_INVALIDO
    assert d.rechaza is False
    assert "no corre" in d.motivo


def test_si_el_test_corre_sin_parche_pero_NO_con_el_el_parche_rompio_el_import():
    """Cero recolectados *después* de parchear no es "no arregla": es que el módulo ya no importa.
    La no-regresión lo va a cazar igual, pero el motivo tiene que apuntar al lugar correcto."""
    d = evaluar_reproduccion(_resultado(corridos=1, fallaron=1), _resultado(corridos=0))

    assert d.estado == TEST_INVALIDO
    assert "import" in d.motivo


def test_un_test_que_se_cuelga_no_sirve_como_instrumento():
    d = evaluar_reproduccion(_resultado(corridos=0, expiro=True), _resultado(corridos=1))

    assert d.estado == TEST_INVALIDO
    assert d.rechaza is False


# ============================================================== el nombre y la extracción

def test_el_nombre_del_test_lo_pone_el_CICLO_y_viene_saneado():
    """Un path elegido por el LLM puede salirse del árbol o pisar un test existente, y este archivo
    termina commiteado en un repo real."""
    assert nombre_de_test_de_reproduccion({"id": 42}) == "test_repro_trauma_42.py"

    sucio = nombre_de_test_de_reproduccion({"id": "../../etc/passwd"})
    assert "/" not in sucio and ".." not in sucio.replace(".py", "")


def test_el_nombre_es_DETERMINISTA_para_que_un_reintento_reescriba_su_archivo():
    assert nombre_de_test_de_reproduccion({"id": 7}) == nombre_de_test_de_reproduccion({"id": 7})


def test_extraer_test_devuelve_None_cuando_el_modelo_se_ABSTIENE():
    """El prompt pide explícitamente no inventar un test si no se puede escribir uno que falle hoy.
    Esa abstención es información honesta, no un fallo — y tiene que poder expresarse."""
    solo_parche = "<<<<<<< SEARCH\na\n=======\nb\n>>>>>>> REPLACE"

    assert extraer_test(solo_parche) is None


def test_extraer_test_saca_el_contenido_sin_los_marcadores():
    texto = ("<<<<<<< SEARCH\na\n=======\nb\n>>>>>>> REPLACE\n"
             "<<<<<<< TEST\ndef test_x():\n    assert False\n>>>>>>> FIN TEST")

    contenido = extraer_test(texto)

    assert contenido == "def test_x():\n    assert False"
    assert "TEST" not in contenido


# ============================================================== pytest DE VERDAD, no un doble

@pytest.fixture()
def arbolito(tmp_path: Path) -> Path:
    """Un sandbox de juguete con la MISMA forma que el real (`apps/copiloto/tests`).

    Se usa pytest de verdad en subproceso, no un `ejecutor` inyectado: lo que puede fallar acá es
    justamente la mecánica —el cwd, el PYTHONPATH, que el archivo se escriba donde pytest lo busca—
    y un doble no ejercita nada de eso.
    """
    cwd = tmp_path / "apps" / "copiloto"
    (cwd / "tests").mkdir(parents=True)
    (tmp_path / "motor").mkdir()
    (tmp_path / "deploy" / "worker").mkdir(parents=True)
    (cwd / "modulo_con_bug.py").write_text(
        textwrap.dedent("""
            def dividir(a, b):
                return a / b          # BUG: no contempla b == 0
        """).strip() + "\n", encoding="utf-8")
    return tmp_path


PARCHE_QUE_ARREGLA = textwrap.dedent("""
    def dividir(a, b):
        if b == 0:
            return 0
        return a / b
""").strip() + "\n"

TEST_QUE_REPRODUCE = textwrap.dedent("""
    from modulo_con_bug import dividir

    def test_dividir_por_cero_no_explota():
        assert dividir(1, 0) == 0
""").strip() + "\n"


def _correr(arbolito: Path, forja: dict, trauma: dict) -> dict:
    import autosanacion_activities as A

    destino = arbolito / "apps" / "copiloto" / "modulo_con_bug.py"
    return A._probar_reproduccion(arbolito, sys.executable, forja, trauma,
                                  contenido_original=destino.read_text(encoding="utf-8"),
                                  destino=destino)


def test_REAL_un_parche_que_arregla_queda_DEMOSTRADO_corriendo_pytest_de_verdad(arbolito: Path):
    """El camino feliz completo: escribe el test, corre sin parche (rojo), corre con parche (verde)."""
    resultado = _correr(arbolito,
                        {"archivo": "modulo_con_bug.py", "contenido": PARCHE_QUE_ARREGLA,
                         "test_reproduccion": TEST_QUE_REPRODUCE},
                        {"id": 1})

    assert resultado["estado"] == DEMOSTRADO, resultado["motivo"]
    assert resultado["demostrado"] is True


def test_REAL_un_parche_NO_OP_no_llega_a_demostrado_aunque_la_suite_quede_verde(arbolito: Path):
    """El caso del PR #179, reproducido: un cambio que no altera la semántica. El test de
    reproducción sigue fallando con el parche → `parche_no_arregla`, y ESO sí rechaza."""
    no_op = textwrap.dedent("""
        def dividir(a, b):
            resultado = a / b     # renombrar una variable no arregla nada
            return resultado
    """).strip() + "\n"

    resultado = _correr(arbolito,
                        {"archivo": "modulo_con_bug.py", "contenido": no_op,
                         "test_reproduccion": TEST_QUE_REPRODUCE},
                        {"id": 2})

    assert resultado["estado"] == NO_ARREGLA, resultado["motivo"]
    assert resultado["rechaza"] is True


def test_REAL_la_copia_queda_como_estaba_para_que_la_no_regresion_no_herede_el_parche(arbolito: Path):
    """Si `_probar_reproduccion` dejara el archivo parcheado, el `baseline` de la no-regresión se
    correría YA parcheado y el gate compararía el parche contra sí mismo — verde garantizado."""
    destino = arbolito / "apps" / "copiloto" / "modulo_con_bug.py"
    antes = destino.read_text(encoding="utf-8")

    _correr(arbolito, {"archivo": "modulo_con_bug.py", "contenido": PARCHE_QUE_ARREGLA,
                       "test_reproduccion": TEST_QUE_REPRODUCE}, {"id": 3})

    assert destino.read_text(encoding="utf-8") == antes


def test_REAL_el_test_de_reproduccion_NO_queda_en_la_copia(arbolito: Path):
    """La no-regresión que corre después descubre los tests POR DIRECTORIO.

    Si el archivo se quedara ahí, un test de reproducción inválido (import roto, sintaxis) pondría
    roja la suite parcheada y el parche se rechazaría por culpa del **instrumento** — exactamente lo
    que los cinco desenlaces existen para impedir. Y uno válido tampoco puede quedarse: falla en el
    baseline por diseño, que es su razón de ser, y dejaría el gate en `NO_EVALUABLE` para siempre.
    """
    _correr(arbolito, {"archivo": "modulo_con_bug.py", "contenido": PARCHE_QUE_ARREGLA,
                       "test_reproduccion": TEST_QUE_REPRODUCE}, {"id": 4})

    quedaron = list((arbolito / "apps" / "copiloto" / "tests").glob("test_repro_*.py"))

    assert quedaron == [], f"el test de reproducción quedó en la copia: {quedaron}"
