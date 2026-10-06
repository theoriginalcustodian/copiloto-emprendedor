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

**Refuerzo (2026-09-30) — `find` sobre el buzón devuelve TAMBIÉN el sidecar.** Usar `find` para
ubicar el archivo (que es la lección de arriba) tiene su propio filo: el escalador mantiene
`coordinacion/.escalador-estado/<nombre>.first-seen` por cada mensaje, así que un `find` sin acotar
matchea **dos** rutas para un solo mensaje. Unidas por newline en `$(...)`, el `mv` y el `cat`
reciben un argumento inexistente:

```
mv: cannot stat '…first-seen'$'\n''…abierto/….md': No such file or directory
```

El error señala un archivo que «no existe» cuando los dos existen — la falla no se parece a su causa.
Se acota con `find "$BZ/abierto" -maxdepth 1 -name "*<slug>*.md" -type f`: la carpeta, la
profundidad y la extensión, las tres. El sidecar vive **fuera** de `abierto/`, así que `-maxdepth 1`
sobre la carpeta correcta ya lo excluye.

## Refuerzo 2026-10-06 — reescribir un artefacto del buzón con un TYPO en el nombre no reemplaza: DUPLICA, y el refutado queda circulando

Mismo día, dos formas de que la ruta del buzón traicione, y la segunda la pagué **justo mientras decía
estar evitándola**.

**El caso.** Había difundido un `urgente_` a tres sesiones con el diagnóstico de `main` ROJO. Un spike
propio refutó mi mecanismo, así que fui a **reescribir el archivo en el cuerpo** —no appendeando, porque
una corrección al final deja el titular equivocado adelante. Escribí el nombre con un typo
(`el-cleanto-` por `el-cleanup-`) y el resultado fue **dos archivos de 5,5 KB con nombres casi idénticos**:
uno con el titular refutado —el que ya había difundido por tres mensajes— y otro con la corrección.
Durante ese rato, lo que circulaba era el equivocado, y la versión buena era invisible porque nadie tenía
ese nombre.

**Por qué el typo no da síntoma.** Una escritura a un nombre nuevo **siempre** tiene éxito: no hay colisión
que avisar, no hay exit code que mirar, y el archivo nuevo se ve perfecto. La operación que yo creía estar
haciendo —*reemplazar*— y la que hice —*crear*— **comparten el resultado «OK»**. Es el pariente del stub
que crea un `>>` a ruta supuesta: en los dos casos, lo que falla es la **identidad del destino**, y la
identidad no se verifica sola.

**El control, y es de una línea:** después de escribir, **contar los artefactos del tema**, no verificar el
que escribiste.

```bash
ls coordinacion/abierto/ | grep -c 'MAIN-ROJO'   # 1, o hay un duplicado circulando
```

Verificar «¿se escribió bien mi archivo?» da verde en los dos mundos. Verificar «¿cuántos archivos
responden a este tema?» separa *reemplacé* de *dupliqué*. Mismo patrón que
`[[el-mismo-defecto-vivia-dos-veces-el-fix-en-la-capa-compartida-no-alcanzo]]`: contá **definiciones**, no
mires la que acabás de tocar.

**Y la regla de recuperación, que no es obvia:** el que sobrevive tiene que ser **el nombre ya difundido**,
no el nombre correcto. Los tres mensajes que mandé citaban la ruta vieja; renombrar el bueno habría roto
tres punteros para arreglar una letra. Se pisa el difundido con el contenido corregido y se borra el otro —
`[[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]`, aplicado a su propia corrección.

---

**Refuerzo (2026-10-06): «ubicá con `find`» NO alcanza, y lo probé pisando un archivo de estado del escalador.**
Esta entrada manda no suponer la ruta del buzón y localizar el archivo con `find`. Hice exactamente eso:

```bash
T=$(find "$BZ" -name '*pedido_auditoria-a-planificacion_REVERSIONLATENTE*' -print -quit)
cat ampliacion.md >> "$T"
```

y las 48 líneas de la ampliación se fueron a
**`coordinacion/.escalador-estado/<mismo-nombre>.md.first-seen`** — el **sidecar** que `escaladores-buzon.sh`
usa para medir la edad del mensaje (`SIDECAR_SUF=".first-seen"`, `:78`). **El sidecar replica el nombre completo
del mensaje y le agrega un sufijo, así que matchea el mismo glob** — y con `-print -quit` gana el que el
recorrido encuentre primero, que fue el oculto. Resultado: la ampliación **no llegó a planificación** y un
archivo que debía contener **un epoch y nada más** (`1791325537`) quedó con 48 líneas de markdown.

**Lo que lo hace peor que un append a ruta inventada:** un stub en una ruta falsa es visible y no rompe nada
ajeno. Acá el destino **existía, era legítimo y era de otro mecanismo** — el `find` no falló, acertó a un
archivo que yo no sabía que existía. Y el daño es silencioso en los dos sentidos: nadie recibe el mensaje, y el
instrumento que mide la edad de los pedidos queda con un valor que no es un número.

**Lo correcto es `find` + la CARPETA acotada + `-maxdepth`:**

```bash
T=$(find "$BZ/abierto" -maxdepth 1 -name '*pedido_..._REVERSIONLATENTE*' -print -quit)
```

Con `abierto/` y `-maxdepth 1`, el sidecar de `.escalador-estado/` queda fuera por construcción. Y el control
que lo cierra: **después de escribir, verificar el archivo que se tocó** (`wc -l`, y el estado del buzón **es la
carpeta**, así que la carpeta es parte de la identidad del destino, no un detalle del camino).

**How to apply:** (1) `find` para ubicar, **siempre con la carpeta de estado acotada** (`abierto/`,
`en-curso/`, `cerrado/<fecha>/`) y `-maxdepth 1` — el estado es la ubicación, así que buscar en la raíz del
buzón es buscar en todos los estados **más los directorios internos de los mecanismos**; (2) desconfiá de
`-print -quit` cuando el glob puede matchear más de uno: pedí **todos** los matches y mirá la lista antes de
escribir, o el primero decide por vos; (3) después de un `>>`, imprimí **la ruta completa y el `wc -l`** del
archivo tocado — es una línea y separa «escribí donde quería» de «escribí donde el glob quiso»; (4) un
mecanismo que guarda **estado derivado del nombre** de otro archivo (sidecars, caches, marcadores) convierte
cualquier glob por nombre en ambiguo: ésa es la razón estructural, no un descuido mío puntual.
