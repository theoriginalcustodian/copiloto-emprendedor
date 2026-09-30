---
name: historia-hitos-cerrados
description: "Bitácora de hitos CERRADOS del Copiloto del Emprendedor + entradas movidas del índice activo. NO es estado vivo (eso está en MEMORY.md, HANDOFF.md y CLAUDE.md §4-5). Buscable, no se carga por sesión."
metadata:
  type: reference
---

# Historia — Copiloto del Emprendedor (hitos cerrados)

> **Qué es:** entradas de memoria de **hitos cerrados**, y **casos particulares** cuyo principio ya vive
> en `MEMORY.md`. Salen del índice activo porque éste tiene un techo duro de carga (24.000 caracteres — el que aplica el gate:
> arriba de eso se trunca y no existe — ver [[el-indice-truncado-fabrica-duplicados]]), pero el topic
> file sigue en `memoria/` y es **buscable**. NO es estado vivo: el "¿qué sigue?" vive en `HANDOFF.md`,
> el detalle en `CLAUDE.md §4-5`, el tablero en `coordinacion/PLAN.md`, la doctrina viva en `MEMORY.md`.
>
> **Política:** cuando un hito cierra —o cuando una lección queda absorbida por un principio ya
> indexado— su línea se mueve acá. Buscá por palabra clave; si algo de acá vuelve a morder, subilo.
> La historia **pre-graduación de la fábrica `unreal-copilot`** no vive acá: su fuente es ese repo.

## Movidos del índice el 2026-07-22 (auditoría de memoria)

- [💳 Billing — J27 colisión de tablas → namespacing](billing-system-sistema-compuesto.md) — `project`. **Afecta TODA app nueva.** + guard en provision_tables. Arquetipo `recurring_charge`.
- [🚀 Copiloto — walking skeleton E2E (#97)](copiloto-emprendedor-roadmap.md) — `project`. Snapshot pre-graduación (2026-06-30). Superado por el estado vivo en HANDOFF/CLAUDE.
- [Plataforma Agéntica — accesos/infra del VPS](plataforma-agentica-estado.md) — `project`. Puntero; los accesos también en HANDOFF.md.
- [🎓 Graduación a repo propio (Fase 0/1/2/2.5, cutover vivo)](copiloto-graduacion-fase0-fase1.md) — `project`. CERRADO 2026-07-06. El boundary del motor vive en CLAUDE.md §2 y en [[motor-fork-duro-fix-buffer-corto]].
- [💳 MercadoPagoGateway — 2º boundary de pagos E2E VIVO (PR #110)](mercadopago-gateway-impl-followup.md) — `project`. Pendiente EXTERNO: homologación MP. Research en [[mercadopago-integracion-research]].

## Movidos del índice el 2026-08-01 (poda: el índice se truncaba al 48%)

> Criterio: **casos particulares de un principio que sigue indexado**, o incidentes ya resueltos que no
> cambian una decisión futura. El principio quedó arriba; el caso, acá.

### Casos de "el instrumento antes que el resultado"

- [🕘 Un test verde 21 h por día está SIN MEDIR](el-test-verde-21-horas-por-dia-no-esta-medido.md) — fixture UTC vs query UTC−3: 7 rojos sólo a fin de mes, 21:00–00:00 ARG.
- [⏱️🧪 Un test sin cota CUELGA en vez de decirte qué falta](un-test-sin-cota-cuelga-en-vez-de-decirte-que-falta.md) — cota + volcar el estado entero; me dijo `condicion_venta` en 2 s.
- [🧨 El test que canoniza el BUG como si fuera el contrato](el-test-que-canoniza-el-bug-como-si-fuera-el-contrato.md) — docstring con "hoy/todavía no" describe un estado, no un contrato.
- [🕵️ Probar AUSENCIA necesita otro instrumento](probar-ausencia-necesita-otro-instrumento.md) — un control de 12 s no da negativo contra un actor intermitente.
- [🕳️🚪 Un stub registrado ANTES del router real lo ensombrece](stub-registrado-antes-del-router-real-lo-ensombrece.md) — `/actividad` sirvió 501 en prod desde siempre; guard por HTTP, no unit.
- [⌛ La evidencia VENCE, y el documento no lo dice](la-evidencia-vence-y-el-documento-no-lo-dice.md) — un PR "verificado" sobre código desplegado a mano es deuda con reloj.
- [🛡️ Un guard cazó algo distinto de lo que vigilaba](guard-caza-algo-distinto-de-lo-que-vigilaba.md) — el anti-DDL destapó un bug de zona horaria. Leer el rechazo antes de aflojarlo.
- [🚧 Validación de MÁS en la UI enmascara bugs](validacion-de-mas-en-la-ui-enmascara-bugs.md) — exigir más que el backend esconde bugs de las dos capas. Control por HTTP.

### Casos de "leer el contrato antes de explicar"

- [🎯 El error apunta a un parámetro que NUNCA mandaste](el-error-apunta-a-un-parametro-que-nunca-mandaste.md) — `GET /x/resumen` → 422 sobre el id: el segmento cae en la ruta del `{id}`.
- [🎭 El RASTRO del último intento pisa al HECHO](rastro-del-intento-pisa-al-hecho.md) — un alta fallida mostraba desconectada una credencial activa.
- [🙅 El mensaje niega el efecto que YA ocurrió](el-mensaje-niega-el-efecto-que-ya-ocurrio.md) — guardó y dijo "no disponible" → duplica. Era la envoltura (2 de 8 endpoints).
- [🌐 El catch-all del SPA vuelve "no desplegado" indistinguible de "roto"](catch-all-vuelve-no-desplegado-indistinguible-de-roto.md) — sondear por verbo ≠ GET.
- [❓ UNKNOWN no es NO](unknown-no-es-no-el-estado-que-el-proveedor-aun-calcula.md) — buscá el campo que dice si el valor ya está listo.
- [🎯 Discriminar un caso por la AUSENCIA de un campo](discriminar-por-ausencia-de-estructura.md) — el caso "por descarte" se traga todo caso nuevo.
- [🪦 Borrar el archivo NO borra su contrato](borrar-el-archivo-no-borra-su-contrato.md) — tipos y errores sobreviven en `types.ts`.
- [🧹 La deuda vencida no siempre se paga en un paso](la-deuda-vencida-no-siempre-se-paga-en-un-paso.md) — el `DROP COLUMN` rompía el deploy que la nombra.
- [⏱️ Dato en DOS tiempos, lector de UNO](dato-en-dos-tiempos-lector-de-un-tiempo.md) — cortar en el 1er "listo" da dato prematuro; cortar por `terminado`.
- [🔄 Un listado que NUNCA vuelve a preguntar](listado-que-nunca-vuelve-a-preguntar.md) — cargar al montar y nada más = dato viejo. 3 disparadores.
- [🧩 Una defensa de una capa la deshace una regla CORRECTA de la otra](defensa-deshecha-por-una-regla-correcta-de-la-otra-capa.md) — seguí el dato hasta el píxel.
- [📄 El dato correcto en la SECCIÓN EQUIVOCADA no existe](dato-correcto-en-la-seccion-equivocada.md) — la advertencia va PEGADA al procedimiento.
- [📣 El encabezado tranquilizador se come la carga útil](encabezado-tranquilizador-se-come-la-carga-util.md) — una línea "OK" tapó 6 pendientes.
- [🤥 Subir de modelo compra precisión, NO honestidad](subir-de-modelo-compra-precision-no-honestidad.md) — el OCR se declaró `legible:true` en cada alucinación.

### Casos de coordinación entre sesiones

- [⏱️👁️ Mirar la HORA de la acción no es mirar la ACCIÓN](mirar-la-hora-de-la-accion-no-es-mirar-la-accion.md) — `0min` + mismo `ls` tres ciclos = gira en vacío.
- [📬🕳️ "No lo vi" NO distingue "no llegó" de "no lo procesé"](no-lo-vi-no-distingue-no-llego-de-no-lo-procese.md) — el relato de un agente es TESTIMONIO, no medición.
- [📏 No escribas una regla sobre el SETUP DE OTRO](regla-escrita-sobre-el-setup-de-otro.md) — el dato lo tiene quien ejecuta.
- [🧹 Decisión consciente sin control posterior no vale nada](decision-consciente-sin-control-posterior.md) — declarala ANTES en el buzón.
- [⏳ Una medición de estado VOLÁTIL vence](medicion-de-estado-volatil-vence.md) — que algo esté disponible ≠ que me toca.
- [🔔 Avisar a Graphity que desconecte su cron](avisar-graphity-desconectar-cron-al-cerrar-el-chat.md) — pedido del operador 2026-07-23, al cerrar todo lo del grafo.

### Incidentes de producto ya resueltos

- [⛔ Fallo de tool colgaba el chat (retry ∞) — PR #114](agente-loop-tool-failure-retry-infinito.md) — `retry_policy` acotada; el error de negocio no se propaga.
- [♾️ Sesión PERMANENTE vía continue-as-new (PR #122)](conversacion-permanente-continue-as-new.md) — valve de CAN al TOPE del loop. Replay-verify antes de deployar.
- [🧹 Los tests escribían en la base de PRODUCCIÓN](copiloto-tests-ensuciaban-la-base.md) — 552 filas huérfanas. Fixture de barrido acotada a la corrida.
- [🚀 Arranque Expo en device: expo-doctor PRIMERO](arranque-device-metro-disable-hierarchical-lookup.md) — era `metro disableHierarchicalLookup=true`, no versiones.
- [🐛 dev-launcher ANR al reconectar — bug upstream de Expo](dev-launcher-anr-development-servers-bug-upstream.md) — sin fix publicado. La salida es [[receta-avion-reverse-connect-destraba-dev-launcher]].

### Candidatos, pendientes y estado que hoy no cambia una decisión

- [🎙️ El copiloto narra la acción sin ejecutarla](copiloto-narra-la-accion-sin-ejecutarla.md) — **CURADO** (PR #159): 0/10 mentiras contra el LLM real. El retest dio 2 veredictos FALSOS antes del bueno.
- [🏗️ Arquitectura OBJETIVO de PROD = 3 VPS dedicados](copiloto-arquitectura-prod-3-nodos.md) — el VPS actual es SOLO dev.
- [🧾 Trazabilidad de operaciones vía fact-triple — CANDIDATO](copiloto-trazabilidad-operaciones-fact-triple.md) — grafo = PROYECCIÓN (la DB es SoT).
- [🔁 Automatizaciones recurrentes durables — post-v1](copiloto-automatizaciones-recurrentes-candidato.md) — la infra existe; falta política + canal.
- [💵 Economía / COGS (~$1-12/usuario/mes)](copiloto-economia-cogs.md) — LLM ~95% del costo; palancas = prompt caching + tool gating.
- [🧰 Tool overload — orden de defensas](tool-overload-routing-agente.md) — degrada a ~20-30 tools. Driver = precisión.
- [🤖 Agente acepta el chat pero NUNCA responde → cuota del LLM](agente-no-responde-revisar-cuota-llm.md) — `429 insufficient_quota` mata el workflow; mirar el journal.
- [🔬 Eval global con Fable5 zero-context](eval-global-app-fable5-zero-context-pendiente.md) — report-only + 2 auditorías de eficiencia. Gated: al terminar lo pendiente.
- [🗜️ Compactar a 500k — investigación PAUSADA](compactacion-a-umbral-investigacion-pausada.md) — `/compact` inyectado NO ejecuta; medir transcript SÍ.
- [🎯 Canibalizar `/goal` en el bucle](canibalizar-goal-de-claude-code-en-el-bucle.md) — 3 candidatos, nada implementado.
- [🧰 16 skills de Matt Pocock instaladas](skills-matt-pocock-instaladas-set-engineering.md) — el set `engineering` NO está configurado.
- [🐌 El flag "incremental" que sólo acota el ÚLTIMO paso](el-flag-incremental-que-solo-acota-el-ultimo-paso.md) — `--since` del grafo: 17 min por 1 archivo.
- [🆔 Fórmula de identidad congelada sin validar el mecanismo del server](formula-de-identidad-congelada-sin-validar-el-mecanismo-del-server.md) — el `edge_uuid` lo deriva el server; anti-resurrección va en la clave del NODO.
- [🔀🌐 Mover la IP, no reconfigurar los consumidores](mover-la-identidad-de-red-en-vez-de-reconfigurar-consumidores.md) — **al migrar un host.** 2 calls de API vs N deploys; ojo con dominios que llevan la IP.

### Referencia de bajo uso

- [🧨 Heredoc sin quotar EJECUTA el prompt del sub-agente](heredoc-sin-quotar-ejecuta-el-prompt.md) — usá `<<'EOF'`; contá bytes del prompt ANTES de despachar.

- [✂️📏 Poda de suggesters + lint de contratos](poda-de-suggesters-y-lint-de-contratos-context-engineering.md) — ~2,57M tok/mes medidos. 4 hooks OFF con criterio declarado.
- [🐕 watchdog-sesiones NO se activa](watchdog-sesiones-no-activado-por-falso-positivo-de-pausa.md) — decisión del operador: falso positivo de pausa deliberada. No re-proponer.

- [✂️🤖 El hook se come el reporte del sub-agente headless](el-hook-se-come-el-reporte-del-subagente.md) — `result` corto ≠ agente conciso. Está en el transcript; NO re-lanzar.
- [🔁 PWA service worker sirve build viejo](pwa-sw-staleness-gotcha.md) — deploy correcto ≠ el navegador lo tiene. `cleanupOutdatedCaches` + `no-cache`.
- [Capacidades de `claude -p` headless](claude-code-headless-capabilities.md) — `--effort`, `/goal`, sub-agentes. Sesión aislada.
- [⏳🕳️ La ventana de diagnóstico vence antes de que el usuario avise](la-ventana-de-diagnostico-vence-antes-que-el-usuario-avise.md) — retención Temporal 24 h. Dossier: `2026-07-28-analisis-manejo-de-errores-toda-la-app.md`.

- [💸 El modelo barato cobró 17× tokens de imagen](el-modelo-barato-cobra-17x-tokens-de-imagen.md) — `gpt-4o-mini`: 14.261 vs 842 tokens por la misma foto.
- [⭐ `/goal` mecanismo interno](goal-mecanismo-interno-reference.md) — Stop hook; evalúa con Haiku + json_schema.
- [Consultar el agente de OTRO repo vía `claude -p`](consultar-otro-repo-headless.md) — `--output-format json` con cwd = repo target. Stateless.
- [🎨 Import de Claude Design = connector MCP](claude-design-import-connector.md) — agregar el connector, no `/design-login` suelto.
- [BOM rompe el "set model" del plugin](bom-rompe-settings-plugin-claude-code.md) — reescribir `settings.json` sin BOM.
- [🔑✅ Graphity: la key COMÚN alcanza (admin no se necesita)](graphity-copiloto-sin-admin-provisioning-gap.md) — único borde = project scope en la key (400, no 403).
- [🧠✅ Graphity aislamiento cross-tenant RESUELTO (ADR-040)](graphity-aislamiento-cross-tenant-verificado.md) — **NO re-abrir.** `tenant_aisla_DURO=true`. Bajadas del índice el 2026-08-02 por presupuesto; siguen vigentes.

## Movidos del índice el 2026-08-07 (el índice superaba el techo de 24.000 chars)

Hitos cerrados y ladrillos ya construidos: su valor es histórico, no operativo. Siguen
buscables acá.

- [🔗 Motor ReAct tareas concatenadas — VIVO y CERRADO](copiloto-motor-react-concatenadas.md) — **NO re-abrir.** Flag `COPILOTO_ENGINE_MODE`.
- [🔌 Composio — ladrillo + runbook](composio-gateway-ladrillo.md) — boundary fail-closed; `validate_toolkit.py` ANTES de la policy.
- [🔌 7 servicios Composio plug-in](copiloto-servicios-composio-plugin.md) — módulo-plug-in + confirm-gate HITL.
- [💳 MercadoPago — integración directa multi-tenant](mercadopago-integracion-research.md) — OAuth Auth-Code (180 d), webhook HMAC. ✅ spike E2E.
- [🛡️ Agente conversacional — hardening 3 lentes + 6 defensas](agente-conversacional-hardening-3-lentes.md) — barrido adversarial → batch por tests.

## Movidos del índice el 2026-08-07 (2ª tanda — el índice se pasaba 6.009 chars del techo)

Ocho de estas ya vivían en la sección **Estado vivo** del índice: tenían línea propia *además*
de estar mencionadas ahí, o sea el mismo hecho se pagaba dos veces en cada sesión. Una es un
**duplicado real** de otra entrada. Siguen buscables acá.

- [🧾 Facturación AFIP — backend y frontend TERMINADOS](copiloto-facturacion-afip.md) — **primero al retomar facturación.** Determinista; la clave fiscal no se almacena.  ← _bajada: ya está en §Estado vivo (✅ Cerrados)_
- [💰 Presupuestos + perfil del negocio](copiloto-presupuestos-y-perfil-negocio.md) — el perfil se lee por turno, ANTES de la memoria.  ← _bajada: ya está en §Estado vivo (✅ Cerrados)_
- [🟢 Copiloto DESPLEGADO VIVO + multitenant real](copiloto-deploy-multitenant-vivo.md) — **leer primero al retomar.** systemd web+worker, JWT, cross-tenant [VERIFIED].  ← _bajada: ya está en §Estado vivo_
- [🔑 OAuth de Google: hoy es el de COMPOSIO](copiloto-oauth-google-propio.md) — bloquea Apps. Los scopes por defecto son los CAROS.  ← _bajada: ya está en §Estado vivo (🚧 Abiertos)_
- [📡 Ingesta real al grafo por tenant — FRENTE ABIERTO (MAYOR)](copiloto-ingesta-grafo-por-tenant-real-frente-abierto.md) — sólo existe la demo sintética del hito 5.  ← _bajada: ya está en §Estado vivo (🚧 Abiertos)_
- [🔓 RLS activado en 77 tablas y filtrando en NINGUNA](rls-activado-que-no-filtraba-el-dueno-esta-exento.md) — el **dueño está exento** sin `FORCE`. Control: conectarse sin tenant y contar.  ← _bajada: ya está en §Estado vivo; la lección vive en otras dos entradas_
- [🟢 Sprint BETA cerrado (2026-08-05)](copiloto-beta-sprint-cerrado.md) — `project`. Los dos gates de BETA-5 satisfechos; sólo falta que el operador mande las invitaciones.  ← _bajada: ya está en §Estado vivo_
- [🔑 Google Sign-In nativo (Credential Manager)](copiloto-google-signin-nativo-credential-manager.md) — `project`. Endpoint propio `/auth/google/id-token` sobre GoTrue `id_token` grant. Reemplazó el login por browser.  ← _bajada: hito cerrado 2026-08-05_
- [🧭 IDENTIDAD = automatización/agentes durables, NO frontend-pesado](factory-identidad-automatizacion-ia.md) — moat = orquestación DURABLE.  ← _bajada: ya está en §Estado vivo y en CLAUDE.md_
- [🌐 Dominio duckdns + Google OAuth](copiloto-dominio-duckdns.md) — `copilotoemprendedor.duckdns.org` → VPS.  ← _bajada: dato de infra estable, no es trampa_
- [📦🔌 Metro no resuelve `node_modules` symlinked en un worktree (Windows)](metro-no-resuelve-node_modules-symlinked-worktree.md) — `project`. 404 aunque exista y `tsc`/`jest` resuelvan.  ← _bajada: DUPLICADO de metro-en-windows-no-sigue-links-de-node-modules-en-worktrees (mismo hallazgo, 2026-07-23)_
- [🔁 Re-verificación auditoría Fable 2026-08-04](reverificacion-auditoria-fable-2026-08-04.md) — `project`. Los 11 hallazgos re-verificados vs código pusheado: 2 resueltos, 3 parciales, 6 vivos. Doc maestro en `Auditorias/`.  ← _bajada: hito de auditoría ya consolidado; doc maestro en Auditorias/_

- [🔇 El silencio del buzón NO prueba REPL muerta](silencio-del-buzon-no-prueba-repl-muerta.md) — la sesión viva ACTÚA sin autorear. Bajada del índice el 2026-08-07: su lección está cubierta por [[mudo-no-es-parado-el-silencio-mide-reporte-no-trabajo]], que es más general (mide REPORTE vs TRABAJO en cualquier contexto, no sólo el buzón).

## Movidos del índice el 2026-08-12 (el índice se pasaba ~1.540 chars del techo — contrato de planificación)

Criterio: **duplicados reales** (ya cubiertos por un wikilink en §Estado vivo de `MEMORY.md`) y
**casos particulares narrow** (una lección técnica de un incidente puntual, no un principio de alta
recurrencia). Los principios de alta frecuencia —cadencia/ocio, guards, coordinación del buzón,
checkout compartido, "El producto"— quedaron intactos en el índice activo.

### Duplicados reales — ya cubiertos por wikilink en §Estado vivo

- [🟢🔍 Un instrumento mal hecho no falla: CONFIRMA](instrumentos-que-confirman-en-vez-de-verificar.md) — *¿qué diría si estuviera roto?* ← _bajada: ya está en §Estado vivo (⚠️ instrumentos que mentían)_
- [🩺🟢 "No rompió nada" NO es "arregló algo"](no-romper-no-es-arreglar.md) — un no-op puntúa mejor en un gate de no-regresión. ← _bajada: ya está en §Estado vivo (🛡️ manejo de errores)_
- [🔀 Tres sesiones paralelas — el buzón, y la junta con dueña](coordinacion-tres-sesiones-buzon.md) — leer al arrancar. ← _bajada: ya está en §Estado vivo (🔀 tres sesiones)_

### Casos particulares — "el instrumento antes que el resultado"

- [🈳🟢 El chequeo de tipos compilaba el proyecto VACÍO](el-chequeo-de-tipos-que-compilaba-el-proyecto-vacio.md) — preguntá el DENOMINADOR.
- [📐🚫 Una tabla IGNORA el `max-width` de su celda](una-tabla-ignora-el-max-width-de-su-celda.md) — jsdom no hace layout.
- [🧪🔌 Tests que mockean serialización son CIEGOS al wire](tests-que-mockean-la-serializacion-son-ciegos-al-borde-del-wire.md) — `curl` lo caza rápido.
- [🧪⚡ La suite corre LOCAL contra Postgres efímero — 24 s](suite-local-en-vps-con-rol-no-superuser.md) — el CI es gate final, no consola.
- [🎯🕳️ El control corrido contra la BASE EQUIVOCADA](el-control-corrido-contra-la-base-equivocada.md) — nombrá la base antes de comparar.
- [🔢 El DEFAULT devuelve más de lo asumido](el-default-de-la-herramienta-devuelve-mas-de-lo-que-asumis.md) — confirmar no dispara control.
- [🔌⏱️ Un kill switch por env var NO es inmediato bajo systemd](kill-switch-por-env-no-es-inmediato-bajo-systemd.md) — apagar = pausar el Schedule.

### Casos particulares — diseño y arquitectura

- [🛠️🔁 La consola se construye con las piezas de la APP](la-consola-se-construye-con-las-piezas-de-la-app.md) — reusá; lo propio, en su módulo. ← _CONSOLA ya cerrada (§Estado vivo)_
- [⏱️🕳️ Un campo que cambia con el RELOJ anula el cache](una-columna-global-mutante-vuelve-inerte-al-cache.md) — invalidar de más no rompe.
- [🏗️ El provisionado "idempotente" NO reconstruye desde cero](provisionado-no-reconstruye-la-base-desde-cero.md) — leer antes de DR/staging.
- [🎭 `IF NOT EXISTS` cubre MENOS de lo que promete](if-not-exists-cubre-menos-de-lo-que-promete.md) — no cubre tabla ni permisos.
- [📝⚡ Anotar ADENTRO el efecto externo en el instante](anotar-adentro-el-efecto-externo-en-el-instante.md) — "al final" borra la prueba.
- [🔑🔄 Derivar la clave DENTRO de la activity](derivar-la-clave-dentro-de-la-activity-no-tocar-el-payload.md) — continue-as-new reinicia números.
- [🕰️🕸️ El grafo ingesta el DISCO, pero fecha con `HEAD`](el-grafo-ingesta-el-disco-pero-fecha-con-head.md) — frescura = hora del SYNC.

### Casos particulares — coordinación (bajo uso)

- [🛸 Canal Antigravity — auxiliar, bajo demanda](canal-antigravity-bajo-demanda.md) — no es 4ª sesión.

### Casos particulares — frontend móvil (bugs puntuales ya resueltos o cubiertos por guard automático)

- [📱 Estado del frontend móvil — chrome auto-hide y sus regresiones](copiloto-frontend-movil-ux-estado.md) — snapshot de UX puntual, no doctrina.
- [🧊 App "bloqueada" al volver de una función → glass APILADO](glass-apilado-empujar-una-vez.md) — doble toque apila 2 `transparentModal`; lock por FOCO. Bug ya resuelto.
- [🧭 Un `*.test.tsx` en `app/` tumba la app](test-en-carpeta-app-es-una-ruta.md) — expo-router lo carga como RUTA. Ya cubierto por guard automático `appSoloRutas.test.ts`.
- [⌨️ El teclado tapa los campos del glass Y mata el scroll](teclado-tapa-campos-cascara-glass.md) — `KeyboardAvoidingView padding` + revelar el campo enfocado. Bug ya resuelto.
- [🇦🇷 La coma decimal del teclado argentino](la-coma-decimal-del-teclado-argentino.md) — `Decimal("15000,50")` → 400. Normalizar, nunca `Number()`.
- [🪟 Metro en Windows no sigue links de `node_modules` en worktrees](metro-en-windows-no-sigue-links-de-node-modules-en-worktrees.md) — ya hay un duplicado bajado el 2026-08-07 arriba.
- [🎨🕳️ Un token con DOS definiciones](un-token-con-dos-definiciones-y-la-equivocada-no-da-sintoma.md) — tocar la equivocada no da síntoma: contá **definiciones**, no usos.
- [📱🤖 `adb` no ejercita el toque corto de un `Gesture.Pan()`](adb-no-puede-ejercitar-el-toque-corto-de-un-gesture-pan.md) — taps y drags de 600px sí; 0-2px nunca.

### Deuda diferida ya trackeada (deliberada + visible, sólo baja de frecuencia de carga)

- [💾⏸️ Backups off-site de fusion y Temporal: APAGADOS por diseño](backups-fusion-y-temporal-apagados-por-diseno-deuda-diferida.md) — deuda diferida, no gap.
- [📧⏸️ SMTP y reset de password diferidos por el operador](smtp-email-transaccional-diferido-reset-password.md) — GoTrue `MAILER_AUTOCONFIRM=true`; slot para Gmail SMTP.

## Movidos del índice el 2026-09-22 (el índice se pasaba 71 chars del techo al sumar el cierre de A4)

- [🕰️ Recall temporal — "qué hice ayer"](copiloto-recall-temporal.md) — `consultar_actividad`; `valid_at` naive→UTC; anti-injection.

## 🔄 2026-09-22 — rescatadas del slug al reconciliar las dos memorias

> Estas 31 entradas vivían **sólo** en el slug del harness. Quedaron versionadas al correr
> `seed-memory.sh` (bidireccional desde el 2026-07-31), pero el índice activo ya estaba en 23.930 de
> un techo de 24.000: por la política del propio `MEMORY.md`, lo que no entra **baja acá**, que es
> buscable. Varias son lecciones recientes sobre instrumentos que mintieron — si alguna se vuelve
> central para el trabajo del día, subila al índice cambiándola por una de allá.

- [Bajar evidencia por buzón Y además escribir el doc es invadir](bajar-evidencia-por-buzon-y-ademas-escribir-el-doc-es-invadir.md) — el `dato_` ES la entrega; la dueña integra. Me costó un PR cerrado.
- [`grep -q` con pipefail y `[AÁ]` con locale C mienten](bash-grep-q-con-pipefail-y-corchetes-con-tilde-mienten.md) — falso rojo/verde por SIGPIPE; tilde en corchetes no matchea. Here-string + alternancia.
- [book-skill-builder v1 operativa](book-skill-builder-v1-operativa.md) — skill global libro→skill con 4 gates; DoD v1 Y DoD-grafo cerrados 2026-08-11 (tenant skills vivo, Alice en el grafo).
- [El clasificador bloquea mutar prod standalone en autónomo](clasificador-de-seguridad-bloquea-mutar-prod-standalone-en-autonomo.md) — el mismo restart pasa dentro de `deploy.sh` pero no como script suelto; no rodear, documentar y pedir ejecución puntual.
- [Control negativo estático no caza una constante equivocada](control-negativo-estatico-no-caza-constante-equivocada.md) — auditar leyendo el test confirma el acople, no el valor; certifiqué rojo como verde en Fase D. Computá el literal o corré el test.
- [Defense-in-depth enmascara el control negativo de la capa interna](defense-in-depth-enmascara-el-control-negativo-de-la-capa-interna.md) — revertir el filtro app-side no da rojo si RLS FORCE tapa; el test verifica el sistema, no aísla la capa. Fase D lote C.
- [El buzón no ve lo que otra sesión ya hizo en main](el-buzon-no-ve-lo-que-otra-sesion-ya-hizo-en-main.md) — mirar `git log origin/main` + PRs, no sólo el buzón.
- [El clasificador no lee tool results como consentimiento](el-clasificador-no-lee-tool-results-como-consentimiento.md) — autorizar por menú/hook/CLAUDE.md no le llega: sólo un mensaje escrito por el operador.
- [El gate verifica el par declarado, no el par pintado](el-gate-verifica-el-par-declarado-no-el-par-pintado.md) — el botón de voz y el hero del login sin cobertura, gate en verde. Enumerá consumidores, no combinaciones.
- [En bypassPermissions sólo sobrevive `permissions.deny`](en-bypasspermissions-solo-sobrevive-permissions-deny.md) — se repusieron 12 reglas (force push ×5 formas + `.env` del repo). Gap: falta scanner de secretos en el pre-push.
- [Filtro `-a-planificacion_` no ve destinatarios compuestos](filtro-a-planificacion-no-ve-destinatarios-compuestos.md) — `-a-backend-y-planificacion_` se escapó (K-07-B); buscar `*planificacion_*`.
- [El headless-gate exige `claude -p` pero el clasificador lo bloquea igual](headless-gate-exige-claude-p-pero-el-clasificador-lo-bloquea-igual.md) — DOS capas: modo `auto` + bug propio del hook (`=== true`). Cerradas 2026-08-13. Los hooks bloquean en TODO modo; un `ask` en autónomo es un deny.
- [La alarma de worktree huérfano sugiere borrar lo que hay que salvar](la-alarma-de-worktree-huerfano-sugiere-borrar-lo-que-hay-que-salvar.md) — el remedio del propio gate iba a destruir 19 días de auditoría D9. Antes de remover: `git log origin/main..HEAD`.
- [La excepción documentada que nunca disparó](la-excepcion-documentada-que-nunca-disparo.md) — regla de escape rota = regla ausente. Testeala con markdown real, con control de fail-open.
- [Los crones corren los scripts del checkout principal, no los de `main`](los-crones-corren-los-scripts-del-checkout-principal-no-los-de-main.md) — mergear un fix de instrumento NO lo pone en producción; ese árbol estaba 36 commits atrás.
- [`pr create && checks --watch; merge` mergea SIN CI](merge-encadenado-tras-pr-create-mergea-sin-ci.md) — sin checks registrados el watch sale rc≠0 ya; merge sólo con `&&` tras esperar que existan (#584).
- [Parkear un hook fuera de `hooks` vuelve FATAL todo el settings](parkear-un-hook-fuera-de-hooks-vuelve-fatal-todo-el-settings.md) — Claude Code 2.1.263 descarta el archivo ENTERO; se cayeron los 12 deny ~24 h. El prefijo `_disabled_` no exime.
- [Plugin oficial Telegram no engancha polling salvo sesión nueva](plugin-telegram-oficial-requiere-sesion-nueva-para-enganchar-polling.md) — `mcp get` "Connected" es falso positivo; verificar con `getUpdates`/`bot.pid`, no con el status del MCP.
- [Remote Control, no Channels, es el gate de decisión](remote-control-es-el-mecanismo-de-gate-no-channels.md) — responder desde el teléfono continúa la sesión (verif. 2026-08-18). Desde 2026-09-21 NO arranca solo: `/remote-control` por sesión.
- **Canal Telegram↔Claude Code verificado end-to-end** — entrada **LOCAL, no versionada** (`.gitignore`): guarda el chat_id del operador y el repo es público. Vive sólo en el slug de memoria de cada sesión. Dato reusable sin el identificador: los `getUpdates` de Telegram expiran a las 24 h — que no aparezcan no es un bug de webhook.
- [Un contrato bajado YA desbloquea las dos mitades](un-contrato-bajado-ya-desbloquea-esperar-la-otra-mitad-vuelve-serie-la-junta.md) — esperar a que el otro lado implemente vuelve serie la junta; FE2 se declaró sin cola con 9 filas arrancables.
- [Un fixture no aísla lo que el script lee por fuera](un-fixture-no-aisla-lo-que-el-script-lee-por-fuera.md) — sumar una fuente de datos sin parametrizarla volvió 4 controles positivos falsos verdes. Y si la señal CALLA la alarma, ante duda NO contar.
- [Un instrumento tiene DOS modos de no saber: callarse e inundar](un-instrumento-tiene-dos-modos-de-no-saber-callarse-e-inundar.md) — una variable vacía vale 0 en aritmética bash; el segundo modo aparece al testear el primero.
- [Una allowlist manual no puede saber lo que le falta](una-allowlist-manual-no-puede-saber-lo-que-le-falta.md) — el gate miraba 10 de 16 tokens y estaba verde; RECONECTAR daba 1,98:1 en claro. Computá declarados − cubiertos.
- [Una cifra en un comentario es un cache sin invalidación](una-cifra-en-un-comentario-es-un-cache-sin-invalidacion.md) — el 2,87 era correcto EN WEB y migró a mobile sin su par; viajó 4 saltos hasta el operador. Recomputá antes de citar.
- [Una regla de allow propia puede anular la built-in que la motivó](una-regla-de-allow-propia-puede-anular-la-builtin-que-la-motivo.md) — enumerar flags fabrica una plantilla de bypass. Correr `claude auto-mode critique`.
- [Una ventana por tamaño mide menos a quien más produce](una-ventana-por-tamano-mide-menos-a-quien-mas-produce.md) — propiedad estable ⇒ archivo entero. La ventana ahorraba 25 ms y costaba ver a las 2 sesiones vigiladas.
- [AFIP en prod no estaba vacía: era una consulta ciega por FORCE RLS](afip-vacia-en-prod-era-una-consulta-ciega-por-force-rls.md) — un `count` sin claims no es dato.
- [La cola viva quedó vacía (2026-08-11)](copiloto-cola-viva-vacia-2026-08-11.md) — hito cerrado; nada arrancable sin decisión nueva del operador.
- [Primer diff de cobertura funcional prototipo↔app (2026-09-08)](diff-cobertura-prototipo-vs-app-2026-09-08.md) — 3 pantallas ausentes, 8 parciales.
- [Martín diseña, no programa: la vara es su prototipo final](martin-disena-y-la-meta-es-su-prototipo-final.md) — y desde 54fac3ea (2026-09-21) SÍ está en el repo: medila, no la recuerdes.
- [Gotchas y lecciones aprendidas (agregador)](GOTCHAS.md) — NO es una entrada de memoria: es el archivo que se desprendió de `MEMORY.md` para bajar el bloat, con las lecciones pasadas por tópico. Se consulta por nombre cuando aparece un bug extraño.

## 🔄 2026-09-22 — bajadas del índice por el techo de LÍNEAS

- **🛡️ Manejo de errores — COMPLETO en prod (cerrado ~2026-08-01)** (#151→#185) + autohealing que abre PRs solo, con gate que distingue *arregla* de *no rompe*. [[no-romper-no-es-arreglar]]
- [Un cierre correcto por la causa equivocada](un-cierre-correcto-por-la-causa-equivocada.md) — el veredicto tapa la causa, y la causa es lo que se hereda; «no verificable» clausura la medición.
- [Una barrera que excluye el archivo y deja el dato en el índice](una-barrera-que-excluye-el-archivo-y-deja-el-dato-en-el-indice.md) — protegí el continente, no el contenido; grepeá el dato, no la ruta.

- [El control que va antes no detecta deriva](el-control-que-va-antes-no-detecta-deriva.md) — una serie monótona confunde efecto con deriva; repetí el control DESPUÉS de la condición cara.

- [Cambiar el alcance deja mintiendo lo que otros ya escribieron](cambiar-el-alcance-deja-mintiendo-lo-que-otros-ya-escribieron.md) — el trabajo TERMINADO es donde el alcance viejo quedó congelado; barrelo en el mismo turno.
- [Romper la capa interna de un control en profundidad sale VERDE](romper-la-capa-interna-de-un-control-en-profundidad-sale-verde.md) — rompé la capa MÁS EXTERNA; el verde de una interna es un hallazgo, no un test roto.

- [El sujeto correcto al empezar dejó de serlo a mitad de la corrida](el-sujeto-correcto-al-empezar-dejo-de-serlo-a-mitad-de-la-corrida.md) — fijá el SHA y re-medilo AL ENTREGAR; verificar al abrir no protege nada.
- [Un daño afirmado desde UN SOLO lado no es hallazgo](un-dano-afirmado-desde-un-solo-lado-no-es-hallazgo.md) — al buscar la defensa del acusado, preguntá por TODOS sus hermanos: ahí apareció el que no la tenía.

> Estas entran acá y no al índice porque el índice quedó a 15 chars del techo. Suben cuando se libere cupo.
- [Trabajo por fases — no anticipar](trabajo-por-fases-no-anticipar.md) — "luz verde" ≠ "fase validada".
- [Trabajo oportunista en esperas asíncronas](trabajo-oportunista-esperas.md) — adelantá lo independiente, no una fase futura.
- [Localización estructurada en feedback a agentes](localizacion-estructurada-feedback-agentes.md) — −70% regresiones.
- [Un procedimiento nuevo mueve el instrumento a un contexto que nadie probó](un-procedimiento-nuevo-mueve-el-instrumento-a-un-contexto-que-nadie-probo.md) — detached: stage compartido (#632) y recibo perdido (#634).  _(bajada del índice 2026-09-23 por el techo de 24.000 chars; la entrada sigue viva en `memoria/`)_
- **Cerrados de la beta Odobi** (bajado del índice 2026-09-23): AFIP E2E en device · presupuestos + perfil · mobile-first. [[copiloto-facturacion-afip]] · [[copiloto-mobile-first-cascara-glass]] — *clientes por voz sigue ABIERTO y quedó en el índice.*

## Bajadas del índice

- [`patched()` se memoiza por run: el fix con patch no llega a sesiones vivas](patched-se-memoiza-por-run-un-fix-con-patch-no-llega-a-sesiones-vivas.md) — el False del replay se pega hasta el continue-as-new.
  *(bajada el 2026-09-23 por presupuesto del índice: aplica sólo al aplicar `patch` de Temporal sobre workflows vivos, que no está en la cola de ninguna sesión. Sigue buscable acá.)*
- [🎤🔒 El Playwright MCP compartido es de UNA sesión y no concede el micrófono](playwright-mcp-compartido-es-de-una-sesion-y-no-concede-microfono.md) — bajada del índice 2026-09-23: su única referencia vivía dentro del gancho de `git-stash-es-comun-a-todos-los-worktrees`, y al comprimir esa línea la entrada quedó huérfana.
- [`core.hooksPath` absoluto apaga el pre-push de todos los worktrees](hookspath-absoluto-apaga-el-pre-push-de-todos-los-worktrees.md) — lo escribe cada worktree de Claude Code: hook viejo, sin gitleaks.
  *(bajada del índice el 2026-09-23 por presupuesto. Sigue vigente: si `core.hooksPath` queda absoluto, el pre-push de TODOS los worktrees usa un hook viejo y sin gitleaks — en un repo público eso es el escáner de secretos apagado. Buscable acá.)*

## Movidos del índice el 2026-09-28 (cupo justo, entra la entrada del adversario E2E)

- [🕰️ El checkout compartido sirve COMANDOS VIEJOS](el-checkout-compartido-sirve-comandos-viejos.md) — rama vieja; pero está MEZCLADO: diffeá el archivo, no cuentes commits. — **bajada el 2026-09-28 por cupo:** su contenido operativo ya está DUPLICADO en la sección `Estado vivo` del índice («Checkout compartido: MEZCLADO — diffeá el archivo; el contador de commits no lo mide»), que se carga primero y es la que alguien lee al arrancar. Dos líneas para el mismo hecho es lo que hace que el índice se pase del techo y trunque la cola.

- [🌿 Rama nueva ≠ "el grafo no sabe nada"](rama-nueva-no-significa-que-el-grafo-no-sepa-nada.md) — base: `merge-base origin/main`. — **bajada el 2026-09-28:** su consecuencia operativa se desinfló el mismo día. Auditoría midió que `orchestrator/sync.py:94` calcula `expected` sobre el grafo COMPLETO, no sobre el subgrafo del `--since` (que alimenta sólo la ingesta, `:65-88`), y el docstring lo declara deliberado «para no borrar lo no tocado». O sea: la base del `--since` no mueve el conteo del reconcile, que era lo que hacía útil saber contra qué rama se calculaba. El hecho sigue siendo cierto; lo que ya no cuelga de él es una decisión.

- [🌳🕳️ El working tree COMPARTIDO guarda trabajo fuera de toda rama](el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama.md) — caso particular ya cubierto por la regla dura de checkout compartido (canon 9).
- [`git stash` es común a TODOS los worktrees](git-stash-es-comun-a-todos-los-worktrees.md) — el `pop` de otra sesión levanta tu stash. — ya cubierta por la regla dura del canon 9 (prohibido `stash` en checkout compartido).
- [Preferir gh CLI, no el MCP de github](preferir-gh-cli-no-mcp-github.md) — MCP sólo si no está. — ya es la práctica por defecto; el MCP de github no se usa desde meses.
- [Anti-adulación NO es aguafiestas](anti-adulacion-no-es-aguafiestas.md) — el espejo: pesimismo performativo. — ya vive en el `CLAUDE.md` global como postura; baja por cupo, no por falsa.
- [Spike-first es central](spike-first-central-proyecto.md) — un cimiento no verificado se amplifica — es la regla 6 del `CLAUDE.md` del repo; baja por cupo, no por falsa.
- [Tests se corren en el VPS, no en la PC](tests-se-corren-en-vps.md) — worker venv `/opt/uc-worker-venv`; MCP `.venv` separado. — baja por cupo: es la regla 2 del `CLAUDE.md` del repo.
- [0️⃣ El cero que NO se puede afirmar](cero-que-no-se-puede-afirmar.md) — `$0` puede ser "no lo sé", no "no compró". — baja por cupo: específica de un cálculo de negocio puntual.
- [🚧 Verificar que el camino que recomendás EXISTE](verificar-que-el-camino-recomendado-existe.md) — la junta no es de nadie. — baja por cupo: su lección vive operativa en la junta con dueña de §3.quater.
- [⏰ Una orden con vencimiento vence en el RELOJ, no en el buzón](orden-con-vencimiento-no-se-retira-sola.md) — default: sigue vigente. — baja por cupo; sigue vigente como regla.
- [🎯📏 La regla que manda a mirar el instrumento EQUIVOCADO](la-regla-que-te-obliga-a-mirar-el-instrumento-equivocado.md) — qué regla te desvía. — baja por cupo del índice; sigue vigente.
- [🏷️ El NOMBRE es una hipótesis sobre el contenido](el-nombre-es-una-hipotesis-sobre-el-contenido.md) — leé el `WHERE`, no el nombre. — baja por cupo del índice; sigue vigente.
- [⏱️➡️ Atar la acción a un MOMENTO, no a un estado](atar-la-accion-a-un-momento-no-a-un-estado.md) — "cuando esté listo" no llega. — baja por cupo del índice; sigue vigente.
- [🎨 Gate visual multi-tema + tokens](gate-visual-multi-tema-tokens.md) — gate en AMBOS temas, tokens theme-aware
- [🏭 No pelear con un generador flaky — hand-fix + E2E primero](no-pelear-con-la-fabrica-hand-fix-primero.md) — snapshot, no stream.
- [📸⌛ Un inventario de procesos vivos es un SNAPSHOT](un-inventario-de-procesos-vivos-es-un-snapshot-no-un-estado.md) — re-medí al AFIRMAR, no al planear.
- [🧪🔌 Aislar un binario del PATH se hace por WHITELIST, no por dirname](aislar-un-binario-del-path-se-hace-por-whitelist-no-por-dirname.md) — `dirname(sh):dirname(cat)` asumía separación que el runner no tenía. — **bajada el 2026-09-28 por cupo de chars** (entra el testigo del deploy). Su lección vive CO-LOCALIZADA donde únicamente aplica: `scripts/tests/test-ci-verde-gh-presente.sh:28-31` explica el fallo de `msys-2.0.dll`, y `test-ci-verde-veredicto-monotono.sh:72-74` lo cita («el mismo molde [...] No se reinventa»). Quien escriba el próximo test de aislamiento copia ese molde y lee el porqué ahí; no llega por el índice.
## 🔄 2026-09-23 — cupo justo, entra una entrada nueva

## Bajadas del índice el 2026-09-28 (techo de líneas; la lección quedó CO-LOCALIZADA)

> No se bajaron por ser menos importantes: se bajaron porque la regla ya vive donde dispara,
> así que perder el renglón del índice no pierde la lección.

- [vácio no es hallazgo](vacio-no-es-hallazgo-correr-el-control.md) — «horneá el control en el script» pasó a ser ESTRUCTURA: el canario por brazo de `scripts/evidencia/contar-veredictos.py` (exit 5) y `scripts/tests/test-ci-verde-veredicto-monotono.sh`. Y su versión más filosa entró al índice el mismo día: `el-fallback-que-sustituye-al-valor-perdido-hace-ciego-al-control.md`.
- [contar un símbolo no dice en qué rol aparece](contar-un-simbolo-no-dice-en-que-rol-aparece.md) — es literalmente el docstring de `veredictos_de()` («Cuenta la FORMA, no el símbolo») y lo vigila `por_forma` más el canario.
- [el guard que caza a su propio autor](el-guard-que-caza-a-su-propio-autor.md) — «si nunca te frenó, no sabés si funciona» pasó a ser ESTRUCTURA el 2026-09-28: el canario por brazo de `contar-veredictos.py` sale por exit 5 si romper un brazo no mueve la métrica, y el renglón nuevo `el-fallback-que-sustituye-…` la subsume con la regla accionable («rompé cada brazo por separado»).

## Bajadas del índice el 2026-09-29 (co-localizadas en [[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]], que las cita y vuelve a enunciar su regla con una instancia más común)
- [🕶️ Un instrumento CIEGO por RLS dice "no hay"](un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo.md) — control de ceguera antes.
- [🎯🕳️ El instrumento respondió, pero sobre OTRO sujeto](el-instrumento-respondio-sobre-otro-sujeto.md) — `git -C` en worktree roto contesta por el principal, sin fallar.

- [🗂️🕳️ Documentar el cambio en un comentario NUEVO deja vivo el viejo](documentar-el-cambio-en-un-comentario-nuevo-deja-vivo-el-viejo.md) — 8 de 27 líneas del proto se contradicen. Grepeá si hay uno POSTERIOR.

### Bajada del índice 2026-09-29

**Criterio (no es longitud):** `gate-jsdom-no-ve-gestos-tactiles` es el **caso particular** de dos
reglas que siguen INDEXADAS y la alcanzan — `el-test-que-no-usa-el-camino-de-produccion-no-puede-
verlo-fallar` (dos renglones más arriba en la misma sección) e `instrumento-que-no-mira-nunca-falla`.
Un lector que llegue a cualquiera de las dos tiene la regla; esta entrada aporta el ejemplo, no el
principio. Se baja al agregar `un-criterio-de-cierre-con-algo-fuera-de-alcance-no-se-cumple-nunca`,
que sí enuncia una regla sin padre en el índice.

- [📱 El gate jsdom NO ve gestos táctiles](gate-jsdom-no-ve-gestos-tactiles.md) — verde en vitest ≠ verificado.
- [✈️ Receta avión + reverse + Connect para el dev-launcher](receta-avion-reverse-connect-destraba-dev-launcher.md) — sin deep-link ni rebuild. — **bajada del índice el 2026-09-29**, no por longitud: el operador movió device/EAS al SPRINT SIGUIENTE el 22/09, así que su disparador no puede dispararse en este sprint. **Subíla de vuelta el día que device vuelva a la cola.**

---

## 2026-09-29 · Las 14 entradas del eje «criterio 3» entran acá **porque el índice está saturado**, no por ser casos menores

No se bajaron del índice: **nunca pudieron entrar en ESTA copia**. Medido el 2026-09-29 sobre
`MEMORY.md` de esta rama: `presupuesto 23958 / 24000 chars (190 líneas)` — **42 caracteres y 10 líneas de
margen para 14 entradas**. El medidor (`scripts/medir-indice-memoria.py`, cableado al gate por
planificación) las cuenta indexadas acá, así que dejan de ser invisibles y quedan buscables.

⚠️ **Corrección del mismo día, y es una trampa de copia.** Escribí primero que «el mecanismo de fusión de
hermanas llegó a su techo» y que toda entrada nueva sólo podía ir acá. **Falso, y medido sobre el archivo
equivocado:** planificación tiene la misma copia en **23830/24000 (187 líneas), 341/341, exit 0** — con
**170 chars y 13 líneas** de margen — porque recortó las 6 líneas más verbosas, que eran las suyas, y ganó
242 chars **sin perder un solo link**. `MEMORY.md` existe en cuatro lugares (esta rama, `wt-mem-idx`, el
checkout compartido y el slug del harness): **una cifra del índice no significa nada sin decir de cuál
copia sale**, y «el techo» era verbosidad propia, no capacidad. Antes de bajar contenido ajeno, el margen
sale de recortar el propio.

Lo que **sí** está medido sobre el tronco, con control positivo y negativo: **las 14 faltan en
`origin/main:memoria/MEMORY.md`**. El índice corregido de planificación vive en su rama (`109342d9`, PR
#721) y no en `main` — la clase que ella misma nombró: **el índice y lo indexado se mergean por separado,
así que un índice correcto en su rama es un índice roto en el tronco.** Por eso estas líneas quedan acá:
dejan `main` consistente en cualquiera de los dos órdenes de merge.

📌 **Deuda declarada, con dueño:** cuando #721 mergee, las entradas que su `MEMORY.md` ya indexe hay que
**quitarlas de esta sección** para no tener el puntero duplicado en dos índices. No rompe el gate (el
medidor exige que cada entrada esté indexada en alguno de los dos), así que es limpieza, no bloqueo —
auditoría, al mergear #721.

⚠️ **Tres merecen subir al índice cargado en cuanto haya lugar**, y van marcadas con 🔝 abajo: son las que
cambian una decisión en curso, no las que explican un caso. El criterio: *¿su ausencia hace que otra
sesión re-derive una lección con evidencia?* Las tres ya lo provocaron el mismo día en que se escribieron.

- 🔝 [🟢🙈 Nadie audita un COHERENTE — el veredicto que DESACTIVA trabajo](nadie-audita-un-coherente-y-es-el-veredicto-que-desactiva-trabajo.md) — no deja rastro.
- 🔝 [🔇⚔️ Un parser que pierde veredictos silencia los CONFLICTOS](un-parser-que-pierde-veredictos-silencia-los-conflictos.md) — ahí vive el falso verde.
- 🔝 [📄🎭 Si el formato no codifica el ROL, ningún parser lo recupera](si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera.md) — la raíz es el protocolo.
- [🎭 Dos discriminantes OPUESTOS fallaron ⇒ el rol no está en el formato](el-formato-no-codifica-el-rol-dos-discriminantes-opuestos-fallaron.md) — 2º caso de la raíz de arriba.
- [🐤⏳ El canario tiene que ser tan NUEVO como lo que buscás](el-canario-tiene-que-ser-tan-nuevo-como-lo-que-buscas.md) — uno viejo pasa igual sano o enfermo.
- [🖼️🕳️ El instrumento FABRICA una referencia que no existe](el-instrumento-fabrica-una-referencia-que-no-existe.md) — y quien la mire acusa al producto.
- [🏷️🎭 Un id FABRICADO no puede parecerse a uno real](un-id-que-fabrica-el-instrumento-no-puede-parecerse-a-uno-real.md) — el lector no los distingue.
- [🌍🕳️ El universo EXTERNO trae su denominador incompleto](el-universo-externo-del-instrumento-tiene-su-propio-denominador-incompleto.md) — ¿los conoce a todos?
- [🎚️🎯 Un control calibrado a TU valor no ve al productor ajeno](un-control-calibrado-a-tu-propio-valor-no-ve-al-productor-ajeno.md) — mide tu ausencia.
- [🚦🐛 Un gate cuyo predicado es el SÍNTOMA de un bug lo vuelve veredicto](un-gate-cuyo-predicado-es-el-sintoma-de-un-bug-abierto.md) — ¿qué otra causa lo da?
- [👯❓ Una asimetría entre GEMELOS no prueba que uno esté mal](una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal.md) — ¿qué pregunta hace cada lado? Y un empate tiene TRES resoluciones, no dos.
- [📬🎁 Un `cierre_` ajeno puede traer tu cola ya hecha](un-cierre-dirigido-a-otra-sesion-puede-contener-exactamente-tu-cola.md) — ciego a las entregas.
- [📜🚪 Una NORMA no tiene estado terminal en un buzón](una-norma-no-tiene-estado-terminal-en-un-buzon-de-entregables.md) — cierra su bajada, no ella.
- [🧬🔀 Una corrida cita el BLOB, no el path — el script del disco no declara su procedencia](una-corrida-cita-el-blob-no-el-path-el-script-del-disco-no-declara-su-procedencia.md) — tres versiones del mismo archivo; corre la del disco.
- 🔝 [🎭🚦 El veredicto SUPERADO es el único legible si el corrector no está en el vocabulario](el-veredicto-superado-sobrevive-si-el-corrector-no-esta-en-el-vocabulario.md)
- 🔝 [🕳️📑 Un corpus definido por TIPO de documento excluye al que DIRIME](un-corpus-definido-por-tipo-de-documento-excluye-al-que-dirime.md) — afirmé un retiro que nadie escribió; el denominador sale verde porque sólo discrepa dentro del universo que le diste.
- 🔝 [🎯♻️ Un gate contra referencia EXTERNA hereda los roles; el que compara el corpus consigo mismo, no](un-gate-contra-referencia-externa-hereda-los-roles-el-que-compara-el-corpus-consigo-mismo-no.md) — 13 falsos de 14. Y `set & set` entre dos listas complementarias es un control gratis. — el falso verde estaba en el instrumento, no en las filas.
- [📮🕳️ Un contrato `a-todos` no tiene quien lo CIERRE](un-contrato-dirigido-a-todos-no-tiene-quien-lo-cierre.md) — cero dueños, no varios; el urgente grita eterno.
- [El device no corre `main` — corre lo que Metro sirve](el-device-no-corre-main-corre-lo-que-metro-sirve.md) — `graph-sync` le hacía `reset --hard` en CADA push. Preguntá quién ESCRIBE lo que tu proceso lee.  
  ↪ **bajada del índice el 2026-09-29.** Criterio: el bucle device/Metro está FUERA de este sprint por decisión del operador del 22/09 (device/EAS al sprint siguiente). **No se bajó por longitud** — vuelve al índice cuando arranque el sprint de device. Mismo criterio con que se bajó `receta-avion-reverse-connect-destraba-dev-launcher`.
## Bajadas del índice el 2026-09-29 (el techo de chars, no el de líneas)
- 🟩🎯 [Un control POSITIVO prueba que el instrumento VE, no que mira donde hay que mirar](un-control-positivo-prueba-que-el-instrumento-ve-no-que-mira-donde-hay-que-mirar.md) — tres errores el mismo día con el positivo en **verde**: sujeto equivocado (la app en vez del proto), universo incompleto (2 documentos de 6) y árbol viejo. Lo que los cazó fue un control de **DENOMINADOR** — cuántos elementos examiné contra cuántos esperaba —, no un positivo. El verde del positivo **aumenta** la confianza en una medición cuyo defecto no puede ver.  ↪ **indexada acá y no en `MEMORY.md`:** el índice cargado está a 52 chars del techo; se promueve cuando haya margen. Frase de auditoría, citada con su autoría.
- 🛡️🎲 [Un guard que acierta por ACCIDENTE no da síntoma](un-guard-que-acierta-por-accidente-no-da-sintoma.md) — dos cegueras del parser tenían su único caso observable saliendo **bien por la razón equivocada**: el documento sin backticks estaba retirado, así que no contarlo era correcto; y el backtick excluía la cabecera sin que nadie lo diseñara para eso, así que al relajarlo `| sujeto |` entró como medición. La pregunta no es *¿sale bien?* sino ***¿por qué sale bien este caso?*** — un control positivo da verde en los dos, porque lo que está mal es la **causa**. Relajar un patrón exige escribir primero qué excluye sin querer.  ↪ **indexada acá y no en `MEMORY.md`:** el índice cargado está a 52 chars del techo. Par de [[un-control-positivo-prueba-que-el-instrumento-ve-no-que-mira-donde-hay-que-mirar]].
**Escritas el 2026-09-29 e indexadas acá a propósito.** No por falta de lugar: con el índice cargado a 170 chars del techo, meter cuatro entradas habría forzado a bajar lecciones ajenas, y acá el medidor las cuenta igual. Indexarlas en `HISTORIA.md` deja el tronco consistente en **cualquiera** de los dos órdenes de merge, sin que ningún PR dependa del otro. Promoverlas al índice cargado cuando haya margen es deuda declarada.
- 📚🔀 **El índice y lo indexado se mergean por separado**, así que uno correcto en su rama es un índice ROTO en el tronco. Y toda cifra de cobertura necesita decir **de qué copia** sale: son cuatro archivos. Me cazó en los dos sentidos el mismo turno: midiendo de menos sobre un árbol atrasado, y afirmando de más al contar desde mi rama lo que faltaba en `main` [la entrada](el-indice-y-lo-indexado-se-mergean-por-separado.md)  ↪ **indexada acá y no en `MEMORY.md`:** caso particular de `el-instrumento-respondio-sobre-otro-sujeto`, que sigue indexada y es la raíz.
- 🚧💸 **Un gate nuevo mide el ÁRBOL MERGEADO**, así que si la deuda ya vive en el tronco el merge lo deja rojo para todas las sesiones, y el primer reflejo de quien se topa con un rojo ajeno es **desarmarlo**. La deuda se paga en el MISMO PR que enciende el gate, y el margen sale de la verbosidad **propia** antes que de bajar una lección ajena [la entrada](un-gate-que-entra-en-vigencia-con-deuda-preexistente.md)  ↪ **indexada acá y no en `MEMORY.md`:** cara de `el-guard-se-vuelve-el-cuello-de-botella-de-lo-que-protege`, que ya está en el índice.
- [📝💥 El TESTIGO del deploy se sobreescribe y borra la prueba](el-testigo-del-deploy-se-sobreescribe-y-borra-la-prueba-justo-cuando-dos-mediciones-difieren.md) — `cat >` de ranura única. Append-only.  ↪ **bajada:** misma raiz que `pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo`, que sigue indexada: la corrida buena borra la evidencia de la mala.
- [🏷️ Clasificar un hallazgo por su ETIQUETA, no por su código](clasificar-un-hallazgo-por-su-etiqueta-y-no-por-su-codigo.md) — "firma" me hizo inventar una vuln cripto; llegó mergeada a `main`.  ↪ **bajada:** cubierta por `el-nombre-es-una-hipotesis-sobre-el-contenido`, que es su raiz: la etiqueta no dice que hay adentro.
- [💾🎭 El DISCO LLENO fabrica rojos de gate que parecen del código](el-disco-lleno-fabrica-rojos-de-gate-que-parecen-del-codigo.md) — `ENOSPC`, no el PR. Varias sesiones fallando a la vez = recurso común.  ↪ **bajada:** dos líneas llevan a su raíz: `un-instrumento-compartido-intermitente-fabrica-una-excusa-lista` y `el-fallo-que-se-mueve-acusa-al-recurso-compartido`.
- [🕳️➕ El fallback que SUSTITUYE al valor perdido hace ciego al control](el-fallback-que-sustituye-al-valor-perdido-hace-ciego-al-control.md) — rompé cada brazo por separado; el total se conserva.  ↪ **bajada:** cubierta por `un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo` y `vacio-no-es-hallazgo-correr-el-control`, que siguen indexadas.
- [🎯🚫 Un criterio de cierre con algo FUERA DE ALCANCE no se cumple nunca](un-criterio-de-cierre-con-algo-fuera-de-alcance-no-se-cumple-nunca.md) — pospuesto 2× sin medición ⇒ auditá la DEFINICIÓN, no la ejecución.  ↪ **bajada:** su raíz quedó en `el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio`.
- [🗓️ El metadato anti-envejecimiento lo CAUSA si anota la lectura más nueva](el-metadato-contra-el-envejecimiento-lo-causa-si-anota-la-lectura-mas-nueva.md) — eslabón más viejo.  ↪ **bajada:** caso particular de `un-procedimiento-nuevo-mueve-el-instrumento-a-un-contexto-que-nadie-probo`.
- [👻🚫 UI escrita e INALCANZABLE — nadie la mide porque no se llega navegando](ui-escrita-e-inalcanzable-nadie-la-mide-porque-no-se-llega-navegando.md) — grepeá quién la MONTA.  ↪ **bajada:** caso de `APPSM`, ya cerrado; su regla general («grepeá quién la MONTA») se alcanza desde `la-costura-leia-un-campo-que-nadie-escribe` («grepeá quién ESCRIBE»).
- [🎰 El gate compartido PERDONA al que llega acompañado](el-gate-compartido-perdona-al-que-llega-acompanado.md) — pasó por contención, no por salud.  ↪ **bajada:** su raíz está indexada dos veces: `un-instrumento-compartido-intermitente-fabrica-una-excusa-lista` y `el-fallo-que-se-mueve-acusa-al-recurso-compartido`.
- [🔁🧪 Adversario E2E con email fijo se rompe en el rerun](adversario-e2e-con-email-estatico-y-password-random-se-rompe-en-el-rerun.md) — el 2º run falla el login.  ↪ **bajada:** el caso concreto quedó cubierto por la regla dura del usuario de prueba canónico.
