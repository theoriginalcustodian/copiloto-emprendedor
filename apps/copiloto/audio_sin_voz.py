"""Descarte de audio SIN VOZ antes del STT (defensa B del contrato de planificación, 2026-11-05).

**Por qué existe.** Medido en prod el 2026-11-05 (`POST /transcribir`, WAV de silencio puro 5 s, 6/6): el STT
(Whisper) devuelve «Gracias.» cuando no hay voz. No es un flake: Whisper alucina frases de cierre ante audio sin
habla. Ese texto entraba al agente como si el usuario lo hubiera dicho. Peor que un error visible: inventa una
interacción que no ocurrió.

**Qué hace.** Decodifica el clip a PCM 16 kHz mono (ffmpeg, igual que cualquier formato que mande el device:
`audio/mp4`, webm, ogg, wav) y mide DOS cosas, ambas deterministas y sin red:

1. **RMS global** muy bajo → silencio (o casi). Corta el clip mudo sin gastar la llamada al STT.
2. **Dinámica** (p90 / p50 de la energía por cuadro de 20 ms) muy baja → ruido ESTACIONARIO (hiss, zumbido,
   tono): la voz sube y baja sílaba a sílaba, el ruido de fondo no. Medido (2026-11-05, clips sintéticos):
   hiss 1,05 · tono/zumbido 1,01 · ruido rosa 1,35 · voz 2,96. Esto cubre lo que el RMS no ve y lo que
   `no_speech_prob` de Whisper tampoco: sobre hiss/ruido rosa Groq dio `no_speech_prob` 0,03–0,21 con
   «Gracias por ver el video.», o sea que la defensa A sola NO alcanza para ruido real.

**Qué NO hace.** No detecta voz ajena ni música con ritmo (eso lo ve, a veces, `no_speech_prob`: defensa A en
`stt.py`). No es un VAD completo.

**Fail-open ante lo que no puede medir** (ffmpeg ausente, clip ilegible, <10 cuadros): devuelve «hay voz» y
deja decidir al STT. Es deliberado: el modo de falla espejo —rechazar voz real— rompe el dictado, que es el
producto. Pero NO es silencioso: cada caso no medible loguea `audio_sin_voz_no_medible`.

**Umbrales por env** (leídos en cada llamada; 0 desactiva ese criterio; `STT_GUARD_ENERGIA=0` apaga todo = rollback
sin deploy):
- `STT_RMS_MIN` (default 30, escala int16 ±32768 ≈ −60 dBFS): el piso de ruido de un mic real en un cuarto
  silencioso ronda 30–150; por debajo no hay señal que transcribir. Conservador a propósito.
- `STT_DINAMICA_MIN` (default 1,6): entre el ruido estacionario más variable medido (1,35) y la voz (2,96).
  **Calibrado con clips sintéticos y TTS, NO con voz de mic real en ambientes ruidosos**: si rechaza voz real en
  la calle, bajarlo por env, no tocar código.
"""
from __future__ import annotations

import array
import logging
import math
import os
import subprocess
import tempfile
from dataclasses import dataclass

_log = logging.getLogger(__name__)

SAMPLE_RATE = 16000
CUADRO = SAMPLE_RATE // 50        # 20 ms
MIN_CUADROS = 10                  # < 200 ms: no hay base para medir
MAX_SEGUNDOS = 180                # tope de decodificación (el audio ya está acotado a 25 MB por web.py)
TIMEOUT_FFMPEG_S = 15

RMS_MIN_DEFAULT = 30.0
DINAMICA_MIN_DEFAULT = 1.6


@dataclass(frozen=True)
class Medicion:
    rms: float
    dinamica: float
    cuadros: int


def _env_float(nombre: str, default: float) -> float:
    crudo = os.environ.get(nombre)
    if crudo is None or crudo.strip() == "":
        return default
    try:
        return float(crudo)
    except ValueError:
        _log.warning('{"evento": "audio_sin_voz_env_invalido", "var": "%s"}', nombre)
        return default


def medir_pcm(pcm: bytes) -> Medicion | None:
    """RMS global y dinámica de un PCM int16 little-endian mono. `None` si hay menos de `MIN_CUADROS` cuadros."""
    muestras = array.array("h")
    muestras.frombytes(pcm[: len(pcm) - (len(pcm) % 2)])
    if muestras.itemsize != 2:  # pragma: no cover — plataformas raras
        return None
    n_cuadros = len(muestras) // CUADRO
    if n_cuadros < MIN_CUADROS:
        return None
    por_cuadro = []
    total_cuadrados = 0
    for i in range(n_cuadros):
        suma = sum(v * v for v in muestras[i * CUADRO:(i + 1) * CUADRO])
        total_cuadrados += suma
        por_cuadro.append(math.sqrt(suma / CUADRO))
    por_cuadro.sort()
    p50 = por_cuadro[int(0.5 * (n_cuadros - 1))]
    p90 = por_cuadro[int(0.9 * (n_cuadros - 1))]
    return Medicion(rms=math.sqrt(total_cuadrados / (n_cuadros * CUADRO)),
                    dinamica=p90 / max(p50, 1.0), cuadros=n_cuadros)


def decodificar_a_pcm(audio_bytes: bytes, content_type: str = "") -> bytes | None:
    """ffmpeg → PCM 16 kHz mono int16. Por ARCHIVO temporal y no por pipe: un m4a con el `moov` al final (lo que
    graba el device) no se puede leer de un pipe no-seekable. `None` si ffmpeg falla o no está."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".audio", delete=True) as tmp:
            tmp.write(audio_bytes)
            tmp.flush()
            r = subprocess.run(
                ["ffmpeg", "-nostdin", "-v", "error", "-t", str(MAX_SEGUNDOS), "-i", tmp.name,
                 "-f", "s16le", "-ac", "1", "-ar", str(SAMPLE_RATE), "pipe:1"],
                capture_output=True, timeout=TIMEOUT_FFMPEG_S, check=False)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout if r.returncode == 0 and r.stdout else None


def motivo_sin_voz(medicion: Medicion) -> str | None:
    """Pura: el criterio sobre una medición. `None` = parece haber voz."""
    rms_min = _env_float("STT_RMS_MIN", RMS_MIN_DEFAULT)
    dinamica_min = _env_float("STT_DINAMICA_MIN", DINAMICA_MIN_DEFAULT)
    if rms_min > 0 and medicion.rms < rms_min:
        return "silencio"
    if dinamica_min > 0 and medicion.dinamica < dinamica_min:
        return "ruido_estacionario"
    return None


def hay_voz(audio_bytes: bytes, content_type: str = "") -> bool:
    """`False` sólo si se MIDIÓ y no hay voz. Ante lo que no se puede medir, `True` (y se loguea)."""
    if os.environ.get("STT_GUARD_ENERGIA", "1").strip() == "0":
        return True
    pcm = decodificar_a_pcm(audio_bytes, content_type)
    medicion = medir_pcm(pcm) if pcm else None
    if medicion is None:
        _log.warning('{"evento": "audio_sin_voz_no_medible", "content_type": "%s", "bytes": %d}',
                     (content_type or "")[:40], len(audio_bytes))
        return True
    motivo = motivo_sin_voz(medicion)
    if motivo:
        _log.info('{"evento": "audio_sin_voz_descartado", "motivo": "%s", "rms": %.1f, "dinamica": %.2f}',
                  motivo, medicion.rms, medicion.dinamica)
        return False
    return True
