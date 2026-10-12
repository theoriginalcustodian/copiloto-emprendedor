---
name: la-condicion-que-el-instrumento-exige-para-ver-cambia-lo-medido
description: Cuando hay que modificar el sistema para que el instrumento pueda observar, esa modificación es una variable del fenómeno; el veredicto que produce puede no sobrevivir fuera de ella, y una explicación canónica coherente lo blinda en vez de delatarlo
metadata:
  type: feedback
---

# 🔭🎚️ La condición que el instrumento EXIGE para ver cambia lo medido

Hay instrumentos que no pueden observar el sistema tal como está: exigen tocarlo primero —apagar algo,
congelar algo, inyectar una bandera— para que el dato sea legible. **Esa modificación no es un detalle
de setup: es una variable del fenómeno.** Y el veredicto que sale de ahí puede no sobrevivir fuera de
ella, sin que nada en el resultado lo insinúe: se ve como cualquier otra medición, reproducible y con
evidencia.

**Lo que lo vuelve difícil de cazar es el segundo refuerzo.** Si además existe una explicación
mecanicista coherente —y mejor todavía, una **fuente canónica** que la respalde—, la medición falsa y
el razonamiento quedan **del mismo lado** y se sostienen mutuamente. Ahí no hay fricción que avise: lo
que uno siente es *«lo medí y además entiendo por qué»*. Es la forma más estable del error.

## El caso (2026-10-11)

`uiautomator dump` no consigue idle mientras algo anima, y la portada de la app anima siempre: devolvía
un árbol **vacío**, que se lee como «la pantalla no tiene nada». La salida fue poner las tres escalas de
animación del sistema en **0**. Con eso el árbol se leía… y el toque de la pestaña del escritorio **no
abría nunca**, a ninguna de las tres alturas probadas.

Conclusión que publiqué: *«el tap es inalcanzable»*, con causa **deducida de la skill canónica** de
RNGH (el tap cuelga de `onEnd` de un `Gesture.Pan()`, y `onEnd` no corre si el gesto no se activó).
Coherente, citable, y **falsa**.

Con las escalas en **1**, el toque abre: **75,00 %** de la pantalla cambia, en **2 de 3** ciclos con
reset. Las escalas en 0 ponen a Reanimated en *reduced motion* —lo avisa en el bundle— y en esa
condición el tap no llega. **El precio de poder ver era cambiar lo que había que ver.**

Dato que lo confirma por el otro lado: corriendo el instrumento con las animaciones normales, corta en
seco con *«0 nodos, 0 resource-ids»*. El sensor del árbol **no existe** en la condición del usuario; no
es que midiera peor, es que no mide.

## Las defensas

1. **Declarar la modificación como variable, no como setup.** Si el instrumento exige tocar el sistema,
   todo hallazgo que produzca lleva la condición pegada: *«medido con X apagado»*. Lo que no se puede
   decir es el hallazgo a secas.
2. **Un segundo sensor que no la exija**, antes de publicar el hallazgo. Acá: el porcentaje de bytes
   distintos entre dos framebuffers crudos (`screencap` sin `-p`), que lee el framebuffer tal como está
   y no necesita idle. Dos sensores independientes que coinciden valen; uno que necesita mutar el
   sujeto, no alcanza.
3. **El sensor nuevo necesita su piso de ruido medido antes de usarlo.** La portada anima sola: dos
   capturas consecutivas sin tocar nada ya difieren **0,29 %**. Sin esa línea base, cualquier cambio
   «parece» apertura — y con ella, el 75 % es de otro orden y el 4,86 % de un intento dudoso queda
   honestamente **sin atribuir**.
4. **Una explicación canónica no es evidencia.** Cuando el razonamiento y la medición coinciden, la
   pregunta que falta es *¿qué condición comparten?*. Acá compartían la que yo había inducido.

**Lo que se retira es la causa, no la observación** ([[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]]):
el toque no abría con escalas en 0 — eso pasó. Lo que cae es *«el tap es inalcanzable»*. Familia de
[[el-instrumento-tambien-CONDENA-no-solo-absuelve]] y de
[[el-instrumento-respondio-sobre-otro-sujeto]], con la diferencia de que acá el instrumento no se
equivocó de sujeto ni mintió: **cambió el sujeto para poder mirarlo**.

---

## REFUERZO del mismo día — y la corrección **tuvo que corregirse**: n=3 lee una regla donde hay una probabilidad

Reescribir el hallazgo con el sensor bueno no alcanzó. La primera corrida con animaciones normales
dio **3 ciclos** y en los tres el primer toque midió **0,00 %**: leí un patrón **determinista**
—*«el primer toque nunca abre»*— y lo publiqué con esa forma. La **segunda** corrida del
instrumento abrió **al primer toque** en su primer ciclo. Consolidado: abre en **4 de 6** ciclos, al
primer intento **1 de 6**, y **2 ciclos no abren ni al tercero**.

**El hallazgo real era «intermitente», y lo publiqué como «siempre».** Lo que hace tentadora esa
lectura no es el descuido: es que **una regla se escribe mejor que una probabilidad**. «El primer
gesto se pierde» tiene mecanismo, cita y fix; «4 de 6, y cuando abre no siempre al mismo intento»
no tiene nada de eso y suena a medición sucia. La prosa empuja hacia el determinismo.

**Regla operativa:** antes de darle forma de *siempre* o *nunca* a algo medido en device, **correr el
instrumento una segunda vez entero**. No un ciclo más dentro de la misma corrida — otra corrida,
con su propio reset. Y si el fenómeno resulta intermitente, el número **es** el hallazgo: escribir
«4 de 6» cuesta lo mismo que escribir «siempre» y no hay que retirarlo después.

Es el espejo de [[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]]: ahí la
intermitencia del **instrumento** sirve de coartada («es el flake»); acá la intermitencia del
**sujeto** se disfraza de ley porque tres de tres se ve igual que siempre.
