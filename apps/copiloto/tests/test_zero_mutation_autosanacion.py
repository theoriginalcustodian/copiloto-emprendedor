"""Zero-Mutation: el ciclo PROPONE y nunca mergea. La pieza 4 del reparto del 2026-08-03.

El comportamiento ya estaba implementado y documentado (`proponer_pr_de_reparacion`, §Zero-Mutation).
Lo que faltaba es esto: **un test hostil que lo ejercite**. Un control que el código declara pero
ningún test adversarial prueba es indistinguible de uno ausente — el happy-path pasa igual si el
control no existe, y con un ciclo que hoy sólo procesa su propio canario, el fallo no daría síntoma
hasta que un día abriera un merge sobre `main`.

Precedente que hace esto no-teórico (documentado en `_repo_para_pr`, hallazgo del 2026-07-31): antes
del primer E2E real, `_abrir_pr` corría `git checkout -b` sobre **el repo del servicio vivo**. No
explotó por un accidente —`/opt/uc-repos/copiloto` no es un repo git, así que el checkout fallaba—,
no porque algo lo impidiera. Este archivo convierte ese "no explotó de casualidad" en "no puede".
"""
from __future__ import annotations

import asyncio
import inspect
import re
import subprocess
from pathlib import Path

import autosanacion_activities as A

#: Lo que un ciclo de auto-reparación NUNCA puede ejecutar. No es una lista de "comandos peligrosos"
#: en general: es la lista de los que **integran** cambios sin que un humano los mire.
PROHIBIDOS = (
    ("gh", "pr", "merge"),
    ("git", "merge"),
    ("git", "rebase"),
    ("gh", "pr", "review", "--approve"),
)

TRAUMA = {"id": 7, "fingerprint": "fp-abc", "error_type": "ValueError",
          "workflow": "CobroWorkflow", "dedupe_count": 2}
FORJA = {"archivo": "apps/copiloto/x.py", "contenido": "print('x')  # parchado\n", "test": None}


def _es_prohibido(cmd) -> tuple | None:
    """¿`cmd` es uno de los comandos que integran sin revisión humana?

    Normaliza `git -C <ruta> <resto>` a `git <resto>` ANTES de buscar: el ciclo siempre invoca git
    con `-C`, así que sin esta normalización ningún `git merge` real se detectaría nunca — el
    `-C <ruta>` se interpone entre `git` y `merge`, y el bug se descubrió con el propio control
    positivo de este archivo, no leyendo el código.
    """
    if not isinstance(cmd, (list, tuple)):
        return None
    partes = [str(x) for x in cmd]
    if len(partes) >= 3 and partes[0] == "git" and partes[1] == "-C":
        partes = ["git", *partes[3:]]
    for p in PROHIBIDOS:
        for i in range(len(partes)):
            if tuple(partes[i:i + len(p)]) == p:
                return p
    return None


class _Espia:
    """Doble de `subprocess.run` que registra TODO y responde lo mínimo para que el flujo avance."""

    def __init__(self) -> None:
        self.comandos: list[list[str]] = []

    def __call__(self, cmd, **kw):
        self.comandos.append(list(cmd) if isinstance(cmd, (list, tuple)) else [str(cmd)])
        partes = [str(x) for x in cmd] if isinstance(cmd, (list, tuple)) else []
        # `git diff --cached --quiet` con returncode 1 = "hay cambios staged" → el flujo sigue.
        if "diff" in partes and "--quiet" in partes:
            return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="")
        salida = "https://github.com/x/y/pull/1\n" if "create" in partes else ""
        return subprocess.CompletedProcess(cmd, 0, stdout=salida, stderr="")


def _correr(monkeypatch, tmp_path: Path) -> _Espia:
    """Arma el caso donde el ciclo SÍ tiene algo que proponer — el que ejercita el camino del PR.

    Dos árboles, no uno: `_raiz_repo` es "el código tal cual está hoy" (con el contenido VIEJO, para
    que la comparación de `proponer_pr_de_reparacion` vea una mutación real); `_repo_para_pr` es el
    clon de trabajo donde `_abrir_pr` escribe el parche. Confundirlos haría que el archivo ya
    estuviera "parchado" antes de comparar, y el ciclo degradaría a `sin_cambios` sin tocar git —
    exactamente el fallo que tuvo la primera versión de este test.
    """
    prod = tmp_path / "prod"
    work = tmp_path / "work"
    (prod / "apps" / "copiloto").mkdir(parents=True)
    (prod / "apps" / "copiloto" / "x.py").write_text("print('x')  # original\n", encoding="utf-8")
    work.mkdir()

    espia = _Espia()
    monkeypatch.setattr(A, "_raiz_repo", prod)
    monkeypatch.setattr(A, "_repo_para_pr", lambda: work)
    monkeypatch.setattr(A, "_hay_gh", lambda: True)
    monkeypatch.setattr(A.subprocess, "run", espia)
    asyncio.run(A.proponer_pr_de_reparacion({"forja": FORJA, "trauma": TRAUMA}))
    return espia


# ── El invariante, sobre el camino REAL ───────────────────────────────────────────────────────────

def test_INVARIANTE_el_ciclo_nunca_ejecuta_un_comando_que_integre(monkeypatch, tmp_path):
    espia = _correr(monkeypatch, tmp_path)
    assert espia.comandos, "control: si no se ejecutó ningún comando, el test no midió nada"
    for cmd in espia.comandos:
        p = _es_prohibido(cmd)
        assert p is None, f"el ciclo ejecutó {' '.join(p)}: {cmd}"


def test_CONTROL_POSITIVO_el_detector_caza_un_merge_inyectado():
    """Sin esto, el test de arriba pasaría igual con un detector que devuelve siempre `None` — el
    veredicto vendría del detector, no del código ([[instrumentos-que-confirman-en-vez-de-verificar]])."""
    assert _es_prohibido(["gh", "pr", "merge", "42"]) == ("gh", "pr", "merge")
    assert _es_prohibido(["git", "-C", "/tmp/x", "merge", "origin/main"]) == ("git", "merge")
    assert _es_prohibido(["gh", "pr", "create", "--title", "x"]) is None


def test_el_push_va_SIEMPRE_a_una_rama_propia_del_ciclo_nunca_a_main(monkeypatch, tmp_path):
    """`push --force-with-lease` es destructivo por definición. Lo único que hoy impide que arrase
    `main` es que la rama se construya con prefijo: si alguien parametrizara `rama`, el mismo comando
    pasaría a ser un force-push sobre producción sin cambiar una línea del push."""
    espia = _correr(monkeypatch, tmp_path)
    pushes = [c for c in espia.comandos if "push" in c]
    assert pushes, "control: sin push, este test no mide nada"
    for cmd in pushes:
        destino = cmd[-1] if cmd[-1] != "--quiet" else cmd[-2]
        assert destino.startswith("autosanacion/"), f"push a rama no propia del ciclo: {cmd}"
        assert destino != "main", f"push a main: {cmd}"


def test_la_rama_SIEMPRE_lleva_el_prefijo_del_ciclo():
    """Guard de fuente: el prefijo es lo que hace inofensivo al `--force-with-lease` de arriba."""
    fuente = inspect.getsource(A)
    m = re.search(r'rama\s*=\s*f?"([^"]*)"', fuente)
    assert m, "no se encontró la construcción de la rama — ¿se renombró?"
    assert m.group(1).startswith("autosanacion/"), (
        f"la rama del ciclo ya no lleva prefijo propio: {m.group(1)!r}")


def test_el_modulo_no_MENCIONA_ningun_comando_de_integracion(monkeypatch):
    """Complemento estático del invariante dinámico: el test de arriba sólo ve las ramas que el
    happy-path recorre. Éste ve el módulo entero, incluidos caminos que ningún test ejercita todavía.
    """
    fuente = inspect.getsource(A)
    # Se buscan como comandos, no como palabras: 'merge' aparece legítimamente en prosa
    # ("propone y nunca mergea", "--force-with-lease"), y prohibir la palabra sería un guard que
    # grita en el caso normal y termina desactivado.
    for patron in (r'"pr"\s*,\s*"merge"', r'"merge"\s*,\s*"--', r'"git"\s*,\s*"merge"'):
        assert not re.search(patron, fuente), f"aparece un comando de integración: {patron}"


def test_sin_repo_declarado_NO_toca_ningun_repo(monkeypatch, tmp_path):
    """El default es `None` a propósito: un proceso automático ramificando sobre el repo del servicio
    vivo es exactamente lo que Zero-Mutation existe para impedir (hallazgo 2026-07-31)."""
    prod = tmp_path / "prod"
    (prod / "apps" / "copiloto").mkdir(parents=True)
    (prod / "apps" / "copiloto" / "x.py").write_text("print('x')  # original\n", encoding="utf-8")

    espia = _Espia()
    monkeypatch.setattr(A, "_raiz_repo", prod)
    monkeypatch.setattr(A, "_repo_para_pr", lambda: None)
    monkeypatch.setattr(A.subprocess, "run", espia)
    r = asyncio.run(A.proponer_pr_de_reparacion({"forja": FORJA, "trauma": TRAUMA}))
    assert not [c for c in espia.comandos if c and c[0] in ("git", "gh")], (
        f"sin repo declarado no se puede tocar git/gh: {espia.comandos}")
    assert r.get("modo") != "pr", "sin repo no puede reportar que abrió un PR"
