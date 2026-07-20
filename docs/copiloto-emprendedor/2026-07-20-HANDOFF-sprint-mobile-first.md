# HANDOFF — Sprint Mobile-First (estado al 2026-07-20 12:47)

> **Leer esto primero al retomar.** Plan completo en [`2026-07-20-plan-sprint-mobile-first.md`](2026-07-20-plan-sprint-mobile-first.md).
> **Rama:** `feat/mobile-first-cascara-glass` · 9 commits sobre `main` · **nada sin commitear**.
> **Suite:** 21 suites / 119 tests verdes + 55 de `@copiloto/core`. Typecheck limpio en ambos.

---

## 1. Qué es este sprint

Clonar la **cáscara visual** de la app mobile de documed al copiloto. Mobile-first: la web
(`apps/copiloto-web`) queda como vía secundaria y **no se toca**.

Fuente pinneada: `documed@a6841474` (rama `feat/frontend-h6-anclaje`). **documed es READ-ONLY**.

---

## 2. Estado por fase

| Fase | Estado | Nota |
|---|---|---|
| **PRE** — scripts | ✅ | S1–S7, idempotentes, en `scripts/sprint-mobile/` |
| **F1** — andamiaje + device | 🟡 | Proyecto Expo creado; **build en cola** (ver §3) |
| **F2** — spike del repliegue | 🟡 | **Instrumento listo. La medición necesita dedo humano** (§4) |
| **F3** — glass + shell | ✅ | 33 archivos, 5 skins, candados verdes |
| **F4** — 6 funciones | ✅ | Escritorio + las 6 cableadas |
| **F5** — chat E2E | 🟡 | **Código completo y verde en jest. SIN verificar en device** (§4.ter) |
| **F6** — voz Groq | ⬜ | No empezada. **No adelantar hasta que F5 esté verificada en device** |
| **F7** — índice de actividad | ⬜ | No empezada. Medir antes de construir |

---

## 3. El build (lo primero al retomar)

- Proyecto: `@341lin/copiloto-emprendedor` — projectId `05317fbe-ca0e-4f46-a63e-6f47a1cb118a`
- Build en curso: **`241ff044-3d9c-4be0-bc3a-2a9257c71611`**, en cola desde las 12:00
- `EXPO_TOKEN` ya está en `~/.claude/settings.json` (bloque `env`) y en `~/.claude/secrets/expo.env`

```bash
# ver estado
bash scripts/sprint-mobile/S6-watch-build.sh 241ff044-3d9c-4be0-bc3a-2a9257c71611 60

# cuando termine: la URL del APK queda en _evidencia/apk-url.txt
curl -L -o app.apk "$(cat _evidencia/apk-url.txt)"
bash scripts/sprint-mobile/S3-device-harness.sh install app.apk
bash scripts/sprint-mobile/S3-device-harness.sh screencap 01-inicio
```

**Un build anterior (`ca42e7e9`) falló** en prebuild por assets ausentes. Ya está resuelto y S4
ahora valida sus propias referencias antes de dejar lanzar nada.

---

## 4. F2 — el gate, y por qué NO se puede cerrar solo

Procedimiento completo en [`spikes/repliegue-glass/COMO-CORRER.md`](../../spikes/repliegue-glass/COMO-CORRER.md).

**Mi hipótesis original está REFUTADA.** Diagnostiqué el tirón en el *release* (traspaso
`runOnJS(cerrar)` → `router.back()`); el operador lo ve **durante el arrastre**. El handoff
`coordinacion/2026-07-20_handoff_tiron-glass-funcion.md` (sesión de frontend de DocuMed) auditó el
camino del gesto: entre `onStart` y `onEnd` no hay más que una asignación a un shared value.

**Está verificado que `adb shell input swipe` no reproduce el defecto.** Cero frames >40 ms contra
150 ms con dedo humano. Un A/B cuyo caso base no exhibe el síntoma no prueba nada. Por eso el sprint
autónomo llega al instrumento y para ahí.

**Cinco hipótesis ya refutadas** — no repetirlas, están listadas en el COMO-CORRER.

---

## 4.bis — F5: el terreno ya está relevado (recon del 2026-07-20)

Recon read-only del backend vivo, hecho mientras compilaba el build. Todo con evidencia en el código,
no inferido por el nombre de los endpoints.

**🔴 `POST /chat` NO devuelve la respuesta del agente.** Es fire-and-forget: arranca (o señaliza) un
`ConversationWorkflow` de Temporal y responde `{wf_id, accepted}` al instante —
`apps/copiloto/web.py:226-234` → `motor/backend/agent/inbound_router.py:21-40`. La respuesta del
agente se persiste server-side y se lee **polleando** `GET /reply?session_id=&after_id=<cursor>`
(`web.py:281-285`). No hay SSE ni WebSocket en todo `apps/copiloto` (grep con control positivo:
0 matches). El cliente móvil tiene que replicar el patrón de la PWA: enviar, y luego pollear cada
**1500 ms** con timeout de **60 s** (`apps/copiloto-web/src/modules/chat/useChat.ts:23,25`).

Quien implemente F5 esperando un request/response síncrono va a escribir el cliente equivocado.

**El fallback de auth existe y es real.** `POST /auth/signup` · `/auth/login` · `/auth/refresh`
(`web.py:349-377`) son HTTP puro, JSON in/out, **sin navegador y sin cookies** (0 matches de
`cookie` en el árbol). El login devuelve `{access_token, token_type, expires_in, refresh_token, user}`
y las requests siguientes van con `Authorization: Bearer <token>` (`apps/copiloto/auth.py:70-73`).
⚠️ **GoTrue rota el refresh token en cada uso** — hay que persistir el nuevo en cada respuesta.

**Google OAuth nativo está sin implementar, no sólo sin probar.** El flujo de la PWA extrae el token
del *fragment* de la URL (`apps/copiloto-web/src/auth/oauth.ts:20-55`): patrón navegador puro. En
nativo exige Custom Tabs + deep link, y `expo-auth-session`/`expo-web-browser` no están instaladas.
El fallback email/password no es una concesión: es el camino verificado.

**Ya mitigado sin saberlo:** `src/adapters/almacen.ts:19-61` implementa el puerto de tokens sobre
`AsyncStorage` con las **mismas keys** que la PWA. Y `packages/core` ya tiene el contrato de red
completo (`login`, `sendChat`, `getReply`, el reducer de polling). Lo que falta en F5 es el
**wiring**, no el cliente: `src/adapters/plataforma.ts` no lo importa ningún punto de arranque.

**Bloqueante silencioso resuelto:** `EXPO_PUBLIC_API_BASE` no estaba en ningún lado, y su default es
`''`. La PWA sobrevive con eso porque es mismo-origen; un cliente nativo no tiene origen, así que
`fetch('/chat')` saldría con un path relativo inválido y el error aparecería lejos de su causa. Queda
`apps/mobile/.env.template` documentándolo y un `.env` local.

---

## 4.ter — F5: qué está hecho y qué NO (leer antes de tocarla)

Tres commits: `4fcae9e` (auth), `36823b4` (chat), `003e60e` (integración).
**152 tests verdes y typecheck limpio — pero NADA de esto se ejecutó en un teléfono.**
Es "implementado y verde en jest", no "funcionando". El chat E2E real contra el backend vivo
sigue **sin probar**, y es lo que cierra la fase.

Hecho: login email/password + `SessionProvider` con guard de 3 estados · `ChatView`/`Composer`/
`Burbuja`/`ListaMensajes`/`useChat` con el polling durable · `plataforma.ts` importado por side
effect en el layout raíz (**no lo importaba nadie**, así que el core nunca quedaba configurado).

**Dos contratos que no se rompen:**
- **`/spike` está FUERA del guard a propósito.** Mide el hilo de UI durante un arrastre: no toca el
  backend ni necesita identidad. Detrás del login, el instrumento de F2 quedaría inalcanzable justo
  en una sesión sin backend.
- **El guard tiene 3 estados, no 2.** Mientras `AsyncStorage` resuelve el token el estado es
  `verificando`; mostrar login ahí hace parpadear la pantalla de login en cada arranque a quien ya
  tenía sesión.

**Decisión de diseño tomada en el port, con evidencia:** el gate de confirmación de documed es un
*textarea editable* (un médico corrige una nota antes de firmarla). Acá se porta como tarjeta de
**sólo lectura**, que es como ya funciona en la PWA en producción (`HitlCard.tsx`).

**🔴 Bloqueante para F1:** el guard ahora exige sesión, así que las capturas del escritorio de 6
funciones necesitan **una credencial de prueba** — o la provee el operador, o se crea vía
`/auth/signup` contra el backend vivo (toca datos reales: no se hizo solo).

**🟡 Abierto, decisión del operador:** `packages/core` ya tiene el puerto `clientes` (D7,
`pacientes`→Clientes), pero **no hay pantalla y no es ninguna de las 6 funciones cerradas**. Dónde
entra —dentro de Apps, como séptima función, o junto al CRM más adelante— está sin decidir.

---

## 5. Decisiones cerradas (no re-abrir)

| # | Decisión |
|---|---|
| D1 | Mobile-first. Web = vía secundaria, congelada |
| D2 | Fuente `documed@a6841474`, pinneada. documed read-only |
| D3 | Sin stores. Dev-client + `adb install` |
| D4 | Build en EAS cloud (la PC no tiene JDK ni Android SDK) |
| D5 | Proyecto Expo en la **misma cuenta** que Documed (`341lin`) |
| D6 | Voz: mic → Groq → texto. **Sin retención de audio, sin buffer local** |
| D7 | `pacientes` → **Clientes** (CRM adentro, después) |
| D8 | **Índice local = caché de UI, nunca camino del agente.** El agente corre server-side |
| D9 | Tabla de proyección `actividad` sólo si la medición la justifica |
| D10 | Las 6 funciones abren como **capas**, no rutas. Mecanismo swappable en `CapaFuncion.tsx` |

Las 6 funciones: **Apps · Ajustes · Recientes · Redes Sociales · Métricas · Facturación**.

---

## 6. Contratos que hay que respetar

**La capa aporta el chrome, la pantalla aporta el contenido.** `CapaFuncion` pinta el vidrio, el
ícono, el nombre y el Cerrar. Una pantalla de función **no** lleva `backgroundColor` propio (taparía
el vidrio) ni su propio título (lo duplicaría). Cada pantalla tiene un test que lo fija.

**`CONTENIDO_POR_FUNCION` es `Record<FuncionKey, ComponentType>`** en `app/index.tsx`. Si entra una
`FuncionKey` nueva sin contenido, no compila. Es el único punto de wiring.

**Los valores de `canonGlass.ts` no se tocan** — `ALTO_HANDLE 56`, `CONFIG_SNAP 420ms
bezier(.2,.8,.2,1)`, `UMBRAL_TAP 5`. Son el canon medido; cambiarlos invalida la comparación con
las mediciones de documed.

**Los 5 skins reales son `cian` (default), `violeta`, `ambar`, `medicalWhite`, `black`.** No existe
ningún skin llamado `documed` — esa era una paleta vieja ya descartada.

---

## 7. Gotchas que ya costaron tiempo

1. **`render` de RNTL 14 + React 19 es asíncrono.** Sin `await` el test falla con *"render function
   has not been called"*, que no menciona el await. Anotado en el encabezado de `jest.config.js`.
2. **`transformIgnorePatterns` no es decorativo.** Cada entrada es un paquete que rompió el build de
   tests. `standard-navigation` está ahí porque `expo-router` lo arrastra.
3. **`dumpsys gfxinfo framestats` se drena en cada lectura** y los percentiles esconden el tirón.
   Para eso va S7, no S5.
4. **`path.resolve` en Windows** devolvía `C:\...` y rompía el detector de fugas de S2 en silencio —
   reportaba `0` porque no podía encontrar nada. Ahora hay un control que revienta si el grafo sale
   vacío.
5. **npm workspaces hoistea React a la raíz**, así que el `moduleNameMapper` de jest usa
   `require.resolve`, no una ruta fija.

---

## 8. Deuda gestionada

| Qué | Dónde | Condición de pago |
|---|---|---|
| `shell.test.tsx` en `describe.skip` | `src/shell/shell.test.tsx` | F5, cuando `modules/chat` esté portado |
| ~~5 `jest.mock('expo-router')`~~ | — | ✅ **PAGADA** (`8ef02bc`): retirados, 119 tests verdes con `expo-router` real |
| Assets = ícono por defecto de Expo | `apps/mobile/assets/` | Marca propia del copiloto, sin fecha |
| `medicalWhite` como nombre de skin | `src/theme/tokens.ts` | Decisión del operador; renombrarlo toca `NombreSkin` y tests |
| `cliente_id` ambiguo (tenant vs cliente del CRM) | `packages/core/src/api/types.ts` | Cuando se diseñe el CRM (D7) |
| Worktree `_documed-wt` sin resolver | branch `documed/backend-foundation` | Antes de que `apps/mobile` crezca más |

---

## 9. Qué sigue, en orden

1. **Esperar el build**, instalar, capturas de las 6 funciones. Cierra F1.
2. **Correr la Medición 1** — necesita el dedo del operador. Cierra o replantea F2.
3. **F5 (chat E2E)** — el riesgo es auth Google nativa; fallback declarado a email/password.
4. **F6 (voz)** y **F7 (índice)**.

Antes de F5 conviene releer §4: si la Medición 1 cambia el mecanismo de las funciones, `CapaFuncion`
es el único punto a tocar.
