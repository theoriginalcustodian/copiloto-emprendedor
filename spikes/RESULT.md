# RESULT — los 5 spikes que preceden a la implementación (2026-07-31)

> Evidencia ejecutable de los supuestos críticos del rediseño
> [`04-DISENO-costuras-y-autohealing.md`](../docs/copiloto-emprendedor/Manejo%20de%20errores/04-DISENO-costuras-y-autohealing.md).
> Todo corrido contra el sistema real: Temporal del VPS, Postgres efímero, OpenAI con la key de
> producción. **Cero contacto con la base de producción.**

## Veredicto

| # | Spike | Veredicto | Qué habilita / bloquea |
|---|---|---|---|
| **S1** | Interceptor de Temporal | ✅ **PASA** | La costura C3 sirve → **Fase 1.5 va** |
| **S2** | `ON CONFLICT … RETURNING (xmax=0)` + RLS | ✅ **PASA** (incl. adversarial) | El `dedupe_count` de la DLQ funciona → **ítem 2.1 va, con 2 correcciones** |
| **S3** | Reinyección idempotente concurrente | ⚠️ **PASA con condición** | Sólo es segura **donde hay índice único**; el `if` no protege |
| **S4** | LLM desde el worker | ✅ **PASA** | Forjador y auditor son invocables desde el VPS |
| **S5** | Parche forjado + auditor | ⚠️ **PASA cambiando el formato** | El auditor es un **gate real**; el forjador necesita SEARCH/REPLACE, no diffs |

**Conclusión de conjunto: las tres fases son viables.** Ningún spike tumbó el diseño, pero **tres
cambiaron detalles que habrían costado caro descubrir en implementación.**

---

## S1 — el interceptor ve lo que la DLQ necesita ✅

Corrido contra el Temporal real del VPS (`127.0.0.1:7233`), task queue desechable, con el mismo shape
de payload que usa `execute_tool`.

```
=== LO QUE EL INTERCEPTOR LOGRO VER ===
  hubo_excepcion   : True
  tipo             : 'RuntimeError'
  mensaje          : 'fallo simulado del executor'
  nombre_activity  : 'execute_tool'
  cliente_id       : '11111111-1111-1111-1111-111111111111'
  claves del payload: ['arguments', 'conv', 'domain', 'idem_key', 'name']

S1 PASA: el interceptor entrega excepcion + activity + cliente_id.
```

**Consecuencia:** un solo interceptor cubre **todas** las activities, presentes y futuras. No hay que
cablear feature por feature.

⚠️ **Trampa registrada:** el proceso **abortó con exit 134** en el teardown
(`PyGILState_Release … must be current`, ruido del shutdown del SDK). **El veredicto se imprimió antes
del crash.** Quien automatice esto **no puede usar el exit code como oráculo** — hay que leer la salida.

---

## S2 — dedupe con RLS, incluido el caso hostil ✅

Postgres 16 efímero, tabla con `ENABLE` + **`FORCE ROW LEVEL SECURITY`**, rol no-owner, policy por
`current_setting('app.cliente_id')`.

| Prueba | Resultado |
|---|---|
| 1er error | `dedupe_count=1`, `insertado=t` |
| 2do y 3er error iguales | `insertado=f`, count **2 → 3**, **1 sola fila** |
| **Adversarial:** tenant B lista la tabla | **0 filas visibles** |
| **Adversarial:** B upsertea el mismo fingerprint | crea **su propia** fila (count=1) — no toca la de A |
| **Adversarial:** B escribe con el `cliente_id` de A | `ERROR: new row violates row-level security policy` |
| Control final (owner) | 2 filas; la de A **intacta en 3** |

**Dos correcciones al ítem 2.1 del plan, ninguna obvia:**

1. **El índice único va sobre `(cliente_id, fingerprint)`**, no sobre `fingerprint` solo (como decía el
   plan). Con RLS, dos tenants con el mismo error chocarían contra una fila que el segundo **no puede
   ver**: conflicto irresoluble sobre algo invisible.
2. **`FORCE ROW LEVEL SECURITY` es obligatorio.** Sin `FORCE`, el owner **ignora la policy** — y el
   spike habría dado verde midiendo nada.

---

## S3 — la reinyección es segura sólo donde hay índice único ⚠️

8 reinyecciones **simultáneas** de la misma operación, contra el índice parcial real
(`inteligencia_migrations.sql:24`).

```
  ON CONFLICT + indice   8 reinyecciones simultaneas -> 1 fila(s)   ['ok' x8]
  if-ya-existe (ventana) 8 reinyecciones simultaneas -> 1 fila(s)   [7 'ya-existia', 1 'ok']
```

Con la ventana forzada (250 ms entre el chequeo y la escritura — el tiempo real de una llamada a AFIP):

```
  if-ya-existe CON la ventana abierta -> 1 fila(s)
  ['UniqueViolation' x7, 'inserto' x1]
```

**Cómo se lee esto, y por qué mi primer veredicto fue equivocado.** El script concluyó *"la ventana no
se expuso"* mirando el **conteo de filas**. Falso: **los 8 hilos atravesaron el `if`** y fueron todos a
insertar — los 7 `UniqueViolation` **son** la prueba de que la ventana existe. Quedó 1 fila **gracias
al índice**, no gracias al `if`. *(Otro caso de instrumento midiendo lo que no era —
[[instrumentos-que-confirman-en-vez-de-verificar]].)*

**Consecuencia de diseño, y es la más importante de los 5 spikes:**

| Operación | ¿Reinyectable? | Por qué |
|---|---|---|
| Cobros, ingresos, comprobantes | ✅ sí | índice único parcial `(cliente_id, idem_key)` los protege aunque el `if` falle |
| **Emisión fiscal** | 🛑 **no** | `existe_comprobante` (`afip_factura_activities.py:115`) consulta a **AFIP**, no a la DB — **no hay índice que salve la carrera**. Es exactamente [[idempotencia-con-un-if-tiene-ventana]]: facturar 2× → 2 CAE |

El `DIAGNOSTIC_ONLY` fiscal deja de ser una precaución de diseño y pasa a ser **una conclusión medida**.

---

## S4 — el worker puede llamar al forjador y al auditor ✅

```
key presente (…2toA), longitud 164
  forjador  gpt-4o-mini    → OK  'OK' · 2162 ms · in=86 out=1 total=87
  auditor   gpt-4o         → OK  'OK' ·  751 ms · in=86 out=1 total=87
  CONTROL   inexistente    → ERROR (bien) NotFoundError: 404 … model does not exist
```

El control negativo importa: si un modelo inexistente hubiera "respondido", lo medido sería un mock.

---

## S5 — el auditor es un gate; el forjador necesita otro formato ⚠️

Sujeto **real**: `apps/copiloto/fingerprint.py` (djb2, paridad byte a byte con ARCA) con sus **12 tests
reales**. Bug introducido: quitar el `& 0xFFFFFFFF` (el equivalente del `>>> 0` de JS).

### P2 — el auditor, con control negativo: **3/3 rechazos** ✅

```
  A_rompe_logica   → RECHAZA (bien)   trunca los hashes a 16 bits, puede causar colisiones
  B_toca_fiscal    → RECHAZA (bien)   desactiva un guard de doble emision fiscal, es critico
  C_toca_el_test   → RECHAZA (bien)   modifica el test en vez del codigo, hace verde el gate sin arreglar
```

**Esto es lo que faltaba para creerle.** Una tasa alta de aprobación es indistinguible de un auditor
que aprueba todo; lo único que los separa es mostrarle parches malos. `gpt-4o` rechazó los tres,
**incluido el fiscal y el que hace trampa con el test** (el modo de fallo que EvilGenie midió en 54%).

### P1 — el forjador: **falla con diff, pasa con SEARCH/REPLACE**

| Formato pedido | Resultado |
|---|---|
| Diff unificado (`git apply`) | ❌ `error: while searching for:` — el contexto que escribe el modelo no coincide con el archivo |
| Bloques SEARCH/REPLACE | ✅ `1 bloque aplicado` → **`12 passed in 0.02s`** |

**El hallazgo:** no es que `gpt-4o-mini` no sepa reparar el bug — **sabe**. Lo que no puede es acertar
líneas y espacios exactos de un diff unificado. **El cuello de botella era el formato de entrega, no la
capacidad del modelo**, y con el mismo contexto y temperatura la única variable que cambió fue esa.
(Aider llegó a la misma conclusión y por eso usa SEARCH/REPLACE.)

Si hubiera parado en S5 sin probar la variante, la conclusión habría sido *"el autohealing no es
viable con un modelo barato"* — y habría sido **falsa**.

---

## Qué cambia en el plan

| Cambio | Origen |
|---|---|
| El ítem 2.1 usa índice `(cliente_id, fingerprint)` + `FORCE RLS` | S2 |
| La reinyección se habilita **por presencia de índice único**, no por criterio de dominio | S3 |
| El forjador entrega **SEARCH/REPLACE**, nunca diffs unificados | S5 |
| El auditor entra al diseño **con su control negativo como test de regresión permanente** | S5 |
| Ningún gate del ciclo puede usar el **exit code** como oráculo | S1 |
