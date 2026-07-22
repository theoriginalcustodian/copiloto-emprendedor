# Memoria — Copiloto del Emprendedor

> **Repo graduado de `unreal-copilot` (la fábrica) el 2026-07-06.** La memoria se migró completa y el
> **2026-07-07 se purgaron 53 entradas heredadas de la fábrica** (voz, `clinica-*`, `kaggle-*`, `hermes-*`,
> `deepseek`, generador R1/R5, loop senior/SP, biblioteca de sprints, harness de fábrica) que NO aplican a
> este producto — su fuente de verdad vive en el repo de la fábrica. Lo que queda acá: **producto del
> copiloto** (`copiloto-*`, `mercadopago-*`, `graphity-*`, motor conversacional), **doctrina universal**
> (que además vive en el `CLAUDE.md` global y carga en toda sesión) y **referencia** de Claude Code.
> **Arranque del repo:** ver `HANDOFF.md` en la raíz.
>
> **Estructura:** doctrina · lecciones · estado activo · referencia. Hitos cerrados → [HISTORIA.md](HISTORIA.md) (NO se carga; buscable). **Una línea por entrada — el detalle vive en el topic file.**

## 🚦 Estado vivo (puntero — NO se espeja acá)

**Arranque / "¿en qué estábamos?"** → [`HANDOFF.md`](../HANDOFF.md) (raíz) · detalle de estado → `CLAUDE.md §4-5`. ⚠️ Este repo **aún no tiene** `docs/ROADMAP.md` ni tablero de frentes (no migraron de la fábrica — gap a reconstruir).

- **Vivo (prod-beta):** copiloto desplegado multitenant, smoke E2E 10/10. [[copiloto-deploy-multitenant-vivo]]
- **🔥 Frente EN CURSO:** sprint **mobile-first** — app nativa Expo con la cáscara glass de documed. [[copiloto-mobile-first-cascara-glass]] · handoff en `docs/copiloto-emprendedor/2026-07-20-HANDOFF-sprint-mobile-first.md`. **2026-07-21: arranque en device RESUELTO** ([[arranque-device-metro-disable-hierarchical-lookup]]); pendiente convergir la cáscara a documed-front + E2E.
- **✅ CERRADO (2026-07-21):** facturación AFIP **determinista** — backend Y frontend, **E2E completo desde el teléfono**: emitir con CAE real, PDF por WhatsApp, anular con nota de crédito, y el **alta ARCA con la clave fiscal real** (workflow COMPLETED en 49s, `ws_autorizados=[wsfe]`). [[copiloto-facturacion-afip]] · UI en `feat/mobile-first-cascara-glass` · cierre en `coordinacion/2026-07-21_cierre_frontend-*`. Abierto del lado backend: PDF de las notas de crédito · tope de consumidor final · rotar `DATABASE_URL` de fusion.
- **Identidad:** automatización/agentes-IA DURABLES (moat = Temporal), no frontend-pesado. [[factory-identidad-automatizacion-ia]]

## 📐 Doctrina operativa (aplica siempre)

- [🖥️ TODA la fábrica corre en el VPS, nunca en local](apps-deploys-siempre-vps.md) — `feedback`. PC SOLO edita. **NUNCA montar en local — rechazado 2×.**
- [No codificar la esperanza — el TRONCO](no-codificar-la-esperanza-principio-raiz.md) — `feedback`. Reglas 6/7/8/9. [[spike-first-central-proyecto]]
- [Spike-first es central](spike-first-central-proyecto.md) — `feedback`. Cimiento no verificado se amplifica a escala.
- [🕳️ Un vacío del PROPIO instrumento no es hallazgo — correr el control](vacio-no-es-hallazgo-correr-el-control.md) — `feedback`. Un `0` de código propio se siente verificado. Hornear el control en el script.
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
- [🔀 Tres sesiones paralelas — el buzón, y la junta con dueña](coordinacion-tres-sesiones-buzon.md) — `feedback`. **LEER al arrancar cualquier sesión de este repo.** Reglas vivas en `coordinacion/COORDINACION.md` (fuera del repo). Buzón sin versionar · estado = ubicación (`abierto/`→`en-curso/`→`cerrado/<fecha>/`) · `contrato_` ANTES de implementar lo que cruza la junta backend↔app.
- [🧠💣 La memoria del repo y la del slug divergen — `seed-memory.sh` BORRA](memoria-repo-vs-slug-drift.md) — `project`. **LEER antes de correr `seed-memory.sh`.** `rsync --delete` espeja repo→slug: 14 lecciones vivían sólo en el slug y las habría borrado. Escribir en `memoria/` del repo, no sólo en el slug.
- [📐 documed-front es la app CANÓNICA — consultarla SIEMPRE antes de implementar UI](consultar-documed-siempre-antes-de-implementar.md) — `feedback`. **Regla dura, repetida 3×.** Leer el archivo equivalente en documed ANTES de diseñar cáscara/gesto/barra/scroll. Portar adaptando, no copiar ciego.
- [🚧 Verificar que el camino que recomendás EXISTE](verificar-que-el-camino-recomendado-existe.md) — `feedback`. **LEER antes de decirle a alguien "entrá a X y hacé Y".** Apps era un catálogo estático con el endpoint vivo hace meses: cada lado verificó su mitad y la junta no era de nadie.
- [🎨 Gate visual multi-tema + tokens](gate-visual-multi-tema-tokens.md) — `feedback`. Frontend dark/light: gate AMBOS temas; colores = tokens theme-aware.
- [📱 El gate jsdom NO ve gestos táctiles](gate-jsdom-no-ve-gestos-tactiles.md) — `feedback`. Verde en vitest ≠ verificado; probar en device/Playwright touch.
- [🧭 Un `*.test.tsx` en `app/` tumba la app — expo-router lo carga como RUTA](test-en-carpeta-app-es-una-ruta.md) — `project`. **LEER antes de poner un test cerca de las rutas.** Verde en jest, muere en el device: el problema es DÓNDE vive, no qué hace. Guard: `appSoloRutas.test.ts`.
- [🧊 App móvil "bloqueada" al volver de una función → glass APILADO](glass-apilado-empujar-una-vez.md) — `project`. **LEER si la app no responde tras salir de una pantalla.** Doble toque apila 2 `transparentModal`; lock por FOCO (`empujarUnaVez`), no por tiempo. NO era el gesto del panel.
- [🤖 Agente acepta el chat pero NUNCA responde → revisar cuota del LLM](agente-no-responde-revisar-cuota-llm.md) — `project`. **LEER si `/reply` queda vacío.** `429 insufficient_quota` mata el workflow; `is-active` no alcanza, mirar el journal. ids de `/reply` son globales.
- [🚀 Arranque Expo en device: correr expo-doctor PRIMERO](arranque-device-metro-disable-hierarchical-lookup.md) — `project`. **LEER si la app no arranca en device.** "Global was not installed" era `metro disableHierarchicalLookup=true`, NO versiones. Test diferencial binario-vs-bundle + hello-world aíslan.
- [🚨 Sincronizar al VPS desde el worktree equivocado tumba el servicio](sincronizar-al-vps-desde-el-worktree-equivocado.md) — `project`. **LEER antes de `tar | ssh` código al VPS.** No es repo git: pisa en silencio y explota al reiniciar. Chequeo binario con `grep -c <símbolo_de_prod>`.
- [🧠 Trifecta cognitiva — SOTA con 2 lentes](trifecta-sota-lente-lateral-hack.md) — `feedback`. 2º lente = el atajo que *colapsa* el problema.
- [🟢🔍 Un instrumento mal hecho no falla: CONFIRMA](instrumentos-que-confirman-en-vez-de-verificar.md) — `feedback`. **LEER antes de declarar verde por lo que dijo una herramienta.** 5 casos en 1 sesión: exit code pipeado · 200 del SPA · espera laxa · muestreo contaminado. Preguntarse *¿qué devolvería si lo que mido estuviera roto?*
- [🚧 Validación de MÁS en la UI = tapón que enmascara bugs](validacion-de-mas-en-la-ui-enmascara-bugs.md) — `feedback`. **LEER antes de escribir un `puedeContinuar`.** Exigir más que el backend traba el caso más común Y esconde bugs de las dos capas. Correr el control por HTTP.
- [⌨️ El teclado tapa los campos del glass Y mata el scroll — es UN bug](teclado-tapa-campos-cascara-glass.md) — `project`. **LEER antes de meter un formulario en una función.** No redimensiona: se dibuja encima. `KeyboardAvoidingView padding` + revelar el campo enfocado. Ojo en todo campo de clave.
- [🎭 El RASTRO del último intento pisa al HECHO](rastro-del-intento-pisa-al-hecho.md) — `project`. **LEER al pintar "¿está conectado/configurado?".** Un alta fallida mostraba como desconectada una credencial activa — y empujaba a reintentar, gastando intentos contra el bloqueo de ARCA.
- [🔄 Un listado que NUNCA vuelve a preguntar](listado-que-nunca-vuelve-a-preguntar.md) — `project`. **LEER al poner un listado en pantalla.** Cargar al montar y nada más = dato viejo idéntico al fresco; el remonte lo disfraza de intermitente. 3 disparadores, y el tirón es el único que cubre lo que cambió AFUERA.
- [⏱️ Dato en DOS tiempos, lector de UNO](dato-en-dos-tiempos-lector-de-un-tiempo.md) — `project`. **LEER al poletear un estado que se completa por partes.** Cortar en el 1er estado "listo" da un dato real pero prematuro; cortar por `terminado`. Escribir por partes toca sólo su campo.
- [🔁 "Si ya existe, devolvelo" NO es idempotencia — es una ventana](idempotencia-con-un-if-tiene-ventana.md) — `project`. **LEER antes de hacer idempotente un botón que cuesta plata.** Facturar 2× creaba 2 borradores → 2 CAE. El `if` propio tiene carrera; `USE_EXISTING` duplica los ítems y se ve normal. Medir el EFECTO, no la respuesta.

## 🧠 Lecciones sistémicas vivas

- [🛡️ Agente conversacional — hardening 3 lentes + 6 defensas](agente-conversacional-hardening-3-lentes.md) — `project`. **LEER al endurecer un agente LLM.** Barrido adversarial 3 lentes → batch por tests.
- [⛔ Fallo de tool colgaba el chat (retry ∞) — PR #114](agente-loop-tool-failure-retry-infinito.md) — `project`. **LEER al tocar el loop/tools.** `execute_activity` con `retry_policy` acotada + error de negocio NO se propaga.
- [♾️ Sesión PERMANENTE vía continue-as-new (PR #122)](conversacion-permanente-continue-as-new.md) — `project`. **LEER al tocar el ciclo-de-vida del agente.** Valve de CAN al TOPE del loop. Replay-verify antes de deployar.
- [💵 Copiloto — economía/COGS (~$1-12/usuario/mes)](copiloto-economia-cogs.md) — `project`. **LEER antes de tiers/pricing.** LLM ~95% del costo; palancas = prompt caching + tool gating.
- [🧰 Tool overload — orden de defensas](tool-overload-routing-agente.md) — `project`. **LEER al rutear tools multi-servicio.** Degrada ~20-30 tools. Driver = precisión.
- [🔌 Composio en la fábrica — ladrillo + runbook](composio-gateway-ladrillo.md) — `project`. **LEER al usar Composio / agregar servicio.** Boundary fail-closed; `validate_toolkit.py` ANTES de la policy.
- [🔌 Copiloto — 7 servicios Composio plug-in (PR #104)](copiloto-servicios-composio-plugin.md) — `project`. **LEER al agregar servicio.** Módulo-plug-in + confirm-gate HITL.
- [💳 MercadoPago — integración directa multi-tenant](mercadopago-integracion-research.md) — `project`. **LEER antes de pagos/BI.** OAuth Auth-Code (token 180d), webhook HMAC, SDK ≥3.3.0. ✅ SPIKE E2E.
- [💳 Billing — J27 colisión de tablas → namespacing](billing-system-sistema-compuesto.md) — `project`. **Afecta TODA app nueva.** + guard en provision_tables. Arquetipo `recurring_charge`.

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
- [🧾 Facturación AFIP — backend Y frontend TERMINADOS, E2E verde desde el device](copiloto-facturacion-afip.md) — `project`. **LEER PRIMERO al retomar facturación.** Arquitectura **DETERMINISTA**. Clave fiscal NO se almacena (claim-check). Ambiente = **dos credenciales**, no un flag. **8 bugs que sólo aparecieron contra AFIP/device real** — uno costó una factura. Lección cara: *lo que AFIP acepta AUTORIZAR ≠ lo que acepta IMPRIMIR*. Falta sólo el alta con la clave fiscal del operador. PR #6.
- [🧹 Los tests escribían en la base de PRODUCCIÓN](copiloto-tests-ensuciaban-la-base.md) — `project`. **LEER antes de escribir un test de integración o de diagnosticar datos raros en `uc_factory`.** 552 filas huérfanas acumuladas; casi diagnostico un bug de cifrado inexistente por muestrearlas. Fixture de barrido acotada a la ventana de la corrida.
- [🧭 IDENTIDAD = automatización/agentes-IA durables, NO frontend-pesado](factory-identidad-automatizacion-ia.md) — `project`. Moat = orquestación DURABLE. Fit = agentes + frontend FINO + HITL.
- [Plataforma Agéntica — accesos/infra](plataforma-agentica-estado.md) — `project`. **LEER PRIMERO.** VPS Hetzner 133209712, 178.105.191.1. Temporal `127.0.0.1:7233`. [[deuda-secretos-rotar]]
- [🔄 /sync-memoria — memoria PC⇄VPS](sync-memoria-claude-code.md) — `project`. Auto-detecta proyecto+setup; bidireccional, idempotente.
- [🔌 MCP Composio — Gmail (scope user)](composio-mcp-gmail-acceso-completo.md) — `project`. Auth Bearer. Riesgo lethal trifecta. NO heredar a agentes autónomos.
- [🔐 Deuda de secretos a rotar (pre-prod)](deuda-secretos-rotar.md) — `project`. Keys que pasaron por chat. Diferido a pre-prod. grep-first + restart al rotar.

## 📚 Referencia

- [Tests se corren en el VPS, no en la PC](tests-se-corren-en-vps.md) — `reference`. Worker venv `/opt/uc-worker-venv`; MCP `.venv` separado.
- [Capacidades de `claude -p` headless](claude-code-headless-capabilities.md) — `reference`. `--effort`, `/goal`, sub-agentes. Sesión aislada.
- [Consultar el agente de OTRO repo vía claude -p](consultar-otro-repo-headless.md) — `reference`. `--output-format json` con cwd=repo target. Stateless.
- [⭐ `/goal` mecanismo interno](goal-mecanismo-interno-reference.md) — `reference`. Stop hook `prompt`; evalúa con Haiku. Temporal da la durabilidad que /goal no tiene.
- [BOM rompe el "set model" del plugin Claude Code](bom-rompe-settings-plugin-claude-code.md) — `reference`. BOM en `settings.json` → error; reescribir sin BOM.
- [🔁 PWA service worker sirve build viejo](pwa-sw-staleness-gotcha.md) — `reference`. Deploy correcto ≠ el navegador lo tiene. Fix: `cleanupOutdatedCaches`+`no-cache`. [[deploy-factory-code-vps]]

## 🗄️ Historia de hitos cerrados

→ [HISTORIA.md](HISTORIA.md) — bitácora cronológica, NO se carga. Mover acá toda línea de hito cerrado.
