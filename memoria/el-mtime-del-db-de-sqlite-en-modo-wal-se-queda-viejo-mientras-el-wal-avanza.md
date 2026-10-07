---
name: el-mtime-del-db-de-sqlite-en-modo-wal-se-queda-viejo-mientras-el-wal-avanza
description: Medir "¿cuándo fue la última escritura?" por el mtime del .db de SQLite da una hora vieja cuando la base está en modo WAL — las escrituras van al -wal y el .db sólo se toca en el checkpoint interno; el trío .db/-wal/-shm se mira entero, y el instrumento de verdad es el archivo de estado que el proceso escribe al terminar.
metadata:
  type: feedback
---

**2026-09-30, diagnosticando por qué ninguna de las cuatro sesiones podía pushear.** Quise acotar la
ventana de fallo con el mtime del checkpoint del bridge del grafo, y publiqué esto en un `pedido_`:

> «El checkpoint quedó en 10:40 y mis intentos siguieron hasta 11:16. O sea el primero **sí** habló con el
> API y los siguientes **no llegaron a escribir nada** — degradación progresiva del host.»

**Falso, y de una clase que no se ve.** Veinte minutos después, con un sync corriendo, listé el
directorio entero en vez de un archivo:

```
checkpoint-copiloto-emprendedor.db      mtime 10:40:22    <= lo que yo habia medido
checkpoint-copiloto-emprendedor.db-wal  mtime 11:20:53    <= hace 40 segundos
checkpoint-copiloto-emprendedor.db-shm  mtime 11:20:53
```

La base está en **modo WAL**: cada escritura va al `-wal`, y el `.db` sólo se toca cuando SQLite hace su
**checkpoint interno** — que puede tardar minutos u horas. El `.db` no mide la última escritura de la
aplicación; mide la última vez que SQLite consolidó.

## Por qué no da síntoma

El `.db` **existe**, tiene un mtime **plausible**, y la hora que devuelve cae dentro del rango que uno
está investigando. No hay error, no hay vacío, no hay cero: hay **un dato viejo con cara de dato fresco**.
Es la misma familia que [[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]] —
ninguna de las dos falla ruidosamente— y la misma que
[[el-nombre-es-una-hipotesis-sobre-el-contenido]]: el archivo se llama `checkpoint-<repo>.db`, así que
"obviamente" es donde está el checkpoint.

**Y encima me dio una historia coherente.** 10:40 caía justo entre el marcador (10:22) y mis intentos
(10:45-11:16), así que la inferencia «el primero habló y los demás no» sonaba a diagnóstico. Un dato
equivocado que **contradice** lo que uno espera se revisa; uno que **encaja** se publica.

## El control

1. **Ante cualquier `*.db`, listá el trío**, no el archivo: `ls -la <base>*` y mirá `.db`, `-wal`, `-shm`.
   El mtime relevante es el **más nuevo** de los tres, y si `-wal` existe con tamaño > 0 hay escrituras
   sin consolidar.
2. **Mejor que el trío: el archivo de estado que el proceso escribe al terminar.** Acá era
   `.bridge/last-synced-<repo>.sha` — lo escribe `graph-sync.sh` **sólo** después de sus tres capas de
   verificación, así que su mtime sí significa «un sync completó». Un archivo que el proceso toca *de
   paso* nunca es el instrumento; el que escribe *para declarar* sí.
3. **Y no se puede reconstruir hacia atrás.** No tengo el mtime histórico del `-wal`, así que la pregunta
   «¿mis intentos 2-4 dialogaron?» quedó sin respuesta — no mal respondida: **sin responder**. Cuando el
   instrumento correcto no guarda historia, el veredicto honesto es «no lo sé», no la lectura del
   instrumento equivocado.

**Why:** porque el mtime de un archivo es la forma más barata de contestar «¿esto sigue vivo?» y se usa
sin pensar — en diagnósticos de procesos colgados, de crones que no corrieron, de syncs cortados. Con
SQLite en WAL (el default de muchas librerías, incluida la que usa este bridge) la respuesta barata es
**sistemáticamente vieja**, y el error se propaga a un `pedido_` que otra sesión va a usar para decidir
dónde mirar. Acá llegó a estar publicado: afirmé una degradación progresiva del host que no medí.

**How to apply:** (1) antes de usar el mtime de un `.db` como señal de actividad, `ls` el directorio y
mirá si hay `-wal`/`-shm` — si existen, el `.db` no es el instrumento; (2) preferí el archivo que el
proceso escribe **para declarar un resultado** sobre cualquiera que toque de paso; (3) si la única fuente
disponible no guarda historia, escribí «no lo sé» en vez de la lectura del archivo equivocado — y
**retirá** la afirmación anterior en el mismo lugar donde la publicaste, no en un mensaje nuevo, porque el
que lee el documento no ve tu corrección posterior.
