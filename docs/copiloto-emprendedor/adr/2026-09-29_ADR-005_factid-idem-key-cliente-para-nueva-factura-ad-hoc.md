# ADR-005 — `idem_key` de cliente para el endpoint ad-hoc `POST /afip/facturas`

- **Fecha:** 2026-09-29
- **Estado:** 🟡 **`ACCEPTED` (mitad backend)** — la mitad de este documento (§3, items 2-3) tiene
  evidencia ejecutable (§7); la mitad restante (§3, item 1: frontend generando y enviando `idem_key`)
  es un `pedido_` aparte a planificación/frontend, fuera de este PR.
- **Decide:** backend (TÁCTICO en el sentido de "aplica un patrón ya establecido en este código a un
  endpoint nuevo", pero cambia el contrato HTTP externo — por eso ADR, no sólo commit).
- **Item de origen:** `coordinacion/cerrado/2026-09-23/2026-09-23_cierre_backend-a-planificacion_FACTID-spike-idempotencia-facturacion-ventana-existe-MAYOR.md`
  (spike, MAYOR) + `coordinacion/abierto/2026-09-29_dato_planificacion-a-backend_FACTID-secuenciado-fuera-del-cierre-A-con-gate-de-beta.md`
  (secuenciado fuera de Cierre A, con gate de beta hasta cerrar) + instrucción cross-sesión de
  `copiloto-emprendedor-d7` (planificación) de tomarlo ahora sin esperar el próximo sprint.

---

## 1. Contexto

El spike FACTID (`spikes/afip-idem-carrera-real/RESULT.md`, medido contra Postgres real con
`threading.Barrier` para forzar concurrencia genuina, no el reintento secuencial normal de Temporal)
midió tres cosas sobre `POST /afip/facturas` (la pantalla "Nueva factura" **sin** presupuesto de
origen):

1. `NuevaFacturaBody` no tenía campo `idem_key` — Pydantic lo descartaba en silencio si el cliente lo
   mandaba (`extra='ignore'` por default) — y `make_iniciar_factura` generaba un `factura_id =
   uuid.uuid4().hex` **nuevo en cada llamada**. No existía ninguna clave estable para deduplicar dos
   intentos independientes del mismo pedido real.
2. Con la MISMA `idem_key` bajo concurrencia forzada, sobrevivía 1 sola fila en la base — pero vía una
   `UniqueViolation` **sin clasificar** que escapaba de la activity.
3. Con `idem_key` DISTINTA por llamada (el comportamiento real de hoy, sin cambios): 2 emisiones AFIP
   reales + 2 filas + CERO excepciones — el peor caso, duplicado fiscal silencioso.

Esto es DISTINTO del camino presupuesto → factura (`make_abrir_borrador_de_presupuesto`,
`presupuestos_web.py`), que ya deriva `factura_id` del `presupuesto_id` desde el 2026-07-21 y está
fuera de este alcance.

## 2. Por qué no alcanza con la capa de base sola

`AfipComprobanteStore.registrar()` ya protege el caso "reintento después de un éxito completo"
(`por_idem_key` + `ON CONFLICT` sobre la clave natural AFIP). Lo que NO protegía es la ventana entre
`por_idem_key` (capa 1, sin lock) y el `INSERT` real: dos ejecuciones con la misma `idem_key` pueden
pasar el chequeo antes de que cualquiera registre. Eso es un defecto de aplicación (excepción sin
clasificar), separado del defecto de contrato (no hay `idem_key` de cliente que llegue hasta acá) — los
dos hacen falta, ninguno alcanza solo.

Rechazado explícitamente (instrucción de planificación, 2026-09-29): un lock/debounce sólo de frontend.
No cubre multi-dispositivo, reintento de red a nivel HTTP, ni "atrás" del navegador — un botón
deshabilitado en el cliente no es idempotencia.

## 3. Decisión — 3 piezas, 2 implementadas acá

1. **Contrato HTTP** (`afip_web.py`, `NuevaFacturaBody`): campo `idem_key: str | None = None`,
   **opcional y retrocompatible** — sin el campo, comportamiento idéntico al de hoy. El cliente debería
   generarlo una sola vez por intento real (ej. al montar la pantalla, no por click) y reenviar el
   MISMO valor en reintentos/pestañas duplicadas. **Fuera de este PR**: que el frontend lo genere y lo
   mande — es un cambio de otra capa, se propone como `pedido_` a planificación/frontend (§9).
2. **`factura_id` determinístico** (`web.py`, `make_iniciar_factura`): con `idem_key`, deriva
   `factura_id = f"idem-{sha256(idem_key)[:32]}"` y usa `WorkflowIDConflictPolicy.FAIL` (no
   `USE_EXISTING`) — mismo patrón exacto que `make_abrir_borrador_de_presupuesto` ya usa para el
   camino presupuesto. Sin `idem_key`, cae al camino viejo sin cambios (id aleatorio, `USE_EXISTING`).
3. **Defensa de la carrera en la capa de base** (`afip_factura_activities.py`,
   `_registrar_con_defensa_idem`): envuelve `store.registrar()` en `try/except UniqueViolation` — si
   pierde la carrera contra el índice único `afip_comprobantes_idem`, el comprobante YA es real
   (emitido en AFIP o adoptado) y no puede perderse: se re-registra sin `idem_key` (la clave ya la tiene
   la ganadora) y se loguea como alerta operativa (`alerta_doble_emision` en la respuesta de la
   activity) para revisión manual — no es un duplicado limpio que el sistema pueda resolver solo.

## 4. Por qué hashear la `idem_key` de cliente en vez de usarla directa

`iniciar_anulacion` usa el valor derivado tal cual (`f"{cuit}-{tipo}-{pto}-{nro}"`), pero ahí el valor
lo arma el propio backend con datos ya validados. Acá `idem_key` la manda el cliente sin validar: un
hash de longitud fija (1) evita caracteres arbitrarios en el workflow id/URL pública, (2) no expone el
valor crudo que el cliente eligió como id público de la factura, y (3) acota el largo sin imponerle un
formato al cliente. `Field(max_length=200)` en el contrato evita además un payload abusivamente largo
antes de llegar al hash.

## 5. Reuso — lo que ya existía y se clonó (regla 3 del canon)

- **`PresupuestoStore.crear_idem`** (`presupuesto_store.py:215-254`): patrón exacto
  check-por-idem-primero / intentar-insertar / capturar `UniqueViolation` / re-consultar. Es el mismo
  que `_registrar_con_defensa_idem` aplica acá, adaptado (acá el registro es obligatorio incluso tras
  perder la carrera, porque el efecto real en AFIP ya ocurrió y no se puede deshacer).
- **`make_abrir_borrador_de_presupuesto`**: mismo mecanismo (`factura_id` determinístico + `FAIL` +
  capturar `WorkflowAlreadyStartedError`) clonado tal cual para `make_iniciar_factura`.

## 6. Por qué NO hace falta `workflow.patched()`

`FacturaWorkflow.run(self, cliente_id, cuit, idem_key)` no cambia de firma ni de secuencia de
Commands — `idem_key` ya se recibía y se reenviaba sin tocar. Los tres cambios de este ADR viven en
código STARTER (`web.py::iniciar_factura`, fuera de cualquier `@workflow.defn`) o en la activity
(`afip_factura_activities.py`), ninguno de los cuales participa del replay determinista de Temporal.
`workflow.patched()` sólo hace falta para cambios ejecutados DENTRO de `run()`/signal/handler — no es
el caso acá (confirmado leyendo `afip_factura_workflow.py` completo, 438 líneas).

## 7. Cómo se verifica

- `tests/test_afip_idem_key_carrera.py` — la carrera perdida contra el índice único NO pierde el
  comprobante real (test adversarial); control diferencial sin carrera.
- `tests/test_web_iniciar_factura_idem.py` — sin `idem_key`, dos toques abren dos workflows (control,
  comportamiento viejo preservado); con la MISMA `idem_key`, el segundo toque adopta el mismo
  `factura_id` vía `FAIL`; `idem_key` distintas producen `factura_id` distintos (control positivo).
- Suite completa afectada (`test_afip_ambiente.py`, `test_afip_web_facturas.py`,
  `test_afip_doble_emision.py`, `test_afip_factura_replay.py` + las dos nuevas): **42/42 verde en el
  VPS, contra Postgres real con `UC_RLS_FORCE=1`** (no mocks — integración real, canon del proyecto).

## 8. Limitaciones — lo que este ADR NO cierra

- **Sin frontend enviando `idem_key`, el gap de fondo sigue abierto.** Este PR hace que el backend deje
  de perder el comprobante SI llega una `idem_key` repetida, y hace que dos toques con la misma clave
  no abran dos workflows — pero mientras el cliente no la mande, `POST /afip/facturas` sigue generando
  un id aleatorio por llamada, exactamente como hoy. El gate de beta (no dar el producto a un tenant con
  AFIP de PRODUCCIÓN vinculado) declarado por planificación el 2026-09-29 sigue vigente hasta que la
  pieza de frontend cierre.
- El camino de dictado por voz (`make_buscar_borrador_dictado_abierto`, ventana de 15 min por
  Visibility query) es un mecanismo aparte, no atómico, con riesgo residual ya aceptado — no tocado acá.

## 9. Qué sigue — no se decide ni se implementa en este PR

Un `pedido_` a planificación/frontend: que `PantallaFacturacion.tsx` (web y mobile) genere un
`idem_key` (ej. UUID) una sola vez al abrir la pantalla —no en cada click— y lo reenvíe en `POST
/afip/facturas`, persistiéndolo (ej. `sessionStorage`/state local) para que un reintento de red o una
segunda pestaña con la MISMA sesión de facturación manden el mismo valor. Diseño de dónde vive ese
estado y cómo se invalida al terminar el flujo: decisión de la capa frontend, no de este documento.
