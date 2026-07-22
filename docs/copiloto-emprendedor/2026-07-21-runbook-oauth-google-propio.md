# Runbook — cliente OAuth propio de Google para el Copiloto

> **Para:** el operador (los pasos 1-5 son en la consola de Google, no los puede hacer el agente).
> **Fecha:** 2026-07-21 · **Estado:** listo para ejecutar.
> **Por qué existe:** hoy las apps de Google se conectan con la app OAuth **de Composio**, no con la
> nuestra. Por eso "Conectar" lleva a una pantalla de Composio en vez de a Google, y por eso los
> permisos que se piden son los que ellos eligieron: **acceso total al correo y a todo el Drive**.

---

## 0. Lo que se decidió, y por qué importa antes de tocar nada

Google clasifica los permisos en tres niveles, y **el nivel decide el trámite**:

| Nivel | Qué exige para publicar |
|---|---|
| **No sensible** | nada |
| **Sensible** | verificación estándar (formulario + video, semanas) |
| **Restringido** | verificación **+ auditoría de seguridad por un tercero pago** |

El default de Composio cae en el nivel caro: `https://mail.google.com/` (leer, enviar y **borrar**
todo el correo) y `https://www.googleapis.com/auth/drive` (todo el Drive) son **restringidos**.

**Decisión del operador (2026-07-21): ningún permiso restringido.** El copiloto envía mails pero no
los lee, y en Drive trabaja sólo con los archivos que él mismo crea. Leer el correo se evalúa más
adelante, cuando haya producto andando y usuarios que lo pidan.

*Verificado contra la documentación oficial de Google, no de memoria:* `gmail.send` es sensible
mientras `mail.google.com/`, `gmail.readonly` y `gmail.modify` son restringidos; `drive` y
`drive.readonly` son restringidos mientras **`drive.file` es no sensible** — y `drive.file` es
aceptado también por las APIs de Docs y Sheets.

---

## 1. Proyecto en Google Cloud

1. Entrá a <https://console.cloud.google.com/> con la cuenta que va a ser **dueña de la app**
   (conviene una cuenta de la empresa, no personal: la app queda atada a ella).
2. Barra superior → selector de proyecto → **Nuevo proyecto**.
3. Nombre: `copiloto-emprendedor`. Crear.
4. **Verificá que quedó seleccionado ese proyecto** antes de seguir — el error más común es
   configurar todo en el proyecto equivocado y no entender por qué no aparece.

## 2. Habilitar las 5 APIs

**APIs y servicios → Biblioteca**, y habilitá una por una:

- Gmail API
- Google Drive API
- Google Docs API
- Google Sheets API
- Google Calendar API

Sin esto el consentimiento funciona pero las llamadas fallan con `403 accessNotConfigured` — y el
error aparece recién al usar la tool, no al conectar.

## 3. Pantalla de consentimiento

**APIs y servicios → Pantalla de consentimiento de OAuth**:

- Tipo de usuario: **Externo** (Interno sólo existe con Google Workspace y limita a tu propio dominio).
- Nombre de la app: **Copiloto del Emprendedor** ← esto es lo que el emprendedor va a leer al conectar.
- Correo de asistencia y de contacto: los tuyos.
- Logo: opcional ahora, **obligatorio para verificar** después.
- Dominio autorizado: `duckdns.org` (el del sitio actual).
- Guardar. Queda en estado **Testing**, que es lo que queremos por ahora.

⚠️ **Lo que hay que saber de "Testing"** (verificado en la documentación de Google): los permisos
otorgados **caducan a los 7 días**. Cada usuario de prueba tiene que reconectar sus apps una vez por
semana. Es tolerable en desarrollo, pero **cuando algo "se desconecte solo" no busques el bug acá.**

## 4. Los permisos (scopes) — la parte que hay que copiar exacto

**Pantalla de consentimiento → Acceso a datos → Agregar o quitar permisos → "Agregar manualmente"**,
y pegá esta lista completa:

```
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/calendar.events
```

Qué habilita cada uno y en qué nivel cae:

| Permiso | Para qué | Nivel |
|---|---|---|
| `userinfo.email` / `.profile` | identificar de quién es la cuenta conectada | no sensible |
| `gmail.send` | **enviar** mails en su nombre (no leer) | sensible |
| `drive.file` | crear y editar **sólo los archivos del copiloto** | **no sensible** |
| `documents` | leer y escribir sus Google Docs | sensible |
| `spreadsheets` | leer y escribir sus planillas | sensible |
| `calendar.events` | crear, buscar y borrar turnos | sensible |

**Ninguno es restringido → no hay auditoría paga.**

*Por qué `documents` y `spreadsheets` sí y `drive` no:* los tres primeros son sensibles y no cambian
el tipo de trámite (ya hay sensibles por Gmail y Calendar), pero permiten que el copiloto trabaje con
documentos que el emprendedor **ya tiene**. `drive` completo, en cambio, salta al nivel caro sin
agregar nada que necesitemos: los archivos los crea el copiloto, y para eso alcanza `drive.file`.

⛔ **No agregues** `https://mail.google.com/`, `gmail.readonly`, `gmail.modify`, `drive` ni
`drive.readonly`. Cualquiera de esos manda la app a auditoría externa.

## 5. Crear las credenciales

**APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:

- Tipo de aplicación: **Aplicación web** (aunque el cliente sea una app móvil: el intercambio del
  token lo hace el servidor de Composio, no el teléfono).
- Nombre: `composio-copiloto`.
- **URI de redireccionamiento autorizado** — exactamente esto, sin barra final:

```
https://backend.composio.dev/api/v1/auth-apps/add
```

*Este dato no es adivinable y no admite aproximaciones: si no coincide carácter por carácter, Google
rechaza el consentimiento con `redirect_uri_mismatch`. Sale de la propia API de Composio, que lo
declara como default de los cinco toolkits.*

- Crear → Google muestra **Client ID** y **Client Secret**.

## 6. Cargar las credenciales en Composio — sin que el secret pase por el chat

🔴 **No me pegues el Client Secret en la conversación.** Un secreto pegado en el chat se considera
comprometido y habría que rotarlo. Dos caminos, elegí uno:

**(a) Dashboard de Composio — recomendado, es una sola vez.**
En <https://app.composio.dev/> → *Auth Configs* → por cada toolkit (`gmail`, `googledrive`,
`googledocs`, `googlesheets`, `googlecalendar`) creá una config **custom** ("Use your own OAuth app"),
pegá Client ID y Secret, y en *Scopes* poné **sólo los de ese toolkit**:

| Toolkit | Scopes de esa config |
|---|---|
| `gmail` | `userinfo.email`, `userinfo.profile`, `gmail.send` |
| `googledrive` | `userinfo.email`, `drive.file` |
| `googledocs` | `userinfo.email`, `drive.file`, `documents` |
| `googlesheets` | `userinfo.email`, `drive.file`, `spreadsheets` |
| `googlecalendar` | `userinfo.email`, `calendar.events` |

**(b) Por script.** Si preferís, escribís las credenciales en un archivo del VPS
(`/root/.google-oauth.env`, sólo lectura para root) y corro `scripts/composio_auth_configs.py`, que es
idempotente y crea las cinco configs.

Avisame cuál elegís. En los dos casos, **el secret nunca pasa por acá**.

---

## 7. Lo que hago yo después (no lo hagas vos)

1. **Arreglar la elección de auth config.** Hoy el gateway toma *la primera* config del toolkit
   (`composio_gateway.py:_auth_config_id`). Con la nuestra y la de Composio conviviendo, elegiría una
   de las dos sin criterio. Hay que preferir explícitamente la propia.
2. **Cambiar el modo de conexión.** Con una config gestionada por Composio, `initiate` está retirado y
   sólo queda su link hospedado (el que lleva al dashboard). Con config propia vuelve a estar
   disponible y el usuario debería ir directo al consentimiento de Google.
   `[ASSUMED_PENDING_VERIFY]` — es lo que el mensaje de error de Composio implica por contraste, y
   `telegram` (la única config no gestionada de la cuenta) prueba que el tipo existe; pero no se puede
   confirmar hasta que existan las credenciales.
3. **Spike de verificación con credenciales reales**, y es el paso que no se saltea: conectar una
   cuenta y **ejecutar una tool de cada toolkit**. Recortar permisos es lo correcto, pero si alguno
   quedó corto la tool falla en runtime con `insufficientPermissions`, no al conectar. Hay que verlo
   fallar o funcionar, no suponerlo.
4. **Migrar las conexiones existentes.** Las cuentas ya conectadas siguen atadas a la config vieja:
   hay que reconectarlas. Son las de prueba, así que el costo es nulo — pero si no se hace, conviven
   dos mundos y el diagnóstico se vuelve confuso.

## 8. Lo que queda para después de publicar

- **Verificación estándar** ante Google (formulario, video del flujo, logo, política de privacidad
  publicada). Recién cuando vayamos a abrir a usuarios reales: hasta entonces, Testing alcanza.
- **Play Store es un trámite aparte** y no depende de esto. Ahí lo que suele pinchar es el cobro
  (Google exige su facturación para bienes digitales — MercadoPago dentro de la app puede chocar) y el
  permiso de micrófono del dictado. `[PENDIENTE VERIFICAR]` — no está medido, se anota para que no
  aparezca de sorpresa.
