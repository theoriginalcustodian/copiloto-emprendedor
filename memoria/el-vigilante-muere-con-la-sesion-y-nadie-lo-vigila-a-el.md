---
name: el-vigilante-muere-con-la-sesion-y-nadie-lo-vigila-a-el
description: "Los crones de vigilancia son session-only; un corte de créditos los mata y la parálisis deja de medirse sin que ninguna alarma suene. CronList es parte del arranque"
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

**Cómo aplicarlo:** al reanudar después de **cualquier** corte —créditos, cierre, crash— `CronList`
es parte del arranque, **antes** de retomar la tarea. Si devuelve `No scheduled jobs`, la vigilancia
estuvo muerta todo el intervalo: re-armar con `/monitoreo` (los prompts canónicos viven en
`scripts/crones/monitoreo-cron{1,2,3}.md`, no en la cabeza) y **correr
`bash scripts/vigilancia-check.sh --quiet` una vez a mano** para cubrir el hueco, porque el primer
cron recién dispara minutos después. Los recurrentes además **auto-expiran a los 7 días**. Vale para
las cuatro sesiones, no sólo planificación.
