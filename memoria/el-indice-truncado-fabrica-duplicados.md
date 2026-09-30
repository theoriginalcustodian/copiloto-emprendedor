---
name: el-indice-truncado-fabrica-duplicados
description: Un índice de memoria que no entra en el límite de carga no sólo esconde entradas — hace que la sesión siguiente las vuelva a escribir, y cada copia lo trunca más. Bucle que se realimenta y no da síntoma
metadata:
  type: feedback
---

**Medido el 2026-08-01.** `memoria/MEMORY.md` pesaba **49,4 KB en 222 líneas** y el sistema lo cargaba
**hasta la línea 108 (~25 KB)**: el 48% del índice —114 líneas— **no llegaba a ninguna sesión, nunca**.
Del lado invisible caían cinco secciones enteras, incluidas *Estado / decisiones activas* y *Tareas
futuras (gated)*. Es decir: se leía la doctrina y **no** lo operativo vivo.

**Lo que no era obvio: el índice truncado no sólo esconde — FABRICA.** En la poda aparecieron **tres
archivos para el mismo hecho del mismo día** (autorización permanente de merge/deploy, 2026-07-23) y
**dos** para el mismo gotcha de Metro. No fue descuido: dos de los tres eran huérfanos del índice, así
que la sesión siguiente buscó, no encontró nada, y volvió a escribirlo. El bucle:

> entrada invisible → la próxima sesión no la encuentra → **la reescribe** → el índice crece →
> se trunca más arriba → más entradas invisibles.

Se realimenta solo, y **cada vuelta se siente productiva**: escribir una memoria nueva parece trabajo
de más, no de menos.

**Por qué no da síntoma.** Un índice truncado no tira error, no rompe un test y no contradice nada:
simplemente **la sesión no sabe lo que no sabe**. Es el caso puro de [[vacio-no-es-hallazgo-correr-el-control]]
aplicado al propio contexto — el vacío es "no recordé", que se confunde con "no estaba escrito". Y es
hermano de [[instrumento-que-no-mira-nunca-falla]]: un índice que no se carga entero se comporta igual
que uno completo, hasta que le pedís algo de la mitad de abajo.

**El control (hornearlo, no recordarlo).** `scripts/medir-indice-memoria.py`:
1. **Presupuesto** — el índice debe entrar **completo bajo el límite de carga** (~25 KB medido). El
   número no es estético: arriba de eso, lo que escribís no existe.
2. **Cobertura** — todo `memoria/*.md` tiene línea en el índice **o** en `HISTORIA.md`. Buscar el link
   markdown **y** el `[[wikilink]]`: mirar sólo uno da falsos (la 1ª versión de este control reportó 25
   huérfanas donde había 24).
3. **Sentido inverso** — links del índice que apuntan a archivos que no existen. El `seed` del 08-01
   encontró 3 que vivían sólo en el slug del harness.
4. **Duplicados** — descripciones muy parecidas entre entradas: es la firma del bucle.

**La regla que se derivó.** Una línea de índice es un **gancho**, no un resumen: título + qué te hace
hacer distinto, en un renglón. El detalle vive en el topic file — repetirlo en el índice paga el costo
en **cada** sesión para que la mayoría de las veces no se lea. Cuando el índice llega al techo, la
salida no es indexar más chico indefinidamente: es **bajar a `HISTORIA.md`** (que no se carga y es
buscable) todo lo que ya no cambia una decisión futura.

Hermana de [[cero-deuda-no-gestionada]]: una entrada invisible es deuda que ni siquiera figura como
deuda — el equipo no la redescubre, la **re-paga**.

---

## Refuerzo 2026-09-30 — el medidor contaba CARACTERES y el techo trunca por BYTES

El control del índice decía `23875 / 24000 chars [OK ] margen 125` y salía `rc=0`. El archivo pesaba
**25.210 bytes**: estaba **1.210 por encima** del techo. El instrumento llevaba absolviendo un índice
truncado, y la línea que lo causaba venía con su propia afirmación escrita al lado:

```python
# --- 1. presupuesto (en CARACTERES: es lo que el harness cuenta, no bytes) ---
peso = len(texto_indice)
```

Esa afirmación **nunca se verificó**. Y el archivo está lleno de multi-byte: 167 `—`, 43
variation-selectors de emoji y los acentos del castellano suman **1.335 bytes que el contador de
caracteres no ve**. En un índice en español con emoji como ganchos visuales, chars y bytes divergen
~5,6% — justo el orden del margen que uno cree tener.

**Lo que lo vuelve regla y no anécdota:** el mismo docstring, cuatro líneas más arriba, ya decía la
unidad correcta — «*debe entrar completo bajo el límite de carga (**~25 KB** medido)*». KB. El
instrumento sabía la unidad en su documentación y la perdía en su implementación. Es
[[el-guard-se-satisface-con-su-propio-comentario]] al revés: el comentario tenía razón y el código
no lo escuchó.

**Y el corte histórico estaba MAL ATRIBUIDO, que es el daño de segundo orden.** El 2026-09-22 el
harness cortó 7 líneas «con los chars en verde» (23.930/24.000) y se llevó dos reglas duras. El
script adjudicó ese corte al techo de **líneas** (207 > 200) y construyó un control nuevo (1.bis)
sobre esa lectura. Pero 23.930 caracteres con esta densidad son **~25.268 bytes**: el techo de bytes
**también** estaba cruzado. Había **dos causas suficientes** y el análisis eligió una, quedándose con
la que no explicaba el caso del 2026-08-01. Ver
[[dos-causas-suficientes-el-test-no-atribuye]]: acá el costo no fue un test que sale verde, fue un
**diagnóstico plausible que cerró la investigación** y dejó la causa real midiendo mal ocho días más.

**La pregunta que lo caza, aplicable a cualquier presupuesto:** *¿en qué unidad mide el LÍMITE, y en
qué unidad mide mi CONTADOR?* Si el límite lo impone otro sistema (un harness, un body de HTTP, una
columna de DB, un payload), la unidad es suya, no mía — y `len(str)` en Python, `.length` en JS y
`wc -m` cuentan **caracteres**, mientras que el que trunca casi siempre cuenta **bytes**. El control
es de una línea: `len(s)` contra `len(s.encode())`. Si difieren, uno de los dos está mintiendo sobre
el techo.

**El control positivo, que es el que cierra:** el fix se valida corriendo el medidor arreglado sobre
el **mismo archivo sin tocar**. Antes `rc=0`, «margen 125». Después `rc=1`, «se pasa 1210 bytes».
Mismo sujeto, veredicto opuesto — ver [[el-instrumento-tambien-CONDENA-no-solo-absuelve]]. Un fix de
instrumento cuyo veredicto no cambia sobre el corpus que ya tenía no probó nada
([[vacio-no-es-hallazgo-correr-el-control]]).

**Consecuencia abierta, y es del operador:** medido bien, el índice no tiene puente táctico. Volver
bajo el techo con margen pide ~2.700 bytes, o sea **~15 entradas de criterio** bajadas a
`HISTORIA.md` — que no se carga, así que eso es pérdida de recall real. La salida que no pierde nada
es de **formato**: los paths `slug.md` son ASCII puro y se llevan el **30% del presupuesto en bytes**
diciendo la misma frase que su gancho. Acortar los nombres de archivo (con los `[[links]]`
actualizados mecánicamente, y el control «links a archivos inexistentes: 0» ya horneado en el
medidor) libera ~4.000 bytes sin sacrificar una sola lección. Es IDXFORMATO, y toca el activo que
toda sesión carga al arrancar: lo decide el operador, no yo.
