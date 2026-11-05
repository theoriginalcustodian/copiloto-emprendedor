# DECISIONES-OPERADOR — lo que NO se decidió sin vos (ronda 2026-11-04/05)

> Cada fila: qué se encontró, por qué no se tocó solo, la recomendación y el costo de no decidir.
> Todo lo táctico ya se ejecutó y está en `BITACORA.md` con rollback. Acá sólo queda lo MAYOR.

| # | Decisión | Hallazgo / evidencia | Recomendación | Si no se decide |
|---|---|---|---|---|
| SEC-D1 · caso mixto: la migración es la oportunidad de provisionar limpio, pero NO trae el off-site puesto | **Copia off-site de backups** (hoy sólo local, `/var/backups/uc`, 7 d) | SEC-C10-1; la caída del VPS se lleva datos y backups juntos | Hetzner Storage Box o bucket S3-compatible con cifrado `age`; requiere que cargues la credencial (no se pega en chat) | RPO real = "lo que sobreviva al disco del VPS" |
| SEC-D2 · **DIFERIDO** (disparador: migración post-beta a 4 VPS dedicados — app, Postgres, Graphity, Temporal) | **TLS y `log_connections` en el Postgres de fusion** (10.0.0.3) | SEC-A2-1; servidor compartido fuera del alcance concedido | Activar `ssl=on` con cert propio + `sslmode=require` en `DATABASE_URL`; ventana de reinicio acordada con quien use fusion | Tráfico DB sin cifrar en red privada Hetzner (riesgo bajo-medio) |
| SEC-D3 | **Registro abierto en GoTrue** (`DISABLE_SIGNUP=false`), sin MFA ni rate-limit explícitos | SEC-A3-1 | Mantener abierto mientras haya beta pública; agregar rate-limit de GoTrue y ofrecer MFA al admin | Cualquiera puede crear cuenta (consume cuota, no accede a datos ajenos: RLS) |
| SEC-D4 | **Hosts sslip.io**: `mp.*` (0 requests/14 d) y `copiloto.*` (`GOTRUE_SITE_URL`) | HALLAZGOS "Decisiones" | Ya decidido: conservar ambos. Retirar `mp.*` cuando MercadoPago tenga dominio propio | — |
| SEC-D5 | **Token de 60fps.design** en la historia pública (24 d expuesto) | SEC-C6-1 | Ya aceptado por vos. Regla `uc-bearer-token-literal` en `.gitleaks.toml` evita reincidencia | Riesgo aceptado |
| SEC-D6 · **DIFERIDO** (disparador: migración post-beta a 4 VPS dedicados) | **Servicios corren como `root`** (sandbox aplicado, pero no usuario dedicado) | SEC-A1-3 (9.6 → 3.9) | Crear usuario `uc-copiloto` y mover `/root/.composio` — toca la integración Composio; ficha propia, con smoke | Un RCE en el proceso obtiene uid 0 dentro del sandbox (sin capabilities) |
| SEC-D7 · **DIFERIDO** (disparador: migración post-beta, junto con SEC-D6) | **`ProtectHome` no aplicado** | rompe Composio (`/root/.composio`), smoke 35/8 | Se resuelve con SEC-D6 | — |
| SEC-D8 | **RESUELTO (2026-11-05, #1696 @4f34c5ba, desplegado).** Decisión del operador: borrar todo salvo comprobantes AFIP (retención fiscal), auditoría (append-only) y metering (conteos), que quedan seudonimizados al borrar `tenants` + usuario GoTrue; lo dispara el usuario (`DELETE /cuenta`, confirmación exacta) o el operador (`POST /admin/tenants/{id}/borrar`, claim admin, auditado); backups: retención medida de 7 días (`uc-backup-local.sh`, `UC_BACKUP_RETENCION_DIAS=7`), menor que los 30 aprobados | SEC-C8-1 (ISO 27701 7.3) | Cerrado: `TenantErasureWorkflow` durable (suspender → schedules → Composio → Graphity → Postgres → GoTrue → recibo) + `GET /cuenta/exportar`. Evidencia: `evidencia/2026-11-05-f4/sec-d8-e2e-prod.json` (E2E en producción con tenant descartable) | **Residual:** la supresión en backups se completa cuando rota el último pg_dump que contenga al tenant (≤7 días, medido en `deploy/hardening/uc-backup-local.sh:9,22`; con off-site futuro —SEC-D1— habrá que fijar la misma retención allí) · MercadoPago no revoca el token upstream · borrado de comprobantes AFIP excluido por obligación fiscal |
| SEC-D9 | **Apps inactivas: REVOCAR primero, borrar después.** Medido 2026-11-05 (HTTP 200 = token VIVO, valores no impresos): Telegram bots de clinic-agent, hitl-listener, deepseek-worker y wa-sender → 200 · Groq (clinic-agent y copiloto) → 200 · OpenRouter (deepseek-worker, wa-sender) → 200 · OpenAI (documed y copiloto) → 200. No validados (sin endpoint inocuo): MP spike, Evolution, Speechmatics, credenciales GCP | SEC-A4-1 | Revocar en cada proveedor las claves de apps retiradas (no la de copiloto.env, que está en uso), recién entonces borrar el `.env`; confirmar que cada app está realmente retirada | 6 archivos con tokens vivos de terceros en disco, en un host con una sola llave de acceso |
| SEC-D10 | **MEDIDO, ya no es decisión.** `copiloto_consola` y `copiloto_autosanacion` (LOGIN, no superuser, sin membresías, 0 conexiones activas): autosanación escribe SOLO `copiloto_traumas`; consola es SELECT-only sobre 7 tablas (auditoria, feedback, mensajes, metering, tickets, traumas, tenants) de las 82 con `cliente_id` | SEC-A2-2 | Cerrado como acotado. **Residual a decidir:** `copiloto_mensajes` deja a la consola leer conversaciones de TODOS los tenants (por diseño); confirmar que es el alcance deseado y reflejarlo en el aviso de privacidad (G9) | Lectura cross-tenant de contenido de chat por la consola del operador |
| SEC-D11 | **`decode-uri-component` / `expo-router` y bumps npm dev** | SEC-B1-3 | PR de bump de expo-router en rama de mobile (MAYOR, cambia el nativo → rebuild) | CVE transitivo en tooling de build, no en runtime |
| SEC-D12 | **Escaneo externo con nmap** inválido desde la PC | HALLAZGOS 2026-11-05 | Repetir desde otra red cuando convenga | Cierre externo probado sólo por TCP connect |


## Qué NO resuelve la migración a 4 VPS (clasificado por capa, no por la frase)
SEC-D8 (borrado/exportación por tenant) es código de aplicación · SEC-D3 (signup/MFA) es config de GoTrue · SEC-D11 (expo-router) es mobile · SEC-D10 viaja con la base (los roles se migran con ella) · SEC-D9 (tokens de apps inactivas) sigue válido en cada proveedor pase lo que pase con el VPS.

## SEC-D9 — lista de revocación lista para ejecutar (SIN valores; la ejecuta el operador, nada se revocó)
> Revocar es hacia afuera e irreversible y puede tumbar apps vivas de otros proyectos. Vigencia medida el 2026-11-05 por código HTTP (200 = viva).

| Proveedor | Variable | Archivo en `/etc/unreal-copilot/` | App que la usa | Vigencia | Qué se rompe al revocar |
|---|---|---|---|---|---|
| Telegram | `TELEGRAM_BOT_TOKEN` | `clinic-agent.env` | clinic-agent | viva | el bot del clinic-agent deja de recibir/enviar |
| Telegram | `HITL_BOT_TOKEN` | `hitl-listener.env` y `deepseek-worker.env` (¿mismo bot? comparar con @BotFather) | hitl-listener, deepseek-worker | viva | las aprobaciones HITL por Telegram de esas apps |
| Telegram | `WA_SENDER_BOT_TOKEN` | `wa-sender.env` | wa-sender | viva | el bot de revisión de wa-sender |
| Groq | `GROQ_API_KEY` | `clinic-agent.env` | clinic-agent | viva | transcripción/LLM de clinic-agent |
| Groq | `GROQ_API_KEY` | `copiloto.env` | **copiloto (EN USO)** | viva | **no revocar sin reemplazo: rompe el dictado de /chat/audio** |
| OpenRouter | `OPENROUTER_API_KEY` | `deepseek-worker.env`, `wa-sender.env` | deepseek-worker, wa-sender | viva | LLM de esas dos apps |
| OpenAI | `OPENAI_API_KEY` | `documed.env` | documed | viva | LLM de documed |
| OpenAI | `OPENAI_API_KEY` | `copiloto.env` | **copiloto (EN USO)** | viva | **no revocar sin reemplazo** |
| MercadoPago | `MP_ACCESS_TOKEN` / `MP_CLIENT_SECRET` | `mp-spike.env` | spike de MP | **vigencia NO medida** (no hay endpoint inocuo; no se inventó uno) | el spike de MP |
| Evolution API | `EVOLUTION_API_KEY` | `wa-sender.env`, `deepseek-worker.env` | wa-sender, deepseek-worker | **vigencia NO medida** (la instancia es local, `127.0.0.1:8085`) | envío de WhatsApp de esas apps |
| Speechmatics | `SPEECHMATICS_API_KEY` | `documed.env` | documed | **vigencia NO medida** (sin endpoint inocuo) | transcripción de documed |
| Google Cloud | credenciales GCP (`DOCUMED_GCP_CREDENTIALS_PATH`) | `documed.env` | documed | **vigencia NO medida** | procesador de layout de documed |
Orden recomendado: confirmar que cada app está retirada → revocar en el proveedor → recién entonces borrar el `.env`. Las dos filas «EN USO» de `copiloto.env` quedan fuera de esta limpieza.
