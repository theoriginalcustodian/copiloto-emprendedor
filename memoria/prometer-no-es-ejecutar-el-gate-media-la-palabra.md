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
