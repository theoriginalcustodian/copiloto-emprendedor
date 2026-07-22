---
name: mensaje-entregado-donde-nadie-mira
description: "Un aviso escrito en el lugar correcto pero que el destinatario no vigila NO fue entregado. Declare un `avance_` como disparador en el §9 de un contrato sin probar el cable: nacia en `cerrado/` y los vigias miraban `abierto/`. FRONTEND estuvo horas esperando algo ya hecho. LEER antes de declarar un mecanismo de coordinacion en un contrato."
metadata:
  node_type: memory
  type: feedback
---

**Escribir el mensaje no es entregarlo. Entregarlo es que aparezca donde el destinatario mira.**

**El caso (2026-07-21, noche).** El §9 del contrato de Gastos declaraba: *«backend emite un `avance_`
cuando los endpoints estén vivos; es el disparador para que la app arranque»*. Backend lo emitió a
tiempo. **FRONTEND estuvo horas repitiendo «espero el `avance_` para arrancar» con el `avance_` ya
escrito.** El formato dice que los `avance_` nacen en `cerrado/` —para que ningún acuse les pise el
`mtime` que mide el silencio— y **los tres vigías miraban `abierto/`**.

Nada estaba roto. El mensaje existía, era correcto, estaba en la carpeta que el formato manda. Y el
trabajo quedó parado igual.

**Por qué no lo cazó nadie, y es lo que hace la lección:** el modo de falla es que **el buzón no
protesta**. `abierto/` decía la verdad —no había nada pendiente de respuesta— y cada sesión concluyó
«no hay novedades» cuando lo correcto era «no hay novedades **en la mitad del buzón que estoy
mirando**». Es un vacío que no duele, hermano de [[vacio-no-es-hallazgo-correr-el-control]]: ningún
error, ningún timeout, ninguna excepción. Sólo silencio, que se parece muchísimo a que todo va bien.

**El error es de quien escribe el contrato, y era mío.** Diseñé la junta y **no probé el cable**:
declaré un disparador sin verificar que el transporte pasara por donde el destinatario efectivamente
mira. Es exactamente lo que el puesto de planificación existe para no hacer — la costura entre dos
sesiones no es de ninguna de las dos, es de quien la declaró.

**Regla dura, para todo `contrato_` futuro.** Si un contrato declara un mecanismo de coordinación
—disparador, aviso, punto de encuentro, «te avisa cuando esté»— hay que **probar el mecanismo, no sólo
escribirlo**: emitir uno de prueba y confirmar que el otro lado lo ve. Un disparador no probado es un
supuesto crítico sin validar, o sea [[spike-first-central-proyecto]] aplicado al proceso en vez de al
código.

**Y el corolario que evita el arreglo equivocado:** la reacción fácil era mover los `avance_` a
`abierto/`. Habría ensuciado la única carpeta cuyo valor es que un `ls` diga qué está pendiente, y
roto el `mtime` limpio que mide el silencio. **El problema no era dónde nace el mensaje: era que el
vigía miraba media casa.** Cuando un mecanismo falla, corregir el que está roto — no el que está bien
y es más fácil de tocar.

Hermana de [[verificar-que-el-camino-recomendado-existe]] (aquella: el camino no existía; ésta: existe
donde nadie mira) y de [[instrumentos-que-confirman-en-vez-de-verificar]] §10, que es el instrumento
parcialmente ciego que lo permitió.

[[coordinacion-tres-sesiones-buzon]] [[no-codificar-la-esperanza-principio-raiz]]
