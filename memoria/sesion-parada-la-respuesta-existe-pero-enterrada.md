---
name: sesion-parada-la-respuesta-existe-pero-enterrada
description: Una sesión parada no siempre espera una respuesta que no existe — a veces la respuesta YA EXISTE pero está enterrada (bajo una pregunta posterior) o en el archivo equivocado (contestada en el hilo de otro). El monitor de espera-mutua no ve la sesión sola parada; el control de ociosas cada 3 min la caza rápido, y su primer chequeo es "¿la respuesta ya existe, invisible?"
metadata:
  type: feedback
---

**Caso raíz (2026-07-23):** frontend quedó parado ~9 min esperando el dato A/B para el fix del freeze.
Mi monitor de PARÁLISIS no lo cazó —caza **espera MUTUA** (ambas trabadas, umbral ~25 min)— y **el
operador lo notó antes que yo**. Al verificar aparecieron DOS capas del mismo problema
([[mensaje-entregado-donde-nadie-mira]]):

1. **La respuesta ya existía, enterrada.** Backend la había dado a las 01:25 (`RESPUESTA → FRONTEND`),
   pero quedó **debajo de una pregunta posterior** en el mismo archivo → frontend, escaneando, vio la
   pregunta al final y creyó que seguía abierto. No fue falta de respuesta; fue una respuesta invisible.
2. **La re-respuesta cayó en el archivo equivocado.** Cuando destrabé, backend contestó en **mi** dato
   (`planificacion-a-backend`), no en el hilo de frontend → si no la **relayeo** yo a un archivo
   `-a-frontend`, se re-entierra. El que espera mira su propio hilo, no el de otro.

## La lección de monitoreo (por qué existe el 3er cron)
El monitor de **espera-mutua** tiene un punto ciego: una **sola** sesión parada mientras la otra avanza,
bloqueada en algo **resoluble ya** (una respuesta que existe, una decisión, una lectura sin device). Su
umbral de 25 min es demasiado lento. Por eso el **control de sesiones ociosas cada 3 min** (cron
`05be5fdc`, `1-58/3`, ver `/monitoreo`): umbral corto (~6 min), y ante una parada su **primer** chequeo
NO es "pedile a la otra que responda" sino **"¿la respuesta ya existe — enterrada bajo otra sección, o
contestada en el hilo de otro?"**. Si existe, el destrabe es **relayearla** a un archivo que apunte a la
sesión que espera, no volver a preguntar.

## How to apply
1. **Sesión sola parada > ~6 min** con trabajo que le toca → investigar el porqué **antes** de reportar
   "ociosa". No esperar el umbral de espera-mutua.
2. **Primer chequeo ante una parada: ¿la respuesta ya existe?** Buscar `RESPUESTA →`/acuses enterrados
   bajo secciones posteriores, y en los hilos de las OTRAS sesiones (no solo el de quien espera).
3. **Si existe, relayearla** a un `dato_..._a-<sesión-que-espera>` con la respuesta + qué la desbloquea.
   El que espera mira su propio hilo; una respuesta en el archivo de otro es invisible para él.
4. **Si de verdad no existe**, entonces sí: `dato_` a quien puede contestar, marcando si NO necesita
   device (respuesta de memoria/decisión/lectura) — es lo que más rápido libera.
