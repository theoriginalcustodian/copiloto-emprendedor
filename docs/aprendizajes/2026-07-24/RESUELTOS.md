# Implementados el 2026-07-24

Aprendizajes del sprint **IN + mobile-first** que se resolvieron **en el momento**, sin pasar por la
cola. Registro completo de la captura: `coordinacion/APRENDIZAJES-SPRINT.md` del sprint.

> Que estén acá no significa "anotados": significa que el gancho existe y se probó. La columna
> **enganche** dice cuál, y dónde.

| # | Qué se aprendió | Nivel | Enganche construido |
|---|---|---|---|
| 1 | Rotular sesiones por su **nombre autodeclarado** empataba y una quedaba nombrada por descarte — un rótulo por descarte no falla, **confirma** | 1 | Identidad por el prompt del cron que la ventana **recibe**, no por lo que dice de sí · PR #118 |
| 2 | Rotular por **conducta** (paths tocados) tampoco: una sesión que *lee* el buzón pasa por planificación. La conducta describe la tarea, no la identidad | 1 | ídem · PR #118 |
| 3 | La métrica de "producción" contaba sólo `Write/Edit`: la **fase de cierre** de un hito (tests, commit, push, `adb`) se veía como ocio y gritó `GIRA EN VACÍO` sobre la sesión que estaba cerrando | 1 | `CMD_PRODUCTIVO` cuenta el Bash que muta o verifica · `scripts/no-ocio-check.sh` |
| 4 | Reporté "trabajando, 0 min" durante varios ciclos mientras la sesión repetía la misma línea: **miré la hora, no la acción** — el instrumento traía las dos columnas | 2 | Regla en el prompt del monitor: comparar la acción contra el ciclo anterior |
| 5 | Seis errores seguidos del mismo sensor **no eran bugs del script**: era la regla que ordenaba consultarlo primero y prohibía afirmar sin él. Arreglar el instrumento sin tocar el procedimiento produce una versión más pulida de la misma inferencia | 1 | El **log crudo** pasa a ser el instrumento obligatorio; el sensor queda subordinado · `scripts/ultimas-acciones.sh`, PR #118 |
| 6 | Un `urgente_` se entregó **dos veces** y la sesión siguió 20 min. No falló la entrega (8 bloques en su transcript): falló que un bloque **uniforme** dentro de un tool result no interrumpe | 1 | Bloque `priority="max"` estructuralmente distinto para `urgente_`/`contrato_` · `~/.claude/hooks/buzon_watcher.mjs` |
| 7 | La sesión que falló **no puede diagnosticar el canal desde adentro**: su evidencia es «no lo vi», igualmente compatible con «no llegó» y «llegó y no lo procesé». Su relato es testimonio, no medición | 2 | Contrastar contra el transcript **antes** de rediseñar un canal |
| 8 | `buzon_watcher` es `PostToolUse`: al **reanudar** tras un compact, el modelo arma su plan antes de la primera tool call — el hook todavía no habló. Ése era el hueco exacto | 1 | `~/.claude/hooks/buzon_al_reanudar.mjs` (`SessionStart`), smoke 4/4 con 2 controles negativos |
| 9 | Le di a la auditoría un encuadre falso y auditó una premisa que no existe. **El error estuvo en el prompt, no en el auditor** | 3 | Modo de fallo nº 8 del bucle canónico |

**Lo que este día dejó abierto** está en [`../pendientes/`](../pendientes/) — cuatro ganchos, todos de
nivel 1.
