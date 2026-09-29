# FACTID — RESULT

**Pedido:** `coordinacion/cerrado/2026-09-23/2026-09-23_pedido_planificacion-a-backend_spike-idempotencia-de-facturacion.md`
**Spike:** `spikes/afip-idem-carrera-real/spike.py` · corrido en el VPS (`unreal-copilot`), venv
`/opt/uc-copiloto-venv`, contra la base de test **efímera** (`deploy/copiloto/test-db.sh --export`,
rol `copiloto_app` NOSUPERUSER NOBYPASSRLS, `UC_RLS_FORCE=1`, mismo provisionado que producción incluido
`afip_indexes.sql`). Nunca tocó ARCA real: el gateway es 100% fake (`GatewayNoCoordina`, en memoria).

## 1. ¿`POST /afip/facturas` acepta `idem_key`?

**NO — y peor de lo que parece leyendo el schema.** Verificado ejecutando el modelo real, no leyéndolo:

```
NuevaFacturaBody(cuit='20269996065', idem_key='algo-estable')
campos del modelo: ['cuit']
tiene idem_key en la instancia: False
model_dump: {'cuit': '20269996065'}
```

Pydantic (default `extra='ignore'`) **descarta el campo en silencio**: si un cliente ya mandara
`idem_key` hoy, no pasaría — ni error, ni warning, se pierde antes de llegar a `crear_factura`
(`afip_web.py:121-122, 258-266`).

Y hay un segundo hallazgo que el pedido no preguntaba pero cambia el diagnóstico: el workflow **arma
su propio "idem_key"** — es literalmente `factura_id` (`afip_factura_workflow.py:229`, `run(self,
cliente_id, cuit, idem_key)`). En el camino manual, `make_iniciar_factura` (`web.py:252-264`) genera
`factura_id = uuid.uuid4().hex` **fresco en cada llamada** y arranca el workflow con
`WorkflowIDConflictPolicy.USE_EXISTING` sobre un id que, por ser aleatorio, nunca puede colisionar.
O sea: **ni la capa Temporal ni la capa DB tienen ninguna clave estable que atar entre dos intentos**
del mismo pedido de factura en este camino. (El camino presupuesto→factura, `make_abrir_borrador_de_
presupuesto`, `web.py:269-289`, sí deriva `factura_id` determinísticamente del presupuesto y usa
`WorkflowIDConflictPolicy.FAIL` — ese camino está bien protegido; el manual no.)

## 2. ¿La idempotencia del store aguanta concurrencia real?

**Dos experimentos, contra Postgres real, con dos threads sincronizados por `threading.Barrier` para
forzar que ambos pasen la Capa 1 (`por_idem_key`) antes de que cualquiera registre.**

### Experimento A — misma `idem_key`, la pregunta central del pedido

```
emisiones reales (fake) del gateway: [100, 101]   <- LAS DOS pasaron, la ventana está abierta
resultados OK: ['t1']
excepciones: {'t2': 'UniqueViolation: duplicate key value violates unique
               constraint "afip_comprobantes_idem"'}
filas en afip_comprobantes: 1 -> [(5948, 101, 'idem-fijo', 'CAE-FAKE-101')]
```

**Una fila — pero no porque la Capa 1 haya sostenido la carrera.** Los DOS threads pasaron el
`SELECT` de `por_idem_key` (ambos vieron "no existe") y los DOS llamaron a `gateway.emitir()` — en
producción real eso son **dos comprobantes autorizados por AFIP**. Lo que salvó la fila duplicada fue
el ÍNDICE ÚNICO `afip_comprobantes_idem (cliente_id, idem_key)` reaccionando en el segundo `INSERT` —
pero ese índice **no está cubierto por el `ON CONFLICT`** de `registrar()`
(`afip_comprobante_store.py:56`, que apunta a `(cliente_id, cuit, tipo_cbte, punto_venta, nro)`, la
clave natural de AFIP, no la de idempotencia). El resultado es un `UniqueViolation` **sin capturar**
(no hay `try/except` alrededor de `store.registrar()` en `_emitir_sync`,
`afip_factura_activities.py:146-151`): la emisión fake de t2 (que en producción sería un CAE real ya
autorizado por ARCA) **queda sin registrar** — activity failure, no dato perdido en silencio, pero sí
un comprobante fiscal huérfano hasta que Temporal reintente (`UniqueViolation` no está en
`non_retryable_error_types` de `REINTENTO_EMISION`, así que si reintentara con el MISMO `idem_key` la
Capa 1 encontraría la fila de t1 y se auto-sanaría — pero sólo porque este experimento fuerza el mismo
`idem_key`; ver Experimento B).

**Veredicto de la pregunta central: la ventana EXISTE.** Con la MISMA `idem_key` bajo concurrencia
real, el store no la sostiene con un resultado limpio — la sostiene por un `UniqueViolation` no
manejado que convierte una emisión real en un error de actividad.

### Experimento B — `idem_key` DISTINTA por llamada (lo que pasa HOY en `/afip/facturas`)

```
emisiones reales (fake) del gateway: [100, 101]
resultados OK: ['t1', 't2']
excepciones: {}
filas en afip_comprobantes: 2 -> [(...,100,'idem-<uuid1>','CAE-FAKE-100'),
                                   (...,101,'idem-<uuid2>','CAE-FAKE-101')]
```

**Dos filas, dos emisiones, CERO excepciones.** Esto es lo que el endpoint real produce hoy ante un
doble toque: como cada llamada genera su propio `idem_key` (hallazgo de la pregunta 1), la Capa 1
nunca tiene la oportunidad de comparar nada — no hay carrera de base de datos que ganar o perder,
el sistema entero está de acuerdo en que son dos pedidos distintos. **Es el escenario peor: sin
ningún error visible para nadie, dos facturas fiscales reales.**

## 3. ¿Qué pasa si el workflow reintenta la emisión hoy?

Ya cubierto por la suite existente `test_afip_doble_emision.py` (verificado leyendo + corriendo, no
inventado en este spike) para el caso **secuencial, misma ejecución de workflow**:
`test_el_reintento_con_numero_RESERVADO_adopta_en_vez_de_emitir_de_nuevo` prueba que un reintento con
`nro_reservado` fijo pregunta por el número que YA intentó (`existe_comprobante`) y lo adopta sin
volver a emitir — protegido. El control diferencial
`test_control_sin_numero_reservado_el_guard_NO_puede_detectarlo` deja documentado a propósito que
SIN el número reservado (camino de compatibilidad, ejecuciones viejas) sí duplica.

Lo que la suite existente **no cubre y este spike sí midió**: dos ejecuciones de workflow
**diferentes** (dos `factura_id` distintos, como produce un doble toque en el endpoint manual) no son
un "reintento" para Temporal — son dos workflows independientes, cada uno con su propio
`nro_reservado` y su propio `idem_key`, y ninguna de las dos capas de protección diseñadas (workflow_id
determinístico + Capa 1 por `idem_key`) puede verlas como la misma operación porque **ninguna de las
dos recibe una clave estable** en este camino.

## Veredicto binario

**La ventana existe.** No es (sólo) una carrera de base de datos en el sentido clásico
check-then-act — es eso (Experimento A lo demuestra con evidencia ejecutable: 2 emisiones reales
disparadas, 1 sola fila salvada por un índice que no estaba diseñado para salvarla) *y además* un gap
de diseño más grave (Experimento B): el `idem_key` que hoy viaja no es una clave de idempotencia del
CLIENTE, es un identificador de instancia sintetizado por el propio workflow — así que la protección
nunca llega a activarse en el camino que más la necesita.

## Clasificación del fix: MAYOR — no implementado en este spike

No es un cambio de una línea porque toca cuatro capas coordinadas:

1. **Contrato HTTP:** `NuevaFacturaBody` necesita un campo `idem_key` real, generado por el CLIENTE
   (frontend) y estable ante reintento — hoy el cliente TS llama `crearFactura(cuit)` sin nada más
   (referenciado en el pedido), así que esto es un cambio de contrato cross-sesión (backend + frontend),
   no algo que backend pueda cerrar solo.
2. **`make_iniciar_factura`:** dejar de sintetizar `factura_id = uuid.uuid4().hex` y derivar el
   `workflow_id` del `idem_key` del cliente, con `WorkflowIDConflictPolicy.FAIL` (el patrón que
   `make_abrir_borrador_de_presupuesto` ya usa correctamente) — así el doble toque queda protegido en
   la capa Temporal, ANTES de llegar a la base.
3. **`_emitir_sync`:** envolver `store.registrar()` en un `try/except UniqueViolation` que trate el
   choque contra `afip_comprobantes_idem` como "duplicado, adoptar" en vez de dejarlo propagar como
   error de actividad sin clasificar — defensa en profundidad para el caso en que dos ejecuciones
   igual coincidan en `idem_key` por otra vía.
4. **Versionado Temporal:** el cambio de argumentos/policy en `execute_activity`/`start_workflow`
   necesita el mismo criterio de `workflow.patched(...)` que ya se usó para `reservar-nro-antes-de-
   emitir` (`afip_factura_workflow.py:287`) — hay ejecuciones en vuelo que no pueden romper por
   no-determinismo.

Ningún ítem de estos se tocó en este spike, por instrucción explícita del pedido ("el diseño sale del
resultado, no al revés").

## Limpieza

Cada experimento crea un `cliente_id` UUID sintético (sin tenant real) y lo borra en un `finally`
incondicional al terminar — la base de test es efímera igual, pero la limpieza no depende de eso.
Corrida final: 0 filas huérfanas verificadas por el propio script en ambos experimentos tras el borrado
(no se dejó evidencia adicional a propósito — la tabla queda como estaba antes de correr).
