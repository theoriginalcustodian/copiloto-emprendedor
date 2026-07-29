"""Item 1.4 — que un `except` mudo NUEVO rompa el CI.

`scripts/censo-except.py` mide cuántos handlers tragan un error sin dejar rastro ni depositar nada.
Medirlo una vez sirvió para reorientar la fase; lo que impide que el número vuelva a subir es este
guard, que convierte el censo en una **aserción re-ejecutable** (patrón `ES_CATALOG.yaml` de ARCA).

**Por qué un baseline y no cero:** los 29 handlers `evapora + mudo` que existen hoy fueron leídos uno
por uno y ninguno resultó un fallo evaporado vivo — son parseos con fallback, formateo cosmético y
degradaciones deliberadas. Exigir cero obligaría a "arreglar" código que está bien, y un guard que
pide algo absurdo se termina desactivando ([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]).
Lo que sí es inaceptable es que el número **suba** sin que nadie lo note.

**Y el otro lado, que suele faltar:** si el número BAJA, el baseline también falla — así se obliga a
bajarlo en el mismo commit que hizo el trabajo. Un baseline que sólo mira hacia arriba se convierte
en un techo que nadie recorta nunca.
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

import pytest

_RAIZ = pathlib.Path(__file__).resolve().parents[3]
_CENSO = _RAIZ / "scripts" / "censo-except.py"

#: Medido el 2026-07-28 con `python scripts/censo-except.py`. Los 29 fueron leídos a mano y
#: clasificados: best-effort legítimo o conversión a error de negocio visible. Cero fallos
#: evaporados vivos. Si tocás uno y el número cambia, actualizá ESTA constante en el mismo commit,
#: con el porqué en el mensaje.
BASELINE_EVAPORA_MUDO = 29


def _correr_censo() -> dict:
    if not _CENSO.exists():
        pytest.skip(f"no está {_CENSO} (checkout parcial)")
    salida = subprocess.run(
        [sys.executable, str(_CENSO)], cwd=_RAIZ, capture_output=True, text=True,
        encoding="utf-8", errors="replace",
    )
    assert salida.returncode == 0, f"el censo falló:\n{salida.stderr}"
    return _parsear(salida.stdout)


def _parsear(texto: str) -> dict:
    """Extrae la tabla `destino documentado mudo` de la salida del censo."""
    conteos: dict[str, dict[str, int]] = {}
    for linea in texto.splitlines():
        partes = linea.split()
        if len(partes) == 3 and partes[0] in {"relanza", "deposita", "solo_log", "informa", "evapora"}:
            conteos[partes[0]] = {"documentado": int(partes[1]), "mudo": int(partes[2])}
    assert conteos, f"no se pudo parsear la salida del censo:\n{texto[:400]}"
    return conteos


def test_el_censo_corre_y_devuelve_datos():
    """CONTROL POSITIVO del instrumento: si el censo se rompe y devuelve vacío, los tests de abajo
    pasarían por comparar nada contra nada."""
    conteos = _correr_censo()
    assert set(conteos) >= {"evapora", "relanza"}, f"censo incompleto: {conteos}"
    total = sum(v["documentado"] + v["mudo"] for v in conteos.values())
    assert total > 100, f"el censo halló sólo {total} handlers: el instrumento está roto, no el repo"


def test_ningun_except_mudo_NUEVO():
    """Un `except` que traga sin dejar rastro y sin explicar por qué no entra sin que se vea."""
    actual = _correr_censo()["evapora"]["mudo"]
    assert actual <= BASELINE_EVAPORA_MUDO, (
        f"aparecieron {actual - BASELINE_EVAPORA_MUDO} handlers `evapora + mudo` nuevos "
        f"({actual} vs baseline {BASELINE_EVAPORA_MUDO}).\n"
        f"Corré `python scripts/censo-except.py` y mirá la cola. Un `except` que traga un error debe: "
        f"(a) dejar rastro con `log_error`, (b) convertirlo en algo que el usuario vea, o "
        f"(c) llevar un comentario que explique por qué degradar ahí es correcto.")


def test_si_BAJA_hay_que_bajar_el_baseline_en_el_mismo_commit():
    """Sin esto, el baseline se vuelve un techo que nadie recorta y el guard deja de apretar."""
    actual = _correr_censo()["evapora"]["mudo"]
    assert actual >= BASELINE_EVAPORA_MUDO, (
        f"bajaron a {actual} (baseline {BASELINE_EVAPORA_MUDO}) — buen trabajo: actualizá "
        f"BASELINE_EVAPORA_MUDO a {actual} en este mismo commit para no perder el terreno ganado.")
