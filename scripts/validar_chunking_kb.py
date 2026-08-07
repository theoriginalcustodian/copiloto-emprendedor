#!/usr/bin/env python3
"""validar_chunking_kb.py — gate de chunking para la KB de soporte. Read-only, idempotente.

POR QUÉ EXISTE
--------------
El splitter header-aware de `corpus-kit` (`native_source.split_sections_header_aware`)
**trunca** las secciones que superan `cap`, no las sub-parte:

    return [s[:cap] for s in merged if s.strip()]

Consecuencia medida (2026-08-07, fusion): una sección de 3129 caracteres entra al índice
como UN chunk de 1800 y **se pierden 1328 caracteres (42%) sin ningún aviso**. El documento
figura ingestado, el chunk existe, el contador de chunks sube — y el contenido que sigue
después del carácter 1800 no es recuperable por ninguna consulta. El agente contesta
«no tengo ese dato» sobre información que SÍ está escrita en el documento.

Es un fallo silencioso: no hay excepción, no hay log, no hay diferencia visible entre un
corpus sano y uno truncado. Por eso este gate corre ANTES de ingestar.

Segundo modo de fallo, opuesto y menos obvio: las secciones de menos de `merge_min` (200)
caracteres **se fusionan con la anterior**. Un how-to escrito como 25 pasos cortos termina
en un solo chunk gigante que después el cap trunca. Los dos efectos se componen.

USO
---
    python validar_chunking_kb.py <carpeta-con-los-md>      # valida
    python validar_chunking_kb.py <carpeta> --verbose       # + detalle por sección

Salida: exit 0 si todo pasa, exit 1 si algún documento pierde contenido.
Pensado para correr mientras se escriben los docs, no al final.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# La consola de Windows usa cp1252 y revienta con los emojis del reporte. Reconfigurar acá
# (y no depender de PYTHONIOENCODING) hace que el gate corra igual en las dos máquinas.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, OSError):  # pragma: no cover — stdout redirigido o Python viejo
    pass

# ── Parámetros REALES de fusion (verificados 2026-08-07 contra native_source.py) ──────
MERGE_MIN = 200      # secciones más cortas se fusionan con la anterior
CAP = 1800           # todo lo que pase de acá SE TRUNCA
OBJETIVO_MIN = 400   # zona segura de redacción: margen contra el merge
OBJETIVO_MAX = 1200  # zona segura de redacción: margen contra el cap

_HEADER_RE = re.compile(r"(?m)^(#{1,4}\s.*)$")  # ojo: H5/H6 NO parten


def split_sections_header_aware(doc: str, merge_min: int = MERGE_MIN, cap: int = CAP) -> list[str]:
    """Port verbatim del splitter de corpus-kit. FUENTE DE VERDAD:
    `supabase-mcp-rag-platform/corpus-kit/corpus_kit/sources/native_source.py`.
    Si ese archivo cambia, este port queda desactualizado — está copiado sólo para que este
    validador corra sin instalar corpus-kit del lado del copiloto."""
    parts = _HEADER_RE.split(doc)
    secs: list[str] = []
    pre = parts[0].strip()
    if len(pre) > 40:
        secs.append(pre)
    i = 1
    while i < len(parts):
        head = parts[i]
        body = parts[i + 1] if i + 1 < len(parts) else ""
        secs.append((head + "\n" + body).strip())
        i += 2
    merged: list[str] = []
    for s in secs:
        if merged and len(s) < merge_min:
            merged[-1] = merged[-1] + "\n" + s
        else:
            merged.append(s)
    return [s[:cap] for s in merged if s.strip()]


def _secciones_sin_truncar(doc: str, merge_min: int = MERGE_MIN) -> list[str]:
    """Lo mismo pero SIN aplicar el cap — para saber cuánto se habría perdido."""
    parts = _HEADER_RE.split(doc)
    secs: list[str] = []
    pre = parts[0].strip()
    if len(pre) > 40:
        secs.append(pre)
    i = 1
    while i < len(parts):
        head = parts[i]
        body = parts[i + 1] if i + 1 < len(parts) else ""
        secs.append((head + "\n" + body).strip())
        i += 2
    merged: list[str] = []
    for s in secs:
        if merged and len(s) < merge_min:
            merged[-1] = merged[-1] + "\n" + s
        else:
            merged.append(s)
    return [s for s in merged if s.strip()]


def validar(path: Path, verbose: bool = False) -> tuple[bool, list[str]]:
    doc = path.read_text(encoding="utf-8")
    reales = _secciones_sin_truncar(doc)
    finales = split_sections_header_aware(doc)
    problemas: list[str] = []

    perdido_total = sum(len(r) for r in reales) - sum(len(f) for f in finales)
    if perdido_total > 0:
        problemas.append(
            f"🔴 SE PIERDEN {perdido_total} caracteres al ingestar "
            f"({100 * perdido_total / max(sum(len(r) for r in reales), 1):.0f}% del documento)"
        )

    for idx, sec in enumerate(reales):
        titulo = next((l.strip() for l in sec.splitlines() if l.startswith("#")), "(sin header)")
        titulo = titulo.lstrip("#").strip()[:60]
        n = len(sec)
        if n > CAP:
            problemas.append(f"  🔴 sec {idx} «{titulo}»: {n} chars → se truncan {n - CAP}")
        elif n > OBJETIVO_MAX:
            problemas.append(f"  🟡 sec {idx} «{titulo}»: {n} chars → sin margen (cap={CAP})")
        elif verbose and n < OBJETIVO_MIN:
            problemas.append(f"  🔵 sec {idx} «{titulo}»: {n} chars → corta; si baja de {MERGE_MIN} se fusiona")

    if not reales:
        problemas.append("🔴 sin secciones: ¿el documento tiene headers ## ?")

    if verbose:
        print(f"    secciones: {len(reales)} → chunks: {len(finales)}")

    return (perdido_total == 0 and not any(p.startswith("  🔴") or p.startswith("🔴") for p in problemas),
            problemas)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    root = Path(sys.argv[1])
    verbose = "--verbose" in sys.argv
    archivos = sorted(root.rglob("*.md"))
    if not archivos:
        print(f"No se encontraron .md en {root}")
        return 2

    fallidos = 0
    for f in archivos:
        ok, problemas = validar(f, verbose)
        estado = "✅" if ok else "❌"
        rel = f.relative_to(root)
        if ok and not problemas:
            if verbose:
                print(f"{estado} {rel}")
        else:
            print(f"{estado} {rel}")
            for p in problemas:
                print(f"   {p}")
            if not ok:
                fallidos += 1

    print(f"\n{len(archivos)} documentos · {fallidos} con pérdida de contenido")
    if fallidos:
        print("\nCómo se arregla: partir la sección larga en dos secciones con header propio.")
        print(f"Zona segura de redacción: {OBJETIVO_MIN}-{OBJETIVO_MAX} chars por sección.")
    return 1 if fallidos else 0


if __name__ == "__main__":
    sys.exit(main())
