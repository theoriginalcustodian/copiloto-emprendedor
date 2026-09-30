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
