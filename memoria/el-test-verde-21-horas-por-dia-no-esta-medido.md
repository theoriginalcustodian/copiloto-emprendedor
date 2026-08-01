---
name: el-test-verde-21-horas-por-dia-no-esta-medido
description: 7 tests se pusieron rojos sólo entre las 21:00 y las 00:00 argentinas del último día del mes — el fixture escribía con el reloj de Postgres (UTC) y la query leía con el del negocio (UTC−3). Las otras 21 horas del día pasaban sin medir nada.
metadata:
  type: project
---

# 🕘🟢 Un test que pasa 21 horas por día no está verde: está sin medir

**El 2026-08-01T00:19Z el CI puso 7 tests de `test_inteligencia_queries.py` en rojo, todos leyendo
`0.00` o listas vacías.** En Argentina eran las 21:19 del 31 de julio. El PR no tocaba nada de
inteligencia: el fallo no lo produjo el diff, lo produjo **la hora**.

## El mecanismo

- El **fixture** insertaba con `CURRENT_DATE`, que Postgres evalúa en la zona del servidor —**UTC**
  en el contenedor del CI—, o sea **1 de agosto**.
- La **query bajo prueba** recorta el mes con `hoy_del_negocio()` (UTC−3), o sea **julio**.

Las filas caían en el mes entrante y la consulta seguía mirando el que terminaba. Todo `0.00`.

## Lo que lo vuelve interesante

**El producto ya había cerrado esta trampa.** La columna `fecha` de `copiloto_gastos` **no tiene
`DEFAULT` en SQL** a propósito, y el docstring de `hoy_del_negocio` explica por qué, palabra por
palabra:

> *"un `DEFAULT current_date` lo evaluaría Postgres en la zona del servidor (UTC) y daría un día
> distinto al de esta función en las horas de la noche argentina. Dos definiciones de 'hoy' que
> divergen 3 horas por día es exactamente el tipo de bug que aparece sólo a veces, de noche, y se
> cierra como 'no reproducible'."*

Y más abajo, en el mismo archivo:

> *"Un test cuyo poder de detección depende de la hora a la que corre el CI es verde por casualidad:
> pasa 21 horas por día diga lo que diga el código."*

Estaba escrito, con la causa, la consecuencia y el nombre. **El fixture lo reintrodujo por la puerta
de atrás.** Una defensa puesta en el camino de producción no viaja al camino con que el test escribe
sus datos: el store obliga a `hoy_del_negocio()`, pero un `INSERT` crudo en un helper de test elude
la obligación entera sin romper nada visible.

## La regla

**Los datos de un test se escriben con el MISMO reloj —y por el mismo camino— que usa el código que
se está probando.** Si la lectura define "hoy" en la zona del negocio, la escritura no puede
definirlo en la del servidor. Fijarse en el `INSERT` del fixture, no sólo en el `assert`.

Y el corolario que cuesta más ver: **"pasa siempre" y "pasó las veces que corrió" no son lo mismo.**
Ante un test que depende del reloj, del calendario o del entorno, la pregunta no es *¿está verde?*
sino **¿en qué fracción del espacio de condiciones se ejercitó?** Un verde del mediodía sobre este
código no probaba nada: probaba el mediodía.

## Lo táctico que valió: si te enterás DENTRO de la ventana, corré todo YA

La franja de divergencia dura 3 horas y vuelve mañana. Al detectarlo faltaba una hora de ventana, así
que se corrió la **suite completa** en ese momento — el único rato del día en que estos tests tienen
poder de detección real. Ante un fallo dependiente del tiempo, medir *ahora* vale mucho más que
diseñar el fix primero: la oportunidad caduca, el fix no.

## Hermanas

- [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]] — la misma familia: el test
  escribe/lee por un camino que producción no usa, así que las garantías de producción no están.
  Allá era `psycopg2` crudo salteando la envoltura; acá es `CURRENT_DATE` salteando el reloj.
- [[instrumentos-que-confirman-en-vez-de-verificar]] — un instrumento que sólo mira una franja del
  espacio confirma esa franja.
- [[guard-caza-algo-distinto-de-lo-que-vigilaba]] — el rojo llegó por un PR de autosanación que no
  tocaba nada de esto.
- [[la-deuda-vencida-no-siempre-se-paga-en-un-paso]] — quedan 5 archivos de test más con
  `CURRENT_DATE`; que hoy no se pongan rojos no prueba que estén bien, prueba que no comparan contra
  una ventana de mes.
