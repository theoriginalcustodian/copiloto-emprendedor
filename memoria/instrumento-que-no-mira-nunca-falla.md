---
name: instrumento-que-no-mira-nunca-falla
description: Un control cuyo rango de observación casi siempre sale vacío no verifica nada, y su silencio se lee como verde. Verificar que el instrumento MIRÓ es un paso distinto de verificar que pasó.
metadata:
  type: feedback
---

Un control positivo se construyó para probar que el sync del grafo **llegó al servidor**. Su primera
corrida real: el sync subió **15.906 filas** y el control respondió *«nada verificable en este rango»*
— comparaba contra `HEAD~1`, y los archivos del último commit no caían en los directorios indexados.

**No falló. No dijo que sí. Dijo que no miró — y eso se leyó como "todo bien".**

Es un escalón más abajo que [[instrumentos-que-confirman-en-vez-de-verificar]]. Aquel habla del
instrumento que responde mal; éste, del que **no responde** y cuyo silencio pasa por aprobación. El
código estaba bien escrito: distinguía «encontrado» (0), «no encontrado» (1) y «nada que mirar» (2),
que es más honesto que la mayoría. El defecto estaba en que **el rango de observación casi nunca
contenía algo observable**, así que la rama honesta era la única que se ejecutaba.

**La pregunta que lo caza**, y hay que hacerla aparte de «¿pasó?»:

> **¿Sobre cuántos elementos miró este control? Si la respuesta puede ser cero sin que nadie se entere,
> el verde no significa nada.**

Un DoD no está cumplido porque el comando salió 0: está cumplido cuando se puede nombrar **qué
observó**. Acá: `'scripts_graph_sync' está en Graphity — uuid b4687a87…`. Eso es evidencia; `exit 0`
no lo es.

**Y el diferencial es obligatorio.** Un control que dice que sí sobre algo presente no prueba nada
hasta que se lo ejercita contra algo ausente:

```
uuid inexistente -> node_exists = False
uuid real        -> node_exists = True
```

Sin esas dos líneas juntas, «está en Graphity» es compatible con un cliente que devuelve `True`
siempre.

**Dónde más aplica:** cualquier check que filtre antes de mirar — tests que se saltean por una
condición y reportan verde, linters con un `exclude` que se comió el directorio, greps de auditoría
sobre un glob equivocado, gates de CI que pasan porque el job no corrió. El patrón es el mismo:
**el filtro vacía la muestra, y el resultado vacío se pinta del color del éxito.**

## 🆕 La variante que muerde a un gate BIEN hecho: el veredicto más ancho que la medición

*Caso 2026-08-07, corpus de la KB.* Se escribió un gate para el corpus del RAG con todo lo que esta
entrada pide: **canario horneado** (4 defectos sembrados, los cazaba 4/4), **denominador impreso**
(«17 documentos auditados»), y el corpus vacío tratado como error y no como ausencia de hallazgos.
Salida: `0 hallazgos` → **`✓ corpus apto para ingest`**.

Fusion corrió su propio validador sobre el mismo corpus: **8 de 17 documentos perdían contenido al
ingestar** — 6.563 caracteres, porque las secciones acumulativas («Preguntas frecuentes», «Errores
frecuentes») cruzaban el tope de 1800 del chunker y **el final se truncaba en silencio**.

**Los tres ejes que el gate medía estaban impecables.** No falló en nada de lo que miraba. El defecto
está un nivel más arriba: **midió headers, PII y marcadores, y concluyó "apto para ingest"** — un
veredicto que abarca *todos* los ejes que importan para ingestar, no los tres que sabía mirar.

> **Un gate riguroso dentro de su eje puede emitir un veredicto que no le corresponde.** El canario y
> el denominador protegen de medir mal; **no** protegen de concluir de más.

**La pregunta que lo caza** (distinta de «¿sobre cuántos miró?»):

> **¿Mi veredicto usa palabras más anchas que mis ejes?** «Apto para ingest» ⊃ «pasa los 3 chequeos
> que escribí». Si la conclusión es más general que la medición, o se angosta la conclusión, o se
> agregan los ejes que faltan.

**El arreglo fue de raíz, y reutilizando:** el validador de chunking no se reimplementó — se
incorporó al gate (`scripts/validar_chunking_kb.py`, invocado por `kb-corpus-check.sh`), y el gate
**se niega a declarar el corpus apto si ese validador no está**, con su propio control probado
(sacar el archivo ⇒ exit 1). El veredicto ahora nombra los dos ejes: *«los DOS ejes en verde (forma
+ truncado)»*.

**Y el detalle que lo hacía indetectable desde adentro:** el truncado **no produce error**. El
documento se ingesta, los chunks existen, el retrieval devuelve algo. Lo que falta son *las últimas
preguntas de cada FAQ* — que en un corpus de soporte son las que se agregaron con el uso, o sea las
más buscadas. Un fallo que se lleva justo lo más valioso sin levantar la mano.

Relacionadas: [[vacio-no-es-hallazgo-correr-el-control]] (el vacío es una pregunta) ·
[[el-pipe-se-come-el-exit-code]] (la otra forma de leer verde sin medir) ·
[[bucle-canonico-dos-auditorias-y-el-enganche]] (§12, la ley de los instrumentos).
