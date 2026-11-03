# SM-N20 (propuesta de raíz) — inventario: ¿por dónde llega un importe al usuario?

> **Medición, no implementación.** Pregunta: «los importes que ve el usuario no pasan por el LLM (card y reply
> armados por código)». Este doc cuenta dónde pasa hoy cada importe, qué se podría pasar a código sin tocar el
> contrato de las tools, qué exigiría cambiarlo, qué se pierde y cuánto cuesta. **La decisión es MAYOR: la toma el operador.**
> Fuente: lectura de `apps/copiloto/tool_catalog.py` y `motor/backend/agent/conversation_workflow.py` @ `922a2b07`.
> Instrumento: lectura de código + las sondas con LLM real de SM-H5 y SM-N20 (ver §5). **No** se corrió una sonda nueva.

## 1. El mecanismo (por qué el LLM toca los importes)

- Toda observación de una tool se serializa entera al modelo: `json.dumps(observation)` (`conversation_workflow.py:800`).
  El `reply_text` que ve el usuario lo **escribe el LLM** leyendo eso (`conversation_workflow.py:340`).
- Las tools que quieren una frase exacta la piden con «Decile exactamente: "…"» dentro de `observation["result"]`.
  Es una **instrucción en prosa**: el modelo puede reescribirla (medido: `$50,000.00`, `$70,000` en vez de `$70.000`).
- No existe hoy en el motor un camino «reply armado por código». Lo más cercano es `gate_card`/`card`
  (`conversation_workflow.py:441-696`), que re-empaqueta datos **para la card**, no para el texto del reply.
- Además de la frase, muchas observaciones llevan el **dict crudo** de la entidad (`"cobro"`, `"resumen"`,
  `"ingreso"`, `"presupuesto"`) con totales sin formato (`"50000.0000"`) al lado del texto formateado.

## 2. Inventario por sitio (`tool_catalog.py`)

| # | Tool | Línea | Importe llega al usuario por… | Estado del formato |
|---|---|---|---|---|
| 1 | `registrar_gasto` | 819, 822 | frase «Decile exactamente» relayada por el LLM | **CRUDO** `${gasto['monto']}` |
| 2 | `registrar_ingreso` | 1186, 1189 | ídem | **CRUDO** `${ingreso['monto']}` |
| 3 | `registrar_ingreso` (duplicado) | 1164 | prosa libre del LLM (pregunta «¿otro cobro o el mismo?») | `_plata` (`$50.000,00`) |
| 4 | `completar_ingreso` | 1239 (+ dict `ingreso`) | `result` + dict crudo | `_plata` + crudo al lado |
| 5 | `marcar_factura_cobrada` | 1297, 1300 (+ `cobro`, `resumen`) | `result` libre + dicts crudos | `_plata` + crudo al lado |
| 6 | `marcar_factura_cobrada` candidatos | 1283, 1287 | ramas ambiguas | `_plata_corta` ✔ (SM-N20, #1414) |
| 7 | `marcar_presupuesto` candidatos / éxito | 1338, 1342, 1367 | ramas ambiguas y éxito | `_plata_corta` ✔ (SM-N20) |
| 8 | `emitir_factura` | 1630, 1639 | frase exacta + `texto_card` | `_plata_corta` ✔ (SM-H5, #1363) |
| 9 | `consultar_cliente` | 1020, 1030, 1032 (+ `resumen`) | resumen que el LLM **redacta** | `_plata` + dict crudo |
| 10 | `consultar_negocio` | ~1040 | cifras de resumen para que el LLM las narre | no revisado línea a línea |
| 11 | `consultar_actividad` | 724 | el LLM **resume episodios de memoria** | texto libre del grafo, **sin control** |
| 12 | `registrar_presupuesto` | 972 | frase exacta **sin importe** (sólo nombre) | n/a — el importe va en la card |
| 13 | `mp_charge` | 655 | link de cobro | **no revisado a fondo** |

**Cuenta:** 13 sitios. **Con importe vía LLM sin formateo previo (CRUDO): 2** (#1, #2). **Con formato pero relayado/redactado
por el LLM: 5** (#3, #4, #5, #9, #10). **Ya formateados en la frase exacta (aun así relayados por el LLM): 3** (#6, #7, #8).
**Fuera del alcance de «reply por código»: 1** (#11, es resumen libre de memoria). **Sin importe en el reply: 1** (#12). **Sin revisar: 1** (#13).

### Ya por código (no pasan por el LLM)
Cards `factura_propuesta` / `sugerencia_armar_factura` / `datos_negocio` / `gate_card` (`datos_card.py`: `plata()`,
`plata_corta()`), plantillas de Mi Día, y los endpoints JSON que consume la app (`/presupuestos`, `/afip/comprobantes`,
`/gastos`, `/clientes`). **Ahí el importe lo formatea código y es determinista.** El problema vive sólo en el **texto del reply**.

## 3. Clasificación: qué se puede pasar a código y con qué costo

**A — Sin tocar el contrato de las tools (sólo el contenido de `observation`).**
Formatear con `_plata_corta` los #1 y #2 (2 cambios de línea) y **retirar el dict crudo** de #4, #5, #9
(o reemplazar los campos de importe por strings formateados). Es el mismo tipo de fix que SM-H5/SM-N20.
- Efecto medido del patrón: el crudo dejó de causar formato inglés (H5: 4/12 → 0/6; N20: crudo en ramas ambiguas 2/5,1/5 → 1/8,1/8).
- **Límite medido:** no llega a 0. Queda un residuo (1/8) donde el modelo escribe `$70,000` aun con `$70.000` en la
  observación. **Con LLM en el camino no hay garantía; sólo reducción.**

**B — Cambia el contrato de la tool (nuevo campo y cambio en el motor).**
Campo `observation["reply_literal"]` (o equivalente): si la tool lo trae, el motor lo emite como `reply_text`
**sin pasar por el modelo**. Eso es lo único que da garantía real. Costo:
- Toca `motor/` (fork duro: se hace acá, es nuestro) — `conversation_workflow.py`, camino ReAct y cierre del turno.
- Interacción con el guardrail narra-sin-hacer (TODO en `conversation_workflow.py:592`) y con `gate_card`: el reply literal debe respetar el mismo orden y no perder la card.
- **Es workflow Temporal**: cualquier cambio en el flujo del turno exige versionado/replay-safe (skill `temporal-developer`) — no se hace a la ligera.
- Cada tool candidata (#1, #2, #4, #5, #8) pasa de «frase sugerida» a «texto fijo»: hay que escribir y testear la plantilla.

**C — No aplica.** #11 (`consultar_actividad`) y #10 (cifras narradas): el valor está en que el modelo **sintetiza**;
volverlo plantilla es otro producto. Para #11 el importe viene de texto libre de memoria: no hay dato estructurado que formatear.

## 4. Qué se pierde al sacar el LLM del texto

- **Frase libre y contexto:** el modelo hoy mezcla el importe con el estado de la conversación («ya te lo anoté, y de
  paso…»). Una plantilla fija es correcta pero más rígida; tendría que decidirse tono y variantes por tool.
- **Adaptación a lo no previsto:** ramas de error/ambigüedad (#3 «¿es otro cobro o el mismo?») hoy se resuelven con
  prosa; en plantilla hay que enumerar los casos.
- **Idioma/voz:** el reply también se lee por voz (TTS); una plantilla debe sonar bien dicha (`$50.000` leído).
- No se pierde ninguna información: la card ya lleva el importe por código.

## 5. Evidencia medida que sustenta lo de arriba (no se re-midió acá)

- SM-H5: «Me aprobaron el de …» ×6 → 0/6 inglés antes y después (la causa NO era `marcar_presupuesto`); `emitir_factura` 4/12 → 6/6 `$50.000` tras formatear.
- SM-N20: crudo en `candidatos` retirado; residuo 1/8 (`$70,000`) con la observación ya correcta. Aceptado por planificación como límite medido.

## 6. Opciones para el operador (recomendación abierta)

| Opción | Alcance | Garantía | Costo / riesgo |
|---|---|---|---|
| **A** (barato) | #1, #2 a `_plata_corta`; retirar crudos de #4/#5/#9 | reduce, **no** garantiza (residuo ~1/8) | bajo; sin flag; ~1 PR; patrón ya probado |
| **B** (raíz) | `reply_literal` en el motor + plantillas en #1, #2, #4, #5, #8 | **sí**, para esos sitios | medio-alto; toca workflow (versionado), guardrail narra y `gate_card`; requiere flag por tenant + canario |
| **C** (híbrido) | A ahora; B sólo para `registrar_gasto`/`registrar_ingreso`/`marcar_factura_cobrada` (los que mueven plata) | sí donde importa | escalonado |

**Orden sugerido si se decide B:** A primero (igual hace falta: el dict crudo no debe viajar) → `reply_literal` detrás de
flag, probado con sonda LLM real N≥8 contra baseline → activar por tool, de la que mueve más plata a la que menos.
**Lo que NO se puede afirmar:** que A llegue a 0 residual (ya está medido que no); ni que B no afecte la voz/tono sin probarlo.

## 7. Qué no cubre este inventario

`consultar_negocio` (#10) y `mp_charge` (#13) quedaron sin lectura línea a línea. Los endpoints de `web.py` y los
servicios (`services/*.py`) no se auditaron para texto con importes: se asume que devuelven JSON y formatea el front.
Si el operador elige B, esos dos y el reply de errores de `web.py` se leen antes de implementar.
