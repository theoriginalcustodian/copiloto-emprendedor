---
name: la-regla-que-te-obliga-a-mirar-el-instrumento-equivocado
description: Seis errores seguidos no venían de los bugs del script sino de la regla que ordenaba consultarlo primero y prohibía afirmar sin él. Arreglar el instrumento no arregla el procedimiento que lo impone.
metadata:
  type: feedback
---

El 2026-07-24 `scripts/no-ocio-check.sh` se equivocó **seis veces seguidas** sobre si una sesión
estaba trabajando: rotuló backend como frontend, nombró backend «por descarte», eligió el transcript
vacío tras un reinicio, contó como ocio la fase de cierre (que se hace por `Bash`, no por `Write`), y
gritó `🌀 GIRA EN VACÍO` sobre sesiones que estaban implementando. Cada vez se lo parcheó, y cada
parche destapó el siguiente.

**Ninguno de esos bugs era la causa raíz.** La causa era el prompt del cron —escrito por mí, después
de un error anterior— que ordenaba: *«INSTRUMENTO OBLIGATORIO: corré PRIMERO `no-ocio-check.sh`.
PROHIBIDO afirmar que una sesión está parada sin ese output»*. Con esa regla, cada ciclo arranca
leyendo una **inferencia**, y el log crudo —que muestra las acciones con hora y no se equivocó nunca—
queda relegado a segunda opinión, consultado sólo cuando algo chirría.

**Por qué es tan difícil de ver desde adentro:** la regla se siente como rigor. Nació *de* un error
real (declarar muerta una sesión que trabajaba) y su forma —«no afirmes sin medir»— es exactamente la
de una buena regla empírica. Pero canoniza **una fuente** en vez de un criterio, y a partir de ahí
todo lo que la fuente diga entra al reporte con el sello de «medido». El operador lo cortó en una
línea: *«es fácil de saber si alguna está trabajando con los avances de los logs, por favor,
centrate»*.

**El patrón, generalizable:** cuando un instrumento falla repetidamente, la pregunta no es *¿qué bug
tiene?* sino **¿qué regla me obliga a consultarlo antes que a la fuente directa?** Arreglar el
instrumento sin tocar el procedimiento deja el error en su lugar — con una versión más pulida de la
misma inferencia. Y un instrumento que infiere (identidad por paths, productividad por nombre de
herramienta) **no falla ruidoso cuando se equivoca: entrega una respuesta plausible**, que es la
definición de [[instrumentos-que-confirman-en-vez-de-verificar]].

**Fix aplicado:** el instrumento obligatorio pasó a ser `scripts/ultimas-acciones.sh` — imprime las
últimas acciones de cada sesión con hora, leídas del log, y **no infiere nada**; el juicio queda en
quien lee. `no-ocio-check.sh` deja de ser fuente de juicio. Los dos crones de 3 min se fusionaron en
uno: con el log a la vista, «una sesión parada» y «espera mutua» se ven en la misma lectura.

Hermana de [[el-nombre-es-una-hipotesis-sobre-el-contenido]] y de
[[vacio-no-es-hallazgo-correr-el-control]]: las tres son la misma falla en distinto disfraz —
tratar una **derivación** como si fuera la **observación**.
