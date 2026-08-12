---
name: pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo
description: "Un gate/deploy largo lanzado en background con la salida pipeada a `tail -N` pierde el texto del fallo; hay que redirigir el log COMPLETO a archivo"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
---

Un proceso largo (gate, deploy, suite) lanzado en background **nunca se pipea por `tail -N`**: se
redirige entero a un archivo (`> log.txt 2>&1`) y después se lee el pedazo que interese.

**Por qué importa:** `tail` sólo conserva las últimas N líneas, y en un gate de 5 jobs el fallo del
job 3 queda sepultado bajo la salida de los jobs 4 y 5. Pasó el 2026-08-12 con `gate.sh` en C4.1: el
job `mobile` dio rojo, el `tail -40` se comió el nombre del `it` y su stack, y la corrida siguiente
en verde dejó la aparición del flake **sin evidencia utilizable** — sólo "falló una vez". Un
instrumento que no guarda la evidencia hace que **la corrida verde borre a la roja**, y la deuda se
cierra sola sin haberse resuelto. Misma familia que
[[instrumentos-que-confirman-en-vez-de-verificar]].

Segundo efecto, más sutil: `tail` **buffea hasta EOF**, así que mientras el proceso corre el archivo
de salida se ve **vacío** y no se puede seguir el avance. Con redirección directa se puede hacer
`tail -N` del archivo en cualquier momento para ver dónde va.

**Cómo aplicarlo:** `bash scripts/gate.sh > "$SCRATCHPAD/gate-<sha>.log" 2>&1` con
`run_in_background`. Para inspeccionar durante o después: `grep -n "==> \[" <log>` para el resumen
por job, `tail`/`grep` del archivo para el detalle. Si un job da rojo, **leer y citar el texto del
fallo antes de re-correr nada** — re-correr primero destruye el único dato que discrimina flake de
regresión ([[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]]).
