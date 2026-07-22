# DoD — Sprint autónomo: Copiloto móvil E2E con paridad de cáscara documed

> **Definición de Terminado del sprint completo.** Cada criterio es **binario y verificable con evidencia**
> (captura de device o log en `_evidencia/`, no autoevaluación). El sprint está CERRADO cuando **todos**
> los criterios no-diferidos están en verde. Los `[DIFERIDO]` salen del alcance con motivo explícito.
>
> **Fuente canónica de UI/UX:** `Agencia_IA_HyC/documed-front/apps/mobile` @ rama `feat/frontend-h6-anclaje`,
> fixes hasta `2125140` (el `d70be39` agrega **sólo instrumentos temporales** — §7 del handoff — que NO se
> copian). **documed-front es READ-ONLY.** Enfoque: **converger** la cáscara a ese estado, no re-derivar el
> handoff fix por fix — "aprovechar todo lo que hizo documed, no reinventar la rueda".
>
> **Verificado hoy (el DoD sale de esto):** mi cáscara está 16 commits atrás; los 13 primitivos de
> `theme/glass` + `PanelDeslizable` difieren. El **tirón está resuelto** en esos commits (`78e461a`,
> `763d109`, `34e8949`, `b5db2af`, `de17873`, `d4ab1a8`), no en el handoff. **`react-native-skia` está en el
> package.json canónico pero NO se importa en el `src`** (dep fantasma) → converger la cáscara **NO exige
> rebuild**; todas las nativas usadas ya están en el APK v2.

---

## 📍 Estado de ejecución (checkpoint 2026-07-21 00:30)

Sesión autónoma larga. Lo verificado **con evidencia en device/API**, separado de lo pendiente:

| Frente | Estado | Evidencia |
|---|---|---|
| **G0 — arranque en device** | ✅ **RESUELTO de raíz** | Causa: `metro.config disableHierarchicalLookup=true` dejaba sin resolver un módulo del core init de RN → `Global was not installed`. Fix: `false` (lo cazó `expo-doctor`). Commit `d161a0e`. Hello-world 0 errores + app real renderiza. Aislado con test diferencial (bundle de documed arranca en mi binario) + hello-world mínimo. [[arranque-device-metro-disable-hierarchical-lookup]] |
| **R2 — cáscara convergida** | ✅ | Convergida a documed-front (gestos/tirón/render). Commit `0c6a04d`. **La pantalla de login del copiloto renderiza glass cian correcto en device** (`_evidencia/r2-app-render.png`) — antes fondo blanco. 152 tests verdes, tsc limpio. |
| **auth E2E** | ✅ | Usuario de prueba creado vía `POST /auth/signup` (cliente_id+auth_user_id). Login API devuelve access+refresh token. Login UI renderiza y acepta credenciales en device. Credencial en `~/.claude/secrets/copiloto-e2e.env` (TODO rotar). |
| **chat E2E — envío** | ✅ | `POST /chat` responde `{wf_id: "conv-web-...", accepted: true}` → el **ConversationWorkflow durable de Temporal arranca** (el moat, confirmado E2E contra backend vivo). |
| **chat E2E — respuesta del agente** | ⬜ **BLOQUEADO (backend)** | `GET /reply` devuelve `{"replies":[], "next_id":0}` — el agente **no responde** en la ventana probada (>90s). El front-door está vivo (sirve SPA, login, /chat aceptan). Es un frente de **backend** (worker Temporal / provisioning del usuario nuevo), **no de la app móvil**. Sin acceso SSH al VPS en esta sesión para diagnosticar el worker. |
| **login UI completo + escritorio 6 funciones + tirón/tap/tiles** | 🟡 pendiente | El render y el flujo funcionan; el input de credenciales por `adb input text` es frágil (residuos de teclado). Falta un login limpio de punta a punta + capturas de las 6 funciones + verificación gestual. |
| **E — voz** · **F — recientes** | ⬜ | No empezadas. |

**Siguiente al retomar, en orden:** (1) diagnosticar por SSH por qué el agente no responde para el usuario de prueba (¿worker vivo? ¿provisioning?) — es el gate del chat E2E; (2) completar login UI + capturas de las 6 funciones; (3) verificar el tirón/tap replegado en device (A2/A3); (4) voz (E) y recientes (F).

**Hallazgos persistidos en memoria:** [[arranque-device-metro-disable-hierarchical-lookup]] (correr `expo-doctor` primero; test diferencial; el screencap captura el foreground que puede ser otra app).

---

## G — Criterios globales (transversales, aplican a todo el sprint)

- **G1** · `apps/mobile` (jest) y `packages/core` (vitest): **suite completa verde**; `tsc --noEmit` limpio en ambos workspaces.
- **G2** · Cero secretos en repo. `.env` gitignored; la credencial de prueba vive en `~/.claude/secrets/`, nunca en git ni en el chat.
- **G3** · `documed`, `documed-front` y `apps/copiloto-web` **intactos** (`git status` de esos árboles sin cambios de esta sesión).
- **G4** · Cada criterio de device tiene su archivo en `_evidencia/` (captura o log). Sin evidencia ⇒ el criterio NO está cerrado.
- **G5** · Commits por frente, Conventional en minúscula, causa raíz en el body. Sin push directo a `main`.
- **G6** · Cero deuda invisible: todo atajo queda con TODO en código + entrada en memoria + condición de pago.

---

## G0 — Arranque en device (GATE CERO, bloquea todo)

- **G0.1** · APK v2 (`fb299289`) instalado en el SM-A217M (`RF8R50N2WGR`) y **arranca sin pantalla roja**, cae en el login. Captura `f0-arranque`. — *Valida el diagnóstico `expo-system-ui`; si falla, re-diagnosticar con logcat antes de seguir.*
- **G0.2** · **Sin rebuild** durante el sprint, salvo que aparezca una nativa imprevista **usada** (no fantasma). Si ocurre, se agrupa en **un** rebuild y se registra el motivo.

---

## A — Paridad de cáscara con la canónica (núcleo visual/UX)

- **A1** · Los **13 primitivos** de `src/theme/glass/` (CristalVidrio, FondoIluminado, GlassIcon, MarcoGlass, Orbe, Row, Tile, canonGlass, iconPalette, icons, ondaPalette, presion, relieve) + `PanelDeslizable.tsx` **convergen al comportamiento canónico** de documed-front. Verde en `primitivos.test.tsx`/`presion.test.tsx`.
- **A2** · 🔴 **El tirón al replegar el glass de función está resuelto:** el glass secundario se repliega **fluido, sin detención**, igual que el chat principal — observado **en device** y capturado (`a2-repliegue`). No se afirma de memoria; se mira en el teléfono.
- **A3** · **Tap corto abre al primer toque** (fixes B/C: `ScrollView`/`Pressable` desde `react-native-gesture-handler` en `EscritorioFunciones` y `Tile`). Verificado con `adb tap` repetido (que SÍ reproduce el tap, ≠ swipe). Captura `a3-tap`.
- **A4** · **Tiles fijos**, sin "hundido" al presionar (fix D: sin `PRESS_SCALE`). El acuse lo da el glass que sube.
- **A5** · **Un solo glass a la vez**, mantenido. En el copiloto es **por construcción** (las 6 funciones son capas con un slot `funcionActiva`, no rutas) — verificado en device + test. Documentada la divergencia con el lock-por-foco de documed (que aplica a `router.push`, acá innecesario).
- **A6** · `PanelDeslizable` conserva la invariante: `panelY` tiene **exactamente dos dueños** (gesto + `senalSubir`); **ningún tercer writer** (foco/efecto/layout). Confirmado que **no** hay `useFocusEffect` (fix F revertido en la canónica; nunca estuvo acá).
- **A7** · `canonGlass.ts` toma los valores de la **fuente viva**, no del snapshot viejo. Sin regresión visual en los 5 skins.
- **A8** · **Ningún instrumento temporal** copiado (los del §7 del handoff: registradores de tap, trazas, `animationDuration:1500`, bisect del blur). `grep` de `TRAZA-|BISECT|🔬` en `apps/mobile/src` = 0.

---

## B — Cards del copiloto adaptadas al diseño canónico

- **B1** · Los **tiles de las 6 funciones** (escritorio) usan el `Tile.tsx` **canónico** con el contenido del copiloto. Se ven como las cards de documed, con los datos del copiloto.
- **B2** · Las **cards de la función Apps** (integraciones: Gmail, Drive, Sheets, Docs, Calendar, HubSpot, Instagram, MercadoPago) adoptan el primitivo de card canónico.
- **B3** · **Cero color hardcodeado**; todo por tokens del tema; los 5 skins (`cian`/`violeta`/`ambar`/`medicalWhite`/`black`) renderizan sin rotura. Gate visual en **ambos** temas (claro/oscuro).

---

## C — Particularidades del copiloto (lo que lo diferencia de documed)

- **C1** · Exactamente **6 funciones**: Apps · Ajustes · Recientes · Redes Sociales · Métricas · Facturación. Nada clínico (sin pacientes/historias/consulta/documento como funciones).
- **C2** · **Cero jerga clínica** en texto visible (`paciente`/`clínic`/`médic`/`consulta`/`nota clínica`); `pacientes` → **Clientes** donde aparezca. Las menciones a documed sólo en comentarios de trazabilidad.
- **C3** · Chat de **negocio**: sin `ModoClinicoToggle`, sin `TarjetaArtefacto` clínica. El gate de confirmación HITL es de **sólo lectura** (como la PWA en prod), no textarea editable.

---

## D — Chat E2E en device (corazón del goal)

- **D1** · **Login real** con un usuario de prueba creado vía `POST /auth/signup` (autorizado). La sesión **persiste**: reabrir la app no re-pide login. Captura `d1-login` + `d1-persistencia`.
- **D2** · Un **mensaje real** enviado desde el device dispara `POST /chat` → polling `GET /reply` → **la respuesta del agente durable aparece en pantalla**. Contra el backend vivo, no mock. Captura `d2-chat-e2e`.
- **D3** · Las 6 funciones abren **desde la sesión real** y montan cada una su pantalla. Capturas `d3-<funcion>` (6).

---

## E — Voz: dictado mic → Groq → texto (D6)

- **E1** · Portado **sólo** el botón de voz + la Onda + el grabador corto (NO la máquina clínica: sin `purgador`/`proteccionDurable`/`huérfanos`/gate clínico). **Sin rebuild** (audio ya en el APK v2). Verde en jest.
- **E2** · Hablar por el micrófono produce **texto en el chat** (transcrito por Groq vía `POST /chat/audio`) **y** respuesta del agente. En device. Captura/log `e2-voz-e2e`.
- **E3** · **Sin retención de audio, sin buffer local** (D6): tras el envío no queda archivo de audio en el device (verificado por inspección del FS de la app).
- **E4** · Permiso de micrófono concedido de forma autónoma (`adb pm grant` o tap en el diálogo) y manejado si el usuario lo niega (mensaje legible, no crash).

---

## F — Recientes / índice de actividad (D8/D9)

- **F1** · **Recientes** muestra la **actividad real** del tenant de prueba (leída del backend). Captura `f1-recientes`.
- **F2** · Se **mide `consultar_actividad`** antes de construir nada. La tabla/caché local se construye **sólo si la medición lo justifica** (D9); si no, Recientes lee directo. La decisión queda registrada con el número medido.
- **F3** · Si hay índice local (`op-sqlite`): es **caché de UI, jamás camino del agente** (el agente corre server-side) — invariante documentada y verificable en el código.

---

## Cierre

- **Z1** · `_evidencia/` contiene las capturas E2E de cada frente (A2, A3, B, D1-D3, E2, F1).
- **Z2** · Suite completa **verde** y `tsc` limpio (repetir G1 al final, post-integración).
- **Z3** · `HANDOFF`, plan y memoria del proyecto **actualizados** al estado real de cierre.
- **Z4** · Credencial de prueba anotada como **TODO de rotación** (higiene pre-prod), no bloquea el cierre.

---

## Fuera de alcance (explícito — para que "terminado" no se infle)

- **[DIFERIDO]** Medir el tirón con instrumentación de frames — ya resuelto en la canónica; acá se **verifica visualmente** (A2), no se reabre la investigación.
- **[DIFERIDO]** Dónde ubicar **Clientes** (D7) — el puerto existe en `core`; la ubicación es decisión de producto del operador.
- **[DIFERIDO]** Facturación AFIP — frente en pausa (greenfield, gate = spike con credenciales).
- **NO** se toca `apps/copiloto-web`, `documed` ni `documed-front`.

---

### Riesgo residual conocido

- **Convergencia de cáscara = superficie amplia** (14 archivos). Riesgo de regresión visual. Mitigación: converger por archivo con la suite de candados (`primitivos`/`presion`) como red, y verificación visual en device por skin.
- **El tirón se declara resuelto sólo tras verlo en device** (A2). Si al replegar en el SM-A217M el tirón persiste, el frente A **no cierra** y se reporta con evidencia — no se da por bueno porque la canónica lo tenga.
