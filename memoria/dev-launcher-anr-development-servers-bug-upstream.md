---
name: dev-launcher-anr-development-servers-bug-upstream
description: "El dev-client (expo-dev-launcher 57.0.7) ANR-ea al reconectar a Metro — bug upstream de Expo sin fix publicado. Receta confirmada: modo avión + adb reverse + Connect + avión OFF"
metadata:
  type: project
---

**2026-07-23.** El teléfono del operador quedó "colgado" (ANR reproducible, 4/4 intentos) al intentar
reconectar el dev-client a un Metro nuevo después de que frontend matara el proceso viejo (que servía
la rama congelada `feat/mobile-first-cascara-glass`, 47 commits atrás de `main`).

**Síntoma:** cualquier camino hacia la pantalla home/Connect del dev-launcher (Connect manual, ENTER,
deep-link `copiloto://expo-development-client/?url=...`, con `127.0.0.1` explícito) termina en
`errorType=anr` (`Waited ~10007ms for FocusEvent`) o en un `DevLauncherErrorActivity` que se crea y
destruye. Antes de cada intento aparece un sheet: *"Log in or create an account to view local
development servers"*.

**Causa raíz, aislada con dos controles reales (no supuesta):**
1. `adb reverse tcp:8081` + `http://localhost:8081/status` desde el navegador del device → `200
   packager-status:running`. Descarta el túnel/Metro — están sanos.
2. Modo avión (radios off, USB vivo) + logcat completo (`-b crash -b main -v threadtime`) durante el
   mismo intento que antes ANR-eaba → **CERO líneas de ANR**, el mismo sheet de login aparece pero
   falla rápido en vez de colgar. **Es un fetch de red en el hilo de UI** (la feature "Development
   Servers" ligada a cuenta EAS) — con red disponible tarda ~10s hasta que el sistema mata la app; sin
   red, falla rápido y no cuelga.

**V-EXT contra el changelog CRUDO de `expo-dev-launcher`** (`raw.githubusercontent.com/expo/expo/main/
packages/expo-dev-launcher/CHANGELOG.md`, no un resumen ni un issue de comunidad): la sección
`## Unpublished` (o sea, en NINGÚN release, ni siquiera `57.0.8`) tiene, justo en esta área:
- `[Android] Discover packagers across all connected networks on Android 33+` (#46487)
- `[Android] Fix auto-launching into the most recently opened project on startup` (#47131)
- `[Android] Fix onUserLeaveHint NPE and lost EAS sign-in redirect` (#47347)
- `[iOS] Make the development server list reliable...` (#46811, iOS pero confirma que Expo mismo
  considera la feature poco confiable en cualquier plataforma HOY)

**Conclusión: bug upstream de Expo, conocido por el propio equipo (lo están reescribiendo ahora
mismo), sin fix publicado.** Bumpear `expo-dev-client` a `~57.0.8` NO alcanza — los fixes relevantes
todavía no están en ningún release.

## La receta que DESTRABA sin rebuild — confirmada en device, 2026-07-23

El operador quedó bloqueado en pleno uso (pantalla del dev-launcher, app no inicializaba). Backend
midió esto en el device real:

1. Modo avión **ON** (confirmado por ícono ✈ — mata WiFi/datos, deja el USB vivo).
2. `adb reverse tcp:8081 tcp:8081` — el túnel es por cable, no depende de la red del teléfono.
3. `am force-stop` + relanzar la `MainActivity`.
4. En la pantalla del dev-launcher: tocar el campo, escribir `http://localhost:8081`, tocar **Connect**
   (⚠️ NO un deep-link — ver el gotcha de cold-launch más abajo).
5. Metro bundleó y sirvió (`Android Bundled ... entry.js` en el log) — **cero ANR** en logcat.
6. Recién ahí, **modo avión OFF** — la app se queda estable en el bundle ya cargado, no revierte al
   dev-launcher ni crashea.

**Por qué funciona:** en avión, el fetch de cuenta EAS de "Development Servers" (la causa raíz, ver
abajo) falla RÁPIDO en vez de colgar 10s hasta el ANR — y como `adb reverse` es USB, el bundle sigue
alcanzable aunque no haya radio. Es reproducible: si el dev-client vuelve a caer en la pantalla home
(Metro se reinicia, se pierde la conexión), repetir esta secuencia antes de asumir que hace falta un
rebuild.

🔴 **Gotcha: el deep-link `<scheme>://expo-development-client/?url=...` NO sirve para esto si es
cold-launch** (con `force-stop` antes). La doc oficial de Expo (`docs.expo.dev/develop/development-
builds/development-workflows/`) dice textual: *"Cold-launching a development build with an
app-specific deep link is not currently supported."* Usar el campo de texto **Connect** de la propia
UI del home screen, no un intent entrante — por eso el paso 4 de arriba es UI manual, no deep-link.

## El cierre real (no sólo el parche): build standalone de `main`

La receta de arriba destraba el USO del dev-client (bueno para iterar con live-reload), pero el DoD de
cierre del sprint (`§6.6`) pide el teléfono corriendo `main` sin depender de Metro en absoluto — ahí sí
vale un **build standalone** (`eas.json` profile `preview`: APK, `distribution: internal`, sin
`developmentClient`). Corre el JS bundleado, sin dev-launcher, sin la feature de cuenta — sidestepea
el bug entero, UNA vez, al final.

**`eas build` en la nube NO necesita el toolchain Android local** (SDK/gradle/Java) — corre en los
servidores de Expo. Sólo hace falta `eas-cli` autenticado. Verificado en esta sesión: `npx eas-cli
whoami` devolvió una sesión YA autenticada (`341lin`, vía `EXPO_TOKEN` cacheado) — no hizo falta
esperar al operador para loguearse.

**Gotcha del build desde un worktree:** `eas build` resuelve los config plugins (`expo-router`, etc.)
LOCALMENTE antes de subir el paquete — si corrés el build desde un `git worktree` recién creado sin
`node_modules`, falla con `Failed to resolve plugin for module "expo-router"`. Mismo fix que el de
Metro: junctions por-entrada al `node_modules` del checkout principal, con `@copiloto/core`
re-apuntado al `packages/core` **del worktree** (el symlink de npm workspaces es absoluto y por
default apunta al checkout viejo — ver [[copiloto-mobile-first-cascara-glass]] para el detalle
completo de ese fix).

## Qué NO hacer

No lanzar un build por cada fix — el build no da live-reload, es el ÚLTIMO paso, no el vehículo de
debug (corrección del operador tras un primer intento mío de usarlo como tal). No bumpear
`expo-dev-client` esperando que el bump traiga el fix (no está publicado). No downgradear la versión
sin escalar — es MAYOR (rebuild + elegir qué versión, costo/tiempo de build). No correr `pm clear
app.copiloto.emprendedor` sin avisar al operador — borra sesión/estado real del device físico.

[[copiloto-mobile-first-cascara-glass]] · [[no-codificar-la-esperanza-principio-raiz]] · [[vacio-no-es-hallazgo-correr-el-control]]
