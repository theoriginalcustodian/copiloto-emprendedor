---
name: append-a-ruta-supuesta-del-buzon-crea-un-stub-y-el-mv-pisa-el-contrato
description: "`>> abierto/X && mv abierto/X en-curso/` con X ya movido crea un stub y el mv pisa el original — perdí 4 contratos (K-07/08/10/11) el 21/09"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-22T04:27:40.364Z
---

En el buzón **el estado es la ubicación del archivo**, así que la ruta de un contrato cambia sin
aviso: la sesión que lo toma lo mueve de `abierto/` a `en-curso/`. El 2026-09-21 21:47 planificación
agregó un «## Estado» con `printf … >> abierto/<contrato>.md && mv … en-curso/`. Los cuatro contratos
(K-07, K-08, K-10, K-11) ya estaban en `en-curso/`: el `>>` **creó** un archivo nuevo de ~220 B con
sólo el estado, y el `mv` **pisó** el contrato real. Nadie lo notó por ~7 h; lo destapó la auditoría
A3 al buscar qué decidió K-10 sobre el dispatcher. Se restauraron desde `scratchpad/` (el borrador
con que se bajaron); los acuses que otras sesiones pegaron al final se perdieron.

**Why:** `>>` nunca falla si el archivo no existe (lo crea), y `mv` sobre un destino existente
reemplaza en silencio. Las dos operaciones «seguras» se componen en una destructiva.

**How to apply:** para escribir en un archivo del buzón, **ubicarlo primero** (`find coordinacion
-name '<slug>*'`) y fallar si no aparece exactamente uno; nunca `>>` a una ruta supuesta. Para
moverlo, `mv -n` (no-clobber) y verificar que el origen desapareció. Tamaño sospechoso de un
contrato (< 1 KB) = pisado: `find … -name '*contrato_*' -size -1k`.

Relacionado: [[buzon-se-ordena-por-janitor-no-por-disciplina]] · [[rastro-del-intento-pisa-al-hecho]]

## ADENDA 2026-09-29 — `find | head -1` eligió la copia de una carpeta de ESTADO, no el original

La regla de arriba dice «ubicar con `find` y `mv -n`». **La cumplí y falló igual**, por una razón que
no estaba escrita: el `find` barría `coordinacion/` **entera**, y el buzón tiene carpetas de estado de
otras herramientas con **los mismos nombres de archivo**. `coordinacion/.escalador-estado/` guarda 54
copias de pedidos. Mi `find … | head -1` devolvió la copia del escalador, y el `mv` la sacó de ahí —
tocando el estado interno de un proceso ajeno — mientras **el original seguía en `abierto/`**, sin
cerrar.

Control que lo detectó: contar el pedido en cada carpeta por separado, en vez de asumir que el `find`
había encontrado «el» archivo. Reparado devolviendo la copia a `.escalador-estado/` y moviendo después
el original de `abierto/`; estado final medido carpeta por carpeta (`abierto 0 · cerrado 1 ·
escalador 54`).

**Dos reglas concretas:**

1. El `find` va **anclado a la carpeta de estado** que te importa (`coordinacion/abierto/`), nunca a
   `coordinacion/` entera.
2. Si devuelve **más de un hit, pará** — no `head -1`. Varias copias del mismo nombre significan que
   hay estado ajeno en juego, y ahí elegir la primera es elegir al azar cuál proceso rompés.

**Y un dato para el dueño del escalador:** la copia de `.escalador-estado/` y el original de `abierto/`
tenían **sha256 distintos**, así que esa carpeta no guarda una copia fiel del pedido vigente.

Emparentado: [[el-instrumento-respondio-sobre-otro-sujeto]] — el comando contestó, pero sobre otro
archivo, y sin fallar.
