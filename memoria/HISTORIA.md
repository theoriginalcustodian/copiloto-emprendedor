---
name: historia-hitos-cerrados
description: "Bitácora de hitos CERRADOS del Copiloto del Emprendedor + entradas movidas del índice activo. NO es estado vivo (eso está en MEMORY.md, HANDOFF.md y CLAUDE.md §4-5). Buscable, no se carga por sesión."
metadata:
  type: reference
---

# Historia — Copiloto del Emprendedor (hitos cerrados)

> **Qué es:** entradas de memoria de **hitos cerrados**, y **casos particulares** cuyo principio ya vive
> en `MEMORY.md`. Salen del índice activo porque éste tiene un techo duro de carga (~25.000 caracteres:
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
