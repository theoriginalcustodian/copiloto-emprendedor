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

Relacionadas: [[vacio-no-es-hallazgo-correr-el-control]] (el vacío es una pregunta) ·
[[el-pipe-se-come-el-exit-code]] (la otra forma de leer verde sin medir) ·
[[bucle-canonico-dos-auditorias-y-el-enganche]] (§12, la ley de los instrumentos).
