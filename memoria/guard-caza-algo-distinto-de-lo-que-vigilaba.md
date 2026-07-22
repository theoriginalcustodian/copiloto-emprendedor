---
name: guard-caza-algo-distinto-de-lo-que-vigilaba
description: Un guard rechazó un DEFAULT por seguridad y lo que destapó fue un bug de zona horaria — leer el rechazo antes de rodearlo
metadata:
  type: project
---

**LEER cuando un guard, linter o validación te rechace algo que "obviamente está bien".**

`provision_tables.py` tiene una whitelist de valores permitidos en `DEFAULT` (anti-inyección de DDL).
Al declarar la tabla de gastos escribí `fecha date NOT NULL DEFAULT current_date` y el guard **lo
rechazó**. El reflejo era obvio: aflojar la whitelist, `current_date` no es una inyección.

**Y ahí estaba el bug.** Postgres evalúa `current_date` en la zona del servidor —**UTC**— mientras la
app usa Argentina (UTC−3). A las 21:30 de Buenos Aires ya es el día siguiente en UTC: un gasto
cargado de noche cae en el **día equivocado**, y los días 30 y 31 en el **mes equivocado**. O sea:
desaparece del resumen mensual, que es la única pantalla que justifica cargar gastos.

Dos definiciones de "hoy" divergiendo 3 horas por día es el bug que aparece sólo a veces, de noche, y
se cierra como *no reproducible*.

**El mecanismo, y por qué rinde tenerlo escrito.** El guard vigilaba **inyección de DDL** y cazó un
**bug de zona horaria**. Son cosas sin relación: no lo cazó porque fuera inteligente, lo cazó porque
me obligó a **mirar** una línea que yo daba por buena. Un guard bien puesto rinde por encima de su
propósito declarado — no por lo que detecta, sino porque **fuerza una lectura donde había un
supuesto**.

**La regla:** ante un rechazo que parece un falso positivo, **leer qué hace realmente lo rechazado
antes de aflojar el guard**. Aflojarlo cuesta 30 segundos y cierra la única oportunidad que ibas a
tener de ver el problema. Acá la salida correcta no fue relajar la whitelist ni forzar el DEFAULT:
fue **sacar el default de SQL** y poner "hoy" en un solo lugar de Python (`hoy_del_negocio()`), con la
zona declarada y su test.

**Coda:** la corrida que ejercitó de verdad ese arreglo lo hizo **por casualidad** — la sonda de
FRONTEND cayó 22:41 de Argentina, dentro de la ventana de 3 h donde las zonas discrepan. Al mediodía
habría pasado sin probar nada. Por eso el test inyecta el instante. Ver
[[instrumentos-que-confirman-en-vez-de-verificar]].

Hermanas: [[no-codificar-la-esperanza-principio-raiz]] · [[raiz-no-parche]]
