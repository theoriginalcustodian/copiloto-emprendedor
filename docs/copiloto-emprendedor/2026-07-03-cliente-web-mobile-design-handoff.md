# Handoff de diseño — Cliente web + mobile del Copiloto del Emprendedor (v2, con pase UX)

> **Para:** Claude Design (diseño gráfico + frontend).
> **De:** equipo Copiloto (Unreal Copilot).
> **Fecha:** 2026-07-03. **Versión 2** — incorpora el análisis UX profesional (`2026-07-03-cliente-ux-analisis.md`) y 4 decisiones de producto del operador.
> **Objetivo:** que Claude Design diseñe y construya **todo** el cliente (visual + frontend) sin ambigüedad.
> **Qué NO hace Claude Design:** la conexión al backend real (la hace el equipo Copiloto). Se construye la UI contra los **contratos de datos** de la §7 con mocks; el swap a la API real es posterior.
> **Idea rectora del pase UX:** el riesgo se concentra en **la tarjeta de confirmación (HITL)** y el diferencial (durabilidad) hoy es **invisible**. El diseño debe (a) graduar la confirmación por costo-de-error y (b) hacer perceptible el "no se pierde nada". Detalle y racional: ver `2026-07-03-cliente-ux-analisis.md`.

---

## 1. Contexto de producto

**Copiloto del Emprendedor**: asistente de IA **conversacional y durable** para emprendedores de servicios (Argentina). Le hablás en lenguaje natural y ejecuta tareas reales del negocio (cobrar, agendar, mail, archivos, CRM, redes), **siempre con confirmación antes de escribir/modificar algo** (HITL).

- **Diferencial (moat):** el agente es **durable** — sobrevive reinicios/cortes; la conversación y las acciones pendientes **no se pierden**. Esto tiene que **verse** en la UI (hoy no se ve).
- **Audiencia:** emprendedor/a de servicios argentino (consultorías, oficios, comercios chicos). No técnico. **Mobile-first, WhatsApp-céntrico.** Poca paciencia, ansiedad con la plata, escasez de tiempo. **Multi-cliente por jornada** (atiende a varios clientes el mismo día → riesgo de confundir a quién le cobra/agenda).
- **Idioma:** español rioplatense (es-AR, voseo).

---

## 2. Alcance v1

**v1 = fundación modular + todo lo LIVE**, con arquitectura para sumar módulos sin refactor.

**Entra (diseñar y construir):**
- Login + **recuperación de contraseña** (reset nativo Supabase).
- Chat conversacional completo con **tarjeta de confirmación (HITL) canónica y graduada por riesgo**.
- **Barra de modos por app** (quick-actions data-driven que enfocan al agente en un servicio — foco blando).
- **Instagram publish** (con HITL + preview — decisión operador).
- Módulo **Conexiones** (grilla data-driven).
- Módulo **Cuenta**.
- Tiles **"Próximamente"** (Caja/BI, Agenda).
- PWA instalable.

**Fuera de v1 (decisiones tomadas):**
- **Cierre del loop de cobro en el chat** → NO (MercadoPago ya notifica al vendedor de forma nativa cuando entra un pago; duplicarlo sería redundante). La burbuja de link **no** trackea "pagado".
- **Protecciones backend del cobro** (debounce server-side anti-duplicado + fail-fast real de token caído) → NO en v1 (**deuda diferida visible**, §12). El frontend mitiga parcialmente.
- Dashboard BI/caja · Agenda CRUD (ver/mover/cancelar) · Realtime (WebSocket) · Signup público · Canales extra (WhatsApp/voz) · Vista "Actividad reciente" respaldada por BI · Tiles con dato real (requieren endpoint).

---

## 3. Decisiones cerradas (no re-abrir)

| Decisión | Valor |
|---|---|
| **Plataforma** | PWA responsive React (Vite + design system con tokens + `vite-plugin-pwa`, sin SSR; auth `supabase-js`). |
| **Forma UX** | Híbrido: **chat protagonista** + rail de módulos. Desktop = split (rail ⟺ chat); mobile = chat full + **tab bar**. |
| **Modularidad** | Conexiones data-driven; agregar servicio en backend = aparece solo, **cero cambio de frontend**. |
| **Confirmación (HITL)** | **Componente canónico único, parametrizado, graduado por riesgo** (§5.3/§6). Datos estructurados, nunca prosa. Una acción = una tarjeta. |
| **Composer** | **No se bloquea** al enviar. Ack óptico tipo WhatsApp (✓✓) + **debounce client-side** del mismo pedido. (Resuelve la contradicción interna de v1.) |
| **Reset de contraseña** | **Nativo Supabase** (magic link / reset por email). Reset ≠ signup. |
| **Instagram publish** | **Expuesto, con HITL + preview WYSIWYG**; borrado = manual desde Instagram (se comunica en el copy). |
| **Modos por app** | Botones data-driven (por servicio conectado) que activan un **modo de foco blando**: el backend scoped el prompt del agente al servicio, sin jaula (atiende cross-service y ofrece cambiar). Prompt dinámico + estado de modo en la workflow. |
| **Theming** | Dark + Light de primera clase, por **tokens** (nunca color literal). Contraste AA en ambos. |
| **Realtime** | Polling de `/reply` con ack óptico. |

---

## 4. Arquitectura del cliente (modular — requisito duro)

```
app/
├── design-system/   # tokens (color/tipo/espaciado/motion) + primitivos
├── shell/           # AppShell: header + rail(desktop)/tabbar(mobile) + routing + sesión + badge de pendientes
├── auth/            # login, reset password, guardas, supabase-js, 401/403
├── modules/
│   ├── chat/        # consola conversacional (hero) + tarjeta HITL canónica
│   ├── connections/ # grilla data-driven (desde /catalog + /me)
│   ├── account/     # perfil, salir, reconexión, tema, instalar
│   └── _coming/     # tile "Próximamente"
└── lib/api/         # un archivo por recurso, mock ↔ real intercambiable
```

**Reglas:** (1) módulo = carpeta autocontenida; sumar módulo = carpeta + registro en el rail. (2) rail/tab-bar desde un **registro declarativo** de módulos, no hardcodeado. (3) **Conexiones no hardcodea servicios** (N cards desde catálogo; con búsqueda/filtro al crecer). (4) `lib/api` aísla el transporte (mock y real con la misma firma). (5) **La tarjeta HITL es UN componente canónico** que todo servicio hereda (evita fragmentación cuando el catálogo crece). (6) todo color/tipo/espaciado desde tokens.

---

## 5. Pantallas y estados (diseñar TODAS: desktop + mobile, dark + light)

### 5.1 Login
- Email + contraseña; mostrar/ocultar; "Entrar". Enter envía. Foco visible.
- **"¿Olvidaste tu contraseña?"** → flujo de reset nativo (pedir email → "te mandamos un link" → pantalla de nueva contraseña desde el link). Distinto del error de credenciales.
- Estados: idle · enviando · error credenciales ("Email o contraseña incorrectos") · error de red · email de reset enviado.
- Sin auto-registro: "¿No tenés cuenta? Escribinos".
- Prompt de instalación PWA: **NO acá** (ver §5.5 / §10 — se ofrece tras el primer éxito).

### 5.2 App shell
- **Header:** marca + **indicador de presencia que respira** (firma, §8); acceso a Cuenta.
- **Desktop:** rail izquierdo: 💬 Chat · 🔌 Conexiones · 📊 Caja *(próx.)* · 📅 Agenda *(próx.)* · 👤 Cuenta.
- **Mobile:** tab bar inferior (mismos ítems; los "próx." bloqueados).
- **Badge de acción pendiente** en el ítem **Chat**: contador tipo notificación que **persiste cruzando toda la navegación** mientras haya un `Confirmá/Cancelá` sin resolver. (Hace visible la durabilidad: el pedido sigue vivo aunque el usuario se vaya del chat.)
- **Aviso de reconexión:** si un servicio requiere reconectar, señal ambiental accesible (ver §5.4).

### 5.3 Chat (hero) — el corazón, y donde vive el riesgo

**Lista de mensajes:** burbujas usuario (derecha) / asistente (izquierda). Variantes del asistente:
- **texto simple**,
- **link de pago** — link + **"Compartir"** (Web Share API `navigator.share()`, fallback `wa.me/?text=` o copiar) con mensaje pre-armado ("Te paso el link para abonar: …"). **Sin** estado "pagado" (MP notifica nativo).
- **tarjeta de confirmación (HITL)** — ver abajo,
- **preview de contenido** (cuerpo del mail, post de IG WYSIWYG) dentro del HITL,
- **sistema/estado** (fino, centrado),
- **desambiguación** (chips seleccionables),
- **servicio no conectado** (CTA inline para conectar ese servicio),
- **capacidad no soportada** (límite claro + alternativa).

**Tarjeta de confirmación (HITL) — componente canónico (crítico):**
- **Datos SIEMPRE estructurados** (pares label:valor), nunca prosa. Mostrar el valor **ya interpretado** por el copiloto, nunca el texto crudo del usuario como hecho.
- **Destinatario/cliente siempre visible y jerárquicamente destacado** (en el hilo único que mezcla clientes, "cobrar $15.000" sin nombre puede ir a la persona equivocada).
- **Monto** aislado, grande, con moneda explícita (`$ 15.000 ARS`).
- **Fecha/hora** con día de semana + **inicio Y fin** (expone el default oculto de 60 min).
- **CTA con verbo + dato:** "Sí, cobrar $15.000" / "Sí, enviar a juan@…" / "Publicar en Instagram" — no un "Confirmá" genérico. Botón secundario "Cancelar".
- **Variante de riesgo alto / contenido irreversible** (publicar en IG, mail a terceros): **preview literal** (WYSIWYG del post con imagen+caption / cuerpo completo del mail) + línea "para borrarlo, se hace desde Instagram" (o el equivalente). *(Sin doble-gesto/undo-delay: el HITL de aprobación alcanza — decisión operador.)*
- **Una acción = una tarjeta.** Si un mensaje encadena 2+ escrituras ("mandale el link **y** agendale"), generar **tarjetas secuenciales**, cada una con su Confirmá/Cancelá.

**Desambiguación ANTES del gate:** si hay homónimos (varios "Juan"), ambigüedad de escala ("15 lucas") o de fecha ("el jueves a las 3"), el copiloto pregunta con **chips tocables** antes de armar la tarjeta. Nunca resuelve en silencio delegando la detección del error al paso de confirmar.

**Composer + feedback de envío:**
- Input multilínea; Enter envía, Shift+Enter salto. **NO se deshabilita** al enviar.
- El mensaje del usuario aparece al instante con estado tipo WhatsApp: gris "enviando" → **"✓✓ recibido, pensando…"**.
- **Debounce client-side** del mismo pedido de escritura (evita el reenvío por impaciencia; nota: el anti-duplicado server-side robusto queda diferido, §12).
- **3 estados de espera diferenciados:** *pensando* (polling de respuesta) · *procesando* (ejecutando la acción tras confirmar, con **micro-copy por acción**: "Generando tu link de cobro…", "Agendando…") · *tardando más de lo normal*.
- **Copy de durabilidad visible:** "Podés cerrar la app, te sigo respondiendo."
- **Mic deshabilitado** con micro-copy "Por ahora, solo texto" (el segmento busca el micrófono por instinto).

**Barra de modos por app (data-driven, sobre el composer):**
- Fila horizontal scrollable de botones, **uno por servicio conectado** (ícono + label de acción: "Mail", "Agenda", "Cobrar", "Clientes", "Archivos", "Instagram"). Derivada de `/me` + metadata del catálogo; **nunca hardcodeada**. Un "+" al final lleva a Conexiones para sumar servicios.
- Tocar un botón **activa un modo de foco blando**: el agente prioriza ese servicio (el backend scoped el prompt), pero **NO es una jaula** — si el usuario pide otra cosa, el agente la atiende igual y puede auto-cambiar de modo.
- **Chip de modo activo** cerca del composer ("Modo Gmail ✕"); el ✕ vuelve a modo general. El **placeholder** del composer y los **chips de sugerencia** se adaptan al modo ("Modo Gmail: 'Mandale un mail a…'").
- Estado por defecto = **sin modo** (general, todos los servicios disponibles). El modo es un realce de discoverability + precisión, no una restricción.

**Estado vacío (primer uso):** saludo + chips tocables **ordenados de bajo a alto riesgo** (empezar por **agenda** —capacidad reversible, gratificación instantánea—, no por cobro). Los chips **autocompletan el input** y **ninguno** promete algo no soportado.

**Servicio no conectado / just-in-time:** si el usuario pide algo que requiere un servicio sin conectar, burbuja con CTA inline a conectar **ese** servicio (conexión bajo demanda, no un checklist de 6 permisos de entrada).

**Capacidad no soportada:** el copiloto reconoce el límite y da alternativa concreta ("Todavía no puedo mover turnos por acá; movelo en tu Google Calendar: [link]"). Nunca falla en silencio ni crea una acción no pedida. La tarjeta de creación de turno **declara sus límites** en el momento (solo crea, 60 min).

**Errores:** fallo de envío → "No se pudo enviar. Reintentar". **MP desconectado** → burbuja específica "No puedo generar el link: reconectá Mercado Pago" + CTA inline (distinta del error de red). *(Nota: el frontend detecta "no conectado" desde `/me`; el caso "token caído" real es backend, diferido — §12.)*

### 5.4 Conexiones (grilla data-driven)
- Cards **agrupadas por categoría** (Cobros, Agenda, Mail, Archivos, Clientes, Redes…) — categorías y servicios del **catálogo**, no fijos.
- **Card genérica (sirve para cualquier servicio):** ícono, nombre, **copy de trabajo por sobre el nombre de marca** ("Guardá y encontrá tus clientes" como principal, "HubSpot" secundario — el segmento no piensa "CRM"), **badge de estado de 3 estados** (Conectado ● / Necesita reconexión / Sin conectar ○ — color+ícono+texto), acción Conectar/Reconectar (clickeable directo), y "qué le podés pedir" (expandible).
- **Flujo de conexión (3 momentos):** Conectar → "Conectando…" → OAuth externo → vuelve. La **página de callback OAuth debe auto-redirigir a la SPA** (o botón grande "Volver al Copiloto" con deep-link). *(Validar redirect en PWA instalada Android/iOS — §12.)*
- Estados: loading (skeletons) · error de carga · **búsqueda/filtro** cuando hay muchos servicios.

### 5.5 Cuenta
- Identidad del tenant (email); **Salir**.
- **Reconexión** de servicios caídos.
- Toggle de **tema** (dark/light/auto).
- **Instalar la app (PWA)** — ofrecido acá y tras el primer éxito.
- Versión, ayuda/contacto.
- *(Vista "Actividad reciente" respaldada por datos: diferida — requiere endpoint. En v1, a lo sumo un registro de acciones de la sesión desde estado local.)*

### 5.6 Módulos "Próximamente" (Caja/BI, Agenda)
- Tile/vista diseñada (no placeholder feo): nombre, ícono, 1 línea de qué hará, estado "Muy pronto". Comunica roadmap + modularidad. *(Teaser con dato real "blurred" = diferido, requiere endpoint.)*

### 5.7 Estados globales
- Splash con marca + presence · Offline/PWA sin red · **401** → login con aviso · **403** (sin tenant) → "Tu cuenta todavía no está habilitada. Escribinos." · Toasts · Modales/bottom-sheets (sheet en mobile).

---

## 6. Biblioteca de componentes (design system, theme-aware)

- **Marca + indicador de presencia** (firma).
- **Tarjeta de confirmación HITL canónica** — props: `{ título humano, pares label:valor, destinatario destacado, monto, fecha (inicio/fin), nivel_de_riesgo, preview?, cta_label, cancel_label }`. Variante de riesgo alto con preview literal.
- **Preview de contenido** (WYSIWYG del post de IG; cuerpo de mail).
- **Burbuja de link de pago** (link + Compartir + copiar; sin estado "pagado").
- **Chips de desambiguación** (seleccionables).
- **Burbuja "servicio no conectado"** (CTA de conexión).
- **Burbuja "capacidad no soportada"** (límite + alternativa).
- **Estado de envío** (✓ enviando / ✓✓ recibido) + **typing/estados de espera** (pensando/procesando/tardando).
- **Botones:** primario (acento), secundario, ghost, destructivo; estados.
- **Input de texto** y **composer** (multilínea + enviar + mic deshabilitado).
- **Burbuja de chat** (asistente/usuario) y sus variantes.
- **Card de servicio/conexión** (genérica, data-driven) con **badge de 3 estados**.
- **Header de categoría** · **ítem de rail/tab-bar** (activo, "próximamente" bloqueado, **badge de pendientes**).
- **Header bar** (marca + presence + cuenta).
- **Badge/chip de estado** · **Toast** · **Modal/bottom-sheet** · **Empty state** · **Skeletons** · **Avatar/chip de identidad** · **Chips de sugerencia** (prompts del empty-state).
- **Barra de modos** (fila de botones por servicio) · **botón de modo** (ícono+label, estado activo/inactivo) · **chip de modo activo** (con ✕ para salir).

---

## 7. Contratos de datos (construir contra ESTO, con mocks)

> API base real: `https://copiloto.178-105-191-1.sslip.io`. Autenticado = `Authorization: Bearer <JWT>` (GoTrue, HS256, `aud=authenticated`). El cliente obtiene el JWT con `supabase-js`. En mock, `lib/api` devuelve estas mismas formas.

### 7.1 Auth (supabase-js)
- Login email+password → `{access_token (JWT), refresh_token}`. `supabase-js` maneja refresh/persistencia. JWT trae `sub` + claim `cliente_id`.
- **Reset de contraseña (nativo Supabase):** `resetPasswordForEmail(email)` → email con link → pantalla de nueva contraseña (`updateUser`). *(Requiere SMTP en fusion — [a validar] §12.)*
- Errores UI: credenciales inválidas · **401** (token ausente/expirado → login) · **403** (JWT válido sin tenant → "cuenta no habilitada").
- Sin signup público en v1.

### 7.2 `POST /chat` (auth)
Req: `{ session_id, text, kind: "text"|"callback", mode?: "<service_key>"|null }` (callback = respuesta a un botón; `text` = `value`, no pasa por el LLM). **`mode`** (planificado) = servicio activo de la barra de modos; el frontend lo mantiene en estado local y lo manda en cada mensaje → el backend scoped el prompt (foco blando). `null`/ausente = modo general.
Res: `{ wf_id, accepted }` — no trae la respuesta (llega por `/reply`).

### 7.3 `GET /reply?session_id&after_id` (auth)
Res: `{ replies: [ { id, text, choices?: [{label, value}] } ], next_id }`. Paginar por `next_id`. Con `choices` → botones; al tocar → `POST /chat kind:"callback"`, `text=value`.

### 7.4 `GET /me` (auth)
`{ cliente_id, mp_connected: bool, composio_connected: [slug,...] }`. Fuente del estado "Conectado". *(No distingue "token caído": mp_connected=true si hay seller guardado aunque el token esté vencido — el badge "Necesita reconexión" real depende de backend diferido.)*

### 7.5 `GET /mp/connect` (auth) → `{ url }` (OAuth MP). Callback: `GET /mp/callback` (HTML) → debe redirigir a la SPA.
### 7.6 `GET /composio/connect?service=<slug>` (auth) → `{ url }` (400 si inválido). Mismo patrón de callback+redirect.

### 7.7 `GET /catalog` (auth) — **NUEVO (lo construye el equipo Copiloto); diseñar contra esto**
```json
{ "services": [
  { "key":"mercadopago", "display_name":"Mercado Pago", "category":"Cobros", "kind":"mercadopago",
    "work_label":"Cobrá con links de pago desde el chat", "description":"...",
    "capabilities":["Generar link de cobro"], "connected":true, "connect_path":"/mp/connect" },
  { "key":"hubspot", "display_name":"HubSpot", "category":"Clientes", "kind":"composio",
    "work_label":"Guardá y encontrá tus clientes", "description":"...",
    "capabilities":["Guardar un cliente","Buscar un cliente"], "connected":false,
    "connect_path":"/composio/connect?service=hubspot" }
  // ... N más (googlecalendar, gmail, googledrive, googledocs, googlesheets, instagram, y los que se sumen)
] }
```
- La UI **agrupa por `category`**, usa **`work_label`** como texto principal y **`display_name`** como secundario. Nunca hardcodea la lista. `connected` se refresca tras conectar (o se cruza con `/me`).
- La **barra de modos** también deriva de acá (los servicios `connected:true`), usando `key` como valor de `mode` + un ícono/label corto de la metadata.

### 7.8 Errores → estados de UI
401 → login · 403 → cuenta no habilitada · 400 (connect) → servicio inválido · 5xx/red → error con reintento.

---

## 8. Brief visual (Claude Design es dueño del resultado)

- **Atributos:** durable · siempre encendido · capaz · calmo · confiable · argentino · para emprendedores de servicios. Metáfora **copiloto / cabina**.
- **Elemento firma:** **indicador de presencia que "respira"** junto a la marca (encarna la durabilidad). Respeta `prefers-reduced-motion`.
- **Dirección sugerida (una opción, libre de mejorarla):** *"cabina al anochecer"* — fondo profundo (navy, no negro puro), **acento cálido (ámbar) como señal** con restricción, verde solo para "conectado", **etiquetas de estado en monoespaciada** (lectura de instrumento). Display con carácter + cuerpo legible + mono para datos.
- **Evitar los defaults de IA:** crema+serif+terracota · negro+verde ácido · broadsheet con hairlines.
- **Restricción:** gastar la audacia en el elemento firma; el resto, quieto.
- **Theming:** dark + light por tokens, contraste AA en ambos.
- **Motion:** deliberado y sobrio (pulso de presencia, reveal de mensajes, micro-interacciones). Nada que "grite IA".

---

## 9. Copy / tono (es-AR)

Voz activa, frases cortas, sentence case, voseo. Nombrar por lo que el usuario controla ("Cobrá con links", no "OAuth de MP"). Consistencia: "Confirmá" → "Confirmado". Errores = qué pasó + cómo seguir. Vacíos = invitación con ejemplos.

**Strings clave (ajustables):**
- Login: "Entrar" · "¿Olvidaste tu contraseña?" · "Te mandamos un link a tu email" · "¿No tenés cuenta? Escribinos" · "Email o contraseña incorrectos".
- Chat vacío: "Hola 👋 Soy tu copiloto. ¿En qué te doy una mano?" + chips (bajo→alto riesgo): "Agendame una reunión el jueves a las 15" · "Anotá a un cliente nuevo" · "Cobrale $15.000 a Juan por la consulta".
- HITL: CTA con dato ("Sí, cobrar $15.000" / "Publicar en Instagram") · "Cancelar" · durabilidad: "Podés cerrar la app, te sigo respondiendo."
- IG: "Así va a quedar tu publicación:" + "Una vez publicado, para borrarlo tenés que hacerlo desde Instagram."
- Espera: "Generando tu link de cobro…" · "Agendando…".
- Modos: "Modo Gmail" · "Salir del modo" · placeholder "Modo Gmail: mandá un mail a…" · "+ Conectar más".
- Compartir: "Te paso el link para abonar: [link]".
- Conexiones: "Conectar" · "Reconectar" · "Conectado" · "Necesita reconexión" · "Sin conectar" · "No puedo generar el link: reconectá Mercado Pago".
- No soportado: "Todavía no puedo mover turnos por acá; movelo en tu Google Calendar: [link]."
- 403: "Tu cuenta todavía no está habilitada. Escribinos para activarla."

---

## 10. No funcionales (piso de calidad)

- **Responsive real** (desktop split / mobile tab bar / tablet); sin scroll horizontal del body.
- **PWA:** instalable (manifest, íconos, theme-color por tema), pantalla completa, shell offline básico, splash. **Prompt de instalación tras el primer éxito tangible** (primer cobro/agenda), no en el primer load.
- **Composer:** el input **no se bloquea** al enviar (ack óptico + debounce client-side). *(Resuelve la contradicción de v1: gana "no bloquear".)*
- **Accesibilidad:** foco de teclado visible, navegación por teclado en chat/formularios, roles/aria en botones de choice y HITL, `prefers-reduced-motion`, contraste AA en ambos temas.
- **Performance:** lazy-load por módulo, skeletons en toda carga.
- **Estados siempre cubiertos:** loading/vacío/error/éxito por pantalla.

---

## 11. Entregables esperados de Claude Design

1. **Design system:** tokens (dark+light) + primitivos §6.
2. **Todas las pantallas §5** (desktop+mobile, dark+light, con estados).
3. **Especificación de componentes** (o su implementación) — con énfasis en la **tarjeta HITL canónica** (el componente de mayor riesgo/reuso).
4. **Frontend React (Vite) PWA** con la arquitectura §4, cableado a **mocks** que respetan §7.
5. La **card de servicio genérica** demostrada con ≥8 servicios de distintas categorías (prueba de data-driven).

---

## 12. Asunciones / deuda gestionada (dueño: equipo Copiloto — no bloquean el diseño)

- **[A CONSTRUIR]** `GET /catalog` (§7.7) + metadata de presentación (work_label/display_name/categoría/capabilities). Fundación de Conexiones.
- **[A VALIDAR]** Reset de contraseña nativo requiere **SMTP configurado en el GoTrue de fusion**; si no está, el email de reset no sale. Validar antes de prometerlo en prod.
- **[A VALIDAR]** Login `supabase-js` desde el navegador (CORS/alcance del auth de fusion); alternativa lista = proxy de login server-side. El contrato §7.1 no cambia.
- **[A VALIDAR]** Redirect del callback OAuth en **PWA instalada** (Android/iOS) — riesgo de abrir en navegador del sistema sin vuelta a la app.
- **[DEUDA DIFERIDA — visible]** **Anti-duplicado server-side** (debounce semántico de la misma intención de escritura) y **fail-fast real de "token caído"** (health-check/estado de reauth) **NO entran en v1** (decisión operador). *Riesgo:* un reenvío podría duplicar un cobro; una desconexión de token se descubre recién al ejecutar. *Mitigación v1 (frontend):* debounce client-side + surface "no conectado" desde `/me`. *Propietario:* equipo Copiloto. *Condición de pago:* antes de escalar volumen de cobros en prod.
- **[A CONSTRUIR + SPIKE]** Modos por app (foco blando): ensamblado **dinámico** del system prompt scoped por modo (hoy es estático en `worker_b.py:86` = `SYSTEM_PROMPT + services.prompt_fragments()`) + campo `mode` en `POST /chat` + estado de modo en la `ConversationWorkflow` (agregar un campo = replay-safe). **Spike previo:** validar A/B que el scoping mejora el routing de gpt-4o-mini vs. el prompt full. *Propietario:* equipo Copiloto. El diseño de la barra/chip avanza en paralelo (no depende del spike).
- **[FUERA por decisión]** Loop de cobro en el chat (MP notifica nativo) · vista "Actividad reciente" BI-backed · teaser tiles con dato real → requieren endpoints, diferidos.
- **[A CONFIRMAR]** Campos exactos de `Reply` de `/reply` contra `reply_store`.

---

## 13. Resumen de un vistazo

Cliente **PWA React modular** para el Copiloto: **chat protagonista** (hace todo lo LIVE por conversación) con una **tarjeta de confirmación canónica graduada por riesgo** (datos estructurados, destinatario y monto destacados, preview para contenido/IG), **ack tipo WhatsApp** + **compartir link por WhatsApp**, **badge de pendientes** que hace visible la durabilidad, **reset de contraseña** nativo, una **barra de modos por app** (foco blando, data-driven) y un **rail de módulos** (Conexiones data-driven, Cuenta, Caja/Agenda "próximamente"). Dark+light por tokens, identidad de "cabina copiloto" con presencia que respira. Se construye contra contratos de datos exactos con mocks; el equipo Copiloto lo cablea a la API real. Racional UX completo en `2026-07-03-cliente-ux-analisis.md`.
