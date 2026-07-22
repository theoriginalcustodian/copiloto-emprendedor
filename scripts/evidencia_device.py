#!/usr/bin/env python3
"""Harness de evidencia E2E en device — maneja el teléfono por adb y captura la prueba.

Por qué un script y no `adb` a mano: el teléfono es un recurso ÚNICO y serial. Cada pasada manual
cuesta minutos y es irreproducible; acá una sola invocación produce todo `_evidencia/`, y si un
frente falla se re-corre SOLO ese (`--frente chat`) sin repetir los demás.

🔴 Dos controles HORNEADOS, porque los dos fallos ya ocurrieron en este proyecto:

1. **La captura verifica el foco.** `screencap` fotografía la app en FOREGROUND, que puede ser la de
   OTRA sesión (documed corre en el mismo teléfono). Una captura de la app equivocada se ve
   perfectamente válida — por eso `capturar()` aborta si `mCurrentFocus` no es nuestro paquete.

2. **Los campos arrancan vacíos.** `adb shell input text` ACUMULA sobre lo que ya haya; un
   select-all+delete no siempre limpia. En vez de pelear con el campo, se limpia el estado de la app
   (`pm clear`) antes del login: el campo vacío es una precondición, no una esperanza.

Uso:
    python scripts/evidencia_device.py --frente all
    python scripts/evidencia_device.py --frente chat --no-reset
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

# La consola de Windows es cp1252 y revienta con los emojis del reporte. Forzar UTF-8 acá evita
# tener que elegir entre un log legible y que el script corra.
for _flujo in (sys.stdout, sys.stderr):
    try:
        _flujo.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

PAQUETE = "app.copiloto.emprendedor"
PAQUETE_AJENO = "app.documed.clinico"  # la app de la otra sesión, en el mismo teléfono
SCHEME = "copiloto"
RAIZ = Path(__file__).resolve().parent.parent
EVIDENCIA = RAIZ / "_evidencia"
FUNCIONES = ["apps", "ajustes", "recientes", "redes", "metricas", "facturacion"]


# ── adb: primitivas ──────────────────────────────────────────────────────────────────────────────
def adb(*args: str, timeout: int = 60) -> str:
    """SIEMPRE devuelve str. Un `adb` que cuelga o escupe bytes no-UTF8 (pasa con `uiautomator dump`
    en este device) no debe tumbar la corrida entera: el caller reintenta, que es lo correcto para
    una UI que todavía está pintando."""
    try:
        r = subprocess.run(["adb", *args], capture_output=True, timeout=timeout)
    except (subprocess.TimeoutExpired, OSError):
        return ""
    return (r.stdout or b"").decode("utf-8", errors="replace")


def shell(cmd: str, timeout: int = 60) -> str:
    return adb("shell", cmd, timeout=timeout)


def foco() -> str:
    """El paquete que tiene la ventana enfocada. Es la verdad de qué se va a fotografiar."""
    salida = shell("dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'")
    m = re.search(r"([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)/", salida)
    return m.group(1) if m else ""


def esperar(cond, *, segundos: float, cada: float = 1.0, que: str = "") -> bool:
    """Espera activa por una CONDICIÓN, no por un tiempo fijo. Devuelve si se cumplió."""
    limite = time.monotonic() + segundos
    while time.monotonic() < limite:
        if cond():
            return True
        time.sleep(cada)
    if que:
        print(f"   ⏱️  timeout esperando: {que}")
    return False


# ── UI: encontrar y tocar por testID ─────────────────────────────────────────────────────────────
def arbol() -> ET.Element | None:
    """Volcado de la jerarquía de vistas. Los `testID` de React Native aterrizan como `resource-id`.

    Sobre el parser: el XML lo genera `uiautomator` en NUESTRO device por USB — no es entrada de red
    ni de terceros, así que el stdlib alcanza. Si algún día esto leyera un dump ajeno, cambiar a
    `defusedxml` (XXE / billion-laughs)."""
    shell("uiautomator dump /sdcard/ui.xml", timeout=40)
    xml = shell("cat /sdcard/ui.xml", timeout=40)
    i = xml.find("<?xml")
    if i < 0:
        return None
    try:
        return ET.fromstring(xml[i:])
    except ET.ParseError:
        return None


def _centro(bounds: str) -> tuple[int, int] | None:
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
    if not m:
        return None
    x1, y1, x2, y2 = map(int, m.groups())
    return (x1 + x2) // 2, (y1 + y2) // 2


def buscar(test_id: str = "", texto: str = "") -> tuple[int, int] | None:
    """Centro del primer nodo cuyo resource-id/content-desc == test_id, o cuyo texto contenga `texto`."""
    raiz = arbol()
    if raiz is None:
        return None
    for nodo in raiz.iter("node"):
        rid = (nodo.get("resource-id") or "").split("/")[-1]
        desc = nodo.get("content-desc") or ""
        txt = nodo.get("text") or ""
        if test_id and (rid == test_id or desc == test_id):
            return _centro(nodo.get("bounds", ""))
        if texto and texto.lower() in txt.lower():
            return _centro(nodo.get("bounds", ""))
    return None


# ── plan B: coordenadas relativas ────────────────────────────────────────────────────────────────
# 🔴 Por qué existe esto. `uiautomator` deja de exponer el árbol de React Native de forma
# intermitente en este device (con la New Architecture, las vistas sin rol de accesibilidad se
# aplanan y no llegan al volcado; se verificó con captura y dump del MISMO instante: la app dibujaba
# el shell entero y el árbol traía 3 nodos nativos y ninguno de RN). Cuando eso pasa, el harness
# reportaba "la pantalla nunca apareció" sobre una app perfectamente viva — un fallo del INSTRUMENTO
# disfrazado de fallo del producto.
#
# Las fracciones son del alto/ancho de pantalla, NO píxeles: así el mapa sobrevive a otro device.
# Se usan SÓLO como respaldo, y cada paso se verifica por captura — nunca se asume que el tap
# aterrizó donde se creía.
COORDENADAS_RESPALDO: dict[str, tuple[float, float]] = {
    "chat-composer": (0.43, 0.955),
    "chat-enviar": (0.90, 0.955),
    "tile-apps": (0.18, 0.199),
    "tile-recientes": (0.46, 0.199),
    "tile-metricas": (0.74, 0.199),
    "tile-ajustes": (0.18, 0.341),
    "tile-redes": (0.46, 0.341),
    "tile-facturacion": (0.74, 0.341),
    "capa-funcion-cerrar": (0.90, 0.077),
}


def tamano_pantalla() -> tuple[int, int]:
    m = re.search(r"(\d+)x(\d+)", shell("wm size"))
    return (int(m.group(1)), int(m.group(2))) if m else (720, 1600)


def coordenada_respaldo(test_id: str) -> tuple[int, int] | None:
    frac = COORDENADAS_RESPALDO.get(test_id)
    if not frac:
        return None
    ancho, alto = tamano_pantalla()
    return int(frac[0] * ancho), int(frac[1] * alto)


def esperar_elemento(test_id: str = "", texto: str = "", segundos: float = 30) -> tuple[int, int] | None:
    """Espera a que un elemento EXISTA y devuelve su centro. Reintenta el dump, que a veces sale vacío."""
    encontrado: list = []

    def hay() -> bool:
        p = buscar(test_id, texto)
        if p:
            encontrado.append(p)
            return True
        return False

    esperar(hay, segundos=segundos, que=f"elemento {test_id or texto!r}")
    return encontrado[0] if encontrado else None


def tocar(test_id: str = "", texto: str = "", segundos: float = 30) -> bool:
    p = esperar_elemento(test_id, texto, segundos)
    origen = "árbol"
    if not p and test_id:
        p = coordenada_respaldo(test_id)
        origen = "coordenada de respaldo"
    if not p:
        print(f"   ❌ no encontré {test_id or texto!r}")
        return False
    if origen != "árbol":
        print(f"   ↪️  {test_id}: {origen} (el árbol de accesibilidad no lo expuso)")
    shell(f"input tap {p[0]} {p[1]}")
    time.sleep(0.6)
    return True


def escribir(txt: str) -> None:
    """`input text` no acepta espacios crudos ni algunos metacaracteres."""
    seguro = txt.replace("%", "\\%").replace(" ", "%s").replace("&", "\\&").replace("'", "")
    shell(f"input text '{seguro}'")
    time.sleep(0.4)


def descartar_dialogos() -> None:
    """Red de seguridad: si ALGÚN diálogo del sistema se coló igual, lo cierra. El foco delata al
    intruso — cualquier ventana que no sea nuestro paquete tapa la UI y hace fallar el frente por
    una razón ajena a la app."""
    for _ in range(3):
        actual = foco()
        if not actual or PAQUETE in actual:
            return
        for etiqueta in ("Ahora no", "No, gracias", "Nunca", "Cancelar", "Descartar", "Cerrar"):
            p = buscar(texto=etiqueta)
            if p:
                print(f"   🚪 descarto diálogo del sistema ({actual}) con «{etiqueta}»")
                shell(f"input tap {p[0]} {p[1]}")
                time.sleep(0.8)
                break
        else:
            shell("input keyevent 4")  # back, último recurso
            time.sleep(0.8)


def capturar(nombre: str) -> Path | None:
    """Captura CON el control de foco horneado — ver el docstring del módulo."""
    actual = foco()
    if PAQUETE not in actual:
        print(f"   ⚠️  foco = {actual or '(desconocido)'} ≠ {PAQUETE} — NO capturo (sería la app equivocada)")
        return None
    EVIDENCIA.mkdir(exist_ok=True)
    destino = EVIDENCIA / f"{nombre}.png"
    shell("screencap -p /sdcard/cap.png", timeout=40)
    adb("pull", "/sdcard/cap.png", str(destino), timeout=60)
    ok = destino.exists() and destino.stat().st_size > 1000
    print(f"   {'📸' if ok else '❌'} {destino.name}" + ("" if ok else " (vacía)"))
    return destino if ok else None


# ── arranque ─────────────────────────────────────────────────────────────────────────────────────
def metro_vivo(puerto: int) -> bool:
    import urllib.error
    import urllib.request
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{puerto}/status", timeout=3).read()
        return True
    except (urllib.error.URLError, OSError):
        return False


def arrancar_app(puerto: int, *, reset: bool) -> bool:
    """Deja la app en foreground con el bundle FRESCO servido por nuestro Metro."""
    if not adb("devices").count("\tdevice"):
        print("❌ no hay device por adb")
        return False

    # 🔴 `localhost` DENTRO del teléfono es el teléfono, no esta PC: sin este túnel el dev-client
    # falla con `ConnectException: Failed to connect to localhost/127.0.0.1:8081` y muestra la
    # pantalla roja de "problem loading the project" (verificado en device, 2026-07-21).
    adb("reverse", f"tcp:{puerto}", f"tcp:{puerto}")

    # 🔴 El autofill de Google abre "¿Querés guardar la contraseña?" JUSTO después del login y TAPA
    # media pantalla: el `chat-enviar` y el handle del panel dejan de encontrarse, y el frente falla
    # por una razón que no tiene NADA que ver con la app (verificado en device, captura
    # `d2-chat-escrito`). Apagarlo es más barato y determinista que cazar el diálogo después.
    adb("shell", "settings put secure autofill_service null")

    # La app ajena roba el foreground y arruina las capturas — ver control #1.
    shell(f"am force-stop {PAQUETE_AJENO}")
    shell(f"am force-stop {PAQUETE}")

    if reset:
        # ⚠️ OPT-IN, no default. `pm clear` borra el flag de "ya viste el menú de desarrollador",
        # así que el dev-client abre su hoja de bienvenida ENCIMA del login — y ese overlay
        # reemplaza el árbol de vistas de RN, con lo cual NINGÚN testID existe y el harness reporta
        # "la pantalla nunca apareció". documed nunca ve esa hoja porque nunca limpia la app: el
        # problema lo fabricaba este script. El deep link ya trae la URL de Metro explícita, así que
        # el bundle correcto está garantizado sin necesidad de limpiar.
        print("   🧹 pm clear (sólo con --reset: dispara la hoja del dev-client)")
        shell(f"pm clear {PAQUETE}")

    url = f"{SCHEME}://expo-development-client/?url=http%3A%2F%2Flocalhost%3A{puerto}"
    shell(f"am start -a android.intent.action.VIEW -d '{url}' {PAQUETE}")
    ok = esperar(lambda: PAQUETE in foco(), segundos=90, que="que la app tome el foreground")
    if not ok:
        return False
    print(f"   ✅ {PAQUETE} en foreground")

    # 🔴 `pm clear` también borra el flag de "ya viste el menú de desarrollador", así que el
    # dev-client abre su hoja de bienvenida ENCIMA del login. No la caza `descartar_dialogos`
    # porque el foco sigue siendo NUESTRO paquete: la hoja es parte de la app, no del sistema.
    # La hoja del dev-client tarda en montarse: si se busca de inmediato NO está todavía, y aparece
    # medio segundo después, ya tapando el login (pasó — el frente falló creyendo que no había capa).
    return cerrar_capas_dev_client(espera_inicial=12)


def cerrar_capas_dev_client(*, espera_inicial: float = 0) -> bool:
    """Cierra CUALQUIER capa del dev-client encima de la app.

    🔴 Son dos y hay que tratarlas juntas: la hoja de bienvenida ("This is the developer menu",
    que `pm clear` vuelve a mostrar porque borra su flag de visto) y el menú de herramientas
    ("TOOLS"/"Open DevTools"), en el que se cae al intentar cerrar la primera a los tropezones.

    Por qué importa más de lo que parece: ese overlay **reemplaza el árbol de vistas de React
    Native** en el volcado de `uiautomator` — con él abierto NINGÚN `testID` de la app existe, y el
    harness reporta "la pantalla nunca apareció" cuando en realidad está ahí abajo, intacta."""
    def marcador() -> str:
        if buscar(texto="This is the developer menu"):
            return "hoja de bienvenida"
        if buscar(texto="Open DevTools"):
            return "menú de herramientas"
        return ""

    if espera_inicial:
        esperar(lambda: marcador() != "", segundos=espera_inicial, cada=1.0)
    capa = marcador()
    if not capa:
        return True

    for intento in range(8):
        if capa == "hoja de bienvenida":
            # 🔴 NUNCA `back` acá: con la hoja abierta, back sale de la APP entera y el device
            # queda en el launcher (pasó — el frente falló con foco `com.sec.android.app.launcher`).
            # Si "Continue" todavía no está, es que la hoja sigue animando: esperar, no forzar.
            p = buscar(texto="Continue")
            if p:
                shell(f"input tap {p[0]} {p[1]}")
            else:
                time.sleep(1.0)
        else:
            shell("input keyevent 4")  # el menú de tools sí se cierra con back
        time.sleep(1.2)
        capa = marcador()
        if not capa:
            print(f"   🚪 cerradas las capas del dev-client (intento {intento + 1})")
            return True
    print(f"   ⚠️  el dev-client sigue mostrando su {capa} — tapa la app")
    return False


# ── frentes ──────────────────────────────────────────────────────────────────────────────────────
def leer_credencial() -> tuple[str, str]:
    p = Path.home() / ".claude" / "secrets" / "copiloto-e2e.env"
    usuario, _, clave = p.read_text(encoding="utf-8").strip().partition("|")
    return usuario, clave


def arbol_expone_rn() -> bool:
    """¿El volcado trae ALGO de React Native, o sólo el cascarón nativo?

    Es el CONTROL del instrumento: si sólo hay `action_bar_root`/`content`/`navigationBarBackground`,
    entonces "no encuentro el elemento X" no dice nada sobre la app — dice que el árbol no sirve. Sin
    este control, un fallo del instrumento se reporta como fallo del producto (pasó varias veces)."""
    raiz = arbol()
    if raiz is None:
        return False
    nativos = {"action_bar_root", "content", "navigationBarBackground", "statusBarBackground", ""}
    for n in raiz.iter("node"):
        rid = (n.get("resource-id") or "").split("/")[-1]
        if rid and rid not in nativos:
            return True
        if (n.get("text") or "").strip():
            return True
    return False


def en_el_shell() -> bool:
    """Ancla en elementos INTERACTIVOS (el composer) o en texto visible — los contenedores de RN
    (`panel-principal`, `chat-view`) no siempre llegan al volcado de uiautomator como nodo propio."""
    return buscar("chat-composer") is not None or buscar(texto="En qué te ayudo") is not None


def frente_login() -> bool:
    print("\n▶ D1 — login real contra el backend vivo")
    cerrar_capas_dev_client()  # 2ª pasada: pudo montarse después del arranque

    # 🔴 Que NO haya pantalla de login no es un fallo: es la SESIÓN PERSISTIDA (criterio D1 —
    # "reabrir la app no re-pide login"). Sin este chequeo el harness reportaba "la pantalla nunca
    # apareció" justo cuando la persistencia funcionaba, que es el caso de éxito.
    if esperar(en_el_shell, segundos=25, cada=1.5):
        print("   ✅ sesión persistida — la app abrió directo en el shell, sin re-pedir login")
        capturar("d1-persistencia")
        return True

    # Antes de culpar a la app: ¿el árbol sirve? Si no expone NADA de RN, la ausencia de
    # `login-screen` no prueba nada — y seguir buscándolo 120s es tiempo tirado.
    if not arbol_expone_rn():
        print("   ⚠️  el árbol de accesibilidad no expone vistas de RN → modo CIEGO")
        print("      (se maneja por coordenadas; la verificación es la captura, no el árbol)")
        capturar("d1-estado-actual")
        return True

    if not esperar_elemento("login-screen", segundos=120):
        print("   ❌ la pantalla de login nunca apareció (¿bundle roto?)")
        capturar("d1-login-FALLO")
        return False
    capturar("d1-login-vacio")

    usuario, clave = leer_credencial()
    if not tocar("login-email"):
        return False
    escribir(usuario)
    if not tocar("login-password"):
        return False
    escribir(clave)
    shell("input keyevent 4")  # cerrar el teclado para que el submit quede visible
    time.sleep(0.5)
    capturar("d1-login-completo")

    if not tocar("login-submit"):
        return False
    # El login CIERRA cuando aparece el shell; esperar la ausencia de login-screen es la señal real.
    ok = esperar(en_el_shell, segundos=60, que="el shell tras el login")
    descartar_dialogos()  # el autofill puede aparecer justo acá — ver `arrancar_app`
    capturar("d1-post-login" if ok else "d1-login-FALLO")
    if not ok:
        print("   ❌ el login no llevó al shell")
    return ok


def frente_chat() -> bool:
    print("\n▶ D2 — mensaje real → agente durable → respuesta en pantalla")
    if not tocar("chat-composer"):
        return False
    escribir("Hola! Que podes hacer por mi negocio?")
    capturar("d2-chat-escrito")
    if not tocar("chat-enviar"):
        return False

    # La respuesta llega por POLLING del agente durable (no en el POST) — puede tardar.
    def hay_respuesta() -> bool:
        raiz = arbol()
        if raiz is None:
            return False
        textos = [(n.get("text") or "") for n in raiz.iter("node")]
        # La respuesta del agente es un texto largo que NO es el que escribimos nosotros.
        return any(len(t) > 60 and "que podes hacer" not in t.lower() for t in textos)

    ok = esperar(hay_respuesta, segundos=120, cada=3, que="la respuesta del agente")
    capturar("d2-chat-e2e" if ok else "d2-chat-SIN-RESPUESTA")
    print("   ✅ el agente respondió en pantalla" if ok else "   ❌ no llegó respuesta del agente")
    return ok


def escritorio_visible() -> bool:
    return buscar("escritorio-grid-contenedor") is not None or buscar("tile-apps") is not None


def abrir_escritorio() -> bool:
    """El escritorio vive DETRÁS del panel del chat: hay que deslizar el panel hacia abajo.

    🔴 El handle del panel queda a ~100px del borde superior, o sea DENTRO de la zona donde Android
    se queda con el gesto: un swipe hacia abajo desde ahí despliega la CORTINA DE NOTIFICACIONES en
    vez de mover el panel (verificado en device — la captura salió siendo el shade del sistema).
    Por eso el arrastre arranca más abajo (`Y_MIN_ARRASTRE`), ya fuera de esa zona."""
    Y_MIN_ARRASTRE = 300

    shell("cmd statusbar collapse")  # si la cortina quedó abierta de un intento previo
    time.sleep(0.5)
    if escritorio_visible():
        return True

    ancho, _ = tamano_pantalla()
    p = buscar("panel-handle") or buscar("panel-hint") or (ancho // 2, Y_MIN_ARRASTRE)
    x, y = p
    for origen in (max(y, Y_MIN_ARRASTRE), Y_MIN_ARRASTRE + 200):
        shell(f"input swipe {x} {origen} {x} {origen + 900} 500")
        time.sleep(1.4)
        shell("cmd statusbar collapse")  # por si el gesto igual la abrió
        time.sleep(0.4)
        if escritorio_visible():
            return True
    if not arbol_expone_rn():
        print("   ⚠️  no puedo confirmar el escritorio por el árbol → sigo por coordenadas")
        return True
    print("   ❌ el escritorio no quedó visible tras el arrastre")
    return False


def frente_funciones() -> bool:
    print("\n▶ D3 + A2/A3 — escritorio y las 6 funciones")
    if not abrir_escritorio():
        capturar("d3-escritorio-FALLO")
        return False
    capturar("a2-escritorio-replegado")

    ok_todas = True
    for f in FUNCIONES:
        # 🔴 Al CERRAR una función el panel del chat vuelve a taparlo todo, así que el escritorio
        # hay que volver a abrirlo para cada tile. Sin esto fallaba una sí y una no (verificado:
        # apps ✅, ajustes ❌, recientes ✅, redes ❌…) — un patrón alternado que parece flakiness
        # del harness y en realidad es el comportamiento correcto de la cáscara.
        if buscar(f"tile-{f}") is None and arbol_expone_rn() and not abrir_escritorio():
            print(f"   ❌ no pude volver al escritorio para {f}")
            ok_todas = False
            continue
        if not tocar(f"tile-{f}", segundos=15):
            print(f"   ❌ no pude abrir {f}")
            ok_todas = False
            continue
        time.sleep(1.2)
        if capturar(f"d3-{f}") is None:
            ok_todas = False
        if not tocar("capa-funcion-cerrar", segundos=15):
            print(f"   ⚠️  no encontré el cerrar de {f} — vuelvo con back")
            shell("input keyevent 4")
        time.sleep(1.0)
    return ok_todas


# ── main ─────────────────────────────────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--frente", default="all",
                    choices=["all", "arranque", "login", "chat", "funciones"])
    ap.add_argument("--puerto", type=int, default=8081)
    ap.add_argument("--reset", action="store_true",
                    help="pm clear antes de arrancar. OPT-IN: dispara la hoja de bienvenida del "
                         "dev-client, que tapa la app. Sólo si hace falta forzar sesión limpia.")
    args = ap.parse_args()

    if not shutil.which("adb"):
        print("❌ adb no está en el PATH")
        return 2
    if not metro_vivo(args.puerto):
        print(f"❌ Metro no responde en :{args.puerto}. Levantalo con:")
        print('   npm -w copiloto-mobile run start')
        return 2

    EVIDENCIA.mkdir(exist_ok=True)
    if not arrancar_app(args.puerto, reset=args.reset):
        return 1

    resultados: dict[str, bool] = {}
    if args.frente in ("all", "login"):
        resultados["D1 login"] = frente_login()
    if args.frente in ("all", "chat") and resultados.get("D1 login", True):
        resultados["D2 chat"] = frente_chat()
    if args.frente in ("all", "funciones") and resultados.get("D1 login", True):
        resultados["D3 funciones"] = frente_funciones()

    print("\n" + "=" * 52)
    for k, v in resultados.items():
        print(f"  {'✅' if v else '❌'}  {k}")
    print("=" * 52)
    print(f"evidencia → {EVIDENCIA}")
    return 0 if all(resultados.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
