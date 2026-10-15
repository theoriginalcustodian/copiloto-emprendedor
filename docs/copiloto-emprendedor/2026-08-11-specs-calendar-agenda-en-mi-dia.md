# Specs — Mi Día completo en web + Google Calendar como Agenda (solo lectura)

> 🚩 **VIGENCIA PARCIAL — leé esto antes de citar cualquier § de este doc** (nota agregada el
> 2026-10-15, al versionarlo). `ADR-004`
> (`adr/2026-09-21_ADR-004_agenda-de-varios-dias-y-escritura-de-eventos.md`) **reemplazó** la §1 en
> la parte de «Agenda = sólo hoy, sólo lectura», la §3.2 («rango = hoy») y la §5 («crear/editar
> evento fuera de alcance»). Lo que **sigue vigente**, y es lo que main cita 8+ veces, es la
> **decisión de arquitectura**: la Agenda es un espacio **aparte** del Kanban, sección propia,
> nunca una solapa — ver `apps/copiloto/mi_dia_web.py:12-13`,
> `apps/mobile/src/modules/midia/PantallaMiDia.tsx:451` y la cláusula «No reemplaza» del ADR-004.
>
> 🔴 **Por qué se versiona hoy y no el 2026-08-11:** este documento vivió **dos meses como
> archivo untracked** en un solo checkout mientras `main` lo citaba como autoridad desde
> `mi_dia_web.py:12,52,53,69,178,179`, `tests/test_adversarial_multitenant.py:300,342`, el ADR-004 y
> `PantallaMiDia.tsx:451`. Medido el 2026-10-15 contra el pin de `origin/main`:
> `grep -rl "Kanban y Agenda son dos cosas distintas"` → **vacío** (control positivo: la frase sí
> estaba en el checkout compartido). Una enmienda que cita un doc que no está en el repo es una
> exención sin autoridad, y lo único que la separaba de una inventada era que alguien tuviera ese
> checkout abierto.

**Fecha:** 2026-08-11 · **Autor:** planificación (con el operador, en vivo) · **Estado:** ✅ specs
cerradas, **contratos SIN bajar** — este documento es la preservación de contexto para el próximo
sprint autónomo, no un contrato de coordinación.

**Alcance ampliado 2026-08-11 (mismo día, decisión del operador):** además de la Agenda de Calendar,
este sprint porta **Mi Día completo (Kanban + Agenda) a `copiloto-web`** — hoy sólo existe en mobile.
No es una idea nueva aislada: es la continuación directa del plan **M-WEB — Paridad funcional de
`copiloto-web`** (`docs/copiloto-emprendedor/2026-08-03-plan-produccion-post-beta-cobro-y-p2.md` §6),
del cual `gastos` fue el primer módulo portado (M-WEB spike 1, PR#237, 2026-08-04). El operador
prioriza Mi Día como 2º módulo ahora, en paralelo con la construcción de la Agenda — construir la
Agenda sólo en mobile y dejar el Kanban cojo en web no tendría sentido.

**Disparador:** ninguno — arrancable en cuanto se baje el contrato, no depende de ODOBI8 ni de
ningún otro hito en curso.

---

## 0. Contexto — de dónde sale esto

Última pieza pendiente de la cola de PLANIFICACIÓN (`coordinacion/PLAN.md` sin hitos arrancables al
2026-08-11). El operador pidió evaluar integrar Google Calendar a Mi Día. La conversación pasó por
tres correcciones sucesivas del operador que fijan el diseño final:

1. Primer intento (backend/planificación): panel de solo lectura "fuera del Kanban" — dirección
   correcta pero sin la forma concreta, y **bajado a contrato sin autorización** (error de proceso,
   corregido en el momento: "un resumen es un resumen... no luz verde").
2. El operador aclaró la intención real: las citas de Calendar deben verse **fácilmente reconocibles**
   y **ordenadas por hora, de más temprano a más tarde**.
3. El operador corrigió una lectura errónea de "agrupar citas en una sola card": no es agrupación
   visual dentro de una tarjeta — es que **Kanban y Agenda son dos cosas distintas**, con espacio
   propio en la pantalla, no una tarjeta más entre las del detector proactivo.

Este documento fija esa versión final. Sigue vigente la decisión de arquitectura ya registrada en
memoria (`copiloto-emprendedor-roadmap.md`, 2026-06-30):

> "Bidireccional con Calendar = SOLO LECTURA para mostrar/BI. NO importar eventos como turnos (evita
> reconciliación de 2 fuentes)."

Este diseño la cumple exactamente: la Agenda es un espejo de Calendar, sin ciclo de vida propio, sin
estado que reconciliar.

## 1. Decisión de arquitectura

**Dos espacios independientes en la pantalla de Mi Día, no uno solo:**

| | **Kanban** (ya existe) | **Agenda** (nuevo) |
|---|---|---|
| Contenido | Tarjetas de las 6 reglas del detector proactivo | Eventos de Google Calendar de hoy |
| Ciclo de vida | Se mueve entre solapas, se cierra por HECHO de negocio, se silencia, caduca a 21 días | Ninguno — espejo de Calendar, sin estado propio |
| Orden | Prioridad por plata en juego | Cronológico ascendente (hora de inicio) |
| Interacción | Swipe (avanzar/borrar), tap para expandir | Solo lectura — sin swipe, sin mover, sin borrar |
| Layout | 3 solapas (Para hoy / Haciendo / Hechas) | Sección propia, visualmente diferenciada del Kanban |

**Por qué no es una tarjeta más:** un evento de calendario no tiene "acción que lo resuelva" ni
sentido de "silenciar 14 días" — forzarlo al molde del detector generaría semántica sin sentido
(¿qué significa "mover a Haciendo" una cita?). Es información para mostrar, no un candidato del
detector. Meterlo en el Kanban también reabriría la reconciliación de 2 fuentes que la decisión de
arquitectura de origen quería evitar.

**Por qué no se agrupan varias citas en una sola card:** el patrón de oro ya documentado en el
análisis UX del repo es "una acción = una tarjeta" (`docs/copiloto-emprendedor/2026-07-03-cliente-ux-analisis.md`).
El volumen esperado (emprendedor sin administrativo, 1-3 turnos/día) no justifica un componente de
agrupación (`SectionList`/acordeón) — documed-front (`GlassHistorias.tsx`) consideró ese patrón y lo
descartó por ser "rediseño de la pantalla, no un ajuste". Cada evento es su propia fila dentro de la
sección Agenda, mismo costo de construcción que una lista simple.

## 2. Inventario verificado contra código (no asumido)

**Backend:**
- [`apps/copiloto/calendar_policy.py`](../../apps/copiloto/calendar_policy.py) — `GOOGLECALENDAR_FIND_EVENT`
  ya está en la policy deny-by-default (`CALENDAR_POLICY["googlecalendar"].read`), versión pineada
  (`CALENDAR_VERSION = "20260623_00"`). **Sin ningún código que lo invoque** — es exactamente la
  pieza que falta.
- [`apps/copiloto/tool_catalog.py:105-108`](../../apps/copiloto/tool_catalog.py) — `consultar_actividad`
  es el patrón exacto a clonar: tool 1ra clase, read puro, **sin gate HITL**, no entra en
  `_FIRST_CLASS_WRITES` (línea 301) ni en `WRITE_TOOLS` (línea 441). Su ejecución vive en
  `_run_consultar_actividad` (línea 589) y se despacha por `kind == "activity"` (línea 1426-1427).
- [`apps/copiloto/mi_dia_web.py`](../../apps/copiloto/mi_dia_web.py) — router de Mi Día, patrón de
  deps inyectadas (`tarjeta_store_factory`, `avanzar_tablero_fn` opcionales, testeable sin DB),
  `cliente_id` siempre por `Depends(require_tenant)`. Endpoints existentes: `GET /mi-dia/tablero`,
  `POST/PATCH/DELETE /mi-dia/tarjetas`. El endpoint de agenda sigue el mismo patrón de inyección.
- [`apps/copiloto/mi_dia_detector.py`](../../apps/copiloto/mi_dia_detector.py) — 6 reglas del Kanban.
  **No se toca** — Calendar no es una regla del detector, es una fuente de datos aparte.
- `calendar_book` (creación de eventos, ya existe, con gate HITL) — no se toca, sigue como está.

**Frontend mobile:**
- [`apps/mobile/src/modules/midia/PantallaMiDia.tsx`](../../apps/mobile/src/modules/midia/PantallaMiDia.tsx) —
  Kanban de 3 solapas, `ScrollView` + filas con `Swipeable`. La sección Agenda se agrega en esta
  pantalla, fuera de `<Solapas>`, sin tocar su lógica.
- [`apps/mobile/src/modules/apps/PantallaApps.tsx`](../../apps/mobile/src/modules/apps/PantallaApps.tsx) —
  patrón ya existente de "conectar servicio" / estado de conexión Composio. La degradación sin
  Calendar conectado reusa este patrón, no inventa uno nuevo.

**Frontend web — inventario del shell y precedente directo:**
- **Mi Día (Kanban) no existe todavía en `apps/copiloto-web`** — verificado (cero coincidencias de
  `mi-dia`/`mi_dia`/`tablero` en `apps/copiloto-web/src`). Confirmado también por
  `docs/copiloto-emprendedor/2026-08-03-plan-produccion-post-beta-cobro-y-p2.md:80-82`: mobile tiene
  17 módulos, web sólo 4 (`account`, `apps`, `chat`, `connections`), `midia` listado explícitamente
  entre los ausentes.
- **Dos shells web, un solo registro de tabs.** [`apps/copiloto-web/src/shell/TabBar.tsx:21-27`](../../apps/copiloto-web/src/shell/TabBar.tsx) —
  el array `TABS` alimenta AMBOS shells: `AppShell.tsx` (mobile-web, `TabBar` inferior) y
  `DesktopShell.tsx` (escritorio, `Rail.tsx` lateral, ver línea 47-48: "Data-driven del MISMO
  registro `TABS` que `TabBar.tsx` — sumar/quitar un tab es editar un solo array, ambos shells lo
  reflejan sin tocar este componente"). Agregar `{key: 'midia', label: 'Mi día'}` a ese array + un
  ícono en [`navIcons.tsx:82-88`](../../apps/copiloto-web/src/shell/navIcons.tsx) (`NAV_ICONS`) hace
  aparecer el tab en ambos shells sin tocarlos.
- **Precedente directo, ya validado, de hace una semana:** `gastos` fue el primer módulo de negocio
  portado (M-WEB spike 1, `coordinacion/cerrado/2026-08-04/2026-08-04_contrato_planificacion-a-frontend_MWEB-spike-gastos-portado-a-web.md`,
  resultado en `..._cierre_frontend-a-planificacion_MWEB-spike-gastos-resultado.md`, PR#237
  mergeado). Hallazgos medidos, no proyectados:
  - **La capa de datos porta 1:1, cero cambios** — `@copiloto/core` (tipos, validación, formateo) es
    el mismo paquete que ya usa mobile.
  - **El costo de plataforma (adapter HTTP/tokens) ya está pagado, de una sola vez** —
    `apps/copiloto-web/src/adapters/{http,almacenTokens,plataforma}.ts` (ADR-010) conecta
    `@copiloto/core` con `copiloto-web`, compartiendo el mismo `localStorage` que mobile. Portar
    Gastos lo pagó; portar Mi Día NO lo vuelve a pagar — el costo marginal es mayormente UI.
  - **Gestos táctiles no portan 1:1** — `RefreshControl` (pull-to-refresh) no existe en web, se
    reemplaza por un botón "Actualizar" explícito (mismo criterio aplica al `Swipeable` de
    avanzar/borrar tarjetas de Mi Día, ver spec frontend web abajo).
  - **Bug real ya encontrado y corregido en la versión web:** el guard `useRef(true)` +
    `useEffect(() => () => {vivo.current=false}, [])` se rompe bajo React StrictMode (dev) — deja la
    pantalla en "cargando" eterno. `PantallaMiDia.tsx` (mobile, línea 124/141-149) usa el MISMO
    patrón (`vivo.current`) — portar a web con el guard YA corregido (`vivo.current = true` dentro
    del setup del efecto, no sólo en la inicialización del `useRef`), no clonar el bug.

## 3. Spec — Backend

1. **Spike primero (gate spike-first, obligatorio antes de fijar el shape).** Nadie ejerció
   `GOOGLECALENDAR_FIND_EVENT` contra Composio real como lectura de agenda (el único uso conocido es
   en `tests/test_e2e.py`, como cleanup de eventos de prueba). Validar contra el tenant canónico
   (`e2e-device@copiloto.test`):
   - ¿Está `googlecalendar` conectado para ese tenant? Si no, conectarlo primero (mismo flujo de
     onboarding Composio que ya existe para otros servicios).
   - Forma real de la respuesta: campos, cómo se filtra por rango de fecha ("hoy"), timezone (mismo
     cuidado que ya costó una corrección real en el walking skeleton original de Calendar: hora
     local vs UTC).
   - ¿Trae recurrencias ya expandidas o hay que expandirlas del lado del servidor?
   - Resultado en `spikes/calendar-find-event/RESULT.md` — el shape del endpoint sale de ahí, no de
     la asunción.
2. **Tool de lectura 1ra clase** — mismo patrón que `consultar_actividad` (§2, arriba): sin gate
   HITL, no entra en `WRITE_TOOLS`. Devuelve los eventos de hoy, **ya ordenados por hora de inicio
   ascendente** (el orden lo resuelve el backend, no la UI).
3. **Endpoint** en `apps/copiloto/mi_dia_web.py` (o módulo nuevo si el spike revela que no encaja ahí
   limpio) — mismo patrón de deps inyectadas que el resto del archivo.
4. **Degradación con gracia si `googlecalendar` no está conectado**: `connected == false` no puede
   romper la pantalla de Mi Día — responde una forma vacía/explícita, nunca 500. Mismo criterio que
   `mi_dia_web.py` ya usa cuando `tarjeta_store_factory` es `None` (línea 61-62: `_solapas({})`).
5. **`mi_dia_detector.py` sin cambios** — confirmar con los tests existentes que las 6 reglas siguen
   pasando igual.

## 4. Spec — Frontend (mobile únicamente, ver hallazgo §2)

1. Nueva sección **"Agenda"** en `PantallaMiDia.tsx`, visualmente separada del bloque de `<Solapas>`
   + lista del Kanban — no una 4ª solapa, no una tarjeta dentro de las 3 existentes.
2. Eventos ordenados de más temprano a más tarde (el backend ya los entrega ordenados; el frontend no
   reordena).
3. Fácilmente reconocible como distinta del Kanban — detalle visual concreto (color de acento,
   ícono, o ambos) a resolver por frontend al implementar, consultando documed-front si existe un
   patrón aplicable de "sección secundaria" antes de inventar uno nuevo (regla del proyecto, CLAUDE.md
   §3.ter).
4. Solo lectura: sin `Swipeable`, sin avanzar/borrar, sin estado local mutable — se recarga cuando se
   recarga el resto de Mi Día (mismo `useFocusEffect` que ya dispara `cargar()`).
5. Si no está conectado: mismo patrón visual de invitación-a-conectar que `PantallaApps.tsx` ya usa
   para el resto de servicios Composio — no inventar uno nuevo.
6. No toca `calendar_book`, `BotonVoz`, ni ningún flujo de voz — quedan exactamente como están.

## 4.bis Spec — Frontend web (Kanban + Agenda, módulo nuevo)

1. **Nuevo módulo** `apps/copiloto-web/src/modules/midia/` (mismo nivel que `modules/gastos/`) —
   puerto de `PantallaMiDia.tsx`, mismo store `@copiloto/core` (`leerTablero`,
   `cambiarEstadoTarjetaMiDia`, `borrarTarjetaMiDia`, `formatearImporte`, tipos `IdSolapa`/
   `TarjetaMiDia`/`TableroMiDia`) sin cambios — ya está resuelto para web (adapter §2).
2. **Tab nuevo** `{key: 'midia', label: 'Mi día'}` en `TabBar.tsx:21-27` (`TABS`) + ícono nuevo en
   `navIcons.tsx` (mismo lenguaje de trazo SVG que el resto del set, 24×24, `stroke="currentColor"`)
   — con eso el tab aparece solo en `AppShell.tsx` (mobile-web) y `DesktopShell.tsx` (Rail,
   escritorio), sin tocar esos dos archivos más que montar la pantalla nueva en su switch de
   `activeTab` (mismo patrón que `gastos` en ambos: `AppShell.tsx:100`, `DesktopShell.tsx:61`).
3. **Kanban:** 3 solapas (Para hoy/Haciendo/Hechas) igual que mobile. **El swipe de
   avanzar/borrar NO porta** (no hay gesto táctil en desktop/mouse) — reemplazar por botones
   explícitos inline en la card (mismo criterio que "Actualizar" reemplazó a `RefreshControl` en
   Gastos-web). Tap-para-expandir sí porta (es un click, no un gesto).
4. **Agenda:** mismo componente de sección separada del Kanban que la spec mobile (§4), mismo
   endpoint backend (§3 — un solo backend para ambas plataformas, no hay endpoint "web" aparte).
5. **Evitar el bug de StrictMode ya conocido** (§2) al portar el guard `vivo`/`cargar()`.
6. **No requiere spike propio.** A diferencia de la lectura de Calendar contra Composio (§3, gate
   spike-first real: API externa nunca ejercida), portar Mi Día a web es UI dentro del mismo stack
   ya validado por el precedente de Gastos — mismo patrón, mismo adapter, sin supuesto externo no
   probado. El spike-first de este sprint es el de Calendar, no el del port web.

## 5. Explícitamente fuera de alcance v1

- Crear o editar eventos desde Mi Día (ya existe por voz vía `calendar_book`; no se duplica acá).
- Cualquier ciclo de vida tipo tarjeta para eventos (auto-cierre, silenciado, caducidad a 21 días) —
  la Agenda no tiene estado, es un espejo.
- Reconciliación evento↔turno o cualquier noción de "turno" — decisión de arquitectura ya cerrada
  (roadmap 2026-06-30), no se reabre.
- Deuda de idempotencia de `calendar_book` (auditoría 2026-07-23: sin `idem_key`) — no aplica a
  lectura, queda igual que está.
- Los otros 11 módulos de negocio pendientes del plan M-WEB (`clientes`, `ingresos`,
  `presupuestos`, `facturacion`, `actividad`, `contabilidad`, `inteligencia`, etc.) — Mi Día se
  prioriza ahora por la sinergia con Calendar, no reabre la priorización general del resto.

## 5.bis Antes de tocar código: `/ejecutar-con-eficiencia` + skills de dominio

*(Sección obligatoria por contrato desde 2026-08-11, COORDINACION.md §4.quater reforzado — un
`contrato_` sin ella no se despacha, gate automatizado en `scripts/lint-contratos-eficiencia.sh`.
Se preserva acá para que los contratos que salgan de este documento ya la lleven.)*

- **Invocar `/ejecutar-con-eficiencia` antes de la primera edición**, no después de atascarse.
- **Skills de dominio:**
  - `swmansion-react-native-best-practices` — todo código nuevo en `apps/mobile/` (Agenda + Kanban
    portado).
  - Sin skill dedicada para `apps/copiloto-web` en el catálogo del proyecto — seguir el patrón ya
    portado en `GastosScreen.tsx` (M-WEB spike 1, PR#237) en vez de inventar uno nuevo.
  - `temporal-developer`/`temporal-ai-patterns` **no aplica** al endpoint de lectura (síncrono,
    sin workflow/activity nueva).
- **Candidatos directos a script-first/background** (Pilar 1/2): el spike de Composio (§3.1) —
  varias llamadas de exploración a la misma API externa, mejor con un script que junte forma de
  respuesta + timezone + recurrencias de una pasada que con tool calls sueltas. El barrido de cómo
  se porta cada pieza de `PantallaMiDia.tsx` a web (§4.bis) es candidato a sub-agente headless
  (`haiku`, read-only, comparar mobile vs. el precedente de Gastos).

## 6. Riesgos / preguntas que el spike debe cerrar

- Timezone del tenant vs. timezone que devuelve Composio — ya mordió una vez en el walking skeleton
  original de `calendar_book`.
- Comportamiento con recurrencias (evento semanal, ej. "reunión todos los lunes") — ¿Composio las
  expande a instancias concretas de "hoy" o hay que resolverlo del lado del servidor?
- Límite razonable de eventos por día a mostrar (edge case, no bloqueante v1) — si aparece un tenant
  con una agenda cargada, decidir si trunca o no; no diseñar para ese caso sin dato real primero.

## 7. DoD (binario, evidencia real — no autoevaluación)

- [ ] Spike con evidencia real (Composio, tenant canónico) antes de fijar el contrato de datos.
- [ ] Endpoint read-only, sin gate HITL, con test de forma + **test adversarial de tenant** (que el
      tenant A no vea eventos del tenant B — mismo patrón que el resto del catálogo, regla dura de
      seguridad del proyecto).
- [ ] Degradación sin conexión probada (no 500, no pantalla rota).
- [ ] Sección Agenda visible **en device** (mobile), con evidencia — no autoevaluación.
- [ ] Orden cronológico ascendente verificado con ≥2 eventos reales en el tenant de prueba.
- [ ] `mi_dia_detector.py` sin cambios — los tests de las 6 reglas existentes siguen pasando igual.
- [ ] **Mi Día completo (Kanban + Agenda) en `copiloto-web`**, evidencia real en navegador (Playwright
      o manual) en AMBOS shells — mobile-web (`TabBar`) y escritorio (`Rail`), no sólo uno.
- [ ] Tab "Mi día" visible y funcional en `Rail` (escritorio) Y `TabBar` (mobile-web) desde el mismo
      cambio en `TABS` — confirmar que no hizo falta tocar `AppShell.tsx`/`DesktopShell.tsx` más que
      el montaje de la pantalla nueva (si hizo falta más, documentar por qué el patrón data-driven no
      alcanzó).
- [ ] Avanzar/borrar tarjeta funciona con controles explícitos (sin swipe) en web.
- [ ] `tsc --noEmit` + `vitest run` verdes en `copiloto-web` (mismo gate que usó PR#237).
- [ ] Guard de StrictMode correcto (no clonar el bug ya encontrado y corregido en Gastos-web).

---

**Siguiente paso:** cuando el operador autorice, este documento se parte en contrato(s) de
`coordinacion/abierto/` para BACKEND y FRONTEND (mobile) — **no bajado todavía**, pendiente de luz
verde explícita.

— planificación
