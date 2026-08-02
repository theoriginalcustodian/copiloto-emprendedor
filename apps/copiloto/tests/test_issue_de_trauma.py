"""El escalón que faltaba: pedir ayuda cuando el ciclo NO puede reparar.

Todo con dobles sobre `subprocess.run` — el punto es la LÓGICA (a quién se avisa, cuándo se
duplica, cómo degrada), no ejercitar `gh`. Lo que sí se ejercita de verdad es la forma exacta
de los comandos, porque un `gh issue list` mal armado devolvería vacío SIEMPRE y el resultado
sería un issue por ocurrencia: el instrumento que confirma en vez de verificar.
"""
from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path

import autosanacion_activities as A

TRAUMA = {"id": 7, "fingerprint": "fp-abc123", "error_type": "ConnectionError",
          "costura": "activity_interceptor", "workflow": "CobroWorkflow", "dedupe_count": 4}


class _Gh:
    """Doble de `subprocess.run` que registra los comandos y responde por subcomando."""

    def __init__(self, issues_abiertos: str = "[]", crear_ok: bool = True) -> None:
        self.comandos: list[list[str]] = []
        self._issues = issues_abiertos
        self._crear_ok = crear_ok

    def __call__(self, cmd, **kw):
        self.comandos.append(cmd)
        if cmd[:3] == ["gh", "issue", "list"]:
            return subprocess.CompletedProcess(cmd, 0, stdout=self._issues, stderr="")
        if cmd[:3] == ["gh", "issue", "create"]:
            return subprocess.CompletedProcess(
                cmd, 0 if self._crear_ok else 1,
                stdout="https://github.com/x/y/issues/1\n" if self._crear_ok else "",
                stderr="" if self._crear_ok else "could not add label")
        return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")


def _con_canal(monkeypatch, gh: _Gh, tmp_path: Path) -> None:
    monkeypatch.setattr(A, "_repo_para_pr", lambda: tmp_path)
    monkeypatch.setattr(A, "_hay_gh", lambda: True)
    monkeypatch.setattr(A.subprocess, "run", gh)


def _abrir(trauma=TRAUMA, motivo="categoría 'infra_error': no hay código que reparar acá"):
    return asyncio.run(A.abrir_issue_de_trauma({"trauma": trauma, "motivo": motivo}))


def test_abre_el_issue_cuando_no_hay_ninguno(monkeypatch, tmp_path):
    gh = _Gh(issues_abiertos="[]")
    _con_canal(monkeypatch, gh, tmp_path)
    r = _abrir()
    assert r["abierto"] is True and r["modo"] == "issue"
    creado = [c for c in gh.comandos if c[:3] == ["gh", "issue", "create"]]
    assert len(creado) == 1
    cuerpo = creado[0][creado[0].index("--body") + 1]
    assert "fp-abc123" in cuerpo, "sin el fingerprint en el cuerpo, la búsqueda de duplicados falla"
    assert "ConnectionError" in cuerpo and "CobroWorkflow" in cuerpo


def test_NO_duplica_si_ya_hay_uno_abierto_con_el_mismo_fingerprint(monkeypatch, tmp_path):
    """El mismo bug puede pegar mil veces. Un issue por ocurrencia inundaría el repo y entrenaría
    a ignorar la etiqueta — y ahí se pierde el aviso que importaba."""
    gh = _Gh(issues_abiertos='[{"number": 42}]')
    _con_canal(monkeypatch, gh, tmp_path)
    r = _abrir()
    assert r["abierto"] is False and r["modo"] == "ya_existe"
    assert not [c for c in gh.comandos if c[:3] == ["gh", "issue", "create"]]


def test_CONTROL_la_busqueda_de_duplicados_usa_el_FINGERPRINT(monkeypatch, tmp_path):
    """El control que hace significativo al test de arriba.

    Si la búsqueda no llevara el fingerprint, `gh issue list` devolvería lo mismo para cualquier
    trauma: o nunca duplica (y se pierde el segundo bug) o siempre duplica. Las dos pasarían el
    test anterior según qué devuelva el doble — el veredicto vendría del mock, no del código.
    """
    gh = _Gh()
    _con_canal(monkeypatch, gh, tmp_path)
    _abrir()
    listado = next(c for c in gh.comandos if c[:3] == ["gh", "issue", "list"])
    assert "fp-abc123" in listado
    assert "--state" in listado and listado[listado.index("--state") + 1] == "open"


def test_sin_canal_degrada_y_NO_lanza(monkeypatch, tmp_path):
    """Perder el trauma porque no se pudo avisar sería el peor resultado: el aviso es un extra
    sobre la fila de la DLQ, no un reemplazo."""
    monkeypatch.setattr(A, "_repo_para_pr", lambda: None)
    assert _abrir()["modo"] == "sin_canal"

    monkeypatch.setattr(A, "_repo_para_pr", lambda: tmp_path)
    monkeypatch.setattr(A, "_hay_gh", lambda: False)
    assert _abrir()["modo"] == "sin_canal"


def test_un_trauma_SIN_fingerprint_no_abre_nada(monkeypatch, tmp_path):
    """Sin fingerprint no hay idempotencia posible: abriría un issue por cada corrida, para
    siempre. Mejor no avisar que inundar — el trauma sigue en la DLQ igual."""
    _con_canal(monkeypatch, _Gh(), tmp_path)
    assert _abrir(trauma={**TRAUMA, "fingerprint": None})["modo"] == "sin_canal"


def test_si_la_ETIQUETA_no_existe_igual_abre_el_issue(monkeypatch, tmp_path):
    """Perder el aviso por una label que nadie creó en el repo sería absurdo: se reintenta sin ella."""
    gh = _Gh(crear_ok=False)
    _con_canal(monkeypatch, gh, tmp_path)
    _abrir()
    creados = [c for c in gh.comandos if c[:3] == ["gh", "issue", "create"]]
    assert len(creados) == 2, "tiene que reintentar sin --label"
    assert "--label" in creados[0] and "--label" not in creados[1]
