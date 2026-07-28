# Mapa de puntos de fallo del sistema — insumo del plan de manejo de errores

> **Fecha:** 2026-07-28 · **Ref:** `origin/main` @ `7f4d851` (censo) + working tree `feat/hito9-emitir-factura-por-voz` (lecturas dirigidas).
> **Qué es:** el inventario de **dónde puede fallar el copiloto**, con evidencia `archivo:línea`, clasificado por los tres ejes que deciden el tratamiento: **nivel de resiliencia actual (L0–L5 de INL)**, **si la operación es idempotente**, y **qué patrón INL le corresponde**.
> **Qué NO es:** el plan de implementación. Este documento es el insumo del plan, no el plan.
>
> **Insumos:** [`2026-07-28-analisis-manejo-de-errores-toda-la-app.md`](2026-07-28-analisis-manejo-de-errores-toda-la-app.md) (auditoría de la app) · [`2026-07-28-metodologia-inl-manejo-de-errores.md`](2026-07-28-metodologia-inl-manejo-de-errores.md) (metodología INL) · censo `scripts/inventario-errores.sh` · grafo `graphity-code` · 4 barridos dirigidos por capa.

---

## 0. Método y sus controles

Cuatro barridos read-only con **globs exclusivos y sin solapamiento** (capa durable · gateways externos · front-door HTTP + stores · cliente TS + UI), cada uno obligado a citar `archivo:línea` y a declarar una sección **"lo que no pude verificar"**. Los huecos que los cuatro dejaron abiertos los cerré yo leyendo el código.

**Controles del instrumento** (sin esto los ceros de §3 no valen nada):

| Control | Resultado |
|---|---|
| control+ del censo (`def` en backend, debe dar >0) | **1501** ✅ |
| control− del censo (patrón inexistente, debe dar 0) | **0** ✅ |
| control+ de `ls-remote` antes de afirmar "la rama no existe" | vio `main` ✅ |
| control+ al buscar `comprobante_store.py` | **vacío → el archivo no existía con ese nombre.** Era `afip_comprobante_store.py`. Sin el control, habría reportado "no hay índice único" cuando sí lo hay. |

Ese último control cambió una conclusión. Lo dejo escrito porque es la diferencia entre el mapa y una lista de sospechas.

**Total catalogado: 112 fronteras** (21 durable + 37 gateways + 30 front-door/stores + 24 cliente/UI; hay solapamiento deliberado donde una capa delega en otra).

---

## 1. El eje que ordena todo: idempotencia

INL prescribe idempotencia como obligatoria y **nunca especifica el mecanismo** (§9 del dossier de metodología). Pero es la propiedad que decide entre **auto-reparación** y **hard-stop**: una operación idempotente se puede reintentar sola; una que no lo es, reintentada, duplica el daño. Por eso va primero.

El repo tiene **tres mecanismos distintos**, y sólo dos son reales:

| Mecanismo | Dónde | ¿Real? |
|---|---|---|
| **Índice único + captura de `23505`** | `cobro_store.py:200-219,263-280` (`idem_key`), `cliente_store.py:312-333,369-389`, `concepto_store.py:97-114,168-181` | ✅ **SÍ.** El índice es la barrera; Postgres decide, no Python. |
| **`ON CONFLICT ... DO UPDATE`** | `afip_comprobante_store.py:52` sobre `(cliente_id, cuit, tipo_cbte, punto_venta, nro)` | ✅ **SÍ** — pero ver §2, protege el **registro**, no la **emisión**. |
| **`Idempotency-Key` hacia afuera** | `grafo_writer.py:100` | ✅ SÍ (único gateway externo que la manda). |
| **ID determinístico de workflow + `USE_EXISTING`** | `web.py:104,130,225,336`; `presupuestos.ts:421-426` (`presu-{id}`) | ✅ **SÍ** — Temporal rechaza el duplicado atómicamente. Es el mecanismo más fuerte del repo. |
| **"Si ya existe, devolvelo" (SELECT previo)** | `afip_factura_activities.py:86-88` vía `por_idem_key` (`afip_comprobante_store.py:125-137`) | ❌ **NO.** Check-then-act con ventana de carrera. |
| **Check-before-act contra el sistema externo** | `afip_gateway.py:148-158` | ❌ **NO — y falla abierto.** Ver §2. |

**Y lo que no tiene ninguna:** `add_messages` a Graphity (`graphity_memory_client.py:104-111`, sin `Idempotency-Key`), `send_channel_message` y `notify_staff` (`agent_activities.py:51-59,62-70`, **sin `idem_key` en el payload, con `maximum_attempts=5`**), `crearCliente` desde el cliente (`clientes.ts:338-360`), `sendChat`/`sendAudio` (`useChat.ts:295-308,339-352`), y `crear_certificado` (`afip_gateway.py:171-174`, RPA de ~2 min).

---

## 2. Hallazgo #1 — el guard contra la doble emisión fiscal falla ABIERTO

Es el punto de fallo más grave del sistema y no estaba en ninguna auditoría previa.

La emisión de una factura tiene **dos capas de defensa** contra emitir dos veces. **Las dos fallan hacia el lado peligroso.**

**Capa 1 — `por_idem_key` (`afip_factura_activities.py:86-88`).** Es un `SELECT` previo al `INSERT` (`afip_comprobante_store.py:125-137`). Es el patrón *"si ya existe, devolvelo"* que la constitución del proyecto marca explícitamente como **no-idempotente** — tiene ventana de carrera. El `ON CONFLICT` de `registrar()` (`:52`) **no la cierra**, porque su clave es `(cliente_id, cuit, tipo_cbte, punto_venta, nro)`: si AFIP emitió dos veces, asignó **dos números distintos**, y entonces no hay conflicto que detectar — son dos filas legítimas, dos CAE reales.

**Capa 2 — el check-before-act (`afip_factura_activities.py:94-95`).** Su docstring (`:81-83`) declara exactamente qué cubre:

> *"antes de emitir se pregunta si el número siguiente ya fue autorizado. Cubre la ventana fea: AFIP autorizó, el proceso se cayó antes de registrar, y el reintento estaría por emitir una SEGUNDA factura."*

**Es el caso que NO cubre.** El código es:

```python
siguiente = gateway.ultimo_comprobante(punto_venta=..., tipo_cbte=...) + 1
if gateway.existe_comprobante(numero=siguiente, ...):
```

Y `ultimo_comprobante` es `getLastVoucher` (`afip_gateway.py:132-136`) — **el último comprobante autorizado por AFIP**. La secuencia real del reintento:

| | `getLastVoucher` | `siguiente` | `existe_comprobante(siguiente)` | resultado |
|---|---|---|---|---|
| intento 1 | 10 | **11** | `False` | emite → **AFIP autoriza el 11** → se corta la red → `store.registrar` nunca corre → la activity lanza |
| retry | **11** ← AFIP ya lo cuenta | **12** | `False` ← correcto, el 12 no existe | **emite el 12** |

**Facturas 11 y 12, ambas con CAE real, por un solo pedido del usuario.**

La capa 2 pregunta por el número **siguiente**, que por construcción nunca fue emitido. Sólo detectaría algo si `getLastVoucher` **no reflejara aún** la autorización que acaba de dar — lo contrario de lo que ese método hace por definición. El código de adopción (`:95-109`, *"se adopta en vez de reemitir"*) está bien escrito: **se aplica al número equivocado.** Para funcionar tendría que consultar el **último** (`info_comprobante(ultimo)`) y comparar su contenido contra el payload para decidir si es nuestro.

Y en ese escenario **ninguna de las dos capas protege**: la capa 1 consulta una fila que nunca se escribió, la capa 2 consulta un número que nunca se emitió. Todo con `maximum_attempts=3` (`afip_factura_workflow.py:54`, `afip_anulacion_workflow.py:22`).

### La tercera vía: `ResultGet` como lista ✅ CORREGIDA

Medida con control diferencial (lógica vieja vs nueva, mismos inputs). **Son dos modos de falla distintos**, no uno:

| Forma de la respuesta | Lógica vieja (`afip_gateway.py:146`) | Consecuencia |
|---|---|---|
| `{"ResultGet": [ {...} ]}` | devolvía **la lista** | `_emitir_sync:100` hace `.get()` sobre una lista → **`AttributeError` crudo** → no es `ErrorAfip`, propaga → Temporal reintenta → `getLastVoucher` ya avanzó → **emite el número siguiente** |
| `[ {...} ]` (lista en la raíz) | `{}` | `existe_comprobante` → `False` → *"no existe"* → **reemite directo** |
| `{"ResultGet": []}` | `{}` | correcto — ausencia real |

La primera fila es la que estaba mal descrita en la versión anterior de este documento: no era un `{}` silencioso, era una excepción cruda que termina en el mismo daño por otro camino. Corregido con `_primer_result_get()` + 4 tests, incluido el **control negativo** (lista vacía sigue siendo ausencia — el fix no puede inventar comprobantes).

Es el *anti-pattern P5* que la suite ARCA ya tenía catalogado (`mot07-consulta-fe.ts:142-149`).

### La segunda debilidad del mismo guard (independiente de la anterior)

`existe_comprobante` (`afip_gateway.py:148-158`) además **falla abierto**:

```python
try:
    return bool(self.info_comprobante(...))
except ErrorAfip:
    return False
```

`ErrorAfip` es, por su propio docstring (`:20-21`), **el error reintentable** — timeout, red, AFIP inestable. Devuelve *"no existe → emití"* cuando lo que pasó es *"no pude preguntar"*. Es una segunda vía al mismo daño, más estrecha que la principal (requiere que `getLastVoucher` funcione y `getVoucherInfo` falle, dos llamadas distintas al WS), pero real.

> **Patrón INL que aplica:** el fix no es sólo fail-closed. Son **dos** cambios: (a) el check-before-act debe interrogar el **último autorizado** y compararlo contra el payload, no el siguiente; (b) si no se puede *confirmar*, **no se emite** — el `ErrorAfip` propaga y el caso va a DLQ (A-4) para reconciliación.

---

## 3. Nivel de resiliencia por capa (escala L0–L5 de INL)

Recordatorio de la escala: **L0** tolerancia · **L1** persistencia del proceso · **L2** notificación · **L3** ticketing/registro del fallo · **L4** reintento automático · **L5** auto-reparación.

| Capa | Nivel real hoy | Qué lo sostiene | Qué falta para el siguiente |
|---|---|---|---|
| **Proceso (systemd)** | **L1 parcial** | `Restart=always` + `RestartSec=5` (`uc-copiloto-{web,worker}.service:15-16`) | Sin `StartLimitBurst` propio → rige el default (5 arranques/10 s → `failed`, **deja de reintentar**). L1 protege el crash aislado y **se rinde ante el sistemático**. |
| **Orquestación durable (Temporal)** | **L4** | `RetryPolicy` en 16 sitios, `non_retryable_error_types` cableado (`llm.py:30` → `LOOP_RETRY`), timeouts en el 100% de las activities | **Cero `heartbeat_timeout` en todo el repo.** Una activity larga (`dar_de_alta_afip`, 10 min) no detecta un worker muerto hasta agotar el `start_to_close`. |
| **Gateways externos** | **L0–L4, disparejo** | Graphity: L4 real (backoff exponencial + jitter, 3 timeouts por tipo de operación, `graphity_memory_client.py:34-37,49,79`). AFIP: taxonomía limpia `ErrorAfip`/`RechazoAfip` pero **sin timeout propio**. Composio: **sin timeout, sin retry, sin taxonomía transitorio/permanente**. LLM: failover de modelo, no retry. | Un `ERROR_MAP` común (A-1). Hoy hay 4 taxonomías distintas sin nombre compartido. |
| **Front-door HTTP** | **L0** | `errores_web.py` con 11 códigos canónicos, **12/12 conflictos 409 los usan** | Sólo cubre 409. Los 400/404/422/503 (mayoría absoluta) son `detail` de texto libre: el cliente no puede discriminar sin parsear strings. |
| **Stores (Postgres)** | **L0 + idempotencia real** | Índices únicos con captura de `23505` en 6 sitios | Multi-statement sin transacción explícita en `presupuesto_store.py:194-231` y `presupuestos_web.py:346-359`. |
| **Cliente TS / UI** | **L0** | Mensajes de error en casi todas las pantallas; 3 `idem_key` reales | **0 de 4 llamadas de red con timeout o `AbortController`.** |
| **DLQ / auto-sanación** | **L0 — no existe** | — | `dlq=0 · fingerprint=0 · trauma=0 · structlog=0 · sentry=0` en las 4 capas (censo §8). **A-4 no está implementado en ninguna parte.** |

**El sistema es L4 en su columna vertebral (Temporal) y L0 en todo lo que la rodea.** Y para auto-operación, el eslabón que manda es el más débil, no el más fuerte.

---

## 4. Los puntos de fallo, ordenados por severidad

| # | Punto de fallo | Evidencia | Efecto | Idem. | Patrón INL |
|---|---|---|---|---|---|
| 1 | **Guard de doble emisión falla abierto** | `afip_gateway.py:155-158` | **Dos facturas con CAE real ante el fisco** | ❌ | fail-closed + A-4 |
| 2 | **`marcar_comprobante_anulado` fuera de todo `try`** → el workflow muere sin setear estado terminal; `estado()` devuelve `"emitiendo_nota_credito"`, que **no está en la tupla de terminales** (`:46`) → **el cliente poletea para siempre** | `afip_anulacion_workflow.py:98-101` | NC emitida con CAE, factura sin marcar, **usuario colgado sin saberlo** | ✅ (el UPDATE) | A-4 + estado terminal explícito |
| 3 | **`ConversationWorkflow` no captura el agotamiento de reintentos** — a diferencia de los workflows AFIP, ningún `try/except` rodea `call_llm`/`execute_tool`/`send_channel_message` | `conversation_workflow.py:249-533` | **La sesión permanente del usuario muere abruptamente** sin mensaje legible | varía | A-4 (el moat es justo lo que se cae) |
| 4 | **`notify_staff` y `send_channel_message`: `maximum_attempts=5` sin `idem_key`** | `agent_activities.py:51-59,62-70` | **Mensajes duplicados a humanos reales** si la activity envía y luego lanza | ❌ | `idem_key` (ya existe `_react_idem_key:450`, no se usa acá) |
| 5 | **Onboarding: certificado creado en AFIP que el sistema nunca conoce** — `crear_certificado` (`:65-66`) → `autorizar_web_service` (`:73`) → `save` (`:76`) sin `try` intermedio, y el secreto ya se consumió (`:55`) | `afip_onboarding_activities.py:61-77` | Certificado huérfano + **clave fiscal ya consumida**, no se puede reintentar sin pedirla de nuevo | ❌ | A-4 (captura + reintento con estado) |
| 6 | **`consultar_*` colapsa "Temporal caído" con "no existe"** → HTTP **404** | `web.py:169,268,348` → `afip_web.py:274` | Con el cluster caído el usuario ve *"factura no encontrada"* | N/A | 503 ≠ 404 |
| 7 | **`confirmar` factura devuelve `{"ok": true}` con token inválido** | `afip_web.py:311-328` (TODO propio, `:320-327`) | **Éxito aparente sin emisión** | ❌ | contrato de respuesta |
| 8 | **0/4 llamadas de red del cliente con timeout** | `http.native.ts:37,54`, `http.web.ts:41`, `client.ts:34` | Spinner eterno (gate de `PantallaFacturacion` verificado) | N/A | timeout canónico |
| 9 | **`remember`/`forget` de memoria fallan en silencio** — incluido un pedido **RTBF/GDPR** | `memory_provider.py:136-148` | Borrado de datos personales que **puede no ejecutarse**, sin cola de reconciliación | ✅ / ❌ | A-4 (DLQ) |
| 10 | **Multi-statement sin transacción** | `presupuesto_store.py:194-231`; `presupuestos_web.py:346-359` | `factura_id` puesto y estado sin cambiar | ❌ | transacción explícita |
| 11 | **`Linking.openURL` / `Share.share` sin `catch`** | `DetalleComprobante.tsx:128-134` | El botón no hace nada, **sin ningún mensaje** | N/A | L2 mínimo |
| 12 | **Sin `heartbeat_timeout` en ninguna activity** | todo el repo | Worker muerto invisible hasta agotar el `start_to_close` (hasta 10 min) | N/A | L1 |

---

## 5. Lo que el barrido REFUTÓ (calibración)

No todo lo sospechado resultó cierto. Estas refutaciones importan tanto como los hallazgos, porque acotan el plan:

- **Los stores NO usan "si existe, devolvelo".** Los 6 casos de duplicado usan índice único + captura de `23505`. `presupuesto_store.py:263-297` (`cambiar_estado`) usa **optimistic concurrency real** (el estado esperado va en el `WHERE`), y su docstring explica por qué evitó el patrón malo. Es código bien hecho.
- **El contrato 409 se cumple al 100%** (12/12), y `conflicto()` valida contra `CODIGOS` en runtime (`errores_web.py:62-65`).
- **Ningún listado devuelve lista vacía disfrazando una rotura** — verificado: si la query fallara, la excepción de psycopg2 propagaría sin capturar.
- **`grafo_writer` es el mejor ciudadano del repo**: `Idempotency-Key` real (`:100`), fail-open **con trazabilidad** (`chequeos_fallidos`, `:137-141`) y una estructura de pendientes (`invalidaciones_pendientes`, `:115-118`) — que es lo más parecido a una DLQ que existe hoy.
- **`warm_fn` (`web.py:589-595`) es el contraejemplo positivo**: declara best-effort, loguea y degrada. Es el patrón que faltó aplicar en `/me`.

---

## 6. La conclusión que ordena el plan

El sistema **no carece de manejo de errores**: tiene 99 `try` en backend, 16 `RetryPolicy`, taxonomías tipadas en 4 gateways, 6 índices únicos, 3 `idem_key` en el cliente y 135 tests que nombran un fallo. **Lo que no tiene es el paso 1 de A-4: la captura.** Cuando algo falla fuera de los caminos previstos, no se sella en ningún lado — se evapora en un `except` que devuelve `None`, o mata el proceso sin dejar huella estructurada.

Por eso el orden de construcción no es L0→L5 secuencial:

1. **Que ningún error se evapore** (A-4 paso 1: captura + fingerprint + log estructurado). Sin esto, los pasos 2 y 3 no tienen sobre qué operar.
2. **Cerrar los fail-open** (#1, #2, #6, #7): un guard que falla abierto es peor que no tenerlo, porque produce confianza falsa.
3. **Que ningún error frene el sistema** (A-4 pasos 2-4: encapsular, depositar, continuar).
4. **El Agente de Sanación** (L5) sobre la DLQ ya poblada.

Y transversal a todo: **el gate mecánico (G-2) es la precondición del HITL en el merge.** Si el humano sólo mira el merge, lo que no atrape el CI no lo atrapa nadie — y hoy el CI corre 11 de 92 tests de Python y 0 de 96 de TS, con cero ESLint.

---

## 7. Huecos cerrados en esta misma pasada

Los tres que declaré baratos se cerraron acá mismo. Dos confirman, uno **refuta**:

- **`conn_factory` corre en `autocommit=True`** — y no es una inferencia: está **documentado como deuda registrada** en `evento_store.py:7-19` (*"siempre `autocommit=True`… cada sentencia es su propia [transacción]"*, **propietario: BACKEND**). Esto **agrava el punto #10**: los multi-statement de `presupuesto_store.py:194-231` no son atómicos por construcción del wrapper — son genuinamente vulnerables a estado parcial, y el repo ya lo sabía. La deuda está registrada y **impaga**.
- **`avanzar_tablero_mi_dia` ES idempotente — refutado el riesgo.** `mi_dia_tarjeta_store.py:74-76` usa `ON CONFLICT (cliente_id, regla, entidad_tipo, entidad_id) WHERE regla IS NOT NULL`. Su `maximum_attempts=3` es seguro. Además el wrapper es deliberado: la misma función que sirve `GET /mi-dia/tablero` (`mi_dia_schedule_activities.py:29-31`), así que **tiene que** ser idempotente o cada refresh del usuario duplicaría tarjetas.
- **`refresh_credential` tiene una ventana real, pero gestionada.** Su propio docstring nombra la *"ventana de crash refresh→save"* (`mp_refresh_activities.py:26-27`): MercadoPago **rota** el `refresh_token` al usarlo, así que si el proceso muere entre `_gateway.refresh()` (`:33`) y `store.update_tokens()` (`:38`), el token viejo ya no sirve y el nuevo no se guardó. No es idempotente — pero degrada a `needs_reauth` en vez de romper. Es deuda **visible**, no invisible.

### Lo que sigue `[ASSUMED_PENDING_VERIFY]`

- **Si `AfipSDK.generar_pdf` sobreescribe o duplica** ante llamada repetida — `generar_pdf_comprobante` reintenta 3× y genera un PDF nuevo cada vez.
- **Si el `tool_executor` de dominio usa el `idem_key`** que recibe (`conversation_workflow.py:532`) — de esto depende que `execute_tool` con `maximum_attempts=5` sea seguro.
- **La tupla de códigos de rechazo de AFIP** (`afip_gateway.py:197`: `10016, 10243, 11002, 600, 601`) no se contrastó contra la spec completa del WSFE — un rechazo de negocio no listado se trataría como error transitorio y **se reintentaría 3 veces**.
### Medido contra el VPS vivo (ya no es supuesto)

`systemctl show` sobre `unreal-copilot`, 2026-07-28:

```
uc-copiloto-worker:  Restart=always  RestartUSec=5s
                     StartLimitBurst=5  StartLimitIntervalUSec=10s
                     NRestarts=0  ActiveState=active
uc-copiloto-web:     StartLimitBurst=5  NRestarts=0  ActiveState=active
```

El límite asumido **se confirma medido**: 5 arranques en 10 s y systemd abandona el servicio. Pero
`NRestarts=0` en ambos dice algo importante: **el escenario nunca se dio**. Es un riesgo latente
con cero incidentes, no un problema activo — lo cual lo baja de prioridad frente a los puntos 1-7,
que sí tienen camino de ocurrencia demostrado.
