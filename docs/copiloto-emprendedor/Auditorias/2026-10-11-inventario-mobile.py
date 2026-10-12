#!/usr/bin/env python3
"""FASE A/A1 + material crudo de A3: particion total de apps/mobile y quien navega a cada ruta.

Script-first a proposito: los denominadores del DoD se CONGELAN aca y todo lote posterior se mide
contra este JSON. Si un sub-agente cuenta distinto, manda este archivo -- no su impresion.

A3 necesita, por ruta, el path:linea de QUIEN la alcanza. No se puede inferir leyendo la pantalla:
hay que buscar el call-site del navegador. Una ruta con 0 call-sites es la firma de "UI escrita que
nadie alcanza", una clase de hallazgo que ya aparecio en el relevamiento previo.

=== LAS TRES TRAMPAS QUE ESTE SCRIPT YA PAGO ===

(1) v1 -> v2, FALSO CERO. La v1 buscaba la comilla de cierre pegada al literal de la ruta:
    ['"`]/legal['"`]  y reporto `/legal` como la UNICA pantalla con CERO call-sites. Era FALSO: se
    alcanza desde `PantallaCuenta.tsx:61` y `:66` con `router.push('/legal?kind=tos')` -- el
    call-site real lleva **query string**, asi que la comilla no viene pegada. El patron cazaba la
    ruta, pero no en su FORMA REAL. Un falso 0 es peor que no medir: tiene exactamente la cara de un
    hallazgo ("capacidad completa que nadie alcanza") y se habria publicado como tal.

(2) v1 -> v2, SOBRE-MATCH. El literal ['"`]/['"`] matchea cualquier "/" citado en el codigo y daba
    136 call-sites para la raiz. Un numero inflado y un cero falso, el mismo dia, en el mismo
    instrumento: el patron generico es laxo en el caso degenerado y estricto en el caso con
    parametros, y ninguno de los dos extremos avisa.

(3) v2 -> v3, COMENTARIOS CONTADOS COMO CODIGO.  <-- la peor, y la cazaron tres lotes a la vez.
    La v2 no distinguia codigo de comentario, y en ESTE repo los comentarios citan rutas todo el
    tiempo para explicar mecanica. Resultado: 10 call-sites fantasma. El que muerde es `/midia`:
    su UNICO "call-site" era `PantallaMiDia.tsx:267`, un docstring que dice *"La ruta `/midia` sigue
    viva porque las tarjetas de actividad y los enlaces internos la usan"*.
    O sea: el instrumento conto **la afirmacion de alcanzabilidad como su propia prueba**, y
    convirtio en 1 el unico 0 verdadero del mapa. La v2 publico "20 de 21 alcanzables, cero
    candidatas a capacidad-que-nadie-alcanza"; medido de nuevo, son 19 de 21 y `/midia` es el
    hallazgo que el instrumento tapo.
    Simetria con (1): el mismo instrumento primero FABRICO un hallazgo que no existia y despues
    TAPO uno que si existia. Y el falso positivo es el mas dificil de notar, porque no se lee como
    un error: se lee como la redundancia que uno quiere encontrar ("tranquilo, hay dos caminos").

Por eso la v3 trae CONTROLES EN LOS DOS SENTIDOS, y aborta si no pasan:
  POSITIVO  -- rutas que SE SABE navegadas (verificadas a mano con grep) deben dar >=1.
  CON PARAM -- `/legal` debe encontrarse PESE al `?kind=`: es el caso que rompio la v1.
  TECHO     -- la raiz `/` exige verbo de navegacion delante; un literal "/" suelto no cuenta.
  NEGATIVO  -- lineas verificadas A MANO como comentario NO pueden aparecer. Sin este control la
               mascara podria no estar haciendo nada y el verde de los positivos la absolveria:
               los call-sites reales se encuentran igual con la mascara apagada.

Y los dos sentidos siguen valiendo para interpretar la columna:
  - 0 call-sites NO prueba inalcanzable (tab, redireccion, index) -> es CANDIDATO, lo confirma el lote.
  - >=1 call-site NO prueba alcanzable: el boton puede vivir en una pantalla inalcanzable. La
    alcanzabilidad es transitiva y esto mide solo el primer salto.
"""
import io
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SAL = os.path.dirname(os.path.abspath(__file__))
BARRA = chr(92)


def descubrir_repo():
    """La raiz del repo, subiendo desde este archivo hasta encontrar apps/ + .git.

    Portable a proposito: este script se publica al lado del documento, y un instrumento que solo
    corre en la maquina donde se escribio no es un mecanismo, es un recuerdo. `--repo=` lo fuerza.
    """
    for arg in sys.argv[1:]:
        if arg.startswith('--repo='):
            return arg.split('=', 1)[1].rstrip('/')
    d = SAL
    for _ in range(8):
        if os.path.isdir(os.path.join(d, 'apps')) and os.path.exists(os.path.join(d, '.git')):
            return d.replace(BARRA, '/')
        padre = os.path.dirname(d)
        if padre == d:
            break
        d = padre
    for cand in ('C:/gfw-src/wt-relev',):          # ultimo recurso: el worktree del relevamiento
        if os.path.isdir(os.path.join(cand, 'apps', 'mobile')):
            return cand
    raise SystemExit('no encuentro la raiz del repo desde %s; pasa --repo=<ruta>' % SAL)


REPO = descubrir_repo()
RAIZ = REPO + '/apps/mobile'
if not os.path.isdir(RAIZ):
    raise SystemExit('no existe %s' % RAIZ)

# Verificadas a mano con grep antes de codificarlas. Si alguna da 0, el instrumento esta ciego.
CONTROL_POSITIVO = {
    '/legal': 'PantallaCuenta.tsx:61 y :66 -- con ?kind=, el caso que rompio la v1',
    '/ajustes-skins': 'ajustes.tsx:34',
    '/facturacion': 'presupuestos.tsx:39 y varios',
    '/agenda': '_layout.tsx:152',
}
TECHO_RAIZ = 30          # la v1 daba 136 para "/" por sobre-match; >30 acusa al patron

# Lineas ABIERTAS A MANO y confirmadas como comentario/docstring. Si la mascara no funciona,
# alguna reaparece. Es el control que la v2 no tenia, y por eso publico 10 fantasmas.
CONTROL_NEGATIVO = [
    ('apps/mobile/src/modules/midia/PantallaMiDia.tsx', 267,
     'docstring que AFIRMA que /midia esta viva -- era su unico "call-site"'),
    ('apps/mobile/src/modules/midia/PantallaMiDia.tsx', 329, 'comentario // sobre /inteligencia'),
    ('apps/mobile/src/modules/ajustes/PantallaCuenta.tsx', 79,
     'bloque {/* */} que cita /ajustes-feedback y /ajustes-soporte'),
    ('apps/mobile/src/modules/escritorio/EscritorioFunciones.tsx', 22, 'docstring con /recientes'),
    ('apps/mobile/src/modules/escritorio/EscritorioFunciones.tsx', 195, 'comentario con /recientes'),
    ('apps/mobile/src/modules/escritorio/EscritorioFunciones.tsx', 256, 'JSX comment con /recientes'),
    ('apps/mobile/src/modules/actividad/BuscadorActividad.tsx', 22, 'docstring que cita /gastos'),
]


def rel(p):
    return os.path.relpath(p, REPO).replace(BARRA, '/')


def enmascarar(src):
    """Reemplaza por espacios el contenido de los comentarios, preservando el conteo de lineas.

    Recorre caracter por caracter llevando estado de comilla (' " `) para no cortar en el `//` de
    una URL dentro de un string. Un regex no alcanza: `'https://x'` y `// ver /gastos` se parecen
    demasiado, y equivocarse hacia el otro lado reintroduce la trampa (1).
    """
    salida = []
    i, n = 0, len(src)
    comilla = None
    while i < n:
        c = src[i]
        if comilla:
            salida.append(c)
            if c == BARRA and i + 1 < n:                  # escape dentro del string
                salida.append(src[i + 1])
                i += 2
                continue
            if c == comilla:
                comilla = None
            i += 1
            continue
        if c in '\'"`':
            comilla = c
            salida.append(c)
            i += 1
            continue
        if c == '/' and i + 1 < n and src[i + 1] == '*':  # bloque /* ... */
            j = src.find('*/', i + 2)
            j = n if j < 0 else j + 2
            salida.append(''.join('\n' if ch == '\n' else ' ' for ch in src[i:j]))
            i = j
            continue
        if c == '/' and i + 1 < n and src[i + 1] == '/':  # linea // ...
            j = src.find('\n', i)
            j = n if j < 0 else j
            salida.append(' ' * (j - i))
            i = j
            continue
        salida.append(c)
        i += 1
    return ''.join(salida)


def recorrer(base, exts=('.ts', '.tsx')):
    for dirpath, dirnames, nombres in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in ('node_modules', '.expo', 'dist', 'build')]
        for n in nombres:
            if n.endswith(exts):
                yield os.path.join(dirpath, n)


def es_test(p):
    return '.test.' in os.path.basename(p)


rutas, comps, tests, otros = [], [], [], []
for p in recorrer(RAIZ):
    r = rel(p)
    if es_test(p):
        tests.append(r)
    elif r.startswith('apps/mobile/app/'):
        rutas.append(r)
    elif r.startswith('apps/mobile/src/'):
        (comps if p.endswith('.tsx') else otros).append(r)
    else:
        otros.append(r)

dir_mod = os.path.join(RAIZ, 'src', 'modules')
modulos = sorted(d for d in os.listdir(dir_mod)
                 if os.path.isdir(os.path.join(dir_mod, d))) if os.path.isdir(dir_mod) else []

total = len(rutas) + len(comps) + len(tests) + len(otros)
print('=' * 78)
print('FASE A1 — PARTICION DE apps/mobile  (sujeto: wt-relev, apps/mobile @ 6278836a)')
print('=' * 78)
print('  rutas de Expo (app/)      : %3d   [DoD: 22]' % len(rutas))
print('  componentes .tsx en src/  : %3d   [DoD: 115]' % len(comps))
print('  tests (*.test.ts/tsx)     : %3d   [DoD: 110 -> el DoD estaba corto]' % len(tests))
print('  modulos src/modules/*     : %3d   [DoD: 21]' % len(modulos))
print('  otros .ts en src/ (no tsx): %3d   <-- NINGUN denominador del DoD los cubria' % len(otros))
print('  TOTAL de archivos ts/tsx  : %3d' % total)


def nombre_ruta(r):
    s = r[len('apps/mobile/app/'):]
    s = re.sub(r'[.]tsx?$', '', s)
    if s.endswith('/index'):
        s = s[:-6]
    return '/' + ('' if s == 'index' else s)


def patron(nr):
    """Regex de call-site para una ruta. Tolera ?query y segmentos extra tras el literal."""
    corto = re.escape(nr.lstrip('/'))
    largo = re.escape(nr)
    cola = r'(?:[?#][^\'"`]*)?'          # ?kind=tos, #ancla, o nada
    verbo = r'(?:push|replace|navigate|href\s*[=:]|pathname\s*:)'
    if nr == '/':
        # la raiz NO se busca como literal suelto: exige verbo delante, o la v1 cuenta 136
        return re.compile(verbo + r'\s*[({\[\'"`]*\s*[\'"`]/' + cola + r'[\'"`]')
    return re.compile(verbo + r'\s*[({\[\'"`]*\s*[\'"`]/?' + corto + cola + r'[\'"`]'
                      r'|[\'"`]' + largo + cola + r'[\'"`]')


fuentes = {}
for p in recorrer(RAIZ):
    try:
        texto = io.open(p, encoding='utf-8', errors='replace').read()
    except Exception:                                                  # noqa: BLE001
        texto = ''
    fuentes[rel(p)] = enmascarar(texto).splitlines()                   # v3: sin comentarios

filas = []
for r in sorted(rutas):
    nr = nombre_ruta(r)
    if os.path.basename(r).startswith('_'):
        filas.append({'archivo': r, 'ruta': nr, 'tipo': 'layout', 'call_sites': []})
        continue
    pat = patron(nr)
    cs, cs_test = [], []
    for arch, lineas in fuentes.items():
        if arch == r:
            continue
        for i, ln in enumerate(lineas, 1):
            if pat.search(ln):
                (cs_test if es_test(arch) else cs).append('%s:%d' % (arch, i))
    filas.append({'archivo': r, 'ruta': nr, 'tipo': 'pantalla',
                  'call_sites': cs, 'call_sites_en_tests': cs_test})

por_ruta = {f['ruta']: f for f in filas}
todos_cs = {cs for f in filas for cs in (f.get('call_sites') or [])}

# --- CONTROLES: antes de imprimir un solo cero -------------------------------
print()
print('=' * 78)
print('CONTROLES DEL INSTRUMENTO DE NAVEGACION (v3: positivos Y negativos)')
print('=' * 78)
ciego = []
for ruta, donde in CONTROL_POSITIVO.items():
    n = len((por_ruta.get(ruta) or {}).get('call_sites') or [])
    print('  POS %-16s %s  (esperado >=1 por %s)'
          % (ruta, 'OK  n=%d' % n if n else 'CIEGO n=0', donde))
    if not n:
        ciego.append(ruta)
nraiz = len((por_ruta.get('/') or {}).get('call_sites') or [])
print('  TOP %-16s %s  (techo %d; la v1 daba 136 por sobre-match)'
      % ('/ (raiz)', 'OK  n=%d' % nraiz if nraiz <= TECHO_RAIZ else 'SOBRE-MATCH n=%d' % nraiz,
         TECHO_RAIZ))
if nraiz > TECHO_RAIZ:
    ciego.append('/ (sobre-match)')

for arch, linea, por in CONTROL_NEGATIVO:                 # la mascara TIENE que estar haciendo algo
    clave = '%s:%d' % (arch, linea)
    corto = clave[len('apps/mobile/src/modules/'):] if clave.startswith(
        'apps/mobile/src/modules/') else clave
    contado = clave in todos_cs
    print('  NEG %-46s %s' % (corto, 'FUGA (mascara inactiva)' if contado else 'OK  no contado'))
    if contado:
        ciego.append('%s [comentario contado: %s]' % (clave, por))

if ciego:
    raise SystemExit('\nINSTRUMENTO CIEGO en %s. No publico la columna de alcanzabilidad: un 0 '
                     'falso tiene cara de hallazgo, y un 1 falso TAPA uno real.'
                     % ', '.join(ciego))

pantallas = [f for f in filas if f['tipo'] == 'pantalla']
sin_cs = [f for f in pantallas if not f['call_sites']]
solo_test = [f for f in sin_cs if f.get('call_sites_en_tests')]
print()
print('=' * 78)
print('MATERIAL CRUDO DE A3 — quien navega a cada ruta (PRIMER salto, sin comentarios)')
print('=' * 78)
print('  pantallas (sin layouts)                    : %3d' % len(pantallas))
print('  con >=1 call-site de produccion            : %3d' % (len(pantallas) - len(sin_cs)))
print('  *** con CERO call-sites de produccion      : %3d ***' % len(sin_cs))
print('  de esas, con call-site SOLO EN TESTS       : %3d  <-- el test la alcanza, la app no'
      % len(solo_test))
print()
for f in sorted(pantallas, key=lambda x: (len(x['call_sites']), x['ruta'])):
    marca = '  [0] ' if not f['call_sites'] else '      '
    extra = (' +%d' % (len(f['call_sites']) - 3)) if len(f['call_sites']) > 3 else ''
    t = ('  {test:%d}' % len(f['call_sites_en_tests'])) if f.get('call_sites_en_tests') else ''
    print('%s%-30s %2d  %s%s%s' % (marca, f['ruta'], len(f['call_sites']),
                                   ', '.join(f['call_sites'][:3]), extra, t))

print()
print('  layouts (no son pantallas): %s' % ', '.join(
    f['archivo'][len('apps/mobile/app/'):] for f in filas if f['tipo'] == 'layout'))

datos = {'sujeto': 'apps/mobile @ 6278836a (wt-relev)', 'version_instrumento': 3,
         'denominadores': {'rutas': len(rutas), 'componentes_tsx': len(comps),
                           'tests': len(tests), 'modulos': len(modulos),
                           'otros_ts_en_src': len(otros), 'total_ts_tsx': total},
         'modulos': modulos, 'rutas': filas,
         'componentes': sorted(comps), 'tests': sorted(tests), 'otros': sorted(otros)}
io.open(os.path.join(SAL, 'inventario-mobile.json'), 'w', encoding='utf-8').write(
    json.dumps(datos, indent=1, ensure_ascii=False))
print('\n  (inventario completo en inventario-mobile.json)')
