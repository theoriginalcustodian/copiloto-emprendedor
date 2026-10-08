# 🎯📈 Un criterio que CRECE con cada medición no se puede alcanzar

**Fecha:** 2026-10-08 · **Lo cortó el operador**, no el gate: *«hay que poner un DoD a todo esto
sino no acabamos nunca»*. El sprint había «cerrado» esa mañana y seguía sin terminar.

## Qué pasaba

El cierre de la beta se medía con **dos instrumentos**, y daban números distintos sobre el **mismo**
sprint:

| instrumento | contaba |
|---|---|
| casillas de DoD del backlog | **53 ítems abiertos** de 66 |
| tabla de 5 puntos del alcance | **1/5**, con el alcance en **7/7** |

Y cada ronda de auditoría **anotaba filas `H-*`** en el bloque de hallazgos, que se leían como
precondición del cierre: **27 filas** acumuladas.

**Las tres cosas eran correctas por separado.** Juntas producían un criterio que **se alejaba cada
vez que alguien medía**: cerrar un ítem destapaba un hallazgo, y el hallazgo parecía bloquear.

## La lección

**Si medir produce criterio nuevo, el criterio no es alcanzable — y no se ve desde adentro, porque
cada medición individual es legítima.** El síntoma no es «falta trabajo»: es que **nadie puede
decir qué falta en una frase**. Si el operador pregunta «¿cuánto falta?» y la respuesta honesta
empieza con «depende de cómo lo cuentes», ya pasó.

Dos preguntas que lo detectan antes:

- *¿puedo nombrar lo que falta como una lista **fija**?* Si la respuesta depende de la próxima
  auditoría, no hay DoD — hay una actividad.
- *¿un hallazgo nuevo cambia el conteo de lo que falta?* Si sí, **el instrumento de medición y el
  criterio son el mismo objeto**, y eso se realimenta.

## El arreglo: una cláusula de corte, no más trabajo

`DEC-18` fijó cuatro cosas, y la que corta el bucle es la tercera:

1. **Un solo lugar donde se mide**, con evidencia citada por SHA.
2. **Lo que es documentación no es criterio.** Las casillas quedaron como registro del trabajo, no
   como veredicto — medido: dos ítems estaban **entregados** con su casilla sin tildar, así que la
   casilla medía **el ritual de tildar**.
3. **⛔ Un hallazgo nuevo NO reabre un punto cerrado**, salvo que **invalide su evidencia**, y quien
   lo anota **debe nombrar el punto y decir qué medición queda falsa**. Lo que no nombra un punto es
   **entrada del cierre siguiente**.
4. **Terminado = N/N en esa tabla.** Nada más cuenta.

Leído así, de 27 hallazgos y 53 casillas quedaron **2 acciones y 1 disparador**. No se cerró nada
nuevo: se dejó de contar como pendiente lo que no lo era.

## Lo que esto NO es

No es permiso para ignorar hallazgos. La cláusula **exige más** del que anota, no menos: antes
bastaba anotar y el cierre se frenaba solo; ahora hay que **demostrar qué evidencia queda falsa**.
Y lo que no bloquea **no se borra**: se hereda al cierre siguiente, por escrito.

## Relación con el resto

Es el nivel de sistema de [[el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio]]: ahí un DoD
individual medía lo que no debía; acá **el conjunto de criterios no tenía frontera**. Y explica por
qué [[nunca-cerrar-el-turno-con-un-reporte]] se viola sin querer: cuando el criterio crece, **un
reporte es lo único que se puede entregar con honestidad** — la salida no es escribir mejores
reportes, es **ponerle frontera al criterio**. Caso espejo:
[[definicion-delgada-de-ux-se-llena-con-el-port-del-canonico]] — ahí falta definición y se llena
con lo ajeno; acá sobra criterio y nunca cierra.
