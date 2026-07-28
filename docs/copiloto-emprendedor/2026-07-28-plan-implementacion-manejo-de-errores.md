# Plan de implementación — manejo de errores INL en el copiloto

> **Fecha:** 2026-07-28 · **Objetivo declarado por el operador:** *que el software pueda mantenerse solo, con HITL principalmente en el merge a main, hasta que el sistema madure y pueda auto-operarse.*
>
> **Insumos:** [mapa de puntos de fallo](2026-07-28-mapa-puntos-de-fallo-del-sistema.md) · [metodología INL](2026-07-28-metodologia-inl-manejo-de-errores.md) · [auditoría de la app](2026-07-28-analisis-manejo-de-errores-toda-la-app.md).

---

## 0. Inventario de lo existente — qué se extiende, no qué se crea

Regla del repo: todo diseño abre con esto. Casi nada de A-4 se construye de cero.

| Pieza que A-4 necesita | Ya existe | Evidencia | Qué falta |
|---|---|---|---|
| Tabla multi-tenant con RLS | `provision(spec, conn)` crea `POLICY tenant_isolation` automáticamente | `deploy/worker/provision_tables.py:89-115` | sólo el spec de la tabla nueva |
| **Log append-only con payload libre** | `copiloto_eventos` + `registrar_evento(cur, cliente_id, *, entidad_tipo, entidad_id, evento, datos: dict)` | `evento_store.py:55-57` | el mismo patrón, otra tabla |
| Estructura de pendientes | `invalidaciones_pendientes`, `chequeos_fallidos` | `grafo_writer.py:115-141` | generalizarla |
| `Idempotency-Key` hacia afuera | ya se manda a Graphity structured | `grafo_writer.py:100` | replicar el criterio |
| Clave de idempotencia en workflow | `_react_idem_key()` | `conversation_workflow.py:450` | **usarla** en 2 activities que no la usan |
| Taxonomía transitorio/permanente | 4 embriones sin nombre común | `llm.py:30` · `afip_gateway.py:20-34` · `composio_gateway.py:33-62` · `graphity_memory_client.py:34` | unificar el vocabulario |
| Códigos de error canónicos hacia el cliente | `errores_web.py` + `conflicto()` valida contra `CODIGOS` en runtime | `errores_web.py:26-65` | extender de 409 a 4xx/5xx |

**La conclusión del inventario:** el copiloto ya tiene el **log** (`copiloto_eventos`), el **provisionado con RLS**, el **patrón de append inmediato** y un **caso de referencia de fail-open trazable** (`grafo_writer`). La DLQ de A-4 es una tabla hermana de `copiloto_eventos` con el mismo mecanismo — no una pieza de infraestructura nueva.

---

## 1. El orden, y por qué no es L0→L5

INL numera la escala L0→L5, pero **implementarla en ese orden sería un error acá**, por dos razones medidas en el mapa:

1. **Los pasos 2-4 de A-4 no tienen sobre qué operar sin el paso 1.** No se puede encapsular, depositar ni sanar un error que se evaporó en un `except: return None`. Y hoy hay 22 sitios así, más 42 `except` genéricos sólo en backend-app.
2. **Un guard fail-open es peor que no tener guard.** Produce confianza falsa: el sistema *cree* que está protegido contra la doble emisión fiscal y no lo está. Sanar automáticamente encima de eso amplifica el daño en vez de contenerlo.

Por eso el orden es: **cerrar lo que miente → capturar → depositar → sanar**, con el gate mecánico como precondición transversal.

---

## Fase 0 — Cerrar los fail-open (lo que produce daño real hoy)

Nada de esto es infraestructura nueva. Son cambios quirúrgicos en puntos identificados con `archivo:línea`.

| # | Cambio | Dónde | Criterio de cierre (binario) |
|---|---|---|---|
| **0.1a** | **El check-before-act interroga el ÚLTIMO autorizado, no el siguiente.** Hoy pregunta por `ultimo+1`, que por construcción nunca fue emitido — el guard no puede dar `True` en el escenario que dice cubrir. Debe consultar `info_comprobante(ultimo)` y **comparar su contenido contra el payload** (importe, `DocNro`, fecha) para decidir si ese comprobante es nuestro y adoptarlo. El código de adopción ya existe (`:95-109`), sólo apunta al número equivocado. | `afip_factura_activities.py:94-95` | test adversarial: AFIP autoriza y la activity lanza antes de `registrar` → el reintento **adopta** el comprobante existente, **no emite uno nuevo**. Hoy emite el siguiente número. |
| **0.1b** | **`existe_comprobante` deja de tragar `ErrorAfip`** (segunda vía al mismo daño, independiente de 0.1a). Si no puedo *confirmar*, **no emito**: la excepción propaga. Fail-**closed**. | `afip_gateway.py:155-158` | test: gateway cuyo `getVoucherInfo` lanza `ErrorAfip` → `emitir` **no** llama a `createNextVoucher`. Hoy sí lo llama. |
| 0.2 | **`marcar_comprobante_anulado` dentro de `try/except`** + estado terminal explícito en el `except`. | `afip_anulacion_workflow.py:98-101` | test: activity que agota reintentos → `estado()` devuelve `terminado: True` con motivo. Hoy devuelve `"emitiendo_nota_credito"` para siempre. |
| 0.3 | **`consultar_*` distingue "no existe" de "Temporal caído"** → 503, no 404. | `web.py:169,268,348` → `afip_web.py:274` | test: cliente Temporal que lanza error de conexión → HTTP **503**; workflow inexistente → **404**. |
| 0.4 | **`confirmar` factura deja de devolver `{"ok": true}` con token inválido.** | `afip_web.py:311-328` (TODO propio, `:320-327`) | test: token desactualizado → respuesta que el cliente puede discriminar. |
| 0.5 | **`idem_key` en `send_channel_message` y `notify_staff`.** `_react_idem_key()` ya existe. | `agent_activities.py:51-59,62-70` | test: activity que envía y luego lanza → el reintento **no** duplica el envío. |
| 0.6 | **`try/except` de cierre en `ConversationWorkflow`** para el agotamiento de reintentos → mensaje legible en vez de muerte abrupta de la sesión permanente. | `conversation_workflow.py:249-533` | test: `call_llm` que agota 5 intentos → la sesión sobrevive y el usuario recibe un mensaje. |
| 0.7 | **`catch` en `Linking.openURL` / `Share.share`.** El patrón correcto ya está en `DetallePresupuesto.tsx:223-233` — es propagar, no diseñar. | `DetalleComprobante.tsx:128-134` | test: promesa rechazada → se muestra algo. |
| 0.8 | **Timeout canónico en el transporte del cliente** (`AbortController`), un solo lugar. | `http.native.ts:37,54` · `http.web.ts:41` | 0 → 4 llamadas con timeout; test de request que nunca resuelve → falla acotada. |

**Nota sobre 0.1 — el riesgo del cambio.** Pasar a fail-closed significa que ante AFIP inestable **no se emite** y el caso queda pendiente. Eso es correcto (una factura no emitida se reintenta; una emitida dos veces exige nota de crédito), pero **exige la Fase 2 para no perder el caso**. Hasta que la DLQ exista, el caso queda en estado `pendiente` consultable — no en el aire.

---

## Fase 1 — Que ningún error se evapore (A-4 paso 1: Captura)

Hoy: `fingerprint=0 · structlog=0 · sentry=0 · request_id=0` en las 4 capas.

**1.1 — Fingerprint canónico.** INL lo especifica como `(workflow + nodo + error_type + payload_shape)`. Un módulo único, sin dependencias nuevas.

**1.2 — Log estructurado JSON.** Hoy hay 3 `getLogger` en app y 1 en motor, sin `basicConfig`. El log llega a journald por `logging.lastResort` — funciona, pero no es parseable ni correlacionable.

**1.3 — Taxonomía única transitorio/permanente.** Existen 4 embriones; falta el vocabulario común. Es el `ERROR_MAP` de A-1, y su output alimenta directamente `RetryPolicy.non_retryable_error_types` — que ya está cableado para `NonRetryableError` (`llm.py:30` → `LOOP_RETRY`).

**1.4 — Barrido de los 22 `except` silenciosos**, clasificando cada uno: *best-effort legítimo* (como `warm_fn`, `web.py:589-595`, que declara la intención y loguea) vs *error tragado*. No todos son bugs — la clasificación es el trabajo.

**Criterio de cierre:** todo error que hoy termina en `return None` deja una entrada con fingerprint, o está explícitamente declarado best-effort con log.

---

## Fase 2 — Que ningún error frene el sistema (A-4 pasos 2-4)

**2.1 — La tabla `copiloto_traumas`**, hermana de `copiloto_eventos`: mismo `provision()`, misma RLS `tenant_isolation`, mismo patrón de append. Campos derivados de los 4 pasos de A-4: `fingerprint`, `payload`, `estado_al_fallar`, `metadatos`, `intentos`, `proxima_evaluacion`, `estado`.

**2.2 — `registrar_trauma(cur, cliente_id, *, fingerprint, payload, …)`**, espejo de `registrar_evento`.

**2.3 — El usuario nunca ve un error fatal.** INL es explícito: ve *"procesamiento diferido"*. Esto **cruza la junta backend↔app** → exige un `contrato_` antes de que ninguna capa lo implemente (regla de las tres sesiones).

**Criterio de cierre:** un fallo de emisión con AFIP caído deja fila en `copiloto_traumas`, el workflow termina en estado consultable, y el usuario ve "diferido", no un 500.

---

## Fase 3 — Auto-reparación (L5 / Agente de Sanación)

Lo que INL diseña y **nunca implementó** — sería la primera implementación real del patrón.

La clave, textual del framework: el agente **no reintenta a ciegas**, sino que *evalúa si las condiciones externas se restauraron* antes de reinyectar. Es un circuit breaker con *half-open probe* sobre la cola.

**Precondición dura:** sólo se reinyecta lo **idempotente**. El mapa ya clasificó qué lo es y qué no:
- **Reinyectable:** lecturas, `avanzar_tablero_mi_dia` (`ON CONFLICT` real), cobros e ingresos (`idem_key` + índice único), `add_messages` una vez que tenga `Idempotency-Key`.
- **NO reinyectable sin HITL:** emisión fiscal, `crear_certificado` (RPA + secreto one-shot), `refresh_credential` (MP rota el token).

Esa frontera **es** el HITL del sistema maduro: lo idempotente se sana solo, lo demás espera al humano.

---

## Transversal — G-2: el gate mecánico es la precondición del HITL en el merge

Si el humano sólo mira el merge, **lo que no atrape el CI no lo atrapa nadie.** Hoy: cero ESLint, el CI corre **11 de 92** tests de Python y **0 de 96** de TS.

Esto es lo que INL diagnostica como *"una regla que no puede garantizarse estructuralmente es hardcoding emocional"*, y es la causa raíz medida de la clase *"el fix existe y no se propagó"* (8 instancias). **Sin esto, cada fase de este plan se degrada con el tiempo exactamente igual.**

⚠️ Toca a las tres sesiones → requiere coordinación por el buzón antes de tocarlo.

---

## Lo que este plan NO hace

- **No persigue cero-deuda absoluto.** `evento_store.py:7-19` es el modelo a imitar: deuda **deliberada, visible, con propietario y condición de pago**. El enemigo es la invisible y la impaga.
- **No implementa C-4 (memoria bitemporal) ni C-5 (diagnóstico zero-trust).** Están en la metodología INL, no son manejo de errores en runtime.
- **No toca la retención de Temporal (24 h).** Es una decisión de infraestructura, MAYOR, separada.

## Orden de ejecución y su razón

**Fase 0 → 1 → 2 → 3**, con G-2 arrancando en paralelo a la Fase 1 (no depende de nada).

La Fase 0 es la única con **daño real demostrable hoy** y no depende de infraestructura nueva. La 1 es precondición de la 2 y la 3. La 3 no puede empezar antes que la 2 porque no tendría cola sobre la cual operar.

**El disparador de cada fase es el criterio de cierre binario de la anterior**, no una estimación de tiempo.
