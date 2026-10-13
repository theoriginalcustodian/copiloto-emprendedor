---
name: un-umbral-calibrado-al-corpus-del-dia-envejece-con-el
description: Un piso calibrado a los únicos dos documentos que existían se vuelve falso rojo sobre datos buenos cuando el corpus crece
metadata:
  type: feedback
---

El contador exigía `mediciones_declaradas >= 5` **por documento**. El número venía de los dos
documentos grandes, los únicos que existían cuando lo escribí. Al descubrir el corpus real aparecieron
documentos legítimos de **2 y 3** mediciones: el umbral pasó a ser un **falso rojo sobre datos buenos**.

Auditoría lo nombró como hermana exacta de su propio error del mismo día: ellos calibraron un grep al
ancho que *ellos* producían (`1440`) y midieron cero cuando el otro capturaba a `1280`. Misma familia —
en un caso el sesgo entra por el **valor**, en el otro por el **piso**.

**Why:** un guard que grita en el caso normal se desarma solo: el siguiente que lo vea rojo sube el
número sin mirar, y ahí se pierde también el caso real. El falso rojo no es un costo menor que el falso
verde — es el que **enseña a saltear**.

**How to apply:** al escribir un umbral, preguntá **de dónde salió el número**. Si salió de los datos
que tenés hoy, va a envejecer con ellos. Dos salidas: (1) mover el piso al **agregado** (el corpus
entero), donde crecer no lo invalida; (2) quedarse con la condición que **no depende de la escala** —
«declara mediciones y no atribuye NINGUNA» es atribución rota con 2 o con 200. Y si el umbral se queda,
imprimí **el techo real al lado**, para que se vea cuánto aire hay en vez de confiar en que el número
sigue vigente. Ídem [[medir-si-un-gate-dispara-antes-de-embarcarlo]] y
[[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]].

## Refuerzo 2026-10-13 — la variante peor: la etiqueta que NOMBRA UN SPRINT

Un umbral envejece con el corpus. Un **rótulo que nombra un sprint relativo** envejece **solo**, sin que
cambie ni el corpus ni el código. `contar-veredictos.py` imprimía:

```
mobile  13 de 54   (sprint siguiente, con device/EAS)
```

«Sprint siguiente» fue cierto el 2026-09-22. Ese sprint **cerró el 2026-10-08** (`DEC-14`), así que la
misma línea empezó a decir «el que viene» sobre el sprint **en curso**. La **cifra nunca se movió** —
`13 de 54` era correcto antes y después— y por eso ningún control la atrapa: no hay regresión numérica que
medir. Lo que mutó es la frase que el lector **copia**.

**El costo medido:** el operador preguntó «¿cuánto avanzamos en el sprint mobile?» y recibió la cifra de
**web**, porque el paréntesis decía que mobile todavía no empezaba. Dos fallas encadenadas: ésta y
[[una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta]].

**La regla:** una etiqueta de instrumento no nombra un sprint, ni un «ahora», «próximo» o «ya». Nombra el
**disparador** (`pendiente de device/EAS`) o la **decisión con su fecha** (`acotada por DEC-14 del
2026-10-08`). Las dos sobreviven al paso del tiempo porque no dependen de cuándo se las lea.

**Y se puede guardar:** `scripts/tests/test-etiqueta-no-nombra-un-sprint.sh` (6/6) mide la **SALIDA** del
instrumento —no su fuente, cuyos propios comentarios contienen las frases prohibidas— con control de
ceguera (la etiqueta anclada SÍ se imprime), control de árbol-fixture y **mutante** que reinyecta la frase.
Lo levanta solo `scripts/ci/tests-coordinacion.sh` por glob.
---

### Refuerzo 2026-10-13 — lo que envejece dentro de una fila CERRADA no es la deuda: es la PREMISA

Tercera variante del mismo mecanismo, y la peor, porque no caduca un umbral ni un rótulo: caduca **la
afirmación empírica sobre la que se cerró una decisión**.

Caso medido hoy — tres premisas vencidas en cadena sobre el mismo tema (el versionado legal):

1. «**ninguna** app lee el campo» — verdadera a las **09:42** del 2026-10-06 y **falsa a las 16:15** del
   mismo día (dos PR la implementaron). Esa línea **sostenía** el argumento con el que se había
   descartado una opción de diseño, y nadie la revisó **porque la fila estaba tachada y marcada en
   verde**.
2. «el versionado **opera** en web» — escrita como corrección de la anterior, también falsa: lo que
   aterrizó fue un **cartel**, no un gate. «Opera» sin definir el verbo absolvió a un display.
3. «mobile no lo lee» — **mía**, 20 minutos de vida, falsa por el predicado de grep
   ([[la-costura-leia-un-campo-que-nadie-escribe]]).

**Por qué una fila cerrada es el peor lugar para una premisa:** una **deuda** invisible se paga tarde,
pero una **premisa** invisible deja en pie una **decisión** que ya no se sostiene — y el tablero no
distingue «no había deuda» de «la deuda se fue con la fila». Lo formuló auditoría sobre mi cierre; lo
confirmé cayéndome en la tercera, el mismo día que lo leí.

**How to apply:** al cerrar una fila **por diseño** (no por entrega), la pregunta no es sólo *«¿qué
deuda sobrevive al cierre?»* sino *«¿cuál es la afirmación empírica que sostiene este cierre, y con qué
comando se vuelve a medir?»*. Las afirmaciones **negativas** («cero hits», «no existe», «ninguna app»)
envejecen más rápido **y son las únicas verificables por script**: se escriben con su comando al lado,
no en prosa. Y los verbos de estado («operar», «cubrir», «soportar») se definen en la misma línea —
«operar = puede rechazar a alguien» habría cazado la premisa 2 sin ayuda de nadie.
