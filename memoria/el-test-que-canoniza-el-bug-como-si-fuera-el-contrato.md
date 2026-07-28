---
name: el-test-que-canoniza-el-bug-como-si-fuera-el-contrato
description: Al arreglar una raíz, los tests que se ponen rojos pueden estar afirmando el bug — escritos desde la misma creencia que el código. Se ACTUALIZAN diciendo por qué cambió la expectativa; "arreglarlos" para que pasen reintroduce el fallo.
metadata:
  type: feedback
---

**LEER cada vez que un fix de raíz pone rojo un test que antes pasaba.**

2026-07-28, dos casos en la misma jornada:

| Test | Qué afirmaba | Por qué era el bug |
|---|---|---|
| `test_react_llm_non_retryable_error_fails_in_one_attempt` | `pytest.raises(WorkflowFailureError)` | Su propio docstring decía *"el workflow FALLA (nadie captura `ActivityError` en el loop react **hoy**)"*. Ese "hoy" era la descripción de un fallo, no un contrato: `ConversationWorkflow` es la sesión PERMANENTE, y morirse por un turno deja el chat aceptando mensajes sin contestar nunca |
| `test_el_workflow_termina_en_fallido_si_el_alta_falla` | `motivo == "handle_invalido_o_vencido"` | Afirmaba que el CÓDIGO CRUDO de la activity llegaba a la pantalla de Ajustes, que lo pinta sin traducir. El emprendedor leía un identificador de máquina |

**El reflejo peligroso** es tratarlos como daño colateral: "el fix rompió dos tests, los arreglo". Si
"arreglar" significa devolver la expectativa vieja, el fix se deshace y queda una suite verde
custodiando el fallo.

**Cómo distinguirlo en el momento.** Ante un test rojo tras un fix de raíz, preguntar: *¿esta
aserción describe lo que el sistema DEBE hacer, o lo que hacía?* Los indicios de que canoniza el bug:

- El docstring dice **"hoy"**, "por ahora", "nadie captura", "todavía no" — el autor sabía que
  describía un estado, no un contrato.
- La aserción es sobre un **valor interno que se filtra** (un código, un tipo de excepción) en vez de
  sobre lo que el usuario obtiene.
- Al leerla en voz alta suena a queja: *"el workflow tiene que fallar"*, *"el motivo tiene que ser
  `handle_invalido_o_vencido`"*.

**Qué hacer.** Actualizar la aserción **y dejar escrito en el test por qué cambió**, nombrando el
fallo viejo. Un `⚠️ Antes esto afirmaba X, y eso no era el contrato sino el defecto` cuesta tres
líneas y evita que el próximo lo revierta creyendo que arregla una regresión. Y conservar lo que el
test SÍ vigilaba bien: el de arriba seguía siendo valioso por "UN intento, no cinco" — eso no cambió.

Prima de [[el-mensaje-niega-el-efecto-que-ya-ocurrio]] (§"el test escrito desde la misma creencia que
el código lo confirma, no lo verifica") y de [[instrumentos-que-confirman-en-vez-de-verificar]].
