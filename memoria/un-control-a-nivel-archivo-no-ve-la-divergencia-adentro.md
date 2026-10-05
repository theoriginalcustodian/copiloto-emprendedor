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
