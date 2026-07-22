# Perfil del negocio + soul del copiloto (y qué pasa con las plantillas)

> **Fecha:** 2026-07-21 · **Estado:** análisis cerrado, NO implementado.
> **Hermano:** `2026-07-21_presupuestos-doc-card-y-boton-facturar.md`.
> Cubre los cuatro temas que el operador abrió junto con el presupuesto: perfil del emprendimiento
> en Ajustes · "soul" del copiloto · plantillas de documentos · plantillas de mails.

---

## 1. Resumen de las cuatro decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| **Perfil del negocio** | **VA** — 4 campos, ni uno más | Destraba todo lo demás: sin él, ni el soul ni las plantillas tienen de dónde sacar el contexto |
| **Soul del copiloto** | **VA con gate empírico** — 3 perillas | Hay precedente MEDIDO de que tocar el prompt rompe el tool-calling (§4) |
| **Plantillas de documentos** | **VA, y es barata** — sin persistencia | No tiene consumidor aguas abajo; se genera y se acabó |
| **Plantillas de mails** | **DESCARTADA** | Resuelve mal el problema real, que el perfil + soul ya resuelven mejor (§6) |

---

## 2. El canal ya existe — no hay plomería que construir

`system_extra` es un parámetro **por turno** que se antepone al system prompt
(`motor/backend/agent/agent_activities.py:104`). Hoy transporta el Context Block de la memoria, y se
recalcula en cada turno (`conversation_workflow.py:430`).

**El perfil y el soul viajan por ahí.** Cero infraestructura nueva.

El prompt hoy es **uno solo y global** (`apps/copiloto/system_prompt.py:31`, `SYSTEM_PROMPT_REACT`,
41 líneas): no sabe nada del negocio de nadie. Eso es exactamente lo que este frente corrige — y se
corrige **sin tocar la constante**, inyectando por `system_extra`. Editar el prompt global para meter
datos de un tenant sería romper el multitenant en el peor lugar posible.

---

## 3. Las tres trampas — verificadas en el código, no supuestas

### a) 🔴 La sesión es PERMANENTE: lo que se cachea, se cachea para siempre

`workflow.continue_as_new({**config, "carryover": carryover})`
(`conversation_workflow.py:192`) arrastra `config` **intacto**. Y `self._state` sobrevive al CAN — el
docstring de `_react_recall` lo dice explícito: *"Persiste el Context Block en self._state para que
sobreviva la pausa del gate y **el continue-as-new**"*.

**Consecuencia:** si el perfil se mete en `config`, o se lee una vez y se guarda en `_state`, el
usuario lo cambia en Ajustes y **el copiloto sigue usando el viejo indefinidamente**. Sin error, sin
log, sin síntoma. Es el patrón "dato en dos tiempos, lector de uno" con otra cara, y en una sesión
que no termina nunca es peor: no hay reinicio que lo cure.

**→ El perfil se lee POR TURNO vía activity**, igual que el recall. Nunca en `config`.

### b) 🟡 No colgarlo del gate de memoria

`_react_recall` está **gateado por `config["memory"]`**: si la memoria está apagada, la activity no
corre. Meter el perfil dentro de `recall_memory` para ahorrar un round-trip lo ataría a ese gate —
apagar la memoria apagaría también la identidad del negocio, que no tienen nada que ver.

**→ Activity hermana** (`cargar_perfil_negocio`), con su propio gate. Cuesta un round-trip por turno;
es un `SELECT` por PK contra la misma base y vale la independencia.

### c) 🟡 El orden importa por costo — y el repo ya lo sabe

El docstring de `_react_recall` dice: *"Recall 1×/TURNO (no por iteración → **preserva el prefijo de
prompt-cache**, gate-blocker #3)"*. O sea que la preservación del prefijo cacheable **ya es una
preocupación consciente y documentada** de este código.

Perfil y soul son **estables** (cambian una vez por mes); la memoria **varía cada turno**.

**→ En `system_extra`, lo estable PRIMERO y lo variable DESPUÉS.** Al revés se invalida el prefijo en
cada turno. Con el LLM en ~95% del COGS (`copiloto-economia-cogs`), el orden de dos strings es
dinero.

---

## 4. Perfil del negocio — la regla es NO PREGUNTAR DOS VECES

`afip_perfil` **ya tiene** razón social, domicilio comercial, condición IVA, CUIT e ingresos brutos
(`PerfilBody`, `apps/copiloto/afip_web.py:24`). Volver a pedirlos en otra pantalla es la forma más
rápida de que el emprendedor abandone Ajustes — y de que las dos copias divergan.

**Lo que falta, y cada campo justifica su lugar cambiando un output concreto:**

| Campo | Qué cambia, en concreto |
|---|---|
| **Qué vendés** (1-2 líneas libres) | tono, ítems que propone en un presupuesto, qué sugiere y qué no |
| **A quién le vendés** (empresas / consumidor final / ambos) | formalidad de docs y mails **+ el default del receptor** de la factura |
| **Nombre comercial** | encabezado de presupuestos, firma de mails |
| **Horario de atención** | agendar sin proponer un domingo a las 3 am |

**Criterio de admisión de un campo nuevo:** si no se puede nombrar el output que cambia, no entra. Un
formulario largo que nadie completa es peor que no tenerlo — el mismo argumento con el que el
operador mató la máquina de estados del presupuesto.

**Dónde vive:** tabla propia por tenant (`uc_factory.perfil_negocio`, PK `cliente_id`), no en
`afip_perfil` — ese es por CUIT y es fiscal; este es del negocio y existe aunque nunca facture.

---

## 5. Soul — 3 perillas, y **no es gratis**

### El precedente que obliga a un gate

`system_prompt.py:28` documenta una regla dura aprendida a los golpes:

> *"el prompt NO menciona el gate de confirmación — contarle al modelo que existe un paso de
> confirmación pendiente **rompe el tool-calling encadenado** (spike 2, **0/3 empírico**)"*

**Ya está medido que agregar texto al system prompt puede romper la ejecución de herramientas.** Un
bloque de personalidad no es decoración: compite por atención con las instrucciones operativas.

**→ Gate obligatorio antes de shipear:** A/B con dato real (mismo set de pedidos multi-tool, con y
sin bloque de soul, comparando **tools ejecutadas correctamente**, no "qué lindo suena"). Es la regla
del `CLAUDE.md` global —*"cambio significativo de prompt de LLM externo → test A/B con dato real"*—
pero acá además hay un precedente concreto de que falla.

### Las perillas

| Perilla | Valores | Nota |
|---|---|---|
| **Formalidad** | formal · cercano | El voseo rioplatense es fijo, no se toca |
| **Largo** | breve · detallado | |
| **Nombre del copiloto** | texto libre | Cosmético, baratísimo, y es lo que más se siente |

**Fuera de la v1: la proactividad** ("¿sugiere o espera?"). Es la que más riesgo tiene de que el
agente haga cosas que nadie pidió, y el prompt actual dice **literalmente lo contrario**: *"Hacé SOLO
lo que el usuario te pide: no agregues acciones que no pidió"*. Una perilla que contradice una
instrucción dura del prompt no es una preferencia: es una pelea entre dos textos, y la gana el que
esté más cerca del final. Si alguna vez entra, entra con su propio A/B.

---

## 6. Plantillas de documentos — baratas, **sin persistencia**

Acá está la asimetría que conviene ver:

> El presupuesto necesitó Postgres **sólo por el botón facturar** — porque algo lo lee después. Una
> carta de presentación **no tiene consumidor aguas abajo**: se genera, se manda, se acabó.

**→ Plantilla = markdown parametrizado (con los campos del perfil) + `docs_create_doc`. Sin tablas,
sin estado, sin ciclo de vida.** Un orden de magnitud más barato que el presupuesto.

**Por eso conviene hacerlas DESPUÉS del presupuesto:** el presupuesto paga la plomería (generar un
Doc, guardar el link, mostrarlo en una card) y las demás plantillas la reusan gratis.

---

## 7. Plantillas de mails — DESCARTADA, con motivo

Duda del operador, textual: *"si los mails los redacta el copiloto no sé si es redundante"*. **Lo es.**

Una biblioteca de plantillas de mail resuelve mal el problema real. El problema no es *"no sé qué
escribir"* —el copiloto ya escribe— sino *"que suene a mí"*. Eso lo resuelven **el perfil + el soul**,
y lo resuelven para **todos** los mails, no para los cinco que estén en la biblioteca. Además una
plantilla envejece: hay que mantenerla, y ya sabemos qué pasa con lo que el usuario tiene que
mantener.

**Única excepción legítima:** un mail **repetitivo y exacto** (recordatorio de pago con el link de
cobro). Eso **es una acción del copiloto**, no una plantilla que el usuario edita.

---

## 8. Orden recomendado

1. **Perfil** — destraba todo lo demás y no depende de nada.
2. **Presupuesto** — su diseño ya está cerrado y validado; paga la plomería de Docs.
3. **Soul** — con su A/B. Después del perfil, porque sin perfil no hay de qué tener personalidad.
4. **Plantillas de documentos** — reusan lo que dejó el presupuesto.
5. ~~Plantillas de mails~~ — descartada, §7.

---

## 9. Supuestos NO validados

- ⚠️ **El impacto del bloque de soul sobre el tool-calling** — `[PENDIENTE VERIFICAR]`. Es **el**
  supuesto crítico de este documento: hay precedente medido de degradación (0/3). El A/B de §5 es
  precondición de merge, no una mejora opcional.
- 🟡 **El costo del round-trip extra por turno** de `cargar_perfil_negocio` — `[PENDIENTE VERIFICAR]`,
  no medido. Es un `SELECT` por PK; se espera despreciable frente al LLM, pero no está medido.
- ✅ Ya validado y **no** hace falta re-spikear: el canal `system_extra`, su recálculo por turno, la
  persistencia de `_state` a través del continue-as-new y la duplicación con `afip_perfil` — todo
  leído del código el 2026-07-21 (referencias en §2-§4).
