---
name: un-control-a-nivel-archivo-no-ve-la-divergencia-adentro
description: Medí "archivos que existen sólo en el destino = 0" y concluí que sembrar era seguro — la divergencia no estaba entre archivos sino DENTRO de uno, y el reconciliador pisó trabajo del día
metadata:
  type: feedback
---

**2026-08-07.** Antes de correr `scripts/seed-memory.sh` (reconcilia `memoria/` del repo con el
directorio de auto-memory del slug) corrí el control que la doctrina pide: *¿hay archivos que vivan
sólo en el destino y que el script podría borrar?*

```
repo: 223 .md   slug: 213 .md   sólo-en-slug: 0
```

Cero. Con control positivo corrido (verifiqué que el chequeo veía los compartidos). Conclusión:
*"el repo es superconjunto, no hay nada que perder"*. **Corrí el script.**

## Qué pasó

`rescatados: 0 · purgados: 0 · **divergentes: 174**`. El working tree quedó con la versión del slug
en 9 archivos —incluidos `MEMORY.md` y `HISTORIA.md`— y **perdió la poda del índice que yo había
hecho esa misma tarde**. Se salvó porque ya estaba mergeada en `main`; si no hubiera abierto el PR
antes, no la recuperaba.

Peor: al medir después entrada por entrada, el índice del slug tenía **64 líneas que `main` no
tiene**, y `main` tenía otras que el slug no. Los dos habían divergido **en ambas direcciones**.
Sembrar la versión "buena" habría borrado esas 64.

## Por qué el control no sirvió (y no era un control mal hecho)

**La pregunta era incompleta, no la medición.** Pregunté por divergencia **entre** archivos —
existe / no existe — cuando la que importaba era **dentro** de un archivo. Los 223 topic files
estaban todos; lo que había divergido era el **contenido de `MEMORY.md`**, que es un archivo que
ambos lados editan constantemente y que no aparece en ningún conteo de faltantes.

Un control a nivel de **existencia** responde *"¿falta algo?"*. Nunca responde *"¿lo que hay dice lo
mismo?"*. Y el reporte del script lo dijo con todas las letras —`divergentes: 174`— sólo que
**después** de haber escrito. El contador que importaba no era el que yo había mirado antes.

Es la trampa hermana de [[vacio-no-es-hallazgo-correr-el-control]]: allá el instrumento devuelve
vacío porque está mudo; acá devuelve un **cero verdadero** a una pregunta que no era la relevante.
Un cero correcto a la pregunta equivocada se siente idéntico a luz verde.

## How to apply

1. **Antes de correr cualquier reconciliador / sync / espejo, medí las DOS granularidades:**
   qué archivos faltan de cada lado **y** cuáles existen en ambos con contenido distinto
   (`diff -rq origen destino`, o hash por archivo). La segunda es la que muerde.
2. **Y en las dos direcciones.** "El origen es superconjunto" es una afirmación sobre el conjunto de
   archivos que no dice nada sobre el contenido de la intersección.
3. **Si la herramienta tiene un contador de divergentes, es porque el caso existe.** Un contador que
   sólo podés leer *después* de escribir es un contador que llega tarde: buscá cómo obtenerlo antes
   (`--dry-run`, o reproducí su comparación a mano). `seed-memory.sh` **no tiene `--dry-run`** — esa
   es la deuda concreta que este caso deja.
4. **Commiteá y mergeá antes de correr algo que reconcilia.** Lo que salvó la poda no fue el control:
   fue que ya estaba en `main`. Ver
   [[checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree]].

## Estado que deja (medido, no asumido)

`memoria/MEMORY.md` de `main` (32.081 bytes, 157 entradas) y el del slug (49.663 bytes, 183
entradas) **divergen en ambas direcciones**: 64 entradas viven sólo en el slug. Reconciliarlos es un
merge de índices a mano, no un sembrado — y hasta que se haga, **`seed-memory.sh` no se corre**.
Contexto de fondo en [[memoria-repo-vs-slug-drift]].

---

## Segundo caso (2026-09-30): la corrección **in-situ** — mismo path, mismo id, y lo que cambió vive adentro

Buscaba qué filas de mediciones viejas están retiradas, para que un contraste las excluya. La única fila
invalidada del corpus (`chat`) **ya no lo está**: su autor la corrigió **dentro del mismo archivo** el
mismo día —la partió en dos caminos (`PARTIDO: camino-directo · camino-buzón-de-pendientes`), dejó la
marca «Actualizado Cierre A Paso 2» y **borró la frase que se reprochaba** (0 ocurrencias hoy)—. No hay
sucesor, no hay cambio de path, no hay documento nuevo.

**Por qué rompe el excluidor:** un excluidor por `(documento, id)` ve **el mismo par en los dos lados**.
No tiene nada que excluir, y si igual toma la lista de invalidadas como fuente de verdad **retira dos
filas vigentes y corregidas** — el daño exacto que venía a evitar, un nivel más abajo. «Excluir por fila
en vez de por documento» no alcanza: hace falta **por fila y por versión**.

**Cómo aplicar:** antes de comparar dos cosas por su identidad, preguntá **«¿esta unidad puede cambiar sin
cambiar su nombre?»**. Si la respuesta es sí —un archivo editable, una fila de tabla, un mensaje que su
autor puede corregir—, el par `(nombre, id)` no distingue versiones y la fuente de verdad no es la lista
que declara el problema: es **el documento medido**. Ver [[un-enum-al-final-del-renglon-lo-borra-el-que-appendea]].

---

## Refuerzo 2026-10-05 · la variante HOMÓNIMA: el nombre no identificaba un documento, identificaba una familia de CUATRO (de dos autoras)

Un dictamen midió `matriz-web-re-medida` y publicó **«0 de 12»** para exculparlo. La medición era
correcta; el sujeto no existía. `matriz-web-re-medida` no es un documento: es un **prefijo** que
matchea **cuatro** archivos —`…_frontend1…_matriz-web-re-medida.md`, `…-v2.md`,
`…-v2-filas-3-a-6.md` y `…_frontend2…_matriz-web-re-medida.md`— que entre los cuatro aportan **8** de
los 11 veredictos que el dictamen declaraba ajenos. El «0» salió de mirar **un** miembro y concluir
sobre la familia.

**Dos agravantes que el conteo por nombre no puede ver:**

1. **La familia tiene dos AUTORAS.** Tres archivos son de una sesión y el cuarto de otra. La
   instrucción que los superaba decía «marcá **tus tres**» — correcta y cumplida, y estructuralmente
   incapaz de alcanzar al cuarto, porque **nadie edita el documento de otra sesión**. Un barrido por
   dueño deja un hueco exactamente del tamaño de los homónimos ajenos.
2. **El sufijo es donde vive la divergencia.** `-v2` y `-v2-filas-3-a-6` no son copias: son la
   corrección y su continuación, y son las que aportan los veredictos. El prefijo compartido hace que
   el miembro mirado **absuelva a los hermanos**, igual que en [[una-fila-por-valor-de-una-variable-no-es-una-fila]]
   el stub sano absolvió al enfermo del mismo archivo.

**El control, una línea antes de publicar la cifra:** cuando un dictamen (o un grep, o una exclusión)
**nombra** un documento, contar cuántos archivos matchean ese nombre y **declarar el número**. Si es
>1, el nombre no es el sujeto: el sujeto es el archivo, y hay que medirlos todos. Mismo test que
[[dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una]] — contá definiciones, no usos.

---

## Refuerzo 2026-10-11 · el check de presencia GLOBAL: una mención en otra parte ABSUELVE a la tabla rota

Mismo patrón, un nivel arriba, y esta vez lo cazó un **mutante** y no yo. El gate de cierre del
relevamiento mobile verificaba la partición así: *¿aparece `**301**` en el documento?* — **en
cualquier parte**. Pasaba.

Después escribí, en la sección que describe el gate, la frase *«el gate asevera la partición real de
**301**»*. A partir de ahí, el mutante que **rompe la tabla** (`**301**` → `**299**` en la fila del
total) **salió VERDE**: mi mención suelta, en otra sección y a propósito de otra cosa, **absolvió a
la tabla rota**. El check nunca había medido la propiedad — medía que el número *estuviera escrito
en algún lado*, y mientras hubo un solo lugar donde estaba, las dos cosas parecían la misma.

🔑 **La forma general: un check de presencia global degrada a medida que el documento crece.** El día
que se escribe una segunda mención —una cita, un resumen, un ejemplo, una sección que habla del
instrumento— el check deja de poder distinguir «la tabla dice 301» de «alguien escribió 301». Y no
avisa: el verde es idéntico antes y después. La propiedad vive **en la tabla**, así que ahí hay que
medirla. Es el mismo *«el stub sano absolvió al enfermo del mismo archivo»*, con el documento entero
como archivo.

**Dos cosas que este caso deja probadas, y son el argumento para pagar el costo del bloque de mutantes:**

1. **Sin el mutante, el agujero se publicaba con cara de verde.** Ningún control positivo lo habría
   encontrado: el documento *real* cumple, así que todo control sobre el documento real sale bien.
   Sólo una **mutación que rompe la propiedad a propósito** distingue un check que mide de uno que
   mira para otro lado. → [[el-canario-el-control-positivo-de-lo-que-falla-callado]]
2. **El gate se degradó por una edición MÍA, no por un cambio del sujeto.** El instrumento y el
   documento que mide se escriben juntos, así que cada vez que agrego prosa puedo estar aflojando un
   check sin tocarlo. Después de editar el documento, el gate se **vuelve a correr**: su verde tiene
   fecha.

**Cómo aplicarlo:** todo check que pregunta *«¿aparece X?»* lleva **el alcance en la pregunta**:
*¿aparece X **en la tabla / en la función / en el bloque** donde X es la propiedad?* Si el alcance es
«el archivo» o «el documento», escribí al lado qué segunda mención lo volvería ciego — y si podés
nombrarla, ya está ciego.
→ [[instrumento-que-no-mira-nunca-falla]] · [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]

---

## Refuerzo 2026-10-13 · el VEREDICTO de grano grueso: una celda con varias cláusulas se absuelve entera

El mismo patrón, pero en el **juez** y no en el check. Una celda del corpus del mapeo (fila
`ajustes`) acumulaba cuatro cláusulas de divergencia. El veredicto que le pusieron fue **uno**:
`C` — «el mapeo quedó viejo» — con dos citas.

Medido después, cláusula por cláusula: **una estaba mal y la otra estaba bien.**

- «"Mi plan" es `PantallaAndamiaje` (placeholder)» → **falso**, y el corpus era el equivocado: no es
  un placeholder, **no existe**, salió por decisión firmada y hay **control negativo** que lo fija
  (`PantallaAjustes.test.tsx:54-59`).
- «"Cómo hablarle" fusionado» → **era correcta**. El `C` la absolvió **midiendo otro referente**: lo
  medido fue *«¿existe una pantalla con ese nombre?»* (sí, `PantallaTono.tsx`) y lo afirmado era
  *«¿es una ENTRADA de primer nivel?»* (no: se llega desde Mi negocio). Dos preguntas, un veredicto.

🔑 **La forma general: el veredicto hereda el grano de la celda, no el de la afirmación.** Cuando una
celda dice tres cosas y el juez escribe un símbolo, el símbolo **saca la celda entera del
escrutinio** — y lo saca con cara de trabajo hecho, porque *hubo* medición y *hubo* citas. La mitad
no medida queda indistinguible de la medida, igual que en el caso del `301`: ahí una mención suelta
absolvió a la tabla; acá una cláusula verdadera absuelve a sus vecinas.

**Y el agravante propio de este caso:** la absolución era de **otra sesión**. Nadie reabre un
veredicto ajeno por reflejo —hacerlo sería el ruido que la coordinación evita—, así que el grano
grueso de un juez externo es **más** duradero que el propio. Un `C` ajeno vive hasta que alguien
mida la celda por su cuenta, y la regla de no reabrir ✅ (que es correcta) lo protege.

**Cómo aplicarlo:**
1. **Un veredicto por cláusula, no por celda.** Si la celda tiene `;` o `/` separando afirmaciones,
   tiene tantos veredictos como afirmaciones. Una celda multi-cláusula con un solo símbolo es un
   pedido de re-medición, no un resultado.
2. **Al emitir el veredicto, citá la cláusula que estás midiendo**, con sus palabras. La cita obliga
   a notar que quedan otras: es el mismo mecanismo que escribir el alcance dentro de la pregunta.
3. **Al leer un veredicto ajeno, contá las cláusulas de la celda y compará con las citas.** Más
   cláusulas que citas ⇒ hay mitades mudas, y cuál es cada una se decide midiendo, no deduciendo.
4. **Corregir el grano NO es reabrir la fila.** La enmienda se anota con su evidencia y la decisión
   que quede abierta se rutea a quien decide; el padrón no se mueve. Mezclar las dos cosas convierte
   una corrección de instrumento en un criterio que crece.
→ [[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]] · [[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]] · [[un-criterio-que-crece-con-cada-medicion-no-se-puede-alcanzar]]**Refuerzo 2026-10-14 — el mismo mecanismo un nivel mas abajo: la FUNCION no ve la rama muerta
adentro.** Para el DoD de SM-E3 («ninguna capacidad queda en el medio») barri las funciones de red de
`packages/core` contra sus consumidores en `apps/`: **71 funciones, 0 sin consumidor**, con control
positivo (`leerTablero` → 6) y negativo (nombre inventado → 0). Lei ese verde como «el DoD global
esta verificado». Lo que acreditaba era otra cosa: **ninguna funcion quedo huerfana**.

Horas despues, mirando a mano, `GET /trabajos/{eslabon}/{ref}/margen`: cableado en core como
`?detalle=<eslabon>:<ref>` de `leerGraficoMargenTrabajo`, con tipo y test propios — y **ninguna
pantalla lo pide** (`GraficosInteligencia.tsx:153` llama sin params; 0 ocurrencias de
`DetalleMargenTrabajo` / `modo === 'detalle'` en todo `apps/`). La funcion SI tiene consumidor, asi
que mi barrido la conto como sana. La **rama** `modo: 'detalle'` de su retorno estaba muerta.

**Why:** la granularidad del instrumento es el techo de lo que su verde acredita, y ese techo no
aparece en la salida — el `0 sin consumidor` se lee igual de tranquilizador cuente archivos,
funciones o ramas. Un hueco mas fino que la unidad que contas es invisible por construccion, no por
error.

**How to apply:** cuando el retorno es una **union discriminada** (`modo: 'lista' | 'detalle'`,
`status: 'ok' | ...`), contar consumidores **por variante**, no por funcion: una variante con 0
consumidores es el mismo hueco que una funcion con 0 consumidores. Y al reportar un barrido, escribir
la UNIDAD que conto —«0 funciones huerfanas», no «0 huecos»— porque la cifra sin unidad se deja citar
para cualquier pregunta ([[una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta]]).
