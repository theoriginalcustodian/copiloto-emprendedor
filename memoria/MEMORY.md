# Memoria — Copiloto del Emprendedor

> Repo graduado de la fábrica `unreal-copilot` el 2026-07-06; el 2026-07-07 se purgaron 53 entradas heredadas. Acá vive **producto del copiloto**, **doctrina universal** (también en el `CLAUDE.md` global) y **referencia** de Claude Code. Hitos cerrados → [HISTORIA.md](HISTORIA.md) (NO se carga; buscable). **Una línea por entrada — el detalle en el topic file.** Arranque del repo → `HANDOFF.md` (raíz).

## 🚦 Estado vivo (puntero — NO se espeja acá)

**"¿en qué estábamos?"** → [`HANDOFF.md`](../HANDOFF.md) · detalle → `CLAUDE.md §4-5` · tablero de frentes → `coordinacion/PLAN.md`.

- **Vivo (prod-beta):** copiloto desplegado multitenant, smoke E2E 10/10. [[copiloto-deploy-multitenant-vivo]]
- **🔥 EN CURSO:** sprint **Inteligencia de Negocio** + mobile-first (cáscara glass de documed). [[copiloto-mobile-first-cascara-glass]]
- **✅ Facturación AFIP** determinista, E2E desde el teléfono (CAE real, PDF, nota de crédito). [[copiloto-facturacion-afip]]
- **✅ Presupuestos + perfil del negocio**, las dos capas (falta device). [[copiloto-presupuestos-y-perfil-negocio]]
- **✅ Clientes:** cartera derivada de lo emitido (falta voz en device). [[cero-que-no-se-puede-afirmar]] · [[idempotencia-con-un-if-tiene-ventana]]
- **🚧 OAuth Google** es de Composio, no nuestro; runbook listo para el operador. [[copiloto-oauth-google-propio]]
- **🔀 Tres sesiones paralelas** coordinadas por el buzón de `coordinacion/`. [[coordinacion-tres-sesiones-buzon]]
- **Identidad:** automatización/agentes-IA DURABLES (moat = Temporal). [[factory-identidad-automatizacion-ia]]

## 📐 Doctrina operativa (aplica siempre)

- [🧪 DESPLEGADO ≠ con clientes — los datos se fabrican](desplegado-no-significa-con-clientes.md) — `project`. Hay cero usuarios; "prod-beta" desvía a migraciones defensivas. El dataset sintético debe traer cambios en el tiempo.
- [🖥️ TODA la fábrica corre en el VPS, nunca en local](apps-deploys-siempre-vps.md) — `feedback`. PC SOLO edita. Montar en local rechazado 2×.
- [No codificar la esperanza — el TRONCO](no-codificar-la-esperanza-principio-raiz.md) — `feedback`. La prueba vale, la aserción no. [[spike-first-central-proyecto]]
- [Spike-first es central](spike-first-central-proyecto.md) — `feedback`. Cimiento no verificado se amplifica a escala.
- [🕳️ Un vacío del PROPIO instrumento no es hallazgo — correr el control](vacio-no-es-hallazgo-correr-el-control.md) — `feedback`. Hornear el control en el script.
- [Cero deuda NO-GESTIONADA](cero-deuda-no-gestionada.md) — `feedback`. Deliberada+visible OK; impaga/invisible prohibida.
- [♻️ Cero deuda de MEJORA — implementar TODAS al cerrar](cero-deuda-de-mejora.md) — `feedback`. Solo se difiere no-código + MAYOR.
- [🎓 Cierre del aprendizaje no es opcional](cierre-del-aprendizaje-no-opcional.md) — `feedback`. Test *¿puede volver?* → si no es "no por construcción", no terminó.
- [🚫💤 CERO tiempo ocioso — tres estados, uno prohibido](cero-tiempo-ocioso-tres-estados.md) — `feedback`. Único no-trabajar válido = terminó-todo-y-reportó. Límite: no inventar forma para no ociar.
- [Raíz, no parche](raiz-no-parche.md) — `feedback`. Hook `root_cause_suggester`.
- [🔑 No insistir con rotación de keys en dev](no-insistir-rotacion-keys-desarrollo.md) — `feedback`. Diferir a prod; solo no commitear/pegar en chat.
- [Localización estructurada en feedback a agentes](localizacion-estructurada-feedback-agentes.md) — `feedback`. Feedback localizado baja regresiones -70% (TDAD).
- [Orquestación de waves — parent valida+commitea](orquestacion-waves-parent-valida.md) — `feedback`. Ownership exclusiva; verificar estado real, no el reporte bg.
- [Trabajo oportunista en esperas asíncronas](trabajo-oportunista-esperas.md) — `feedback`. Adelantar trabajo independiente+no-conflictivo. Ejecutar fase futura no.
- [Trabajo por fases — no anticipar](trabajo-por-fases-no-anticipar.md) — `feedback`. "Luz verde para construir" ≠ "fase validada".
- [Anti-adulación NO es aguafiestas](anti-adulacion-no-es-aguafiestas.md) — `feedback`. Failure mode espejo: pesimismo performativo. Afinar, no rebajar.
- [Propagar el cierre a TODOS los docs maestros](propagar-cierre-a-docs-maestros.md) — `feedback`. Actualizar el doc-de-registro único (`coordinacion/PLAN.md`), verificado que existe.
- [🗂️ Índice de frentes abiertos → UN tablero](frentes-abiertos-tablero.md) — `feedback`. En este repo es `coordinacion/PLAN.md`.
- [No PR por cada cambio chico — batchear](batch-cambios-no-pr-por-tweak.md) — `feedback`. Acumular cambios chicos → PRs con sentido.
- [Preferir gh CLI, no el MCP de github](preferir-gh-cli-no-mcp-github.md) — `feedback`. `gh` CLI; MCP solo si no está.
- [🔀 Tres sesiones paralelas — el buzón, y la junta con dueña](coordinacion-tres-sesiones-buzon.md) — `feedback`. **LEER al arrancar sesión.** Estado = ubicación; `contrato_` antes de cruzar la junta backend↔app.
- [🧠💣 Memoria repo vs slug divergen — `seed-memory.sh` BORRA](memoria-repo-vs-slug-drift.md) — `project`. **LEER antes de `seed-memory.sh`.** `rsync --delete` espeja repo→slug. Escribir en `memoria/` del repo.
- [📐 documed-front es la app CANÓNICA — consultarla antes de UI](consultar-documed-siempre-antes-de-implementar.md) — `feedback`. Regla dura 3×. Portar adaptando, no copiar ciego.
- [🚧 Verificar que el camino que recomendás EXISTE](verificar-que-el-camino-recomendado-existe.md) — `feedback`. Cada lado verificó su mitad y la junta no era de nadie.
- [🎨 Gate visual multi-tema + tokens](gate-visual-multi-tema-tokens.md) — `feedback`. Gate AMBOS temas; colores = tokens theme-aware.
- [📱 El gate jsdom NO ve gestos táctiles](gate-jsdom-no-ve-gestos-tactiles.md) — `feedback`. Verde en vitest ≠ verificado; probar en device.
- [🧭 Un `*.test.tsx` en `app/` tumba la app — expo-router lo carga como RUTA](test-en-carpeta-app-es-una-ruta.md) — `project`. El problema es DÓNDE vive. Guard: `appSoloRutas.test.ts`.
- [🧊 App "bloqueada" al volver de una función → glass APILADO](glass-apilado-empujar-una-vez.md) — `project`. Doble toque apila 2 `transparentModal`; lock por FOCO (`empujarUnaVez`).
- [🎙️🕳️ El copiloto dice "listo, ya lo marqué" y NO llamó la tool](copiloto-narra-la-accion-sin-ejecutarla.md) — `project`. El historial descarta `tool_calls`: narra en vez de ejecutar. Raíz en estado durable → MAYOR.
- [🤖 Agente acepta el chat pero NUNCA responde → cuota del LLM](agente-no-responde-revisar-cuota-llm.md) — `project`. `429 insufficient_quota` mata el workflow; mirar el journal.
- [🚀 Arranque Expo en device: expo-doctor PRIMERO](arranque-device-metro-disable-hierarchical-lookup.md) — `project`. Era `metro disableHierarchicalLookup=true`, no versiones.
- [🚨 Sincronizar al VPS desde el worktree equivocado tumba el servicio](sincronizar-al-vps-desde-el-worktree-equivocado.md) — `project`. No es git: pisa en silencio. Chequeo `grep -c <símbolo_de_prod>`.
- [🧠 Trifecta cognitiva — SOTA con 2 lentes](trifecta-sota-lente-lateral-hack.md) — `feedback`. 2º lente = el atajo que *colapsa* el problema.
- [⏳🚧 Una espera sin disparador NOMBRABLE es parálisis](una-espera-sin-disparador-nombrable-es-paralisis.md) — `feedback`. Tu propio estado envejece. Un estado falso da quietud, no bug.
- [🎯🕳️ Diseñar contra el riesgo TEMIDO ciega al caso NORMAL](disenar-contra-el-riesgo-temido-ciega-al-caso-normal.md) — `feedback`. Correr el caso vacío: el default de toda regla restrictiva es no-hacer.
- [🟢🔍 Un instrumento mal hecho no falla: CONFIRMA](instrumentos-que-confirman-en-vez-de-verificar.md) — `feedback`. Preguntarse *¿qué devolvería si lo que mido estuviera roto?* (catálogo de 11+ casos).
- [🕵️ Probar AUSENCIA necesita otro instrumento — y el device es de BACKEND](probar-ausencia-necesita-otro-instrumento.md) — `feedback`. Control de 12s no da negativo contra actor intermitente. Dueño único.
- [📣 El encabezado tranquilizador se come la carga útil](encabezado-tranquilizador-se-come-la-carga-util.md) — `feedback`. Un evento por pendiente; una línea "OK" tapó 6.
- [🎯 El error apunta a un parámetro que NUNCA mandaste](el-error-apunta-a-un-parametro-que-nunca-mandaste.md) — `project`. `GET /x/resumen` → 422 sobre el id: el segmento cae en la ruta del `{id}`.
- [🇦🇷 La coma decimal del teclado argentino](la-coma-decimal-del-teclado-argentino.md) — `project`. `Decimal("15000,50")` → 400. Normalizar, nunca `Number()`.
- [🚧 Validación de MÁS en la UI = tapón que enmascara bugs](validacion-de-mas-en-la-ui-enmascara-bugs.md) — `feedback`. Exigir más que el backend esconde bugs de las dos capas. Control por HTTP.
- [🧩 Una defensa de una capa la deshace una regla CORRECTA de la otra](defensa-deshecha-por-una-regla-correcta-de-la-otra-capa.md) — `project`. Seguir el dato hasta el píxel; test punta a punta.
- [⌨️ El teclado tapa los campos del glass Y mata el scroll — un bug](teclado-tapa-campos-cascara-glass.md) — `project`. Se dibuja encima. `KeyboardAvoidingView padding` + revelar el campo enfocado.
- [🎯 Un supuesto cuya falla parece un estado LEGÍTIMO es una pregunta](supuesto-cuya-falla-parece-un-estado-legitimo.md) — `feedback`. Al `[ASSUMED_PENDING_VERIFY]`: *¿cómo se vería si fuera falso?*
- [🪦 Borrar el archivo NO borra su contrato](borrar-el-archivo-no-borra-su-contrato.md) — `project`. Tipos y errores sobreviven en `types.ts`. Grepear por nombres del dominio.
- [🎭 El RASTRO del último intento pisa al HECHO](rastro-del-intento-pisa-al-hecho.md) — `project`. Un alta fallida mostraba desconectada una credencial activa, gastando intentos contra ARCA.
- [🔄 Un listado que NUNCA vuelve a preguntar](listado-que-nunca-vuelve-a-preguntar.md) — `project`. Cargar al montar y nada más = dato viejo. 3 disparadores; el tirón cubre lo de afuera.
- [⏱️ Dato en DOS tiempos, lector de UNO](dato-en-dos-tiempos-lector-de-un-tiempo.md) — `project`. Cortar en el 1er "listo" da dato prematuro; cortar por `terminado`.
- [🔁 "Si ya existe, devolvelo" NO es idempotencia — es una ventana](idempotencia-con-un-if-tiene-ventana.md) — `project`. Facturar 2× → 2 CAE. `USE_EXISTING` duplica. Medir el EFECTO.
- [🧹 La deuda vencida no siempre se paga en un paso](la-deuda-vencida-no-siempre-se-paga-en-un-paso.md) — `feedback`. El `DROP COLUMN` rompía el deploy que la nombra. `grep` en TODO el repo, incl. deploy.
- [0️⃣ El cero que NO se puede afirmar](cero-que-no-se-puede-afirmar.md) — `project`. Sin documento, `$0` afirma "no compró" cuando es "no lo sé". La distinción sobrevive al píxel.
- [🎯 Discriminar un caso por la AUSENCIA de un campo](discriminar-por-ausencia-de-estructura.md) — `project`. El caso "por descarte" se traga todo caso nuevo. Guarda de exhaustividad + test con la forma real.
- [🌐 El catch-all del SPA vuelve "no desplegado" indistinguible de "roto"](catch-all-vuelve-no-desplegado-indistinguible-de-roto.md) — `project`. Un GET da 200 con HTML. Sondar por verbo ≠ GET, primero contra ruta inexistente.
- [🙅 El mensaje niega el efecto que YA ocurrió — y el test desde la misma creencia lo confirma](el-mensaje-niega-el-efecto-que-ya-ocurrio.md) — `project`. Guardó y dijo "no disponible" → duplica. Era la envoltura (2 de 8 endpoints). Fixture de respuesta real; test del camino feliz de vuelta; control diferencial.
- [🛡️ Un guard cazó algo distinto de lo que vigilaba](guard-caza-algo-distinto-de-lo-que-vigilaba.md) — `project`. El anti-DDL destapó un bug de zona horaria. Leer el rechazo antes de aflojarlo.
- [🤥 Subir de modelo compra precisión, NO honestidad](subir-de-modelo-compra-precision-no-honestidad.md) — `project`. El OCR se declaró `legible:true` en cada alucinación. Ese gate está siempre abierto.
- [🔀 El orden de merge se elige por el estado INTERMEDIO de main](orden-de-merge-por-el-estado-intermedio.md) — `feedback`. Medir el solapamiento; primero la rama que corre en prod.
- [🧹 Decisión consciente sin control posterior no vale nada](decision-consciente-sin-control-posterior.md) — `feedback`. Declararlo ANTES en el buzón. En el device no hay tenant de prueba.
- [📬 Un mensaje entregado DONDE NADIE MIRA no fue entregado](mensaje-entregado-donde-nadie-mira.md) — `feedback`. El `avance_` nacía en `cerrado/` y miraban `abierto/`. Probar el cable.
- [⌛ La evidencia VENCE, y el documento no lo dice](la-evidencia-vence-y-el-documento-no-lo-dice.md) — `project`. Un PR "verificado" sobre código desplegado a mano es deuda invisible con reloj. Grepear el artefacto servido.
- [⏱️➡️ Atar la acción a un MOMENTO, no a un estado](atar-la-accion-a-un-momento-no-a-un-estado.md) — `feedback`. "Cuando X esté listo" no ocurre: nadie mira. Enganchar a una acción que ya se hace.
- [📋 Lo que NO está en la TABLA DE HITOS no existe](lo-que-no-esta-en-la-tabla-de-hitos-no-existe.md) — `feedback`. Cada verbo de "dueño de qué" necesita su renglón. El camino a mano va antes que el asistido.
- [🎛️ Verificar la COMPOSICIÓN ROOT, no la capa que declara el default](verificar-la-composicion-root-no-el-default.md) — `feedback`. `worker_b.py` sobreescribe `llm.py`. El `Read` verificó otra cosa.
- [📄 El dato correcto en la SECCIÓN EQUIVOCADA no existe](dato-correcto-en-la-seccion-equivocada.md) — `feedback`. La advertencia va PEGADA al procedimiento, no en su sección temática.
- [📱🛑 El TELÉFONO exige dueño único — y ESCRIBE en la base](device-fisico-exige-dueno-unico.md) — `project`. Dos ADB se fabrican evidencia falsa; un dictado creó un gasto real.
- [⏳ Una medición de estado VOLÁTIL vence](medicion-de-estado-volatil-vence.md) — `feedback`. Medir que algo está disponible ≠ que me toca. [[una-espera-sin-disparador-nombrable-es-paralisis]]
- [📏 No escribas una regla sobre el SETUP DE OTRO](regla-escrita-sobre-el-setup-de-otro.md) — `feedback`. El dato lo tiene el que ejecuta. Y no ablandar una instrucción del operador hasta que encaje.
- [🚀📱 Entrega progresiva (PR/merge/deploy por hito) + E2E en device](entrega-progresiva-y-e2e-en-device.md) — `feedback`. Un hito no cierra hasta desplegado; el `avance_` sale DESPUÉS del deploy.
- [🏭 No pelear con un generador flaky — hand-fix + E2E primero](no-pelear-con-la-fabrica-hand-fix-primero.md) — `feedback`. Snapshot no stream; hand-fix a verde; spike dirigido para la raíz.

## 🧠 Lecciones sistémicas vivas

- [🛡️ Agente conversacional — hardening 3 lentes + 6 defensas](agente-conversacional-hardening-3-lentes.md) — `project`. Barrido adversarial 3 lentes → batch por tests.
- [⛔ Fallo de tool colgaba el chat (retry ∞) — PR #114](agente-loop-tool-failure-retry-infinito.md) — `project`. `execute_activity` con `retry_policy` acotada + error de negocio no se propaga.
- [♾️ Sesión PERMANENTE vía continue-as-new (PR #122)](conversacion-permanente-continue-as-new.md) — `project`. Valve de CAN al TOPE del loop. Replay-verify antes de deployar.
- [💵 Copiloto — economía/COGS (~$1-12/usuario/mes)](copiloto-economia-cogs.md) — `project`. LLM ~95% del costo; palancas = prompt caching + tool gating.
- [🧰 Tool overload — orden de defensas](tool-overload-routing-agente.md) — `project`. Degrada ~20-30 tools. Driver = precisión.
- [🔌 Composio — ladrillo + runbook](composio-gateway-ladrillo.md) — `project`. Boundary fail-closed; `validate_toolkit.py` ANTES de la policy.
- [🔌 Copiloto — 7 servicios Composio plug-in (PR #104)](copiloto-servicios-composio-plugin.md) — `project`. Módulo-plug-in + confirm-gate HITL.
- [💳 MercadoPago — integración directa multi-tenant](mercadopago-integracion-research.md) — `project`. OAuth Auth-Code (token 180d), webhook HMAC, SDK ≥3.3.0. ✅ SPIKE E2E.

## 🏭 Estado / decisiones activas

- [🔱 Motor en FORK DURO + el fix del buffer de corto plazo](motor-fork-duro-fix-buffer-corto.md) — `project`. **LEER antes de tocar `motor/`.** `sync-motor.sh` retirado; un fix se hace ACÁ. El buffer no inyectaba `self._history` → amnesia.
- [🔗 Motor ReAct tareas concatenadas — VIVO + CERRADO](copiloto-motor-react-concatenadas.md) — `project`. **NO re-abrir.** Loop ReAct en `ConversationWorkflow`, flag `COPILOTO_ENGINE_MODE`.
- [🌐 Copiloto dominio duckdns + Google OAuth](copiloto-dominio-duckdns.md) — `project`. `copilotoemprendedor.duckdns.org`→VPS. [[copiloto-gotrue-dedicada-cutover]]
- [🟢 Copiloto DESPLEGADO VIVO + multitenant real](copiloto-deploy-multitenant-vivo.md) — `project`. **LEER PRIMERO al retomar.** systemd web+worker, JWT, agente durable. Cross-tenant [VERIFIED]. Smoke 10/10.
- [🏗️ Arquitectura OBJETIVO de PROD = 3 VPS dedicados](copiloto-arquitectura-prod-3-nodos.md) — `project`. app+temporal / clon fusion / clon graphity. VPS actual = SOLO dev.
- [🔐 Copiloto auth = GoTrue DEDICADA (cutover VIVO, PR #130)](copiloto-gotrue-dedicada-cutover.md) — `project`. **LEER al tocar auth/OAuth.** Google OAuth LIVE. Deuda: passwords temporales. [[deuda-secretos-rotar]]
- [🧠✅ Graphity aislamiento cross-tenant RESUELTO + CERRADO (ADR-040)](graphity-aislamiento-cross-tenant-verificado.md) — `project`. **NO re-abrir.** `tenant_aisla_DURO=true`; sha `90721af`.
- [🧠🧱 Copiloto MemoryProvider — memoria conversacional CABLEADA VIVA](copiloto-memoria-provider-ladrillo.md) — `project`. **LEER al tocar la memoria.** Sobre Graphity, warm+recall+remember, gate `config['memory']`. [[copiloto-recall-temporal]]
- [🕰️ Copiloto recall temporal — "qué hice ayer" (PR #125)](copiloto-recall-temporal.md) — `project`. `consultar_actividad`. Acción→`types.ACTIONS`; `valid_at` naive→UTC; anti-injection.
- [🔁 Automatizaciones recurrentes durables — candidato post-v1](copiloto-automatizaciones-recurrentes-candidato.md) — `project`. Infra existe (Schedule+signal). Falta política+canal. NO en v1.
- [🧾 Trazabilidad de operaciones vía fact-triple — CANDIDATO](copiloto-trazabilidad-operaciones-fact-triple.md) — `project`. Grafo=PROYECCIÓN (DB=SoT); triple≠episodio; spikes S1-S4 abiertos.
- [🕸️ Grafo: tenant dedicado `copiloto` + structured 0-LLM + ontología scoped](graphity-tenant-dedicado-y-ontologia-scoped.md) — `project`. **LEER al retomar el hito 5 / ingesta a Graphity.** Instancia COMPARTIDA → ontología con `graph_ids=[copiloto]` o fuga. structured (uuid5) NO fact-triple. `valid_at`=fecha del hecho.
- [🔑 OAuth de Google: hoy es el de COMPOSIO, no el nuestro — bloquea Apps](copiloto-oauth-google-propio.md) — `project`. Scopes por defecto son los CAROS. Decidido: ninguno restringido. Deuda: el gateway elige "la primera" auth config.
- [💰 Presupuestos + perfil del negocio — implementado las dos capas](copiloto-presupuestos-y-perfil-negocio.md) — `project`. Máquina de estados y Sheet DESCARTADOS. El perfil se lee por turno, ANTES de la memoria. Falta device.
- [🧾 Facturación AFIP — backend Y frontend TERMINADOS, E2E verde desde device](copiloto-facturacion-afip.md) — `project`. **LEER PRIMERO al retomar facturación.** DETERMINISTA. Clave fiscal no se almacena. Ambiente = dos credenciales. 8 bugs contra AFIP/device real.
- [🧹 Los tests escribían en la base de PRODUCCIÓN](copiloto-tests-ensuciaban-la-base.md) — `project`. 552 filas huérfanas. Fixture de barrido acotada a la ventana de la corrida.
- [🧭 IDENTIDAD = automatización/agentes-IA durables, NO frontend-pesado](factory-identidad-automatizacion-ia.md) — `project`. Moat = orquestación DURABLE. Fit = agentes + frontend FINO + HITL.
- [🔐 Deuda de secretos a rotar (pre-prod)](deuda-secretos-rotar.md) — `project`. Keys que pasaron por chat. Diferido a pre-prod. grep-first + restart al rotar.

## 📚 Referencia

- [💸 El modelo barato cobró 17× tokens de imagen](el-modelo-barato-cobra-17x-tokens-de-imagen.md) — `reference`. `gpt-4o-mini` = 14.261 vs 842 tokens por la misma foto. El costo multimodal se MIDE.
- [Tests se corren en el VPS, no en la PC](tests-se-corren-en-vps.md) — `reference`. Worker venv `/opt/uc-worker-venv`; MCP `.venv` separado.
- [Capacidades de `claude -p` headless](claude-code-headless-capabilities.md) — `reference`. `--effort`, `/goal`, sub-agentes. Sesión aislada.
- [Consultar el agente de OTRO repo vía claude -p](consultar-otro-repo-headless.md) — `reference`. `--output-format json` con cwd=repo target. Stateless.
- [⭐ `/goal` mecanismo interno](goal-mecanismo-interno-reference.md) — `reference`. Stop hook `prompt`; evalúa con Haiku + json_schema. Los 5 tipos de hook.
- [🎨 Import de Claude Design en Claude Code = connector MCP](claude-design-import-connector.md) — `reference`. Agregar el connector `claude-design`, no `/design-login` suelto.
- [BOM rompe el "set model" del plugin Claude Code](bom-rompe-settings-plugin-claude-code.md) — `reference`. BOM en `settings.json` → error; reescribir sin BOM.
- [🔁 PWA service worker sirve build viejo](pwa-sw-staleness-gotcha.md) — `reference`. Deploy correcto ≠ el navegador lo tiene. Fix: `cleanupOutdatedCaches`+`no-cache`.

## 🗄️ Historia de hitos cerrados

→ [HISTORIA.md](HISTORIA.md) — bitácora cronológica + entradas movidas del índice, NO se carga. Buscable.
