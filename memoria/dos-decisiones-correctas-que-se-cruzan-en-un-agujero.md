# 🔀🕳️ Dos decisiones correctas por separado que en la INTERSECCIÓN abren un agujero

**Fecha:** 2026-08-02 · **Dónde:** `apps/copiloto/autosanacion_gates.py`, `autosanacion_workflow.py`

## El caso

El mismo día se agregaron dos banderas al `Decision` del gate de autosanación, cada una con su
razón, y **por separado las dos eran correctas**:

| Bandera | Regla | Por qué |
|---|---|---|
| `reintentable=False` | "descartá lo permanente" | el canario rechazado volvía a `pendiente` y se re-tomaba en CADA corrida — el vigilante tapaba la cola del sistema que vigila |
| `necesita_humano=False` | "no avises de lo que no es accionable" | un issue por cada rechazo operativo (kill switch, tope diario) es ruido, y un canal que grita en el caso normal se termina ignorando |

Juntas producen el **peor resultado posible** en la casilla donde se cruzan: un trauma con
`reintentable=False` **y** `necesita_humano=False` se cierra **y** nadie se entera nunca. Antes de
las dos "mejoras", ese mismo error al menos quedaba `pendiente` — visible para quien mirara.

El caso real que cayó ahí: un trauma **sin `archivo:línea`**. Se rechaza en la activity *antes* de
mirar la categoría, así que ni siquiera llegaba a `puede_reparar`. Se descartaba en silencio.

## Por qué ningún test lo vio

**Cada test miraba UNA bandera.** Había cobertura de "lo permanente se descarta" y cobertura de "lo
operativo no abre issue", ambas verdes, ambas diciendo la verdad. El agujero no está en ninguna de
las dos: está en el **producto cartesiano** de sus valores, que no era el sujeto de ningún test.

Lo destapó un E2E en el VPS, no la suite.

## La regla

> Cuando agregues una segunda bandera/flag/modo que se combina con uno existente, el sujeto del test
> no es la bandera nueva: es la **matriz**. Preguntá qué significa cada celda — sobre todo la que
> nadie pidió.

Test concreto que lo cubre, y la forma que lo hace resistente:
`tests/test_issue_de_trauma.py::test_INVARIANTE_lo_unico_que_se_descarta_SIN_avisar_es_el_canario`.
Recorre los casos y afirma que la combinación `(no reintentable, no necesita humano)` **sólo** es
legítima para el canario — más un **control positivo** de que esa excepción existe de verdad, porque
si ningún caso llegara a esa rama el bucle pasaría sin ejercitarla y el invariante sería un
`assert True` con forma de invariante ([[instrumento-que-no-mira-nunca-falla]]).

## Cómo se detecta antes

No es "escribir más tests": es notar el momento. **Dos cambios independientes al mismo objeto de
decisión, en la misma sesión** es el disparador. Ahí la pregunta no es "¿anda cada uno?" sino
**"¿qué pasa cuando los dos aplican al mismo caso?"** — y hay que enumerar las celdas a mano, porque
ninguna de las dos historias de usuario menciona la otra.

Hermana temporal de [[el-fix-ya-existe-en-otro-call-site]]: allá el defecto es no propagar un fix
conocido; acá es no mirar la casilla que dos fixes correctos crean entre ambos.

Relacionadas: [[el-guard-que-caza-a-su-propio-autor]] · [[no-romper-no-es-arreglar]] ·
[[el-canario-el-control-positivo-de-lo-que-falla-callado]]
