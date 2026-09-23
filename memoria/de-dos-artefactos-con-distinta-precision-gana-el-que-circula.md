---
name: de-dos-artefactos-con-distinta-precision-gana-el-que-circula
description: El tablero decía "el push pasa a veces"; el mensaje al buzón decía "bloqueado para todas". Backend leyó el mensaje y se paró con el trabajo terminado.
metadata:
  type: feedback
---

El mismo hecho estaba escrito en dos lugares con distinta precisión, y la sesión que dependía de él
actuó sobre el menos preciso — porque es el que le llegó.

**El caso (2026-09-23).** El reconcile del grafo abortaba los push. En `coordinacion/PLAN.md`, la
fila `GRAFO` decía, exacto: *«los push que pasan hoy pasan por COLISIÓN con un sync ajeno (el hook
deja pasar la contención), no porque esté resuelto»*. En el `hallazgo_` que bajé al buzón, el mismo
hecho quedó como el título: **«el push está bloqueado para todas»**.

Backend leyó el mensaje. Razonó bien sobre lo que tenía: *«la resolución es MAYOR, la tiene el
operador, no soy dueña de ese estado compartido, no lo fuerzo»* — todo correcto. Y se declaró
bloqueada con BL-O6 Parte B **implementada y con gate 5/5 verde**, sin reintentar una sola vez. El
push le habría pasado: el hook deja pasar cuando otro sync tiene el lock, y con tres sesiones
corriendo crones hay syncs vivos buena parte del tiempo. Yo mismo pusheé cuatro commits en ese
estado, y FE2 también.

**Por qué pasa.** El tablero se escribe para pensar y admite matices; el mensaje se escribe para
avisar y **premia el título corto**. Un `hallazgo_` viaja, se cita, se relee al arrancar; una celda
de tabla de 900 caracteres, no. De los dos, el que fija la conducta ajena es el que circula — y es
justamente el que se escribe con menos cuidado, porque «el detalle ya está en el plan».

**Y el matiz se pierde en la dirección peligrosa.** «A veces» se comprime a «siempre», nunca al
revés: un bloqueo dicho como permanente no produce un error ruidoso, produce **quietud**, que es lo
que nadie re-mide. Backend no falló: acertó sobre una premisa que le di mal.
Ver [[una-espera-sin-disparador-nombrable-es-paralisis]] y [[supuesto-cuya-falla-parece-un-estado-legitimo]].

**Cómo se aplica.** Antes de bajar un `hallazgo_` o un `dato_` que vaya a **parar** a alguien:

1. *¿El título dice lo mismo que la evidencia, o la redondeó?* «Bloqueado» y «bloqueado a veces» son
   dos instrucciones distintas para quien lo lee.
2. *¿Qué NO tiene que dejar de intentar por leer esto?* Si la respuesta es «reintentar», **decilo en
   el mensaje**, no en el tablero.
3. *¿Le di un techo?* Un bloqueo comunicado sin techo es indefinido. El destrabe que mandé lleva uno
   explícito: «si te aborta **tres veces seguidas**, vuelve a ser bloqueo mío, no tuyo».

Corolario para el que recibe: un bloqueo ajeno **heredado** se re-mide una vez antes de adoptarlo,
sobre todo si adoptarlo significa parar con el trabajo terminado. Cuesta un comando.
