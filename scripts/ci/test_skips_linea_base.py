"""Tests de `skips_linea_base.py` (SM-N58) contra un junit REAL generado por pytest, no uno escrito a mano:
si el formato del junit cambiara (nodeid, `type` del skip), un fixture a mano seguiría verde y el gate
dejaría de ver skips en silencio.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).with_name("skips_linea_base.py")

SUITE = '''
import pytest

def test_corre():
    assert True

@pytest.mark.skip(reason="requiere CREDENCIAL_DE_TERCERO")
def test_saltado():
    pass

@pytest.mark.xfail(reason="se espera que falle")
def test_xfail():
    assert False
'''


def _junit(tmp_path: Path) -> Path:
    (tmp_path / "test_mini.py").write_text(SUITE, encoding="utf-8")
    junit = tmp_path / "junit.xml"
    subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", str(tmp_path / "test_mini.py"),
                    f"--junitxml={junit}"], cwd=tmp_path, check=False, capture_output=True)
    assert junit.exists()
    return junit


def _correr(junit: Path, base: Path, *extra: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, "-I", "-X", "utf8", str(SCRIPT), str(junit), str(base), *extra],
                          capture_output=True, text=True, encoding="utf-8")


def _nodeid_del_skip(junit: Path) -> str:
    sys.path.insert(0, str(SCRIPT.parent))
    try:
        from skips_linea_base import leer_skips
    finally:
        sys.path.pop(0)
    skips, _, _ = leer_skips(junit)
    assert len(skips) == 1, skips  # el xfail NO cuenta como skip
    return next(iter(skips))


def test_un_skip_DECLARADO_da_verde_y_el_conteo_sale_igual(tmp_path):
    junit = _junit(tmp_path)
    base = tmp_path / "base.txt"
    base.write_text(f"# comentario\n{_nodeid_del_skip(junit)}  # tercero · motivo\n", encoding="utf-8")
    r = _correr(junit, base)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "SKIPS: 1 saltados de 3" in r.stdout
    assert "NUEVOS: 0" in r.stdout
    assert "xfail: 1" in r.stdout


def test_CONTROL_un_skip_NO_declarado_hace_fallar_y_se_nombra(tmp_path):
    """El control positivo: sin esto, un script que siempre saliera 0 pasaría el test de arriba."""
    junit = _junit(tmp_path)
    base = tmp_path / "base.txt"
    base.write_text("# vacía\n", encoding="utf-8")
    r = _correr(junit, base)
    assert r.returncode == 1
    assert "NUEVOS: 1" in r.stdout
    assert "test_saltado" in r.stdout and "CREDENCIAL_DE_TERCERO" in r.stdout


def test_solo_informar_imprime_el_conteo_pero_no_falla(tmp_path):
    junit = _junit(tmp_path)
    base = tmp_path / "base.txt"
    base.write_text("", encoding="utf-8")
    r = _correr(junit, base, "--solo-informar")
    assert r.returncode == 0
    assert "NUEVOS: 1" in r.stdout


def test_un_declarado_que_no_ocurre_se_informa_y_no_falla(tmp_path):
    junit = _junit(tmp_path)
    base = tmp_path / "base.txt"
    base.write_text(f"{_nodeid_del_skip(junit)}\ntests.test_otro::test_que_ya_corre\n", encoding="utf-8")
    r = _correr(junit, base)
    assert r.returncode == 0
    assert "declarados que no ocurrieron: 1" in r.stdout


def test_un_junit_ILEGIBLE_no_es_cero_skips(tmp_path):
    roto = tmp_path / "roto.xml"
    roto.write_text("<testsuites><testcase", encoding="utf-8")
    base = tmp_path / "base.txt"
    base.write_text("", encoding="utf-8")
    assert _correr(roto, base).returncode == 2
    assert _correr(tmp_path / "no-existe.xml", base).returncode == 2


def test_un_junit_SIN_testcases_no_es_cero_skips(tmp_path):
    vacio = tmp_path / "vacio.xml"
    vacio.write_text("<testsuites><testsuite name='pytest'/></testsuites>", encoding="utf-8")
    base = tmp_path / "base.txt"
    base.write_text("", encoding="utf-8")
    assert _correr(vacio, base).returncode == 2
