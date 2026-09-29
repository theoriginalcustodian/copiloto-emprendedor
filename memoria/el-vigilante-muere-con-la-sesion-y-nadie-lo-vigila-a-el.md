---
name: el-vigilante-muere-con-la-sesion-y-nadie-lo-vigila-a-el
description: "Los crones de vigilancia son session-only y además son el único RELOJ de la sesión: un corte los mata en silencio, y apagarlos a propósito para ahorrar crédito borra el disparador de cualquier reinicio programado. Toda pausa con reinicio se programa con CronCreate, no escribiéndola en un archivo"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
---

Los tres crones de la sesión PLANIFICACIÓN (parálisis · vigía · ociosas) son **session-only**: viven
en memoria del proceso, no en disco, y **mueren cuando la sesión muere**. Sobreviven a
`--continue`/`--resume`, pero **no** a una sesión nueva. El 2026-08-12 se acabaron los créditos, la
sesión cayó, y con ella se apagó toda la vigilancia — **sin que ninguna alarma sonara**, porque el
único que podía avisar era el que se murió.

**Por qué importa:** es el mismo defecto que la ronda de auditorías encontró tres veces en sus
propios instrumentos ([[el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino]],
[[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]]): **el monitor no se monitorea a
sí mismo**, y su silencio es indistinguible de "todo en orden". Peor acá, porque un corte por
créditos afecta a **todas** las sesiones a la vez: las tres se caen y no queda nadie que note la
ausencia. El costo no es el rato sin vigilar — es que al volver uno retoma el hilo que dejó, no el
que cambió mientras no estaba.

## El caso converso, y salió más caro: apagarlos A PROPÓSITO borra el disparador del reinicio

**2026-09-29 — 5 h 30 de las CUATRO sesiones.** La sesión estaba al 75 % de créditos y el operador
ordenó parar 1 h 45 y reiniciar a las 13:00. Razoné que los crones eran la mayor fuga —cada 3 min ×
4 sesiones × 1 h 45 ≈ 140 turnos que no producen nada—, los apagué, **ordené a las otras tres
apagarlos también**, y dejé el reinicio escrito en un `avance_` y en un `urgente_` del buzón.

A las 16:49 el operador preguntó por qué nadie había arrancado. `main` seguía en el SHA de las 11:16.
Tres PR quedaron abiertos sin mergear.

**La causa no es disciplina, es mecánica: una sesión no puede despertarse sola sin un cron.** El cron
no era sólo el vigilante — era **el único reloj**. Al apagarlo, el «reinicio 13:00» pasó a depender de
que un humano escribiera algo, que es exactamente lo contrario de operación autónoma. Un `CronCreate`
con `0 13 * * *` y `recurring: false` habría disparado, y costaba **un** turno.

> Es [[atar-la-accion-a-un-momento-no-a-un-estado]] dado vuelta: até la acción a un momento **y
> desmantelé el reloj**. Escribir la hora en un archivo se *siente* como programarla; no lo es.
> Un archivo no dispara nada.

**Y la trampa del ahorro:** el cálculo de crédito era correcto y la decisión igual estuvo mal, porque
comparé el costo de los crones contra cero en vez de contra **el costo de no arrancar**. 140 turnos de
cron son baratísimos al lado de 5 h 30 × 4 sesiones de silencio. Cuando se apaga un mecanismo para
ahorrar, la pregunta no es «cuánto gasta» sino **«qué más hacía, además de lo que me molesta»**.

**El control, ya horneado:** el cron de sesiones ociosas abre ahora con `ListAgents` — **una sesión
`idle` con cola pendiente NO es ocio legítimo**, es una que nunca arrancó, y se despierta con
`SendMessage` directo en el mismo ciclo. El buzón no despierta a nadie: es un buzón. Corolario de
[[mensaje-entregado-donde-nadie-mira]] — una orden con hora, entregada a una sesión que no va a leer
nada hasta que alguien la interpele, **no fue entregada**.

**Regla dura:** toda pausa con reinicio programado se programa con `CronCreate`, no con prosa. Si hay
que apagar los crones de vigilancia, se apagan **después** de crear el one-shot del reinicio, y ese
one-shot es lo último que se borra.

**Cómo aplicarlo:** al reanudar después de **cualquier** corte —créditos, cierre, crash— `CronList`
es parte del arranque, **antes** de retomar la tarea. Si devuelve `No scheduled jobs`, la vigilancia
estuvo muerta todo el intervalo: re-armar con `/monitoreo` (los prompts canónicos viven en
`scripts/crones/monitoreo-cron{1,2,3}.md`, no en la cabeza) y **correr
`bash scripts/vigilancia-check.sh --quiet` una vez a mano** para cubrir el hueco, porque el primer
cron recién dispara minutos después. Los recurrentes además **auto-expiran a los 7 días**. Vale para
las cuatro sesiones, no sólo planificación.
