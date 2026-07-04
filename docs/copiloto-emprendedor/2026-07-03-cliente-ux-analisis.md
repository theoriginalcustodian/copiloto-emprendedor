# Análisis UX — Cliente del Copiloto del Emprendedor (v1)

> Complemento del handoff `2026-07-03-cliente-web-mobile-design-handoff.md`. Producto de un análisis multi-lente (personas/JTBD · user-flows · task-analysis · heurística Nielsen · SOTA de apps para emprendedores), integrado. Audiencia: emprendedor/a de servicios argentino, mobile-first, WhatsApp-céntrico, poca paciencia, ansiedad con la plata.

## 0. Tesis

La promesa —"resolvé tu negocio por chat, y nada se pierde"— choca con tres realidades de v1 que **concentran casi todo el riesgo de UX en una sola superficie: la tarjeta de confirmación HITL**. (1) Un solo hilo continuo, sin listado de conversaciones, que en una jornada real mezcla 4 clientes. (2) Entrega por polling (fire-and-forget), sin el "visto" que este público da por sentado desde WhatsApp. (3) Acciones que escriben en el mundo real —cobrar plata, publicar en Instagram (irreversible), agendar— resueltas todas con el **mismo** botón `Confirmá/Cancelá` liviano.

**Conclusión rectora:** el diferencial vendido (durabilidad Temporal) hoy es **invisible en la UI**, y la barrera de seguridad única (el HITL) está **sub-diseñada** justo donde el error es más caro. El trabajo de diseño de v1 no es decorar el chat: es **convertir la garantía de backend en beneficio percibido** y **graduar el HITL por costo-de-error**.

Hallazgo de grounding: el handoff se contradecía a sí mismo (§5.3 "composer deshabilitado mientras envía" vs §10 "sin bloquear el input") — se resuelve abajo a favor de §10 + ack óptico.

## 1. Personas y JTBD

Tres arquetipos, todos **multi-cliente por jornada** (el dato que hace peligroso el hilo único):

| Persona | Contexto | JTBD dominante | Ansiedad |
|---|---|---|---|
| **Consultora/estudio** (nutri, contadora, abogada) | Escritorio+celu, entre clientes | Cobrar al cierre sin perseguir + agendar/reprogramar | Monto/persona equivocada; turno que "creyó" mover |
| **Oficio** (plomero, gasista, técnico) | 100% celu, en la calle, cliente presente | Terminé, quiero la plata **ahora** | Que el link no ande con el cliente mirando; no saber si le pagaron |
| **Comercio chico** (kiosco, local) | Celu en el mostrador, multitarea | Cobrar y anotar sin fricción | Duplicar un cobro; no reconocer qué ya hizo |

**JTBD por impacto:** (1) **cobrar en el momento** (ancla); (2) agendar/reprogramar; (3) mail; (4) anotar al cliente. **Modelo mental:** el oficio/comercio no piensa "CRM", piensa "anotar al cliente" → HubSpot como "CRM" lo vuelve invisible.

## 2. Journeys con drop-off

- **J1 Primer login (admin-mediado):** recibe una contraseña que no eligió → la pierde/tipea mal → **no hay "olvidé mi contraseña"** → abandono día-0.
- **J2 Cobro en persona (ancla):** espera sin feedback (incómodo frente al cliente) → si MP cayó, se entera **al final** → link "copiable" pero mandarlo por WhatsApp es manual → **el loop no cierra** (no sabe si le pagaron dentro de la app).
- **J3 Reconexión MP:** hoy silenciosa; al reconectar **re-tipea** todo (desperdicia la durabilidad).
- **J4 Reprogramar turno:** la agenda **solo crea** → el LLM puede responder ambiguo (cree que se movió) o crear un **duplicado**. Fallo silencioso sobre la agenda = tan grave como sobre la plata.
- **J5 Volver día-2:** polling-only, un canal, sin push → **nada llama a volver** salvo el ícono PWA.

## 3. Task analysis — la tarjeta de confirmación es la columna vertebral

Las escrituras NO son equivalentes, pero el handoff les daba el mismo peso:

| Acción | Reversible | Costo error | Ambigüedad que el LLM resuelve solo |
|---|---|---|---|
| Agendar | Sí | Bajo | Fecha/hora, **duración 60min fija oculta** |
| Cobrar | El link sí; la plata de más, no | **Alto** | Escala del monto ("15 lucas"), **homónimo** |
| Mail a tercero | No | Alto (reputacional) | Destinatario, cuerpo |
| **Instagram publish** | **No** | **Máximo (público, permanente)** | Caption, precio en el texto |

1. **Habituación letal:** mismo Confirmá liviano → desde el 3er-4to uso se toca en automático → letal en las acciones caras. → **fricción asimétrica por riesgo**.
2. **Legibilidad antes de tocar plata:** monto en prosa → se confirma sin registrar que el LLM entendió mal la escala. → datos **estructurados**, monto aislado+grande+moneda, fecha con día + inicio Y fin.
3. **Autocontención en el hilo único:** "Vas a cobrar $15.000" sin nombrar a quién → ejecutable sobre la persona equivocada. → **destinatario siempre visible y destacado**.

La desambiguación (homónimos, escala, "el jueves") va **ANTES** del gate, con chips tocables — no delegar la detección al usuario apurado.

## 4. Hallazgos heurísticos (Nielsen)

- **H1 Visibilidad (rota):** polling sin indicador → el público WhatsApp lee el silencio como "se colgó" y **reenvía** → dos cobros. Necesita ack "✓✓ recibido" + debounce semántico.
- **H5 Prevención de errores:** habituación (§3.1).
- **H2 Mundo real:** "15 lucas"/"el jueves" mostrados **traducidos** a formato local inequívoco, nunca el texto crudo como hecho validado.
- **H6 Reconocer > recordar:** sin bitácora, "¿el cobro de Rodríguez lo mandé el martes?" penaliza la memoria → vista mínima "Actividad reciente" (los cobros ya están persistidos).
- **H3 Control:** dos acciones en un solo Confirmá viola control granular → **una acción = una tarjeta**.
- **Consistencia del catálogo modular:** sin un **componente HITL canónico con contrato de props**, cada servicio nuevo trae su propio patrón → fragmentación cuando el catálogo crece.

## 5. Patrones SOTA aplicados

- **Modelo WhatsApp gratis:** tildes "✓✓" para la latencia; **share-sheet WhatsApp-first** (Web Share API / `wa.me`) en el link de cobro; **mic deshabilitado** con micro-copy ("Por ahora, solo texto").
- **needs_reauth proactivo** (causa #1 de tickets "por qué no me pagaron"): avisar **in-chat apenas se detecta**, no solo estado pasivo.
- **Preview literal en el HITL** (cuerpo del mail, WYSIWYG del post de IG) en vez de resumen abstracto.
- **Irreversibles = undo-send:** preview real + "no se puede borrar" + segundo gesto/delay.
- **OAuth just-in-time:** conectar bajo demanda, no un checklist de 6 permisos de entrada.
- **Onboarding de bajo a alto riesgo:** el primer chip debe ser **agenda** (reversible, gratificación instantánea), no cobro.

## 6. Síntesis — ~10 palancas (solapamientos resueltos)

- **Composer (bloquear vs libre):** no se hard-disablea; **ack óptico inmediato** ("enviando"→"✓✓ recibido") + **debounce semántico** server-side. Resuelve la contradicción interna del handoff.
- **needs_reauth:** (a) **fail-fast in-chat** al pedir el cobro + (b) **badge ambiental de 3 estados** en Conexiones. Complementarios.
- **Compartir:** Web Share API con fallback `wa.me`/copiar.
- **Cierre del loop de cobro:** burbuja de link con ciclo de vida (pendiente/pagado/vencido) + "✅ Juan te pagó $15.000" + resumen "mientras no estabas". Depende de **webhook MP → chat** (decisión #1).
- **Durabilidad visible:** badge de acción pendiente en el ítem Chat + "podés cerrar la app, te contesto igual" + retomar la acción tras reconectar.

## 7. Definición de "listo" (UX) para v1

Ninguna escritura se ejecuta sin destinatario + dato clave visibles y desambiguados en la tarjeta; ninguna caída de conexión se descubre recién al final; y el cierre del loop de cobro (¿me pagaron?) ocurre **dentro** del producto.

---

## Cambios priorizados al handoff

| # | Prioridad | Cambio | Toca | Depende de backend |
|---|---|---|---|---|
| 1 | 🔴 alta | Tarjeta HITL canónica parametrizada (props: título humano, pares label:valor, riesgo, botones); datos estructurados (destinatario destacado, monto aislado+moneda, fecha inicio+fin); preview literal; CTA con verbo+dato ("Sí, cobrar $15.000") | §6, §5.3 | no |
| 2 | 🔴 alta | Variante riesgo-alto/irreversible (IG, montos grandes, mail a terceros): tratamiento visual de alerta, preview WYSIWYG, "no se puede deshacer", segundo gesto/undo-delay | §6, §5.3 | no |
| 3 | 🔴 alta | Fail-fast: chequear salud de conexión ANTES del gate; si MP caído → burbuja específica "reconectá MP" + CTA inline | §5.2, §5.3 | **sí** (health/reauth) |
| 4 | 🔴 alta | Burbuja link de pago con ciclo de vida (pendiente/pagado/vencido) + mensaje "✅ te pagó" + resumen al reabrir | §5.3, §6 | **sí** (webhook→chat) |
| 5 | 🔴 alta | CTA "Compartir" (Web Share API + fallback `wa.me`) con mensaje pre-armado, en vez de solo "copiar" | §6, §5.3 | no |
| 6 | 🔴 alta | Feedback de envío tipo WhatsApp (✓✓) + input NO bloqueado + debounce semántico anti-duplicado + 3 estados de espera + copy de durabilidad | §5.3, §10, §6 | **sí** (debounce) |
| 7 | 🔴 alta | Badge de acción pendiente en el ítem Chat del rail/tab-bar (persiste cruzando navegación) | §5.2, §6 | no |
| 8 | 🔴 alta | Callback OAuth auto-redirige a la SPA (o botón "Volver al Copiloto"); validar en PWA instalada Android/iOS | §5.4, §7.5/7.6 | parcial |
| 9 | 🔴 alta | Flujo "Olvidé mi contraseña" (reset Supabase o derivación clara), distinto del error de credenciales | §5.1, §7.1 | **sí** (política auth) |
| 10 | 🔴 alta | Patrón "capacidad no soportada": el agente reconoce el límite + da alternativa (mover turno → link a Calendar), nunca falla en silencio; la tarjeta de turno declara sus límites (solo-crea, 60min) | §5.3, §6 | no |
| 11 | 🟡 media | Desambiguación con chips ANTES del gate (homónimos, escala de monto, fecha) | §5.3, §6 | no |
| 12 | 🟡 media | Una acción = una tarjeta (secuencial), nunca combinada todo-o-nada | §5.3, §6 | no |
| 13 | 🟡 media | Retoma proactiva tras reconectar ("¿generamos el link de $20.000 para María ahora?") | §5.3 | **sí** (persistir intención) |
| 14 | 🟡 media | Burbuja "servicio no conectado" con CTA inline + conexión just-in-time | §5.3, §5.4 | no |
| 15 | 🟡 media | Chips del empty-state de bajo→alto riesgo (empezar por agenda), auditados para no prometer lo no soportado | §5.3, §9 | no |
| 16 | 🟡 media | Badge de 3 estados en toda card de Conexiones (Conectado/Reconectar/Sin conectar), no solo MP | §5.4, §6 | parcial |
| 17 | 🟡 media | Copy de trabajo > nombre de marca en las cards ("Guardá y encontrá tus clientes" > "HubSpot/CRM") | §5.4, §7.7, §9 | no |
| 18 | 🟡 media | Vista mínima "Actividad reciente" (acciones confirmadas + timestamp) + buscador de historial | §5.5, §5.3 | **sí** (endpoint) |
| 19 | 🟡 media | Edición ligera in-card (corregir hora/monto sin re-tipear todo) | §6, §5.3 | **sí** (re-propose) |
| 20 | 🟡 media | Prompt de instalación PWA tras el primer éxito tangible, no en el primer load | §5.1, §10, §5.5 | no |
| 21 | 🔵 baja | Micro-copy de progreso por acción ("Generando tu link…") distinto del typing genérico | §5.3, §6 | no |
| 22 | 🔵 baja | Mic deshabilitado + "Por ahora, solo texto" | §5.3, §6 | no |
| 23 | 🔵 baja | Tiles "Próximamente" con dato real blurred ("$XX cobrados este mes 👀") + "Avisame cuando esté" | §5.6, §5.2 | parcial |

## Decisiones abiertas (del operador — algunas expanden scope a backend)

1. **Cierre del loop de cobro:** ¿construir el evento webhook MP → "Pago recibido" en el chat + resumen "mientras no estabas"? Sin él, el JTBD ancla no cierra dentro del producto.
2. **Recuperación de contraseña:** ¿reset nativo Supabase (magic link) o admin-mediado?
3. **Instagram publish:** ¿se expone en v1 (con fricción reforzada) o se difiere? (irreversible).
4. **Modelo de identidad:** un login por emprendedor vs. compartido entre empleados (afecta privacidad del historial). *Nota: el backend ya es 1 usuario = 1 tenant.*
5. **Gate HITL:** ¿binario, o edición inline de campos? (requiere re-propose sin round-trip al LLM).
6. **Timeout del HITL durable:** ¿expira una confirmación nunca resuelta? ¿se avisa?
7. **Detección de needs_reauth:** ¿health-check proactivo o solo fail-fast al intentar?
8. **Resumen de bienvenida:** ¿endpoint liviano de "cobros pendientes" para el day-2 hook?
