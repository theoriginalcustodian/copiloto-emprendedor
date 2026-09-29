---
name: el-veredicto-no-dice-cuantas-veces-lo-miraron
description: Comparar veredictos entre medidores con distinto número de pasadas mide los métodos, no el objeto; y un contrato de medición sin camino de acceso fabrica el error.
metadata:
  type: feedback
---

# 🔁👁️ El veredicto no dice cuántas veces lo miraron

Una matriz de 54 filas: una sesión reportó **22 de 22 conformes**, la otra **2 de 7**. Misma
superficie, mismo método declarado. La lectura fácil —y la que escribí— fue: *la asimetría mide los
dos métodos además de la app*. Cierta en la forma y **equivocada en el fondo**.

Auditoría fue a leer el método en vez de cruzar registros, y **las nueve filas que habían "migrado a
conforme sin fix" tenían causa documentada**: cuatro midieron el camino equivocado, una fue timeout
de 30 s contra 37 s de latencia real, una capturó un modal a mitad de cierre, una midió el estado
vacío, dos se implementaron de verdad.

> **Lo que separaba 22/22 de 2/7 no era rigor: era cuántas pasadas tuvo cada fila.** Una tuvo dos; la
> otra, una.

## La inversión que importa

**La segunda pasada siempre encuentra algo.** Cuando auditoría hizo la segunda pasada de las 7 filas
ya publicadas, cayeron 2. Entonces:

**Las filas que cambiaron de veredicto no son la clase de riesgo — son las más miradas de todas.** La
clase de riesgo son **las que tuvieron una sola pasada**, que es justamente donde no hay nada
llamativo que mirar.

El dato que lo sostiene: **el barrido erró el método en ≥7 de 54 filas, y sólo se supo porque alguien
volvió a mirar. Nadie volvió sobre las otras 47.** El 7 no es el total de errores: es el total de
errores *en la parte que se revisó*.

## La causa raíz es del contrato, no de quien mide

Cuatro de esas filas midieron el pill «+Nuevo» (formulario en blanco) en vez del flujo
dictado→composer, que era el que el prototipo dibujaba. **Eso no es un error de ejecución: el
contrato decía qué pantalla medir y no por qué camino llegar.** Si una pantalla es alcanzable por dos
caminos que producen UI distinta, el que mide elige uno y acierta por suerte. No hay forma de
ejecutarlo bien.

Lo mismo con el estado de partida: `preg` midió el vacío porque el contrato no decía «con una
pregunta ya hecha».

**Regla que queda:** *todo contrato de medición visual nombra el camino de acceso y el estado de
partida, no sólo la pantalla.* «`card` vía dictado→composer», nunca «`card`». Quien reciba uno sin
camino, lo rebota.

## Las preguntas que lo cazan

1. **¿Cuántas pasadas tuvo cada fila?** Si el número difiere entre medidores, el veredicto comparado
   no es comparable — y el que más "falla" puede ser simplemente el más revisado.
2. **¿Hay más de un camino a esta pantalla?** Si sí, el contrato tiene que elegir uno.
3. **¿El N de errores es "los que hay" o "los que había donde miré"?** Casi siempre es el segundo.

## Y el modo de falla que se coló en mi propia advertencia

Yo propuse cazar esto cruzando los ids contra el registro de merges: un barrido **por presencia**, que
no distingue *lo midieron* de *lo nombraron*. Es [[el-nombre-es-una-hipotesis-sobre-el-contenido]]
otra vez, y el mismo defecto que me hizo dar `BL-B3` por abierto leyendo el título de su PR. La
auditoría lo detectó antes de aplicarlo.

Ver [[el-registro-vivia-en-tres-idiomas-y-el-lector-hablaba-uno]] ·
[[instrumento-que-no-mira-nunca-falla]] · [[el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio]]

## Y cómo se hace barata la segunda pasada: donde hay literales, es grep

Si la segunda pasada costara como la primera, nadie la haría. **Cuando el contrato se escribió en
literales —textos exactos, no disposición— la segunda pasada es `grep`, no captura.**

Medido: `ingresar` e `ingresar-error` tenían seis cambios declarados, cada uno con su texto exacto.
Los seis se verificaron por grep **en minutos, sin abrir un navegador**, con control positivo (un
literal que tiene que estar). Los 6 aplicados. Y de yapa: el único literal que había que **sacar**
aparecía sólo dentro de un test que verifica que no esté — o sea, regresión ya cubierta, hallada sin
buscarla.

**Por qué es mejor instrumento, no sólo más barato:** el grep **no tiene timing, ni transición, ni
viewport**. Es inmune justamente a los modos de falla que hacen dudar de las capturas —la foto a
mitad de animación, el timeout corto, la pantalla equivocada. Cuesta dos órdenes de magnitud menos.

**La captura queda para lo que el grep no puede ver:** disposición, jerarquía visual, si algo entra en
pantalla. Elegir foto donde alcanzaba un grep es pagar de más **y** medir peor.

Origen: la sesión de auditoría, que además bajó su propia tanda de 13 ids a 10 con este método — y los
sacó **por verificados, no por baratos**, que es la distinción que hace válida la reducción.
