#!/usr/bin/env python3
"""Barrido: citas `archivo:linea` dentro de comentarios que apuntan a una linea que NO existe.

Por que esta familia y no las otras tres. La clase «comentario que declara un estado del mundo
obsoleto» tiene ~14 miembros medidos en tres lotes del relevamiento, y se parte en cuatro familias:
  1. negacion de existencia  («no lo escribe nadie», «todavia no existe»)   -> requiere juicio
  2. afirmacion de paridad   («alineado con web»)                           -> requiere juicio
  3. afirmacion de mecanismo («long-poll», «no tiene RLS»)                  -> requiere juicio
  4. cita de ubicacion       («ver web.py:714»)                             -> MECANICA
Solo la 4 se puede medir sin juicio semantico, y por eso es la unica que este script toca. Las otras
tres quedan declaradas como no-barridas en lugar de barridas-mal: mi primer intento de barrer la
familia 1 por palabras clave encontro 2 de 14 miembros, y un control negativo que no encuentra nada
acredita el patron, no la ausencia.

Mide DOS defectos duros, ambos sin juicio:
  - OUT_OF_RANGE: el archivo citado existe y tiene menos lineas que la citada.
  - NO_SUCH_FILE: el archivo citado no existe en el arbol.
Para todo lo demas emite el texto de la linea citada, para revision humana rapida (no lo acusa).

Solo lectura. Idempotente. Uso:
    python citas-rotas.py <raiz>            # resumen + los defectos duros
    python citas-rotas.py <raiz> --todas    # agrega el volcado para revision
"""
from __future__ import annotations

import os
import re
import sys
from collections import Counter

# `algo/que/sea.py:123` o `archivo.tsx:45`, con o sin directorios delante.
CITA = re.compile(r'([A-Za-z0-9_][\w./\\-]*\.(?:py|ts|tsx|sh|sql|yml|yaml|json)):(\d+)\b')

# Marcadores de comentario por extension. Una cita en codigo vivo (un string, un path real) no es
# una cita documental, asi que solo se miran lineas que contienen un marcador de comentario.
MARCAS = ('#', '//', '*', '"""', "'''", '<!--')

EXT_FUENTE = ('.py', '.ts', '.tsx', '.sh', '.sql')
SALTAR_DIR = {
    '.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build',
    '.pytest_cache', '.ruff_cache', 'coverage', '.next', '.expo',
    # Fuera del alcance declarado del relevamiento: solo codigo.
    'docs', 'memoria', 'coordinacion', '.ci-recibos', 'spikes',
}

_largos: dict[str, int | None] = {}


def largo_de(path: str) -> int | None:
    """Cantidad de lineas del archivo, o None si no existe. Memoizado."""
    if path not in _largos:
        try:
            with open(path, 'rb') as fh:
                _largos[path] = sum(1 for _ in fh)
        except OSError:
            _largos[path] = None
    return _largos[path]


def resolver(cita: str, desde: str, raiz: str) -> str | None:
    """Resuelve la cita a un path real: relativo al archivo que cita, a la raiz, o por basename."""
    cita = cita.replace('\\', '/')
    for cand in (os.path.join(os.path.dirname(desde), cita), os.path.join(raiz, cita)):
        if os.path.isfile(cand):
            return cand
    # Cita por basename (`web.py:714`): unica coincidencia o nada. Ambiguo = no se acusa.
    base = os.path.basename(cita)
    hits = _indice(raiz).get(base, ())
    return hits[0] if len(hits) == 1 else None


_idx: dict[str, tuple[str, ...]] | None = None


def _indice(raiz: str) -> dict[str, tuple[str, ...]]:
    global _idx
    if _idx is None:
        acc: dict[str, list[str]] = {}
        for d, subdirs, files in os.walk(raiz):
            subdirs[:] = [s for s in subdirs if s not in SALTAR_DIR]
            for f in files:
                acc.setdefault(f, []).append(os.path.join(d, f))
        _idx = {k: tuple(v) for k, v in acc.items()}
    return _idx


def barrer(raiz: str):
    duros, revisables = [], []
    stats = Counter()
    for d, subdirs, files in os.walk(raiz):
        subdirs[:] = [s for s in subdirs if s not in SALTAR_DIR]
        for f in files:
            if not f.endswith(EXT_FUENTE):
                continue
            p = os.path.join(d, f)
            try:
                lineas = open(p, encoding='utf-8', errors='replace').read().split('\n')
            except OSError:
                continue
            for n, linea in enumerate(lineas, 1):
                if not any(m in linea for m in MARCAS):
                    continue
                for cita, num in CITA.findall(linea):
                    stats['citas'] += 1
                    destino = resolver(cita, p, raiz)
                    rel = os.path.relpath(p, raiz).replace('\\', '/')
                    if destino is None:
                        # Puede ser un archivo fuera del arbol o una cita ambigua: no es defecto duro.
                        stats['sin_resolver'] += 1
                        continue
                    largo = largo_de(destino)
                    if largo is None:
                        stats['NO_SUCH_FILE'] += 1
                        duros.append(('NO_SUCH_FILE', rel, n, cita, num, ''))
                    elif int(num) > largo:
                        stats['OUT_OF_RANGE'] += 1
                        duros.append(('OUT_OF_RANGE', rel, n, cita, num, f'el archivo tiene {largo}'))
                    else:
                        stats['en_rango'] += 1
                        texto = open(destino, encoding='utf-8', errors='replace').read().split('\n')[int(num) - 1]
                        revisables.append((rel, n, cita, num, texto.strip()[:110]))
    return duros, revisables, stats


def main() -> int:
    raiz = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
    todas = '--todas' in sys.argv
    duros, revisables, stats = barrer(raiz)

    print(f'raiz: {raiz}')
    print(f'citas documentales halladas: {stats["citas"]}  '
          f'(en rango {stats["en_rango"]} · sin resolver {stats["sin_resolver"]})')
    print(f'DEFECTOS DUROS: {len(duros)}  '
          f'(fuera de rango {stats["OUT_OF_RANGE"]} · archivo inexistente {stats["NO_SUCH_FILE"]})')
    print()
    for clase, arch, n, cita, num, extra in sorted(duros):
        print(f'[{clase}] {arch}:{n}  ->  cita {cita}:{num}' + (f'  ({extra})' if extra else ''))

    if todas:
        print(f'\n--- {len(revisables)} citas en rango, para revision (NO acusadas) ---')
        for arch, n, cita, num, texto in sorted(revisables):
            print(f'{arch}:{n} -> {cita}:{num} | {texto}')

    # Exit 0 siempre: es un instrumento de medicion, no un gate. Un gate que nadie calibro
    # devolviendo rojo es la forma mas rapida de que alguien aprenda a saltearlo.
    return 0


if __name__ == '__main__':
    sys.exit(main())
