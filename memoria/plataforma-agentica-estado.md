---
name: plataforma-agentica-estado
description: "Plataforma agéntica 'Unreal Copilot' (fábrica de desarrollo autónomo) en el VPS unreal-copilot (ex arca-n8n). Estado real, accesos, configs y pendientes."
metadata:
  node_type: memory
  type: project
  originSessionId: 4d6a1ae4-a666-4949-a0f8-50562fb65826
---

# Plataforma Agéntica Soberana — estado (2026-06-15)

**Qué es:** VPS **`unreal-copilot`** (ex `arca-n8n-prod`; Hetzner id **133209712**, IP **178.105.191.1**, priv 10.10.0.20, CX33 8GB, Nuremberg) reconvertido en **fábrica de desarrollo autónomo soberana**, AISLADA de la prod fiscal ARCA. SSH desde la PC del operador: alias **`unreal-copilot`** (`~/.ssh/config` → root@178.105.191.1, key `~/.ssh/supabaseselfhosted-prod`).

**Nombre del proyecto: "Unreal Copilot"** (operador, 2026-06-15). **De-arca parcial HECHO (PR #25):** los desarrollos de este proyecto son agnósticos → se renombró el task-queue **`arca-agents` → `coding-agents`** (coordinado: kernel + MCP server + `.service` + MCP live reiniciado + Kaggle re-push **v11**; repo+live+Kaggle alineados) y el branding `arca-agentic → agentic` en código/docs agénticos. **VPS RENOMBRADO a `unreal-copilot`** (2026-06-15): Hetzner server name + hostname Linux + firewall (`unreal-copilot-fw`) + alias SSH (`unreal-copilot`). IP (178.105.191.1) e id (133209712) sin cambios. Refs a ARCA-fiscal = cross-ref factual (se quedan). El resto del repo (plataforma fiscal) NO se tocó. ⚠️ Antigravity Remote-SSH: reconectar al host `unreal-copilot` (el alias viejo `arca-agentic` ya no existe).

**4 piezas (boundaries claros):** **Temporal** (cluster aislado, ejecución durable) · **Hermes** (observabilidad y reporte: revisa y reporta estado/avances, **NUNCA toca** — decisión 2026-06-22, [[hermes-rol-observabilidad-reporte]]; el rol viejo "director" quedó superado) · **Claude Code** (gate senior + dev del operador) · **LLMs Kaggle** ([[kaggle-temporal-overlay-spike]], labor de inferencia + sandbox de ejecución no-confiable). Frontera de seguridad: **el VPS nunca ejecuta código de IA** (eso va a Kaggle).

## Estado: F0–F5 HECHO y en main. **Roundtrip Kaggle E2E VALIDADO (2026-06-16)**. Falta F6 (cerrar fábrica).

## ⚠️ UPDATE 2026-06-20 — estado SUPERADO en varios puntos; fuente de verdad VIVA = `docs/ROADMAP.md` (repo)
El F0–F5 de abajo sigue vigente, pero el "¿qué falta?" cambió mucho desde este snapshot (2026-06-15):
- **Vía DeepSeek + la casa (`FeatureWorkflow`) OPERATIVAS** → [[loop-deepseek-operativo]] · [[casa-fabrica-features-diseno]]. RunTests + gate Docker hardened = HECHO (cierra ADR-015 en la vía DeepSeek).
- **Durabilidad cross-corte VALIDADA E2E** (2026-06-19) → **ya NO es bloqueante**; corrige el "Task 1 bloqueante" / "supuesto raíz sin evidencia" de abajo → [[durabilidad-cross-corte-validada]].
- **SP4 cross-unit (`dep_files`) validado E2E** (2026-06-20): la fábrica construye features **multi-unidad** con deps reales → [[casa-fabrica-features-diseno]].
- **F6 NO se sigue task-by-task** — su intención está absorbida por SP4/SP5/SP6 + Hardening sobre la vía DeepSeek (reconciliación completa en `docs/ROADMAP.md`).
- **Pendiente operativo concreto:** `open_pr` E2E (PR real) bloqueado por **`gh` NO autenticado en el VPS** (repo de prueba `Repositorio-Prueba-Unreal-Coding-Copilot` creado/vacío) · 🔐 rotar OpenRouter key (3 lugares, ver Pendientes) · SP5 cascade · test de integración cross-unit REAL (`integrate` hardcodea `integration_passed=True`).

## ⚠️ UPDATE 2026-06-16 — Roundtrip Kaggle E2E CERRADO (la fábrica ya procesa tareas reales)
**El bloqueante que impedía el E2E con Kaggle era `autossh`, NO throttle.** El túnel autossh disparaba el anti-abuse de Kaggle → exit 137 ~30-40s tras abrir el túnel, durante el setup. Diagnóstico empírico: aislamiento sin túnel sobrevivió >223s + selftest OK; fix con ssh simple cerró el roundtrip. Detalle en [[kaggle-temporal-overlay-spike]].
- **FIX:** `agents_kernel.py` `_start_tunnel` autossh → **ssh simple** (PR **#2** en `unreal-copilot`, junto a spikes `kaggle/spike-diag/` + corrección del default permitopen del script `setup-ssh-tunnel-user.sh`). El reconnect se sacrifica a propósito; la durabilidad cross-corte la garantiza Temporal, no el túnel.
- **Notebook productivo `multiagent-coder-temporal` v14** = código arreglado (ssh simple). ⚠️ El push por API NO aplica GPU/Internet (UI-only) → al correr hay que activar **GPU T4×2 + Internet ON + Secret `VPS_SSH_KEY`** en la UI de Kaggle.
- **VALIDADO E2E:** `vps-prod-roundtrip-1` (CodeTaskWorkflow) encolado **desde el VPS** → worker productivo (ssh simple, 2×T4) → **COMPLETED**, código correcto devuelto. tok/s coder ~17-20 · reasoner ~13-17. Los 2 modelos cargan 1/GPU (~10 GB c/u, pinning UUID).
- **permitopen del VPS vivo estaba OK** (`127.0.0.1:7233`); el "drift al fiscal" era solo el DEFAULT del script (corregido). El bloqueante NUNCA fue ese.
- **Nuevos pendientes** (no bloqueantes): agendar el **scheduler nativo de Kaggle** (arranque diario L-V, único modo que lleva el Secret) para operación autónoma · **dataset de modelos** (GGUF Ollama en Kaggle Dataset) para saltear el pull ~2-5min/reload · mergear **PR #2**.

| Fase | Estado |
|---|---|
| F0 prep (rebuild OS docker-ce + cloud-init key + firewall `unreal-copilot-fw` + relabel) | ✅ |
| F1 Temporal aislado (`/opt/agentic/docker-compose.agentic.yml`: postgres16+auto-setup1.29+ui2.50+admin-tools, bind `127.0.0.1:7233`, ns `default`, tq **`coding-agents`**) | ✅ PR#21 |
| F2 workers Kaggle re-apuntados al Temporal nuevo (kernel `agents_kernel.py` → 178.105.191.1; user `kaggle-tunnel`) | ✅ PR#22 (infra) + **roundtrip E2E CERRADO 2026-06-16 (PR#2, fix autossh→ssh simple)** |
| F3 Hermes operativo | ✅ |
| F4 acceso web/dev | ✅ |
| F5 Hermes/Claude Code → Temporal vía MCP global | ✅ PR#23/#24 |

## ⚡ UPDATE 2026-06-17 — Vía DeepSeek (músculo pago ADITIVO) OPERATIVA
**Segunda vía de músculo en el VPS, coexiste con Kaggle ([[variante-deepseek-aditiva]]).** Loop mínimo validado E2E → detalle completo en **[[loop-deepseek-operativo]]**.
- **Worker systemd `unreal-copilot-deepseek-worker` ACTIVE** (venv `/opt/uc-worker-venv`, `temporalio==1.28.0`) en task-queue **`coding-agents-deepseek`** (separada de la de Kaggle `coding-agents`). Conecta a Temporal `localhost:7233` **SIN túnel** (el worker corre EN el VPS).
- `IterativeCodeWorkflow` extraído a `shared/loop_core.py` (agnóstico al provider, reusado) → `infer`→OpenRouter (flash/pro, urllib stdlib) + `run_tests`→**Docker efímero hardened** (cierra ADR-015; el VPS ejecuta IA SOLO en la jaula `--network none` etc. → invariante **bifurcado**: físico para Kaggle, lógico para DeepSeek).
- **E2E: `COMPLETED passed:true iters:1`** (auto-corrección real: flash falla→pro diagnostica→flash corrige→gate verde). Decisión "dónde corre el código DeepSeek" CERRADA (ADR-016 = worker VPS + Docker, NO sandbox Kaggle).
- Imagen `unreal-copilot-sandbox:1` (`python:3.12-slim`+pytest 8.3.4). Código en `/opt/unreal-copilot/` (sync tar/rsync). PRs #6-#10. Hardening diferido = spec §9.

### Hermes (F3) — ACTIVO: **GPT-4o-mini vía OpenRouter**
- Config `/root/.hermes/config.yaml`: provider `openrouter`, default `openai/gpt-4o-mini` (**cambiado desde `moonshotai/kimi-k2` el 2026-06-18**: Kimi formaba mal los args de los tool-calls MCP → el sanitizer de Hermes los vaciaba → la tool fallaba; gpt-4o-mini los forma completos — detalle en [[canal-whatsapp-hermes]]; backup `config.yaml.bak-pre-gpt4omini`), base_url `https://openrouter.ai/api/v1`, **`api_mode: "chat_completions"`**, key `OPENROUTER_API_KEY` (operador cargó $10 en OpenRouter; gpt-4o-mini es más barato que Kimi → más req por el saldo). Cambiar modelo = editar `model.default` + `docker restart hermes` (el override de sesión `hermes chat` NO persiste al gateway). Test: `hermes chat -q "..."` (NO `-z`, oneshot bugueado).
- **CONTAINERIZADO 2026-06-15:** Hermes v0.16.0 corre ahora en Docker (imagen oficial Nous `hermes-agent`, compose `/usr/local/lib/hermes-agent/docker-compose.yml`) — 2 containers `hermes` (gateway, `command: gateway run`) + `hermes-dashboard`, **no-root (UID 10000)**, `restart: unless-stopped`, monta SOLO `~/.hermes` (chowneado a 10000:10000), `network_mode: host` (alcanza el MCP local). Proceso bare-metal cerrado. Aislamiento real vs el root-suelto anterior. Cambiar modelo/config = editar `~/.hermes/config.yaml` + `docker restart hermes`. Backups: `config.yaml.{gpt4o-working,openrouter-working,pre-fix,bak}`. Keys en `~/.hermes/.env`. Decisión: **Claude Code NO se containeriza** (es herramienta del humano confiable, control-plane; necesita acceso a repos por diseño; containerizar lo autónomo/no-confiable=Hermes, no lo que opera el humano).
- **gpt-4o + OpenAI directa también anda** con `api_mode: chat_completions` (provider `openai-api`). Sin ese fix, Hermes usa la Responses API y manda `include` que gpt-4o rechaza (HTTP 400). gpt-4o NO requiere verificar org (eso es solo o-series).

### Acceso (F4)
- **code-server** v4.123 (`code-server@root`, `127.0.0.1:8088`, password en `/root/.config/code-server/config.yaml`, sin TLS propio). **Caddy** v2.11.4 reverse-proxy → URL pública **`https://178-105-191-1.sslip.io`** (cert real Let's Encrypt; firewall abrió 80/443). El panel Claude Code anda en el browser (cert válido). En móvil: instalar como PWA (cosmético).
- **Dashboard Hermes (2026-06-15):** expuesto en **`https://hermes.178-105-191-1.sslip.io`** vía Caddy con **basic_auth** (user `admin`, password en `/root/hermes-dashboard-credentials.txt` chmod 600 — NUNCA tocó el chat) + cert Let's Encrypt. El dashboard valida `Host` → Caddy lo reescribe con `header_up Host {upstream_hostport}` (sin eso devuelve 400). Backend en `127.0.0.1:9119`.
- **Claude Code**: en el VPS hay Node v22 + CLI `@anthropic-ai/claude-code` 2.1.178, **autenticado** (`.credentials.json`). El operador usa **Antigravity (desktop) + Remote-SSH `unreal-copilot`**. **Capa de criterio portada (2026-06-15):** `CLAUDE.md` + `HARNESS.md` + `STACK.md` + `parallel_sprint_methodology.md` + 6 `pattern_*.md` + 19 skills copiados a `/root/.claude/` (scp PC→VPS, solo markdown, cero secretos). Auth NO se copió (Claude Code ya estaba logueado en el VPS). **MCP en el VPS (verificado 2026-06-15):** en `~/.claude.json` solo está registrado **`temporal`** (user-scope); la flota del operador (Hetzner/Supabase/Kaggle/Graphity/Slack/n8n…) NO está — DIFERIDA por decisión (solo en SU Claude Code bajo supervisión, tras cerrar brecha: rotar secretos + ideal auth-MCP/sacar code-server de internet). Los **9 connectors `claude.ai`** (Canva/Figma/Gmail/Drive/Calendar/HuggingFace…) que aparecen en el panel vienen de la CUENTA de Claude (no de config local) → la mayoría en "Needs Auth" (autorizar OAuth por sesión); HuggingFace ya Connected. Que solo aparezca `temporal` es lo esperado, no un bug.
- Hardening: **fail2ban** activo (jail SSH).

### MCP Temporal global (F5) — el canal de control de la fábrica
- **Thin server propio** (FastMCP 3.4.2 + temporalio 1.28, venv `/opt/agentic/mcp/.venv`), `temporal-mcp.service` (systemd Restart=always, streamable-http **`127.0.0.1:8931`**), conecta a Temporal local. **Global/compartido**: registrado en Hermes (`~/.hermes/config.yaml`) Y Claude Code (`~/.claude.json` user) → mismo MCP, varios clientes.
- **5 tools:** `start_code_task` · `get_task_status` · `cancel_task` (graceful) · `terminate_task` (force) · `list_recent_tasks`. Fire-and-poll no-bloqueante, workflow_id determinista. E2E validado (Hermes llamó start; terminate validado). **Pausa NO** (no nativa en Temporal; necesitaría signal en CodeTaskWorkflow).
- Artefactos: `deploy/mcp/{temporal_mcp,smoke_mcp,verify_stop}.py + temporal-mcp.service` + ADR-013.

## Puertos VPS (loopback): 7233 Temporal · 8080 temporal-ui · 8088 code-server · 8931 MCP · 9119 dashboard Hermes. Público: 22, 80, 443, icmp. Caddy sirve 2 subdominios sslip.io: `178-105-191-1` (code-server, passthrough) y `hermes.178-105-191-1` (dashboard, +basic_auth +Host rewrite).

## Snapshots / DR
- **Respaldo `398046911`** ("post-hermes-container", 2026-06-15) — **status `available`, 5.78 GB** (disco 80 GB). Snapshot del estado actual completo (incluye secretos horneados; es backup tipo-A restaurable solo por el operador). Restore = `rebuild_server` con esa imagen → cero fricción (todo auto-arranca: Temporal/MCP/Caddy/code-server/Hermes-container, todos restart/enabled).
- Snapshots previos: `397832295` (POST-ADR-050 pre-reconversión n8n), `390811433` (base mayo).
- **Golden reutilizable (fase 2): PENDIENTE** — cuando F6 cierre. Requiere toolkit wipe+regen de secretos (el fiscal lo tiene en `scripts/golden/`, el agentic NO — portar/adaptar). NO clonar el respaldo tipo-A a otros boxes (lleva secretos vivos).

## Flujo operativo decidido (ADR-014, 2026-06-15) — cómo opera la fábrica
Análisis multi-agente (8 sub-agentes, ~780k tok: estado del arte + restricciones reales del código + failure-map + crítica adversarial 4 lentes). **Veredicto: la propuesta del operador (Hermes orquesta barato / Claude Code gate senior / Kaggle músculo) es arquitectónicamente correcta — coincide ~1:1 con CrewAI-hierarchical + cascade de costo del estado del arte. NO migrar a LangGraph/CrewAI/AutoGen (perderían la durabilidad cross-corte de Temporal = la ventaja diferencial).** El trabajo NO es agregar piezas: cerrar 3 huecos + instrumentar.
- **2 correcciones duras:** (1) el "Reviewer" actual es **cosmético** (lineal, no gatea) → verificación real = **RunTests ejecutados en Kaggle**, no opinión de LLM Q4. (2) "Larga duración" choca con el substrato: `execution_timeout=18h` muere cruzando un finde (~62h) → **Continue-As-New + schedule_to_close≥72h**.
- **Claude Code subutilizado:** no es solo revisor pasivo — comparte el MCP y puede ser **co-director** (originar tareas).
- **Hallazgos adversariales accionables:** 💰 el pipeline secuencial **desperdicia ~50% de las GPU** (1 a la vez) → concurrencia; 2da cuenta Kaggle=+30h/sem $0. 💰 Claude en 100% de merges escala con volumen, no es "barato" → gate proporcional al riesgo. 🔒 **`permitopen` desincronizado: el script versionado apunta al VPS FISCAL** (`10.10.0.2`) no al agentic — drift G-2 real a corregir. 🔒 output de Kaggle = payload adversarial (untrusted→trusted); MCP sin auth; nada impide registrar worker de ejecución en el VPS. 🧠 el operador es el SPOF (no Kaggle); 0 operabilidad móvil → 1 consola + push Slack para gates.
- **Orden de prioridad:** 0) rotar secretos · 1) timeouts+Continue-As-New → validar durabilidad cross-corte E2E (encolar viernes/completar lunes, supuesto raíz sin evidencia) · 2) RunTests+loop · 3) saturar GPUs · 4) seguridad (auth MCP, fix permitopen+test negativo, gate merge solo-humano) · 5) instrumentar. Detalle: **ADR-014** + **plan F6** (`docs/superpowers/plans/2026-06-15-plataforma-agentica-F6-cerrar-fabrica.md`).

## Pendientes
- 🔐 **ROTAR secretos pegados en chat** (URGENTE el de code-server, público): password code-server · OpenAI key `sk-proj-…` · **OpenRouter key `sk-or-v1-…` — ahora en 3 lugares**: Hermes `~/.hermes/.env`, PC `~/.claude/secrets/openrouter.env`, y el worker DeepSeek **`/etc/unreal-copilot/deepseek-worker.env`** (VPS, 600). Al rotar la OpenRouter: actualizar los 3 + `docker restart hermes` + `systemctl restart unreal-copilot-deepseek-worker`.
- ✅ **Result-roundtrip CERRADO (2026-06-16)**: `CodeTaskWorkflow` encolado desde el VPS completó `COMPLETED` con código devuelto (productivo v14 + spike). El bloqueante era `autossh` (anti-abuse de Kaggle), NO throttle — fix = ssh simple (PR #2). Ver UPDATE arriba.
- **F6** (cerrar fábrica): `ImplementFeatureWorkflow` + RunTests + gate merge HITL + auto-PR. **Plan detallado en 7 tasks ordenadas por prioridad** (ver ADR-014 + plan F6). NO declarar production-grade hasta validar durabilidad cross-corte E2E (Task 1, bloqueante).
- **F7** (opcional): reverse-tunnel Ollama→VPS:11434 → Hermes 100% soberano (sin API paga).
- Deuda menor: baja del `kaggle-tunnel` dormido en el fiscal · pausa de task (signal en workflow) · swap en el VPS.

## Aprendizajes caros
1. **Fix gpt-4o en Hermes** = `model.api_mode: "chat_completions"` (evita la Responses API + el param `include`).
2. **Kaggle antiabuse**: ~9 corridas con túnel SSH en <2h → mata sesiones a ~21s exit 137. No martillar; correr en modo batch (Save & Run All), no interactivo.
3. **sed sobre `config.yaml` de Hermes es peligroso**: hay `provider:`/`base_url:` en muchos sub-bloques (4-spaces, `auto`); usar valores únicos o líneas exactas, nunca patrón amplio.
4. Evitar heredocs anidados sobre ssh → scp del archivo (usar `printf` con `\n` para append a configs).
5. **Hermes trae Dockerfile + docker-compose oficiales** (Nous lo diseñó para Docker; `gateway run` "recommended for Docker"). El compose define gateway + dashboard, no-root UID 10000, monta solo `~/.hermes`. Reusar antes de crear. Hermes-CLI ≠ daemon: el modo servicio es `gateway`/`dashboard`/`cron`, NO `hermes` a secas (eso es la CLI interactiva).
6. **Dashboard Hermes valida `Host` header** → detrás de reverse-proxy con dominio público devuelve 400; fix Caddy `header_up Host {upstream_hostport}`. Y NO tiene auth propia (guarda API keys) → exponerlo EXIGE auth en el proxy (basic_auth), nunca passthrough como code-server.

**Docs:** `docs/superpowers/specs/2026-06-15-plataforma-agentica-soberana-design.md` · plans `…F0-F1` + `…F5-hermes-temporal-mcp` + `…F6-cerrar-fabrica` · ADR-013 (MCP thin) + **ADR-014 (flujo operativo cascade-gated)** · `deploy/`.
