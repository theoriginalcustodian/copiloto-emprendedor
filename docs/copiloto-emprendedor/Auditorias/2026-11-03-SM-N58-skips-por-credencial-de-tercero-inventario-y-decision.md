# SM-N58 — los 24 skips por credencial de tercero: inventario, decisión del gate y el conteo que deja de mentir

> **Dueño:** manejo-de-errores · **Ficha:** `SM-N58` (backlog `2026-11-02-BACKLOG-sprint-correcciones-mapa.md`)
> **Medido:** suite backend completa en el VPS (`tests/`, con Postgres de test), `2729 passed, 41 skipped`,
> sobre `origin/main` del 2026-11-03. Los nombres de test salen del AST del archivo en `origin/main`.
> **Qué NO entra:** `test_memory_isolation_live.py` (es `SM-N57`, dueño backend: tapa el aislamiento de
> memoria, la clase grave, y no se diluye acá), los 15 de GoTrue (los corre `gate.sh:209`) y el de
> `kb-usuario` (lo corre sólo GitHub, porque el stage del VPS no lleva esa carpeta).
> 41 − 15 − 1 − 1 = **24**.

## 1. Inventario

La columna que importa es la última: **qué pregunta queda sin responder** si el test no corre. Un skip
que deja sin cubrir un camino *del tercero* no es lo mismo que uno que deja sin cubrir una *costura
nuestra*, y hasta hoy estaban en la misma bolsa.

Clases de la última columna:

- **TERCERO**: el test mide el comportamiento o el catálogo del proveedor. Nuestro código lo cubren dobles.
- **MODELO**: mide la calidad de un LLM real. Ningún doble puede contestarla, por definición.
- **COSTURA NUESTRA**: la pregunta sin responder es sobre **nuestro** código; la credencial sólo está en
  el camino. Es la clase que se debería poder correr **sin** credencial.
- **REQUISITO FALSO**: el test no usa la credencial que su `skipif` exige.
- **SPIKE**: exploratorio, su propio DoD dice «documentar, no aprobar». No es cobertura de nada.

| # | Test | Credencial | Pregunta que queda sin responder | Clase |
|---|---|---|---|---|
| 1 | `test_auditor_parches.py::test_REAL_gpt4o_rechaza_los_TRES_parches_rotos` | `OPENAI_API_KEY` | ¿`gpt-4o` real sigue rechazando los 3 parches congelados (incluido el fiscal y el que hace trampa con el test)? El mecanismo fail-closed lo cubren 11 tests con dobles en el mismo archivo | MODELO |
| 2 | `test_auditor_parches.py::test_REAL_el_auditor_no_rechaza_TODO_por_reflejo` | `OPENAI_API_KEY` | ¿el auditor real aprueba un parche bueno? Es el control positivo del #1 | MODELO |
| 3 | `test_autosanacion_cadena_completa.py::test_la_cadena_COMPLETA_de_la_DLQ_al_veredicto` | `OPENAI_API_KEY` + DSN `copiloto_autosanacion` | ¿el dict que `tomar_trauma_para_reparar` saca de la base llega en condiciones de que `forjar_parche` abra el archivo correcto y el gate lo pruebe? Cada mitad tiene su test; la junta, sólo éste. Ahí ya aparecieron 2 bugs (trauma sin `cliente_id`, `origen` inexistente) | **COSTURA NUESTRA** |
| 4 | `test_autosanacion_cadena_completa.py::test_CONTROL_la_cadena_se_CORTA_en_el_dominio_fiscal` | ídem | con el LLM cableado, ¿un trauma fiscal no llega nunca al forjador? | **COSTURA NUESTRA** |
| 5 | `test_beta4a_soporte_clasificador_cadena.py::test_BETA4a_ticket_con_simbolo_real_dispara_la_cadena_completa_hasta_veredicto` | `GRAPHITY_CODE_*` (+ LLM) | ¿el `origen` que resuelve `SoporteClasificador` contra el grafo de código real lo puede usar el forjador? | **COSTURA NUESTRA** (+ servicio propio externo) |
| 6 | `test_beta4a_soporte_clasificador_cadena.py::test_BETA4a_ticket_no_tecnico_queda_necesita_humano_sin_tocar_el_forjador` | `GRAPHITY_CODE_*` | ¿un ticket no técnico queda en `necesita_humano` sin gastar forjador? | **COSTURA NUESTRA** |
| 7 | `test_calendar_gateway.py::test_slugs_existen_en_composio_real` | `COMPOSIO_API_KEY` | ¿los slugs de la policy siguen existiendo en el catálogo de Composio? | TERCERO (drift de catálogo) |
| 8 | `test_calendar_gateway.py::test_version_pineada_existe_real` | `COMPOSIO_API_KEY` | ¿la versión pineada del toolkit sigue en `available_versions`? Si no, prod da 404 `Tool_ToolNotFound` **al ejecutar**, no al arrancar | TERCERO (drift de catálogo) |
| 9 | `test_docs.py::test_create_doc_real_y_readback` | `COMPOSIO_API_KEY` + `COPILOTO_COMPOSIO_USER_ID` | ¿crear un Doc en la cuenta conectada y leerlo de vuelta funciona? (escribe en una cuenta real) | TERCERO |
| 10 | `test_drive.py::test_create_real_y_readback` | ídem | ídem para Drive | TERCERO |
| 11 | `test_gmail.py::test_send_real_y_readback` | ídem | ídem para Gmail (**envía un mail real**) | TERCERO |
| 12 | `test_sheets.py::test_append_no_pisa_y_update_puntual_real` | ídem | ¿append no pisa y el update puntual cae en la celda, en una hoja real? | TERCERO |
| 13 | `test_e2e.py::test_e2e_agenda_evento` | `DATABASE_URL` + `COPILOTO_CLIENTE_ID` + `COPILOTO_COMPOSIO_USER_ID` | walking skeleton: workflow durable → dispatcher → `ComposioGateway` → evento en Calendar, con el LLM guionado | TERCERO (el tramo durable lo cubren los tests del motor) |
| 14 | `test_e2e_tool_action.py::test_e2e_tool_action_gmail_send` | ídem | circuito `tool_action` completo hasta un Gmail real | TERCERO (ídem) |
| 15 | `test_e2e_react.py::test_e2e_react_cobro_mail_confirm_real_llm` | `OPENAI_API_KEY` | ¿el LLM real encadena cobro → `gmail_send` con el link en el body? | MODELO |
| 16 | `test_e2e_react.py::test_e2e_react_cobro_mail_reject_no_inventa_link` | `OPENAI_API_KEY` | ¿tras un rechazo el LLM real no inventa un link? El corte (`tool_choice='none'`, `agent_activities.py:229`) es nuestro y determinista | MODELO |
| 17 | `test_llm_openai.py::test_gpt4o_mini_emits_parseable_json_real` | `OPENAI_API_KEY` | ¿`gpt-4o-mini` emite JSON parseable con nuestro formato? | MODELO |
| 18 | `test_selection_qa.py::test_seleccion_gpt4omini` | `OPENAI_API_KEY` | precisión de selección de tool con el system prompt completo | MODELO |
| 19 | `test_orquestador_rag_client_real.py::test_ANSWERED_real_una_pregunta_del_corpus_trae_contenido` | `RAG_ORQUESTADOR_TOKEN` | ¿el servicio RAG de fusion contesta una pregunta del corpus? | TERCERO |
| 20 | `…::test_REFUSED_real_una_pregunta_fuera_de_dominio_no_la_contesta` | ídem | ¿el gate de suficiencia del servicio rechaza lo que no está en el corpus? | TERCERO |
| 21 | `…::test_UNAVAILABLE_real_token_invalido_degrada_sin_lanzar` | ídem | ¿un 401 del servicio degrada a `unavailable` sin lanzar? | TERCERO |
| 22 | `…::test_UNAVAILABLE_real_endpoint_inalcanzable_es_el_N1_del_DoD` | ídem (**no la usa**) | ¿un endpoint caído degrada a `unavailable`? El test construye su cliente con `token="x"` contra un puerto cerrado: **el token no interviene** | **REQUISITO FALSO** |
| 23 | `test_spike_beta0_forjador_vs_sintomas.py::test_SPIKE_beta0_tickets_A_B_sin_origen_son_rechazados_por_el_gate` | `OPENAI_API_KEY` | exploratorio (2026-08-04), su resultado ya está documentado | SPIKE |
| 24 | `test_spike_beta0_forjador_vs_sintomas.py::test_SPIKE_beta0_ticket_C_con_origen_hand_crafted_que_produce_el_forjador` | `OPENAI_API_KEY` | ídem | SPIKE |

**Resumen por clase, fila por fila:** **TERCERO 11** (#7–14, #19–21) · **MODELO 6** (#1, 2, 15–18) ·
**COSTURA NUESTRA 4** (#3–6) · **REQUISITO FALSO 1** (#22) · **SPIKE 2** (#23, 24) = **24**.

### ¿Apareció otro de la clase de N57?

**No de la misma clase.** N57 tapa un **control de aislamiento** (seguridad multitenant). Ninguno de los
24 tapa un control de acceso. Pero los **4 de COSTURA NUESTRA** (#3–6) sí comparten la otra mitad del
defecto de N57: la pregunta sin responder es sobre **nuestro** código, y la credencial está sólo en el
camino. Los marco y no abro ficha: el criterio de partir es tuyo (planificación), y lo dejaste escrito
para la clase de N57. Lo que los distingue, medido, es que **se pueden volver ejecutables sin
credencial**: el forjador recibe un `llm_client` inyectado (`set_autosanacion_deps(conn_dlq,
llm_client=OpenAI())`), así que un cliente que devuelva una respuesta grabada ejercita la junta
`tomar → forjar → probar` entera, y el DSN BYPASSRLS ya lo emite `test-db.sh --export`.

## 2. La decisión sobre la clase

**El gate canónico NO corre tests que necesiten credenciales de terceros.** La cobertura de esos tests
queda declarada `[UNVERIFIED]` en `scripts/ci/skips-linea-base.txt`, con dueño y fecha por grupo.

Por qué esta y no la otra (las dos eran válidas):

1. **Repo público y gate que corre desde la PC del operador.** Correrlas exige poner en el entorno de test
   las credenciales de producción: el Composio del operador (acceso **total** a su Gmail, ver
   `memoria/composio-mcp-gmail-acceso-completo.md`) y la cuenta de OpenAI que factura. No hay credencial
   «de test» para ninguno de los dos hoy.
2. **Cuatro de ellos escriben en cuentas reales** (#9–#12; el #11 manda un mail). Un gate que corre en
   cada PR de tres sesiones los dispararía decenas de veces por día.
3. **Un gate que se pone rojo por el tercero se desarma** (`memoria/el-guard-que-grita-en-el-caso-normal-se-desarma-solo.md`):
   una caída de Composio o un cambio de OpenAI pintaría rojo un PR que no tocó nada, y la respuesta
   aprendida sería saltear el gate.
4. Las preguntas MODELO no se contestan en cada PR: se contestan **cuando cambia el modelo o el prompt**.
   Correrlas siempre paga el costo sin comprar la señal.

Lo que esta decisión **no** cubre, y por eso tiene dueño y fecha:

| Grupo | Tests | Dueño | Qué destraba revisarlo |
|---|---|---|---|
| COSTURA NUESTRA | #3–#6 | manejo-de-errores | hacerlos correr **sin** credencial (LLM grabado). Es la única clase donde el `[UNVERIFIED]` es evitable |
| REQUISITO FALSO | #22 | backend (dueño de `orquestador_rag_client`) | sacarle el `@necesita_rag`, o apuntarlo a un puerto local cerrado para que no dependa de DNS externo |
| SPIKE | #23, #24 | manejo-de-errores | retirarlos de `tests/` o moverlos a `spikes/`: un spike no es cobertura |
| TERCERO / MODELO | #1, 2, 7–21 | backend (manejo-de-errores para #1, #2) | correrlos **a mano en el VPS** al cambiar de modelo, de prompt, de versión de toolkit, o antes de abrir la beta a usuarios reales |

**Fecha:** declarado el 2026-11-03; se revisa el **2026-12-03** o **antes de abrir la beta a usuarios
reales**, lo que ocurra primero. Revertir la decisión (que el gate corra con credenciales) es **MAYOR**:
mete secretos de producción en el entorno del gate y lo decide el operador.

## 3. El conteo que deja de mentir

`scripts/ci/backend.sh` (corrida por default, la que usan `gate.sh` y GitHub Actions) ahora:

- corre pytest con `-rs` (el motivo de cada salto queda en el log) y `--junitxml`;
- al final imprime **siempre** `==> SKIPS: N saltados de T (línea base declarada: M · NUEVOS: k · declarados que no ocurrieron: j · xfail: x)`;
- **falla** si hay un skip que no está en `scripts/ci/skips-linea-base.txt`. La salida es hacerlo correr o
  declararlo con su motivo. Sin Postgres (`UC_SIN_PG=1`, dev-loop) informa y no evalúa.

La línea base usa **nodeids** (del junit), no `path:línea`: la línea se corre con cualquier edición y la
volvería inestable. Es la **unión** de los entornos donde corre la suite (VPS y GitHub): un declarado que
en un entorno no ocurre se informa («no ocurrió», que suele ser buena noticia) y no falla.

**Medido con la línea base vacía (control positivo del gate):**

| Entorno | Resultado | SKIPS | Qué faltaba declarar |
|---|---|---|---|
| VPS (Postgres + GoTrue de test) | `2938 passed, 26 skipped`, job RC=1 | 26 nuevos | los 24 de esta ficha + `SM-N57` + `kb-usuario` |
| GitHub Actions (run `41763399631`) | `2922 passed, 42 skipped`, job `backend: failure` | 17 nuevos, 1 declarado que no ocurrió | 15 de GoTrue (GitHub no la levanta) + 2 de `test_afip_onboarding.py` (GitHub no tiene Temporal); el que no ocurrió es `kb-usuario`, que GitHub sí corre |

Línea base resultante: **43 nodeids** (26 + 17), y los nodeids coinciden entre los dos entornos.

Una observación lateral: `test_afip_onboarding.py::test_el_history_del_workflow_no_contiene_la_clave_fiscal`
**sólo** corre en el VPS. Está bien porque el gate canónico es el del VPS (ADR-001), pero quiere decir que
un verde de GitHub **no** acredita que la clave fiscal quede fuera del history de Temporal. Ahora el
conteo lo dice; antes no lo decía nadie.

Fundamento: es la misma clase vista dos veces. En SM-I7 el único test que cruzaba catálogo↔íconos daba
`1 skipped` justo donde corre el gate; y el conteo de esta ficha salió 27 cuando eran 41 porque el runner
se leía con `tail -30`. Con el conteo al final, un `tail` ya no puede recortarlo.
