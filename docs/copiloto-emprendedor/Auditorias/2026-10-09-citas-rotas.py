#!/usr/bin/env python3
"""Verifica que TODA cita `archivo:linea` del documento de cierre resuelva en el arbol.

Por que existe: el documento va a ser la base del backlog, y cada `path:linea` es portante -- si
apunta a una linea que no existe, el lector no puede verificar el hallazgo y hereda la afirmacion
sin la prueba, que es el defecto que el propio documento persigue.

Mide TRES defectos, los tres sin juicio semantico:
  - NO_SUCH_FILE   : el archivo citado no existe en el arbol.
  - AMBIGUO        : cito el basename pelado y en el arbol hay >1 archivo con ese nombre, asi que el
                     lector no puede resolverlo (caso real: `FormularioCliente.tsx` vive en web Y en
                     mobile; `TarjetaIngresoPropuesto.tsx` tambien).
  - OUT_OF_RANGE   : el archivo existe y tiene MENOS lineas que la citada.

CONTROL POSITIVO obligatorio: inyecta tres citas falsas (una por defecto) y exige que las cace. Un
verificador que sale limpio sin control positivo acredita su propia ceguera.

Solo lectura. Idempotente.
"""
from __future__ import annotations

import io
import os
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8', errors='replace')


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
_RAIZ_DEFAULT = r'C:/gfw-src/wt-relev'
RAIZ = _resolver_raiz(_AQUI, _RAIZ_DEFAULT)

# `ruta/archivo.ext:123` o `archivo.ext:123-456` o `archivo.ext:12,34`
CITA = re.compile(
    r'(?<![\w/.-])((?:[\w.-]+/)*[\w.-]+\.(?:py|ts|tsx|js|jsx|sql|json|sh|css|yml|yaml))'
    r':(\d+)((?:[,-]\d+)*)')

EXCLUIR_DIRS = {'.git', 'node_modules', '__pycache__', '.pytest_cache', 'dist', 'build',
                '.venv', 'venv', '.next', 'coverage', '.ci-recibos'}


def indexar(raiz):
    """basename -> [rutas relativas]  y  ruta relativa normalizada -> cantidad de lineas."""
    por_nombre = defaultdict(list)
    rutas = {}
    for dirpath, dirnames, filenames in os.walk(raiz):
        dirnames[:] = [d for d in dirnames if d not in EXCLUIR_DIRS]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, raiz).replace('\\', '/')
            por_nombre[fn].append(rel)
            rutas[rel] = full
    return por_nombre, rutas


def lineas_de(full, cache={}):
    if full not in cache:
        try:
            with io.open(full, encoding='utf-8', errors='replace') as fh:
                cache[full] = sum(1 for _ in fh)
        except OSError:
            cache[full] = -1
    return cache[full]


def resolver(cita_path, por_nombre, rutas):
    """-> (ruta_relativa, motivo_o_None)."""
    if cita_path in rutas:
        return cita_path, None
    # sufijo de una ruta real (cito `copiloto-web/src/...` sin `apps/`)
    sufijos = [r for r in rutas if r.endswith('/' + cita_path)]
    if len(sufijos) == 1:
        return sufijos[0], None
    if len(sufijos) > 1:
        return None, 'AMBIGUO(%d)' % len(sufijos)
    base = cita_path.split('/')[-1]
    cands = por_nombre.get(base, [])
    if len(cands) == 1:
        return cands[0], None
    if len(cands) > 1:
        return None, 'AMBIGUO(%d)' % len(cands)
    return None, 'NO_SUCH_FILE'


MARCA = '[cita-exhibida]'


def verificar(texto, por_nombre, rutas):
    """-> (total, fallas, marcadas).

    `fallas` son defectos duros. `marcadas` son citas EXHIBIDAS (precedidas por MARCA): el
    documento las CITA para reportarlas, no las afirma como referencia propia. Se
    excluyen de fallas pero se devuelven para listarlas -- una exclusion silenciosa es
    indistinguible de un verificador que dejo de mirar.
    """
    fallas, marcadas = [], []
    total = 0
    for m in CITA.finditer(texto):
        p, primera, resto = m.group(1), int(m.group(2)), m.group(3)
        total += 1
        exhibida = MARCA in texto[max(0, m.start() - 24):m.start()]
        motivo, detalle = None, None
        rel, por_resolver = resolver(p, por_nombre, rutas)
        if por_resolver:
            motivo, detalle = por_resolver, p
        else:
            n = lineas_de(rutas[rel])
            citadas = [primera] + [int(x) for x in re.findall(r'\d+', resto)]
            peor = max(citadas)
            if n < 0:
                motivo, detalle = 'ILEGIBLE', rel
            elif peor > n:
                motivo = 'OUT_OF_RANGE'
                detalle = '%s tiene %d lineas, cito %d' % (rel, n, peor)
        if exhibida:
            # control positivo del sentido contrario: una marca sobre una cita SANA miente.
            if motivo:
                marcadas.append((m.group(0), motivo, detalle))
            else:
                fallas.append((m.group(0), 'MARCA_FALSA',
                               'exhibida, pero resuelve limpia y sin ambiguedad en %s' % rel))
        elif motivo:
            fallas.append((m.group(0), motivo, detalle))
    return total, fallas, marcadas


print('indexando %s ...' % RAIZ)
por_nombre, rutas = indexar(RAIZ)
print('   %d archivos indexados' % len(rutas))

doc = io.open(DOC, encoding='utf-8').read()

# ---- CONTROL POSITIVO: tres citas falsas, una por defecto. Sin esto el verde no vale.
canarios = ('archivo-que-no-existe-jamas.py:1 '          # NO_SUCH_FILE
            'FormularioCliente.tsx:1 '                    # AMBIGUO (web y mobile)
            'apps/copiloto/cliente_store.py:999999 '      # OUT_OF_RANGE
            '[cita-exhibida] no-existe-tampoco.py:3 '     # exhibida Y rota -> se EXCLUYE
            '[cita-exhibida] apps/copiloto/cliente_store.py:1')    # exhibida y SANA -> MARCA_FALSA
_, caz, marc = verificar(canarios, por_nombre, rutas)
motivos = {d.split('(')[0] for _, d, _ in caz}
esperados = {'NO_SUCH_FILE', 'AMBIGUO', 'OUT_OF_RANGE', 'MARCA_FALSA'}
if motivos != esperados:
    raise SystemExit('CONTROL POSITIVO FALLO: cace %s, esperaba %s' % (sorted(motivos),
                                                                      sorted(esperados)))
if len(marc) != 1:
    raise SystemExit('CONTROL POSITIVO FALLO: excluidas %d marcadas, esperaba 1' % len(marc))
print('control positivo: 4/4 cazados (%s) + 1 exhibida excluida'
      % ', '.join(sorted(motivos)))

total, fallas, marcadas = verificar(doc, por_nombre, rutas)
print('')
print('citas en el documento: %d' % total)
print('defectos duros:        %d' % len(fallas))
print('exhibidas (marcadas):  %d  -- excluidas, y por eso listadas' % len(marcadas))
for cita, motivo, detalle in sorted(set(marcadas)):
    print('    %-46s  %-14s %s' % (cita[:46], motivo, detalle))
if fallas:
    print('')
    agrup = defaultdict(list)
    for cita, defecto, detalle in fallas:
        agrup[defecto.split('(')[0]].append((cita, detalle))
    for defecto in sorted(agrup):
        print('--- %s (%d) ---' % (defecto, len(agrup[defecto])))
        for cita, detalle in sorted(set(agrup[defecto])):
            print('    %-46s  %s' % (cita[:46], detalle))
else:
    print('')
    print('TODAS las citas resuelven y estan en rango.')
