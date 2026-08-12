# RESULT — spike `calendar-find-event` (CAL1 §1)

> **Fecha:** 2026-08-11 · **Dónde:** VPS `unreal-copilot`, `apps/copiloto` + `motor` reales, venv de
> producción, `COMPOSIO_API_KEY` real del env de producción (nunca bajado a la PC).
> **Tenant:** `e2e-device@copiloto.test` (canónico, `composio_user_id` = `4f3ecb78-2e36-4044-a56e-0e7ef6c4a655`).
> **Qué cierra:** de-risk de `GOOGLECALENDAR_FIND_EVENT` pedido por el contrato CAL1 antes de fijar el
> shape del endpoint de lectura. Corre el código real (`ComposioGateway` + `calendar_policy.py`), no un
> script paralelo — script en `spike.py`, volcado crudo en `out/resultado.json` (gitignored, tiene IDs
> de conexión internos, no secretos).

## Veredicto: 🔴 bloqueado — el tenant canónico NO tiene Google Calendar conectado

```
[1] connection_status('googlecalendar') = None   (no ACTIVE)
[2] list_connections()                  = [{"id": "ca_apuDdIpUztcn", "toolkit": "googlecalendar",
                                             "status": "INITIATED"}]
```

Hay un intento de conexión **arrancado y nunca terminado** (`INITIATED`, no `ACTIVE`) — alguien abrió
el flujo de OAuth en algún momento anterior (probablemente al escribir `test_e2e.py`, que ya asumía
una conexión existente vía `COPILOTO_COMPOSIO_USER_ID`) y no llegó a aprobar el consentimiento de
Google. `connection_status()` prioriza `ACTIVE` sobre `INITIATED` a propósito (`_STATUS_RANK` en
`composio_gateway.py`) — un intento a medias no debe leerse como "conectado", y acá el diseño hizo
exactamente lo que tiene que hacer: no dejó pasar una conexión a medio hacer como si sirviera.

**No es un bug ni un gap de código — es el mismo hueco §7.3 ya documentado el 2026-08-03** en
`docs/copiloto-emprendedor/2026-07-21-runbook-oauth-google-propio.md`: *"el spike de conectar una
cuenta real y ejecutar una tool de cada toolkit... exige clickear el consentimiento de Google con el
usuario `e2e-device@copiloto.test`, no es automatizable sin esa interacción humana/de device."* Ese
runbook cerró los pasos 1-6 (proyecto GCP, 5 APIs, consent screen, 5 auth configs propias incluyendo
`googlecalendar=ac_cY75ezl1w4sN`) pero dejó §7.3 pendiente — este spike es la primera vez que alguien
lo vuelve a pisar, con Calendar específicamente.

## Confirmado: el link de conexión usa la auth config PROPIA (marca copiloto), no el dashboard de Composio

```
gw._auth_config('googlecalendar') = ('ac_cY75ezl1w4sN', es_de_composio=False)
```

`authorize()` intentó `initiate()` con esa config propia y **no cayó al fallback** (sin warning en el
log — el fallback a `link()` hospedado de Composio loguea explícito si dispara, ver docstring de
`authorize()` en `composio_gateway.py`). Importa porque decide qué pantalla ve quien conecte: **la de
Google directo, con "Copiloto del Emprendedor" como nombre de la app** (lo que el runbook buscaba
lograr), no un dashboard de terceros.

**Link de conexión:** generado fresco en esta corrida (`gw.authorize(USER_ID, "googlecalendar")`),
short-link que redirige al consentimiento real de Google para ESE `user_id` — es un token de
capacidad (quien lo abra puede vincular su propia cuenta al tenant), así que **no se transcribe acá**
(el RESULT.md es público): queda en el `pedido_` del buzón de coordinación (gitignored, no llega al
repo). Se regenera en un segundo con el mismo one-liner de `authorize()` si expira o se necesita de
nuevo. Estado del proyecto GCP: consent screen en **Testing** (permisos caducan a los 7 días, hay
que reconectar semanalmente mientras siga así — ya documentado en el runbook, no es nuevo).

## Qué falta para desbloquear (acción humana, no delegable)

1. Abrir el link de arriba **logueado con la cuenta de Google que se vaya a usar para el tenant de
   pruebas** (no hay heurística que decida sola cuál cuenta real — es una decisión del operador).
2. Aprobar el consentimiento (va a pedir el scope de Calendar definido en el runbook §4).
3. Confirmar que Composio marcó la conexión como `ACTIVE` (un `connection_status()` como el de este
   spike alcanza para confirmarlo — o yo re-corro `spike.py` apenas avisen).

No lo intento resolver con un navegador automatizado: el propio runbook ya lo marca explícitamente
como no automatizable (Google lo diseña así contra abuso — CAPTCHA/verificación anti-bot en logins
nuevos), y aunque pudiera sortear eso, completar un consentimiento OAuth de una cuenta de Google real
en nombre de alguien es una decisión de confianza que le corresponde a un humano, no a este agente.

## Qué SÍ queda validado y sirve para §2 sin esperar más

- **El slug y la versión pineada existen en el catálogo real** (`test_slugs_existen_en_composio_real`
  / `test_version_pineada_existe_real`, preexistentes — no los reinventa este spike).
- **La policy fail-closed funciona como se espera**: `FIND_EVENT_SLUG` está en `read` (sin gate HITL,
  `confirmed=False` alcanza), coherente con el contrato ("mismo trato que `consultar_actividad`").
- **El shape de argumentos del CREATE real** (para cuando haga falta, p.ej. para poblar datos de
  prueba): `{"summary", "start_datetime", "end_datetime", "timezone"}` sin offset embebido en la
  fecha — confirmado leyendo `dispatcher_emprendedor.py` (el shape que YA usa producción), no
  inventado.
- **El camino "no conectado" es 100% real y reproducible** (es literalmente lo que acaba de pasar):
  `ConnectionRequired` es la excepción que el gateway lanza al ejecutar contra una cuenta sin
  conectar (ver `_is_connection_missing` en `composio_gateway.py`) — el endpoint de CAL1 §2 puede
  (y debe) implementar la degradación con gracia AHORA, con este caso real, sin esperar el resto.

## Lo que sigue bloqueado hasta la conexión real

- Forma EXACTA del JSON que devuelve `GOOGLECALENDAR_FIND_EVENT` (campos, anidamiento, cómo viene
  `start`/`end`, si `single_events=True` expande recurrencias o no). `test_e2e.py::_events()` sólo
  filtra por `summary`+`id`+`start` porque es lo mínimo que ese test necesita — no es evidencia del
  shape completo, es un recorte. **No se fija el contrato de datos del endpoint de lectura hasta
  volver a correr `spike.py` con la conexión en `ACTIVE`** — hacerlo ahora sería exactamente
  "codificar la esperanza" (regla de oro #1).
- Confirmación de timezone en la RESPUESTA (ya sabemos que el REQUEST se arma con offset `-03:00`
  explícito, por `test_e2e.py`; falta ver qué devuelve Google en `start`/`end` — mismo formato u otro).
- Recurrencias: el `spike.py` intenta un CREATE con `"recurrence": ["RRULE:FREQ=DAILY;COUNT=3"]`
  para poder inspeccionar cómo aparece en el FIND, pero nunca llegó a correr esa parte (corta antes,
  en el chequeo de conexión) — pendiente para la re-corrida.

## Próximo paso

`spike.py` queda tal cual, listo para re-correrse apenas la conexión esté `ACTIVE`:
```
ssh unreal-copilot "cd /opt/uc-repos/copiloto && set -a && . /etc/unreal-copilot/copiloto.env && set +a && /opt/uc-copiloto-venv/bin/python spikes/calendar-find-event/spike.py"
```
Un solo comando, sin volver a armar nada — el bloqueo es 100% la conexión, no el script.

---

## Actualización 2026-08-12 ~00:35 — desbloqueado, shape real confirmado

El operador conectó `341lin@gmail.com` al tenant canónico (agregó el test user en GCP + completó el
consentimiento OAuth; Composio confirmó `"Successfully connected"`, `connectedAccountId=ca_Ozwwpucuh5Bn`).
Re-corrida de `spike.py` contra Composio real, mismo tenant:

```
[1] connection_status('googlecalendar') = ACTIVE
[2] FIND rango HOY    -> successful=True
[3] FIND rango amplio -> successful=True, 3 eventos reales encontrados (no hizo falta crear sintéticos)
```

**Nota de alcance:** los 3 eventos son del calendario personal real del operador (`341lin@gmail.com`,
ahora conectado) — este documento vuelca la ESTRUCTURA (claves, shape de fechas), nunca el contenido
(`summary`/`description`/`attendees`/`location` reales). El volcado crudo completo sigue sólo en
`out/resultado.json` (gitignored).

### Envelope de la respuesta

```json
{"data": {...}, "error": null, "successful": true}
```

### Shape de cada evento (claves reales, Google Calendar API estándar)

```
attachments, attendees, conferenceData, created, creator, description, end, etag, eventType,
guestsCanModify, hangoutLink, htmlLink, iCalUID, id, kind, location, organizer, reminders,
sequence, start, status, summary, updated
```

### `start`/`end` — el campo que estaba `[ASSUMED_PENDING_VERIFY]`

```json
{"dateTime": "2026-08-13T08:30:00-03:00", "timeZone": "America/Argentina/Cordoba"}
```

**Confirma la asunción que ya estaba implementada**: `mi_dia_web.py::_eventos_de()` pasa el objeto
`start` crudo sin tocar como `inicio` — coincide exactamente con este shape real (`dateTime` ISO con
offset + `timeZone` IANA). **Sin cambios de código necesarios en el endpoint ya mergeado (PR #383).**
El `[ASSUMED_PENDING_VERIFY]` del contrato queda levantado: la forma es final, verificada.

### Recurrencias — sigue sin verificar con datos reales, y es una decisión consciente

Ninguno de los 3 eventos reales tenía `recurrence`/`recurringEventId`, así que la rama del spike que
crea un evento sintético con `RRULE` no se disparó (sólo corre si el tenant está vacío). **No se
forzó** creando uno a mano: el tenant ahora tiene el calendario PERSONAL real del operador conectado
— a diferencia del tenant "limpio" original, escribir ahí ya no es un sintético inocuo, es una entrada
real en su agenda. No vale la intrusión para cerrar un punto que, en la práctica, no bloquea nada: el
endpoint pasa `start`/`end` crudo sea cual sea el origen del evento, con o sin `recurringEventId` —
si algún día se necesita EXPANDIR recurrencias del lado del cliente (fuera del alcance de CAL1 v1,
que es sólo lectura de hoy), ahí sí hace falta un evento recurrente real para verificarlo.

**Veredicto final: 🟢 CAL1 §1 cerrado.** Shape de datos confirmado con evidencia real, sin deuda
bloqueante. DoD del contrato (spike con evidencia real) puede tildarse.
