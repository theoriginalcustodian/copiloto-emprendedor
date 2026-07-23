---
name: copiloto-narra-la-accion-sin-ejecutarla
description: El copiloto dice «listo, ya lo marqué» sin haber llamado la tool — el historial que siembra el turno siguiente descarta los tool_calls y el modelo imita su propio texto
metadata:
  type: project
---

**LEER cuando una tool «no funciona» pero el copiloto contesta que sí.** El síntoma no es un error:
es una confirmación en voz alta de algo que no pasó.

## Qué se midió (2026-07-22, E2E de voz del hito 3)

Cinco turnos contra el copiloto vivo, mismo usuario, misma sesión:

| # | Se dictó | Qué hizo |
|---|---|---|
| 1 | «Me pagaron 85 mil» | **ejecutó** `registrar_ingreso` ✅ |
| 2 | «Fue de la Panadería, en efectivo» | **ejecutó** `completar_ingreso` ✅ |
| 3 | una pregunta cualquiera | nada ✅ |
| 4 | «Me pagaron 85 mil de la Panadería» | *«Listo, ya marqué el pago»* — **no había ninguna factura impaga**, así que la tool habría dicho *«no encontré»*. Narró. |
| 5 | «Me aprobaron el presupuesto de la panadería» | *«He marcado como aprobado el presupuesto»* — el estado en la base siguió en `pendiente`. Narró. |

**Los primeros turnos ejecutan; los últimos narran.** Y el error es de la peor clase disponible: no
hay excepción, no hay 500, la respuesta suena perfecta. El emprendedor se queda tranquilo con una
factura sin cobrar y un presupuesto que sigue figurando pendiente.

## La causa, leída en el código y no deducida

`motor/backend/agent/conversation_workflow.py:407` lo dice literal: el buffer de corto plazo que
siembra el turno siguiente lleva *«user/assistant en texto plano — NUNCA el scratchpad interno de
tool_calls»*. Y `:498` guarda sólo el texto final: `{"role": "assistant", "content": text}`.

Entonces, a partir del tercer o cuarto turno, el modelo ve un historial lleno de mensajes suyos que
dicen *«anoté el ingreso de $85.000»* **sin ningún `tool_call` al lado**. Por imitación de su propia
conversación aprende que **decir la frase ES hacer la acción** — y en la conversación que él ve, lo
es: no hay evidencia de otra cosa.

Es un problema del **motor**, transversal a TODAS las tools. No lo introdujeron las del hito 3: se
descubrió con ellas porque son las primeras cuyo efecto se puede verificar en una tabla propia
inmediatamente después. Con `gmail_send` el mismo fallo se lee como *«ya te lo mandé»* y nadie
revisa la bandeja de salida.

## Cómo se aisló (el método, que es reusable)

Tres instrumentos rotos antes de llegar al hallazgo, y los tres se leían como fallo del producto:

1. **El lector de `/reply` miraba `row["text"]`; la clave es `reply_text`.** Reportó «sin respuesta
   en el timeout» en cuatro turnos mientras las tools ejecutaban perfecto.
2. **El diferencial abrió la conexión sin `autocommit`.** Los `conn_factory` reales lo ponen en
   `True` (`worker_b.py:240`, `serve.py:97`), así que el `UPDATE` quedó sin commitear y el
   `detalle()` —otra conexión— leyó el valor viejo: parecía que `cambiar_estado` no escribía.
3. **El `journalctl` del worker no loguea tools**, así que el vacío no significaba «no se ejecutó».
   El control (`wc -l` del rango) mostró 7 líneas, todas de arranque.

Lo que finalmente decidió fue el **test diferencial con la configuración de producción**: correr la
tool sin LLM contra los mismos datos. Devolvió `'estado': 'aprobado'` → la tool funciona → lo que
falla está antes, en quién decide llamarla.

## Por qué NO se parcheó

Un renglón en el system prompt (*«nunca digas que hiciste algo sin ejecutar la herramienta»*) taparía
el síntoma sin tocar la causa, y dejaría el fallo latente para cada tool futura. La raíz es la forma
del historial, que viaja en el **estado durable** de una sesión permanente (continue-as-new): tocarla
es un cambio con implicancias de replay y de workflows en vuelo → **MAYOR, se escala**.

## v1 implementado (PR#85, 2026-07-23) — REDUCE el problema, NO lo cierra

De-risk (Replayer.replay_workflow contra CAN real) verde → operador autorizó → `_react_finish` apendea
un marcador determinístico (`[tool:nombre→ok]`) a `self._history` cuando el turno ejecutó ≥1 tool,
versionado con `workflow.patched("history-tool-trace-marker")` (replay-safe, sesiones en vuelo no
rompen). + línea en `SYSTEM_PROMPT_REACT` prohibiendo narrar sin `tool_result`. Deployado, 973 tests
verdes.

**Retest adversarial en device (mismo día, `e2e-device`, 3 gastos dictados seguidos): 2/2 turnos
POSTERIORES al primero siguieron narrando sin ejecutar** — verificado contra el **Temporal workflow
history** (no journalctl, que no loguea tools — [[vacio-no-es-hallazgo-correr-el-control]]): el turno 1
sí llamó `registrar_gasto` (evidencia real, marcador quedó en el historial); los turnos 2 y 3, con ESE
marcador ya presente, cerraron con `"tool_calls": []` y el texto *"Anoté el gasto de $222... revisalo y
confirmame"* — oráculo HTTP `GET /gastos` confirma que esos gastos NUNCA se crearon.

**Por qué el marcador no alcanza:** viaja como sufijo invisible-al-relato DESPUÉS del texto visible. El
LLM imita la FORMA del texto (`"Anoté el gasto de $X... revisalo"` — frase que el propio `registrar_gasto`
le sugirió decir la primera vez, con tool_call real detrás) sin necesariamente atender al marcador que la
acompaña. Es evidencia disponible para el modelo, no una restricción de la API (`tool_choice` sigue en
`"auto"`). Distinto del bug original (ahora SÍ hay evidencia auditable cuando el turno ejecuta), pero el
DoD — "el copiloto ya no confirma en voz alta sin haber ejecutado", medido con guion adversarial — sigue
en rojo. Detalle completo: `coordinacion/.../hallazgo_backend-a-planificacion_narra-sin-hacer-el-marcador-esta-vivo-pero-el-LLM-lo-esquiva-2-de-2.md`.

**Candidatos para una 2ª iteración (sin implementar, decisión pendiente):** forzar `tool_choice="required"`
cuando el turno anterior fue una pregunta de aclaración del propio copiloto (más agresivo, riesgo de
sobre-forzar en turnos que sí son solo aclaración) — o cambiar el texto que `registrar_gasto` le sugiere
al LLM ("Anoté" → algo que no suene a completado, ej. "Te armé el borrador") para que el precedente en
`self._history` deje de sonar a confirmación aunque el marcador se ignore.

## Spike (b) FALLÓ (PR#88, 2026-07-23) — texto honesto explícito, el LLM lo ignora igual

Planificación descartó el residual y autorizó spike (b): que `registrar_gasto`/`registrar_cliente`
prohíban el verbo explícitamente y entreguen la frase EXACTA a relayar (*"NO digas 'anoté', 'listo'
ni 'guardado' porque no es cierto. Decile exactamente: 'Te armé un borrador...'"*), en vez de la
instrucción en prosa anterior (*"decíselo en una línea corta"*). Tests verdes (929 passed), deployado
(`a471d66`).

**Retest adversarial (mismo guion, 3 gastos nuevos): 3/3 — PEOR que el 2/2 de PR#85.** Esta vez ni
siquiera el TURNO 1 ejecutó. Verificado en la fuente cruda, no en la UI: el payload decodificado del
`ActivityTaskCompleted` de `call_llm_tools` es `{"tool_calls":[], "content":"Anoté el gasto de $141 en
la categoría \"otros\"...revisalo y confirmame..."}` — el LLM usó **la palabra prohibida**, ignorando
la plantilla exacta que se le dio. Oráculo HTTP `GET /gastos` post-turnos: siguen los mismos 2 gastos
de antes de la sesión (`$111`, `$1234,56`) — $141/$242/$343 nunca existieron.

**Lo que esto prueba:** no es que el marcador no alcance (hipótesis de PR#85) — es que **el modelo no
obedece la instrucción textual de la tool en absoluto**, ni siquiera cuando es una plantilla literal
con verbo prohibido explícito. La superficie de control por texto (system prompt + observation) está
agotada: dos intentos independientes (prompt guardrail + marcador; texto honesto + plantilla exacta)
fallaron por la misma razón — texto no vinculante para `tool_choice="auto"`. Reportado a planificación
con evidencia completa; recomendación: escalar **(a) `tool_choice="required"`** (HOLD original) al
operador, con su tradeoff (riesgo de sobre-forzar en turnos de aclaración legítima).

**Contaminación detectada (aparte, documentado por transparencia):** la sesión es durable
(continue-as-new) y el `self._history` de este mismo usuario YA contenía los "Anoté...revisalo" del
retest de PR#85 (turnos $222/$333) antes de este spike — el precedente corrupto de un intento fallido
nunca se limpia solo. No se pudo determinar si esto influyó en el fallo 3/3, porque tampoco había forma
de aislar una sesión "limpia" con el usuario canónico único (regla dura, no se crean usuarios ad-hoc).
Si se escala a (a), vale la pena decidir si esta sesión de prueba debe reiniciarse aparte.

[[instrumentos-que-confirman-en-vez-de-verificar]] [[vacio-no-es-hallazgo-correr-el-control]]
[[conversacion-permanente-continue-as-new]] [[copiloto-motor-react-concatenadas]]
