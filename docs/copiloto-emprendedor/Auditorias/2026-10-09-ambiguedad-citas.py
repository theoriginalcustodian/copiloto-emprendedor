#!/usr/bin/env python3
"""Refina el AMBIGUO del verificador: una cita con basename ambiguo puede ser RESOLUBLE igual.

Si el numero de linea citado existe en UN SOLO candidato, la cita se resuelve mecanicamente aunque
el basename se repita. Si existe en 2+, la ambiguedad es real. Y si no existe en NINGUNO, es un
defecto duro que el AMBIGUO estaba TAPANDO -- que es justo la clase que el documento persigue: un
veredicto grueso ("ambiguo") escondiendo uno fino ("roto").

Solo lectura.
"""
from __future__ import annotations

import io
import os
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

_RAIZ_DEFAULT = r'C:/gfw-src/wt-relev'

# --- resolucion PORTABLE del sujeto y de la raiz (agregado al cerrar el relevamiento) -----------
# Antes esto estaba fijo a CIERRE-RELEVAMIENTO.md y a C:/gfw-src/wt-relev, asi que la copia
# publicada en el repo no podia correr en un clon: el instrumento que acredita 766 citas no era
# ejecutable por el proximo lector, que es justo para quien se publica.
def _resolver_sujeto():
    _aqui = os.path.dirname(os.path.abspath(__file__))
    for _a in sys.argv[1:]:
        if _a.startswith('--doc='):
            return os.path.abspath(_a[6:]), _aqui
    for _n in ('2026-10-09-relevamiento-codigo-cierre.md', 'CIERRE-RELEVAMIENTO.md'):
        _p = os.path.join(_aqui, _n)
        if os.path.exists(_p):
            return _p, _aqui
    raise SystemExit('no encuentro el documento al lado de %s' % _aqui)


def _resolver_raiz(_aqui, _default):
    for _a in sys.argv[1:]:
        if _a.startswith('--raiz='):
            return os.path.abspath(_a[7:])
    # En el repo el gate vive en docs/<proyecto>/Auditorias/ -> la raiz esta tres niveles arriba.
    _tres = os.path.abspath(os.path.join(_aqui, '..', '..', '..'))
    if os.path.isdir(os.path.join(_tres, 'apps')) and os.path.isdir(os.path.join(_tres, '.git')):
        return _tres
    return _default


DOC, _AQUI = _resolver_sujeto()
RAIZ = _resolver_raiz(_AQUI, _RAIZ_DEFAULT)
EXCLUIR = {'.git', 'node_modules', '__pycache__', '.pytest_cache', 'dist', 'build',
           '.venv', 'venv', '.next', 'coverage', '.ci-recibos'}
CITA = re.compile(
    r'(?<![\w/.-])((?:[\w.-]+/)*[\w.-]+\.(?:py|ts|tsx|js|jsx|sql|json|sh|css|yml|yaml))'
    r':(\d+)((?:[,-]\d+)*)')

por_nombre = defaultdict(list)
rutas = {}
for dirpath, dirnames, filenames in os.walk(RAIZ):
    dirnames[:] = [d for d in dirnames if d not in EXCLUIR]
    for fn in filenames:
        full = os.path.join(dirpath, fn)
        rel = os.path.relpath(full, RAIZ).replace(os.sep, '/')
        por_nombre[fn].append(rel)
        rutas[rel] = full

_cache = {}


def nlineas(full):
    if full not in _cache:
        try:
            with io.open(full, encoding='utf-8', errors='replace') as fh:
                _cache[full] = sum(1 for _ in fh)
        except OSError:
            _cache[full] = -1
    return _cache[full]


MARCA = '[cita-exhibida]'   # la MISMA marca que verificar-citas-del-cierre.py: dos
# instrumentos sobre el mismo documento con criterios distintos se contradicen, y la
# contradiccion se lee como 'uno de los dos esta roto' en vez de 'miden cosas distintas'.
doc = io.open(DOC, encoding='utf-8').read()
resoluble, ambiguo_real, roto_escondido, exhibidas = [], [], [], []

for m in CITA.finditer(doc):
    p, l1, resto = m.group(1), int(m.group(2)), m.group(3)
    if p in rutas:
        continue
    if MARCA in doc[max(0, m.start() - 24):m.start()]:
        exhibidas.append(m.group(0))
        continue
    sufijos = [r for r in rutas if r.endswith('/' + p)]
    cands = sufijos if sufijos else por_nombre.get(p.split('/')[-1], [])
    if len(cands) <= 1:
        continue
    peor = max([l1] + [int(x) for x in re.findall(r'\d+', resto)])
    enrango = [c for c in cands if nlineas(rutas[c]) >= peor]
    fila = (m.group(0), len(cands), tuple(enrango[:3]))
    if len(enrango) == 1:
        resoluble.append(fila)
    elif len(enrango) == 0:
        roto_escondido.append(fila)
    else:
        ambiguo_real.append(fila)

tot = len(resoluble) + len(ambiguo_real) + len(roto_escondido)
print('citas con basename ambiguo:    %d' % tot)
print('  resolubles por el numero:    %-4d  la linea existe en UN solo candidato' % len(resoluble))
print('  ambiguedad REAL (2+):        %-4d  se arregla calificando el path' % len(ambiguo_real))
print('  ROTAS, tapadas por AMBIGUO:  %-4d  la linea no existe en NINGUN candidato'
      % len(roto_escondido))
print('  exhibidas, excluidas:        %-4d  %s' % (len(exhibidas),
      ', '.join(sorted(set(exhibidas))) or '-'))

if roto_escondido:
    print('')
    print('!! defectos duros que el AMBIGUO escondia:')
    for cita, nc, ej in sorted(set(roto_escondido)):
        print('    %-44s %d candidatos, 0 en rango  (%s)' % (cita, nc, ej[0] if ej else '-'))

if ambiguo_real:
    print('')
    print('ambiguedad real (muestra de hasta 12):')
    for cita, nc, ej in sorted(set(ambiguo_real))[:12]:
        print('    %-34s %s' % (cita, ' | '.join(ej)))
