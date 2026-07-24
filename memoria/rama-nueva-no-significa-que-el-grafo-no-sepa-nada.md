---
name: rama-nueva-no-significa-que-el-grafo-no-sepa-nada
description: El pre-push trata "rama sin remote_sha" como "sincronizar el repo entero"; la base correcta es el merge-base con origin/main. Deuda con dueña y fecha.
metadata:
  type: project
---

`.githooks/pre-push` elige incremental vs completo por el `remote_sha` que git le pasa por stdin:
si viene en ceros (`:38`) marca `full=1` y corre el sync **del repo entero** (`:54`, sin `--since`).

Un `remote_sha` en ceros significa **«esta rama no existe en origin»**, y el hook lo lee como
**«el grafo no sabe nada»**. No es lo mismo: la rama salió de `main`, que ya está ingerida. Lo único
nuevo son sus commits propios. La base correcta es `git merge-base origin/main <local_sha>`.

**El síntoma no se parece a un bug.** El push «tarda minutos» la primera vez que se sube una rama —
que es exactamente cuando uno espera que git tarde un poco. Backend (2026-07-24) lo cortó dos veces
por timeout propio antes de que alguien mirara el hook; nada se corrompió (el bridge es incremental
con checkpoint), pero se perdieron dos intentos y el hito quedó frenado con el trabajo hecho.

**Por qué se cuela:** el fail-closed es correcto y el código *hace lo que dice*. El error está una
capa más arriba, en traducir un valor centinela (`0000…`) a una intención («resincronizá todo»).
Hermano de [[el-nombre-es-una-hipotesis-sobre-el-contenido]]: el centinela describe el **estado del
remoto**, no el **estado del grafo**, y se los trató como el mismo hecho.

**Salida mientras tanto:** `git push --no-verify` (contemplado en el propio hook, `:16`) + correr el
sync una sola vez después del merge a `main`, en vez de una vez por rama. El fail-closed se conserva
si quien saltea el hook **nombra a la dueña del sync**, no si simplemente lo omite.

**Deuda GESTIONADA** — dueña: planificación · pago: antes del próximo hito que abra rama (hito C).
Ver [[cero-deuda-no-gestionada]].
