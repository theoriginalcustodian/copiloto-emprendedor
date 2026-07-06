---
name: canal-whatsapp-hermes
description: "Canal WhatsApp del operador (Evolution API + Baileys) en el VPS: bot Telegram dedicado wa-sender ENVÍA (gate por botones), REVISA conversaciones (resumen gpt-4o-mini, ventana 30/deep 150) y LISTA chats recientes. Gotchas caros de Baileys, findMessages/findChats (@lid irresoluble), vinculación y sesiones paralelas."
metadata:
  node_type: memory
  type: project
  originSessionId: 22f9be26-6dc0-477b-b7b3-0d6b7afc3ac6
---

# Canal WhatsApp de Hermes — OPERATIVO (2026-06-18)

Evolution API (Baileys) le da a [[plataforma-agentica-estado|Hermes]] un canal de **salida por WhatsApp**: enviar mensajes **con el número del operador** (`5493413819100`). Telegram sigue siendo el control bidireccional operador↔Hermes; WhatsApp es solo salida hacia terceros. Lo montó a mano una sesión paralela (Antigravity); esta sesión lo **vinculó, saneó y versionó como IaC**.

## Estado
- **Instancia `HermesWP` vinculada**: `connectionStatus: open`, `ownerJid: 5493413819100@s.whatsapp.net`. Envío E2E validado (`sendText` → llegó al teléfono).
- **Infra (VPS, loopback-only)**: `evolution-api:v2.3.7` (`127.0.0.1:8085`) + `postgres:15-alpine` + `redis:7-alpine`, red docker `evolution-net`, en `/root/evolution-api/` (compose + `.env` modo 600). **Manager web omitido** (su `latest` crashea por bug nginx; no hace falta).
- **IaC versionado**: `deploy/evolution/` (compose pinned sin manager, `.env.evolution.template`, `qr_live.py`, README con gotchas). El residuo `evolution-api-setup/` quedó gitignoreado. PRs **#19** (vault) + **#20** (IaC), mergeados.

## Gotchas caros (NO re-aprender)
1. **`CONFIG_SESSION_PHONE_VERSION` DEBE fijarse** (`2.3000.1027934701`). Vacía → Evolution auto-fetchea (`fetchLatestWaWebVersion`) la última WAWeb del server, que el Baileys bundled (`7.0.0-rc.9` en v2.3.7) NO parsea → **`Invalid buffer`** en `processNotification` → **ni QR ni pairing conectan**. Síntoma: el teléfono escanea/tipea y "No se pudo vincular". El valor fijado = versión canónica del Baileys bundled.
2. **Pairing code NO sirve**: el socket lo **rota cada ~20s** junto con el QR → carrera de tipeo imposible (siempre "código incorrecto" aunque no haya `Invalid buffer`). **Vincular por QR EN VIVO** con `qr_live.py` (sirve el QR auto-refrescado en `127.0.0.1:9000`; la apikey NUNCA sale del VPS, el server hace el `connect` server-side).
3. **Acceso al QR desde la PC sin túnel**: el **proxy de code-server** `https://<host>.sslip.io/proxy/9000/` (el `fetch` del front debe ser path **relativo** + handler tolerante al prefijo `/proxy/9000/`). Alternativa: `ssh -L 9000:localhost:9000`.
4. **Baileys es no oficial → riesgo de ban** del número (personal del operador; uso no masivo asumido). Para volumen: número dedicado o WhatsApp Cloud API.
5. **Rotar SIN perder la sesión vinculada**: token de instancia = `UPDATE "Instance" SET token='...' WHERE name='HermesWP'` en la DB (NO recrear la instancia). postgres pass = `ALTER USER evolution PASSWORD` + URI en `.env` + recreate evolution-api. apikey global = `.env` + recreate. El recreate del contenedor preserva la sesión (vive en postgres + volumen).

## Lección de sesiones paralelas (caro, recurrente)
- Los secretos iniciales eran débiles (`AntigravityHermesMasterKey2026`, `HermesWPToken2026`, `EvolutionStrongPass2026!`); `payload.json`+`docker-compose.yml` llegaron a `main` vía el **Obsidian Git anidado**: el vault del operador estaba dentro del repo y el plugin auto-pusheaba TODO el working dir a `main` cada 5 min. → vault separado a `../obsidian-vault` (repo propio).
- Los 3 secretos se rotaron con CSPRNG. **Re-leak inmediato**: otra sesión del operador (Antigravity en code-server) leyó el `.env` recién rotado y **re-hardcodeó la apikey nueva** en un script (`export_contacts.py`) minutos después → hubo que re-rotar + parametrizar el script (leer de `os.environ`).
- **Regla operativa**: sobre este VPS, **una sola sesión dueña del estado** a la vez; los secretos se **leen del `.env`, nunca se hardcodean** en scripts.

## SendWhatsAppWorkflow — OPERATIVO (2026-06-18, PR #21 MERGEADO a `main`, squash `ad20f12`)

Hermes puede enviar WhatsApp dirigido en lenguaje natural, con gate HITL **signal-based canónico de Temporal** (`@workflow.signal confirm` + `wait_condition` + timeout durable; reject/timeout NO envían). Validado E2E en prod (approve → envío real confirmado por el operador). 21 tests passing en el VPS. Construido spike-first + subagent-driven + **review adversarial de rama** (Workflow 4 lentes).

- **Piezas:** `deploy/mcp/contacts.py` (matching E.164 + escalado, stdlib) · `deploy/mcp/evolution_client.py` (I/O Evolution, urllib) · `shared/whatsapp_workflow.py` (workflow durable, determinista) · `deploy/mcp/temporal_mcp.py` (tools `resolve_contact`/`send_whatsapp`/`confirm_send`) · `deploy/hermes/whatsapp_tools.prompt.md` (skill) · `deploy/whatsapp/deploy.sh` (deploy idempotente) + `e2e_check.py`.
- **Topología de deploy (el repo NO está clonado en el VPS, sync manual):** worker en `/opt/unreal-copilot/**` (systemd `unreal-copilot-deepseek-worker`, venv `/opt/uc-worker-venv`, **2da task-queue `whatsapp`** en el mismo proceso que la vía DeepSeek) · MCP en `/opt/agentic/mcp/**` (systemd `temporal-mcp`, venv `/opt/agentic/mcp/.venv`, fastmcp **3.4.2** + temporalio 1.28.0). `EVOLUTION_API_KEY` inyectada (de `/root/evolution-api/.env`) en el env del worker (`/etc/unreal-copilot/deepseek-worker.env`) **y** del MCP (`/etc/agentic/mcp.env` vía drop-in). Skill en `/root/.hermes/skills/unreal-copilot/whatsapp-gate/SKILL.md` (sin restart).
- **Gotchas/lecciones caras (NO re-aprender):**
  - **fastmcp 3.4.2: `@mcp.tool` devuelve la función ORIGINAL** (sin `.fn`). Las tools async se invocan directo + `asyncio.run`. El test con `.fn` falla.
  - **wf_id por hash de contenido (`number|text`) es MAL id de unicidad para mensajería** (bloquea reenviar el mismo texto: WorkflowAlreadyStartedError) → `uuid` por intento salvo `idempotency_key` explícito + `ALLOW_DUPLICATE`. El E2E con wf_ids únicos lo ENMASCARÓ; lo cazó el review adversarial.
  - **`match_contacts` debe ser TOKEN-AWARE** (PR #22): la rama `name in q` (substring crudo) daba 0.9 espurio a nombres cortos Y a substrings intra-palabra ("Aldi" matcheaba "juan bar**aldi**"; "Juan" genérico matcheaba todo). Fix: 0.9 solo si TODOS los tokens de la query son prefijo de algún token del nombre (`"juan baraldi"` exige `juan` Y `baraldi`); `q in name`=0.95; fuzzy≥0.6 fallback. Validado contra agenda real (1733 contactos). El `len(name)>=4` NO alcanzaba.
  - **Cache corto (30s) de la agenda en `resolve_contact`** (PR #22): Hermes dispara varias `resolve_contact` seguidas; sin cache cada una re-baja ~1700 contactos → satura Evolution = "servicio inaccesible" intermitente.
  - **`confirm_send` debe capturar `Exception` amplio** (no solo TimeoutError): Evolution caído → workflow FAILED → `handle.result()` lanza → mapear a `status:"failed"`.
  - Tests con temporalio/fastmcp corren SOLO en los venvs del VPS (replicar la estructura `deploy/worker/tests` para el `parents[3]/shared`).

## ⚠️ DOS Hermes en el VPS — gotcha operativo (caro de diagnosticar, 2026-06-18)

Hay **dos instalaciones de Hermes** que **comparten la misma config** (`/root/.hermes/config.yaml`, montado en el contenedor como `/opt/data`) → **compiten por el MISMO bot de Telegram**:
1. **Contenedor `hermes`** (`/opt/hermes/`, imagen Nous, no-root) — **el CANÓNICO**, donde están la skill `whatsapp-gate` y las tools. Gateway = pid del s6 `hermes gateway run`.
2. **Host install** (`/usr/local/lib/hermes-agent/`) — servicio `systemd --user` **`hermes-gateway.service`** con **linger=yes** (corre sin login + respawnea al matar el PID).

**Síntoma del conflicto:** Hermes responde "no tengo acceso a WhatsApp" / toolset stale / logs con `Telegram polling conflict — previous session still held open`. Significa que hay **2 gateways sobre el bot**; el viejo (stale, arrancó antes del deploy de las tools) gana el polling y responde mal.

**Diagnóstico (NO confiar en el self-report del LLM, que alucina su lista de tools):**
- `docker exec hermes hermes mcp test temporal` → ground truth: debe decir `Connected` + `8 tools` con `send_whatsapp`.
- `ps -eo etime,cmd | grep "gateway run"` → debe quedar SOLO `/opt/hermes/...` (contenedor). Si aparece `/usr/local/lib/hermes-agent/...` = intruso.
- Parar el intruso: `systemctl --user stop hermes-gateway.service` (matar el PID NO alcanza, respawnea).

**El comando `hermes` de la terminal apuntaba al HOST, no al contenedor.** `/usr/local/bin/hermes` era un wrapper que ejecutaba `/usr/local/lib/hermes-agent/venv/bin/hermes`. **Reescrito** (backup en `/usr/local/bin/hermes.host.bak`) a:
```bash
if [ -t 0 ] && [ -t 1 ]; then FLAGS="-it"; else FLAGS="-i"; fi
exec docker exec $FLAGS hermes hermes "$@"
```
→ ahora `hermes` en la terminal corre EN el contenedor. El host install queda instalado pero sin ejecutarse (servicio parado + wrapper desviado). El keepalive `Session termination failed: 404` del cliente MCP de Hermes es **ruido benigno preexistente** (desde 2026-06-16), NO impide que las tools funcionen.

## ✅ RESUELTO: HITL WhatsApp con gate por BOTONES (bot dedicado, no Hermes) — 2026-06-18

Tras probar TODO el control por prompt/skill/clarify en Hermes (falla: gpt-4o-mini auto-confirma o no llama clarify; y la aprobación nativa de Hermes es solo para comandos de shell peligrosos, hardcodeada), la arquitectura ganadora: **el LLM entiende, el BOTÓN decide.**

**Servicio `wa-sender`** (`deploy/wa-sender/`, systemd `unreal-copilot-wa-sender`, worker venv): un **bot de Telegram DEDICADO** (`bot_botones_whatsapp_hermes_bot`, token en `/etc/unreal-copilot/wa-sender.env` gitignored) — **separado de Hermes**. Flujo, todo en UN chat:
1. Operador escribe natural ("mandale a Juan un feliz cumple") → **`parse_request` (gpt-4o-mini vía OpenRouter, `response_format json_object`)** extrae `{recipient, text}`. SOLO para entender — el LLM nunca decide enviar. Si no hay key/falla → cae al flujo guiado (¿a quién?→¿texto?).
2. Resuelve con `contacts.match_contacts` (reusa el matcher token-aware) + `evolution_client` (reusa). Varios candidatos → botones para elegir.
3. **Preview + botones [✅ Enviar][❌ Cancelar]** (inline keyboard de Telegram).
4. **El clic lo maneja el servicio (código determinista)** → arranca `SendWhatsAppWorkflow` (`require_confirmation=False`: el gate ya fue el botón) → `send_text` durable → llega. Cancelar → reescribís ahí mismo.

**Validado E2E en prod** (operador, 2026-06-18): frase natural desprolija → preview → clic Enviar → `wa-240f39da` COMPLETED → llegó. "Va bastante bien y mucho más rápido" (sin la cadena de Hermes). **Imposible auto-confirmar** (el gate es el botón, no el LLM). Round-trip botón→callback validado spike-first.

- **Por qué NO se pudo en el chat de Hermes:** el callback de un botón va a quien controla el bot (gateway de Hermes); para gatear sin LLM habría que modificar el core de Hermes (frágil, contenedor de imagen). El bot dedicado lo controlamos 100%.
- **Por qué NO reusar el agente Vercel/otro VPS para el parse:** matar mosca a cañonazos — el parse es 1 llamada `chat/completions`, autocontenida, sin dependencia cross-VPS.
- **Componentes:** `deploy/wa-sender/{wa_sender.py, deploy.sh idempotente, unreal-copilot-wa-sender.service}` + reusa `contacts.py`/`evolution_client.py` (deployados al lado en `/opt/wa-sender/`). stdlib urllib para Telegram + OpenRouter; temporalio para el wf. **✅ MERGEADO a `main` vía PR #23 (merge commit `f701787`, 2026-06-19, rama borrada).** El PR trajo 10 commits: bot wa-sender (enviar/revisar/listar + fix secuestro + callback) **y además** los gates HITL de Hermes (clarify) + fixes MCP (require_confirmation no-bypasseable, matching token-aware) que estaban pendientes de `main`. Todo desplegado y validado E2E en el VPS.
- 🔐 **Pendiente:** el token del bot se pegó en el chat → **regenerar en @BotFather `/token`** (y actualizar el env). Está gitignored (no en repo).

## ✅ Capacidad REVISAR conversaciones (review) — 2026-06-18

El bot wa-sender también **lee y resume conversaciones de WhatsApp**: *«¿qué me dijo Juan?»*, *«resumime el chat con Pedro»*, `/revisar Juan`. Read-only (nunca envía → sin gate de botón). Validado E2E por el operador (resumen coherente de la charla con Juan Baraldi: trabajos, operación del padre, estudios de altura).

- **Flujo:** parse (gpt-4o-mini, action `review` + `recipient` + `question` + `deep`) → `resolve` contacto (varios → botones `rev:tok:i`) → `evolution_client.find_messages(jid, N)` → transcript "Yo/Nombre: …" → gpt-4o-mini responde. Reusa todo el matcher/cliente del envío.
- **Ventanas:** normal **30** mensajes (`WA_REVIEW_WINDOW`), **resumen largo 150** (`WA_REVIEW_DEEP`) cuando el parse detecta intención amplia (*«resumime TODA la conversación»*, *«resumen completo del historial»* → `deep=true`). Parametrizables en el env.
- **Privacidad (decisión consciente del operador):** el transcript de los últimos N mensajes **sale a gpt-4o-mini (OpenAI vía OpenRouter)**. El resto del historial nunca se toca. Evolution corre loopback en el VPS.

### Gotchas Evolution `findMessages` (V-RES 2026-06-18, NO re-aprender)
1. **Endpoint:** `POST /chat/findMessages/{instance}` con `{"where":{"key":{"remoteJid":"<num>@s.whatsapp.net"}}, "page":1, "offset":N}`. Respuesta: `{"messages":{"total","pages","currentPage","records":[…]}}`.
2. **El tamaño de página es `offset`, NO `limit`** (`limit` se IGNORA). Sin `offset` → default **50**. `offset` se respeta SIN cap (50→50, 150→150, 250→todos). Para "últimos N": `page:1, offset:N`.
3. **Records vienen DESC por `messageTimestamp`** (más reciente primero) → reordenar ASC en código para el LLM.
4. **Texto** en `message.conversation` o `message.extendedTextMessage.text`; media (`audioMessage`/`documentMessage`/…) sin texto → se saltea. **Dirección** = `key.fromMe` (true = el operador).
5. **History sync de Baileys:** Evolution NO guarda "solo desde la vinculación" — al vincular sincroniza historial. Juan Baraldi: **205 mensajes desde 08/06** (instancia vinculada 18/06). Hay más historial del esperado → relevante para privacidad y para el tamaño de la ventana.

### Gotcha del flujo guiado (fix raíz) + PENDING frágil
- **El modo guiado `recipient` SECUESTRABA el lenguaje natural:** una vez esperando un nombre, TODO lo que el operador escribía se trataba como contacto (nunca llegaba al parse LLM) → atascado en loop "No encontré… decime el nombre exacto". **Fix:** si lo escrito en `recipient` no resuelve a contacto, se sale del guiado y se RE-INTERPRETA como intención nueva. El fallback ya no trata el texto fallido como nombre ciego.
- **`PENDING` (tokens de botones) es in-memory → cada restart/deploy mata los botones pendientes** → el clic quedaba "colgado" en silencio. El callback ahora **avisa** "ese botón ya no está activo, reintentá" (en vez de silencio) y loguea `live=<count>` sin exponer los tokens (security review).

## ✅ Capacidad LISTAR conversaciones recientes (chats) — 2026-06-18

El bot lista los chats recientes SIN pedir un contacto: *«cuáles son mis últimas 10 conversaciones?»*, *«qué chats tengo»* o `/chats 10`. Acción `chats` del parse (con `count`), `evolution_client.find_chats(limit)`, `do_list_chats`. Read-only. Render: nombre (cruzado con la agenda) + preview del último mensaje; grupos marcados 👥; tope 25. Validado E2E.

### Gotchas Evolution `findChats` + límite `@lid` (V-RES 2026-06-18, NO re-aprender)
- **Endpoint:** `POST /chat/findChats/{instance}` con `{}` → **LISTA** (no `{records}`) de chats. Campos: `remoteJid`, `pushName`, `updatedAt` (ISO), `lastMessage.message` (misma forma que findMessages), `unreadCount`. **Ordenar por `updatedAt` DESC** en código (no garantizado). Incluye **grupos** (`@g.us`).
- **`@lid` (LinkedID, sistema de privacidad nuevo de WhatsApp) = IRRESOLUBLE:** esos chats vienen con `pushName=null` y **sin número**; el contacto en `findContacts` también está como `@lid` con `pushName=null`. NO hay forma desde Evolution de mapear `@lid`→número/nombre. Son contactos no guardados o con privacidad activada. **Fallback de presentación:** identificar por el **preview del último mensaje** (👤 «…»), nunca "Desconocido". El `lastMessage.pushName` NO sirve (es `"Você"` cuando el último msg es propio).
- **Resolución de nombre (orden):** agenda por número → `pushName` del chat → `📱 número` (sin guardar) → preview (`@lid`). `findContacts`: 1839 contactos (1682 `@s.whatsapp.net`, 63 `@lid`, 92 grupos, 2 newsletter).

## Próximo / deuda
- ✅ PR #21 mergeado a `main` (squash `ad20f12`), rama borrada.
- ✅ **HITL hardening HECHO (PR #22):** Hermes (Kimi K2) seteaba `require_confirmation=False` y salteaba el gate (verificado en Temporal: `wa-46efc159` COMPLETED req_confirm=False → envió sin preview). Fix: **`require_confirmation` SACADO de la tool `send_whatsapp`** — el workflow se arranca SIEMPRE con `True`. Gate estructural no-bypasseable. Schema final: `[number, text, idempotency_key]`. El workflow conserva el flag internamente (e2e/futuro). **Lección: un control de seguridad NUNCA debe ser un parámetro seteable por el LLM.**
- ⚠️ **Gotcha Hermes+Kimi K2 (tool-calls mal formados) → RESUELTO cambiando el modelo:** Kimi K2 producía los args del tool-call mal formados; el `agent.message_sanitization` de Hermes los **vaciaba** (`"query"="juan baraldi"`→`{}`) → la tool fallaba "Missing required argument" → tras 4 fallos Hermes marcaba el MCP "unreachable". NO era del MCP (por HTTP andaba perfecto). **Fix: se cambió el modelo de Hermes a `openai/gpt-4o-mini`** (`model.default` en `/root/.hermes/config.yaml`, backup `config.yaml.bak-pre-gpt4omini`). Con gpt-4o-mini los args llegan completos. **OJO: el cambio de modelo se hace en ESA config (la que lee el contenedor); un `hermes`/override de sesión NO persiste al gateway de Telegram.** Requiere `docker restart hermes`.
- ⚠️ **HITL gate por prompt NO es confiable (hallazgo caro) — pendiente: bot de confirmación dedicado.** Con gpt-4o-mini los envíos andan, PERO **Hermes auto-confirma** (llama `send_whatsapp`→`confirm_send` en el mismo turno, sin esperar al operador). Falló TODO el control por prompt: skill `whatsapp-gate` (enabled), descripción de la tool, y hasta el tool nativo **`clarify`** (botones inline + bloqueo del hilo — `tools/clarify_tool.py`) que la skill le ordena usar: gpt-4o-mini **no lo llama**. Hermes **no tiene gate nativo per-tool-MCP** (su `tools/approval.py` es solo para comandos de shell peligrosos). **Conclusión: HITL confiable NO puede depender del LLM.** Diseño pendiente (operador difirió 2026-06-18): **2º bot de Telegram dedicado + servicio de confirmación** que manda botones Sí/No y señaliza el workflow al clic, sacando a Hermes del loop de confirmación. El gate ESTRUCTURAL del workflow (espera signal `confirm`) ya existe y funciona; lo que falta es la fuente del signal independiente del LLM. PRs de los fixes: **#22** (matching token-aware + cache + require_confirmation sacado de la tool + skill clarify).
- Reconciliar el VPS al IaC limpio (pass del compose al `.env`, quitar manager) — opcional. Backup DR `backups/evolution-db-*.sql`.
