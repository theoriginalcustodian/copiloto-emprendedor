# ADR-004 — Agenda de varios días y escritura de eventos (reemplaza «sólo hoy» de CAL1 §1/§3/§5)

- **Estado:** PROPOSED (pasa a ACCEPTED al cerrar los tests de §6, incluido el adversarial — regla dura del workspace).
- **Fecha:** 2026-09-21 · **Dueña:** sesión BACKEND (numeración global) · **Fila:** `BL-J13` / K-13.
- **Reemplaza:** la decisión de `2026-08-11-specs-calendar-agenda-en-mi-dia.md` §1 (Agenda = sólo hoy, sólo lectura), §3.2 (rango = hoy) y §5 (crear/editar evento fuera de alcance).
- **No reemplaza:** que la Agenda sea un espacio **aparte** del Kanban y sin ciclo de vida propio (espejo de Calendar). Eso sigue vigente.

## Contexto

CAL1 fijó `GET /mi-dia/calendario` con `_rango_hoy()` (`mi_dia_web.py`), sólo lectura. El prototipo (pantalla `agenda`) pide Hoy / Mañana / Vencen esta semana / Sin hora con franja horaria, y crear un evento desde «Nuevo evento» y por voz. Ya existe por voz el tool de 1ª clase `calendar_book` (en `WRITE_TOOLS`, o sea con confirm-gate HITL) sobre `GOOGLECALENDAR_CREATE_EVENT`, que está en la policy (`calendar_policy.py`).

## Decisión

1. **Lectura por rango, mismo endpoint.** `GET /mi-dia/calendario` acepta `desde` y `hasta` opcionales (fecha ISO `YYYY-MM-DD`, interpretadas en `DEFAULT_TZ`; sin ellos = hoy, o sea **retrocompatible**: los clientes actuales no cambian). Tope de ventana: 14 días (400 si excede o `hasta < desde`). Sigue siendo `FIND_EVENT` con `single_events=true`, `order_by=startTime`; el orden lo resuelve el backend.
2. **Agrupación en el backend, no en la UI.** La respuesta suma `grupos`: `[{id: "hoy"|"manana"|"semana"|"sin_hora", titulo, eventos}]`, donde «sin hora» = eventos de día completo (`start.date` sin `dateTime`) y «semana» = el resto hasta el domingo. `eventos` se conserva plano para no romper a los consumidores de CAL1. Los campos nuevos por evento (`fin`, `dia_completo`) sólo se agregan cuando el spike los haya visto (regla CAL1: no inventar campos) → `[ASSUMED_PENDING_VERIFY]` hasta ese spike.
3. **Escritura sólo por el camino con HITL que ya existe.** «Nuevo evento» de la UI **no** llama a Calendar directo: dispara un turno al agente que propone `calendar_book`, y el confirm-gate (sí/no sobre los mismos argumentos) es el único que escribe. Se descarta un `POST /mi-dia/eventos` que escriba sin gate: multiplicaría la superficie de escritura sin un control adversarial adicional y contradice «siempre con HITL» del DoD.
4. **Tenant.** Toda llamada a Composio va con `user_id=cliente_id` del token (`require_tenant`); ningún parámetro del request elige el usuario Composio. La conexión es por tenant, así que A no puede leer la agenda de B.
5. **Capa 3 (cruce evento ↔ cliente) queda fuera** (`BL-V3`), igual que en el backlog.

## Consecuencias

- Cambio **aditivo**: cero migración, cero cambio en workflows/activities de Temporal (todo es front-door FastAPI + `execute` del gateway) → no hace falta `workflow.patched` ni replay nuevo.
- Costo: hasta 14 días × `max_results` eventos por request; se mantiene `max_results=50` por defecto y se agrega paginación sólo si el spike muestra truncado real.
- Riesgo: shape real de `start/end` en día completo no visto → el agrupador «sin hora» se fija tras un spike contra el tenant canónico (`e2e-device`), no antes.

## Alternativas rechazadas

- **Endpoint nuevo `/agenda`:** duplica auth, degradación (`conectado:false`) y tests para ganar nada; el aditivo alcanza.
- **Agrupar en la UI:** dos implementaciones (web + mobile) de la misma regla de «semana/sin hora» → deriva garantizada.
- **Escritura directa desde el botón:** ver decisión 3.

## 6. Criterio de aceptación (ACCEPTED sólo con esto en verde)

- [ ] Spike contra `e2e-device` que fija el shape de día completo y de `end` (`spikes/calendar-find-event/`).
- [ ] Tests de rango: default = hoy (retrocompat), ventana > 14 días → 400, `hasta < desde` → 400, agrupación con evento sin hora.
- [ ] **Test adversarial:** con `composio_gateway` fake por `user_id`, el token de A pide el rango y sólo llegan a Composio llamadas con `user_id=A`; ningún parámetro (`user_id`, `cliente_id`) del request lo cambia.
- [ ] Crear evento por voz: `calendar_book` sigue en `WRITE_TOOLS` (test de guarda) y aparece en Google Calendar de `e2e-device` (evidencia de device, FE).
