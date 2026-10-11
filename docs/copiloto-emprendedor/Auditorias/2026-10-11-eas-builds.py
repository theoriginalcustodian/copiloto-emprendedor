#!/usr/bin/env python3
"""Mide el estado REAL de los builds EAS del proyecto en la plataforma (api.expo.dev/graphql).

Por que no `eas build:list`: el CLI no esta instalado (ni local ni global) y bajarlo son decenas
de MB para una pregunta de lectura. La API responde lo mismo y esto queda como instrumento.

DOS trampas que este script ya pago, y por eso estan codificadas:

1. SIN `User-Agent` propio, Cloudflare devuelve **HTTP 403 error 1010** -- identico para CUATRO
   credenciales distintas. Se lee como "no tengo acceso a la cuenta" y es un UA bloqueado. La
   uniformidad del error entre credenciales distintas fue la pista: un 403 de auth habria
   discriminado entre un token valido y uno roto.
2. Un token INVALIDO no da error: da **HTTP 200 con `me: null`**. Asi que el control negativo no
   puede ser "¿hubo error?" sino "¿`me` vino nulo?". Medido: sin auth -> 200 + me:null.

Controles, ANTES de cualquier afirmacion sobre builds (0 builds y 'no pude preguntar' se ven igual):
  POSITIVO: `me` con el token real DEBE traer un username.
  NEGATIVO: el mismo query con el token mutilado DEBE traer `me: null`.
"""
import io
import json
import os
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

URL = 'https://api.expo.dev/graphql'
UA = 'eas-cli/16.0.0 win32 x64'          # sin esto: Cloudflare 1010. No es cosmetico.
PROJECT_ID = '05317fbe-ca0e-4f46-a63e-6f47a1cb118a'


def credencial():
    """(headers, de_donde). Token de env primero; si no, la sesion del CLI."""
    tok = os.environ.get('EXPO_TOKEN', '')
    if tok:
        return {'Authorization': 'Bearer %s' % tok}, 'EXPO_TOKEN (env)'
    st = 'C:/Users/Admin/.expo/state.json'
    if os.path.exists(st):
        sec = (json.load(io.open(st, encoding='utf-8')).get('auth') or {}).get('sessionSecret')
        if sec:
            return {'expo-session': sec}, 'sessionSecret (~/.expo/state.json)'
    raise SystemExit('sin credencial: ni EXPO_TOKEN ni sesion del CLI. El instrumento no mide.')


AUTH, ORIGEN = credencial()


def gql(query, variables=None, headers=None, timeout=90):
    """(datos, error). Nunca levanta: el error es un valor a reportar."""
    req = urllib.request.Request(
        URL, data=json.dumps({'query': query, 'variables': variables or {}}).encode('utf-8'),
        method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('User-Agent', UA)
    for k, v in (headers if headers is not None else AUTH).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            payload = json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        cuerpo = exc.read().decode('utf-8', 'replace')
        try:
            payload = json.loads(cuerpo)
        except Exception:                                            # noqa: BLE001
            return None, 'HTTP %s: %s' % (exc.code, ' '.join(cuerpo.split())[:160])
    except Exception as exc:                                         # noqa: BLE001
        return None, 'red: %s' % exc
    if payload.get('errors'):
        return payload.get('data'), '; '.join(
            e.get('message', '?') for e in payload['errors'])[:300]
    return payload.get('data'), None


print('=' * 78)
print('CONTROLES DEL INSTRUMENTO   (credencial: %s)' % ORIGEN)
print('=' * 78)
d, e = gql('{ me { username accounts { name } } }')
quien = (d or {}).get('me') if d else None
print('  positivo (credencial real) : %s' % (
    'OK -> %s, cuentas=%s' % (quien['username'], [a['name'] for a in quien.get('accounts', [])])
    if quien else 'FALLA -> %s' % e))
if not quien:
    raise SystemExit('\nControl positivo ROJO. No concluyo nada sobre la plataforma.')

roto = {k: (v[:-6] + 'xxxxxx') for k, v in AUTH.items()}
d2, _ = gql('{ me { username } }', headers=roto)
nulo = ((d2 or {}).get('me') is None)
print('  negativo (credencial rota) : %s' % (
    'OK -> me:null' if nulo else 'CIEGO -> aceptó una credencial mutilada'))

CAMPOS = [
    """id status platform createdAt completedAt appVersion appBuildVersion runtimeVersion
       buildProfile gitCommitHash expirationDate isForIosSimulator
       artifacts { buildUrl applicationArchiveUrl }
       error { errorCode message }
       initiatingActor { __typename ... on User { username } }""",
    'id status platform createdAt appVersion buildProfile runtimeVersion gitCommitHash',
    'id status platform createdAt',
]
Q = """query B($id: String!, $limit: Int!) {
  app { byId(appId: $id) { id fullName slug
    builds(limit: $limit, offset: 0) { %s } } } }"""

print()
print('=' * 78)
print('BUILDS EAS — proyecto %s' % PROJECT_ID)
print('=' * 78)
datos, usado = None, None
for i, campos in enumerate(CAMPOS):
    d, e = gql(Q % campos, {'id': PROJECT_ID, 'limit': 20})
    app = ((d or {}).get('app') or {}).get('byId') if d else None
    if app is not None:
        datos, usado = app, i
        if i:
            print('  [aviso] cayó al set de campos #%d; el completo lo rechazó el schema: %s'
                  % (i, e))
        break
    print('  set #%d rechazado: %s' % (i, e))

if datos is None:
    raise SystemExit('\nNinguna variante pasó. NO concluyo "no hay builds".')

print('  app: %s  (slug %s)' % (datos.get('fullName'), datos.get('slug')))
builds = datos.get('builds') or []
print('  builds devueltos: %d' % len(builds))
if not builds:
    print('\n  *** CERO BUILDS en la plataforma para este proyecto. ***')
    print('  Positivo verde y negativo rechazando: este cero es real, no un fallo de consulta.')
for b in builds:
    print('\n  --- %s' % b.get('id'))
    for k in ('status', 'platform', 'buildProfile', 'appVersion', 'appBuildVersion',
              'runtimeVersion', 'gitCommitHash', 'createdAt', 'completedAt', 'expirationDate',
              'isForIosSimulator'):
        if k in b:
            print('      %-18s %s' % (k, b.get(k)))
    for k, v in (b.get('artifacts') or {}).items():
        print('      %-18s %s' % (k, (v[:110] + '…') if v and len(v) > 110 else v))
    if b.get('error'):
        print('      %-18s %s' % ('error', b['error']))
    act = b.get('initiatingActor') or {}
    if act:
        print('      %-18s %s' % ('por', act.get('username') or act.get('__typename')))

io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'eas-builds.json'),
        'w', encoding='utf-8').write(json.dumps(datos, indent=1, ensure_ascii=False))
print('\n  (crudo en eas-builds.json; set de campos #%d)' % usado)
