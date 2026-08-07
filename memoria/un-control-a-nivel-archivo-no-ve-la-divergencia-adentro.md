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
