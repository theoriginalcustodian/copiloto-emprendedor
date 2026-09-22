---
name: un-instrumento-tiene-dos-modos-de-no-saber-callarse-e-inundar
description: "Buscar sólo el silencio de un instrumento deja pasar la otra mitad: la medición fallida que vuelve como número absurdo y hace escalar todo"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-21T18:39:41.719Z
---

Un instrumento que no pudo medir tiene **dos** formas de disfrazar el no-saber de dato, y son
simétricas. Arreglar una sola deja el agujero abierto.

1. **Se calla.** `edad="$(medir "$f")"` con el fork caído vuelve vacío; el
   `[ "$edad" -ge "$UMBRAL" ] || continue` trata el error de bash («integer expression expected»)
   igual que «todavía es joven» y saltea el archivo. Con la racha alcanzando a todos, el script
   termina con `alarma=0` y dice «nada que escalar». **Un contrato abandonado y un escalador que no
   pudo mirarlo producen el mismo silencio.**
2. **Inunda.** Si el fallo cae *adentro* (`stat` sale 0 sin imprimir), no hay error ninguno: en
   aritmética de bash **una variable vacía vale 0**, así que `(now - 0) / 60` da 29.833.587 minutos.
   Todo cruza cualquier umbral a la vez.

El segundo modo apareció **al escribir el test del primero**, no antes: el shim de `stat` no produjo
el silencio esperado sino una edad absurda. Sin ese test, el fix habría quedado a medias y verde.

**How to apply:** cuando arregles un instrumento que se calla, escribí el test y **mirá la salida
cruda del caso simulado antes de dar por buena tu hipótesis del fallo** — la forma real del síntoma
rara vez es la que asumiste. Y en bash, toda medición que va a entrar en aritmética o en un `-ge`
se valida como entero primero (`[[ "$x" =~ ^[0-9]+$ ]]`); devolver vacío y dejar que el llamador lo
cuente como fallo es lo único cierto que se puede decir.

Aparte del guard, un instrumento compuesto necesita un **centinela de terminación**: una última
línea fija que el consumidor exige. El guard cubre la medición que vuelve mal; el centinela cubre
que el proceso **muera a mitad**, donde no hay contador que salvar y un reporte parcial sin alarmas
es idéntico a «no hay nada». Medido el 2026-09-21 en `scripts/escaladores-buzon.sh` +
`scripts/vigilancia-check.sh` (PR #565, 14 casos de test).

Familia: [[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino]] ·
[[una-allowlist-manual-no-puede-saber-lo-que-le-falta]] ·
[[un-fixture-no-aisla-lo-que-el-script-lee-por-fuera]].
