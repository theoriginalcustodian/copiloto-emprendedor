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

## 🔄 2026-09-23 — cupo justo, entra una entrada nueva

- [`patched()` se memoiza por run: un fix con patch no llega a sesiones vivas](patched-se-memoiza-por-run-un-fix-con-patch-no-llega-a-sesiones-vivas.md) — el False del replay se pega hasta el continue-as-new. Medí con `TemporalChangeVersion`. Bajada (backend, cupo justo) para entrar [[aislar-un-binario-del-path-se-hace-por-whitelist-no-por-dirname]]: caso narrow de Temporal, baja recurrencia con el sprint cerrando.
