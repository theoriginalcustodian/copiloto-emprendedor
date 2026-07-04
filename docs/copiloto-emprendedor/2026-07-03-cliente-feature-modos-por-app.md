# Feature addendum — Modos por app (botones por servicio) · Cliente del Copiloto

> **Para:** Claude Design — **integrar sobre el cliente ya construido** (no es un rediseño; es una capa que se suma).
> **De:** equipo Copiloto (Unreal Copilot).
> **Fecha:** 2026-07-03.
> **Qué es:** una **barra de botones por servicio** (Gmail, Agenda, Cobrar, Clientes, Archivos, Instagram…) que, al tocarlos, ponen al agente en "modo" de ese servicio (ej. "modo Gmail copiloto"). Self-contained: este doc trae todo lo necesario para sumarlo.

---

## 1. Para qué (intención de UX)

Hoy el usuario tiene que **saber** qué pedirle al copiloto (las capacidades son invisibles). Los botones por servicio resuelven dos cosas a la vez:

1. **Discoverability:** el usuario **ve** qué puede hacer, sin adivinar.
2. **Precisión + foco:** al elegir un servicio, el agente se enfoca en ese dominio (menos errores de interpretación), sin cambiar de agente ni abrir sub-chats.

**Principio rector — FOCO BLANDO, NO JAULA:** el modo es un **realce**, no una restricción. Si el usuario está en "modo Gmail" y pide "cobrale $5.000 a Juan", el agente **igual lo atiende** (y puede auto-cambiar de modo). Nunca bloquear ni mostrar error por "pedir algo fuera del modo".

---

## 2. Dónde vive en la UI (sobre lo ya construido)

Se suma **alrededor del chat existente**, sin reemplazar nada:

- **Barra de modos:** fila horizontal de botones, **inmediatamente arriba del composer** (input de mensaje). Scrollable horizontal en mobile.
- **Chip de modo activo:** cuando hay un modo activo, un chip visible pegado al composer o en el header del chat ("Modo Gmail ✕").
- **Adaptaciones del chat existente cuando hay modo activo:** el **placeholder** del input y los **chips de sugerencia** (los del estado vacío / quick-prompts) cambian al dominio del modo.

```
┌───────────────────────────────────────────────┐
│  (mensajes del chat, sin cambios)              │
│                                                │
├───────────────────────────────────────────────┤
│  Modo: Gmail ✕                                 │  ← chip de modo activo (solo si hay modo)
│ [📧 Mail][📅 Agenda][💰 Cobrar][👥 Clientes][+]│  ← barra de modos (scrollable)
│ [ Modo Gmail: mandá un mail a…            ▸ ]  │  ← composer con placeholder adaptado
└───────────────────────────────────────────────┘
```

Estado por defecto = **sin modo** (barra visible, ningún botón activo, chip ausente, placeholder general).

---

## 3. Comportamiento

1. **Tocar un botón** → activa su modo (estado local en el cliente). El botón queda en estado "activo"; aparece el chip; placeholder y sugerencias se adaptan. **No requiere round-trip** para activarse.
2. **Tocar otro botón** → cambia de modo (uno activo por vez).
3. **Tocar la ✕ del chip** (o el mismo botón activo) → vuelve a **modo general**.
4. **Mientras hay un modo activo**, cada mensaje que el usuario manda lleva el modo (ver §5). El agente prioriza ese servicio pero atiende cualquier cosa (foco blando).
5. **Auto-cambio (opcional, backend-driven):** si el agente detecta que el usuario pasó a otro dominio, puede indicar el cambio de modo; el cliente debe tolerar que el chip refleje el modo que devuelva el backend (si en el futuro lo emite). Para v1 alcanza con el cambio manual.

---

## 4. Data-driven (requisito duro — nada hardcodeado)

Los botones **NO son una lista fija**. Se derivan del catálogo de servicios **conectados** del usuario:

- Fuente: los servicios con `connected: true` (de `/me` + metadata del catálogo `GET /catalog`).
- Cada botón usa: `key` (= valor de `mode`), un **ícono** y un **label corto de acción** (de la metadata).
- Un servicio nuevo conectado → **aparece un botón solo**, sin tocar el frontend.
- Botón **"+"** al final de la barra → lleva a la pantalla de **Conexiones** (conectar más servicios).
- Si el usuario no tiene servicios conectados, la barra muestra solo el "+" con copy "Conectá una app para empezar".

> Metadata sugerida por servicio (la provee el catálogo): `{ key, mode_label (corto, ej. "Mail"), icon, category }`. Ejemplos de labels: Gmail→"Mail", Google Calendar→"Agenda", Mercado Pago→"Cobrar", HubSpot→"Clientes", Drive/Docs/Sheets→"Archivos", Instagram→"Instagram".

---

## 5. Contrato de datos (mínimo — sin endpoint nuevo)

El modo es **estado local del frontend** que viaja en cada mensaje. Se agrega **un campo opcional** al request de chat ya existente:

```
POST /chat
{ session_id, text, kind: "text"|"callback", mode?: "<service_key>" | null }
```

- `mode` = el `key` del servicio activo (ej. `"gmail"`), o `null`/ausente en modo general.
- El frontend mantiene el modo en estado local y lo incluye en cada `POST /chat` mientras esté activo.
- El backend usa `mode` para enfocar al agente (ver §7). **No hay endpoint nuevo ni máquina de estados en el cliente** — tocar un botón solo cambia el estado local.

El resto de la API (respuestas por `/reply`, choices/HITL, etc.) **no cambia**.

---

## 6. Componentes a agregar (encajar con el design system existente)

Usar los tokens/estilos ya definidos en el cliente; no introducir colores/tipografías nuevas.

- **Barra de modos** — contenedor horizontal scrollable, pegado arriba del composer. Sin ítem seleccionado por defecto.
- **Botón de modo** — ícono + label corto. Estados: inactivo · **activo** (destacado con token de acento) · hover/focus · deshabilitado (si el servicio se cae). Táctil (target ≥44px en mobile).
- **Chip de modo activo** — texto ("Modo Gmail") + ✕ para salir. Aparece solo con modo activo.
- **Botón "+"** — al final de la barra, lleva a Conexiones.

Reutilizar (no duplicar) los **chips de sugerencia** y el **placeholder** del composer ya existentes; solo alimentarlos con contenido dependiente del modo.

---

## 7. Qué hace el backend (contexto — NO lo construye Design)

Para que Design sepa que el botón "solo setea `mode`" y la inteligencia vive atrás:

- El agente hoy recibe un system prompt con **todos** los servicios juntos. El `mode` hará que el backend **enfoque el prompt** en el servicio elegido (foco blando: prioriza ese servicio pero mantiene el resto disponible).
- Es un cambio **de backend** del equipo Copiloto (ensamblado dinámico del prompt + estado de modo en el workflow durable), precedido por un spike de validación. **No bloquea el diseño ni el frontend:** si el backend todavía ignora `mode`, la barra sigue funcionando como discoverability (los botones igualan a "escribir sobre ese servicio").

---

## 8. Copy (es-AR)

- Labels de botón (cortos): "Mail" · "Agenda" · "Cobrar" · "Clientes" · "Archivos" · "Instagram".
- Chip activo: "Modo Gmail" · botón salir: "✕".
- Placeholder por modo (ejemplos): "Modo Gmail: mandá un mail a…" · "Modo Agenda: agendá o consultá un turno…" · "Modo Cobrar: decime monto y a quién…".
- "+" : "Conectar más" (o "Conectá una app para empezar" si no hay ninguna).
- Sugerencias por modo (chips): p.ej. en Mail → "Mandale un mail a…" · "Buscá los mails de…".

---

## 9. Accesibilidad

- Botones navegables por teclado; estado **activo** comunicado con `aria-pressed`/`aria-current`, no solo por color.
- El chip de modo activo y su ✕ accesibles por teclado.
- La barra scrollable no atrapa el foco; el orden de tabulación es lógico (barra → composer).

---

## 10. Checklist de integración (sobre la app ya construida)

- [ ] Barra de modos arriba del composer (data-driven de servicios conectados).
- [ ] Botón de modo con estados (inactivo/activo/hover/focus/disabled) + botón "+".
- [ ] Chip de modo activo con salida (✕).
- [ ] Estado local `mode` + inclusión en cada `POST /chat`.
- [ ] Placeholder y chips de sugerencia adaptados al modo activo.
- [ ] Comportamiento de foco blando: nunca bloquear un pedido "fuera del modo".
- [ ] Vacío: barra con solo "+" cuando no hay servicios conectados.
- [ ] Todo con tokens del design system existente (dark + light), sin literales de color.
