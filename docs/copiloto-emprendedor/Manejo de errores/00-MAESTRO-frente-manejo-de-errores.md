# 00 — MAESTRO · Frente Manejo de Errores → Autosanación

> **Escrito el 2026-07-28.** Punto de entrada único del frente. Si retomás sin contexto, **leé sólo
> este archivo**: dice qué se busca, qué está hecho, qué falta, en qué orden, y dónde está cada cosa.
>
> **Regla de este doc:** todo lo que afirma está medido, y cada afirmación lleva su fecha de medición.
> Lo no verificado va marcado `[ASSUMED_PENDING_VERIFY]`. Las mediciones de estado vivo **vencen**
> (ver [[medicion-de-estado-volatil-vence]]): re-medir antes de decidir sobre ellas.

---

## 1. Para qué existe este frente

**Instrucción del operador, textual (2026-07-28):**

> *"todo esto que estamos haciendo tiene el objetivo de primero resolver todos los errores que tenemos
> hoy… implementar luego el manejo de errores para que la superficie de error sea mínima y
> completamente abordable por los agentes de autosanación… es decir, a esa altura ya hemos trabajado el
> tema errores y la superficie de fallos que se puede dar debería de ser mínima, para que los agentes
> de autosanación con acceso al código y al grafo puedan proponer las soluciones adecuadas a cada
> fallo y resolverlas de raíz. Este es el conjunto completo de la implementación de manejo de errores.
> Pero la autosanación no la pondremos en GitHub: estará en el propio cluster de Temporal."*

> *"el fin último es que el software pueda mantenerse solo, con algunos puntos de HITL — principalmente
> el merge a main — hasta que el sistema esté maduro y pueda auto-operarse."*

**Las tres etapas, y por qué ese orden es causal y no de gusto:**

1. **Corregir la superficie de errores que hoy existe.** Menos superficie después = menos trabajo.
2. **Implementar el manejo de errores** para que lo que falle sea **mínimo y enteramente
   descriptible**.
3. **Autosanación** — sólo entonces. Un agente que repara sobre una superficie grande y mal
   caracterizada **automatiza el parche, no la raíz**.

---

## 2. Cómo leer esta carpeta

El análisis vive en cinco documentos que **no se duplican acá**. Este maestro dice cuál abrir:

| Documento | Qué contesta | Cuándo abrirlo |
|---|---|---|
| [análisis de toda la app](../2026-07-28-analisis-manejo-de-errores-toda-la-app.md) (33 KB) | Barrido completo del manejo de errores en el repo | Para el panorama general |
| [mapa de puntos de fallo](../2026-07-28-mapa-puntos-de-fallo-del-sistema.md) (20 KB) | **Los 12 puntos concretos**, con `archivo:línea` y evidencia | Para saber qué se rompía y dónde |
| [metodología INL](../2026-07-28-metodologia-inl-manejo-de-errores.md) (29 KB) | A-4 Trauma Empaquetado, escala L0–L5, A-1 Adaptador | Para el *por qué* del diseño |
| [plan de implementación v2](../2026-07-28-plan-implementacion-manejo-de-errores.md) (20 KB) | Qué se porta de ARCA, con archivo de origen; Fases 0–3 | **El documento operativo.** §0.bis = estado |
| [HANDOFF Fase 0 cerrada](../2026-07-28-HANDOFF-manejo-de-errores-fase0-cerrada.md) (9 KB) | Dónde está el código, evidencia, deuda con disparador, censo | Al retomar la sesión |

**Advertencia que ordena todo el port** (plan §0): la carpeta `docs/12_Error_Handling_System/` de ARCA
describe el **motor n8n muerto** (migró a Temporal el 2026-06-15, ADR-050). Se porta desde el
**código** (`.ts` de activities, `.yml` de workflows), **nunca** desde esos docs.

---

## 3. Estado real — 2026-07-28

### 3.1 Los 12 puntos del mapa: 10 cerrados, 2 diferidos

| # | Qué era | Estado |
|---|---|---|
| 1 | Guard de doble emisión falla abierto | ✅ `cfc9d4f` `e40e9f3` — número reservado por el workflow + `ResultGet` lista + campo del CAE |
| 2 | La anulación cuelga al cliente para siempre | ✅ `9541079` — estado terminal + evidencia de la NC que no depende de un UPDATE posterior |
| 3 | Un turno roto mata la sesión permanente | ✅ `aba5152` — `workflow.patched`, aviso al usuario, sesión viva |
| 4 | Envíos duplicados a humanos | ✅ `1790c1b` — `idem_key` derivada del `activity_id`, índice único parcial |
| 5 | Certificado huérfano en AFIP con la clave ya gastada | ✅ `0dda5cd` — write-ahead: se guarda ANTES de autorizar |
| 6 | Temporal caído se reportaba como "no existe" (404) | ✅ `9541079` — sólo `NOT_FOUND` es 404; el resto, 503 |
| 7 | `confirmar` devolvía `{"ok":true}` con token inválido | ✅ `9541079` — Workflow Update + 409 `confirmacion_no_tomada` |
| 8 | 0/4 llamadas de red con timeout | ✅ `7c1e92a` — `AbortController` 20 s → `ApiError` 408 |
| 9 | RTBF que no ocurría y no avisaba | ✅ `85a1170` — `forget` levanta. **Corrección al mapa:** no era riesgo vivo (no está cableado) |
| 10 | Dos escrituras sin transacción + 409 que negaba lo hecho | ✅ `a82699e` — transacción real + chequeo antes del efecto + compensación |
| 11 | `openURL`/`Share` sin `catch` | ✅ `7c1e92a` — helper único; el alcance real eran 5 llamadas en 3 archivos, no todas |
| 12 | Sin `heartbeat_timeout` en ninguna activity | ⏸️ **diferido a Fase 1** — ver §6 |
| 0.1d | `existe_comprobante` fail-closed | ⏸️ **espera baseline** — ver §6 |

Cada fix tiene un test que mide el **daño** (cuántas facturas se emitieron, si el cliente quedó
poleando, si el efecto quedó puesto), no una excepción intermedia.

### 3.2 ✅ EN PRODUCCIÓN — desplegado y verificado el 2026-07-28

**PR [#154](https://github.com/theoriginalcustodian/copiloto-emprendedor/pull/154) mergeado
(`637a9ba`) y desplegado.** CI verde (backend 28 s / frontend 29 s).

Verificación en el sistema real — no la salida del deploy, sino el efecto:

| Control | Antes | Después |
|---|---|---|
| `reservar_numero_comprobante` | 0 archivos | **7** |
| `confirmacion_no_tomada` | 0 | **5** |
| `nota_credito_de` | 0 | **5** |
| `_idem_key_de_la_activity` | 0 | **2** |
| Control **negativo** (símbolo inventado) | — | **0** ✅ el grep discrimina |
| Gate `[4.9/7]` presente en el VPS | 0 | **1** |
| Errores en el journal post-deploy | — | **0** |

Los procesos arrancaron a las 23:58:09 con `date` en 23:58:49 — procesos **nuevos** de 40 s, no los
viejos con otro nombre.

**Y lo que de verdad podía romperse, las 112 ejecuciones en vuelo replayando con código nuevo:**

| | Antes | Después |
|---|---|---|
| `ConversationWorkflow` Running | 78 | **78** |
| `FacturaWorkflow` Running | 34 | **34** |
| `MpRefreshWorkflow` | 1 | **1** |
| Failed / Terminated | — | **0 / 0** |
| `NonDeterministicError` post-restart | — | **0** (control positivo: 7 líneas de journal) |

El gate de import corrió por primera vez en un deploy real y pasó (`import serve: OK`,
`import worker_b: OK`), y el smoke devolvió `{"status":"ok"}`.

<details>
<summary>3.2.bis — Estado anterior (histórico): "nada de esto está en producción"</summary>



**Medido 2026-07-28:**

```
git ls-remote --heads origin frente/manejo-de-errores   → vacío (NO pusheada)
git log --oneline -1 origin/main                        → 7f4d851
git rev-list --count origin/main..frente/manejo-de-errores → 16
```

Los 16 commits viven en una rama **local**. No hay PR. `origin/main` no tiene ninguno de los fixes.
**El VPS sigue corriendo el código con los bugs**, incluidos los tres de AFIP que reemiten facturas.

⚠️ La cadena se armó con `GIT_INDEX_FILE` temporal + `git commit-tree` (checkout compartido: nunca
`-A`, `--amend`, `rebase`, `reset`, `checkout`, `pull`, `stash`). El working tree sigue en
`feat/hito9-emitir-factura-por-voz`. **La rama `frente/manejo-de-errores` es lo único que ancla esos
objetos** — sin ella, un `git gc` los borra.

**Total del frente:** 61 archivos, +3375 / −152 (a `544f734`), más el censo posterior.

</details>

### 3.3 Evidencia (fecha de medición: 2026-07-28)

| Suite | Resultado |
|---|---|
| Backend + motor, venv del VPS | **1108 passed / 135 skipped** |
| `packages/core` (vitest) | **409 passed** · `tsc --noEmit` exit 0 |
| `apps/mobile` (jest) | **645 passed / 1 skipped** · `tsc --noEmit` exit 0 |

Comandos: `bash deploy/copiloto/sync-test-backend.sh tests ../../motor/backend/agent -q` ·
`cd packages/core && npx vitest run` · `cd apps/mobile && npx jest`.

**Contra el sistema vivo** (⏳ vence — re-medir antes de desplegar):

- Temporal del VPS **1.29.7**, Workflow Update **habilitado**, y el rechazo del validador llega al
  cliente. Spike propio: tipo de workflow y cola propios, cero contacto con datos reales.
- Un signal y un update **pueden compartir nombre de wire** — por eso el signal `confirmar` QUEDA.
- `FacturaWorkflow` **34** Running · `ConversationWorkflow` **78** Running · `AnulacionWorkflow` **0**
  en la ventana de retención, con **control positivo** del contador (namespace total = 432).
- `ON CONFLICT (a,b) WHERE pred DO NOTHING` con inferencia de índice parcial: verificado contra el
  **Postgres real** con `TEMP TABLE` + `ROLLBACK` (huella cero).

---

## 4. Lo que se decidió el 2026-07-28 y no está en ningún otro doc

Estas decisiones salieron de la conversación. Sin este archivo se pierden al compactar.

### 4.1 La autosanación vive en el cluster de Temporal, NO en GitHub Actions

Decisión explícita del operador. De ARCA se porta el **diseño del ciclo** (clasificar → contextualizar
con código + grafo → forjar parche → auditoría adversarial → proponer) y **sus guards**, no su
transporte. `copilot_autorepair.yml` es *un workflow disparado por un evento con guardarraíles*; en el
copiloto eso es un **workflow Temporal** disparado por una entrada de la DLQ — lo que además elimina a
GitHub como cola y aprovecha el moat (durabilidad, reintentos, visibilidad).

**HITL = el merge a main.** El agente propone PR, nunca mergea.

### 4.2 Instrumentar antes de escribir features; autosanar después de estabilizar

La app **no está terminada**: faltan funciones menores, más onboarding de clientes, gestión de tiers y
soporte técnico por chatbot. Pregunta del operador: ¿terminar todo primero? **No — se parte:**

| Va AHORA, antes de esas features | Va DESPUÉS de terminarlas |
|---|---|
| **Fase 1 — captura** (fingerprint + log estructurado) | **Fase 2 — DLQ** y **Fase 3 — autosanación** |

Razones para adelantar Fase 1:

1. Es **transversal**. Onboarding, tiers y soporte son código nuevo: escritos sin instrumentación,
   obligan a volver a pasar por todos. El costo de retrofit crece con cada archivo.
2. El log necesita **tiempo de vuelo**. El fail-closed de `existe_comprobante` (0.1d) espera 30 días
   de baseline que **no empiezan a correr** hasta que haya log estructurado.
3. Sin captura, un fallo en el onboarding de un cliente nuevo se ve como hoy: **nada**.

Razón para diferir 2 y 3: el propio plan lo exige — autosanar pide superficie chica y **estable**. Un
agente reparando código que todavía muta propone parches sobre estructura que va a cambiar.

**En una línea: instrumentar antes de escribir, autosanar después de estabilizar.**

### 4.3 El plan NO está listo para ejecutarse de corrido, y está medido

Medición sobre `2026-07-28-plan-implementacion-manejo-de-errores.md`:

| Fase | Líneas | Filas con criterio de cierre binario |
|---|---|---|
| Fase 0 | 20 | **12** |
| Fase 1 | 9 | **0** |
| Fase 2 | 7 | **0** |
| Fase 3 | 18 | 2 (y son *qué se sana solo*, no criterios de cierre) |
| G-2 | 9 | 0 |

Fase 0 era el único plano ejecutable. Fases 1 y 2 son bullets con punteros a ARCA: sin schema de la
tabla de traumas, sin contrato de contexto cerrado, sin criterio de terminado por ítem. Fase 3 son 18
líneas de prosa: la decisión y los guards, pero **cero diseño** de workflows, disparo desde la DLQ,
acceso del agente al código y al grafo, o kill switch.

**Y hay prueba de que lo escrito no está calibrado:** el censo (§5) midió que Fase 1 asumía tapar 71
`except` cuando el trabajo real era instrumentar. La fase inmediatamente siguiente estaba equivocada.

### 4.4 Qué hacer antes de escribir el plan quirúrgico — en este orden

1. ~~**Spike de la población real de errores.**~~ **YA ESTÁ HECHO — ver §5.bis.** Lo propuse como
   primer paso y el análisis del 28-07 ya lo había medido contra el journal del VPS (7 días). Corregido
   acá para que nadie lo vuelva a correr: **lo que falta no es medir la población, es instrumentar para
   que la población futura sea legible.** El journal alcanza para arrancar la taxonomía (1.3) con datos
   reales; el `FLOOD_THRESHOLD` (2.3) y el schema de traumas (2.1) se calibran con lo de §5.bis.
2. **Trifecta cognitiva sólo para Fase 3** (SOTA con los dos lentes + failure map + decision matrix).
   Autosanación durable con agente + grafo es un dominio donde no hay diseño escrito y no somos
   senior. Fases 1 y 2 **no** la necesitan: son port de ARCA con el código a la vista.
3. **Recién ahí el plan quirúrgico**: tabla con cierre binario por ítem, como tuvo Fase 0, para las
   tres fases y G-2.

**Lo que NO se debe hacer:** escribir las tres fases completas ahora. Un plan detallado sobre
supuestos no medidos **se lee como precisión y es adivinanza con formato de tabla**.

### 4.5 Desplegar antes de seguir planificando

Los 10 fixes están terminados y verificados, y **su valor es cero mientras no se desplieguen** (§3.2).
Acordado: PR + merge + deploy bajo la autorización permanente ya registrada, **antes** de seguir con
el diseño de las fases siguientes.

---

## 5. El censo de Fase 1 y por qué dio vuelta la fase

Herramienta: **`scripts/censo-except.py`** (idempotente, read-only, re-ejecutable). Cruza dos ejes
independientes: **qué le pasa al error** × **hay un porqué escrito al lado**.

**147 handlers** en `apps/copiloto` + `motor` (sin tests ni `conftest`):

| destino del error | documentado | mudo |
|---|---|---|
| relanza | 17 | 38 |
| deposita | 5 | 1 |
| solo_log | 16 | 2 |
| informa (409, motivo en pantalla, `ToolResult` de error) | 9 | 12 |
| **evapora** | 18 | **29** ← la cola que se leyó a mano |

**Resultado: de los 29, CERO son un fallo evaporado nuevo y vivo.**

- `afip_gateway.py:182` — es **0.1d**, diferido a propósito con disparador. No es hallazgo: es deuda
  con dueño y fecha.
- `conversation_workflow.py:349` — el `pass` del timeout de HITL convierte un fail-**closed** (esperar
  al humano) en fail-**open** (mandar la respuesta que el dominio marcó como no apta para salir sin
  revisión), sin rastro. **Latente, no vivo:** `escalate=True` sólo lo setea
  `motor/backend/agent/dispatch.py:48`, el dispatcher de **ejemplo** del motor;
  `dispatcher_emprendedor.py` nunca escala, y en modo react esa rama ni se ejecuta.
  **Arreglarlo igual** — es barato y se activa el día que alguien encienda la escalación.

El resto es best-effort legítimo (parseo con fallback, formateo cosmético, `warm_session`) o convierte
a un error de negocio que el emprendedor **sí** ve en el chat.

> ⚠️ **Lo que esto cambia.** El número crudo del mapa (99 `try`, 71 "evapora") sugería *tapar
> agujeros*. Medido, es lo opuesto: **los handlers manejan bien y no dejan rastro consultable**
> (`dlq=0 fingerprint=0 structlog=0`). Fase 1 no es corregir 71 `except` — es **instrumentar los que
> ya deciden bien**, para que la autosanación tenga sobre qué operar. El trabajo se corre de 1.4
> (clasificar) a **1.1 + 1.2** (fingerprint + log estructurado).

---

## 5.bis Población real de errores — MEDIDA, no supuesta (journal del VPS, 2026-07-28)

Está en el [análisis de la app](../2026-07-28-analisis-manejo-de-errores-toda-la-app.md) §6.bis. Se
levanta acá porque es el insumo de la taxonomía (1.3) y del `FLOOD_THRESHOLD` (2.3), y porque su
lectura ingenua engaña.

**Últimas 24 h:** 0 líneas con traceback o error. **Control positivo del instrumento:** 169 líneas
totales, 155 requests 2xx en web, 2 líneas en el worker — el journal responde, no está mudo.

**Ampliado a 7 días** (7051 líneas web / 700 worker):

| Clase | N |
|---|---|
| `Traceback` | 29 |
| `NonDeterministicError` (WARN del SDK) | 20 |
| `ImportError` | 15 |
| `NonRetryableError` (esperado) | 2 |
| `HTTPError` / `AttributeError` | 2 / 1 |

**Las dos cadenas causales que explican casi todo:**

1. **Los 15 `ImportError` (21-jul)** — `cannot import name 'make_consultar_anulacion' from 'web'`, por
   un deploy desincronizado. Causa raíz: `deploy/copiloto/deploy.sh` **valida la config de Caddy**
   (líneas 213/243) pero hace `systemctl restart` del backend **sin validar el import de Python**
   (línea 162). El asimétrico es el bug.
2. **Los 20 `NonDeterministicError`** — un `AfipOnboardingWorkflow` de un usuario real terminó
   `WorkflowExecutionFailed` (event id 11). Durante 20 min (18:10→18:30) una IP real refrescó
   `/afip/perfil` y `/afip/estado`; la query sobre el workflow ya fallado reventó 12 veces con
   `[TMPRL1100] Nondeterminism error`. **El endpoint devolvió `200 OK` las 12 veces** — es el punto #6
   del mapa (`except Exception: return None`) visto desde producción, con un usuario real del otro
   lado.

⚠️ **Dato que condiciona toda medición futura:** `Config.WorkflowExecutionRetentionTtl = 24h0m0s` en el
namespace `default`. **La ventana de Visibility es de 24 h** — por eso `AnulacionWorkflow` contó 0
(§3.3): no prueba que no haya habido anulaciones, prueba que no las hubo *en las últimas 24 h*.
Cualquier conteo de workflows que se use como evidencia tiene esa fecha de vencimiento pegada.

**Y una corrección de medición propia ya registrada en el análisis:** la primera versión decía "428
Running"; sumaba los 291 `GraphDrainWorkflow` **Completed**, por asumir que `temporal workflow list
--limit 500` devuelve sólo abiertos. La query explícita `ExecutionStatus = 'Running'` corrigió a **115
abiertos** (`ConversationWorkflow` 80 · `FacturaWorkflow` 34 · `MpRefreshWorkflow` 1).

---

## 5.ter Lo que el análisis encontró y NO entró en los 12 puntos

Esto **no está arreglado** y no es deuda diferida: es alcance que el mapa no cubrió.

### La clase raíz del repo: "el fix existe y no se propagó" (8 instancias verificadas)

El patrón correcto se escribió una vez, se testeó, y **no llegó a los sitios hermanos** — varios en el
mismo archivo, líneas más abajo. Es la clase que más pesa, y la que justifica el gate mecánico (G-2):

1. `errores_web.conflicto()` cubre sólo los 409: **12 de ~90 emisiones de error (13%)**. Unas 46×400,
   22×404, 6×503, 401 y 403 viajan con `detail` en prosa.
2. `ApiError.body` existe, pero `packages/core/src/api/afip.ts:483` sigue bypasseando `apiClient`
   citando como razón justo lo que `ApiError.body` ya resolvió → `guardarPerfil`/`conectarArca` sin
   refresh-on-401.
3. Refresh-on-401 falta en `postMultipart` (`client.ts:162`) y en `apps/copiloto-web/src/lib/api/audio.ts`
   → **dictar con token vencido = logout + audio perdido** (se borra en el `finally`).
4. PR #114 no llegó a `afip_anulacion_workflow.py:98-101` ni a `web.py:274-279` — *(cerrado: puntos #2
   y #6 del mapa)*.
5. El molde log-antes-de-degradar de `memory_provider.py` no llegó a `presupuesto_doc.registrar_en_sheet`,
   `services/__init__.py:18`, `mercadopago_gateway.py:119`.
6. El molde timeout-bajo-`start_to_close` de `llm.py` no llegó a `composio_gateway.py:94` (`Composio()`
   sin timeout) ni a `afip_gateway.py:100`. **Sólo 2 de 6 gateways lo tienen.**
7. El patrón try/catch→estado→JSX está bien en ~40 sitios de mobile y ausente en
   `PantallaMiDia.avanzar()/borrar()` — mismo archivo que un `cargar()` impecable — *(parcialmente
   cerrado: punto #11)*.
8. `deploy.sh` valida Caddy y no valida el backend → los 15 `ImportError` de §5.bis.

### Huecos estructurales sin dueño

| Hueco | Medida | Por qué importa |
|---|---|---|
| **0 `ErrorBoundary`** en `apps/mobile` (215 archivos) y en `apps/copiloto-web`; 0 `window.onerror`/`unhandledrejection` en la PWA; 0 `ErrorUtils` en mobile | 0 | Un throw en render deja pantalla en blanco, sin rastro |
| **Cero ESLint / ruff / flake8** en todo el repo. Sólo `tsc --strict` | 0 | G-2: no hay gate mecánico |
| **CI corre 11 de 92 tests Python (12%) y 0 de 96 de TS**; no corre `typecheck`; `test_errores_web.py` **no está** en la lista | 11/92 · 0/96 | El guard de los 409 no corre en CI |
| **6 loggers reales en 32k LOC** de backend; 27 `catch` en PWA y 61 en mobile, **0 con rastro** | 6 · 0 | Es el argumento entero de Fase 1 |
| **0 tests de resiliencia** (timeout de gateway, activity que lanza, worker que muere a mitad) | 0 | Todo lo de Fase 0 se testeó al agregarse, no antes |
| `codigoDeConflicto` hace `as CodigoConflicto`: un código nuevo del backend **entra casteado** y cae en `default` en silencio | — | Los dos catálogos de 11 coinciden por disciplina, no por mecanismo |

### El bug que bloquea una feature del producto

`motor/backend/agent/conversation_workflow.py:555` — `trace.append(tc["name"])` corre para cualquier
status `!= "needs_confirmation"`, **incluido `"error"`**. El guardrail anti-narración (`:509`) usa
`trace` para decidir el retry `required`: **una tool que falló se registra igual que una exitosa**. Es
la raíz de *"el copiloto dice 'ya lo marqué' y no llamó la tool"*
([[copiloto-narra-la-accion-sin-ejecutarla]]) — y **refuta** la hipótesis previa de que el historial
descartaba los `tool_calls` (`:389-390`, `:553-554` los apendean siempre, también en error).

Sostiene el flag `MODO_AUTOMATICO_NO_DISPONIBLE`, que **bloquea el modo automático del producto**, y
**cero test lo ejercita**. Costo estimado del fix: 1 línea + 1 `workflow.patched(...)` + 1 test.
⚠️ Vive dentro de `workflow.patched("narra-guardrail-required-retry")` → necesita **su propio patch
nuevo**, no reusar ese.

### Hipótesis refutadas — no re-litigar

- *"El historial descarta los `tool_calls`"* → **falso** (ver arriba).
- *"Un 500 puede filtrar stack/SQL/credenciales"* → **falso**: sin `debug=True`, Starlette responde
  `PlainTextResponse("Internal Server Error")` fijo. El riesgo real es que **no queda log**.
- *"`getLogger` sin `basicConfig` ⇒ logs al vacío"* → **falso**: `logging.lastResort` manda `warning+`
  a stderr y el unit tiene `StandardOutput=journal`. **`_log.warning` sí llega a journald; `.info` no.**
- *"Los `.catch(() => {})` del grep son fallos silenciosos"* → **falso en la mayoría** (el grep no
  expandió el cuerpo); sólo 2 casos genuinos, ambos documentados.
- *"`crearCliente` bypassea `apiClient`"* → **ya no**; el único bypass vigente es `afip.ts:483`.

---

## 5.quater De INL: lo que se adopta (metodología, no código)

Del [doc de metodología](../2026-07-28-metodologia-inl-manejo-de-errores.md). Tesis: *"el error no es
una excepción que aborta: es un dato de primera clase que se captura, se sella, se difiere y se sana
solo"*. Criterio de éxito del operador: *"puedo apagar la computadora e irme sin que colapse."*

- **A-4 Trauma Empaquetado, los 4 pasos:** Captura (payload + estado + metadatos) → Encapsula
  (contenedor atómico) → Deposita (DLQ) → **Continúa** (sigue con el resto del volumen). El usuario
  nunca ve un error fatal: ve **"procesamiento diferido"**.
- **Agente de Sanación:** patrulla la DLQ en ciclos de baja demanda → extrae el trauma → evalúa si las
  condiciones externas se restauraron → reinyecta. Es un **circuit breaker con half-open probe
  aplicado a la cola**. Y **jamás mergea**: PR + humano aprueba (Ley F-6).
- **`ERROR_MAP` declarativo** (A-1): `{429: {tipo:'RATE_LIMIT_EXTERNO', reintentable:true, espera_seg:30}}`,
  con traducción al lenguaje del dominio propio.
- **Umbral: ≥3 instancias ⇒ falla de generador** (o >2 h de debugging). Es exactamente el criterio que
  la clase raíz de §5.ter dispara — 8 instancias.
- ⚠️ **A-4 no está implementado en ninguna parte del repo de INL.** Es prescripción, no código
  probado. Lo implementable sale de **ARCA** (plan §1), no de INL.

---

## 6. Deuda diferida — con su disparador, no "para después"

| Qué | Por qué se difirió | Disparador exacto |
|---|---|---|
| **#12 `heartbeat_timeout`** | No es una línea: ponerlo sin que la activity llame a `activity.heartbeat()` **hace fallar** a las largas — el RPA de AfipSDK tarda ~2 min por llamada. Exige decidir activity por activity cuáles son largas y pueden latir | Va **dentro de Fase 1** (observabilidad) |
| **0.1d `existe_comprobante` fail-closed** | Lección documentada de ARCA (`12_DUAL_CHECK:139`): un falso positivo **bloquea comprobantes legítimos**. ARCA tomó la decisión opuesta a la intuición y la dejó escrita | **30 días de baseline** con el log estructurado de Fase 1 ya puesto, sin falsos positivos |
| **`conversation_workflow.py:349`** | Latente (§5): ningún dispatcher del copiloto escala | Antes de que alguien habilite `escalate=True` en el dominio emprendedor |

La deuda de 0.1d está anotada **en el código**, sobre el test que hoy CONFIRMA el fail-open en vez de
vigilarlo (`test_afip_gateway.py::test_existe_comprobante_no_explota_si_el_ws_falla`), con propietario.

---

## 7. Inventario de lo reusable — verificado, no supuesto

Canon 3: todo diseño abre con inventario de lo existente. Verificado el 2026-07-28:

| Pieza | Path | Estado |
|---|---|---|
| `evento_store.registrar_evento` | `apps/copiloto/evento_store.py:55` | ✅ vivo — log de eventos de negocio append-only |
| `provision.py::_ensure_*` | `apps/copiloto/provision.py` (11 funciones) | ✅ vivo — el mecanismo idempotente para la tabla de la DLQ. **No inventar otro** |
| `errores_web.CODIGOS` + `conflicto()` | `apps/copiloto/errores_web.py` | ✅ vivo, con guard mecánico (`test_ningun_409_escrito_a_mano`) |
| `scripts/inventario-errores.sh` | `scripts/` (10 KB, ejecutable) | ✅ existe — base del catálogo re-ejecutable de 1.4 |
| `scripts/censo-except.py` | `scripts/` | ✅ nuevo (§5) |
| `xmax = 0` para distinguir INSERT de UPDATE | `afip_comprobante_store.py:63` | ✅ **mismo linaje que el upsert de ARCA** |

⚠️ **Corrección importante.** `grafo_writer` estaba anotado como *"el mejor ciudadano del repo, de ahí
sale la DLQ"*. Es el mejor **diseño** (`Idempotency-Key` real, `chequeos_fallidos`,
`invalidaciones_pendientes`), pero **NO es un mecanismo vivo del que colgarse**: `GrafoWriter` **sólo
se instancia en `test_grafo_writer.py`** — ningún camino de producción lo llama (control:
`grep -rn "GrafoWriter" .` → el módulo, su test, y `grafo_mapeo.py` que importa sólo
`Dataset`/`Invalidacion`). Y `invalidaciones_pendientes` es una **lista en un dataclass**, no una
tabla: muere cuando termina el `write()`. **Se porta el patrón; la persistencia hay que construirla.**

---

## 8. Método de trabajo acordado

- **De corrido, sin PR por ítem.** Instrucción del operador: *"no hagas commit/PR/merge por cada
  issue… es antiineficiente… es mejor trabajar de corrido"*, reforzada con *"ves por qué no hay que
  hacer commits/PR de continuo: va surgiendo nueva información"*. Se abre **un** PR al cerrar el
  frente. **Excepción acordada §4.5:** los fixes de Fase 0 se despliegan ya, porque están terminados.
- **Tests en el VPS**, no en la PC. No declarar verde sin correrlo ahí.
- **Checkout compartido:** `git add` con rutas explícitas. Nunca `-A`, `--amend`, `rebase`, `reset`,
  `checkout`, `pull`, `stash`, `clean`.
- **Invocar `temporal-developer`** antes de tocar cualquier workflow/activity/worker.

---

## 9. Errores de método ya cometidos en este frente — para no repetirlos

Los cuatro primeros están en `memoria/` con detalle; los dos últimos son de la sesión del 28-07.

1. [[anotar-adentro-el-efecto-externo-en-el-instante]] — apareció **dos veces el mismo día** en
   módulos sin relación.
2. [[un-test-sin-cota-cuelga-en-vez-de-decirte-que-falta]] — un `while` sin cota se comió un turno;
   con cota, dio la causa exacta en 2 segundos.
3. [[el-test-que-canoniza-el-bug-como-si-fuera-el-contrato]] — dos tests **afirmaban el fallo**;
   "arreglarlos" habría deshecho el fix.
4. [[derivar-la-clave-dentro-de-la-activity-no-tocar-el-payload]] — idempotencia sin tocar 78
   workflows vivos.
5. [[el-control-corrido-contra-la-base-equivocada]] — `git diff --numstat` dio "7 agregadas, 0
   borradas" y el commit igual dejó afuera 4 entradas: el control comparaba contra la rama chequeada,
   no contra el padre real de la cadena.
6. **Parar al cerrar una fase, sin que nadie lo pidiera.** El plan dice *"el disparador de cada fase es
   el criterio de cierre de la anterior"* — eso es una **dependencia técnica** (Fase 1 no puede
   empezar antes), no un punto de control con el humano. Cerré Fase 0, escribí HANDOFF y memorias, y
   me detuve, cuando la instrucción era trabajar de corrido hasta terminar. Es la tercera vez que
   ocurre ([[ejecutar-autonomo-no-esperar-si-dale]],
   [[ejecutar-la-cola-acordada-no-es-una-decision-de-scope]]): la memoria existe y **no funciona como
   gate**.

7. **Un guard que grita en el caso normal se desarma solo**
   ([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]). El guard de drift de `deploy.sh` abortó
   un deploy legítimo: reportó 1502 líneas con el disco byte a byte igual a main, porque medía contra
   el índice de la rama chequeada. Corregido con índice temporal, verificado en las dos direcciones.
8. **`UNKNOWN` no es `NO`** ([[unknown-no-es-no-el-estado-que-el-proveedor-aun-calcula]]). Reporté que
   el auto-merge no se había activado leyendo un estado que GitHub todavía calculaba. Sí se activó: el
   merge ocurrió 14 s después del CI verde.
9. **Un flag `--since` acota su paso, no el pipeline**
   ([[el-flag-incremental-que-solo-acota-el-ultimo-paso]]). 17 min para pushear 1 archivo: extracción
   y reconcile del grafo son ciegos al `--since` **por diseño**. Optimicé la entrada de un pipeline
   cuyo costo está en la salida.

**El patrón que atravesó la jornada: tres ceros que se veían iguales y no lo eran.** Los símbolos
ausentes en el VPS eran un cero **real** (control positivo: `emitir_comprobante` → 8); los workflows
de Temporal, un cero **falso** (el CLI vive en un contenedor y no existía en esa sesión SSH); los
"archivos sobrantes" y el log de `--since`, ceros **inválidos** — un `sed` roto y un `tail -6` míos
habían vaciado la fuente antes de medirla. Ninguno vale sin su control al lado
([[vacio-no-es-hallazgo-correr-el-control]]).

Y una del harness que **sí** funcionó: el guard `test_ningun_409_escrito_a_mano` frenó un
`HTTPException(409)` escrito a mano y mandó a la maquinaria que ya existía
([[guard-caza-algo-distinto-de-lo-que-vigilaba]] — leer el rechazo antes de aflojarlo).

---

## 10. Lo siguiente

1. ~~PR + merge + deploy~~ — **HECHO y verificado** (§3.2). El gate de import entró en el mismo
   movimiento y corrió por primera vez en un deploy real.
2. ~~Spike de población real de errores~~ — **ya medido**, §5.bis.
3. **Trifecta cognitiva de Fase 3** (§4.4 punto 2) — el único diseño que falta de raíz.
4. **Plan quirúrgico** de Fases 1-3 + G-2 con cierre binario por ítem (§4.4 punto 3), incorporando el
   alcance de §5.ter que el mapa de 12 puntos no cubría.
5. **Fase 1 implementada antes** de onboarding / tiers / soporte (§4.2).

**Candidatos de alto impacto ÷ costo que ya están identificados** (del §7 del análisis) y deberían
entrar al plan quirúrgico, no perderse:

| Qué | Costo estimado |
|---|---|
| `conversation_workflow.py:555` → condicionar a `status == "ok"` — **desbloquea el modo automático** | 1 línea + 1 `patched` + 1 test |
| `ErrorBoundary` raíz en `_layout.tsx` y `App.tsx` + `window.onerror`/`unhandledrejection` en la PWA | 2 archivos |
| Meter `test_errores_web.py` + `typecheck` + `core:test`/`mobile:test` en CI; ESLint con `no-empty`, `no-floating-promises`, `require-await` | 1 workflow + 1 config |
| Validar el import de Python en `deploy.sh` antes del `systemctl restart` | 1 línea |
