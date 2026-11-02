# SM-I6: el rótulo sale de la posición

**Device:** Android físico, cuenta del operador, dev-client (no release). Fecha: 2026-11-02.

`SM-I6-rotulo-al-bajar-el-chat.webp` es la franja del rótulo cada 0,2 s, filmada con `screenrecord` a 10 cuadros por segundo: «Bajá para volver a Mi día» se va cuando el chat empieza a bajar, sin esperar a que termine la animación.

Al cerrar el escritorio el resultado es el mismo. Esa filmación no se versiona porque muestra datos reales.

## El retardo de ~1,3 s

SM-G4 lo midió a las 15:58, antes de #1401. Hacía falta tocar la tira o el campo del chat con el escritorio abierto. Desde #1401 el escritorio abierto no muestra ni tira ni campo, y `setSenalSubir` sólo se llama desde Mi día o desde BACK con el escritorio cerrado (`PantallaPrincipal.tsx`). Es lectura de código más una captura: no se probó cada recorrido.

No hay filmación del antes: la de SM-G4 no se guardó.

Falta medir en release, que es el ejercicio final de SM-G4.
