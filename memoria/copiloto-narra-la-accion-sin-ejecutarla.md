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

## v2 VERDE (PR#91, 2026-07-23) — guardrail + cura estructural, DoD sustancialmente cerrado

Escalado como MAYOR al operador (dos raíces enredadas: B=`tool_choice="auto"` no obliga, A=el historial
descarta los `tool_calls`). Autorizado v2 = las dos, no una:

- **Parte 1 (guardrail, deuda GESTIONADA — `TODO(narra-guardrail)`)**: si el turno cierra con
  `tool_calls=[]` Y el texto usa una palabra de cierre EXACTA (set cerrado, no prefijos — "aprob" como
  prefijo matchea "¿aprobás?", una pregunta legítima; se usan formas completas: "aprobado", no "aprob*"),
  se rechaza y se re-pregunta UNA vez con `tool_choice="required"`. Scopeado por `not trace`: un cierre
  "Listo..." tras una tool que SÍ ejecutó ESE turno es honesto, no dispara nada (gap real cazado por los
  tests: sin este guard, el propio texto de éxito de PR#88 — "Te armé un borrador" — dispararía sobre sí
  mismo si empezara con "Listo").
- **Parte 2 (la cura, la raíz)**: nuevo `self._react_transcript`, durable y paralelo a `self._history`,
  con el shape NATIVO de OpenAI (`role:'assistant', tool_calls:[...]` / `role:'tool'`) en vez de texto
  plano. Reemplaza a `self._history` como fuente de `messages` en cada turno react — el modelo ve la
  MISMA evidencia estructural que ya atiende dentro de un turno, no un relato de texto que podía imitar
  sin llamar nada. `self._history` sigue existiendo intacto (memoria/Graphity); el marcador de PR#85
  queda en el código, vestigial pero inofensivo.

Ambos versionados con `workflow.patched()` (ids nuevos). De-risk con `Replayer.replay_workflow` contra
el history REAL de `e2e-device` (predata los patches) — cero no-determinismo. 979 tests verdes.

**Retest en SESIÓN LIMPIA (Parte 3 del plan): se TERMINÓ el workflow durable de `e2e-device`** (el
`self._history`/`self._react_transcript` viejo estaba contaminado con los "Anoté..." de PR#85/#88 —
[[conversacion-permanente-continue-as-new]] no lo limpia solo) y se arrancó fresco con el MISMO
workflow_id (`ALLOW_DUPLICATE` por default de Temporal permite re-arrancar un id TERMINATED). Mismo
guion adversarial, 3 gastos:

**3/3 turnos ejecutaron `registrar_gasto` de VERDAD** — confirmado en la fuente cruda del Temporal
workflow history (`execute_tool` SCHEDULED con `name:"registrar_gasto"` en los 3 turnos, montos
151/252/353) — y los 3 cerraron con el MISMO texto honesto: *"Esto entendí. Revisalo y tocá Guardar —
todavía no lo anoté."* Cero llamadas extra a `call_llm_tools` (el guardrail nunca tuvo que disparar:
el modelo se comportó bien desde el principio con la evidencia estructural real). Bonus: en el turno 1
el copiloto preguntó de motu proprio *"el monto es muy bajo... ¿seguís adelante?"* — una aclaración
legítima con `tool_calls=[]` que NO usa ninguna palabra de cierre y, en efecto, no disparó el guardrail
— validación en vivo del caso de control que el DoD pedía.

**DoD**: criterio 1 (ningún turno confirma sin haber ejecutado) — **VERDE, 3/3**. Criterio 2 tal cual
estaba escrito ("los gastos existen en `GET /gastos`") no aplica literalmente a `registrar_gasto`: es
un tool que PROPONE, no persiste (`_FIRST_CLASS_WRITES`) — el oráculo HTTP confirma correctamente que
NINGUNO de los 3 se guardó (nadie tocó "Guardar" en el device), que es el comportamiento CORRECTO de
este tool, no una falla. Criterio 3 (control, aclaración legítima no dispara) — **VERDE**, observado en
vivo sin necesidad de forzarlo. Reportado a planificación como sustancialmente cerrado.

## ✅ CERRADO (2026-07-29) — 0/10 contra el LLM real, y el flag levantado

**No re-abrir sin evidencia nueva.** Dos cosas pasaron entre el v2 y el cierre:

1. **Se tapó un hueco DENTRO del guardrail** (ítem 0.5a, `2a731c7` y anteriores): `trace.append()`
   metía la tool al trace para cualquier status `!= "needs_confirmation"`, **incluido `"error"`** →
   una tool que **falló** desactivaba la re-pregunta y habilitaba el cierre *"Listo"*. Versionado con
   `workflow.patched("trace-solo-cuenta-tools-ok")`, en los dos sitios (incluido el reingreso
   `confirm`, que un revisor adversarial encontró sin test).
2. **Se midió la cura contra un LLM real, no guionado.** `scripts/retest_narra_sin_hacer.py --rondas 10`,
   10 **sesiones limpias** distintas, usuario canónico, comparando lo que el texto afirma contra los
   `execute_tool` completados en el history de Temporal: **`0 mentiras · 0 rondas sin medir · 10
   intentadas`**. Contrasta con el **3/3** del spike original.

**Consecuencia de producto:** el flag `MODO_AUTOMATICO_NO_DISPONIBLE` —que bloqueaba el modo
automático, donde este fallo sería **invisible** por no haber card que falte— **se retiró** (PR #159).
Verificado por efecto en prod: `POST /perfil-negocio` con `modo_ceremonia: automatico` → **200**;
control con modo inexistente → **400**.

⚠️ **El guardrail sigue en el código como deuda gestionada** (`TODO(narra-guardrail)`): la cura es
`react_transcript`, el guardrail es el cinturón. Que 10/10 salgan limpias no prueba que el modelo no
pueda narrar nunca — prueba que con la evidencia estructural **no lo hace en las condiciones medidas**.

**Y el retest mismo dejó la lección más cara del frente:** el script dio **tres veredictos distintos
sobre la misma realidad** antes de medir bien (v1 ✅ sin medir nada, v2 🔴 con un contador que nunca
contaba). Ver [[el-instrumento-tambien-CONDENA-no-solo-absuelve]]. Procedimiento y resultado:
`docs/copiloto-emprendedor/Manejo de errores/02-RETEST-modo-automatico.md`.

[[instrumentos-que-confirman-en-vez-de-verificar]] [[vacio-no-es-hallazgo-correr-el-control]]
[[conversacion-permanente-continue-as-new]] [[copiloto-motor-react-concatenadas]]
[[el-instrumento-tambien-CONDENA-no-solo-absuelve]]
