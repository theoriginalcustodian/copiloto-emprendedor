# Memoria — Copiloto del Emprendedor

> **Repo graduado de `unreal-copilot` (la fábrica) el 2026-07-06.** Esta memoria se migró COMPLETA desde la
> fábrica, así que mezcla dos capas: lo **primario de este producto** (entradas `copiloto-*`, `agente-*`,
> `mercadopago-*`, `graphity-*`) y contexto **heredado de la fábrica** (`kaggle-*`, `hermes-*`, `deepseek`,
> `clinica-*`, `la casa`, generador R1/R5) que se conserva como referencia histórica del origen. Al retomar
> el copiloto, priorizá las entradas del producto; la doctrina universal (`no-codificar-la-esperanza`,
> `spike-first`, `cero-deuda-*`, etc.) además vive en el `CLAUDE.md` global y carga en toda sesión.
> **Arranque del repo:** ver `HANDOFF.md` en la raíz.
>
> Fábrica de origen: VPS `unreal-copilot` (178.105.191.1, CX33 8GB).
> **Estructura:** doctrina · lecciones · estado activo · referencia. Hitos cerrados → [HISTORIA.md](HISTORIA.md) (NO se carga; buscable). **Una línea por entrada — el detalle vive en el topic file.**

## 🚦 Estado vivo (puntero — NO se espeja acá)

"¿Qué sigue?" → `docs/ROADMAP.md` · frentes abiertos → `docs/ESTADO-FRENTES-ABIERTOS.md` ([[frentes-abiertos-tablero]]) · detalle → `CLAUDE.md §5` · arquitectura → `docs/ARCHITECTURE.md`.

- **Cuellos:** (a) plantilla frontend (obj#2) bloqueada en **Spike S1** (¿el cage corre Next.js?); (b) **verificación adversarial independiente** = cuello de CALIDAD (Fugu).
- **Mecanismo:** sólido hasta compuestos de **20 units** (heal=0). [[clinica-medica-2do-sistema-compuesto]]
- **Identidad:** automatización/agentes-IA DURABLES (moat = Temporal), no frontend-pesado. [[factory-identidad-automatizacion-ia]]

## 📐 Doctrina operativa (aplica siempre)

- [🖥️ TODA la fábrica corre en el VPS, nunca en local](apps-deploys-siempre-vps.md) — `feedback`. PC SOLO edita. **NUNCA montar en local — rechazado 2×.**
- [No codificar la esperanza — el TRONCO](no-codificar-la-esperanza-principio-raiz.md) — `feedback`. Reglas 6/7/8/9. [[spike-first-central-proyecto]]
- [Spike-first es central](spike-first-central-proyecto.md) — `feedback`. Cimiento no verificado se amplifica a escala.
- [Cero deuda NO-GESTIONADA](cero-deuda-no-gestionada.md) — `feedback`. Deliberada+visible OK; impaga/invisible prohibida.
- [♻️ Cero deuda de MEJORA — implementar TODAS al cerrar](cero-deuda-de-mejora.md) — `feedback`. Solo se difiere no-código + MAYOR.
- [🎓 Cierre del aprendizaje no es opcional](cierre-del-aprendizaje-no-opcional.md) — `feedback`. Test *¿puede volver?* → si no es "no por construcción", no terminó.
- [🏭 No pelear con la fábrica — hand-fix + E2E primero](no-pelear-con-la-fabrica-hand-fix-primero.md) — `feedback`. **LEER cuando la fábrica renega.** Snapshot no stream · E2E verde YA.
- [Raíz, no parche](raiz-no-parche.md) — `feedback`. Hook `root_cause_suggester`.
- [🔑 No insistir con rotación de keys en dev](no-insistir-rotacion-keys-desarrollo.md) — `feedback`. Diferir a prod; solo no commitear/pegar en chat.
- [Localización estructurada en feedback a agentes](localizacion-estructurada-feedback-agentes.md) — `feedback`. Feedback localizado baja regresiones -70% (TDAD).
- [Orquestación de waves — parent valida+commitea](orquestacion-waves-parent-valida.md) — `feedback`. Ownership exclusiva; verificar estado real, no el reporte bg.
- [Trabajo oportunista en esperas asíncronas](trabajo-oportunista-esperas.md) — `feedback`. Adelantar trabajo independiente+no-conflictivo. Ejecutar fase futura no.
- [Trabajo por fases — no anticipar](trabajo-por-fases-no-anticipar.md) — `feedback`. "Luz verde para construir" ≠ "fase validada".
- [Anti-adulación NO es aguafiestas](anti-adulacion-no-es-aguafiestas.md) — `feedback`. Failure mode espejo: pesimismo performativo. Afinar, no rebajar.
- [Propagar el cierre a TODOS los docs maestros](propagar-cierre-a-docs-maestros.md) — `feedback`. Actualizar ROADMAP+ARCHITECTURE, no solo CLAUDE §5.
- [🗂️ Índice de frentes abiertos → tablero WIP](frentes-abiertos-tablero.md) — `feedback`. TODO lo abierto → `docs/ESTADO-FRENTES-ABIERTOS.md`.
- [No PR por cada cambio chico — batchear](batch-cambios-no-pr-por-tweak.md) — `feedback`. Acumular docs/cambios chicos → PRs con sentido.
- [Preferir gh CLI, no el MCP de github](preferir-gh-cli-no-mcp-github.md) — `feedback`. `gh` CLI; MCP solo si no está.
- [🎨 Gate visual multi-tema + tokens](gate-visual-multi-tema-tokens.md) — `feedback`. Frontend dark/light: gate AMBOS temas; colores = tokens theme-aware.
- [📱 El gate jsdom NO ve gestos táctiles](gate-jsdom-no-ve-gestos-tactiles.md) — `feedback`. Verde en vitest ≠ verificado; probar en device/Playwright touch.
- [🧠 Trifecta cognitiva — SOTA con 2 lentes](trifecta-sota-lente-lateral-hack.md) — `feedback`. 2º lente = el atajo que *colapsa* el problema.

## 🧠 Lecciones sistémicas vivas

- [🛡️ Agente conversacional — hardening 3 lentes + 6 defensas](agente-conversacional-hardening-3-lentes.md) — `project`. **LEER al endurecer un agente LLM.** Barrido adversarial 3 lentes → batch por tests.
- [⛔ Fallo de tool colgaba el chat (retry ∞) — PR #114](agente-loop-tool-failure-retry-infinito.md) — `project`. **LEER al tocar el loop/tools.** `execute_activity` con `retry_policy` acotada + error de negocio NO se propaga.
- [♾️ Sesión PERMANENTE vía continue-as-new (PR #122)](conversacion-permanente-continue-as-new.md) — `project`. **LEER al tocar el ciclo-de-vida del agente.** Valve de CAN al TOPE del loop. Replay-verify antes de deployar.
- [🎙️ Voz Fase 2 — nota Telegram (Groq Whisper STT)](agente-voz-stt-groq.md) — `project`. Nota → whisper-large-v3 → texto. Lecciones: filename `.ogg`, User-Agent vs 403.
- [🎙️ Stack DEFINITIVO voz — Pipecat+Telnyx+Deepgram/Groq+Temporal (self-hosted)](agente-voz-stack-definitivo-selfhosted.md) — `project`. **LEER PRIMERO al retomar voz.** Vapi descartado (fee 2,6×); solo INBOUND. Doc `docs/Follow up/2026-07-06-*`. [[agente-voz-economia-pricing]]
- [🎤 Voz spike S3 (Fase 3.1, PR #99) — full-duplex es-AR](agente-voz-vivo-spike-s3.md) — `project`. Voxtral+ElevenLabs+SYS v3. **Stack redefinido 2026-07-06 → FALLBACK**; vivo=[[agente-voz-stack-definitivo-selfhosted]].
- [💰 Economía voz — stack Deepgram self-hosted](agente-voz-economia-pricing.md) — `project`. **LEER antes de pricing.** ~$0.029/min (~$1.74/h) vs ~$0.075 Vapi; márgenes 79-83% flat $349.
- [💵 Copiloto — economía/COGS (~$1-12/usuario/mes)](copiloto-economia-cogs.md) — `project`. **LEER antes de tiers/pricing.** LLM ~95% del costo; palancas = prompt caching + tool gating.
- [🧰 Tool overload — orden de defensas](tool-overload-routing-agente.md) — `project`. **LEER al rutear tools multi-servicio.** Degrada ~20-30 tools. Driver = precisión.
- [🔌 Composio en la fábrica — ladrillo + runbook](composio-gateway-ladrillo.md) — `project`. **LEER al usar Composio / agregar servicio.** Boundary fail-closed; `validate_toolkit.py` ANTES de la policy.
- [🔌 Copiloto — 7 servicios Composio plug-in (PR #104)](copiloto-servicios-composio-plugin.md) — `project`. **LEER al agregar servicio.** Módulo-plug-in + confirm-gate HITL.
- [💳 MercadoPago — integración directa multi-tenant](mercadopago-integracion-research.md) — `project`. **LEER antes de pagos/BI.** OAuth Auth-Code (token 180d), webhook HMAC, SDK ≥3.3.0. ✅ SPIKE E2E.
- [📚 Sprint biblioteca 7 apps + TECHO de workflows + catálogo 24 errores](sprint-biblioteca-7-apps-techo-workflows.md) — `project`. **LEER al planear hardening.** Músculo no rellena workflows complejos → R1.
- [🏭 Gap B — router del conversational_agent → fixed-mount R1](gap-b-router-fixed-mount-r1.md) — `project`. Router al motor (`make_dispatcher`) **MERGED #103**. Pendiente separado: fix fábrica-gate (dep-assembly del motor).
- [💳 Billing — J27 colisión de tablas → namespacing](billing-system-sistema-compuesto.md) — `project`. **Afecta TODA app nueva.** + guard en provision_tables. Arquetipo `recurring_charge`.
- [🏥 Clínica médica — 2do sistema compuesto (20 units)](clinica-medica-2do-sistema-compuesto.md) — `project`. Plantilla clínica; Documed = adapter A-1. QA cazó `add_movement` no-atómico.
- [🛡️ Clínica — hardening 3 frentes + K34 (seam adversarial)](clinica-hardening-3-frentes.md) — `project`. Fugu cazó 7 findings PHI. RPC atómicos + audit keyed-hash. PR #3. [[fugu-revisor-integracion]]
- [🧭 R5 — /generar-plano único generador (7 arquetipos)](r5-generar-plano-unico-generador.md) — `project`. **`uc_tables.json` (NO schema.sql)**. [[r1-workflow-templates-fixed-mount]]
- [🧩 R1 — workflow templates fixed-mount + 7 arquetipos](r1-workflow-templates-fixed-mount.md) — `project`. Workflow rico FIJO (gate-only) + store rellenable; AST en read_skeleton.
- [🎯 Costo ∝ incertidumbre residual — precisión = ratchet](costo-incertidumbre-precision-ratchet.md) — `project`. Contrato exacto → flash iter-0; difuso → iters/heal.
- [Macro-loop — diseño CANDIDATO + deuda del micro-loop](macro-loop-diseno-candidato.md) — `project`. Deuda: reward hacking, ACT_RETRY ilimitado.
- [Loop Engineering — ancla conceptual](loop-engineering-framing.md) — `reference`. gate=checker · Temporal=estado durable.

## 🏭 Estado / decisiones activas

- [🎓 Copiloto — GRADUADO COMPLETO a repo propio `copiloto-emprendedor` (Fase 0/1/2/2.5 HECHAS, cutover vivo)](copiloto-graduacion-fase0-fase1.md) — `project`. **LEER al retomar graduación / mount del motor.** Boundary `_paths.py`+`UC_MOTOR_REF_PATH`; Fase 0+1 en main (#144/#145). **Fase 2 HECHA:** repo privado `copiloto-emprendedor` (filter-repo 123 commits, motor vendorizado en `motor/`, checkout `../copiloto-emprendedor`). **Fase 2.5 HECHA (2026-07-06):** deploy reconciliado a `motor/` + **cutover VIVO** (corre desde el repo, smoke E2E 10/10); memoria migrada (`memoria/`+`seed-memory.sh`) + `HANDOFF.md`; PR #1. Falta Fase 3 (infra 3-nodos). ⚠️ 68MB en `../_copiloto-assets-fase2/` (NO `git clean -fdx` en root).
- [🔗 Motor ReAct tareas concatenadas — VIVO + CERRADO](copiloto-motor-react-concatenadas.md) — `project`. **CERRADO, NO re-abrir** (2026-07-06). **LEER al tocar el motor o agregar tools.** Loop ReAct en `ConversationWorkflow`, flag `COPILOTO_ENGINE_MODE`. Residuo: gate anti-drift + rollback dispatch.
- [🌐 Copiloto dominio duckdns + Google OAuth](copiloto-dominio-duckdns.md) — `project`. **LEER al tocar acceso público/dominio/Caddy/auth Google.** `copilotoemprendedor.duckdns.org`→VPS; PR #143 MERGED. Pendiente: `sync-web.sh` del VPS a main. [[copiloto-gotrue-dedicada-cutover]]
- [🟢 Copiloto DESPLEGADO VIVO + multitenant real](copiloto-deploy-multitenant-vivo.md) — `project`. **LEER PRIMERO al retomar copiloto.** systemd web+worker, auth JWT, agente durable. Cross-tenant [VERIFIED]. Smoke `deploy/copiloto/smoke_beta_e2e.py` 10/10 → BETA-READY. [[copiloto-gotrue-dedicada-cutover]]
- [🏗️ Arquitectura OBJETIVO de PROD = 3 VPS dedicados](copiloto-arquitectura-prod-3-nodos.md) — `project`. **LEER al planear infra/escalado.** app+temporal / clon fusion / clon graphity. VPS actual = SOLO dev. Falta load test + plan.
- [🔐 Copiloto auth = GoTrue DEDICADA (cutover VIVO, PR #130)](copiloto-gotrue-dedicada-cutover.md) — `project`. **LEER al tocar auth/login/signup u OAuth.** Cierra SSO-by-accident. Google OAuth LIVE (PR #132). Deuda: passwords temporales. [[deuda-secretos-rotar]]
- [📱 Copiloto frontend móvil (PWA) — UX + retoma](copiloto-frontend-movil-ux-estado.md) — `project`. **LEER al retomar frontend móvil.** Deploy solo-frontend=`sync-web.sh` (NO deploy.sh). Sesión persistente vía refresh-token (PR #118). [[pwa-sw-staleness-gotcha]]
- [🚀 Copiloto del Emprendedor — walking skeleton E2E (#97)](copiloto-emprendedor-roadmap.md) — `project`. **LEER al retomar.** Agente durable + Composio + BI; reusa `ConversationWorkflow`. Gaps A/B/C. [[factory-identidad-automatizacion-ia]]
- [🧠✅ Graphity aislamiento cross-tenant RESUELTO + CERRADO (ADR-040)](graphity-aislamiento-cross-tenant-verificado.md) — `project`. **CERRADO — NO re-abrir.** `tenant_aisla_DURO=true`; sha `90721af`. `MemoryProvider` cableado vivo (#113/#114).
- [🧠🧱 Copiloto MemoryProvider — memoria conversacional CABLEADA VIVA](copiloto-memoria-provider-ladrillo.md) — `project`. **LEER al tocar la memoria del copiloto.** Sobre Graphity, warm+recall por turno + remember batcheado, gate `config['memory']`. Aislamiento [VERIFIED]. [[copiloto-recall-temporal]]
- [🕰️ Copiloto recall temporal — "qué hice ayer" (PR #125, LIVE)](copiloto-recall-temporal.md) — `project`. **LEER al tocar recall por fecha o agregar acción al motor.** `consultar_actividad`. REGLAS: acción→`types.ACTIONS`; `valid_at` naive→UTC; content anti-injection.
- [🔁 Automatizaciones/tareas recurrentes durables — candidato post-v1](copiloto-automatizaciones-recurrentes-candidato.md) — `project`. Infra existe (Schedule+signal). Falta política+canal. NO en v1.
- [🧾 Trazabilidad de operaciones vía fact-triple — CANDIDATO](copiloto-trazabilidad-operaciones-fact-triple.md) — `project`. **LEER al retomar trazabilidad/BI.** Grafo=PROYECCIÓN (DB=SoT); triple≠episodio; spikes S1-S4 abiertos.
- [💳 MercadoPagoGateway — 2º boundary de pagos E2E VIVO (PR #110)](mercadopago-gateway-impl-followup.md) — `project`. **LEER al retomar pagos/BI.** ✅ E2E VIVO (probado 2026-07-04). Pendiente: homologación MP (externa). [[mercadopago-integracion-research]]
- [🧾 Facturación AFIP — feature NUEVO, greenfield, EN PAUSA (scope fijado)](copiloto-facturacion-afip.md) — `project`. **LEER PRIMERO al retomar facturación.** Emitir+PDF/QR+card [Guardar]/[Compartir]; Drive/mail=punteros. Gate=spike `afip.py`+PDF/QR (necesita credenciales). Handoff en `docs/copiloto-emprendedor/2026-07-06-HANDOFF-facturacion-afip-copiloto.md`.
- [🧭 IDENTIDAD = automatización/agentes-IA durables, NO frontend-pesado](factory-identidad-automatizacion-ia.md) — `project`. Moat = orquestación DURABLE. Fit = agentes + frontend FINO + HITL.
- [🎨 Frontend clinic a mano (Next.js, E2E 24/24)](frontend-clinic-plantilla-base.md) — `project`. **Obj#2: cosechar plantilla.** mock→real vía `lib/api`; `data-testid`=puente con el gate. **Spike S1: ¿el cage corre Next?**
- [Plataforma Agéntica — accesos/infra](plataforma-agentica-estado.md) — `project`. **LEER PRIMERO.** VPS Hetzner 133209712, 178.105.191.1. Temporal `127.0.0.1:7233`. [[deuda-secretos-rotar]]
- [🛰️ Hermes = solo observabilidad/reporte](hermes-rol-observabilidad-reporte.md) — `project`. NUNCA dispara. SP8 intake = TBD, NO Hermes.
- [🐡 Fugu = revisor de integración (no músculo)](fugu-revisor-integracion.md) — `project`. Revisor FINAL independiente, advisory, security-first. → skill `dupla-fugu-opus`.
- [Variante DeepSeek ADITIVA (no reemplazo)](variante-deepseek-aditiva.md) — `project`. Kaggle+DeepSeek coexisten. LLM = activity PURA.
- [🖥️ Fábrica local containerizada (réplica PC personal)](fabrica-local-containerizada.md) — `project`. Réplica del operador para SUS proyectos (NO la fábrica = el VPS).
- [🖥️ Migración cockpit Claude Code → VPS (preparada)](migracion-cockpit-vps-preparada.md) — `project`. 8 scripts idempotentes en `~/.claude/migracion-vps/`. NADA migrado aún.
- [🔄 /sync-memoria — memoria PC⇄VPS](sync-memoria-claude-code.md) — `project`. Auto-detecta proyecto+setup; bidireccional, idempotente.
- [📱 Canal WhatsApp de Hermes — OPERATIVO](canal-whatsapp-hermes.md) — `project`. Evolution API (Baileys) en VPS, `HermesWP`. Bot `wa-sender` con gate Telegram.
- [🔌 MCP Composio — Gmail (scope user)](composio-mcp-gmail-acceso-completo.md) — `project`. Auth Bearer. Riesgo lethal trifecta. NO heredar a agentes autónomos.
- [✅ Claude headless 401 en el VPS — RESUELTO](claude-headless-401-vps.md) — `project`. Token Max OAuth deslogueado → 401. Fix = re-login Max.
- [🔐 Deuda de secretos a rotar (pre-prod)](deuda-secretos-rotar.md) — `project`. Keys que pasaron por chat. Diferido a pre-prod. grep-first + restart al rotar.

## 📚 Referencia

- [Tests se corren en el VPS, no en la PC](tests-se-corren-en-vps.md) — `reference`. Worker venv `/opt/uc-worker-venv`; MCP `.venv` separado.
- [🚀 Desplegar código de la fábrica al VPS (scp + restart)](deploy-factory-code-vps.md) — `reference`. `/opt/unreal-copilot` NO es git checkout: deploy = `scp` + `systemctl restart`.
- [Capacidades de `claude -p` headless](claude-code-headless-capabilities.md) — `reference`. `--effort`, `/goal`, sub-agentes. Sesión aislada.
- [Consultar el agente de OTRO repo vía claude -p](consultar-otro-repo-headless.md) — `reference`. `--output-format json` con cwd=repo target. Stateless.
- [⭐ `/goal` mecanismo interno](goal-mecanismo-interno-reference.md) — `reference`. Stop hook `prompt`; evalúa con Haiku. Temporal da la durabilidad que /goal no tiene.
- [📊 Economía del flujo C — baseline](flujo-c-economia-baseline.md) — `reference`. Trial Tracker: $0.0139 + ~4.4 min, heal=0. n=1.
- [Precios tokens DeepSeek (OpenRouter)](precios-tokens-deepseek-openrouter.md) — `reference`. Flash $0.09/$0.18/1M; Pro $0.435/$0.87.
- [🧠 Reasoning models — max_tokens bajo → content vacío](reasoning-model-max-tokens-content-vacio.md) — `reference`. Fix: `OPENROUTER_MAX_TOKENS=16000`. NO apagar reasoning.
- [BOM rompe el "set model" del plugin Claude Code](bom-rompe-settings-plugin-claude-code.md) — `reference`. BOM en `settings.json` → error; reescribir sin BOM.
- [🔁 PWA service worker sirve build viejo](pwa-sw-staleness-gotcha.md) — `reference`. Deploy correcto ≠ el navegador lo tiene. Fix: `cleanupOutdatedCaches`+`no-cache`. [[deploy-factory-code-vps]]

## 🗄️ Historia de hitos cerrados

→ [HISTORIA.md](HISTORIA.md) — bitácora cronológica, NO se carga. Mover acá toda línea de hito cerrado.
