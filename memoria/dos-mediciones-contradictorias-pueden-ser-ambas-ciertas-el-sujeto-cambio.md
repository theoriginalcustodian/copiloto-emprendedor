---
name: dos-mediciones-contradictorias-pueden-ser-ambas-ciertas-el-sujeto-cambio
description: Mi "6 keys" y el "5 keys" de backend se contradecían y las dos eran ciertas: su medición fue a las ~18:00 y su propio fix a las 18:33. Una medición sin HORA no se puede contrastar con otra.
metadata:
  type: feedback
---

Dos mediciones del **mismo sujeto** que se contradicen no prueban que una esté mal. Si el sujeto
puede **cambiar**, pueden ser las dos ciertas — y entonces lo que falta no es una tercera medición,
es **la hora de cada una**.

**Caso raíz (2026-11-03, `SM-Z1`).** Yo venía citando que `/catalog` devuelve **6 keys** incluyendo
`googledrive`. Backend midió **prod con el JSON crudo** y devolvió **5**, sin Drive. Acepté la
refutación, escribí en la ficha «mi 6 salía del código, la de prod gana», corregí el estado
compartido y redirigí el contrato. Horas después backend reportó **6 keys en prod con login real**.

No había refutación. Su medición es de **~18:00** y su propio fix —`63b50b8a` (#1579), que devuelve
Drive a la policy de conectables— es de **18:33**. Las dos mediciones eran correctas sobre estados
distintos del mismo sistema.

**Por qué el error no fue la cifra.** Mi `6` era una lectura del **código** (`catalog.py:94`,
`_PRESENTATION`): describía el estado **deseado**, y resultó ser el estado que el sistema iba a tener
media hora después. Lo que hice mal fue tratar «5 ahora» y «6 en el código» como **la misma
pregunta**, y al perder la comparación, concluir que mi instrumento era el equivocado. El sujeto no
era el mismo: uno medía **lo desplegado a una hora**, el otro **lo que el código publica**.

**Cómo se ve si pasa de nuevo.** La señal es una refutación que llega **sin hora** y que yo acepto
porque el instrumento del otro parece mejor (prod > código). «Prod gana» es cierto sólo para la
pregunta «¿qué hay desplegado **ahora**?». Para «¿qué va a publicar el backend?», el código gana.

**La regla:**

1. **Toda medición de un sistema vivo se cita con HORA**, no sólo con sha. El sha fecha el código;
   la hora fecha el **despliegue**, que es lo que `/catalog` contesta.
2. Antes de aceptar una refutación, preguntá **¿pudo cambiar el sujeto entre las dos mediciones?**
   Si la respuesta es sí, no hay contradicción que resolver: hay dos estados.
3. **No reescribas el estado compartido por una refutación sin fechar.** Acá lo hice dos veces sobre
   el mismo bullet de `SESIONES-IDS.md`, y la segunda corrección fue para deshacer la primera.

Es el eje temporal de [[una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta]]: ahí faltaba la
**unidad**, acá falta el **momento**. Y es el espejo de
[[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]: el nombre era el mismo (`/catalog`), el
referente cambió — no por ambigüedad, **por el paso del tiempo**.