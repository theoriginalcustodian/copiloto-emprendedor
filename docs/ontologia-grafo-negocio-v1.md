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

## 0.bis 🔴 El eje corregido — el ciclo del dinero

*(Corrección del operador, 2026-07-22: la v1 derivaba la ontología de **las tablas**, o sea de lo que
el sistema guarda. Para inteligencia de negocio el eje tiene que ser **el dinero y su ciclo**.)*

```
Concepto  →  Presupuesto  →  Factura  →  Cobro            (lo que entra)
  qué vendo    lo que ofrecí   lo que vendí   lo que cobré

Gasto  →  Proveedor                                        (lo que sale)
   └──────── IMPUTADO_A ────────┘  al eslabón del trabajo que exista
```

Cada pregunta de negocio cae en un tramo del ciclo. **Las que no caen en ninguno, probablemente no
eran de negocio** — así se descubrió que el domicilio y el mail del cliente no van al grafo: son datos
operativos de la ficha, no información de negocio.

⚠️ **Y por eso salen de §2.2 las aristas `TIENE_DOMICILIO`, `TIENE_CONTACTO` y
`TIENE_CONDICION_IVA`.** El `Cliente` en el grafo es un nodo con nombre; su ficha vive en Postgres.
Eso achica mucho el log append-only: no registra ediciones de ficha, sólo eventos económicos y cambios
de precio/estado.

**El trabajo no es una entidad: es la CADENA** presupuesto→factura→cobro, cuyos enlaces ya existen en
el sistema. El gasto se imputa a cualquier eslabón y el margen agrupa por cadena.

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
| `COBRO` | Negocio → Cobro | `{source} cobró ${amount} el {fecha} por {medio} ({origen})` |
| `IMPUTADO_A` | Gasto → Presupuesto \| Comprobante \| Cobro | `Un gasto de ${monto} en {categoria} se imputó al trabajo {trabajo} el {fecha}` |

⚠️ **`COBRO` lleva el ORIGEN en el `fact`** — si lo registró el sistema (MercadoPago) o lo dictó el
emprendedor. Un cobro que el sistema vio no tiene la misma confianza que uno tipeado, y esa diferencia
tiene que poder leerse: si no está en el texto del hecho, no existe para quien consulta.

Notar que **cada `fact` es una frase autocontenida con sus números y su fecha adentro**. No es
redundancia con el `property_map`: es la única forma de que el hecho sea legible por búsqueda.

### 2.2 Aristas de ESTADO — cambian, y ahí vive la bitemporalidad

*(Las tres aristas de datos de contacto del cliente **se eliminaron** — ver §0.bis: no son información
de negocio.)*

| Arista | source → target | Qué la invalida |
|---|---|---|
| `ESTADO_COMPROBANTE` | Comprobante → Estado | anulación por nota de crédito, o marcarla cobrada |
| `ESTADO_PRESUPUESTO` | Presupuesto → Estado | aceptado / rechazado / vencido / reemplazado |
| `PRECIO_DE` | Negocio → Concepto | un presupuesto nuevo con otro precio |
| `VENDE` | Negocio → Rubro | edición del perfil |

⚠️ **La anulación de una factura NO invalida `EMITIO`.** La factura se emitió y eso no deja de ser
cierto: lo que cambia es su `ESTADO_COMPROBANTE`. Confundirlos borraría de la historia una operación
que existió, y con ella el CAE.

### 2.3 🔴 La identidad de una arista de estado no puede ser `(source, tipo, target)`

Parece natural que la arista *«el tablero cuesta $85.000»* se identifique por esos tres elementos.
**Y está mal**, por la trampa 4 — con un caso que **va a pasar seguro**, porque los precios suben y
bajan:

```
1. El tablero vale $85.000                  → arista A, vigente
2. Sube a $95.000                           → PATCH invalida A, se crea B
3. Vuelve a $85.000 (promoción, o corrección) → el uuid5 da EXACTAMENTE A otra vez
                                            → el POST hace SET e = edge
                                            → invalid_at vuelve a None
                                            → A resucita, y ahora hay DOS precios vigentes
```

No falla, no avisa, y el módulo de Inteligencia de Negocio va a responder que ese trabajo tiene dos
precios. **La regla (ADR-017 de documed): nada que defina una arista puede depender del estado
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

## 7. Las decisiones — TOMADAS por el operador el 2026-07-22

### 7.1 ✅ (A) log append-only — §3

Decidido: **(A)**. El grafo se deriva de un log append-only en Postgres y es reconstruible.

#### 7.1.bis Quién invalida — y por qué la carga histórica esconde la mitad del derivador

El servidor **jamás** invalida por su cuenta en el camino determinista: no detecta contradicciones,
`invalid_at` sólo se escribe con un `PATCH` explícito. Si se ingestan los 6 meses de un saque y no se
hace nada más, un cliente que se mudó tres veces queda con **tres domicilios vigentes a la vez**.

**Invalida el derivador**, que puede hacerlo porque lee el log: sabe que el evento N+1 sobre el mismo
`(entidad, campo)` supera al N. Pasada obligatoria: **POST de todo → PATCH de los superados**, con
`invalid_at` = la fecha del que lo sucede. Nunca al revés.

🔴 **Dos modos del mismo derivador, y el dataset sólo ejercita uno.** En la carga histórica el
derivador **conoce el futuro** de cada hecho —tiene los 6 meses completos— y calcula todas las
invalidaciones de una vez. En producción sólo puede invalidar cuando **llega** el evento siguiente,
sin saber si va a llegar. Si sólo se prueba la carga de golpe, **el modo incremental nunca se
ejercitó**. El plan de prueba tiene que incluir las dos formas: los 6 meses de una, y después eventos
sueltos uno por uno.

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

### 7.3 ✅ `Concepto` sale del CATÁLOGO del negocio, no de los presupuestos

Decidido. Resuelve de raíz la fragmentación: el nodo no se deriva del texto libre que alguien tipeó en
un presupuesto, sino de una lista declarada por el emprendedor.

⚠️ **Ese catálogo hoy no existe.** Medido:

```
copiloto_perfil_negocio.que_vende → UN texto libre de 500 chars ("Instalaciones eléctricas")
```

Es una frase, no una lista. **Hay que crear la lista de "qué vendo"** (ítem: nombre + precio de
referencia) como parte de la configuración del negocio — función chica y nueva. Destraba dos cosas a
la vez: el nodo `Concepto` limpio, y presupuestos que se arman **eligiendo** en vez de tipeando (que
además es lo que hace que la serie de precios exista).

---

## 9. Las preguntas que Inteligencia de Negocio tiene que contestar

Redactadas como las diría un emprendedor. **La columna que importa es la última**: la ontología existe
para que estas preguntas tengan respuesta, no al revés. Lo que no esté interpolado en el
`fact_template` de alguna arista, no se puede contestar.

| # | La pregunta | De dónde sale | ¿v1 la cubre? |
|---|---|---|---|
| 1 | *«¿Quién me debe?»* | Comprobante emitido sin cobro asociado | ❌ **HUECO — ver 9.1** |
| 2 | *«¿Cuánto me compró la panadería este año?»* | `FACTURADO_A` + `valid_at` | ✅ |
| 3 | *«¿Quiénes son mis mejores clientes?»* | ranking sobre `FACTURADO_A` | ⚠️ el ranking es **SQL**; el grafo da el detalle de por qué |
| 4 | *«¿Qué clientes me dejaron de comprar?»* | ausencia de eventos recientes | ⚠️ es una consulta de **ausencia** — SQL, no búsqueda semántica |
| 5 | *«¿Cuánto cobraba antes por esto? ¿Cuándo lo subí?»* | `PRECIO_DE` con su serie de `valid_at`/`invalid_at` | ✅ **es la pregunta que justifica la bitemporalidad** |
| 6 | *«¿Cuántos presupuestos mandé y cuántos me aceptaron?»* | `ESTADO_PRESUPUESTO` | ❌ **HUECO — ver 9.2** |
| 7 | *«¿A quién le presupuesté y nunca me contestó?»* | presupuesto sin desenlace + antigüedad | ❌ mismo hueco que 6 |
| 8 | *«¿En qué se me va la plata?»* | `REGISTRO_GASTO` por `Categoria` | ✅ |
| 9 | *«¿Este mes gasté más que el anterior?»* | comparación de dos períodos | ⚠️ **SQL** — es aritmética, no relación |
| 10 | *«¿Cuánto me queda?»* (entró − salió) | caja | ⚠️ **SQL**, y es Contabilidad, no el grafo |
| 11 | *«¿Este proveedor me subió los precios?»* | `PAGADO_A` + montos en el tiempo | ✅ |
| 12 | *«¿Qué le vendí a este cliente la última vez?»* | `FACTURADO_A` + `INCLUYE` → `Concepto` | ✅ (una vez que exista el catálogo, §7.3) |
| **13** | ***«¿Cuánto me dejó este trabajo?»*** | la cadena + `IMPUTADO_A` | ✅ **la que justifica imputar gastos** |
| **14** | ***«¿Qué tipo de trabajo me deja más?»*** | ídem, agregado por `Concepto` | ✅ **la única que puede hacerle subir un precio** |
| **15** | *«¿Cuánto entró en efectivo este mes?»* | `COBRO` con su origen | ✅ — imposible antes de que Ingresos existiera |

**El patrón que revela la tabla:** las preguntas de **cuánto** son SQL; las de **qué/quién/cómo se
relaciona/qué cambió** son del grafo. Coincide con el invariante que ya teníamos, pero ahora
pregunta por pregunta en vez de como principio.

### 9.1 🔴 HUECO — no hay forma de saber si una factura fue cobrada

```
afip_comprobantes.estado          → 'emitida' | 'anulada'   (no existe 'cobrada')
mp_payments.external_reference    → se usa en el checkout de MercadoPago (dispatcher_emprendedor.py:106),
                                    NO para enlazar un cobro con un comprobante
```

No hay ninguna arista `Cobro → Comprobante` posible porque **el dato no existe en la base**.
*«¿Quién me debe?»* —probablemente la pregunta #1 de cualquier emprendedor— hoy no tiene respuesta, ni
por grafo ni por SQL. **Es un hueco de producto, no de ontología.**

### 9.2 🔴 HUECO — un presupuesto no tiene estado

El store deriva dos estados: `facturado` (existe un comprobante cuyo `workflow_id` corresponde al
`factura_id`) y `reemplazado_por`. **No existe *aceptado*, *rechazado* ni *sin respuesta*** — y sobre
todo, no existe la **acción** de marcarlo. Sin eso, la tasa de conversión (#6) y el seguimiento de
presupuestos colgados (#7) no se pueden contestar.

*Y notar:* `facturado` es una **inferencia**, no una declaración. Un presupuesto aceptado de palabra y
todavía no facturado es indistinguible de uno que el cliente rechazó.

### 9.3 Lo que estos dos huecos prueban

Ninguno se ve mirando el esquema ni la ontología: **sólo aparecen cuando se escribe la pregunta
primero.** Es el argumento de por qué las preguntas van antes de fijar la ontología, y no después.

**Y hubo un tercero, que apareció más tarde y era el más grave:** al preguntar si los cobros también
debían recibir imputación de gastos, salió que **un cobro sólo existía si pasaba por MercadoPago**. El
efectivo y las transferencias no dejaban rastro. No era un problema de imputación: **la caja contaba
la mitad de los ingresos y daba un número prolijo**. Lo resuelve la función Ingresos
(`addendum_..._INGRESOS-funcion-propia`).

*La lección se repite en las tres: **un hueco de datos no se ve mirando los datos**. Se ve cuando
alguien intenta responder una pregunta concreta y no puede.*

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
