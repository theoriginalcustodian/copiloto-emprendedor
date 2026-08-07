# Evaluación global del repo — revisor externo (Fable 5), 2026-07-23

> **Método:** ojos frescos, cero contexto heredado, report-only. Todo hallazgo cita archivo:línea
> leído en esta sesión (rama `feat/mobile-first-cascara-glass`, working tree actual; lo verificado
> contra `origin/main` se marca explícito). Lo no verificado va como `[ASUMIDO — PENDIENTE VERIFICAR]`.
> **Fuera de scope:** infra externa, features faltantes conocidas.
>
> **Impresión general antes del detalle:** la arquitectura es notablemente disciplinada — composition
> roots con DI en todas las capas, boundary del motor respetado (cero `sys.path.insert` fuera de
> `_paths.py`/`conftest.py`, verificado por grep), multitenant per-request real, y tests adversariales
> que ejercitan el camino hostil contra la DB viva. Los hallazgos de abajo son mayormente huecos
> puntuales, no defectos estructurales. Los dos frentes donde sí hay deuda sistémica: **idempotencia
> de writes externos bajo retry** (D1/D3) y **conexiones Postgres sin pool** (D4/D6).

---

## D1 — Conflicto / race conditions / consistencia de estado

### 1.1 🔴 ALTO — "Narra la acción sin ejecutarla": el historial cross-turn descarta los `tool_calls`

- **Evidencia:** `motor/backend/agent/conversation_workflow.py:404-411` — el scratchpad de un turno
  nuevo arranca de `self._history[-HISTORY_TAIL:]`, y el propio comentario lo declara: *"user/assistant
  en texto plano — NUNCA el scratchpad interno de tool_calls"*. `_react_finish`
  (`conversation_workflow.py:495-499`) apendea a `self._history` **solo el texto final** del turno.
- **Por qué importa (failure scenario):** el LLM ve en su contexto N turnos previos con el patrón
  «user pide X → assistant responde "Listo, lo hice ✅"» **sin ningún tool_call ni tool_result entre
  medio**. Es un dataset de few-shot que le enseña, turno a turno, que la forma de "hacer" es narrar.
  En un turno posterior imita el patrón: responde "listo, ya lo marqué" sin emitir el tool_call — el
  usuario cree que el gasto/cobro existe y no existe. La memoria del proyecto ya lo tiene cazado en
  device (`memoria/copiloto-narra-la-accion-sin-ejecutarla.md`, marcado MAYOR); este review confirma
  la raíz exacta en el código.
- **Recomendación (raíz, sin sobreingeniería):** que el hecho ejecutado sobreviva en `self._history`
  en forma compacta — p.ej. al cerrar un turno con writes, apendear junto al texto final un marcador
  determinístico (`[tool: crear_gasto → ok]`) o un mensaje `assistant` sintético con el resumen del
  tool-trace. Es replay-safe por el mismo criterio que ya usa el archivo (payload más rico, mismo
  Command sequence — ver el patrón de `conversation_workflow.py:385-389`). Complemento barato: una
  línea en el system prompt que prohíba afirmar ejecución sin tool_result **en el turno corriente**.
  Es decisión MAYOR ya escalada; esta es la evidencia para resolverla.
- **Skill:** `temporal-ai-patterns` (scratchpad durable de agentes ReAct).

### 1.2 🟠 MEDIO — Dedup de link MP: ventana SELECT → crear → INSERT

- **Evidencia:** `apps/copiloto/mp_dedup_store.py:18-34` (get/save separados) +
  `apps/copiloto/tool_catalog.py:454-472`: el flujo es `dedup.get(idem_key)` → si vacío, **llamar a
  MP** → `dedup.save(...)`. Entre el SELECT y el INSERT, un retry del mismo activity cuya primera
  ejecución sigue viva (start_to_close_timeout de 120s vencido con el attempt aún corriendo —
  `conversation_workflow.py:51,465-469`) pasa el SELECT vacío y crea un **segundo** preference en MP.
- **Por qué importa:** dos links de cobro por el mismo pedido; el `ON CONFLICT DO NOTHING` del save
  evita la fila duplicada pero **no** el efecto externo duplicado. Es exactamente la clase que la
  memoria ya doctrinó (`idempotencia-con-un-if-tiene-ventana`): el `if` no mide el EFECTO.
- **Recomendación:** invertir a *claim-first*: `INSERT ... ON CONFLICT DO NOTHING RETURNING` como
  reserva atómica del `idem_key` ANTES de llamar a MP (fila en estado `pending`, se completa con el
  `preference_id` después; una reserva huérfana se puede reintentar por antigüedad). Un solo cambio
  en el store, cero cambios upstream.

### 1.3 🟠 MEDIO — El polling del cliente se detiene tras el primer batch de replies

- **Evidencia:** `apps/mobile/src/modules/chat/useChat.ts:190-195` — `detenerPolling()` en cuanto
  `reducirChat` agregó mensajes nuevos. Es correcto para el contrato actual (1 turno → 1 reply
  terminal o 1 card de gate), y cada `send` re-arranca el polling.
- **Por qué importa:** el contrato "1 turno → 1 reply" no está escrito en ningún guard: el día que el
  backend emita replies espontáneos (las **automatizaciones recurrentes** son candidato post-v1
  declarado en memoria, y el flujo HITL de staff en modo dispatch responde horas después), el cliente
  no los verá hasta el próximo send / cambio de AppState / mount. La falla no dará síntoma: el reply
  queda en la tabla, nadie pregunta.
- **Recomendación:** ningún cambio de código hoy (el polling permanente gastaría batería para un caso
  que no existe). Sí dejar el supuesto **visible donde se va a romper**: una línea en el contrato de
  `/reply` y en el diseño de recurrentes — "todo reply fuera de turno requiere repensar el ciclo de
  polling (o push)". Es deuda deliberada, hoy invisible.

### 1.4 🟡 BAJO — `make_signal_anulacion` descarta `payload` en silencio

- **Evidencia:** `apps/copiloto/web.py:309-314` — la firma acepta `payload` pero ejecuta
  `await handle.signal(nombre)` siempre; su gemela `make_signal_factura` (`web.py:272-277`) sí lo
  maneja. Hoy es inocuo (el único caller manda `None` — `apps/copiloto/afip_web.py:511`).
- **Por qué importa:** una firma que promete lo que no cumple es una trampa diferida: el primer signal
  de anulación con payload se perderá sin error.
- **Recomendación:** espejar el ternario de `signal_factura`, o quitar el parámetro. Dos líneas.

**Verificado sin hallazgo:** el patrón start-or-signal con `USE_EXISTING`
(`motor/backend/agent/inbound_router.py:33-39`), el token de gate por `(turn_ix, step)` contra
double-click/cards viejas (`conversation_workflow.py:353-398, 516-521`), el `WorkflowIDConflictPolicy.FAIL`
del borrador de presupuesto para no duplicar ítems (`web.py:230-258`), y el lock por foco
`empujarUnaVez` (`apps/mobile/src/navegacion/empujarUnaVez.ts`) son diseño correcto y documentado.

---

## D2 — Seguridad

### 2.1 🔴 ALTO — `POST /auth/signup` abierto a internet crea user + tenant sin ninguna barrera

- **Evidencia:** `apps/copiloto/web.py:671-677` — ruta bajo el bloque "SIN auth (spec §5.3)", sin
  `Depends`, sin rate limit, sin invitación; llama `signup_and_provision`
  (`apps/copiloto/onboarding.py`) que usa la GoTrue **admin API** con `SERVICE_ROLE_KEY` para crear
  el user confirmado y la fila de tenant. El `disable_signup:true` de GoTrue solo cierra la puerta
  pública de GoTrue; este endpoint la reabre con privilegio admin. "Admin-mediado" describe el
  mecanismo, no una barrera.
- **Por qué importa (failure scenario):** cualquiera que descubra el dominio
  (`copilotoemprendedor.duckdns.org`, público) puede `POST /auth/signup` en loop → N tenants basura
  (filas, workflows, memoria Graphity), y peor: cada tenant creado puede loguear y **chatear** — cada
  mensaje cuesta LLM real (la memoria del proyecto midió COGS ~$1-12/usuario/mes). Es un ataque de
  costo directo, no solo de spam.
- **Recomendación (raíz, simple):** el alta email/password es hoy un flujo operado por el equipo →
  gatearlo con un invite-token de env comparado en el endpoint (fail-closed si falta), o directamente
  deshabilitarlo por env en prod dejando solo el camino OAuth (que ya tiene su gate de provider en
  `web.py:705-725`). Complemento: rate-limit en Caddy sobre `/auth/*` (una directiva).

### 2.2 🟠 MEDIO — `/auth/login` y `/auth/refresh` sin rate-limit propio

- **Evidencia:** `apps/copiloto/web.py:679-699` — proxy directo del password-grant, sin throttling
  app-side. `[ASUMIDO — PENDIENTE VERIFICAR]` si la GoTrue dedicada trae rate-limit efectivo para
  el grant (los defaults de GoTrue son laxos para `/token`).
- **Por qué importa:** brute-force de passwords al ritmo que aguante el VPS. Con la deuda declarada
  de "passwords temporales" (`memoria/copiloto-gotrue-dedicada-cutover.md`) el riesgo compone.
- **Recomendación:** rate-limit en Caddy (mismo cambio que 2.1); verificar la config de GoTrue antes
  de asumirla como mitigación.

### 2.3 🟢 VERIFICADO OK — Aislamiento multitenant: barrera explícita + test adversarial real

- **Evidencia:** la barrera declarada es el filtro `cliente_id` explícito porque el worker usa rol
  owner que bypassa RLS (`apps/copiloto/reply_store.py:4-6`, `apps/copiloto/auth.py:5-6`). El test
  adversarial existe y es genuino: `apps/copiloto/tests/test_adversarial_multitenant.py:1-16` siembra
  2 tenants en la **DB real** y ejercita el camino hostil de punta a punta incluida la capa HTTP —
  no happy-path. Los ids públicos se reconstruyen server-side desde el token
  (`web.py:200-206` para facturas; `web.py:622-652` para desconexiones, con el razonamiento BOLA
  explícito). `TrabajoStore` valida pertenencia antes de imputar (`trabajo_store.py:177`) y devuelve
  404 indistinguible (`trabajo_store.py:49-52`).
- **Nota (candidato, no urgencia):** todo el aislamiento cuelga de UNA línea de defensa (el filtro
  explícito, rol owner único). Defensa-en-profundidad — un rol no-owner con `FORCE RLS` + GUC de
  tenant — es el paso natural **pre-prod con clientes reales**; hoy el test adversarial sostiene el
  riesgo. No hacerlo ahora es correcto; no tenerlo anotado no lo sería.

### 2.4 🟠 MEDIO — Secretos en claro dentro del árbol del repo (no trackeados, pero presentes)

- **Evidencia:** en la raíz del working dir: `Openai apikeyp grafity backup 341.txt`,
  `Usuario y clave fiscal David Huck Afip.txt`, `afip sdk tincho toc.txt`. Verificado con
  `git ls-files`: **no están trackeados** y `.gitignore` los lista por nombre (`.gitignore:11-13`).
  El `.gitignore` sí está commiteado, o sea el repo publica la *existencia* de un archivo con la
  clave fiscal del operador (no su contenido).
- **Por qué importa:** cualquier backup/sync/tooling que arrastre el directorio (o un `git add -f`
  distraído en un checkout compartido por tres sesiones) exfiltra credenciales reales, incluida una
  clave fiscal AFIP. La memoria ya tiene `deuda-secretos-rotar` (diferida a pre-prod) — esto es la
  mitad "sacarlos del árbol", que no necesita esperar.
- **Recomendación:** moverlos fuera del repo (el patrón `docs/ASSETS-EXTERNAL.md` ya existe para
  exactamente esto) y limpiar las tres líneas del `.gitignore`. La rotación queda donde está (deuda
  registrada pre-prod).

### 2.5 🟡 BAJO — Higiene de raíz: `Factura/`, `code/`, `_evidencia/` sin trackear en la raíz

- **Evidencia:** `git status` — directorios sin clasificar en la raíz del repo, junto a los txt de 2.4.
- **Recomendación:** clasificar (versionar, ignorar o mover a `_staging/`-equivalente externo);
  `_evidencia/` y `Factura/` probablemente contengan PII/documentos reales — mismo tratamiento que 2.4.

**Verificado sin hallazgo:** JWT fail-closed (secret vacío aborta el boot, `auth.py:93-97`),
iss-enforcement fail-closed con la GoTrue dedicada (`serve.py:119-128`), el `state` OAuth de MP cifra
el `cliente_id` del token (`web.py:606-611`), path-traversal del SPA protegido
(`web.py:359` `is_relative_to`), credenciales MP/AFIP cifradas con Fernet, y el gate de provider del
self-provisioning OAuth (`web.py:705-719`).

---

## D3 — Resiliencia: los huecos NO-durables (fuera de Temporal)

### 3.1 🔴 ALTO — Writes externos NO idempotentes bajo el retry at-least-once de las activities

- **Evidencia:** las activities del loop llevan `LOOP_RETRY` con `maximum_attempts=5`
  (`conversation_workflow.py:63`; aplicada a `dispatch_intent` en `:270-275` y a `execute_tool` en
  `:465-469`). Dentro de esas activities se ejecutan writes externos **sin dedup**:
  - modo dispatch: `dispatcher_emprendedor.py:104-106` (crear link MP — acá NO usa el
    `MpLinkDedupStore`), `:120-121` y `:133-134` (`gateway.execute(..., confirmed=True)` — Composio:
    gmail send, calendar create, instagram publish, sheets/docs write);
  - modo react: `tool_catalog.py:412-431` (`calendar book` sin dedup) y los writes de `services/*`
    (grep `idem|dedup` sobre `apps/copiloto/services/*.py` → **cero hits**). El único write con dedup
    real es el link MP del modo react (`tool_catalog.py:433-473`).
- **Por qué importa (failure scenario):** Temporal es at-least-once: un attempt que aplicó el efecto
  y falló DESPUÉS (timeout de 120s con Composio lento, caída del worker post-write) se reintenta
  hasta 5 veces → **email enviado 5 veces, evento agendado 2 veces, post de Instagram duplicado, dos
  links de cobro en modo dispatch**. El moat durable garantiza que el turno no se pierde; sin
  idempotencia garantiza también que el efecto se repite.
- **Recomendación (raíz):** el `idem_key` ya viaja en el payload de `execute_tool`
  (`conversation_workflow.py:415-419` lo genera único y estable por retry). Generalizar el patrón
  `MpLinkDedupStore` a UNA tabla de dedup de writes (`(cliente_id, idem_key) → resultado`), con
  claim-first (ver 1.2), y consultarla en el executor genérico antes de todo `confirmed=True`. En
  modo dispatch, derivar el `idem_key` del turno igual que react. Donde el upstream soporte
  idempotency-key nativa, además mandarla. Un solo mecanismo, todos los servicios lo heredan
  (coherente con el diseño plug-in de `services/`).
- **Skill:** `temporal-developer` (semántica at-least-once de activities).

### 3.2 🟠 MEDIO — Proyecciones best-effort sin retry ni reconciliación (Doc + Sheet del presupuesto)

- **Evidencia:** `apps/copiloto/serve.py:167-176` — `_generar_doc_y_fila` corre en el threadpool del
  request HTTP y "NUNCA hace fallar la creación" (docstring en `serve.py:164-166`). Si el proceso
  muere o Google falla, el presupuesto queda sin Doc/fila para siempre: no hay DLQ, ni retry, ni
  marca de pendiente, ni job reconciliador.
- **Por qué importa:** es el único write multi-sistema del repo que vive FUERA de Temporal. La
  doctrina propia del workspace (Trauma Empaquetado / DLQ) pide exactamente lo contrario. El fallo es
  silencioso: el presupuesto se ve normal, el Doc simplemente no está.
- **Recomendación:** moverlo a una activity/workflow Temporal (la infra ya está, el gateway ya se
  inyecta al worker) o, mínimo viable, persistir `doc_pendiente=true` en la fila para que exista un
  hecho consultable que un reconciliador (o la UI) pueda ver.

### 3.3 🟡 BAJO — STT síncrono en el front-door (voz cae entera si Groq cae)

- **Evidencia:** `apps/copiloto/web.py:456-493` — la transcripción ocurre ANTES de despachar al
  workflow; Groq caído → 502/503 y la voz muere aunque el agente durable esté sano.
- **Veredicto:** deliberado y correcto (el cliente necesita el transcript en la respuesta para pintar
  el mensaje real — `useChat.ts:293-346` lo consume). El fallo es visible al usuario y reintentable.
  Se registra como EL paso no-durable del camino de voz, no como bug.

### 3.4 🟡 BAJO — Pérdida acotada del último batch de memoria (documentada)

- **Evidencia:** `conversation_workflow.py:114-129` — el flush pre-continue-as-new/cierre es
  best-effort con `maximum_attempts=1`; el docstring reconoce que el flush final puede perder el
  remanente. Trade-off consciente (memoria = latencia, no correctitud). Sin acción.

---

## D4 — Escala con cero fricción

### 4.1 🟢 VERIFICADO OK — Boundary del motor y modularidad

- `sys.path.insert`: grep sobre el repo → solo `_paths.py`, `conftest.py`, spikes y scripts de deploy
  (CLAUDE.md incluido como mención). El mecanismo único se respeta.
- Composition roots (`serve.py`, `worker_b.py`) con DI total; `*_web.py` por dominio con
  store-factories; servicios Composio plug-in por discovery (`services/__init__.py`), con la policy
  derivada en un solo lugar (`web.py:317-322` deriva de la MISMA unión que el worker — cero drift).
  La feature N+1 (un servicio nuevo) entra con UN archivo. Sólido.

### 4.2 🟠 MEDIO — La cadena presupuesto↔factura se cruza por un string derivado del workflow_id

- **Evidencia:** `apps/copiloto/trabajo_store.py:100-102` reconstruye en SQL
  `'factura-' || cliente_id::text || '-' || factura_id` para joinear contra
  `afip_comprobantes.workflow_id`; el mismo formato vive hardcodeado en `web.py:200-206`
  (`_wf_id_factura`) y en `presupuesto_store._DERIVADOS` (el propio docstring de `trabajo_store.py:97-99`
  admite: *"si el formato cambiara allá, acá también"*).
- **Por qué importa (failure scenario):** el formato del workflow_id es un detalle de orquestación;
  hoy es además la clave de join de la capa de negocio, duplicada en ≥3 archivos de 2 capas. Un
  cambio de formato (p.ej. namespacing por ambiente, como YA pasó con
  `_wf_id_onboarding` que sufija `-{ambiente}` — `web.py:140-144`) rompe la resolución de cadenas
  **en silencio**: los márgenes siguen devolviendo números plausibles, solo que de trabajos partidos.
  Exactamente la clase de bug que la memoria llama "dos márgenes que se ven plausibles".
- **Recomendación (raíz, simple):** persistir la FK real — `afip_comprobantes.factura_id` (el id
  corto) o `copiloto_presupuestos.comprobante_id` — en el momento en que ya se conoce (el workflow de
  factura la tiene), y joinear por columna. El formato del wf_id vuelve a ser privado de `web.py`.

### 4.3 🔴 ALTO — Sin pooling: una conexión Postgres nueva por operación, nunca cerrada explícitamente

- **Evidencia:** `serve.py:89-100` — `conn_factory` = `psycopg2.connect(db_url)` por invocación
  (mismo patrón en `worker_b.py:237`). Consumidores calientes que además no cierran: `auth.py:56-63`
  (`resolve_cliente_id`, corre en CADA request autenticado), `reply_store.py:23,36` (INSERT del sink
  y SELECT del poll). El cierre queda a cargo del GC de CPython.
- **Por qué importa:** cada request paga TCP+auth de Postgres (~5-20ms) y **cada poll de `/reply`
  paga DOS** (require_tenant + read_replies) a cadencia de 1.5s por usuario activo
  (`useChat.ts:63`). Con 50 usuarios chateando: ~65 conexiones nuevas/segundo contra el Postgres
  compartido de fusion — presión de `max_connections` y latencia de base en cada endpoint. Es el
  punto de fricción #1 para escalar y es transversal a todos los stores.
- **Recomendación (raíz, un solo lugar):** `psycopg2.pool.ThreadedConnectionPool` envuelto detrás del
  MISMO contrato `conn_factory` (un context manager que devuelve al pool al salir) en los 2
  composition roots — cero cambios en stores. Alternativa de infra (PgBouncer) queda fuera de scope,
  pero el cambio app-side vale por sí solo. Además, cerrar/devolver determinísticamente en
  `resolve_cliente_id` y `reply_store` (hoy dependen del refcount).

### 4.4 🟡 BAJO — Duplicaciones menores toleradas y justificadas

- Constantes de worklet duplicadas por limitación real de Reanimated (documentado en
  `PanelDeslizable.tsx:84-90` y `MarcoGlass.tsx:51-58` — correcto, no tocar).
- `_TOOLKIT_NAMES` en `dispatcher_emprendedor.py:34-38` vs. metadata de `catalog.py`
  `[ASUMIDO — PENDIENTE VERIFICAR el solape exacto]`: candidato a fuente única si driftea.

---

## D5 — 🔴 Auditoría de eficiencia FRONTEND (`apps/mobile`)

### 5.1 🔴 ALTO — Síntoma #1 del operador: la latencia del tap→glass, descompuesta y localizada

El síntoma "el tap tarda en ABRIR el glass; la animación levanta bien" tiene **tres componentes
verificados en código**, que se suman:

**a) El disparo es al SOLTAR — hipótesis CONFIRMADA.**
`apps/mobile/src/theme/glass/Tile.tsx:51-56` — el tile es un `Pressable` de RNGH con `onPress`
(touch-up). Toda la duración del dedo apoyado (~80-150ms de un tap normal, más en gama baja) entra
íntegra en la latencia percibida antes de que siquiera empiece el trabajo de abrir. La composición
tap-vs-scroll está bien resuelta (Pressable Y ScrollView ambos de RNGH — una sola arena, documentado
en `Tile.tsx:14-33` y `EscritorioFunciones.tsx:34-51`); el costo restante es inherente a `onPress`.

**b) Cero acuse al presionar — y es una contradicción interna del propio repo.**
`Tile.tsx:64-70`: se eliminó el feedback de `pressed` a pedido del operador (*"que sean fijos"*),
dejando el acuse "en manos de la navegación misma —el glass sube—". Pero
`src/theme/glass/presion.ts:4-7` (fuente única del feedback táctil, del mismo sprint) doctrina lo
contrario: *"un Pressable que no responde al dedo se percibe como app trabada... el usuario ve la
consecuencia varios frames después"*. El resultado: todo el gap de (a) + (c) transcurre **sin ninguna
señal**, que es exactamente lo que se percibe como "tarda en abrir". Lo que el operador rechazó fue el
**movimiento** (`scale(.95)`, "se va hacia atrás como un botón"); un acuse sin movimiento
(`PRESS_FADE`/brillo, que ya existe en `presion.ts:47`) no viola ese pedido.

**c) Entre el release y el primer frame del glass hay un mount síncrono completo en el JS thread.**
`PantallaPrincipal.tsx:107` → `empujarUnaVez` → `router.push` → expo-router monta la ruta entera de
una vez: `MarcoGlass` (`MarcoGlass.tsx:184-303`: gesto Pan, KeyboardAvoidingView, safe-area) +
`CristalVidrio` con `refuerzoTinte: 2` = 2 `LinearGradient` apilados full-screen
(`CristalVidrio.tsx:163-171`) + la pantalla completa con todos sus componentes (p.ej. `PantallaGastos`
monta listado+resumen+buscador+formulario module-graph). En un SM-A217M (gama baja, el device real del
proyecto) ese mount compite con todo lo demás en el JS thread. **El fetch NO es el culpable**: las
pantallas pintan con spinner sin bloquear (`PantallaGastos.tsx:56,71-96` — `estado='cargando'`
inmediato, fetch async).
`[ASUMIDO — PENDIENTE VERIFICAR en device]`: la PRIMERA apertura de cada ruta paga además el require
lazy del módulo de la ruta (expo-router); explicaría "la primera vez tarda más".

- **Recomendación (en orden de ROI, sin sobreingeniería):**
  1. **Acuse instantáneo sin movimiento** en `Tile`: `PRESS_FADE` (opacity 0.85) en `pressed` — 3
     líneas, ya existe la constante, compatible con el pedido del operador. Mata la *percepción* de
     demora aunque el mount no cambie.
  2. **Medir el gap release→primer-frame** con el registrador de 3 capas que el repo ya construyó
     (referenciado en `Tile.tsx:18-21`) antes de optimizar el mount. Si domina el mount:
  3. **Diferir el cuerpo un frame**: que la ruta monte el `MarcoGlass` con spinner y monte el cuerpo
     pesado tras `requestAnimationFrame`/`InteractionManager` — el vidrio sube YA, el contenido llega
     un frame después (patrón estándar de navegación RN).
- **Skills:** `swmansion-rn-gestures` (composición press/scroll — ya aplicada bien),
  `callstack-react-native-performance` (TTI de pantalla, defer de mount).

### 5.2 🟠 MEDIO — Re-render del escritorio completo en cada frame de scroll del grid

- **Evidencia:** `EscritorioFunciones.tsx:238,267` — `onScroll={(e) => setDesplazado(...)}` con
  `scrollEventThrottle={16}`: un `setState` de React por frame de scroll, que re-renderiza TODO el
  escritorio (9 Tiles con LinearGradient + lista de actividad) a 60Hz durante el gesto. El valor solo
  se usa para derivar UN booleano (`llegoAlFinal`, `:241`).
- **Por qué importa:** jank en el scroll del grid en gama baja, y un tap inmediatamente posterior al
  scroll encuentra el JS thread ocupado en renders — se suma directo al síntoma 5.1.
- **Recomendación (raíz, mínima):** guardar el booleano, no el píxel: `setState` solo cuando
  `hayMasFuncionesADerecha` CAMBIA (comparar antes de setear) — 4 líneas, sin Reanimated. (La
  alternativa `useAnimatedScrollHandler` + shared value es más pura pero no hace falta para un
  booleano.)

### 5.3 🟠 MEDIO — Chat: historial sin tope, sin virtualización, re-serializado entero en cada mensaje

- **Evidencia:** `packages/core/src/chat/chatMachine.ts:187,228` — el reducer apendea sin cota
  (grep `slice|MAX|cap` → cero hits); `useChat.ts:101-103,196,268` — `persistirMensajes` hace
  `JSON.stringify` del historial COMPLETO a AsyncStorage en cada mensaje/reply;
  `ListaMensajes.tsx:171` mapea todos los mensajes dentro de un ScrollView (sin FlatList).
- **Por qué importa:** la sesión es **permanente por diseño** (el moat). Tras semanas de uso: el
  mount del chat (que está en la Capa 1 del shell, o sea en el arranque de la app) crece linealmente,
  y cada mensaje paga serializar todo lo anterior. Degradación silenciosa, proporcional al éxito del
  producto.
- **Recomendación:** cap de N mensajes (p.ej. 200) en persistencia e hidratación — un `slice(-N)` en
  `persistirMensajes` y en `hidratarEstado`. La memoria larga ya vive server-side (Graphity); el
  cliente no necesita historial infinito. Virtualizar `ListaMensajes` recién si N alto lo pide.

### 5.4 🟡 BAJO — Cadencia del polling y cold-fetch: correctos

- Polling 1.5s / degradado a 10s post-timeout con racional escrito (`useChat.ts:63-68,221-241`),
  re-poll al volver a foreground (`:246-253`): bien diseñado client-side; el costo real es backend
  (6.2). La actividad del escritorio se refresca por foco, sin polling, con razones documentadas
  (`PantallaPrincipal.tsx:61-98`). Listas de funciones con `.map` en ScrollView
  (`PantallaPresupuestos.tsx:229` et al.): páginas chicas hoy, candidato a FlatList si crecen
  (Recientes ya la usa — `ListaActividad.tsx:167`).

### 5.5 📌 Hipótesis SQLite local-first — VEREDICTO: NO por ahora

Verificado dónde vive la latencia: **el cold-fetch NO bloquea el paint** (todas las pantallas montan
con spinner inmediato y fetch async — 5.1c), y la latencia del síntoma #1 está en el disparo+mount,
que SQLite no toca. Tampoco toca `POST /chat`+polling (inherente al agente durable — correcto en la
consigna). Un SQLite local agregaría invalidación/sync/conflictos para mejorar únicamente el tiempo
spinner→contenido, que hoy es una request HTTP simple por pantalla. **Si** tras medir se quiere matar
ese spinner: un cache en memoria stale-while-revalidate por pantalla (un `Map` module-level: pintar
lo último conocido + revalidar en background) da el 90% del beneficio con ~5% de la complejidad, sin
tocar la fuente de verdad. SQLite quedaría justificado recién con requisito offline real.

---

## D6 — 🔴 Auditoría de eficiencia BACKEND

### 6.1 🔴 ALTO — N+1 confirmado (y agravado por conexiones): `margen_por_trabajo`

- **Evidencia** (en `origin/main`, mergeado allá vía PR #70/#72 — no está en esta rama todavía):
  `apps/copiloto/inteligencia_queries.py:410-446` (main). Por cada candidato (toda referencia
  imputada o cobrada): `ts.resolver(eslabon, ref)` → que abre una **conexión nueva**
  (`trabajo_store.py:73` con el conn_factory sin pool) + 3-5 queries. Después, por cada raíz
  deduplicada: `ts.margen(...)` → que **vuelve a llamar `resolver`** internamente
  (`trabajo_store.py:135`) + otra conexión + 2 queries más. Total: con C candidatos y T trabajos,
  ≈ `C + 2T` conexiones TCP y ≈ `4C + 6T` queries **por una sola carga del gráfico 4**.
- **Por qué importa:** un tenant con 100 trabajos paga ~300 conexiones y ~1000 queries para pintar un
  gráfico. Escala lineal-feo con el historial del emprendedor — el gráfico se pone más lento cuanto
  más exitoso es el negocio, contra el Postgres compartido.
- **Recomendación (raíz):** resolver las cadenas en UNA pasada set-based — los enlaces ya son joins
  SQL (presupuesto.factura_id ↔ comprobante.workflow_id ↔ cobro.comprobante_id): una CTE que arme
  raíz + agregue cobrado/gastado/conteo por raíz en 1-2 queries. Camino intermedio si la CTE se
  posterga: (a) pasar el cursor/conn a `resolver`/`margen` para reusar UNA conexión, (b) que
  `margen()` acepte la cadena ya resuelta y no re-resuelva. La dedup por clave de cadena está bien
  pensada; el problema es el I/O por elemento. **Nota:** 4.2 (FK real en vez de join por string) haría
  la CTE trivial — conviene hacerlos juntos.

### 6.2 🔴 ALTO — El poll de `/reply` paga 2 conexiones nuevas + 2 queries por request, a 1.5s por usuario

- **Evidencia:** cada `GET /reply` ejecuta `require_tenant` → `resolve_cliente_id` (conexión nueva,
  `auth.py:56-63`) y `read_replies` (otra conexión nueva, `reply_store.py:36-42`). Cadencia 1.5s
  mientras se espera respuesta (`useChat.ts:63`). Además la tabla `copiloto_web_replies` NO tiene
  índice compuesto (`uc_tables.json` solo define columnas; el provisionador genérico crea solo
  `id bigserial PK` — `deploy/worker/provision_tables.py:96`; grep `CREATE INDEX` sobre los .sql →
  ningún hit para replies): el filtro `(cliente_id, session_id, id > after)` se apoya en el PK de
  `id` — funciona chico, degrada cuando la tabla acumule.
- **Recomendación (tres piezas chicas):**
  1. Pool de conexiones (= 4.3, un solo fix para todo el backend).
  2. Evitar el hit a `tenants` por request: el signup YA setea el claim `app_metadata.cliente_id`
     (`onboarding.py:5-7`) — usarlo como fast-path con el registry como fallback/verificación, o un
     TTL-cache in-proc de `auth_user_id → cliente_id` (el mapping es efectivamente append-only).
  3. `CREATE INDEX IF NOT EXISTS ... ON copiloto_web_replies (cliente_id, session_id, id)` en el
     mecanismo de índices existente (`*_indexes.sql`).

### 6.3 🟠 MEDIO — `/me` y `/catalog` pagan un round-trip HTTP a Composio en cada request

- **Evidencia:** `web.py:544-548` y `:575-580` — `composio_gateway.list_connections(cliente_id)`
  (API externa, sync en threadpool) en los dos endpoints que la app llama al abrir. `/afip/estado`
  también lo consulta para `drive_conectado` (`serve.py:159-161`).
- **Por qué importa:** el tiempo de apertura de la app queda atado a la latencia de la API de
  Composio (cientos de ms, y un rate-limit de ellos degrada el arranque de TODOS los tenants).
- **Recomendación:** TTL-cache corto (30-60s) per-tenant dentro del gateway, invalidado por
  connect/disconnect (los dos únicos writers ya pasan por el mismo front-door).

### 6.4 🟡 BAJO — `TrabajoStore.margen` individual: 2 conexiones / ~6 queries por request

- **Evidencia:** `trabajo_store.py:129-163` — `resolver` abre su conexión, `margen` abre otra.
  Aceptable como endpoint suelto (`gastos_web.py:175-188`); su costo real está en el loop de 6.1 y se
  resuelve con el pool + el refactor de 6.1.

---

## Ranking — los 7 hallazgos más accionables

| # | Hallazgo | Sev. | Esfuerzo | Dónde |
|---|---|---|---|---|
| 1 | **Cerrar `POST /auth/signup`** (invite-token de env o off en prod) + rate-limit Caddy en `/auth/*` | ALTO | Horas | `web.py:671`, Caddyfile |
| 2 | **Pool de conexiones Postgres** detrás del contrato `conn_factory` existente (arregla 4.3, 6.2 y la mitad de 6.1 de un golpe) | ALTO | Horas | `serve.py:89-100`, `worker_b.py:237` |
| 3 | **Dedup genérico de writes externos** con el `idem_key` que ya viaja (emails/eventos/posts duplicados bajo retry; hoy solo el link MP react está cubierto) | ALTO | ~1 día | `tool_catalog.py`, `dispatcher_emprendedor.py:84-137`, patrón `mp_dedup_store.py` con claim-first |
| 4 | **Frontend tap→glass**: acuse `PRESS_FADE` en `Tile` (3 líneas) + fix del `setState` por frame de scroll (4 líneas) + medir el gap release→frame con el registrador que ya existe | ALTO | Horas | `Tile.tsx:56-71`, `EscritorioFunciones.tsx:238-267` |
| 5 | **`margen_por_trabajo` set-based** (o mínimo: una conexión compartida + no re-resolver), idealmente junto con la FK real presupuesto↔comprobante que mata el join por string | ALTO | ~1 día | main: `inteligencia_queries.py:410-446`; `trabajo_store.py:100-115` |
| 6 | **"Narra sin ejecutar"**: persistir el tool-trace compacto en `self._history` (la evidencia de raíz está; la decisión es MAYOR y ya está escalada) | ALTO | ~1 día + replay-verify | `conversation_workflow.py:404-411,495-499` |
| 7 | **Cap del historial de chat del cliente** (`slice(-N)` en persistir/hidratar) — degradación silenciosa garantizada por la sesión permanente | MEDIO | Horas | `useChat.ts:101-103`, `chatMachine.ts:141,228` |

Menciones que no llegan al ranking pero no deben perderse: secretos en claro fuera del árbol (2.4,
minutos de trabajo), TTL-cache de Composio en `/me`/`/catalog` (6.3), índice de
`copiloto_web_replies` (6.2.3), claim-first en el dedup MP (1.2), y el supuesto "1 turno → 1 reply"
escrito en el contrato antes de que las automatizaciones recurrentes lo rompan (1.3).

---

*Verificación: todos los archivo:línea citados fueron leídos en esta sesión con Read/Grep/Bash sobre
el working tree (o `git show origin/main:` donde se indica). No se ejecutó código ni se tocó ningún
archivo del repo fuera de este informe. Sin acceso a device ni al VPS: las latencias de frontend son
candidatos localizados por código, pendientes de medición en device (el repo ya tiene el
instrumento).*
