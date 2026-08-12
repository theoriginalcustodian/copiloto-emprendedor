---
name: el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino
description: "Un vigía que mide antigüedad sólo juzga a quien alguna vez apareció; el ausente total tiene mtime 0 y pasa por el continue. Se detecta contra la expectativa, no contra el reloj"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-08-12T16:26:59.589Z
---

Todo watchdog que mide **antigüedad** (*"hace cuánto que no escribe"*) sólo puede juzgar a quien
**escribió alguna vez**. El que nunca apareció tiene señal cero, y cero no es "viejo": se cuela por
el `continue` de "sin datos, no alarmo". El vigía detecta al que **llega tarde** y es ciego al que
**no vino** — que es el caso peor.

La forma de arreglarlo no es bajar el umbral: es **comparar contra la expectativa**, no contra el
reloj. La expectativa suele estar ya codificada en el estado del sistema (acá: un
`contrato_…-a-<rol>_` en el buzón). Criterio relacional, sin número que calibrar: *¿la tarea es más
nueva que la última señal de vida de su destinatario?* Si lo es, nadie estuvo vivo para leerla.

**Why:** el 2026-08-12, en modo autónomo sin operador, C4.1 —el P0 que bloqueaba la beta— se
contrató 11:57 y a las 13:40 seguía sin dueño porque **la sesión de backend nunca existió**.
`vigilancia-check --quiet` devolvió exit 0 *"sin novedades"* durante ~100 minutos y le creí varias
veces. La línea culpable estaba escrita literal en el script: `[ "$mt" -eq 0 ] && continue`. Peor:
auditoría corría desde su propio worktree, así que su transcript ni vivía en el slug vigilado —
invisible **por construcción**, no por antigüedad.

**How to apply:** (1) ante cualquier gancho de vigilancia, preguntar **"¿qué pasa si el sujeto no
existe?"** — si la respuesta es "no alarma", es fail-open. (2) Derivar la lista de quién *debería*
estar de un estado real y vivo (contratos abiertos, cola asignada), nunca de una lista hardcodeada:
así el silencio absoluto sigue siendo legítimo cuando de verdad no se espera a nadie. (3) Buscar la
señal de vida en el **producto de trabajo** (lo que el rol escribió) antes que en el latido
(mtime del transcript): el latido depende del rótulo del cron y se renueva solo; el producto no
miente. El primer intento de este fix usó sólo transcripts y acusó en falso a una sesión que estaba
trabajando pero sin marcador de cron — y un vigía que grita de más se apaga solo en una semana.
(4) Control negativo obligatorio: revertir el fix y verificar que el test **reproduce el silencio**.

Relacionado: [[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]] ·
[[deteccion-de-paralisis-sin-resolucion-es-ocio-pasivo]] · [[no-romper-no-es-arreglar]]
