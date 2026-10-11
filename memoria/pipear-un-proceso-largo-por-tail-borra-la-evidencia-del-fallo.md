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

## Refuerzo 2026-10-06 — «0 bytes ≠ colgado» **no** significa «0 bytes = trabajando». Significa *sin información*

Pusheé una rama con `git push … 2>&1 | tail -8`. La llamada pasó a background, el archivo de salida
quedó en **0 bytes**, y ahí apliqué mal mi propia regla: leí los 0 bytes como «sigue trabajando,
buffereado». Esperé ~15 minutos, y después salí a buscar contención de locks y procesos zombie.

**No había nada corriendo.** El proceso se había muerto sin flushear: `tail` se come la salida de un
proceso que no termina de forma ordenada, así que **murió sin dejar una sola línea**. Lo rehice
escribiendo a un archivo completo, sin pipe: **tardó 10 segundos** (`11:55:25 → 11:55:35`), gitleaks
limpio, ref creado. O sea el pipe convirtió una operación de **10 s** en un cuelgue aparente de 15
minutos **y me empujó a un diagnóstico equivocado** (locks, backup del grafo) sobre un proceso
inexistente.

**El filo nuevo, y es sobre la regla vieja de esta misma entrada:** «0 bytes ≠ colgado» se me había
quedado como «0 bytes = está trabajando». Es lo contrario de lo que dice. **0 bytes a través de un pipe
no es un estado del proceso: es la ausencia de todo estado** — compatible con trabajando, muerto,
nunca-arrancado y bloqueado esperando stdin. Un dato que es compatible con todas las hipótesis no es
evidencia de ninguna.

**Lo único que decidió fue el EFECTO**, no la salida: `git ls-remote origin <ref>` — el ref no existía,
punto. Es la misma regla que ya está escrita para el exit code
([[git-push-puede-salir-exit-0-sin-haber-pusheado]]): **el control es el efecto.** Y acá se extiende:
cuando el canal de salida es el que está en duda, **ninguna lectura de ese canal puede resolver la
duda** — hay que preguntarle al sistema, no al log.

**Operativamente:** nunca `| tail` / `| head` sobre algo que pueda morir. Background ⇒ `>> archivo 2>&1`
**completo**, con `[inicio $(date)]` y `[exit=$?]` alrededor, y la verificación por efecto en la misma
llamada. El `[exit=…]` cuesta nada y es justo lo que faltó: su ausencia en el archivo habría dicho
«murió» en lugar de no decir nada.

---

## REFUERZO 2026-10-11 — reincidencia, y el segundo mecanismo que produce el MISMO vacío

Lo volví a hacer: `| tail -30` sobre una corrida de device de ~25 min que murió por `timeout`
(exit **124**). El archivo quedó con **una línea**: `=== exit: 124`. Veinticinco minutos de teléfono
y cero medición — el veredicto que la corrida iba a dar (si H-60 sobrevive con las animaciones
normales) no se obtuvo.

**El filo nuevo: el `tail` no fue el único mecanismo.** Había **dos**, y los dos dan vacío:

| mecanismo | qué hace |
|---|---|
| `\| tail -N` | descarta lo viejo: si el proceso muere, lo único que sobrevive es la cola — y la cola de un proceso matado es el mensaje del matador, no del proceso |
| **stdout con buffer** (Python sin `-u` a un pipe) | **no emite nada hasta terminar**: si nunca termina bien, el pipe nunca recibe. El `tail` no tiene qué descartar porque no llegó nada |

Juntos explican por qué el «mirá el log parcial» no funcionó mientras corría: no era que el
proceso no hablara, es que **el canal estaba cerrado en dos lugares a la vez**. Y por eso el `wc -l`
del log sirve de latido **solo con `-u`**; sin `-u`, 0 líneas es la ausencia de estado de la que ya
habla esta entrada, no una señal.

**La forma correcta, en una línea:** `python -I -u <script> ... > archivo 2>&1` — nunca por pipe,
`-u` siempre, y el `echo exit` **dentro del mismo comando**.

**Y la causa de la muerte fue mía, no del teléfono:** el modo nuevo que le agregué al instrumento
(`--animaciones=normales`) hacía `intentos = max(intentos, 12)` para **todas** las llamadas al árbol
de la UI, incluido un **polling** que llama con `intentos=2` a propósito y corre hasta 80 veces. Fundí
**esperar** con **insistir**, y eso convirtió una espera razonable en minutos de pausas: la corrida se
comió su propio timeout antes de medir. **Un modo nuevo de un instrumento necesita su COSTO medido
antes de embarcarlo**, no sólo su corrección — la variante barata (pausa corta, intentos los decide
quien llama) hace exactamente lo mismo.
