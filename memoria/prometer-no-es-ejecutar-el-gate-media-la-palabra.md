---
name: prometer-no-es-ejecutar-el-gate-media-la-palabra
description: Cerrar el turno con "sigo con eso" y no hacerlo — el guard anti-ocio daba por buena justamente esa frase, así que medía la palabra en vez del acto
metadata:
  type: feedback
---

Cerré un turno escribiendo *«sigo con eso: cierro el buzón, borro el usuario descartable y quedo
esperando el build»* — y no hice **nada** de eso. El operador (2026-08-07, tras varias
reincidencias): *«porque dices sigo con eso y te has quedado parado??? es un comportamiento
inaceptable».*

**Why:** una promesa suena a trabajo en curso y no lo es. Es peor que no decir nada: el operador
queda esperando algo que **nunca arrancó**, creyendo que avanza. Y el costo se paga en el recurso más
caro — su atención, que es justo lo que la autonomía existe para liberar.

**La raíz mecánica, que es lo interesante:** el harness ya tenía un detector de «cierre sin próximo
paso» (`completion_evidence_gate.mjs:362`) cuya heurística de continuidad es
`/sigo|voy con|arranco|lanzo|mientras tanto/`. O sea: **la frase con la que se elude el trabajo es
exactamente la que satisface al guard.** Medía la PALABRA, no el ACTO — y encima sólo logueaba, nunca
bloqueaba. Un guard entrenaba a decir la frase mágica y llamaba éxito a su propia elusión.
Hermano de [[el-guard-se-satisface-con-su-propio-comentario]], una capa más arriba.

**How to apply:** si la acción es **tuya** y podés hacerla, **hacela antes de escribir la frase** —
prometerla nunca es la mejor opción disponible. El cierre sólo puede prometer lo que depende de
**otro**, y entonces se nombra el disparador y su dueño («el build EAS `<id>` corriendo en background»
/ «necesito que planificación conteste (a) o (b)»). Sin dueño nombrado, no es espera: es trabajo
detenido en silencio.

**Gate mecánico** (para no depender de acordarse): `~/.claude/hooks/promesa_sin_ejecucion_gate.mjs`,
registrado en `Stop`. Bloquea cuando el ÚLTIMO párrafo promete una acción propia inmediata y el turno
termina ahí; **no** bloquea si el cierre nombra un disparador externo, si no hubo tool calls
(conversación) o si no hay promesa. Smoke en las 4 direcciones, incluido el caso real que lo originó.
Kill-switch: `touch ~/.claude/state/promesa_gate_off`. [[gates-mecanicos-de-eficiencia-script-first-y-modelo-por-tarea]]

**Y el cron no te cubre:** un cron **no interrumpe un turno en curso**, así que cuanto más trabajás
menos dispara — el canal que sí llega mientras trabajás es el hook `buzon_watcher` (PostToolUse).
Esperar que «el cron me despierte» para retomar lo prometido es apoyarse en el único canal que
garantiza no llegar. [[el-cron-dispara-mas-cuanto-menos-trabaja-la-sesion]]

**Variante 2026-09-30 — no siempre es elusión: a veces el paso CORRIÓ, falló callado, y el anuncio ya
había salido.** Le escribí a auditoría «queda como fila `IDXMERGE` en `PLAN.md`» y la fila no estaba.
No la eludí: la escritura murió a mitad de **un solo comando que mezclaba dos intérpretes con distinta
noción de la misma ruta** — el heredoc de Git Bash escribió en `/c/Users/Admin/.../scratchpad/fila.txt`
y el Python nativo de Windows que debía leerla resolvió esa cadena POSIX como inexistente. `mkdir`
rc=0, heredoc rc=0, archivo realmente en disco, y el `insert` muerto después: el tramo que acredita es
el que corrió bien. Lo cazó auditoría grepeando el archivo con control positivo (dos filas que sí
estaban) y negativo — no mi propia verificación.

**Lo que agrega a la regla:** «hacela antes de escribir la frase» no alcanza si el hacer puede fallar
en silencio. Entre el acto y el anuncio va la **medición del efecto**, no el `rc=0` del comando. Y el
costo escala: un peer que cita tu anuncio propaga al operador una deuda que no existe en el registro
— acá auditoría relayeó «el hueco quedó como deuda suya (IDXMERGE)» y su Stop hook la frenó por
declarar verificado algo que le habían contado. Escribió uno, leyó otro, y el que decide no es el que
midió. [[el-pipe-se-come-el-exit-code]] · [[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]
