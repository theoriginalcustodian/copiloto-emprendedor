---
name: device-fisico-exige-dueno-unico
description: "Dos sesiones tapeando el MISMO telefono por ADB no se estorban: se fabrican evidencia falsa mutuamente, y el caso peligroso es el que sale bien. Ademas el device ESCRIBE en la base (un dictado al chat creo un gasto real). LEER antes de que dos sesiones toquen un recurso fisico unico."
metadata:
  node_type: memory
  type: project
---

**Un recurso físico y único no admite el modelo de concurrencia que sirve para los archivos.**

**El caso (2026-07-22, medido en los logs).** El operador sospechó un conflicto. Los transcripts lo
confirmaron: **las dos sesiones le estaban mandando `adb shell input tap` al mismo teléfono, a la
vez** — backend 268 comandos ADB, frontend 1424. Un solo Metro, un solo aparato, dos actores.

## Por qué es peor que «se estorban»

**Se fabrican evidencia falsa mutuamente, en las dos direcciones:**

- Un `input tap` de A **cambia la pantalla que B estaba por capturar**. B saca la captura, ve otra
  cosa, y **no puede distinguirlo de su propio efecto**.
- Peor al revés: B captura lo que A dejó, **le sale bien**, y concluye que su flujo anda. **Un falso
  verde, que es el que nadie cuestiona.**
- `dumpsys window mCurrentFocus` —que las dos usan para saber dónde están— devuelve **el foco de la
  otra**.

Es [[instrumentos-que-confirman-en-vez-de-verificar]] en su forma más difícil de ver: el instrumento
**no está roto**, está midiendo el efecto de otro actor. **Ninguna corrida hecha así vale — ni la que
dio verde ni la que dio rojo.** Todo lo probado en esa ventana quedó `[UNVERIFIED]`, no por haber
salido mal sino porque **no se puede saber**.

## 🔴 La mitad que casi se nos pasa: el device ESCRIBE en producción

En el mismo incidente, un `input text` + `tap` mandó *«pagué 8500 de nafta en la estación»* **al chat
del copiloto**, con la tool `registrar_gasto` ya desplegada. **Existió**: backend lo confirmó con el
antes/después —`[(7, 8500.00, 'gasté 8500 en nafta')]` → `borrados: 1`— y lo había limpiado en su
misma corrida, junto con un `horario_atencion` del perfil que había tocado para un control.

Lo que hace la lección no es que se haya escapado, sino **cómo se ve cuando se escapa**: el gasto
**se creó bien**. El agente hizo exactamente su trabajo. Sin error, sin log rojo, sin excepción.

**Un dato falso perfectamente formado es indistinguible de uno verdadero.** Por eso hay que ir a
buscarlo en el momento, no cuando alguien se pregunte por qué el mes no cierra. Es
[[copiloto-tests-ensuciaban-la-base]] otra vez, por una puerta nueva.

**El teléfono no es «un instrumento que no hay que ensuciar»: es un cliente de escritura contra el
sistema vivo**, y merece la misma disciplina que una migración. Todo `adb input` sobre la app cuenta
como escritura en la base, y va **contra el tenant de prueba**.

## La regla

**Dueño único, no reparto de turnos.** `COORDINACION.md` §1 resuelve la concurrencia del árbol con
«rutas explícitas, nunca `add -A`», y **alcanza porque dos sesiones pueden escribir archivos
distintos**. Pero **no existe la «ruta explícita» de un teléfono**: hay una pantalla, un foco, un
estado. Es la misma familia que «una sola sesión es dueña del deploy y de las migraciones».

Lo que faltaba no era disciplina: era **darse cuenta de que el device es estado compartido**, no una
herramienta local de cada sesión. Generaliza a cualquier recurso físico único — un puerto serie, una
impresora, un lector, un browser con sesión abierta.

**Y el dueño avisa cuando lo toma y cuando lo suelta.** No para pedir permiso: para que si alguien ve
movimiento raro sepa de quién es.

## El detalle que hace la lección, y es de FRONTEND

**Tuvo la evidencia del conflicto en la mano y la explicó.** Vio texto en el composer que él no había
escrito y se dijo *«quedó de antes»*. Después corrió un control —dos capturas separadas por 12
segundos; si eran idénticas, «no hay nadie»— **y le dio idéntico**, porque cayó justo en una ventana
en la que el otro no tapeaba. Con eso se autorizó a seguir.

Dos fallas distintas, y las dos valen más que el incidente:
1. **Una anomalía que no se puede explicar no se explica: se investiga.** Texto que uno no escribió,
   en una pantalla que uno maneja, **es** la señal de que hay otro actor.
2. **Un control que no puede dar negativo de verdad no es un control.** 12 segundos de quietud no
   prueban ausencia de un actor **intermitente**: prueban que no tocó nada en 12 segundos.

[[instrumentos-que-confirman-en-vez-de-verificar]] [[vacio-no-es-hallazgo-correr-el-control]]
[[coordinacion-tres-sesiones-buzon]]
