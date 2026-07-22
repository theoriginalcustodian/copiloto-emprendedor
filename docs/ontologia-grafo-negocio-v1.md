# Ontología del grafo de negocio — propuesta v1

**Fecha:** 2026-07-22 · **Autor:** sesión de PLANIFICACIÓN · **Estado:** PROPUESTA — requiere tres
decisiones del operador (§7) antes de bajar como contrato.

**Método:** las entidades y atributos salen de medir las 7 tablas de negocio vivas en
`_copiloto-afip-wt/apps/copiloto/uc_tables.json`, no de imaginar el dominio. El mecanismo de ingesta
sale de [`ingesta-determinista-grafo.md`](ingesta-determinista-grafo.md), leído contra el código de
Graphity y de documed.

> **Para qué existe este grafo:** alimentar el módulo **Inteligencia de Negocio** — una función
> aparte, con su propio LLM, que conversa **sólo con el grafo**. El copiloto principal **no accede al
> grafo** y no tiene memoria conversacional: recibe órdenes y las ejecuta. Esa separación es
> deliberada (decisión del operador, 2026-07-22).

---

## 0. La inversión que hay que tener presente antes de escribir una línea

La skill `graphity` y su `ontology-design.md` están calibradas para el camino **con LLM**
(`add_episode` / `add_triplet`), donde el modelo **clasifica** qué entidad y qué arista es cada cosa.
Nuestro camino es el **determinista** (`POST /api/v2/graph/structured`, `dedup:"exact"`), donde el
tipo lo declaramos nosotros en el mapping. Eso invierte dónde está el esfuerzo:

| | Path con LLM | **Path structured (el nuestro)** |
|---|---|---|
| `description` de 5 partes, anti-ejemplos `WRONG→RIGHT` | palanca #1 | **no la lee nadie** |
| `properties` y `source_targets` | no entran al prompt de clasificación | **son lo que produce el 422** — la única red que tenemos |
| La palanca real | la `description` | **el `fact_template`** |

**Por qué el `fact_template` es la palanca:** `/search` y `/traverse` **no proyectan `attributes`**
(trampa 6). Sólo `GET /edge/{uuid}` los devuelve, y el lector no va a ir arista por arista. Entonces
**todo lo que Inteligencia de Negocio vaya a necesitar leer tiene que estar interpolado en el texto
del hecho**, no sólo en el `property_map`. Un monto que vive únicamente en `property_map` es un monto
que el módulo no puede ver.

Corolario práctico: las `description` de esta ontología se escriben **cortas y para humanos**. El
presupuesto de esfuerzo va al `fact_template` y a los `source_targets`.

---

## 1. Las entidades, y la línea que las parte en dos

El criterio duro de la ingesta determinista: **una entidad que representa un evento no se deduplica
nunca.** Si se dedupe, una repetición futura genera el `uuid5` de una arista ya invalidada y el
re-POST **la resucita** (trampa 4: `SET e = edge` es reemplazo total, pisa `invalid_at` con `None`).

### 1.1 Entidades que SE DEDUPLICAN (una por cosa del mundo real)

| Entidad | Clave natural | Sale de | Nota |
|---|---|---|---|
| `Negocio` | `tenant_id` | `copiloto_perfil_negocio` | Nodo raíz. Uno por emprendedor. Casi todas las aristas salen de acá. |
| `Cliente` | `doc_nro` si existe; si no `nombre_normalizado \| homonimo` | `copiloto_clientes` | **Reusar la clave del índice único que ya existe** — no inventar otra, o el grafo y la base discrepan sobre qué es el mismo cliente. |
| `Proveedor` | `normalize_key(proveedor)` | `copiloto_gastos.proveedor` | Sólo texto libre hoy. ⚠️ Sin `target_external_id_column` dedupea por VALOR (trampa 7) — que acá **es lo que queremos**, pero exige normalizar igual que el servidor. |
| `Concepto` | `normalize_key(descripcion)` | `copiloto_presupuesto_items.descripcion` | Lo que el negocio vende. Habilita *«¿cuánto cobraba antes por esto?»* — ver §7.3. |
| `Categoria` | el literal | `copiloto_gastos.categoria` | Opcional. Agrupa gastos sin pasar por SQL. |

### 1.2 Entidades que son EVENTOS (nunca se deduplican, nunca se invalidan)

| Entidad | Clave natural | Sale de | `valid_at` |
|---|---|---|---|
| `Comprobante` | `cuit\|tipo_cbte\|punto_venta\|nro` | `afip_comprobantes` | `fecha_emision` |
| `Gasto` | id de fila | `copiloto_gastos` | `fecha` |
| `Presupuesto` | `numero` | `copiloto_presupuestos` | `fecha` |
| `Cobro` | `payment_id` | `mp_payments` | `occurred_at` |

La clave de `Comprobante` es la que AFIP considera única, no un id nuestro: así el mismo comprobante
ingestado dos veces converge, y dos comprobantes distintos nunca colapsan.

---

## 2. Las aristas

### 2.1 Aristas de EVENTO — pasaron, y no se invalidan jamás

| Arista | source → target | `fact_template` (lo que el módulo va a poder leer) |
|---|---|---|
| `EMITIO` | Negocio → Comprobante | `{source} emitió la factura {tipo} {pto}-{nro} por ${total} el {fecha}` |
| `FACTURADO_A` | Comprobante → Cliente | `La factura {pto}-{nro} de ${total} fue emitida a {target} el {fecha}` |
| `REGISTRO_GASTO` | Negocio → Gasto | `{source} gastó ${monto} en {categoria} el {fecha}` |
| `PAGADO_A` | Gasto → Proveedor | `Un gasto de ${monto} en {categoria} se pagó a {target} el {fecha}` |
| `PRESUPUESTO` | Negocio → Presupuesto | `{source} presupuestó ${total} por {concepto} el {fecha}` |
| `DIRIGIDO_A` | Presupuesto → Cliente | `El presupuesto {numero} de ${total} fue para {target} el {fecha}` |
| `INCLUYE` | Presupuesto → Concepto | `El presupuesto {numero} incluye {cantidad} × {target} a ${precio_unitario} c/u` |
| `COBRO` | Negocio → Cobro | `{source} cobró ${amount} el {fecha} ({status})` |

Notar que **cada `fact` es una frase autocontenida con sus números y su fecha adentro**. No es
redundancia con el `property_map`: es la única forma de que el hecho sea legible por búsqueda.

### 2.2 Aristas de ESTADO — cambian, y ahí vive la bitemporalidad

| Arista | source → target | Qué la invalida |
|---|---|---|
| `TIENE_DOMICILIO` | Cliente → Domicilio | una edición del domicilio |
| `TIENE_CONDICION_IVA` | Cliente → CondicionIVA | una edición |
| `TIENE_CONTACTO` | Cliente → Contacto | una edición de email o teléfono |
| `ESTADO_COMPROBANTE` | Comprobante → Estado | anulación por nota de crédito |
| `ESTADO_PRESUPUESTO` | Presupuesto → Estado | aceptado / rechazado / vencido / reemplazado |
| `PRECIO_DE` | Negocio → Concepto | un presupuesto nuevo con otro precio |
| `VENDE` | Negocio → Rubro | edición del perfil |

⚠️ **La anulación de una factura NO invalida `EMITIO`.** La factura se emitió y eso no deja de ser
cierto: lo que cambia es su `ESTADO_COMPROBANTE`. Confundirlos borraría de la historia una operación
que existió, y con ella el CAE.

### 2.3 🔴 La identidad de una arista de estado no puede ser `(source, tipo, target)`

Parece natural que la arista *«Cliente X tiene domicilio Av. Mitre 1234»* se identifique por esos tres
elementos. **Y está mal**, por la trampa 4:

```
1. El cliente vive en Av. Mitre 1234        → arista A, vigente
2. Se muda a San Martín 500                 → PATCH invalida A, se crea B
3. Vuelve a Av. Mitre 1234                  → el uuid5 da EXACTAMENTE A otra vez
                                            → el POST hace SET e = edge
                                            → invalid_at vuelve a None
                                            → A resucita, y ahora hay DOS domicilios vigentes
```

No falla, no avisa, y el módulo de Inteligencia de Negocio va a responder que el cliente tiene dos
domicilios. **La regla (ADR-017 de documed): nada que defina una arista puede depender del estado
mutable del grafo — todo sale del log inmutable.** En la práctica: la clave de una arista de estado
incluye **el evento que la originó** (el id de la entrada del log, o su timestamp), nunca sólo el par
de nodos. Así cada cambio es una arista nueva y la anterior se invalida sin riesgo de volver.

Consecuencia agradable: **un solo patrón para todo.** Toda arista es, en su identidad, un evento; la
vigencia se expresa con `valid_at` / `invalid_at`, no con la existencia de la arista.

---

## 3. 🔴 El problema de fondo: hoy no hay de dónde sacar el "antes"

La bitemporalidad es *saber qué vale hoy y qué valía antes*. Pero medido:

```
copiloto_clientes → domicilio, email, telefono, condicion_iva, notas   EDITABLES IN-PLACE
                    created_at                                          uno solo, el del alta
copiloto_perfil_negocio → updated_at                                    se pisa en cada edición
```

**Un cambio de domicilio pisa al anterior y no queda rastro en ninguna tabla.** Y el grafo tiene que
poder reconstruirse desde la base (es proyección, no fuente de verdad — invariante ya escrito en la
memoria del proyecto): si se reconstruye desde `copiloto_clientes`, sólo puede ver el presente.

**La bitemporalidad no se puede inventar en la proyección. Algo tiene que recordar el pasado, y hoy
nada lo hace.**

> ⚠️ **Encuadre — estamos en desarrollo, sin clientes** ([[desplegado-no-significa-con-clientes]]).
> Acá no hay historia real que se esté perdiendo: los datos son sintéticos y se fabrican. Eso **no
> disuelve el problema** —el schema sigue sin poder responder "qué valía antes"— pero cambia cuál es
> el argumento que decide.

### Las dos salidas, que son excluyentes

**(A) Log append-only en Postgres.** Una tabla `copiloto_eventos` (entidad, campo, valor anterior,
valor nuevo, cuándo, quién). El grafo se deriva de ahí y es **reconstruible siempre**. Es lo que hace
documed. *Costo:* una tabla y un gancho en cada mutación de las funciones que ya existen.

**(B) Ingesta inline en cada mutación, sin log.** El gancho escribe directo al grafo, y el grafo pasa
a ser **el único que recuerda**.

**Recomendación: (A), y la razón que decide hoy no es la de producción.**

*El argumento de producción* —«si falla una ingesta se pierde historia de un cliente»— es cierto pero
**hipotético**: no hay clientes.

*El argumento que aplica ahora* es que **cambiar la ontología no reprocesa lo ya ingestado** (§8): el
grafo queda mixto, así que **cada iteración del diseño obliga a tirar el grafo y volver a llenarlo**.
Y vamos a iterar la ontología varias veces, porque es la primera. Con log, rellenar es **re-derivar**
—un comando, determinista, idéntico cada vez—. Sin log, es **regenerar los datos sintéticos a mano**,
y cada regeneración es un dataset distinto: dos corridas del mismo diseño dejan de ser comparables.

**El log append-only es primero una herramienta de desarrollo, y de paso la garantía de producción.**
Misma conclusión que el argumento hipotético, pero por una razón que se puede verificar esta semana.

---

## 4. Lo que el lector (Inteligencia de Negocio) está obligado a hacer

No es opcional y va en el contrato del módulo, no en el de la ingesta:

1. **Filtrar vigencia del lado del cliente.** `/search` y `/traverse` **no filtran lo invalidado por
   default** (`only_valid` es opt-in — trampa 8). Sin el filtro, el módulo devuelve hechos vencidos
   como vigentes: el domicilio viejo, el precio viejo, el presupuesto ya rechazado.
2. **No confiar en `type(r)` si alguna vez se toca Cypher.** Todas las aristas se persisten como
   `(:Entity)-[:RELATES_TO]->(:Entity)`; el tipo semántico vive en `r.name`. Una query que filtra por
   `type(r)` devuelve **200 con lista vacía** — se lee igual que "no hay datos" (trampa 10).
3. **Los números auditables salen de SQL, no del grafo.** Invariante ya vigente. El grafo responde
   *qué pasó y cómo se relaciona*; el dashboard de métricas responde *cuánto*, con `SELECT`.

---

## 5. Lo que el escritor está obligado a hacer

1. `dedup:"exact"` **siempre** — `"smart"` reusa `add_triplet` y vuelve a meter el LLM (trampa 1).
2. `on_error:"strict"` **siempre** — el default `"partial"` termina `completed` con filas perdidas.
   Y chequear `totals.failed` / `row_errors` **igual**, porque strict no cubre todo (trampa 2).
3. **Pollear.** El 202 significa *encolado*, no *escrito* (trampa 3).
4. **Orden obligatorio: primero el POST, después los PATCH de invalidación.** Invertirlo invalida algo
   que el POST siguiente resucita.
5. **Guard anti-resurrección:** antes de re-postear un dataset, `GET /edge/{uuid}` y excluir de las
   filas lo que ya está invalidado (trampa 4).
6. El presupuesto de polling tiene que **entrar dentro del timeout de la activity Temporal** que lo
   envuelve (en documed: 90 s de poll en 120 s de activity).
7. **Registrar la ontología con `graph_ids=[<grupo del tenant>]`. Nunca scope vacío** — eso es
   *project-wide* sobre una instancia **compartida entre proyectos**.
8. El `group_id` del `uuid5` es el **lógico**, sin el prefijo `{tenant}__` que el servidor agrega. Con
   el físico, los uuid calculados no son los que Graphity persistió, y las invalidaciones apuntan a
   nodos que no existen — devolviendo vacío, sin error.

---

## 6. Aislamiento cross-emprendedor — sigue siendo nuestro

Ninguna de las respuestas de documed transfiere: tienen otro modelo de tenancy. Y acá aplica la regla
dura del repo — *un control de autorización sin test adversarial es indistinguible de uno ausente*.

**Va como línea del DoD, no como spike previo:** el emprendedor A consulta el grafo con el `group_id`
de B y recibe nada. Con el `group_id` lógico/físico de por medio y la ontología potencialmente
project-wide, hay dos formas distintas de filtrarse.

---

## 7. Las tres decisiones que faltan, y son del operador

### 7.1 🔴 (A) log append-only vs (B) ingesta inline — §3

Bloquea todo lo demás. Recomendación: **(A)**.

### 7.2 Cómo se fabrica el dataset sintético — y por qué NO puede ser plano

No hay backfill que decidir: no hay datos reales. **La historia se fabrica**, con las fechas que
queramos. Pero eso trae un requisito que es fácil pasar por alto:

**Un dataset sintético plano —cada cliente con un domicilio, cada concepto con un precio— hace que
toda la bitemporalidad dé verde sin haber sido ejercitada nunca.** Las aristas de estado no se
invalidarían jamás, el guard anti-resurrección no se dispararía, el filtro de vigencia del lector
daría el mismo resultado con y sin filtro. Todo verde, nada probado: el instrumento no toca la
condición que puede fallar.

El dataset tiene que traer, como mínimo: **un cliente que se muda** (dos veces, y una de ellas
**volviendo a un domicilio anterior** — ése es el caso que resucita aristas, §2.3), **un concepto que
cambia de precio** al menos tres veces, **un presupuesto rechazado y uno reemplazado**, y **una
factura anulada por nota de crédito** (que NO debe invalidar su `EMITIO`). Con eso, cada regla de §2
tiene su caso.

Decisión pendiente sólo sobre **el volumen y el tramo temporal** (¿12 meses simulados? ¿cuántos
clientes?), que define si las preguntas de negocio tienen suficiente masa para ser interesantes.

### 7.3 ¿`Concepto` es entidad propia?

Es lo que habilita *«¿cuánto cobraba antes por esto?»* y *«¿qué es lo que más presupuesté?»* —
probablemente las preguntas donde la bitemporalidad más paga. El costo es que
`copiloto_presupuesto_items.descripcion` es **texto libre**: *«pintura de living»*, *«pintar el
living»* y *«living - pintura»* son tres conceptos distintos para el grafo. Sin normalización o
catálogo, el nodo se fragmenta y la serie de precios se corta.

---

## 8. Lo que NO está verificado en este documento

- **Nada de esto se probó contra el servidor vivo.** El mecanismo sale de leer el código de los dos
  lados; los `RESULT.md` de los spikes de documed sí corrieron contra el servidor real (jul-2026).
  Antes de fijar la ontología: `validate_only:true`, que responde 200 sin tocar el grafo.
- La ontología **no se puede iterar barato una vez ingestado**: cambiarla **no reprocesa** lo ya
  escrito y el grafo queda mixto. Se itera sobre un **grafo de prueba descartable** y recién después
  se fija la de producción.
- `packages/core/src/api/types.ts` tiene tipos de ontología **de documed** (`HechoInvalidado`,
  `grafo_pendiente`, corrección de entradas) portados a este repo. Falta determinar si están en uso o
  son residuo del port — no afecta este diseño, pero puede confundir a quien los encuentre.
