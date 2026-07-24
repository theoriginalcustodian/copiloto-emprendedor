# Harness E2E — cierre acumulativo de sprint (contrato DEVICE-AL-DIA)

> Preparado por BACKEND en frío, mientras frontend produce el build standalone de `main`
> (`dato_planificacion-a-todos_el-workaround-es-un-build-standalone-de-main-no-el-dev-client.md`).
> Objetivo: en cuanto el APK/AAB caiga, instalar → correr → adjuntar evidencia → cerrar cada frente,
> sin descubrir rótulos ni pelear el device a ciegas en el momento.

## 0. ⚠️ Advertencia de branch — verificar ANTES de tapear IN

Mi checkout local (`feat/mobile-first-cascara-glass`) está **79 commits detrás de `origin/main`** (y
26 adelante — divergió). Todo lo de abajo está verificado contra `origin/main` (vía `git show`, sin
tocar el checkout compartido), **salvo que se aclare lo contrario**.

**El caso que importa de verdad:** `PantallaInteligencia` tiene DOS versiones.
- La rama por defecto (y `main` hasta que se mergee #78) **NO tiene** solapas ni gráficos ni chat —
  sólo la portada.
- Las solapas **"Resumen"/"Preguntar"** + 4 gráficos + chat viven en PR #78
  (`feat/inteligencia-wiring-graficos-y-chat`, worktree `_wt-device-main`), **todavía sin mergear**
  ("no lo mergeo hasta que haya compuerta de device" — frontend).

**Antes de correr el frente IN:** confirmar con qué ref está buildeado el APK. Si es `main` sin #78
mergeado, IN se cierra parcial ("portada OK, gráficos/chat pendientes de wiring" — ya lo bajó
planificación en `dato_..._extende-el-E2E-al-backlog...`, no es bug de device).

## 1. Tenant de prueba — LOGINABLE por la pantalla del device

**Canónico, lockeado a fuego** (`memoria/usuario-de-prueba-canonico-uno-solo-a-fuego.md`) — no crear
otro, no pedir la credencial de nuevo. Fuente reproducible: `.env.e2e` (raíz del repo, gitignored).

Distinto del `sub` HTTP-only de frontend (`e2e7e57e-...0001`, sin usuario GoTrue real — no sirve para
tapear el login). Este pasa por `/auth/signup` real, mismo camino que un alta real:

```
email       = e2e-device@copiloto.test
password    = E2eDevice2026!
cliente_id  = 4f3ecb78-2e36-4044-a56e-0e7ef6c4a655
auth_user_id= e0cbce79-a20d-4b28-8ea0-74a6e1bc7707
```

Verificado por HTTP contra el vivo (no asumido): `signup` 200, `login` 200, `GET /gastos` `/gastos/resumen`
`/presupuestos` `/perfil-negocio` todos 200 con datos vacíos (tenant nuevo, sin ensuciar). Script de
provisioning (idempotente, reusable si hace falta recrear): scratchpad de esta sesión,
`provisionar_tenant_device.py` — pedir si hace falta.

**Nunca el tenant del operador.** El device escribe real (memoria: `device-fisico-exige-dueno-unico.md`).

## 2. Login / logout en el device (pantallas + `testID`)

`apps/mobile/src/modules/auth/PantallaLogin.tsx`:
- Campo Email: `testID="login-email"` (debajo del label "Email")
- Campo Contraseña: `testID="login-password"` (debajo del label "Contraseña")
- Botón: **"Entrar"**, `testID="login-submit"`
- Error visible si falla: `testID="login-alert"` — *"Email o contraseña incorrectos. Probá de nuevo."*

Logout (`Ajustes → Cuenta`, `apps/mobile/app/ajustes-cuenta.tsx`):
- Botón: **"Cerrar sesión"** (`testID="cuenta-cerrar-sesion"`) → confirma con **"Sí, cerrar sesión"**
  (`testID="cuenta-cerrar-sesion-si"`)

**Secuencia adb (screenshot-guiado, NO coordenadas fijas — el layout se corre según haya banners; ver
§4):**
```bash
adb shell input tap <x_email> <y_email>; adb shell input text "e2e-device@copiloto.test"
adb shell input tap <x_pass> <y_pass>;   adb shell input text "E2eDevice2026!"
adb shell input tap <x_entrar> <y_entrar>
```
Capturar screenshot ANTES de cada tap para confirmar coordenadas (lección de la sesión: tapear a
ciegas con coordenadas de un screenshot viejo pega en el lugar equivocado si el layout se corrió).

## 3. Navegación — usar DEEP LINKS, no tapear el escritorio a ciegas

`app.json` registra `"scheme": "copiloto"` y expo-router expone cada ruta de `apps/mobile/app/*.tsx`
como deep link. Mucho más robusto que tapear tiles:

```bash
adb shell am start -a android.intent.action.VIEW -d "copiloto://gastos"
adb shell am start -a android.intent.action.VIEW -d "copiloto://ingresos"
adb shell am start -a android.intent.action.VIEW -d "copiloto://presupuestos"
adb shell am start -a android.intent.action.VIEW -d "copiloto://clientes"
adb shell am start -a android.intent.action.VIEW -d "copiloto://recientes"
adb shell am start -a android.intent.action.VIEW -d "copiloto://inteligencia"
adb shell am start -a android.intent.action.VIEW -d "copiloto://midia"
adb shell am start -a android.intent.action.VIEW -d "copiloto://ajustes-cuenta"
```
**No confirmado empíricamente todavía** (`[ASSUMED_PENDING_VERIFY]` — el registro del scheme está en
el manifest, pero no probé un deep link contra el build nuevo en esta sesión). Primer paso al tener el
APK: probar uno (`copiloto://gastos`) y confirmar que abre la pantalla correcta antes de asumir el resto.
Si falla, degradar a tap sobre el tile del escritorio (rótulos exactos en §5).

## 4. Freeze — el gesto y el botón, con `testID`

`MarcoGlass` (compartido por las 9 pantallas): cierre por **botón** "Volver" (`testID="glass-volver"`,
arriba a la derecha) o por **gesto** — arrastrar hacia abajo la zona handle+identidad
(`testID="glass-zona-arrastre-identidad"`) más de 140px, o un flick rápido. Candidato de regresión:
**"Mi día"** (`/midia`) en su estado `no_disponible` — es el repro documentado del bug de PR #77.

## 5. Recorrido por frente — rótulos exactos + oráculo HTTP (antes/después, no la pantalla)

Patrón general de verificación: **GET al endpoint ANTES de la acción en el device, GET DESPUÉS,
comparar** — no confiar en lo que dice la pantalla sola (memoria: "instrumentos-que-confirman-en-vez-de-verificar").
Usar el JWT del tenant de prueba (§1) vía `httpx`, mismo patrón que usé toda la sesión.

| Frente | Ruta | Botón alta | Oráculo HTTP | Evidencia |
|---|---|---|---|---|
| **IN — Resumen** (si #78 está) | `/inteligencia`, solapa **"Resumen"** | — | `GET /inteligencia/portada` + 4x `GET /inteligencia/graficos/*` (`facturacion`, `entro-vs-salio`, `categorias`, `margen-trabajo`) | `e2e-in-01-resumen.png` |
| **IN — Preguntar** (si #78 está) | solapa **"Preguntar"**, placeholder *"Preguntale a tu copiloto..."* | — | `POST /inteligencia/chat {"texto": "..."}` → comparar `respuesta`/`fuente` con lo que muestra el chat | `e2e-in-02-chat.png` |
| **Voz** | mic global del chat (`testID="boton-voz"`, ChatView, NO una pantalla propia) | mantener=graba, soltar=envía, deslizar arriba=fija (controles "Pausar"/"Reanudar"/"Enviar"/"Eliminar") | según qué se dicte (p.ej. un gasto → `GET /gastos/resumen`) | `e2e-voz-01-grabando.png`, `e2e-voz-02-enviado.png` |
| **Freeze** | cualquier función, `/midia` recomendado | — (no escribe datos) | n/a — verificar `dumpsys activity activities \| grep mResumedActivity` vuelve a la pantalla previa, sin ANR/crash en logcat | `e2e-freeze-01-antes.png`, `e2e-freeze-02-cerrado.png` |
| **Gastos** | `/gastos`, botón **"Anotar un gasto"** (`testID="gastos-nuevo"`) | campos: monto (`gasto-monto`), categoría (`gasto-categoria`), proveedor/medio-pago/detalle opcionales; **"Guardar"** | `GET /gastos` + `GET /gastos/resumen` antes/después | `e2e-gastos-01-alta.png` |
| **Ingresos** | `/ingresos`, botón **"Anotar que me pagaron"** (`testID="ingresos-nuevo"`) | monto, de-quién/cómo/por-qué-trabajo opcionales; **"Anotar"** | `GET /ingresos` antes/después | `e2e-ingresos-01-alta.png` |
| **Presupuestos** | `/presupuestos`, botón **"Nuevo presupuesto"** (`testID="presupuestos-nuevo"`) | concepto, cliente, tipo/número doc, contacto, ítems; **"Guardar presupuesto"** | `GET /presupuestos` antes/después | `e2e-presu-01-alta.png` |
| **Actividad reciente** | encabezado **"Actividad reciente"** en el escritorio (`testID="escritorio-encabezado-recientes"`) → `/recientes` | — (solo lectura) | `GET /actividad` — debe reflejar TODO lo generado en los pasos previos de esta misma corrida | `e2e-actividad-01-lista.png` |
| **Clientes** | `/clientes`, botón **"Nuevo cliente"** (`testID="clientes-nuevo"`) | nombre, tipo/número doc, domicilio, **email**, **teléfono**, notas; **"Dar de alta"** | `GET /clientes` antes/después | `e2e-clientes-01-alta.png` |
| **Clientes — dictado** | mic global → tarjeta `TarjetaClientePropuesto` en el chat, banner *"Esto entendí. Revisalo y tocá Dar de alta..."* | mismo `FormularioCliente` prellenado | `GET /clientes` antes/después | `e2e-clientes-02-dictado.png` |

**Vacíos esperados (para no leer un 0 como bug):** gastos *"Todavía no anotaste ningún gasto..."*,
ingresos *"Todavía no entró nada..."*, presupuestos *"Todavía no hiciste ningún presupuesto..."*,
clientes *"Tu cartera se va a armar sola..."*, actividad *"Todavía no hay movimientos..."*. El tenant
de prueba (§1) arranca en todos estos estados — son la línea de base, no un fallo.

## 6. Evidencia — convención

Todo en `_evidencia/` (flat, como ya se usa), prefijo `e2e-<frente>-<paso>-<qué>.png`. Antes/después de
cada oráculo HTTP: volcar el JSON crudo a `_evidencia/e2e-<frente>-http-antes.json` /
`...-http-despues.json` (no sólo "lo miré", el archivo es la prueba).

## 7. Al terminar cada frente

Emitir el `avance_`/`cierre_` §6 correspondiente con: build ref (§0), evidencia adjunta, resultado del
oráculo HTTP antes/después, y si es IN sin #78 mergeado, aclarar explícitamente "portada OK,
gráficos/chat pendientes de wiring — no es bug de device" (así lo pidió planificación).
