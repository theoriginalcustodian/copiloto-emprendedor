"""E2E contra prod: el audio SIN VOZ no llega al agente como «Gracias.» (defensa A+B, 2026-11-05).

Manda a `POST /transcribir` (con `e2e-device@copiloto.test`, nunca otra cuenta) tres clips generados acá, sin
dependencias de audio: silencio puro, hiss estacionario y un tono. Los tres tienen que dar **422 «no se entendió el
audio»**. Antes del fix daban `200 {"transcript":"Gracias."}` (medido 6/6 el 2026-11-05).

CONTROL POSITIVO opcional: `--voz <wav>` (por ejemplo una frase con TTS SAPI, ver `scripts/voz-device-tts.ps1`) tiene
que dar 200 con texto. Sin control positivo el verde de arriba no distingue «el guard anda» de «el guard rechaza todo».

Uso:  UC_ENV_E2E_PATH=<ruta al .env.e2e> python scripts/e2e_silencio_stt.py [--voz frase.wav]
Sale 0 sólo si todos los casos dan lo esperado.
"""
from __future__ import annotations

import io
import math
import random
import struct
import sys
import wave
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from e2e_g6_durabilidad_worker_restart import BASE, login  # noqa: E402

N = 16000 * 5


def _wav(muestra) -> bytes:
    b = io.BytesIO()
    with wave.open(b, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b"".join(struct.pack("<h", max(-32768, min(32767, int(muestra(i))))) for i in range(N)))
    return b.getvalue()


def _transcribir(token: str, wav: bytes) -> tuple[int, str]:
    r = requests.post(f"{BASE}/transcribir", headers={"Authorization": f"Bearer {token}"},
                      data={"contexto": "factura"}, files={"audio": ("clip.wav", wav, "audio/wav")}, timeout=60)
    return r.status_code, r.text[:160]


def main() -> int:
    token = login()
    rnd = random.Random(1)
    casos = {
        "silencio puro": _wav(lambda i: 0),
        "hiss estacionario": _wav(lambda i: rnd.gauss(0, 100)),
        "tono 440 Hz": _wav(lambda i: 3000 * math.sin(2 * math.pi * 440 * i / 16000)),
    }
    fallas = 0
    for nombre, wav in casos.items():
        for intento in range(2):
            codigo, cuerpo = _transcribir(token, wav)
            ok = codigo == 422 and "no se entendió el audio" in cuerpo
            fallas += not ok
            print(f"{'OK   ' if ok else 'FALLA'} {nombre} #{intento}: {codigo} {cuerpo}")
    if "--voz" in sys.argv:
        ruta = Path(sys.argv[sys.argv.index("--voz") + 1])
        codigo, cuerpo = _transcribir(token, ruta.read_bytes())
        ok = codigo == 200 and len(cuerpo) > len('{"transcript":""}') + 3
        fallas += not ok
        print(f"{'OK   ' if ok else 'FALLA'} CONTROL POSITIVO voz {ruta.name}: {codigo} {cuerpo}")
    else:
        print("AVISO sin --voz: no hay control positivo, el verde no prueba que la voz real siga pasando")
    return 1 if fallas else 0


if __name__ == "__main__":
    sys.exit(main())
