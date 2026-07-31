"""S4 — ¿puede una activity del VPS invocar al forjador y al auditor? Credenciales, latencia y costo.

**El supuesto que valida.** La Fase 3 asume que el worker puede llamar a `gpt-4o-mini` (forjador) y
`gpt-4o` (auditor) desde adentro de una activity. Si las credenciales no están, la red está cerrada, o
la latencia hace inviable un ciclo, la Fase 3 no existe como está diseñada.

**Lo que mide, sin adornos:** que ambos modelos respondan, cuánto tardan y cuántos tokens cuestan —
el costo es dato de diseño, no curiosidad ([[el-modelo-barato-cobra-17x-tokens-de-imagen]]: un modelo
"barato" cobró 17× por no mirar el consumo real).

**Control incluido:** un modelo inexistente TIENE que fallar. Si "todo responde", incluso lo que no
existe, lo que mido es mi propio mock y no la API.

Uso (en el VPS):  set -a; . /etc/unreal-copilot/copiloto.env; set +a; /opt/uc-copiloto-venv/bin/python spike.py
"""
from __future__ import annotations

import os
import sys
import time

from openai import OpenAI

FORJADOR = "gpt-4o-mini"
AUDITOR = "gpt-4o"

PROMPT = (
    "Respondé UNA sola palabra en mayúsculas: si este diff arregla un bug de división por cero, "
    "respondé OK; si no, respondé NO.\n\n"
    "--- a/calc.py\n+++ b/calc.py\n@@\n-    return a / b\n+    if b == 0:\n"
    "+        raise ValueError('divisor cero')\n+    return a / b\n"
)


def probar(client: OpenAI, modelo: str) -> tuple[bool, str]:
    t0 = time.monotonic()
    try:
        r = client.chat.completions.create(
            model=modelo,
            messages=[{"role": "user", "content": PROMPT}],
            max_tokens=10,
            temperature=0,
        )
    except Exception as exc:  # noqa: BLE001 — el fallo ES el dato en el control negativo
        return False, f"{type(exc).__name__}: {str(exc)[:110]}"
    ms = (time.monotonic() - t0) * 1000
    u = r.usage
    texto = (r.choices[0].message.content or "").strip()
    return True, (f"{texto!r} · {ms:.0f} ms · in={u.prompt_tokens} out={u.completion_tokens} "
                  f"total={u.total_tokens}")


def main() -> int:
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        print("S4 FALLA: no hay OPENAI_API_KEY en el entorno del worker.")
        return 1
    print(f"key presente (…{key[-4:]}), longitud {len(key)}")
    client = OpenAI(api_key=key)

    resultados = {}
    for rol, modelo in (("forjador", FORJADOR), ("auditor", AUDITOR)):
        ok, detalle = probar(client, modelo)
        resultados[rol] = ok
        print(f"  {rol:9s} {modelo:14s} → {'OK ' if ok else 'ERROR'} {detalle}")

    # CONTROL NEGATIVO: si esto "funciona", no estoy hablando con la API real.
    ok_falso, detalle_falso = probar(client, "gpt-modelo-que-no-existe-9x")
    print(f"  {'CONTROL':9s} {'inexistente':14s} → {'OK (MALO)' if ok_falso else 'ERROR (bien)'} {detalle_falso}")

    if ok_falso:
        print("\nVEREDICTO INVALIDO: un modelo inexistente respondio. No estoy midiendo la API real.")
        return 2
    if not all(resultados.values()):
        print("\nS4 FALLA: algun modelo no responde desde el worker.")
        return 1
    print("\nS4 PASA: forjador y auditor son invocables desde el VPS, y el control negativo falla.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
