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

---

**Refuerzo 2026-10-14 — «receta escrita» no alcanza: una receta en PROSA se reconstruye, y reconstruirla
es volver a decidir.** Esta entrada decía «pedí una `receta_` con gestos exactos» y yo creí cumplirla:
bajé a frontend2 un `contrato_` con la pasada de device de `SM-E3` describiendo los pasos **en texto**.
El instrumento del buzón lo rechazó con un rótulo que no había visto antes — **`PROSA PURA`: «sin bloque
cercado ni path a artefacto; el contrato define con un shape/test/ejemplo, no sólo describe»** — y tenía
razón. El defecto no es de estilo: sin los `testID` ni los comandos, el que corre la receta **tiene que
reconstruirla**, y cada reconstrucción es una decisión que el contrato existía para cerrar. Dos sesiones
reconstruyendo la misma prosa producen dos recetas distintas y veredictos que no se pueden comparar.

Lo que separa una receta ejecutable de una descripción, medido al reescribirla como artefacto versionado:
cada paso cita el **`testID` literal** (13 de 13 verificados contra `apps/`, 0 inventados, con control
positivo de que el barrido sabe acusar un id falso) · el **subcomando exacto** del helper (los 5
existen en `device_medir.py`) · un **paso de persistencia** explícito, porque sin reabrir la pantalla el
veredicto acredita el *render* y no la escritura · y el **control de qué build corre**, con
`git merge-base --is-ancestor <sha del merge> HEAD` de los shas que introdujeron lo que se mide: servir
un checkout anterior produce un `DESVÍO` **falso**, no un error visible.

Y un detalle que sólo aparece al escribirla: hay ids que **no se pueden** poner literales porque llevan
dato del tenant (`detalle-gasto-trabajos-opcion-<eslabon>:<ref>`). La receta no los inventa — manda
**listarlos** con `$D ver` y pegar la salida, porque
[[un-id-que-fabrica-el-instrumento-no-puede-parecerse-a-uno-real]]: un id plausible escrito por quien
redacta la receta no se distingue de uno real hasta que alguien lo toca y no pasa nada.

**How to apply:** antes de mandar una receta de device, pasale el test del rótulo: ¿tiene bloque cercado
y path a artefacto, o es prosa? Si es prosa, no la mandes — escribila como archivo versionado
(`docs/.../receta-medicion-device-<id>.md`), reusando el formato de la última receta del repo en vez de
inventar uno, y **verificá que ningún id citado sea inventado** antes de pushearla. El `contrato_` del
buzón entonces apunta al path; no lo repite.
