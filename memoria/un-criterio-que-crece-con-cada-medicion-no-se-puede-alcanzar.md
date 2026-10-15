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


---

## Refuerzo 2026-10-15 — la otra forma de ser inalcanzable: el criterio que el instrumento NUNCA PUDO EMITIR

Arriba el criterio es inalcanzable porque **crece**. Hay una segunda forma, y apareció **dos veces en
el mismo día**, en dos instrumentos sin relación: el criterio **no se mueve**, pero la salida que
declara legítima **no tiene rama en el código que la produzca**.

| # | el criterio dice | el instrumento | por qué era inalcanzable |
|---|---|---|---|
| 1 | `differ.py:21-26`: superar el tope de 200 objetos es esperable, *«para eso existe `--force`»* | `destrabar-grafo-force.ps1` abortaba si `FALTANTES != 0` | graphify emite 11 auto-aristas (`contains: X → X`) que Graphity **no materializa nunca**, así que `FALTANTES` jamás podía ser 0. El camino de destrabe estaba cerrado **por construcción** |
| 2 | el padrón del mapeo: 9 de las 15 filas de device cierran con «resuelta en el código, **o declarada enmienda fundada con su motivo escrito**» | `medir-mapeo-implementacion.py:241` sólo puede emitir `DESVIO`/`COHERENTE`/`NO-MEDIBLE` para ese grupo | `ENMIENDA-FUNDADA` **está** en `CUMPLE_DOD` (`:91`) y el grupo device no tiene ninguna rama que la emita. El 44/54 del sprint estaba calculado hacia abajo |

**La firma, y es la parte reusable:** el criterio vive **en prosa** (un docstring, una columna de DoD)
y el instrumento implementa **un subconjunto más estricto sin declararlo**. Nadie miente: el que
escribió la prosa describió el criterio completo, y el que escribió el código cubrió los casos que
tenía a mano. El hueco vive **en el par**, igual que en
[[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]].

**Por qué no da síntoma.** El instrumento no falla: **emite un rechazo**, y un rechazo se lee como
rigor. El caso 1 vivió detrás del único criterio que además era **ilegible** (uuid5 opacos), así que
nadie podía ver que el número nunca bajaría. El caso 2 llevaba el sprint entero diciendo «faltan 10
filas de device» cuando dos de ellas **ya cumplían su DoD textual** (`ingresos`: «nombra la
divergencia», y las 3 estaban nombradas; `reveal`: «un consumidor real y se ve», y
`EntradaSesion.tsx:6` lo importa y `:32` lo renderiza).

**El chequeo, en una línea:** *para cada salida que el criterio declara aceptable, ¿existe una rama
del código que la produzca?* Se contesta grepeando el **enum de salidas** del instrumento contra el
**texto del criterio** — no leyendo el instrumento, que se lee coherente consigo mismo.

**Y la trampa de arreglarlo:** lo correcto es codificar el criterio que el padrón **ya declara**, no
aflojar el umbral. Para el caso 2 eso significa que un veredicto `NO_REPRODUCIBLE_SIN_EFECTO` **con
motivo escrito** en una fila cuyo DoD admite enmienda cuenta como `ENMIENDA-FUNDADA`, y que un
`NO_MEDIBLE` por límite del instrumento (una captura de pantalla no ve 60 fps) **no** cuenta: «no lo
medí» no es «decidimos otra cosa». Sin esa distinción, arreglar un criterio insatisfacible se vuelve
regalarlo — y el medidor queda complaciente, que es el fallo de
[[el-instrumento-tambien-CONDENA-no-solo-absuelve]] por el otro lado.

Relacionadas: [[el-guard-falla-abierto-en-su-caso-de-activacion]] (ahí el guard deja pasar en su
caso de activación; acá **bloquea** en el suyo) · [[medir-si-un-gate-dispara-antes-de-embarcarlo]].
