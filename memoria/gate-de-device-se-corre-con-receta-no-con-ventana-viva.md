---
name: gate-de-device-se-corre-con-receta-no-con-ventana-viva
description: Un gate que exige interacción física en device NO se coordina "en vivo" entre dos sesiones — el dueño del device lo corre solo con una RECETA escrita
metadata:
  type: feedback
---

Cuando un gate de cierre necesita tocar la pantalla real (dictado de voz, gesto, swipe) y el device
es exclusivo de UNA sesión (backend, dueño del ADB), el modelo "el dueño sostiene el device + la otra
sesión reacciona EN VIVO" **falla**: exige presencia simultánea, y el buzón es asíncrono con latencia
de minutos. Backend abrió la ventana viva (`tomo-device-ahora`), frontend estaba en su vigía de ~15
min, la señal no lo esperó, y los gates quedaron sin correr.

**El destrabe no es más sincronía — es datos.** La sesión que conoce la UI baja una **`receta_`**: para
cada gate, la secuencia EXACTA de gestos + el resultado esperado + el gesto correcto de retorno (backend
había usado `KEYCODE_BACK` y se fue al home). Con eso el dueño del device corre el gate **solo**, en su
próxima ventana, sin esperar a nadie. Es [[localizacion-estructurada-feedback-agentes]] aplicado al
device: dale el plano, no la orden.

**Why:** el cuello no era el device ni que la otra sesión "se distrajera" — era que el dueño del ADB
**no conocía los gestos** de la UI ajena. Eso se resuelve con una receta escrita (lectura de código
propio, cero device), no con coordinar dos REPLs en el mismo segundo. Además la receta **persiste**:
la corre cuando quiera, la re-corre si algo cambia, y de yapa el dueño del device caza bugs reales que
ningún test agarró (así salió PR#107: el id de tarjeta viajaba como int y el cliente lo descartaba en
silencio — cazado corriendo la receta, no en jsdom).

**How to apply:** gate que necesita interacción viva + device de dueño único → NO agendes "ventana
sincrónica"; pedí a quien conoce la UI una `receta_` con gestos exactos + retorno correcto + cómo poner
el build actual en el device ([[iterar-en-device-es-metro-local-con-dev-client-ya-instalado]], primero
el control de "¿qué build corre?" antes de asumir la pantalla rota). El dueño la ejecuta solo y reporta
un `avance_`/`listo_` por gate. Ver [[device-fisico-exige-dueno-unico]] y [[gate-jsdom-no-ve-gestos-tactiles]].
