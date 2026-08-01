"""El gate de tests decide si un parche del ciclo de autosanación entra o se descarta.

Casi todo acá es lógica pura (parseo y dictamen), así que corre sin Postgres, sin VPS y sin lanzar
pytest de verdad — el subproceso se inyecta. Eso importa: un gate que sólo se puede probar corriendo
la suite entera no se prueba nunca.
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

from sandbox_tests import (SUBARBOLES, Resultado, Resumen, correr_suite, evaluar, parsear_resumen,
                           preparar_copia, nodeids_fallados)

VERDE = "=" * 20 + " 1364 passed, 16 skipped in 35.20s " + "=" * 20
ROJO = "FAILED tests/test_x.py::test_a - AssertionError\n" + "=" * 8 + " 2 failed, 10 passed in 1.2s " + "=" * 8


def _res(salida: str, rc: int = 0, expiro: bool = False) -> Resultado:
    return Resultado(resumen=parsear_resumen(salida), rc=rc, salida=salida, expiro=expiro)


# ======================================================================================
# Parseo del resumen
# ======================================================================================
def test_lee_pasaron_y_saltados():
    r = parsear_resumen(VERDE)
    assert (r.pasaron, r.saltados, r.fallaron) == (1364, 16, 0)
    assert r.verde is True


def test_lee_los_fallados():
    r = parsear_resumen(ROJO)
    assert (r.pasaron, r.fallaron) == (10, 2)
    assert r.verde is False


def test_CONTROL_una_suite_sin_conteos_NO_es_verde():
    """El control que evita que este parser sea un instrumento que confirma: si pytest revienta antes
    de correr nada (import roto, path mal), no hay línea de resumen. Devolver `verde=True` ahí
    aprobaría cualquier parche que rompa la colección."""
    assert parsear_resumen("").verde is False
    assert parsear_resumen("ImportError: no module named x").verde is False


def test_cero_tests_corridos_NO_es_verde():
    """`0 tests` con exit 0 pasa si el filtro no matcheó nada. Verde sin haber mirado nada es el
    modo de fallo más peligroso: no protesta."""
    assert Resumen(pasaron=0, saltados=99).verde is False


def test_toma_la_ULTIMA_linea_con_conteos_no_la_primera():
    """El cuerpo de la salida puede mencionar números («3 passed» dentro de un traceback citado).
    El epílogo es el que manda."""
    salida = "algo dijo 99 passed por ahí\n...\n=== 5 passed, 1 skipped in 2s ==="
    assert parsear_resumen(salida).pasaron == 5


def test_los_errores_de_coleccion_cuentan_como_rojo():
    assert parsear_resumen("=== 3 errors, 5 passed in 1s ===").verde is False


# ======================================================================================
# Qué tests fallaron (para el feedback localizado al forjador)
# ======================================================================================
def test_lista_los_nodeids_sin_repetir_y_en_orden():
    salida = ("FAILED tests/a.py::test_1 - X\nFAILED tests/b.py::test_2 - Y\n"
              "FAILED tests/a.py::test_1 - X\nERROR tests/c.py::test_3\n")
    assert nodeids_fallados(salida) == ("tests/a.py::test_1", "tests/b.py::test_2", "tests/c.py::test_3")


def test_CONTROL_una_salida_verde_no_lista_ninguno():
    assert nodeids_fallados(VERDE) == ()


# ======================================================================================
# El dictamen — la regla del BASELINE
# ======================================================================================
def test_baseline_ROJO_da_NO_EVALUABLE_no_rechazo():
    """La regla que evita culpar al parche por un rojo ajeno. Si la suite ya estaba rota, el gate no
    puede afirmar NADA sobre el parche — ni a favor ni en contra. Rechazarlo sería atribuirle un
    fallo que no causó, y descartaría parches buenos para siempre mientras el repo esté rojo."""
    v = evaluar(baseline=_res(ROJO), parcheado=_res(VERDE))
    assert v.aceptado is False
    assert "NO_EVALUABLE" in v.motivo and "ya estaba roja" in v.motivo


def test_CERO_RECOLECTADOS_no_se_reporta_como_suite_ROJA():
    """Dos causas opuestas no pueden dar el mismo mensaje.

    El primer E2E real (2026-08-01) devolvió *"la suite ya estaba roja SIN el parche (0 fallaron, 0
    errores)"* — una frase que **se contradice sola** y que mandó la investigación a buscar un rojo
    inexistente. La verdad era otra: pytest ni arrancó (`python3` sin pytest, y encima la colección
    cortaba por un subárbol faltante), así que no hubo ninguna línea de conteo.

    "Estaba roja" y "no llegó a correr" piden arreglos distintos: uno mira los tests, el otro mira el
    intérprete y el PYTHONPATH."""
    v = evaluar(baseline=_res("no se colectó nada"), parcheado=_res(VERDE))
    assert v.aceptado is False
    assert "NINGÚN test" in v.motivo and "no llegó a ejecutarse" in v.motivo
    assert "ya estaba roja" not in v.motivo


def test_el_sandbox_lleva_deploy_worker_o_la_suite_NO_COLECTA(tmp_path):
    """`tests/test_provision.py` y `tests/test_mp_tables.py` importan `provision_tables`, que vive en
    `deploy/worker`. Sin ese subárbol pytest corta la colección y corren **cero** tests — y un gate
    de no-regresión sobre cero tests aprueba cualquier cosa o rechaza todo, según cómo se lea.

    Medido en el VPS: 0 recolectados sin `deploy/worker`, **1277 passed** con él."""
    assert "deploy/worker" in SUBARBOLES

    origen = tmp_path / "origen"
    (origen / "apps" / "copiloto").mkdir(parents=True)
    (origen / "motor").mkdir()
    (origen / "deploy" / "worker").mkdir(parents=True)
    (origen / "deploy" / "worker" / "provision_tables.py").write_text("ok = 1", encoding="utf-8")

    copia = preparar_copia(origen, tmp_path / "copia")
    assert (copia / "deploy" / "worker" / "provision_tables.py").exists()


def test_el_PYTHONPATH_del_sandbox_incluye_deploy_worker(tmp_path):
    """Copiarlo no alcanza: si no está en el `PYTHONPATH`, el import falla igual."""
    visto = {}

    def _espia(cmd, **kw):  # noqa: ANN001, ANN003, ANN202
        visto.update(kw)
        return type("P", (), {"returncode": 0, "stdout": VERDE, "stderr": ""})()

    copia = tmp_path / "copia"
    (copia / "apps" / "copiloto").mkdir(parents=True)
    correr_suite(copia, python="python3", ejecutor=_espia)
    rutas = visto["env"]["PYTHONPATH"].split(os.pathsep)
    assert str(copia / "deploy" / "worker") in rutas, f"faltó deploy/worker en {rutas}"


def test_baseline_verde_y_parche_verde_ACEPTA():
    v = evaluar(baseline=_res(VERDE), parcheado=_res(VERDE))
    assert v.aceptado is True and "ACEPTADO" in v.motivo


def test_baseline_verde_y_parche_rojo_RECHAZA_con_las_regresiones():
    """El caso que justifica todo el módulo: el parche aplicó limpio y dejó la suite roja (medido
    1 de 12 corridas). El motivo tiene que traer QUÉ se rompió, no sólo que se rompió — feedback
    localizado baja regresiones ~70% frente a «corré los tests»."""
    v = evaluar(baseline=_res(VERDE), parcheado=_res(ROJO))
    assert v.aceptado is False and "RECHAZADO" in v.motivo
    assert v.regresiones == ("tests/test_x.py::test_a",)


def test_un_test_que_YA_fallaba_no_se_reporta_como_regresion():
    """Control del test anterior: sin esto, `regresiones` sería sólo «los que fallan ahora» y
    culparía al parche de lo que ya venía roto."""
    baseline = _res("FAILED tests/viejo.py::test_v - X\n=== 1 failed, 9 passed in 1s ===")
    parcheado = _res("FAILED tests/viejo.py::test_v - X\nFAILED tests/nuevo.py::test_n - Y\n"
                     "=== 2 failed, 8 passed in 1s ===")
    v = evaluar(baseline=baseline, parcheado=parcheado)
    # baseline rojo ⇒ NO_EVALUABLE; lo que se verifica es que el diff no invente regresiones viejas
    assert "tests/viejo.py::test_v" not in v.regresiones


def test_verde_con_MENOS_tests_que_el_baseline_se_RECHAZA():
    """El agujero que un gate ingenuo deja abierto: un parche que rompe un import de test hace
    desaparecer media suite, y lo que queda pasa. «Todo verde» con la mitad de los tests borrados
    se lee como éxito y es exactamente lo contrario."""
    v = evaluar(baseline=_res("=== 100 passed in 5s ==="), parcheado=_res("=== 40 passed in 2s ==="))
    assert v.aceptado is False and "MENOS tests" in v.motivo


def test_timeout_con_el_parche_se_distingue_de_un_rojo_comun():
    v = evaluar(baseline=_res(VERDE), parcheado=Resultado(Resumen(), rc=-1, salida="", expiro=True))
    assert v.aceptado is False and "cuelga" in v.motivo


def test_timeout_en_el_BASELINE_es_no_evaluable():
    v = evaluar(baseline=Resultado(Resumen(), rc=-1, salida="", expiro=True), parcheado=_res(VERDE))
    assert v.aceptado is False and "NO_EVALUABLE" in v.motivo


# ======================================================================================
# El subproceso — la regla de METR
# ======================================================================================
def test_pytest_se_lanza_como_SUBPROCESO_y_no_in_process(tmp_path):
    """La regla 1 del módulo: el evaluado no puede compartir proceso con el evaluador. Se verifica
    que el comando invocado sea `<python> -m pytest`, no una llamada a `pytest.main()`."""
    visto = {}

    def espia(cmd, **kw):
        visto["cmd"] = cmd
        visto["cwd"] = kw.get("cwd")
        visto["env"] = kw.get("env")
        return subprocess.CompletedProcess(cmd, 0, stdout=VERDE, stderr="")

    (tmp_path / "apps" / "copiloto").mkdir(parents=True)
    r = correr_suite(tmp_path, python="/opt/venv/bin/python", ejecutor=espia)

    assert visto["cmd"][:3] == ["/opt/venv/bin/python", "-m", "pytest"]
    assert r.resumen.pasaron == 1364


def test_el_sandbox_NUNCA_hereda_DATABASE_URL(tmp_path, monkeypatch):
    """Si heredara la env del worker, la suite del gate escribiría en la base VIVA de producción.
    El ciclo propone parches; no puede tocar datos de nadie."""
    monkeypatch.setenv("DATABASE_URL", "postgres://prod/copiloto")
    visto = {}

    def espia(cmd, **kw):
        visto["env"] = kw.get("env")
        return subprocess.CompletedProcess(cmd, 0, stdout=VERDE, stderr="")

    (tmp_path / "apps" / "copiloto").mkdir(parents=True)
    correr_suite(tmp_path, python="python", ejecutor=espia)
    assert "DATABASE_URL" not in visto["env"]


def test_el_sandbox_NO_hereda_NINGUNA_credencial_de_servicio_externo(tmp_path, monkeypatch):
    """El gate corre la suite DOS VECES por cada intento de parche. Si hereda las credenciales del
    worker, los tests de integración real se activan — y `test_gmail::test_send_real_y_readback`
    **manda un mail de verdad**.

    Medido el 2026-08-01, la primera vez que el gate corrió tests de verdad: 5 rojos en el baseline
    (`test_docs`, `test_drive`, `test_gmail`, `test_sheets`, `test_selection_qa`), todos tests que en
    el dev-loop y el CI se saltan solos porque ahí no hay credenciales. No-deterministas y con
    efectos afuera: las dos cosas que un gate de no-regresión no puede tener."""
    visto = {}

    def _espia(cmd, **kw):  # noqa: ANN001, ANN003, ANN202
        visto.update(kw)
        return type("P", (), {"returncode": 0, "stdout": VERDE, "stderr": ""})()

    for var in ("DATABASE_URL", "OPENAI_API_KEY", "COMPOSIO_API_KEY", "GROQ_API_KEY",
                "COPILOTO_COMPOSIO_USER_ID", "COPILOTO_CLIENTE_ID", "GRAPHITY_API_KEY",
                "GRAPHITY_BASE_URL", "MP_ACCESS_TOKEN", "AFIP_PASSWORD"):
        monkeypatch.setenv(var, "valor-que-no-debe-viajar")

    copia = tmp_path / "copia"
    (copia / "apps" / "copiloto").mkdir(parents=True)
    correr_suite(copia, python="python3", ejecutor=_espia)

    filtradas = [v for v in visto["env"] if "valor-que-no-debe-viajar" == visto["env"][v]]
    assert filtradas == [], f"el sandbox heredó credenciales: {filtradas}"


def test_CONTROL_el_sandbox_SI_conserva_el_entorno_que_pytest_necesita(tmp_path, monkeypatch):
    """EL CONTROL del de arriba: vaciar el entorno entero también lo haría pasar, y dejaría a pytest
    sin `PATH` ni `HOME`. Se tapa lo que apunta afuera, no todo."""
    visto = {}

    def _espia(cmd, **kw):  # noqa: ANN001, ANN003, ANN202
        visto.update(kw)
        return type("P", (), {"returncode": 0, "stdout": VERDE, "stderr": ""})()

    monkeypatch.setenv("PATH", "/usr/bin")
    monkeypatch.setenv("HOME", "/home/alguien")
    copia = tmp_path / "copia"
    (copia / "apps" / "copiloto").mkdir(parents=True)
    correr_suite(copia, python="python3", ejecutor=_espia)

    assert visto["env"]["PATH"] == "/usr/bin"
    assert visto["env"]["HOME"] == "/home/alguien"
    assert "PYTHONPATH" in visto["env"]


def test_una_base_EFIMERA_explicita_si_puede_pasarse(tmp_path, monkeypatch):
    """Control del test anterior: sin esto, un `pop` mal puesto que borrara TODO el env pasaría
    igual, y el gate quedaría sin poder correr nunca los tests contra Postgres."""
    monkeypatch.setenv("DATABASE_URL", "postgres://prod/copiloto")
    visto = {}

    def espia(cmd, **kw):
        visto["env"] = kw.get("env")
        return subprocess.CompletedProcess(cmd, 0, stdout=VERDE, stderr="")

    (tmp_path / "apps" / "copiloto").mkdir(parents=True)
    correr_suite(tmp_path, python="python",
                 env_extra={"DATABASE_URL": "postgres://efimera/test"}, ejecutor=espia)
    assert visto["env"]["DATABASE_URL"] == "postgres://efimera/test"


def test_el_timeout_se_reporta_como_expiro_no_como_rojo(tmp_path):
    def cuelga(cmd, **kw):
        raise subprocess.TimeoutExpired(cmd, 600)

    (tmp_path / "apps" / "copiloto").mkdir(parents=True)
    r = correr_suite(tmp_path, python="python", ejecutor=cuelga)
    assert r.expiro is True and r.resumen.verde is False


# ======================================================================================
# La copia
# ======================================================================================
def test_la_copia_trae_el_codigo_y_deja_afuera_la_basura(tmp_path):
    origen = tmp_path / "origen"
    (origen / "apps" / "copiloto" / "__pycache__").mkdir(parents=True)
    (origen / "apps" / "copiloto" / "serve.py").write_text("x = 1", encoding="utf-8")
    (origen / "apps" / "copiloto" / "__pycache__" / "a.pyc").write_text("basura", encoding="utf-8")
    (origen / "motor").mkdir()
    (origen / "motor" / "m.py").write_text("y = 2", encoding="utf-8")
    (origen / "deploy" / "worker").mkdir(parents=True)
    (origen / "deploy" / "worker" / "provision_tables.py").write_text("z = 3", encoding="utf-8")

    destino = preparar_copia(origen, tmp_path / "copia")
    assert (destino / "apps" / "copiloto" / "serve.py").read_text(encoding="utf-8") == "x = 1"
    assert (destino / "motor" / "m.py").exists()
    assert not (destino / "apps" / "copiloto" / "__pycache__").exists()


def test_la_copia_es_IDEMPOTENTE(tmp_path):
    """Se corre una vez por parche; si dejara restos, el parche N vería archivos del parche N-1."""
    origen = tmp_path / "origen"
    (origen / "apps" / "copiloto").mkdir(parents=True)
    (origen / "motor").mkdir()
    (origen / "deploy" / "worker").mkdir(parents=True)
    destino = preparar_copia(origen, tmp_path / "copia")
    (destino / "sobra.txt").write_text("resto viejo", encoding="utf-8")
    preparar_copia(origen, tmp_path / "copia")
    assert not (destino / "sobra.txt").exists()


def test_un_origen_SIN_los_subarboles_falla_ruidoso(tmp_path):
    """Apuntar al árbol equivocado tiene que reventar acá y no producir un sandbox vacío que después
    reporte «0 tests, todo bien»."""
    (tmp_path / "origen").mkdir()
    with pytest.raises(FileNotFoundError):
        preparar_copia(tmp_path / "origen", tmp_path / "copia")
