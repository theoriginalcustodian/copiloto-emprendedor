---
name: probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala
description: Diagnosticar bien un defecto del instrumento se vuelve licencia para ignorar sus señales — una alarma con causa falsa probada puede tener a la vez una causa verdadera.
metadata:
  type: feedback
---

# 🔬🙈 Probar que el instrumento miente NO te exime de leer lo que señala

El 2026-08-06 diagnostiqué —bien, leyendo el código y con números— que
`scripts/escaladores-buzon.sh` acusa de silencio a quien acaba de reportar: mide el `mtime` del
contrato en `en-curso/` y **nunca** el `avance_` del frente. Frontend había reportado hacía 13
minutos y el escalador decía 103.

Con ese diagnóstico en mano descarté la misma alarma **cuatro ciclos seguidos** con una línea:
*"el escalador de frontend ya está probado falso"*.

Al quinto ciclo miré el archivo que señalaba. Su DoD estaba **cumplido**: el build se hizo, se
instaló, backend corrió el device pass y cerró el hito. El contrato llevaba dos horas en `en-curso/`
como zombie. **La alarma tenía razón** — por una causa distinta de la que yo había refutado.

## Por qué es tan fácil de cometer

Un diagnóstico correcto se siente como un cierre. Una vez que podés explicar *por qué* la señal es
espuria, la señal deja de ser información y pasa a ser ruido conocido — y el ruido conocido no se
lee, se saltea. El costo de mirar el archivo era un `ls`; lo pagué recién a la quinta.

Es la trampa espejo de [[vacio-no-es-hallazgo-correr-el-control]]: allá el peligro es **explicar**
un vacío sin controlarlo; acá es haber controlado tan bien que la explicación **clausura** la
observación. Refutar una causa no refuta el hecho.

## El control

Una alarma repetida merece, cada N ciclos, **una mirada al objeto señalado, no al instrumento**.
La pregunta no es *¿el detector funciona?* sino:

> **Suponiendo que el detector esté roto exactamente como creo — ¿esto que señala debería estar
> igual donde está?**

Si la respuesta es "no", hay una segunda causa y es real. Un detector defectuoso y un hallazgo
verdadero **coexisten sin problema**; la refutación del primero no toca al segundo.

## Corolario operativo

Cuando descartes una alarma por un defecto conocido, escribí *qué otra cosa tendría que ser cierta*
para que la alarma fuera legítima. Si no podés nombrarla, no la descartaste: la ignoraste.
