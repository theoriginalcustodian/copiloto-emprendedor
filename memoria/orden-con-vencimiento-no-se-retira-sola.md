---
name: orden-con-vencimiento-no-se-retira-sola
description: Una orden con hora de vencimiento vence en el reloj pero NO en el buzón — su default al expirar es seguir vigente, que es el opuesto del que se quiere
metadata:
  type: feedback
---

# ⏰ Una orden con vencimiento vence en el RELOJ, no en el buzón

**2026-08-06.** Emití una parada general: *"PARADA hasta las 14:21 — orden del operador"*. A las
**16:35** el archivo seguía en `abierto/` como `urgente_`, y **las tres sesiones seguían paradas**.
Dos horas y cuarto de fábrica quieta por una orden que ya no regía.

El operador tuvo que pedirme *"hay que volver a lanzar todo lo que estuvo parado"* para que yo la
levantara. O sea: el destrabe lo hizo él, no el mecanismo.

## Por qué falla en silencio

Un `urgente_` abierto **se lee como vigente**. La hora está en el cuerpo del mensaje, no en la
ubicación del archivo — y en este buzón **el estado es la ubicación**. Nadie compara el reloj contra
el texto de cada mensaje abierto: el archivo dice "urgente" y con eso alcanza.

El default al vencer es **seguir vigente**, que es exactamente el opuesto del que se quiere. Y como
la orden era *detenerse*, su cumplimiento se ve idéntico a su incumplimiento: **silencio**. No hay
excepción, no hay error, no hay nadie preguntando. Una orden de parar que se olvida abierta **no
genera ninguna señal de que sigue actuando**.

Es la forma temporal de [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]: lo que empuja hacia el NO
—un gate fail-closed, una parada— hace su propia rotura indistinguible de su funcionamiento.

## La regla

**Toda orden con hora de vencimiento debe decir, en el mismo mensaje, QUIÉN la levanta y CÓMO se
sabe que venció.** O no lleva hora.

Tres formas válidas, de peor a mejor:

1. Nombrar al responsable de retirarla — frágil, depende de que se acuerde.
2. Condición de auto-levantamiento verificable por el que lee: *"si son más de las 14:21, esta orden
   ya no rige; movela vos a `cerrado/`"* — el lector la mata, no el emisor.
3. **Que el instrumento la vea:** un chequeo que alarme ante una obligación **abierta y vencida**.
   Es lo único que no depende de nadie acordándose.

## Aplica más allá del buzón

Feature flags con fecha de cleanup, `[ASSUMED_PENDING_VERIFY]` con condición de verificación, TODOs
con sprint target, silenciamientos temporales de alertas, credenciales de prueba. **Todo lo que se
declara "temporal" necesita su mecanismo de retiro declarado en el mismo acto** — si no, "temporal"
significa permanente y nadie se entera.

Hermana de [[cero-deuda-no-gestionada]]: una orden vencida y no retirada es deuda **impaga**, y su
interés se cobra en tiempo de fábrica parada.
