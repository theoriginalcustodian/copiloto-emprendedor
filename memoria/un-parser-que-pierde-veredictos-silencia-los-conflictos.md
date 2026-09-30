---
name: un-parser-que-pierde-veredictos-silencia-los-conflictos
description: El contador no leía 15 de 199 filas, así que dos veredictos opuestos sobre la misma pantalla nunca podían verse juntos. El falso positivo que me costó una investigación de imágenes estaba refutado por una medición propia de seis días antes
metadata:
  type: feedback
---

**El caso (2026-09-29).** Pasé una investigación —leer dos PNG, el componente y el prototipo— para
demostrar que un `DESVÍO` sobre la pantalla `bi` era un falso positivo de captura. Después medí el
corpus con el contador arreglado y apareció esto: **la matriz del 22/09 del mismo autor ya declaraba
`bi` = COHERENTE**, con método más fuerte (esperó los datos con `page.waitForFunction` en vez de un
timeout) y contra el mismo prototipo. Y `bi-refresh` decía «estructura idéntica al proto (Saldo en
caja, …)» — justo el bloque que el `DESVÍO` del 28/09 declaraba ausente.

**Dos veredictos opuestos sobre la misma pantalla, contra la misma referencia, a seis días de
distancia, y el instrumento no podía ponerlos uno al lado del otro** porque no leía uno de los dos.

## El mecanismo, y por qué callaba en vez de gritar

Dos defectos que **solos dan síntoma y juntos lo enmascaran**:

1. **`limpiar()` enumeraba la decoración conocida** (backticks, asteriscos) en vez de definir el
   predicado general, y el `re.match` está anclado al inicio: `🔴 **DESVÍO**` → `🔴 DESVÍO` → **sin
   match**. Su propio docstring ya describía la clase — «cada patrón fallaba por UN carácter y perdía
   la medición sin dar hueco» — y el fix de entonces **agregó dos caracteres a la lista y dejó la
   clase abierta**. Un fix enumerativo sobre una clase no cierra la clase.
2. **`reversed(celdas)` + `break`**: se tomaba la primera celda que matchea recorriendo **de derecha a
   izquierda**, así que cualquier columna a la derecha del veredicto lo tapa (en
   `| Pantalla | Veredicto | Diferencias | Resolución | Capturas |` ganaba `Resolución`).

Sin (2), el emoji de (1) habría producido `SIN_VEREDICTO_PARSEABLE` — un **hueco visible**. La columna
de la derecha **rellena el hueco con un token falso** y lo apaga. Dos bugs que por separado se
delatan; combinados, silencio limpio.

## La lección que importa, que no es el bug

Un parser de veredictos parece un instrumento de **cobertura** («¿cuántos ids están medidos?»), y así
se lo audita: la cifra ni se movió (50 de 54 — verificado: los ids perdidos no intersecan a los
faltantes, 0 de 4). **Pero su función más valiosa es de CONTRASTE**: es lo único que puede exhibir dos
veredictos incompatibles sobre el mismo sujeto. Y el contraste es donde vive el **falso COHERENTE** —
el veredicto que desactiva trabajo y que nadie audita
([[nadie-audita-un-coherente-y-es-el-veredicto-que-desactiva-trabajo]]).

Así que un veredicto perdido **no cuesta cobertura: cuesta la capacidad de detectar el error de
juicio**. Con los dos veredictos visibles, mi falso positivo se cazaba con un cruce de dos líneas; sin
ellos costó una investigación, y **sólo porque fui a mirar**. El control que hay que construir no es
«cuántos ids tienen veredicto» sino **«qué ids tienen veredictos incompatibles»**.

## Y el hallazgo debajo del hallazgo

Al cruzarlos aparecieron dos ids (`soporte`, `comousar`) con COHERENTE de un lado y DESVÍO del otro
**sobre el mismo hecho**. Expliqué los dos igual —«son dos preguntas distintas con el mismo
vocabulario»— y **el autor me corrigió mirando su propia celda fila por fila: era un caso de cada
uno.**

- `soporte` **sí** eran dos preguntas: su celda decía «el proto sigue mostrando "Soporte de Odobi"… es
  mockup desactualizado respecto al fix (**drift esperado, no bug**)». Su COHERENTE contestaba *¿se
  desplegó el fix?*, no *¿coincide con el proto?*.
- `comousar` **no**: las dos preguntaban lo mismo, y su COHERENTE miró **sólo texto** («mismos 5 ítems,
  mismos títulos») mientras el DESVÍO miraba layout y una sección entera que el proto no tiene. **Misma
  pregunta, profundidades distintas: gana el más profundo y el otro queda superado.**

**Y acá está la trampa, que es la parte que vale:** de las tres resoluciones posibles de un empate
—(1) dos preguntas distintas · (2) misma pregunta, uno más superficial · (3) uno está mal— **la (1) es
la única que no deja a nadie equivocado**, y por eso es la que uno elige por defecto. Aplicada a un caso
que es (2), **deja vivo un COHERENTE superado: fabrica el mismo falso verde que el contraste venía a
cazar.** El discriminante es barato: **leé qué dice el MOTIVO de cada lado que miró, no qué veredicto
puso.**

⚠️ **Y esto ya estaba escrito:** [[una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal]] dice, del
mismo día, «pueden estar preguntando cosas distintas, y entonces la asimetría es información. Antes de
emparejar, escribí qué pregunta hace cada lado». Lo re-derivé desde cero **porque esa entrada está
huérfana del índice** — segunda vez en el mismo turno (la otra:
[[si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera]]). Dos lecciones ya escritas, re-pagadas
en un solo turno, por 13 entradas sin línea en `MEMORY.md`. El costo de
[[el-indice-truncado-fabrica-duplicados]] dejó de ser hipotético: **está medido, y el precio es
re-derivar con evidencia lo que otro ya cerró.** Por eso el contraste `id → veredictos` que pido acá
tiene un gemelo en el plano de la memoria: **un control que liste las entradas huérfanas debe correr en
un gate de PR**, porque hoy existe, funciona, y nadie lo mira.

Hermanas: [[el-nombre-es-una-hipotesis-sobre-el-contenido]] ·
[[dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una]] ·
[[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]] ·
[[dos-causas-suficientes-el-test-no-atribuye]] ·
[[un-control-calibrado-a-tu-propio-valor-no-ve-al-productor-ajeno]] (enumerar miembros en vez de
definir la clase).
