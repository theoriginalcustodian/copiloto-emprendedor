#!/usr/bin/env python3
"""Banco de medición de C0 — ¿12 de 12 corridas del ciclo terminan con parche aceptado?

## Qué mide y qué NO

Mide el **ciclo completo** (`ciclo_autosanacion.reparar`) contra el LLM **real**, sobre un bug
**real**: `fingerprint.py` sin el `& 0xFFFFFFFF`, el mismo caso de S5 donde el forjador de un solo
intento dio **11/12**. No mide una demo armada para salir bien.

Ejercita EXACTAMENTE el código de producción — el mismo `reparar()`, el mismo `aplicar_bloques`, el
mismo `prompt_de_forja`. Si el banco midiera una copia, su 12/12 no diría nada del sistema real.

## Los controles que trae horneados

1. **Control del bug**: antes de pedirle nada al modelo, corre la suite con el bug y **exige que
   falle**. Si el bug no rompe nada, el 12/12 sería trivial —cualquier parche "pasa"— y el banco
   estaría confirmando en vez de midiendo. Aborta con exit 2.
2. **Control del arreglo**: el veredicto de cada corrida NO es el exit code del proceso ni que el
   parche "aplicó": es que la suite **quede verde** corriendo de verdad.
3. **Diferencial de intentos**: reporta en qué intento acertó cada corrida. Un 12/12 logrado siempre
   al 3er intento es un dato distinto de uno logrado al 1º, y el promedio lo escondería.

## Uso

    OPENAI_API_KEY=... python scripts/medir_c0_autosanacion.py [--corridas 12]

Exit 0 sólo si TODAS las corridas terminaron aceptadas. Cualquier otra cosa es exit 1 con el detalle
de cuál falló y por qué — no se redondea a "casi".
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "apps" / "copiloto"))

for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")

from ciclo_autosanacion import reparar  # noqa: E402
from forjador_parches import aplicar_bloques, prompt_de_forja, prompt_de_reintento  # noqa: E402
from sandbox_tests import nodeids_fallados, parsear_resumen  # noqa: E402

#: El bug real de S5: quitar la máscara de 32 bits del fingerprint.
ORIGINAL, ROTO = "& 0xFFFFFFFF", ""
ARCHIVO = "fingerprint.py"
TEST = "test_fingerprint.py"
NO_ROMPER = ("la firma pública de fingerprint_de_error(...) y que dos errores distintos sigan dando "
             "fingerprints distintos")


def _correr_pytest(caja: Path, python: str) -> tuple[int, str]:
    p = subprocess.run([python, "-m", "pytest", TEST, "-q", "-ra"],
                       cwd=str(caja), capture_output=True, text=True, timeout=300)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def _armar_caja(caja: Path) -> str:
    """Deja en `caja` el módulo ROTO y su suite. Devuelve el contenido roto."""
    fuente = (REPO / "apps/copiloto" / ARCHIVO).read_text(encoding="utf-8")
    roto = fuente.replace(ORIGINAL, ROTO)
    if roto == fuente:
        raise SystemExit(f"[c0] ❌ no se pudo introducir el bug ({ORIGINAL!r} no está en {ARCHIVO})")
    (caja / ARCHIVO).write_text(roto, encoding="utf-8")
    (caja / TEST).write_text(
        (REPO / "apps/copiloto/tests" / TEST).read_text(encoding="utf-8"), encoding="utf-8")
    return roto


def una_corrida(client, python: str, numero: int) -> tuple[bool, str, int]:
    """Una corrida completa del ciclo. Devuelve `(exitoso, motivo, intentos)`."""
    with tempfile.TemporaryDirectory() as td:
        caja = Path(td) / "caja"
        caja.mkdir()
        roto = _armar_caja(caja)

        rc, salida_bug = _correr_pytest(caja, python)
        if rc == 0:
            return False, "CONTROL FALLIDO: el bug no rompe la suite — el banco no mide nada", 0

        def forjar(prompt: str) -> str:
            r = client.chat.completions.create(
                model=os.environ.get("COPILOTO_FORJADOR_MODELO", "gpt-4o-mini"),
                messages=[{"role": "user", "content": prompt}], temperature=0)
            return r.choices[0].message.content or ""

        def aplicar(texto: str, contenido: str):
            return aplicar_bloques(texto, contenido)

        def auditar(texto: str, archivo: str) -> tuple[bool, str]:
            from auditor_parches import auditar as _auditar
            v = _auditar(client, texto, f"archivo {archivo}; no romper: {NO_ROMPER}")
            return bool(getattr(v, "aprobado", False)), getattr(v, "motivo", "")

        def probar(contenido: str) -> tuple[bool, str, tuple[str, ...]]:
            """El veredicto es la SUITE VERDE, no que el parche haya aplicado."""
            (caja / ARCHIVO).write_text(contenido, encoding="utf-8")
            rc2, salida2 = _correr_pytest(caja, python)
            resumen = parsear_resumen(salida2)
            if resumen.verde:
                return True, f"ACEPTADO: {resumen.pasaron} pasaron", ()
            # Se restaura el archivo roto: el próximo intento tiene que partir del MISMO estado
            # inicial, no del que dejó el intento fallido. Sin esto, los intentos se apilan y el
            # 2º "arregla" un archivo que el 1º ya modificó — midiendo otra cosa.
            (caja / ARCHIVO).write_text(roto, encoding="utf-8")
            return (False, f"la suite queda roja: {resumen.fallaron} fallaron",
                    nodeids_fallados(salida2))

        r = reparar(archivo=ARCHIVO, contenido=roto, salida_pytest=salida_bug, no_romper=NO_ROMPER,
                    forjar=forjar, aplicar=aplicar, auditar=auditar, probar=probar,
                    prompt_inicial=prompt_de_forja, prompt_reintento=prompt_de_reintento)
        return r.exitoso, r.motivo, r.cantidad_intentos


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corridas", type=int, default=12)
    ap.add_argument("--python", default=sys.executable)
    args = ap.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        print("[c0] ❌ falta OPENAI_API_KEY", file=sys.stderr)
        return 2
    from openai import OpenAI
    client = OpenAI()

    print(f"[c0] midiendo {args.corridas} corridas del ciclo contra el LLM real…\n")
    exitos, detalle = 0, []
    for n in range(1, args.corridas + 1):
        try:
            ok, motivo, intentos = una_corrida(client, args.python, n)
        except Exception as exc:  # noqa: BLE001 — una corrida que revienta es un FALLO, no un skip
            ok, motivo, intentos = False, f"EXCEPCIÓN: {type(exc).__name__}: {exc}", 0
        exitos += int(ok)
        detalle.append((n, ok, intentos, motivo))
        print(f"  corrida {n:>2}: {'✅' if ok else '❌'} intentos={intentos} — {motivo}")

    print(f"\n[c0] RESULTADO: {exitos}/{args.corridas}")
    # El diferencial de intentos: 12/12 siempre al 3er intento es un dato MUY distinto de 12/12 al
    # 1º, y el promedio los haría indistinguibles.
    for i in (1, 2, 3):
        cuantas = sum(1 for _, ok, k, _ in detalle if ok and k == i)
        if cuantas:
            print(f"       aceptados en el intento {i}: {cuantas}")
    if exitos != args.corridas:
        print("\n[c0] ❌ NO se alcanzó el objetivo. Corridas fallidas:", file=sys.stderr)
        for n, ok, k, motivo in detalle:
            if not ok:
                print(f"       corrida {n} (intentos={k}): {motivo}", file=sys.stderr)
        return 1
    print("[c0] ✅ objetivo alcanzado")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
