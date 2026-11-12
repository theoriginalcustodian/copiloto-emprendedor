# Verificar una PROPIEDAD de la capa no verifica que la capa SOBRE — y el verde se repite tantas veces como propiedades tenga

**2026-11-03, `SM-N38`.** El operador pidió una sola cosa, tres veces, con las mismas palabras:
*«el campo debe ser igual al del chat… es simplemente copiar el formato»*. Tres rondas salieron
**verdes** y las tres lo dejaron igual:

| Ronda | Qué midió | Por qué pasó con el defecto puesto |
|---|---|---|
| 1 | píxel **de dentro** del campo (`Composer.tsx:239`) | es la capa que él pidió **conservar**: mide la vecina de la pregunta |
| 2 | píxel **de afuera** en 3 puntos | mide el **fill**; el defecto era el **canto** |
| 3 | que el fill fuera el plano del tema (`panel-fondo-plano`) | el plano **es** la capa de más |

Ninguna midió lo que él pidió. Las tres preguntaron **«¿el envoltorio tiene cierto color?»**;
su orden era **«¿el envoltorio existe?»**. Un control de propiedad pasa con la capa puesta, y hay
tantas propiedades como rondas: color, fill, canto, radio, borde. **El verde se puede repetir
indefinidamente sin acercarse** — cada ronda elige una propiedad nueva y acierta en ella.

## Lo que lo hizo invisible

El lienzo de abajo es un **degradé** (`PanelDeslizable.tsx:470`: arena abajo, crema arriba) y
encima había un rectángulo **plano y acotado** con `borderTopRadius: 40` + `borderTopWidth: 1`.
Un plano sobre un degradé **muestra su borde superior aunque el fill coincida en el punto medido**.
Por eso `26,21,18 == 26,21,18` era una medición **correcta** que acreditaba lo que no se preguntó.
El operador lo describió exacto —*«solo están las esquinas redondeadas pero el fondo sigue ahí»*—:
estaba nombrando el **canto y el radio**, no el color, mientras nosotros defendíamos el color.

## El error de dirección, que fue mío y no del que medía

La sesión con el device ofreció **dos** opciones: (a) pintar un fondo plano detrás de la tira,
(b) dejar el lienzo. Elegí **(a) citando las palabras del operador** — y (a) es la que **agrega**
una capa. Mandé una **opción** cuando lo que correspondía era mandar a **medir el patrón**.
Elegir entre dos opciones ajenas se siente como decidir; es adivinar con autoridad prestada.

## El control que sí atribuye

**Comparar los ÁRBOLES, no los píxeles.** Montar el componente de referencia y el sospechoso y
diffear nodo por nodo: mismas capas, mismos estilos resueltos. **El criterio es la identidad
estructural**, no una diferencia de color bajo un umbral. Si al de referencia le falta una capa que
el otro tiene, esa capa **sobra, sea del color que sea**.

## El chequeo, antes de cerrar cualquier «hacelo igual a X»

1. ¿Mi control mide una **propiedad** (color, tamaño, posición) o la **existencia** de la cosa?
2. ¿Ya hubo un verde anterior sobre **otra** propiedad del mismo objeto? → es la señal: estoy
   recorriendo propiedades, no respondiendo la pregunta.
3. «Igual a X» se verifica **contra X**, copiando su estructura — nunca contra un umbral.

**Caso hermano:** [[el-control-que-mide-la-propiedad-destapa-el-defecto-ajeno-el-que-mide-mi-accion-no]]
(ahí la propiedad acertó y acusó a otro; acá la propiedad acertó y **absolvió al propio**).
Y el primer eslabón: [[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]].

## Refuerzo 2026-11-12 — tres veces en un día, y la forma siempre fue la misma

El eje no es «verifiqué poco»: es que **verifiqué una PROPIEDAD del artefacto en vez de la
PREGUNTA**, y la propiedad salió verde. Tres casos del mismo día, en tres dominios:

1. **`eas.json` por perfil.** Pregunta: *¿el APK de `preview` lleva `EXPO_PUBLIC_API_BASE`?*
   Verifiqué: *¿existe la clave en el archivo?* → sí, en `:26-27`. Estaba en **`release-medicion`**,
   no en `preview`. Con eso declaré «ya está en main» una rama cuyo aporte era real, **después** de
   haber declarado lo contrario. Dos veredictos opuestos, los dos mal, por medir el archivo y no el
   perfil. El dato que lo cerró fue la cronología: `release-medicion` entró el 02-11 y el commit es
   del 04-11, o sea POSTERIOR — no un resto que main ya cubrió.
2. **Cobertura de un test.** Pregunta: *¿está ejercitado el aislamiento de `actividad_al_hilo`?*
   Verifiqué: *¿qué hay en `test_actividad_al_hilo.py`?* → 5 tests, ninguno adversarial. El test
   vivía en `test_adversarial_multitenant.py`. **El archivo que lleva el nombre del MÓDULO no es el
   que lleva el nombre de la PREGUNTA**, y el pedido salió pidiendo más de lo que faltaba.
3. **Un `.mcp.json` con un token.** Pregunta: *¿el archivo con el token está vivo en `main`?*
   Verifiqué: `grep 'odobi-ui/.mcp.json'` sobre el árbol → 1. Era **`.mcp.json.example`**, que el
   prefijo matchea y que no tiene `Bearer`. Un grep de ruta sin anclar el final convierte un
   `.example` en alarma de seguridad.

**El chequeo, que cuesta una línea:** antes de aceptar un verde, escribí la pregunta y el sujeto
sobre el que medís, y comprobá que sean el MISMO. «¿existe la clave?» ≠ «¿la tiene ese perfil?» ·
«¿qué hay en este archivo?» ≠ «¿está cubierta esta pregunta?» · «¿matchea la ruta?» ≠ «¿es ese
archivo?». Los tres verdes eran ciertos; ninguno respondía lo que preguntaba.

**Y el orden importa:** en el caso 1 escribí el `pedido_` y medí **en el mismo script, después**.
Escribir primero y medir después no es un detalle de prolijidad — produce un pedido que manda a
hacer trabajo ya hecho. Ver [[el-contrato-que-manda-a-hacer-algo-ya-hecho]] y
[[prometer-no-es-ejecutar-el-gate-media-la-palabra]].
