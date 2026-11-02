#!/usr/bin/env python3
"""Helpers de adb para medir pantallas en el teléfono (relevamiento mapa ↔ app).

Uso:  python -I -X utf8 scripts/device/adb_helpers.py <cmd> [args]
  cap <archivo.png>            captura de pantalla (screencap + pull)
  tap <x> <y>                  toque en px
  swipe <x1> <y1> <x2> <y2> [ms]
  hold <x> <y> <seg>           mantiene apretado (DOWN … UP), para el mic sostenido
  slide <x> <y> <dx_dp> [seg]  mantiene y desliza hacia la izquierda (dx en DP, positivo)
  text "<texto sin espacios raros>"
  key <KEYCODE>                p. ej. KEYCODE_BACK
  deeplink <ruta>              abre copiloto:///<ruta>

POR QUÉ `slide` recibe DP y no px: el umbral de cancelar (`UMBRAL_CANCELAR_PX = 70`,
BotonVoz.tsx) está en dp y `translationX` del Pan cuenta desde la activación (~10 dp);
`adb motionevent` mueve en px. En 720x1600 / 390 dp, 1 dp = 1,846 px: pedí ≥ 85 dp para
cancelar (memoria `adb-no-puede-ejercitar-el-toque-corto-de-un-gesture-pan`).

Todo con `MSYS_NO_PATHCONV=1` y `timeout`: el servidor adb se cuelga a veces
(si pasa: matar adb.exe y `adb start-server`). Serial por env `ADB_SERIAL` (default RF8T318RN9T).
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

SERIAL = os.environ.get("ADB_SERIAL", "RF8T318RN9T")
ANCHO_PX, ANCHO_DP = 720, 390
PX_POR_DP = ANCHO_PX / ANCHO_DP  # 1,846
ENV = {**os.environ, "MSYS_NO_PATHCONV": "1"}


def adb(*args: str, timeout: int = 20, binary: bool = False):
    cmd = ["adb", "-s", SERIAL, *args]
    r = subprocess.run(cmd, capture_output=True, timeout=timeout, env=ENV)
    if r.returncode != 0:
        raise SystemExit(f"adb falló ({r.returncode}): {r.stderr.decode(errors='replace')[:300]}")
    return r.stdout if binary else r.stdout.decode(errors="replace")


def cap(destino: str) -> None:
    data = adb("exec-out", "screencap", "-p", binary=True)
    with open(destino, "wb") as f:
        f.write(data)
    print(f"{destino} ({len(data)} bytes)")


def tap(x: int, y: int) -> None:
    adb("shell", "input", "tap", str(x), str(y))


def swipe(x1: int, y1: int, x2: int, y2: int, ms: int = 300) -> None:
    adb("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(ms))


def _motion(accion: str, x: int, y: int) -> None:
    adb("shell", "input", "motionevent", accion, str(x), str(y))


def hold(x: int, y: int, seg: float) -> None:
    _motion("DOWN", x, y)
    time.sleep(seg)
    _motion("UP", x, y)


def slide(x: int, y: int, dx_dp: float, seg: float = 1.5) -> None:
    """DOWN, ~13 MOVE hacia la izquierda de `dx_dp` dp (+10 dp de activación), pausa y UP."""
    total_px = int((dx_dp + 10) * PX_POR_DP)
    pasos = 13
    _motion("DOWN", x, y)
    time.sleep(0.4)
    for i in range(1, pasos + 1):
        _motion("MOVE", x - total_px * i // pasos, y)
        time.sleep(0.12)
    time.sleep(seg)  # acá se captura «Soltá para cancelar»
    _motion("UP", x - total_px, y)


def main(argv: list[str]) -> None:
    if len(argv) < 2:
        raise SystemExit(__doc__)
    c, a = argv[1], argv[2:]
    if c == "cap":
        cap(a[0])
    elif c == "tap":
        tap(int(a[0]), int(a[1]))
    elif c == "swipe":
        swipe(*(int(v) for v in a[:4]), *(int(v) for v in a[4:5]))
    elif c == "hold":
        hold(int(a[0]), int(a[1]), float(a[2]))
    elif c == "slide":
        slide(int(a[0]), int(a[1]), float(a[2]), *(float(v) for v in a[3:4]))
    elif c == "text":
        adb("shell", "input", "text", a[0].replace(" ", "%s"))
    elif c == "key":
        adb("shell", "input", "keyevent", a[0])
    elif c == "deeplink":
        adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", f"copiloto:///{a[0]}")
    else:
        raise SystemExit(f"comando desconocido: {c}\n{__doc__}")


if __name__ == "__main__":
    main(sys.argv)
