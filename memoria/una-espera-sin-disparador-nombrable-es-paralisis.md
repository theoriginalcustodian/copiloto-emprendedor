---
name: una-espera-sin-disparador-nombrable-es-paralisis
description: "Todo estado propio ENVEJECE: «estoy esperando X», «ADB está apagado», «esto ya lo decidí». Nadie lo revalida porque no se siente una hipótesis — se siente memoria. Dos sesiones paradas 70 min esperando un aviso que nadie iba a emitir. LEER al declarar que estás esperando algo, o al apoyarte en algo que sabías."
metadata:
  type: feedback
---

**Regla macro:** *si no podés **nombrar el archivo, el evento o el comando** que levanta tu espera, no
estás esperando: **estás parado**.* Y todo estado que declarás —pendiente, bloqueado, apagado, ya
decidido— **envejece desde el instante en que lo escribís**.

## Por qué es distinto de «no codificar la esperanza»

Esa regla vigila lo que afirmo **sobre el sistema**. Ésta vigila lo que asumo **sobre mi propio
estado** — y ahí no hay instinto de verificación, porque *no se siente una hipótesis: se siente
memoria*. Nadie corre un control sobre algo que "ya sabe".

**El costo es peor que el de una afirmación falsa: una afirmación falsa produce un bug, un estado
falso produce QUIETUD.** Y la quietud no protesta, no aparece en ningún gate, y todos los
instrumentos siguen en verde.

## Los cuatro casos del 2026-07-22, que son el mismo

| Estado declarado | Qué pasó de verdad | Costo |
|---|---|---|
| *«congelo la rama hasta que backend avise»* | **el aviso nunca se emitió** y nadie lo verificó | 70 min de app parada |
| *«ADB apagado, aviso cuando lo tome»* | **el device estaba conectado hacía rato** — nunca lo revalidó | la otra mitad del mismo bloqueo |
| *«el ingreso no lleva card» (§2.bis)* + *«el ingreso lleva fecha editable» (A.1)* | **los escribí yo con 40 min de diferencia**, sin cruzarlos | un contrato con dos verdades, cazado por backend antes de implementar |
| *«el dato ya existe, sólo hay que contarlo»* | `falta` describe el estado ACTUAL, no la historia | el mecanismo habría hecho **lo contrario** de su propósito |

**Ninguno fue negligencia.** Los cuatro son estados que **fueron ciertos** cuando se escribieron.

## La causa raíz: el trabajo en paralelo acelera el envejecimiento

Con tres sesiones simultáneas, **lo que sé tiene veinte minutos de antigüedad**. Una decisión que
tomé hace media hora ya puede estar contradicha por otra sesión que trabajó bien y en paralelo. El
error no es no saber: es **usar lo que sabía sin preguntar si sigue siendo cierto**.

## Qué hacer (los tres controles, todos de segundos)

1. **Al declarar una espera, nombrá lo que la levanta.** *«Espero el `listo_` de backend»*, no
   *«espero que backend termine»*. Si no podés nombrarlo, **no es una espera: pedilo o seguí con
   otra cosa.**
2. **Antes de apoyarte en un estado externo, revalidalo.** `adb devices`, `gh pr view`, `ls` del
   buzón. Es un comando; el estado tiene minutos.
3. **Antes de escribir sobre una superficie ya decidida, releé lo último sobre esa superficie** —
   `grep` del nombre en `abierto/`, no la memoria de la conversación.

## El síntoma que lo delata desde afuera

**Todos los instrumentos en verde y el trabajo sin moverse.** Si dos sesiones llevan una hora
"activas" —escribiéndose acuses— y el sprint no avanzó, no hay silencio: hay espera mutua. Ver
[[instrumentos-que-confirman-en-vez-de-verificar]], porque el vigía que debía cazarlo medía silencio y
no parálisis.

---

## Variante 2026-10-07: la espera sin disparador no siempre produce quietud — **a veces produce el trabajo hecho dos veces**

Auditoría midió que `scripts/dup-indice-check.py` crasheaba en Windows, nombró el fix exacto (una
línea) y cerró su mensaje con: *«**Dueño: tuyo**, es tu archivo y está congelado — **no lo toco yo**
para no chocar con `CONGELAINSTR`»*. **Tres horas después lo arregló ella** (#897, mergeado 7 min
después de abrirse). Planificación, sin haber hecho `fetch`, construyó el mismo fix **más** el ruteo
del exit code y abrió #898: salió **6/6 verde y CONFLICTING**. Hubo que cerrarlo y rearmar el delta.

**Lo que esto agrega a la entrada:** el modo de falla canónico de una espera sin disparador es la
**parálisis** — nadie se mueve. Acá el resultado fue el opuesto y **es más difícil de ver**:

- para la que cede, el trabajo quedó **entregado**;
- para la dueña, es **una fila más** en una cola de 16;
- las dos lecturas son razonables, así que **la espera no se siente como espera**;
- y a la tercera hora, la que cedió sólo tiene opciones malas: **dejarlo roto** o **hacerlo y duplicar**.

Nadie violó su propia regla. `cero-tiempo-ocioso` empuja a la que cedió a no quedarse quieta, y
`CONGELAINSTR` le decía que no era su carril. **El defecto vive en el traspaso, no en las dos
sesiones** ([[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]]).

**Y el daño real no fue el PR tirado:** #897 **nombró** el segundo defecto en un comentario —*«peor:
el crash sale con exit 1, el MISMO código que "encontré un duplicado"»*— y **no lo arregló**. La
colisión siguió viva para cualquier otra excepción, con una nota que la hace parecer atendida
([[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]]).

**How to apply:** (1) **el que mide, arregla**, salvo que ceda con **plazo**: *«es tuyo; si no lo
tomás antes de las HH:MM, lo tomo yo»* — una cesión sin plazo no es una cesión; (2) antes de arreglar
un archivo que otra sesión nombró, **`git fetch` y mirá si ya está** (un paso antes de
[[push-es-el-ultimo-paso-no-el-primero]]); (3) si arreglás la mitad conocida de un defecto y dejás la
otra, **el estado va al DoD de la fila**, no a un comentario del código: un comentario no tiene dueño
ni disparador; (4) «diferido» no es «cedido» — una fila congelada **con dueño** no es una invitación.
