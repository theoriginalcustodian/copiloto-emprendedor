# Plan y backlog de cierre — **lo que falta**, medido el 2026-10-06

> 🟢 **ESTE es el documento vigente.** Reemplaza como plan de trabajo a
> [`2026-09-21-backlog-beta-odobi-con-dod.md`](2026-09-21-backlog-beta-odobi-con-dod.md) y a
> [`2026-09-21-plan-implementacion-beta-odobi-autonomo.md`](2026-09-21-plan-implementacion-beta-odobi-autonomo.md),
> que pasan a ser **archivo histórico**: su contenido sigue siendo la definición de cada ítem y su DoD
> original, pero **su descripción del estado es del 21/09 y ya no describe el código**.
> **Pedido del operador que lo motiva (2026-10-06):** *«necesitamos terminar y quiero que tengamos plan
> y backlog con su correspondiente DoD de todo lo que nos queda… y debemos luego ceñirnos al plan para
> terminar»* + *«debemos guardar lo diferido para implementarlo más adelante»*.

---

## 0. Qué pasó con el plan: no se perdió, se perdió su ESTADO

El plan detallado existía y está intacto: **112 ids `BL-*` con DoD** en 102 KB. Lo que no tenía era
**estado por fila** — 10 marcas de check en todo el archivo. El estado real se dispersó en los commits
de `main` y en `coordinacion/PLAN.md`, y entonces el plan quedó **ilegible como plan**: nadie lo abría
para ver qué falta, y cada inventario nuevo se hacía barriendo el código.

Eso tuvo una consecuencia medible, y es la respuesta a *«da la sensación de que no hemos avanzado
nada»*: **el trabajo avanzó, el documento no.** De los 77 ids no-`V`, los cuatro barridos marcaron
**DESALINEADO** en la mayoría de las filas: describen un estado que ya no existe. Leer ese documento
como plan daba, correctamente, la sensación de no haber avanzado — porque es una foto del 21/09.

**Yo cometí el mismo error en la misma sesión**: armé una cola de producto barriendo el código **sin
abrir este plan primero**, que es exactamente lo que prohíbe el canon 3 (el inventario va antes del
diseño). Dos de mis propias filas resultaron falsas al medirlas contra el plan que no había leído
(`FACTURAPDF` ya era `BL-C2` y estaba hecho; `SINPLAN` ya era la decisión `DEC-8`, tomada el 21/09).

### Cómo se midió esto

| Pieza | Cómo |
|---|---|
| Veredicto de los 77 ids no-`V` | 4 sub-agentes read-only en paralelo, uno por lote de familias, **entrando por la evidencia que el propio backlog cita** y verificando que el archivo exista antes de declarar ausencia |
| Que el código esté **en `main`** y no en WIP local | muestreo de 8 archivos de evidencia contra `origin/main` (no contra el worktree, que está 6 días atrás): **8 de 8 presentes** |
| Recuperación de las 77 filas al apéndice | script sobre el transcript, **sin pasar por mi contexto** (`extraer-veredictos.py`), con control positivo: `BL-O6` y `BL-D1` tienen que aparecer o aborta |
| Reconciliación contra commits y tablero | `estado-backlog-112.py`, dos fuentes **reportadas separadas y nunca sumadas** (un commit que no cita el id es falso negativo; un id en el tablero sin código es falso positivo) |

⚠️ **Lo que el extractor enseñó sobre sí mismo:** su primera versión devolvió **36 de 77** filas, y el
hueco era **del patrón, no de los datos** — el lote 2 escribió sus filas sin barra de apertura
(`  BL-W3 | HECHO | …`) y el patrón la exigía. Un «36 de 77» se lee igual que «41 ids sin medir»: sin
el control positivo por familia (que cuadra 1:1 con el conteo del backlog) la cifra incompleta habría
pasado por completa.

---

## 1. El estado medido, en una tabla

**77 ids no-`V`** (familias `B C D F J O P Q W X`), medidos contra `origin/main`:

| Veredicto | Cuántos | Lectura |
|---|---|---|
| ✅ **HECHO** | **56** | código entregado y en `main`. Lo que falta en casi todos **no es código: es la captura en device/PWA** |
| 🟡 **PARCIAL** | **11** | una mitad entregada; el resto suele ser una corrida o un compromiso recurrente |
| 🔴 **FALTA** | **7** | **los 7 son familia `O`** (operación) y **están diferidos por acta**, no olvidados ⇒ **cero `FALTA` accionables hoy** (antes 8: `BL-C5` pasó a `DECIDIDA`) |
| ⚫ **OBSOLETO** | **2** | `BL-B4` (→ `BL-V16`) y `BL-X9` (→ `BL-V2` por `DEC-8`) |
| 🔵 **DECIDIDA** | **1** | `BL-C5` — **no se migra**. No es `HECHO` (no hay código) ni `OBSOLETO` (el ítem sigue siendo real): lo que se resolvió es **el sentido**, y el veredicto tenía que poder decirlo sin inflar ninguna de las otras cuatro cifras |

Más la **familia `V` (35 ids)**, que nunca fue deuda de la beta sino el cajón del post-beta. Triada con
el operador el 2026-10-06: **9 entran** (y de esos **5 ya cerraron solos**), **26 quedan diferidos con
condición de entrada** — §3.

> 🎯 **La conclusión que cambia el plan:** el producto está sustancialmente entregado. El cierre de la
> beta **no está bloqueado por volumen de implementación** sino por (a) un puñado de puntas de código,
> (b) la tanda de device que el operador difirió el 22/09, y (c) decisiones de operación que el acta
> del 21/09 ya mandó a Cierre B.

---

## 2. LA COLA — lo que falta, con DoD binario

Orden de ejecución. Cada fila: **dueño · DoD binario · evidencia `path:línea`**. Un ítem sin DoD
binario no se declara cerrado (canon 7: la autoevaluación no cuenta).

### 2.A — Código, entra ahora

#### A1 · `COBROMP` — el cobro de Mercado Pago nunca se vuelve un Ingreso 🥇
- **Dueño:** backend. **Contrato ya bajado** con inventario §0 medido:
  `coordinacion/abierto/2026-10-05_contrato_planificacion-a-backend_COBROMP-*.md`.
- **Por qué primero:** es la única fila de la cola que rompe la promesa central del producto
  (*cobrar y ver la plata entrar*). El lector está completo y **lee un valor que nadie escribe**:
  `ORIGEN_MP` tiene **una sola aparición en todo el repo — su definición** (`cobro_store.py:55`).
- **Es cablear, no construir:** `registrar_suelto` (`:231`) ya tiene `idem_key` y replay `23505`
  (`:255-262`); el hueco es el literal `'manual'` hardcodeado en el `VALUES`.
- **DoD:** webhook `approved` ⇒ **1 fila** `origen='mercadopago'` por camino de producción · **el mismo
  webhook dos veces ⇒ sigue 1 fila** · adversarial cross-tenant · `pending`/`rejected` ⇒ **0 filas** ·
  los dos carteles «los cobros todavía no entran solos» (`IngresosScreen.tsx:216`,
  `ResumenIngresos.tsx:43`) borrados **en el mismo PR** · recibo del gate citado.

#### A2 · `BL-V34` (gastos) — anotar un gasto dos veces crea dos gastos
- **Dueño:** FE1 + FE2. **Mitad hecha:** el backend **ya es idempotente** desde el PR #666
  (`gasto_store.py:118-131`, índice único parcial `(cliente_id, idem_key)`).
- **Lo que falta es una sola cosa:** el front de gastos **no manda la clave**.
  `TarjetaGastoPropuesto.tsx` es la única tarjeta ausente de los archivos que referencian `idem_key`
  (sí están `TarjetaPresupuestoPropuesto`, `TarjetaClientePropuesto`, `FormularioCliente`,
  `PantallaFacturacion`, `SeccionCobro`).
- ⚠️ **El texto del backlog para este id es FALSO** y hay que leerlo corregido: dice «gastos no tiene
  idempotencia en NINGUNA capa». La tiene desde #666.
- **DoD:** clave **derivada del `mensajeId`** (no de `useRef(generarId())`: el defecto es *la misma
  intención re-disparada desde una card que sobrevivió a la app*, no un gesto con reintentos) ·
  montar→guardar→**desmontar**→montar ⇒ no inserta la segunda vez · **control positivo obligatorio:
  sin el fix, ese test tiene que dar ROJO**.

#### A3 · `BL-V31` (resto) — la quinta tarjeta de mobile sin guard
- **Dueño:** FE1. **4 de 5 cerradas:** `TarjetaPresupuestoPropuesto.tsx:25-46` ·
  `TarjetaFacturaPropuesta.tsx:81-84` · `TarjetaGastoPropuesto.tsx:28-40` ·
  `useConexionRequerida.ts:51-53` — todas con el **guard B** (la marca vive dentro del mensaje
  persistido: cero fuga de claves por construcción).
- **Falta una:** `apps/mobile/src/modules/facturacion/SeccionMisComprobantes.tsx` (352 líneas) tiene su
  propia máquina de anulación con `useState` y **ningún guard**.
- **DoD:** recargar entre «Sí, anular» y «Confirmar» ⇒ **no reaparece «Anular»** · guard B, no A ·
  control positivo rojo sin el fix.

#### A4 · `BL-O6` (mobile) — la aceptación legal no se registra en mobile
- **Dueño:** FE1 + backend (el endpoint ya existe). **Web cerrada:** `SignupScreen.tsx:71` →
  `POST /me/legal/aceptar` (`web.py:1091`) + `tenant_legal_store.py` + E2E
  `scripts/e2e_bl_o6_legal_aceptacion.py`.
- **Falta:** **cero hits** de `aceptarLegal` / `legal_aceptado` en `apps/mobile` — la pantalla existe
  (`PantallaLegal.tsx:3,34`, ruta `app/legal.tsx:17`) pero **no registra la aceptación**.
- **DoD:** alta desde mobile ⇒ fila en `tenant_legal_store` · el E2E existente cubre también el camino
  mobile, o uno gemelo · adversarial: el POST de A no marca a B.

#### A5 · `BL-F1` — el HITL genérico no usa `Recibo`
- **Dueño:** FE1 + FE2. **DoD:** la tarjeta HITL resuelta muestra `Recibo` en **las dos** apps (hoy web
  no lo importa y mobile deja la card con `opacity`) · test por app.

#### A6 · `BL-V29` parte (2) — a 390 px la tab-bar tapa «Ahora no» entero
- **Dueño:** FE2. **La parte (1) ya cerró:** `conexionDescartada` se persiste de verdad en las dos apps
  (`useConexionRequerida.ts:53`, web `useChat.ts:473`).
- **DoD:** a 390 px la franja libre del botón es **> 0 px** (hoy `pctTapado=100`) · **la captura es
  device** ⇒ el código entra ahora, la evidencia visual cae en la tanda diferida.

#### A7 · `DRIVECERO` — Drive se conecta y no tiene ni una acción
- **Dueño:** backend. **Medido:** `apps/copiloto/services/drive.py:75` → `TOOLS: dict[str, str] = {}`,
  contra `gmail.py:68` (`gmail_send`), `sheets.py:114` (`sheets_append_row`), `docs.py:54` (dos tools).
- **DoD binario, con dos salidas válidas:** o **al menos una acción de Drive ejecutable end-to-end**
  desde el chat, o **la UI deja de ofrecer Drive** como app conectable. Lo que no puede quedar es la
  tercera: conectable y sin acciones.

#### A8 · `SHEETSSOLOAPPEND` — Sheets sólo sabe agregar una fila
- **Dueño:** backend. **DoD:** o se amplía (leer / actualizar), o **el límite se declara en la UI** para
  que el usuario no pida lo que no existe. Decisión de alcance: la propone backend, la cierra
  planificación.

#### A9 · `IGHUBSPOTFANTASMA` — la UI ofrece Instagram y HubSpot sin módulo detrás
- **Dueño:** backend + front. **Medido:** `apps/copiloto/services/` sólo tiene
  `base.py docs.py drive.py gmail.py sheets.py` — **no hay HubSpot ni Instagram** (de Instagram sólo
  queda un ejemplo en un docstring, `base.py:21`). Y `hitlMapping.ts` **ya le pinta a Instagram** un
  badge `IRREVERSIBLE` con borde de peligro: una affordance de riesgo para un módulo inexistente.
- **DoD:** o módulo real, o **la UI no los ofrece** (y el `SERVICE_RISK` de Instagram se retira con
  ella). Cero estados intermedios.

#### A10 · Propagar `DEC-8` — plan y límites NO entran en la beta
- **Dueño:** FE1 + FE2. **La decisión está tomada desde el 21/09** y yo la reporté como abierta: el
  acta dice textual *«Plan y límites **no** entran en la beta»* (`DEC-8`, `BL-X9` → `BL-V2`).
- **Barato y sin backend:** no hay sustrato de planes (`admin_web.py:4`: *«7c queda fuera de v1, sin
  sustrato»*), así que es una fila estática de UI + su test + una frase del kb.
- **DoD:** la fila «Plan» sale de `AccountScreen.tsx:108` y su test (`:92-94`) · el andamio
  `app/ajustes-mi-plan.tsx:13-21` sale o queda explícitamente fuera de navegación · la frase del kb
  queda consistente (hoy **ya niega** que haya topes — es correcta, no tocarla por error).

#### A11 · `print` de datos personales en los logs
- **Dueño:** backend. Origen: `BL-V6`, el único de ese paquete que el propio documento marca «conviene
  revisarlo antes si hay testers reales». `agent_activities.py:114`.
- **DoD:** cero PII en logs de ese camino · test que lo verifique · **repo público** ⇒ no entra PII a
  ningún log que pueda viajar.

#### A12 · `BL-V18` — cantidad de comprobantes por cliente
- **Dueño:** backend (expone) + FE2 (muestra). **DoD:** la API de clientes devuelve el conteo ·
  `TarjetaCliente.tsx:48-59` lo muestra · el CUIT/DNI sigue mostrándose cuando existe.

### 2.B — Es tuyo, operador: no lo puedo cerrar yo

| id | Qué necesita de vos | Por qué no es mío |
|---|---|---|
| `BL-X10` | **el asset de audio «o-DO-bi»** | no existe en el repo y no se puede fabricar: es la voz de la marca |
| `BL-X6` | los `.otf` **siguen en la historia de git** | reescribir historia de un repo **público** con tres sesiones y 21 worktrees vivos. No se toca sin tu orden explícita |
| `BL-P6` | el hilo del prototipo sigue intacto (`index.html:3258-3263`: voz → CAE **sin paso HITL**) y `CALMA_TOPE = 5` contra los **3** que pide el acta §4.4 | es el prototipo de Martín; `DEC-1` dice que él diseña y no commitea |
| `BL-O7` | **quién responde soporte y en qué horario** | ⚠️ **y el DoD del backlog está INVERTIDO:** pide que el texto «use ese SLA» en horas, pero la decisión vigente es **no prometer un número de horas**, y está **gateada por tests** (`SoporteScreen.test.tsx:27-29`, `PantallaSoporte.test.tsx:294-300`). Cumplir ese DoD rompería dos suites a propósito |
| `BL-O8` | rotar el token de `39decb95` y el `DATABASE_URL` | vos lo diferiste a pre-prod, y es correcto; queda anotado, no insistido |
| `BL-V22` | `secret_scanning_non_provider_patterns` | **vos decidiste encenderlo al terminar el sprint**, no antes, por falsos positivos. Las otras dos ya están `enabled` |

### 2.C — Device y PWA: la tanda que diferiste el 22/09

**No son ítems nuevos: es la evidencia visual de los 56 HECHO.** Entra al sprint siguiente por tu orden
del 22/09 (*«móvil/device pasa al sprint siguiente; este cierra sin device»*). El **código** de todos
ellos entra ahora; lo que espera es la captura.

- Las capturas de pantalla de los 56 ids `HECHO`.
- `BL-Q2` — una corrida de `smoke_beta_e2e.py` **del día** (la última real fue 21–22/09, 37/37; el
  backlog la fecha el 13/08: desalineado).
- `BL-Q3` v2 — la tanda de device de las 30 filas (par `id+camino`); `fact-voz` y `pres-voz` **por voz
  real** sin ejercitar.
- `BL-Q5` — republicar la matriz con el SHA medido al cerrar cada bloque (compromiso recurrente).
- `BL-V21` — paridad del landing de Facturación en mobile (**decidir el contrato antes de tocar**: hay
  ~15 tests que el port rompería, y en mobile es un diseño intencional distinto).
- `BL-O3` — instalar el build `preview` en un Android ajeno + instructivo versionado (hoy `eas.json`
  sólo tiene `development`/`preview`, Android/APK, `distribution: internal`).

### 2.D — Correcciones del propio backlog (hechas al publicar este documento)

| Dónde | Decía | Mide |
|---|---|---|
| `BL-V34` | «gastos no tiene idempotencia en NINGUNA capa» | la tiene desde #666; falta sólo la clave en el front |
| `BL-Q1` / `BL-V17` | baseline de **484** excepciones | **471** hoy (`testid-paridad-excepciones.json`, último movimiento #732) |
| `BL-Q2` | última corrida **13/08** | 21–22/09, 37/37 contra prod |
| `BL-Q4` | «mobile sigue con el mapa manual `SUPERFICIES`», citando `temaContraste.test.ts:344-348` | **ese archivo ya no existe**: lo reemplazó el walker sobre el árbol RNTL (`paresPintadosContraste.test.tsx`) |
| `BL-O6` | «plantilla genérica en web» + «mobile no tiene pantalla legal» | **las dos falsas** desde #678/#679/#693/#732 |
| `BL-O4` | depende de `fleet-platform` / `sync-fleet-platform.sh` | **no existen en este repo** (0 hits de `prometheus\|grafana\|obs-` en todo `origin/main`) |
| `BL-O7` | el texto debe «usar ese SLA» | invertido: la decisión vigente prohíbe prometer horas, con tests que lo gatean |
| `BL-P7` | «`abierto/` sólo contiene trabajo vivo, todos del 22/09» | 39 archivos (22/09→05/10) + 4 `.bak-*` del mismo `urgente_` |

---

## 3. DIFERIDO — guardado, con condición de entrada y dueño

> **Requisito explícito del operador (2026-10-06):** *«debemos guardar lo diferido para implementarlo
> más adelante»*. Un ítem diferido **sin condición de entrada nombrable** no es deuda gestionada: es
> deuda invisible, y vuelve sola al próximo barrido como si fuera hallazgo nuevo. Cada fila de acá
> tiene **quién lo despierta y con qué evento**.

### 3.1 — Ya cerrados: NO vuelven a la cola (y por qué estaban en ella)

Cinco de los nueve ítems que aprobaste **ya estaban resueltos** cuando los medí. Se registran para que
ningún barrido futuro los reabra:

| id | Estado | Evidencia |
|---|---|---|
| `BL-V32` | ✅ la poda del guard A **existe y está cableada** | `useChat.ts:9` (`podarResolucionesCard`) + `:456` (`removeItem(messagesStorageKey(previous))`) |
| `BL-V33` | ✅ **los tres** tests adversariales HTTP existen | `test_adversarial_multitenant.py:462` (`/catalog`), `:493` (`DELETE /mp/connection`), `:524` (onboarding) — de 15 totales |
| `BL-V35` | ✅ la ventana anti-duplicado **ya mira `created_at`**, no `fecha` | `cobro_store.py` ~`:419`, con el porqué citando este id en el comentario |
| `BL-V29` (1) | ✅ «Ahora no» **persiste** en las dos apps | `useConexionRequerida.ts:51-53` · `useChat.ts:473` |
| `BL-C2` | ✅ la tarjeta de factura **ya ofrece «Ver PDF»**, con 3 estados | `TarjetaFacturaPropuesta.tsx:130` (link), `:135` («Preparando el PDF…»), `:137-138` (CAE válido sin PDF) |

Y dos **refutaciones** mías de la misma sesión, anotadas para que no re-entren como hallazgo:
`REFWEBCOBRO` (la web **sí** tiene tarjeta de cobro: `hitlMapping.ts`, `SERVICE_RISK.mercadopago`) y
`REFTOOLSCONSULT` (la poda de las tools consultivas es **deliberada**: `tool_catalog.py:439-456`, hito 2
— un hueco decidido y uno olvidado se ven idénticos en un grep; **sólo el comentario de al lado los
separa**).

### 3.2 — Familia `V`: los 26 diferidos, con su disparador

| id | Qué | Condición de entrada | Dueño |
|---|---|---|---|
| `BL-V1` | Presupuesto con logo y colores del negocio | Martín cierra el prototipo final (`BL-P2`) **y** se decide dejar el presupuesto de ser un Google Doc | operador |
| `BL-V2` | Plan, medidor y tope | **`DEC-8` lo dejó afuera.** Vuelve sólo si se decide monetizar por plan | operador |
| `BL-V3` | Calendar capa 3: evento ↔ cliente | nunca contratado; entra si un tester lo pide | operador |
| `BL-V4` | Huecos de agenda | visión (decisión 10 del 16/09) | operador |
| `BL-V5` | **Ingesta real al grafo por tenant** | 🔴 **frente MAYOR abierto**: hoy la memoria devuelve `[]` a todo tenant real (`inteligencia_chat.py:90`). Disparador: decisión tuya de que la memoria de grafo sea parte de la promesa | operador + backend |
| `BL-V6` | Riesgos de escala (pool PG, N+1, caché Composio, firma que ignora payload, 4 errores tragados) | **> 15 testers concurrentes.** El `print` de PII salió de acá y entra ahora (A11) | backend |
| `BL-V7` | Pentest, chaos, carga | volumen real de usuarios | operador |
| `BL-V8` | Revocar en MercadoPago al desconectar | sólo si se **promete** como garantía al usuario | planificación |
| `BL-V9` | `DROP COLUMN sheet_fila` | irreversible: **espera tu OK explícito** | operador |
| `BL-V10` | Fixtures de replay de los 7 workflows restantes | diferido por riesgo (ADR-003 §4c). Disparador: el primer no-determinismo real en prod | backend |
| `BL-V11` | EPERM intra-run del gate | oportunista, **sin disparador**: se hace si molesta | backend |
| `BL-V12` | Dos suites lentas de mobile (`testTimeout=20000`) | requiere profiling; entra si el gate empieza a tardar | FE1 |
| `BL-V13` | Memoria busca top-10 por similitud | deuda condicional **no disparada** (depende de `BL-V5`) | backend |
| `BL-V14` | TODO muerto del guardrail de narración | cosmético; en el próximo PR que toque ese archivo | backend |
| `BL-V15` | OAuth propio de Google en Composio (branding) | sale de `DEC-12` si decidís branding propio | operador |
| `BL-V16` | `gate.sh` en bash 3.2 (macOS), ex `BL-B4` | `DEC-1`: Martín diseña y no commitea. **Vuelve si eso cambia** | operador |
| `BL-V17` | Triage de las **471** excepciones de paridad | el trinquete ya impide que crezcan. Disparador: cada vez que alguien toque la pantalla que contiene la excepción | backend |
| `BL-V19` | Persistir metadatos de voz (origen + duración) | hoy el chip se dibuja en el cliente; entra si hay que auditar el origen por voz | backend |
| `BL-V20` / `BL-V20b` | Divergencias de **patrón** de 5 pantallas web | Martín cierra el prototipo final (`BL-P2`). `V20b` además está **subordinado a A-3**, que tiene implicancia fiscal | operador |
| `BL-V21` | Paridad del landing de Facturación en mobile | tanda de device + **decidir el contrato primero** (~15 tests lo fijan) | planificación |
| `BL-V22` | Push protection `non_provider_patterns` | **al terminar el sprint**, por tu decisión | operador |
| `BL-V23` | Agenda dice «Conectá» a quien ya había conectado | **el fix existe a 40 líneas**: portar el desempate de `MidiaScreen.tsx:323-337` a `AgendaScreen.tsx:91-95`. Entra al primer PR que toque Agenda | FE2 |
| `BL-V24` | Costo por hoja de conexión pendiente (1,4× / 3,2×) | hipótesis **no medida**: `HISTORY_TAIL = 54`. Disparador: una queja real de lentitud | backend |
| `BL-V25` | Detalle de presupuesto sin `backdrop-filter` | pulido | FE2 |
| `BL-V26` | Dos feedbacks de instrumentación en prod | borrarlos **muta prod** y destruiría evidencia: necesita tu autorización | operador |
| `BL-V27` | Fila `afip`: rótulo y chip del CUIT | **escalada a vos** (implicancia fiscal). Sin trabajo antes de esa decisión | operador |

### 3.3 — Familia `O`: operación, diferida por el acta del 21/09

**No es deuda olvidada: son los 7 `FALTA` que el acta mandó a Cierre B.** Se listan para que el cierre
de la beta no los cuente como pendientes del sprint.

| id | Qué | Condición de entrada |
|---|---|---|
| `BL-O1` | Allow-list de testers (hoy sólo `e2e-device@copiloto.test`, `deploy.sh:243-250`) | `DEC-12` → Cierre B. El gate ya es **fail-closed** (`web.py:583-588,1208`) |
| `BL-O2` | Pantalla de consentimiento de Google + test users | `DEC-12` → Cierre B. ⚠️ consent screen en **Testing**: los permisos **caducan a 7 días** |
| `BL-O3` | Build instalado en Android ajeno + instructivo | tanda de device. `DEC-13`: sin iOS en la beta |
| `BL-O4` | Observabilidad (alertas, runbook) | Cierre B. ⚠️ **su dependencia declarada no existe en este repo** |
| `BL-O5` | Backups encendidos + restore probado | Cierre B. **Apagados por diseño**, documentado; **no medible desde el repo** (vive en el VPS) |
| `BL-O7` | SLA de soporte | **tu decisión** — y con el DoD invertido (§2.B) |
| `BL-O8` | Rotación de token y `DATABASE_URL` | pre-prod, por tu decisión |

---

## 4. Criterio de cierre — binario

Este sprint cierra cuando **todo** esto es verdad sobre **un mismo SHA de `main`**:

1. **Las 12 filas de §2.A mergeadas**, cada una con su DoD cumplido y el recibo del gate citado
   (`scripts/gate.sh`, ADR-001). Sin recibo no cuenta: GitHub verde es la segunda confirmación, no la
   única.
2. **Cero filas `[ASSUMED_PENDING_VERIFY]`** en la cola: todo lo que quedó fuera está en §3 **con
   condición de entrada y dueño nombrados**.
3. **Las correcciones de §2.D aplicadas** al backlog del 21/09, para que nadie vuelva a leer un estado
   que ya no existe.
4. **Los cinco capability-checks del producto responden SÍ** sobre prod-beta: entrar · conectar una app
   · facturar · **cobrar y ver la plata entrar** (A1) · preguntarle al copiloto.
5. Lo de §2.B queda **escrito como tuyo**, no como pendiente del equipo.

**Lo que este sprint NO cierra, por tu orden del 22/09:** la tanda de device (§2.C) y el Cierre B
(§3.3). El criterio de cierre de la beta completa sigue siendo el del documento del 21/09 §13, que
**incluye** esas dos cosas más el tester externo con video.

---

## Apéndice A — los 77 ids no-`V`, uno por uno

Filas tal como las midieron los cuatro barridos, recuperadas del transcript por script (no
transcritas). Conteo por familia verificado 1:1 contra el backlog: `B5 C6 D8 F2 J13 O8 P7 Q5 W12 X11`.

> 🧭 **Leyenda de las marcas de evidencia local — corregida el 2026-10-06, porque la anterior invertía la
> dirección.** La marca vieja `[WIP-LOCAL]` decía *«el archivo citado tiene cambios sin commitear»*. Es
> **cierto** y empuja al **gesto equivocado**: se lee como *«commiteá para no perder trabajo»*, cuando en
> todos los casos vivos la dirección es la **opuesta** — el disco está **atrasado** y commitearlo
> **revierte fixes cerrados**. Una alarma con la dirección invertida recomienda el gesto peligroso **y
> suena prudente mientras lo hace**.
>
> - **`[DISCO-ATRASADO]`** — el checkout compartido tiene una versión **vieja** del archivo citado:
>   **no commitear desde ahí**. Medido contra `origin/main` = `c3208b5d`: `apps/copiloto/web.py`
>   **`+21/−122`** (es **pre-#850** — trae `first_seller_user_id()`, el criterio que ese PR retiró) ·
>   `apps/copiloto/tool_catalog.py` **`+7/−23`**.
> - **marca vencida** — se midió y el archivo **coincide** con `main`: `afip_web.py` y `afip_rules.py`, sin
>   diff. Las filas que las citaban (`BL-C6`, `BL-X5`) **ya no tienen cautela pendiente por este motivo**.
> - 🔴 **`git status` NO responde esta pregunta, y por eso este documento se equivocó.** Compara contra el
>   **HEAD de la rama checkouteada**, no contra `origin/main`, y esa rama era vieja.
>   `deploy/copiloto/durabilidad-gate.sh` sale **`??` (untracked)** —de ahí el *«(sin commitear)»* de
>   `BL-B1`— mientras **`main` ya lo tiene con 43 líneas** y el disco tiene **28**: commitearlo borraba 15
>   líneas con el diff más inocente que existe, *agregar un archivo nuevo*. Un `M` al menos invita a
>   diffear; **`??` es el único estado que nadie cuestiona.**
> - ⚠️ **No todo el disco está atrasado**, así que un `checkout` masivo es igual de peligroso en el otro
>   sentido: `apps/mobile/src/modules/facturacion/PantallaFacturacion.tsx` es **`+1/−0`** (un
>   `eslint-disable` con su justificación: trabajo genuino que **sólo** vive ahí).
>
> ⇒ **La pregunta correcta no es «¿está modificado?» sino «¿en qué dirección, contra `origin/main`?»:**
> `git diff --numstat origin/main -- <archivo>`, y mirar el **signo**. Archivo por archivo.

<!-- VEREDICTOS:INICIO -->

| id | veredicto | evidencia `path:linea` | que falta concretamente | desalineado |
|---|---|---|---|---|
| BL-B1 | HECHO [DISCO-ATRASADO] | deploy/copiloto/deploy.sh:32,378,494 · deploy/copiloto/durabilidad-gate.sh (🔴 `main` **ya lo tiene con 43 líneas**; el disco compartido tiene **28** y `git status` lo marca `??` — ver leyenda) · scripts/e2e_g6_durabilidad_worker_restart.py:159-175,297,323 · scripts/test-durabilidad-gate.sh · coordinacion/cerrado/2026-09-22/…_K-12-gotrue-real-y-BL-B1-durabilidad-verde.md:16-27 | el nombre «en vuelo» sigue; el log citado (`_ctl/deploy-k07b-k12-durabilidad.txt`) vive fuera del repo | DESALINEADO — el script corrió contra restart real y quedó cableado a `deploy.sh`
| BL-B2 | HECHO | apps/copiloto/afip_factura_workflow.py:247-260 (`workflow.patched("ventana-de-vida-borrador")`) · apps/copiloto/tests/test_factura_ventana_de_vida.py:3-6 · apps/copiloto/tests/test_workflow_replay_gate.py:43 · grep `hito9-dictado-sin-ventana-de-vida` sólo en docs, ya no en código | el TODO sobrevive citado en docs/copiloto-emprendedor/2026-07-28-analisis-manejo-de-errores-toda-la-app.md:306 y en el backlog | DESALINEADO — `wait_condition` ya tiene timeout versionado
| BL-B3 | HECHO | .githooks/pre-push:11-17 · scripts/secretos-check.sh:2,29-54,82 · scripts/ci/lint.sh:11-13 · .gitleaks.toml · .gitleaksignore · .tools/gitleaks-8.30.1 · scripts/tests/test-secretos-check.sh · `git config core.hooksPath` = `.githooks` (relativo) · coordinacion/cerrado/2026-09-21/…_B2-K07B-en-prod-K13-tests-B3-en-PR.md:8 (1429 commits, 3 hallazgos perdonados, control 10/10) | nada | DESALINEADO — «grep de secret/gitleaks/trufflehog vacío» es falso
| BL-B4 | OBSOLETO | docs/copiloto-emprendedor/2026-09-21-acta-decisiones-beta-odobi.md:11 (DEC-1 → `BL-V16`) · scripts/gate.sh:76 (`declare -A`) · scripts/ci/jest-con-reintento-eperm.sh:27 (`mapfile`) | no se implementa en la beta por decisión; el código sigue requiriendo bash ≥4 | —
| BL-B5 | HECHO | docs/copiloto-emprendedor/adr/2026-08-06_ADR-001_…md:204 (fila corregida a «⚠️ scriptado, NUNCA corrido») y :236-249 (§12: «el gate sigue siendo manual», mirror diferido con disparadores de reapertura) | nada: el ADR dice una sola cosa y la aceptación por escrito está | DESALINEADO — la contradicción línea 204 vs 231 ya fue resuelta el 2026-09-21
| BL-C1 | HECHO | `apps/copiloto-web/src/modules/connections/ServiceCard.tsx:94` (`canDisconnect` exige `disconnect_path`), `:144-148` (acción en la card activa), `:182-196` (confirmación «Sí, desconectar» que dice qué se pierde) · tests `ServiceCard.test.tsx:50-84`, `ConnectionsScreen.test.tsx:175,191` | Desconexión real de Composio y MercadoPago en el PWA desplegado con `e2e-device` (no medible sin deploy) | **DESALINEADO** — el ítem dice «sólo sello CONECTADO»; la acción, la confirmación y los dos tests de estado ya están. `[DISCO-ATRASADO]`: el disco compartido tiene `apps/copiloto/web.py` **pre-#850** (`+21/−122` vs `main`) — **no commitear desde ahí** |
| BL-C2 | HECHO | `apps/copiloto-web/src/modules/chat/TarjetaFacturaPropuesta.tsx:48-63` (sondeo del PDF hasta `terminado`), `:122-130` (N°, CAE, Vence, acción «Ver PDF»), `:137-138` (CAE válido sin PDF) · tests `TarjetaFacturaPropuesta.test.tsx:104-150` | Factura real en homologación con `e2e-device` en el PWA, lado a lado con `?ver=fact-cae` | **DESALINEADO** — el ítem cita `:59-66` como «dato ya en cliente, sin pintar»; ya se pinta con sondeo. Coincide con `Auditorias/...a28d4e23`: «el código SÍ muestra CAE» |
| BL-C3 | HECHO | `packages/core/src/chat/separadoresFecha.ts:11-45` (offset fijo AR, «Hoy»/«Ayer»/fecha) · web `MessageList.tsx:11,115` · mobile `ListaMensajes.tsx:15,382` · tests `separadoresFecha.test.ts:11-24` (borde de medianoche 02:59:59Z/03:00:00Z), `MessageList.test.tsx:75-88`, `ListaMensajes.test.tsx:261` | Captura de un hilo con ≥2 días en PWA y device | **DESALINEADO** — el ítem dice «un solo `sessionMarker`» en web y «tampoco los tiene» en mobile; las dos apps consumen `separadoresDeDia` de core |
| BL-C4 | HECHO | web `apps/copiloto-web/src/modules/gastos/FormularioGasto.tsx:90-91` (`data-testid="gasto-origen"` + `ETIQUETA_ORIGEN_GASTO`) · mobile `apps/mobile/src/modules/gastos/FormularioGasto.tsx:121-124` · tests `FormularioGasto.test.tsx:11-18` (ambas apps), `GastosScreen.test.tsx:175,191`, `PantallaGastos.test.tsx:458,493` | Captura en device de una propuesta por voz y una por foto | **DESALINEADO** — el ítem dice que web «sólo muestra la cita OCR si es foto» y mobile «sólo lo envía»; las dos lo muestran para los tres valores, con test por valor |
| BL-C5 | 🔵 **DECIDIDA — no se migra (2026-10-06)** | `apps/mobile/src/modules/apps/PantallaApps.tsx:2` (import `Linking`), `:172-177` (el TODO, fechado **2026-07-21**), `:178` (`canOpenURL`), `:183` (`openURL`) · dependencia **aún declarada** en `apps/mobile/package.json:29` — salió del **código** en BETA-4b, no del manifiesto · rechazo del operador en `apps/mobile/src/modules/auth/oauth.ts:3-9` (**2026-08-05**) | **Ninguna acción de código.** El DoD anterior pedía *«reemplazar `Linking` por `openAuthSessionAsync`»* — y `openAuthSessionAsync` **es Custom Tabs en Android**, el mecanismo que el operador rechazó **por su nombre**: *«ni Custom Tabs forzando Chrome ni ningún otro»*. Se mantiene `Linking` (navegador del sistema). **Se reabre sólo si el operador pide Custom Tabs con esa palabra**, no «cuando haya un build EAS» | ✅ **Alineada — y el DoD viejo era una trampa con fecha de activación.** 🔴 El TODO es **15 días ANTERIOR** al rechazo, y su único motivo escrito para no migrar es de **costo** (*«rebuildear lo dejaría sin app a mitad de una prueba»*) ⇒ su disparador implícito era *«cuando el costo baje»*, que el propio TODO nombra: **el próximo build EAS**. Así, el primer build EAS disparaba la construcción de lo rechazado, **de buena fe**. Mover el bloqueo de **costo** a **preferencia** es el arreglo, y además **retira** la pregunta «¿el APK instalado ya trae el módulo nativo?»: con preferencia, el costo cayendo a cero no reabre nada. Migrar sí sería MAYOR (decisión del operador). TODO → decisión registrada: dueño **frontend1**, sin PR propio |
| BL-C6 | HECHO | backend `apps/copiloto/afip_web.py:208-217` (409 `CUIT_NO_VINCULADO` si no está entre los vinculados y el tenant ya vinculó alguno) · `errores_web.py:41,66` · tests `tests/test_afip_cuit_vinculado_pg.py:1-2,54-57` (adversarial A↔B contra Postgres real con RLS `FORCE`), `tests/test_afip_onboarding.py:467-473` · cliente `packages/core/src/api/afip.ts:574-580` → `afip.test.ts:245-263` · UI con salida + error del backend: `apps/copiloto-web/.../PantallaAfipSetup.test.tsx:33-38`, `apps/mobile/.../PantallaAfipSetup.test.tsx:247-250` | Evidencia de device + PWA con un CUIT ajeno (no medible sin device/deploy) | **DESALINEADO** — el ítem dice «backend no rechaza un CUIT no vinculado» y «`setCuitBloqueado(false)` sin validar»; el rechazo, el test adversarial y el mapeo de UI en las dos apps ya existen. ✅ **marca vencida** (medido 2026-10-06): `apps/copiloto/afip_web.py` **coincide con `main`**, sin diff |
| BL-D1 | HECHO | `apps/copiloto/presupuesto_store.py:216-253,282-287` (`crear_idem` + único parcial `(cliente_id, idem_key)`) · `apps/mobile/src/modules/chat/TarjetaPresupuestoPropuesto.tsx:24-32,42-46,59-60` (guard patrón B en `mensaje.presupuestoResuelto`) · `apps/copiloto/tests/test_presupuesto_store.py:101,112,125,137` · `TarjetaPresupuestoPropuesto.test.tsx:204-220` | Sólo la evidencia de device y la consulta con claims de duplicados (R-8) anotada en el cierre | **DESALINEADO** — el backlog dice «inserta con `max(numero)+1`, sin clave de idempotencia» y «`useState` sin persistencia»; ambas afirmaciones son falsas hoy (PR #663 + GUARDM parte 2) |
| BL-D2 | HECHO | mobile `apps/mobile/src/modules/chat/BotonVoz.tsx:34-41` (`UMBRAL_CANCELAR_PX=80`, `DURACION_MINIMA_MS=350`), `:265-267` (`translationX`), `:179-186` (toque corto descarta) · web `apps/copiloto-web/src/modules/chat/MicButton.tsx:20-27,252-275` · tests `BotonVoz.test.tsx:190-237`, `MicButton.test.tsx:178-212` | Device con `adb input motionevent` + captura PWA (no medible sin device) | **DESALINEADO** — `BotonVoz.tsx` ya lee eje horizontal y `MicButton.tsx` ya tiene eje horizontal; el ítem los cita como ausentes |
| BL-D3 | HECHO | `apps/mobile/src/modules/chat/ListaMensajes.tsx:126-134` (logo+label servicio), `:136-147` (badge riesgo), `:149-158` (PARA/MONTO), `:161-169` (aviso irreversible con `accessibilityRole="alert"` + borde `peligro` en `:118-121`) · tests `ListaMensajes.test.tsx:169-200,288-289` | Captura de device de un HITL irreversible real (no medible sin device) | **DESALINEADO** — el backlog dice «sólo `gate.markdown` + Confirmar/Cancelar»; la paridad con web ya está completa, con el test positivo/negativo pedido |
| BL-D4 | HECHO | web `apps/copiloto-web/src/modules/chat/ChatScreen.tsx:85` → `useChat.ts:224,376` · mobile `apps/mobile/src/modules/chat/ListaMensajes.tsx:331-334` → `useChat.ts:132,326-331` · tests `apps/copiloto-web/src/modules/chat/useChat.test.ts:99-111`, `apps/mobile/src/modules/chat/useChat.test.ts:122-130`, `ListaMensajes.test.tsx:87-110` · captura `BL-D4-hilo-cancelar-burbuja-fix.png` (untracked) | El DoD pedía test en `packages/core`: `grep displayText packages/core` = vacío — mobile ya no usa el reducer de core sino su `useChat` propio, así que ese test no aplica | **DESALINEADO** — el ítem cita `chatMachine.ts:238-239` como camino de mobile; mobile tiene `useChat` propio con el fix. Pendiente real: confirmar que el hilo recargado no lo repinta (depende de persistencia backend) |
| BL-D5 | HECHO | `packages/core/src/dinero/totalAproximado.ts:19-27` (`multiplicarDecimal`, única copia), `:41-47` (`redondear` mitad-arriba) · copias borradas: `apps/copiloto-web/src/modules/presupuestos/FormularioPresupuesto.tsx:63` y `apps/mobile/.../FormularioPresupuesto.tsx:63` sólo dejan el comentario de la mudanza · test `totalAproximado.test.ts:11-14` | Captura PWA de `pres-hitl` | **DESALINEADO** — el ítem cita la función duplicada en web `:66-75` y mobile `:73-82`; esas copias ya no existen |
| BL-D6 | HECHO | `apps/copiloto-web/src/modules/midia/midia.css:168-181` (`line-clamp: 2` estándar + causa real nombrada: bug de pintado, no de layout) · test `midiaTarjetaClamp.test.ts:17-23` · confirmado en prod: `docs/copiloto-emprendedor/Auditorias/2026-09-22-auditoria-A4-cierre-A.md:62` | Nada medible pendiente (captura `?ver=tablero` no verificable estáticamente) | **DESALINEADO** — el ítem dice «`-webkit-line-clamp` sin el `line-clamp` estándar» y «falta confirmarla en vivo»; ambas cosas ya se resolvieron (PR #625) |
| BL-D7 | HECHO | `apps/copiloto-web/src/shell/TabBar.tsx:92-102` (`KEYS_TAB_BAR_FIJAS = ['chat','midia','escritorio']`), `:102-136` (`tabsBarraTelefono`, `TABS`/`tabsVisibles` intactos para `Rail` ≥900px) · tests `TabBar.test.tsx:55-66` (3 puertas a 390px; 4 con admin) · capturas `bld7-390px-barra-fija.png`, `bld7-390px-funciones-tiles.png` | Nada | **DESALINEADO** — el ítem dice «pinta 10 `TABS` (+admin) bajo 900 px»; el filtro ya está y el docstring ya no dice «4 ítems fijos» |
| BL-D8 | HECHO | `apps/copiloto-web/src/modules/connections/ConnectionsScreen.tsx:67-69` (título «Apps») · test `ConnectionsScreen.test.tsx:91` · ícono confirmado cargando en prod: `Auditorias/2026-09-22-auditoria-A4-cierre-A.md:64` · capturas `bl-d8-conexiones-antes.png`, `bl-d8-apps-despues-390px.png` | Observación abierta derivada (columnas desiguales a 390px → H-A4-14), fuera del DoD de este ítem | **DESALINEADO** — el ítem dice que el título es «Conexiones» y que la causa del ícono está sin reproducir; las dos cosas se cerraron (PR #633) |
| BL-F1 | PARCIAL | existe en las dos: `apps/copiloto-web/src/design-system/Recibo.tsx:38-45` (`role="status"` + `aria-live="polite"`) y `apps/mobile/src/modules/chat/Recibo.tsx:22-33` (`accessibilityLiveRegion`) · consumidores: web `TarjetaFactura/Gasto/Ingreso/Cliente/PresupuestoPropuesto.tsx:115,61,87,115,78`; mobile `TarjetaPropuestaShell.tsx:77` + `TarjetaFacturaPropuesta.tsx:130` · aviso H-23 `TarjetaFacturaPropuesta.tsx:222` (mobile) y test web `:71-74` · tests de anuncio `Recibo.test.tsx:7-18` / `:15` | El HITL genérico NO lo usa: `apps/copiloto-web/src/modules/chat/HitlCard.tsx:1-3` no importa `Recibo` y mobile `ListaMensajes.tsx:118-121` deja la card en sitio con `opacity` en vez de un `Recibo` terminal | Parcialmente desalineado: el backlog lo plantea como «componente que falta»; existe y lo usan las 5 cards de propuesta. Falta sólo la pata HITL del DoD |
| BL-F2 | HECHO | mobile `apps/mobile/src/modules/chat/TarjetaLinkDeCobro.tsx:34-64` (monto `formatearImporte`, concepto, Compartir vía `Share` nativo / Abrir) · ruteo `ListaMensajes.tsx:302-305` (`leerLinkDeCobro`, sin `url` cae a `Burbuja`) · `packages/core/src/chat/linkDeCobro.ts` + `.test.ts` · tests `ListaMensajes.test.tsx:481-497`, `TarjetaLinkDeCobro.test.tsx` | Mobile aún no porta otros `kind` (`email_draft`, `doc`, `calendar_event`) que web sí pinta en `ArtifactView.tsx:40,54`: falta la decisión/ítems del DoD. Device pendiente | **DESALINEADO** — el ítem afirma «grep de `payment_link`/`init_point` en `apps/mobile/src` vacío»; hoy hay renderer, ruteo y 2 tests. `[DISCO-ATRASADO]`: el disco compartido tiene `apps/copiloto/tool_catalog.py` **atrasado** (`+7/−23` vs `main`) — **no commitear desde ahí** |
| BL-J1 | HECHO | apps/copiloto/presupuesto_store.py:221,249-253 · apps/copiloto/presupuestos_web.py:150,273 · packages/core/src/api/presupuestos.ts:363,387 · apps/mobile/src/modules/chat/TarjetaPresupuestoPropuesto.test.tsx:184 | nada: store con único parcial `(cliente_id, idem_key)`, endpoint y el front ESCRIBEN la clave | DESALINEADO
| BL-J2 | HECHO | apps/copiloto/inteligencia_queries.py:220 · packages/core/src/api/inteligencia.ts:41,141 · packages/core/src/midia/caja.ts:19,47 · apps/mobile/src/modules/midia/PortadaNegocio.tsx:37 · apps/copiloto-web/src/modules/midia/PortadaNegocio.tsx:37 | nada: sin fecha el chip se omite (caja.ts:58, caja.test.ts:46) | DESALINEADO — `CajaPortada` ya tiene 4 campos, no `{saldo, moneda}`
| BL-J3 | HECHO | apps/copiloto/inteligencia_queries.py:212-222 · apps/copiloto/tests/test_inteligencia_queries.py:200,208 · packages/core/src/midia/caja.ts:34,55 | nada: tenant de un solo mes → `variacion_pct: None` testeado; chip entero omitido | DESALINEADO — la evidencia cita `serieMensual` del front; la cuenta ya vive en backend
| BL-J4 | HECHO | apps/copiloto/conexiones_salud.py:19,36 · apps/copiloto/mi_dia_detector.py:346-350,390 · apps/copiloto/tests/test_conexion_caida.py:122,140 · apps/copiloto-web/src/shell/AvatarCuenta.tsx:36,47 · apps/mobile/src/modules/midia/PantallaMiDia.tsx:521 · apps/copiloto-web/src/modules/connections/ServiceCard.tsx:161 | la revocación se testea con tenants de test, no revocando una conexión real de `e2e-device` | DESALINEADO — «HOY nada en el catálogo lo dispara» ya no es cierto
| BL-J5 | HECHO | apps/copiloto/mi_dia_clasificacion.py:39-41 · apps/copiloto/mi_dia_tarjeta_store.py:53 · packages","stderr":"
| BL-J6 | HECHO | apps/copiloto/clientes_web.py:154,159 · apps/copiloto/cliente_store.py:258 · apps/copiloto/tests/test_cliente_store.py:84,109 · apps/copiloto/tests/test_clientes_web.py:168,215 · apps/mobile/src/modules/clientes/PantallaClientes.tsx:90,128,302 · apps/copiloto-web/src/modules/clientes/ClientesScreen.tsx:64,96,248 | nada: total y agregados tenant-wide, ignoran `q`/`limit`; adversarial y >1 página en verde | DESALINEADO — «no hay pedido_» es falso
| BL-J7 | PARCIAL | apps/copiloto/web.py:779,1012 [DISCO-ATRASADO] · packages/core/src/api/transcribir.ts:51 · packages/core/src/api/leerFotoGasto.ts:50 · apps/mobile/src/modules/{gastos,ingresos,presupuestos,clientes} + web idem (MicFuncion) · apps/mobile/src/modules/gastos/FotoFuncion.tsx · apps/mobile/src/modules/chat/Burbuja.tsx:71 · apps/copiloto-web/src/modules/chat/Bubble.tsx:57 | sólo falta la captura device lado a lado con `?ver=card`; todo el código del DoD está | DESALINEADO — «sin MicButton/BotonVoz/useVozComando en modules/gastos de ninguna app» es falso
| BL-J8 | HECHO | apps/copiloto/catalog.py:113-127 · apps/copiloto/dispatcher_emprendedor.py:286 · apps/copiloto/tool_catalog.py:1638-1644,613-618 [DISCO-ATRASADO] · motor/backend/agent/conversation_workflow.py:446-459 · motor/backend/agent/fixtures/history_gate_card_sobrevive_confirm.json · apps/copiloto/tests/test_workflow_replay_gate.py:51-53 · apps/copiloto-web/src/modules/chat/useConexionRequerida.ts | nada medible: gate estructurado, chequeo ANTES del HITL (H-A3-2) y fixture de replay del `gate_card` (H-A3-4) existen | DESALINEADO — dispatcher_emprendedor.py:279-283 ya adjunta `card`, no sólo texto
| BL-J9 | HECHO | apps/copiloto/presupuesto_sugerencias.py:12,20 · apps/copiloto/catalog.py:132-142 · motor/backend/agent/conversation_workflow.py:654-671 (precedencia por `bloquea`) · apps/copiloto/tests/test_plata_por_voz.py:347,359-381 · apps/copiloto/tests/test_adversarial_multitenant.py:415 · apps/copiloto-web/src/modules/presupuestos/DetallePresupuesto.tsx:272 · apps/{mobile,copiloto-web}/src/modules/chat/ChipArmarFactura.tsx | sin evidencia en árbol del ciclo device punta a punta | DESALINEADO — `marcar_presupuesto` sí sugiere; el grep de «Armá la factura»/«Mandalo por mail» ya no es vacío
| BL-J10 | HECHO | apps/copiloto/uc_tables.json:68,131 · apps/copiloto/perfil_negocio_store.py:52-60 · packages/core/src/api/perfilNegocio.ts:46,228 · apps/mobile/src/modules/ajustes/negocio/PantallaPerfilNegocio.tsx:223,381 · apps/copiloto-web/src/modules/ajustes/negocio/PantallaPerfilNegocio.tsx:144,155 · apps/copiloto/tests/test_perfil_negocio_store.py:80-89 | nada: columnas, API, validación en ambos lados y aislamiento cross-tenant | DESALINEADO — `perfilNegocio.ts` ya tiene `telefono`/`email`
| BL-J11 | HECHO | apps/copiloto/web.py:1264 [DISCO-ATRASADO] · packages/core/src/api/auth.ts:49,54 · apps/copiloto/tests/test_cambiar_cuenta_gotrue_real.py:27,38 · scripts/gate.sh:137-147 (`test-gotrue.sh --export`) | nada: los 8 tests ya no dependen de `UC_TEST_GOTRUE_URL` a mano (H-A3-11 cerrado) | DESALINEADO — «auth.ts sólo expone login» es falso
| BL-J12 | HECHO | apps/copiloto/web.py:906-910 [DISCO-ATRASADO] · apps/copiloto/feedback_store.py:40,46 · apps/copiloto/admin_web.py:179-195 · apps/copiloto/provision.py:435-445 · packages/core/src/api/feedback.ts:44,57 · apps/mobile/src/modules/feedback/LoPedisteVos.tsx · apps/copiloto-web/src/modules/ajustes/LoPedisteVos.tsx | sin evidencia en árbol de la captura con un pedido marcado escuchado | DESALINEADO — el grep de «Lo pediste vos» ya no es vacío
| BL-J13 | HECHO | docs/copiloto-emprendedor/adr/2026-09-21_ADR-004_agenda-de-varios-dias-y-escritura-de-eventos.md · apps/copiloto/mi_dia_web.py:46,176-200 · apps/copiloto/tests/test_mi_dia_web.py:226,256,276 · apps/mobile/src/modules/midia/PantallaAgenda.tsx:37,102 · apps/copiloto-web/src/modules/midia/AgendaScreen.tsx:26,102 | «Nuevo evento» no escribe: deriva al chat (HITL del agente); falta la verificación en Google Calendar de `e2e-device` | DESALINEADO — `_rango_hoy` ya no es el único rango; ADR-004 reemplazó CAL1 §3
| BL-O1 | FALTA | `apps/copiloto/web.py:583-588,1208` (gate fail-closed) · `deploy/copiloto/deploy.sh:243-250` siembra la allow-list **sólo** con `e2e-device@copiloto.test` | Allow-list sin testers; ningún tester hizo el alta; control negativo por email fuera de lista no corrido. Acta `2026-09-21-acta-decisiones-beta-odobi.md:22` (DEC-12) lo difiere a Cierre B | — |
| BL-O2 | FALTA | DEC-12 en `docs/copiloto-emprendedor/2026-09-21-acta-decisiones-beta-odobi.md:22` («Google OAuth y lista de testers: más adelante, Cierre B») · `2026-07-21-runbook-oauth-google-propio.md:88-94` (consent screen en Testing, permisos caducan a 7 días) | Sin captura de la pantalla de consentimiento, sin test users cargados, sin login E2E en navegador real | — |
| BL-O3 | FALTA | `apps/mobile/eas.json` (idéntico en worktree y `origin/main`): sólo `development` y `preview`, Android/APK, `distribution: internal` · DEC-13 en acta:23 («Sin iOS en la beta») | Build `preview` no instalado en Android ajeno; cero instructivo de instalación versionado (`git ls-tree -r origin/main \\| grep -i apk` → 0) | — |
| BL-O4 | FALTA | cero hits de `prometheus\\|grafana\\|alertmanager\\|node_exporter\\|obs-` en `deploy/`, `scripts/` y en todo `origin/main` (`git ls-tree -r origin/main`) · `scripts/crones/` sólo tiene 6 `.md` de monitoreo de sesiones | Ninguna alerta, ningún disparo de prueba, ningún runbook. La dependencia citada no existe acá: no hay `platform/` ni `scripts/sync-fleet-platform.sh` | DESALINEADO (la dependencia `fleet-platform`/`sync-fleet-platform.sh` no está en este repo) |
| BL-O5 | FALTA | `memoria/backups-fusion-y-temporal-apagados-por-diseno-deuda-diferida.md:9-11,24-30` (apagados por diseño; «no hay nada que grepear en este repo») · acta:24 difiere backups a Cierre B | Backups no encendidos, restore no probado. El ítem es NO-MEDIBLE desde el repo por construcción (vive en infra del VPS) | — |
| BL-O6 | PARCIAL | Texto propio con terceros nombrados: `packages/core/src/legal.ts:14,47,73,83,91` · web `apps/copiloto-web/src/auth/LegalScreen.tsx:1,37` · **mobile sí tiene pantalla legal**: `apps/mobile/src/modules/ajustes/PantallaLegal.tsx:3,34` + ruta `apps/mobile/app/legal.tsx:17` · aceptación registrada en web: `apps/copiloto-web/src/auth/SignupScreen.tsx:71` → `origin/main:apps/copiloto/web.py:1091` (`POST /me/legal/aceptar`) + `apps/copiloto/tenant_legal_store.py` · E2E `scripts/e2e_bl_o6_legal_aceptacion.py:1-25` | Aceptación **no** registrada en mobile (cero hits de `aceptarLegal`/`legal_aceptado` en `apps/mobile`); aviso de plantilla genérica sigue en pantalla a propósito (decisión del operador, no olvido) | **DESALINEADO**: el backlog dice «plantilla genérica» en web y «mobile no tiene pantalla legal» — ambas falsas desde #678/#679/#693/#732 |
| BL-O7 | FALTA | Cero SLA escrito (grep `SLA` en `docs/copiloto-emprendedor/` sólo da el backlog/acta/planes) · acta:24 lo difiere a Cierre B · tests que **prohíben** prometer horas: `apps/copiloto-web/src/modules/soporte/SoporteScreen.test.tsx:27-29` y `apps/mobile/src/modules/soporte/PantallaSoporte.test.tsx:294-300` | Responsable y horario sin escribir; ticket de prueba sin medir | **DESALINEADO**: el DoD pide que el texto de BL-W10 «use ese SLA»; la decisión vigente es la inversa (no prometer un número de horas) y está gateada por tests |
| BL-O8 | FALTA | Token 60fps: `39decb95` sigue alcanzable (`git cat-file -t` → commit) y `b10a965c` (#705) confirma que es la única credencial de la historia · rama `fix/quita-token-mcp-prototipo` existe y **no** está en `git branch --merged origin/main` · `Prototipo frontend/odobi-ui/.mcp.json.example:3-4` (ya sin token) · `coordinacion/PLAN.md:1040`: «Rotar `DATABASE_URL` de fusion … diferida a pre-prod» | Token sin rotar; rama sin mergear; ARCA sin credencial en `341lin@gmail.com`; `DATABASE_URL` sin rotar | DESALINEADO (el worktree `wt-fe2-tokens` ya no existe: `git worktree list` no lo lista) |
| BL-P1 | PARCIAL | Artefacto: `docs/copiloto-emprendedor/2026-09-21-acta-decisiones-beta-odobi.md` (fecha 2026-09-21), responde DEC-1 (`:11`) y DEC-2 (`:12`) y declara «Cierra BL-P1 y BL-P3» (`:3`) | El acta no menciona la «Parte 2» del contrato del 16/09 ni lista qué libera, ni dice si la reunión con Martín ocurrió (grep `Parte 2` en el acta → 0) | — |
| BL-P2 | HECHO | `Prototipo frontend/odobi-ui` versionada: 313 archivos en `git ls-files`, incluye `specs/mobile-coherencia.md` · entró en `54fac3ea` («traer odobi-ui al día y cerrar las tres decisiones del 18/09») · cero `.otf`/`.woff*` trackeados (los 10 salieron en `778b90af`, DEC-5) · re-medición: `Auditorias/2026-09-16-mapa-de-pantallas-vs-codigo-web-y-mobile.md:3` + republicación del 30/09 | Nada; la foto del 16/09 se midió contra `b67dc7c9` (anterior a `54fac3ea`), la re-medición vigente es la del 30/09 | — |
| BL-P3 | PARCIAL | Acta en `docs/copiloto-emprendedor/`: `2026-09-21-acta-decisiones-beta-odobi.md:28-40` (§2 registra DA-1..DA-11 con Estado, Alcance e ítem que destraba) y `:44-52` (§3, los 7 puntos de DEC-10 con su path en mobile) | La tabla §2 no trae columnas de **dueño** ni **fecha** ni **plataformas** por DA (sólo las tiene §1 para los DEC-*) | — |
| BL-P4 | HECHO | Contrato viejo con nota de reemplazo: `coordinacion/cerrado/2026-09-21/2026-09-16_contrato_planificacion-a-frontend_seis-trabajos-sin-bloqueo-y-lo-que-NO-se-toca-hasta-la-reunion.md:1` («REEMPLAZADO 2026-09-21 … (BL-P4)») · contrato nuevo: `coordinacion/cerrado/2026-09-22/2026-09-21_contrato_planificacion-a-frontend2_cola-del-plan-autonomo-beta-odobi.md` | Nada | — |
| BL-P5 | HECHO | `docs/copiloto-emprendedor/2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md` (2026-09-22, 6852 B) · citado por el criterio de cierre: `2026-09-21-plan-implementacion-beta-odobi-autonomo.md:508` («toda pantalla marcada **spec** en `BL-P5`») y `:372` | Nada | — |
| BL-P6 | PARCIAL | Segundo DoD hecho: anotado en el acta `2026-09-21-acta-decisiones-beta-odobi.md:58` (§4.1) · primer DoD **no**: el hilo sigue intacto en `Prototipo frontend/odobi-ui/prototipo/index.html:3258-3263` (voz → `REC(... CAE 75282963517824 ...)`, sin paso HITL) | Martín no ajustó ni retiró el hilo. Bonus: `index.html:3705` sigue con `CALMA_TOPE = 5` (acta §4.4 pide 3) | — |
| BL-P7 | HECHO | `find coordinacion/abierto -name '2026-09-0[78]_*'` → 0 (el listado de `abierto/` arranca en 2026-09-22) | Nada del DoD, pero el buzón volvió a crecer: 39 archivos en `abierto/` (22/09→05/10) **más 4 `.bak-*`** del mismo `urgente_ ORDEN-DEL-OPERADOR-PARADA-SEGURA` | **DESALINEADO**: la cláusula «`abierto/` sólo contiene trabajo vivo … todos del 22/09» ya no describe la realidad |
| BL-Q1 | HECHO | `scripts/ci/lint.sh:20` invoca `scripts/ci/testid_paridad.py --check` · las 4 propiedades (trinquete, id nuevo unilateral rojo, dinámicos como «no medidos», comparación por pantalla) documentadas e implementadas en `scripts/ci/testid_paridad.py:12-33` · control positivo versionado: `scripts/tests/test-testid-paridad.sh` · los 6 DoD en `[x]` en `docs/copiloto-emprendedor/2026-09-21-backlog-beta-odobi-con-dod.md:64-69` | Nada del DoD. El baseline hoy son **471** excepciones (`origin/main:scripts/ci/testid-paridad-excepciones.json`), no 484 | DESALINEADO en la cifra: 471 hoy (último movimiento #732, `729d6dc0`), el backlog dice 484 |
| BL-Q2 | PARCIAL | Re-corrido 37/37 el **21/09** (`coordinacion/cerrado/2026-09-21_avance_backend-a-planificacion_BL-Q2-smoke-37-37-beta-ready.md:1-3`) y otra vez el 22/09 (`cerrado/2026-09-22/2026-09-22_avance_backend-a-planificacion_BL-Q2-smoke-e2e-37-37-contra-prod.md`) · runner con salida completa a archivo ya existe: `scripts/run-smoke-prod.sh:1-19` · `deploy/copiloto/deploy.sh:479-480` sigue corriendo sólo `/healthz` | Sin corrida de hoy (no existe `_evidencia/*/BL-Q2/`); el segundo DoD es compromiso recurrente, no cerrable | **DESALINEADO**: el backlog fecha la última corrida el 13/08; fue el 21–22/09 |
| BL-Q3 | PARCIAL | Reemplazado por v2: `coordinacion/en-curso/2026-09-28_contrato_planificacion-a-todos_BL-Q3-v2-la-unidad-de-medicion-es-id-mas-camino.md:1-30` (unidad = par (id,camino); 16 ids multi-path) · lote A cerrado 14 filas + 2 device (`cerrado/2026-09-28/..._BL-Q3-v2-lote-A-14-filas-mas-2-pendiente-device.md:1,30-31`) · lote B 11/11 (`..._BL-Q3-v2-lote-B-11-de-11-completo.md:108`) | Toda la tanda de device sigue diferida por orden del operador (`cerrado/2026-09-28/..._reparto-de-las-30-filas...:55`); `fact-voz`/`pres-voz` por voz real sin ejercitar | **DESALINEADO**: la tabla FE1 35 / FE2 19 del 22/09 y el reparto de 54 ids quedaron superados por el v2 (30 filas, par id+camino) |
| BL-Q4 | HECHO | Mobile ya **no** usa el mapa manual: `temaContraste.test.ts` no existe en `origin/main`; lo reemplaza el walker sobre el árbol RNTL renderizado `apps/mobile/src/theme/paresPintadosContraste.test.tsx:1-21` · web `apps/copiloto-web/src/design-system/paresPintadosContraste.test.ts` · DEC-11 cerrado: `origin/main:apps/mobile/src/modules/chat/BotonVoz.tsx:318` + control positivo `paresPintadosContraste.test.tsx:904` + umbral por clase `:920` · cierres DEC11FILL en `coordinacion/cerrado/2026-09-30/` (PR #730 y #758) | Queda `DEUDA_CONOCIDA` baseline sub-AA ajena a DEC-11 (`paresPintadosContraste.test.tsx:811-815,836`: acento como texto 2,57–3,14:1) sin acta | **DESALINEADO**: el backlog dice «Mobile sigue con el mapa manual SUPERFICIES … sin acta» y cita `temaContraste.test.ts:344-348`, archivo que ya no existe; el par `textoTenue` 4,38 y el 1,26 de BotonVoz ya están tratados |
| BL-Q5 | PARCIAL | Re-publicaciones reales con SHA en cabecera: `docs/copiloto-emprendedor/Auditorias/2026-09-23-criterio3-bloque-A-matriz-re-medida-por-auditoria.md` y `origin/main:…/2026-09-30-criterio3-los-54-republicados-sobre-el-sha-medido.md:1-14` (`origin/main` d131b3d2 → 53/54; PR #742 ecaf7be2 → 54/54) | Compromiso recurrente por bloque: no cerrable de una vez; el doc del 30/09 no está en el worktree (sólo en `origin/main`) | — |
| BL-W1 | HECHO | `apps/copiloto-web/src/modules/chat/RecordingOverlay.tsx:54-66`; `MicButton.tsx:212-229` (`MediaRecorder.pause/resume`); test `RecordingOverlay.test.tsx:33` | sólo la captura PWA `?ver=bloqueado` | DESALINEADO (el backlog lo cita como no portado a web)
| BL-W2 | HECHO | `apps/copiloto-web/src/modules/connections/ServiceCard.tsx:126-128`; test `ServiceCard.test.tsx:35,40` | sólo la captura PWA con ≥3 servicios | DESALINEADO («no pinta `service.description`» ya no es cierto)
| BL-W3 | HECHO$","stderr":"
| BL-W4 | HECHO | web `chat/RodilloEjemplos.tsx:41-76` + test `:38,49`; mobile `apps/mobile/src/modules/chat/RodilloEjemplos.tsx:54-93` + test `:62,82` | sólo capturas PWA y device | DESALINEADO (la deuda de mobile —sin pausa, corre con movimiento reducido— ya está pagada)
| BL-W5 | HECHO | `apps/copiloto-web/src/design-system/EstadoVacio.tsx:44-82`; `packages/core/src/midia/calma.ts:14` (N=3 única); test `calma.test.ts:24,28`; `MidiaScreen.tsx:271-278` | sólo captura antes/después del umbral | DESALINEADO (DEC-10 fijó N=3; ya no «3 vs 5 pendiente»)
| BL-W6 | HECHO | web `inteligencia/InteligenciaScreen.tsx:138-142` + test `:30,48`; mobile `PantallaInteligencia.tsx:180`; `packages/core/src/refresco/textosRefresco.ts:10-24` | web muestra 2 de 4 estados (sin Tirá/Soltá) por decisión documentada y testeada; captura device | DESALINEADO («sin textos» en ambas ya no aplica)
| BL-W7 | HECHO | `midia/ChipsCategoria.tsx:45,53-64` montado en `MidiaScreen.tsx:233`; `packages/core/src/midia/filtroTablero.ts:19-30`; backend `apps/copiloto/tests/test_mi_dia_clasificacion.py` | sólo captura PWA | DESALINEADO (`mobile/.../categoriaTarjeta.ts` ya no existe: la categoría la trae el backend, el FE sólo filtra)
| BL-W8 | HECHO | `midia/PortadaNegocio.tsx:9-52` montada en `MidiaScreen.tsx:201`; test aislado `PortadaNegocio.test.tsx:17-44` | sólo captura PWA con `e2e-device` | DESALINEADO («`MidiaScreen.tsx:50-214` sin portada» ya no aplica)
| BL-W9 | HECHO | `ajustes/PantallaComoUsarLaApp.tsx:83-92` (`dejarPendiente` + `onAbrirChat`); tests `:32,97` y `shell/AppShell.test.tsx:116` | sólo captura PWA | DESALINEADO (ya no hay chat de ayuda propio; `AccountScreen:158-166` no es la puerta)
| BL-W10 | HECHO | `packages/core/src/ayuda/textosSoporte.ts:17-21`; web `soporte/SoporteScreen.tsx:56-63` (isotipo 38 + rótulo); mobile `PantallaSoporte.tsx:174` | el rótulo quedó «Soporte técnico», no «Soporte de Odobi» del acta §3 | DESALINEADO (los greps vacíos del backlog ya no aplican; sin número de horas por DEC/BL-O7)
| BL-W11 | HECHO | `MidiaScreen.tsx:196` (fecha), `:327-334` (caída vs nunca conectada); `packages/core/src/midia/caja.ts:70` (nombra Mercado Pago); mobile `PantallaMiDia.tsx:517`; tests `MidiaScreen.test.tsx:89,106,120` | sólo captura PWA y el banner `caida` en device | DESALINEADO (los tres defectos descritos están corregidos)
| BL-W12 | HECHO | `ajustes/PantallaAjustes.tsx:40-50` (9 tiles, mismo orden que mobile `:54-88`); `PantallaComoHablarle` borrada (sólo sobrevive en `.claude/worktrees/`); `core/api/capacidades.ts:68` + test `PantallaComoUsarLaApp.test.tsx:65` | sólo captura PWA lado a lado | DESALINEADO · [DISCO-ATRASADO] (`apps/copiloto/tool_catalog.py`, citado como evidencia, está **atrasado** en el disco compartido: `+7/−23` vs `main` — **no commitear desde ahí**)
| BL-X1 | HECHO | `shell/AppShell.tsx:31` (`DEFAULT_TAB='midia'`), `:220` (avatar→ajustes); `shell/TabBar.tsx:62-74` (sin `ajustes`); `shell/Rail.tsx:87-103`; tests `AppShell.test.tsx:61,85,95` | sólo capturas lado a lado con el prototipo | DESALINEADO (el backlog lo da «aplicado en mobile» únicamente)
| BL-X2 | HECHO | `escritorio/seisFunciones.test.ts:9-23`; `inteligencia/AcumuladoAnual.tsx:13,56-58` montado en `InteligenciaScreen.tsx:260`; `ContabilidadScreen` no existe en el árbol | sólo captura PWA | DESALINEADO («hecho en mobile» — web también)
| BL-X3 | HECHO | web `inteligencia/PreguntarInteligencia.tsx:13-21`; mobile `PreguntarInteligencia.tsx:24-25`; `ChatInteligencia` borrado en las dos apps | sólo la verificación en device (pregunta → hilo principal) | DESALINEADO («`inteligencia/ChatInteligencia.tsx` en ambas» ya no existe)
| BL-X4 | HECHO | web `ajustes/PantallaApariencia.tsx:11-21,66-78` (2 pieles con muestra real + «Como el teléfono»); `core/tema/preferenciaTema.ts:12-17,35-36`; mobile `ajustes/PantallaSkins.tsx:36-42`; gate `design-system/themesContrast.test.ts:316-349` | exención documentada del acento (4.38:1 en `claro`, `themesContrast.test.ts:112`); captura cambiando el tema del sistema | DESALINEADO (web ya retiró `nocturno` y tiene muestras; «Como el teléfono» está en las dos)
| BL-X5 | HECHO | `apps/copiloto-web/src/arcaNoAfipVisible.test.ts:31-39` (los hits de `AFIP` en web son todos comentarios/docstrings); backend `apps/copiloto/tests/test_arca_sin_afip_visible.py:50,72,81` | nada en código | [DISCO-ATRASADO] (✅ `afip_rules.py` y `afip_web.py` **coinciden con `main`** — marca vencida; `tool_catalog.py` sigue **atrasado** `+7/−23`, **no commitear desde ahí**; `tool_catalog.py:268` usa la equivalencia «ARCA (ex AFIP)»)
| BL-X6 | PARCIAL | `design-system/fonts.css:17-25` (Plus Jakarta Sans + Inter, sin `@font-face` roto); test cruzado `fontsResuelven.test.ts:20-46` contra `deploy/copiloto/fetch-fonts.sh`; `git ls-files` → 0 `.otf`/`.woff`; commit `778b90af` | los `.otf` siguen en la historia (reescritura = paso del operador, DEC-5 acta:15); capturas de las dos pieles | DESALINEADO (el `@font-face` a un `.woff2` inexistente y los 10 `.otf` del árbol ya no están)
| BL-X7 | HECHO | web `ajustes/negocio/PantallaTono.tsx:28-79` (ejemplo del backend, re-consultado al cambiar); `PantallaPerfilNegocio.tsx:358-367` (sólo fila-resumen); mobile `ajustes/negocio/PantallaTono.tsx`; test `apps/copiloto/tests/test_perfil_negocio_ejemplo.py:14-27` | nada medible en código | DESALINEADO («editor sin ejemplo en ambas» y «web es una guía de capacidades» ya no aplica)
| BL-X8 | HECHO | web `modules/onboarding/Onboarding.tsx:16,32,165-192` (hilo con `Bubble` + tarjeta HITL) montado en `App.tsx:76-77`; mobile `apps/mobile/app/_layout.tsx:98`; tests `Onboarding.test.tsx:134,143,160` (idempotente) | sólo `onb-cumplida` en device con cuenta nueva | DESALINEADO (ya no es «pantalla completa» en web ni «0 consumidores» en mobile)
| BL-X9 | OBSOLETO | acta `2026-09-21-acta-decisiones-beta-odobi.md:18` (DEC-8: plan y límites **no** entran en la beta → `BL-V2`); web `account/AccountScreen.tsx:107-116` (fila estática); mobile `app/ajustes-mi-plan.tsx:13-21` (andamiaje) | nada: fuera del alcance de la beta por DEC-8 | DESALINEADO (el ítem figura «esperando DEC-8», que ya está tomada y lo saca de la beta)
| BL-X10 | PARCIAL | `packages/core/src/textosEntrada.ts:16-21` con consumidores (`web/auth/EntradaSesion.tsx:35`, `mobile/auth/EntradaSesion.tsx:30`, `splash/Splash.tsx:178`, `auth/RevealEntrada.tsx:67`); `splash/tempos.ts:23` = 6840 ms; `App.test.tsx:156,167` (no repite splash); mobile `IdentidadEntrada.test.tsx:52` | falta el asset de audio «o-DO-bi» (lo aporta el operador; sin asset no hay botón, `Splash.tsx:179`) y el video en device | DESALINEADO (de los 5 faltantes listados, 4 están hechos; el splash largo en mobile es la animación de `IdentidadEntrada` sobre el reveal, con los tempos de web)
| BL-X11 | HECHO | web `soporte/SoporteScreen.tsx:56` (isotipo 38), `design-system/Marca.tsx:16` (trazo 1,3), `design-system/logos/*.svg` + `logos/LEEME.md` (licencia de marca anotada), `core/midia/calma.ts:14` (3 días), `auth/LoginScreen.tsx:62-75` (lockup); mobile `theme/glass/mapaIconos.ts:14` | sólo la revisión visual/captura | DESALINEADO (la corrección post-A1 «en web el avatar de Soporte y los cinco íconos son N/A, no hay Soporte en `apps/copiloto-web`» es falsa hoy: hay `modules/soporte/` y usa el isotipo; en mobile los íconos ya no son «provisorios»)

<!-- VEREDICTOS:FIN -->
