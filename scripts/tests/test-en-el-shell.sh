#!/usr/bin/env bash
# Control del `en_el_shell()` de `scripts/evidencia_device.py` — el que decide si el harness cree que
# la app está logueada.
#
# EL DEFECTO (2026-10-15): la app abrió logueada en Mi día y el harness dijo «la pantalla de login nunca
# apareció». `en_el_shell()` sólo anclaba en el chat; Mi día no tiene `chat-composer` ni «En qué te ayudo».
# Un fallo del INSTRUMENTO leído como fallo del producto.
#
# LAS DOS MITADES (arreglar el falso rojo sin esta segunda es cambiarlo por un falso VERDE, que es peor):
#   1. Mi día / chat / panel plegado  -> True
#   2. login en primer plano          -> False, y TAMBIÉN False si el login trae un ancla del shell colada
#   + CONTROL DEL CONTROL: la lógica VIEJA tiene que dar False sobre el árbol de Mi día. Si diera True, el
#     fixture no reproduce el defecto y el verde de la mitad 1 no probaría nada.
#   + vacío: árbol None (el volcado falló) -> False, no excepción.
#
# ⚠️ ALCANCE DECLARADO: los fixtures son árboles SINTÉTICOS en formato uiautomator, armados con los testID
# que el código nativo declara (PanelDeslizable.tsx, PantallaMiDia.tsx, PantallaLogin.tsx). No son un
# volcado de device: `uiautomator dump` falla mientras la app anima («could not get idle state»). El control
# con la app REAL en Mi día (True) y en login (False) se corre en la pasada de device y se cita ahí.
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[ -r "$RAIZ/scripts/evidencia_device.py" ] || { echo "FALLA: no existe scripts/evidencia_device.py"; exit 1; }

python3 -I -X utf8 - "$RAIZ/scripts" <<'PY'
import sys
import xml.etree.ElementTree as ET
sys.path.insert(0, sys.argv[1])
import evidencia_device as e

def arbol(*nodos):
    """nodos: (resource-id corto | '', text). Formato real de uiautomator."""
    items = "".join(
        f'<node resource-id="{("app.copiloto.emprendedor:id/" + r) if r else ""}" text="{t}" '
        f'content-desc="" bounds="[0,0][100,100]" />' for r, t in nodos)
    return ET.fromstring(f'<hierarchy rotation="0"><node resource-id="" text="" bounds="[0,0][720,1600]">{items}</node></hierarchy>')

NATIVO = [("action_bar_root", ""), ("content", ""), ("navigationBarBackground", "")]
MI_DIA = arbol(*NATIVO, ("midia-chips", ""), ("midia-alta-texto", "Llamar al proveedor"), ("panel-handle", ""), ("panel-hint", "Escribile a Odobi"))
MI_DIA_SOLO_TEXTO = arbol(*NATIVO, ("", "Escribile a Odobi"))
CHAT = arbol(*NATIVO, ("chat-composer", ""), ("", "En qué te ayudo"))
LOGIN = arbol(*NATIVO, ("login-screen", ""), ("login-email", ""), ("login-password", ""), ("login-submit", "Entrar"))
LOGIN_CON_ANCLA_COLADA = arbol(*NATIVO, ("login-screen", ""), ("panel-handle", ""))
SOLO_NATIVO = arbol(*NATIVO)

def viejo(raiz):  # la lógica de ANTES del fix
    return e.buscar_en(raiz, "chat-composer") is not None or e.buscar_en(raiz, texto="En qué te ayudo") is not None

fallos = 0
def check(desc, esperado, obtenido):
    global fallos
    if esperado == obtenido: print("  ok   " + desc)
    else: print(f"  FALLA {desc}: esperado {esperado!r}, obtenido {obtenido!r}"); fallos += 1

check("1a Mi día (testIDs)            -> True ", True, e.hay_shell(MI_DIA))
check("1b Mi día (sólo texto visible) -> True ", True, e.hay_shell(MI_DIA_SOLO_TEXTO))
check("1c chat                        -> True ", True, e.hay_shell(CHAT))
check("2a login en primer plano       -> False", False, e.hay_shell(LOGIN))
check("2b login + ancla del shell colada -> False (login-screen gana)", False, e.hay_shell(LOGIN_CON_ANCLA_COLADA))
check("2c árbol sólo nativo           -> False", False, e.hay_shell(SOLO_NATIVO))
check("3  árbol None (volcado falló)  -> False", False, e.hay_shell(None))
check("CONTROL DEL CONTROL: la lógica VIEJA sobre Mi día da False (reproduce el falso rojo)", False, viejo(MI_DIA))
check("CONTROL DEL CONTROL: la lógica VIEJA sobre el chat da True (el fixture del chat es válido)", True, viejo(CHAT))
sys.exit(1 if fallos else 0)
PY
rc=$?
[ $rc -eq 0 ] && echo "OK: en_el_shell reconoce el shell en Mi día y chat, y NO el login" || echo "FALLA: $rc caso(s)"
exit $rc
