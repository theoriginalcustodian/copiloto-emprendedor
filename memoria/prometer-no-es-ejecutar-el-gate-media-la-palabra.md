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

**Refuerzo 2026-10-06 — la forma de buzón de este mismo principio (norma que adopté de auditoría):**
**un artefacto ejecutable dentro de un `contrato_` o un `cierre_` lo corre QUIEN LO ESCRIBE**, contra
el **binario y la versión que fija el consumidor** — no quien lo recibe.

Pagado dos veces el mismo día: (1) una receta para una regla de gitleaks usaba un *lookahead*
`(?!\$)`, que **hace panic** en gitleaks (Go/RE2, `MustCompile`) — el emisor nunca la corrió, y sólo
no llegó al consumidor porque su implementación independiente no usó lookahead; (2) un `contrato_`
mandó a correr un script que, leído completo, **escribía en prod**, contra un límite de «cero
escrituras» del mismo contrato.

🔑 **Por qué la variante del binario importa:** una regex que funciona en Python o en `grep -P`
**no dice nada** sobre RE2. «Lo probé» sin nombrar el binario es la misma promesa sin ejecución que
mide esta entrada. → [[el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional]] · [[no-era-que-no-cazaba-el-patron-era-que-no-lo-cazaba-en-su-forma-real]]

---

## Variante 2026-10-07: el **rótulo escrito antes de la medición**, y el parche que no se aplicó

Encadené, en una sola corrida: un script de parche que abortó (`ABORT: ancla aparece 0 veces`), y
enseguida un `echo "=== autotest CON el canario adentro ==="` seguido de la corrida del script. Salió
**verde**. Leído de arriba abajo decía *«el canario está adentro y pasa»*. La verdad era
*«el canario no se aplicó, y corrí el archivo sin modificar»*.

**Por qué no se nota:** el rótulo es una **afirmación de estado** escrita antes de que el estado exista,
y el verde de abajo la confirma — pero mide **otro archivo** (el original). Un parche que no se aplica
no deja síntoma: el archivo sigue funcionando, porque sigue siendo el de antes.

**La causa mecánica, específica de este harness:** dentro de un heredoc `<<'PY'`, `\` **colapsa a `\`**.
Un ancla de `str.replace` que contenga `\n` llega al Python como un **newline real**, mientras el archivo
tiene los dos caracteres `\` + `n` ⇒ **0 coincidencias**. Lo que me salvó fue el
`if s.count(ancla) != 1: sys.exit(...)`: un `replace()` pelado habría escrito el archivo **idéntico** y
el rótulo habría sido la única evidencia.

**How to apply:** (1) todo script de parche aborta si el ancla no aparece **exactamente una vez** — nunca
`replace()` a ciegas; (2) el paso siguiente no es correr el programa, es **verificar en el archivo** que
el cambio está (`grep -c <símbolo nuevo>` + `ast.parse`), y recién después medir; (3) para anclar texto
con backslashes, no uses el literal: operá **por líneas** y buscá un substring sin escapes.
