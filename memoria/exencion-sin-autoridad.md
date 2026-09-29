---
name: exencion-sin-autoridad
description: Una excepción marcada en el código puede citar una decisión real que habla de OTRA cosa; el gate comprueba que la cita exista, no que aplique.
metadata:
  type: feedback
---

# 📜🕳️ La exención cita una autoridad que no la ampara

**34 pares de texto bajo el umbral AA pasaban el gate de contraste por exención.** Las de web están
marcadas `DEUDA_CONOCIDA` y **citan `DEC-11`**, un acta real, firmada por el operador, que existe y se
puede abrir.

**`DEC-11` habla de otras dos excepciones** —el sello de acción y el botón de grabar— **y dice
literalmente que ésas «se corrigen, sin excepción firmada». Además ya se corrigieron.** O sea: la
exención cita una decisión que (a) no la menciona, (b) resuelve lo contrario de lo que se le hace
decir, y (c) ya está cumplida.

## Por qué no da síntoma

**La referencia existe y resuelve.** Quien audita el gate ve una exención justificada, busca `DEC-11`,
la encuentra, y sigue. Todos los pasos dan verde:

- la exención está **declarada**, no escondida;
- la decisión citada es **real**, no inventada;
- el acta está **vigente**, no derogada.

Lo único que falla es la **correspondencia** entre una y otra, y eso es justo lo que ningún mecanismo
compara. Es [[el-guard-se-satisface-con-su-propio-comentario]] un escalón más arriba: ahí el guard se
conformaba con un comentario propio; acá se conforma con una cita a un documento ajeno **sin leer si
lo cubre**.

## La pregunta que lo caza

> *Abrí la decisión que la exención cita y buscá el caso exento adentro. Si no está nombrado, la
> exención no tiene autoridad — tiene una referencia.*

Y la versión barata, para revisar muchas de una: **contar**. Si el acta nombra 2 casos y las
exenciones que la citan son 34, la cuenta ya no cierra sin leer nada más.

## El corolario que lo vuelve urgente

Una exención sin autoridad **no es deuda: es una decisión tomada por quien escribió el código**, con
la apariencia de estar aprobada. La diferencia importa porque nadie la va a revisar — figura como ya
decidida.

En este caso, además, lo exento eran los estados de **éxito** y de **peligro**: justo los que el
usuario más necesita poder leer. Y ninguno estaba lejos del umbral — el peor a 0,73 y ocho a 0,12 de
distancia. **Nadie había elegido ese riesgo; se había heredado.**

Ver [[cero-deuda-no-gestionada]] · [[el-contrato-afirma-el-mecanismo-que-no-opero]] ·
[[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]].
