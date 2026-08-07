# Soporte técnico — brief maestro para el sprint siguiente

> **Estado: DIFERIDO a un sprint propio.** Decisión del operador, 2026-08-07. No se implementa nada
> de esto todavía. Este documento existe para que retomarlo no cueste re-descubrir lo que ya se
> midió — que fue lo caro.
>
> **Antes de diseñar, leé §2.** Ahí está el supuesto que parecía obvio y resultó falso; si lo das por
> bueno, todo lo que apoyes encima se cae.

---

## 1. Lo que el operador YA decidió (no se re-abre)

| Decisión | Textual |
|---|---|
| Canal propio | «el chat de soporte debe ser **diferente** al chat del copiloto» |
| Forma | «una ventana de chat **discreta**, igual que todas las apps» |
| Dentro de la app | «**no** por email ni por otro medio — un chat dentro de la app» |
| Quién abre | «el primer mensaje debe ser **del agente** respondiendo al usuario sobre su consulta» |
| Alcance | «vamos a crear un agente de soporte **completo**» |
| Costo | «no importa si hay que implementar cosas» |

Lo que queda abierto es **de qué se alimenta el agente** (§4.A) — no el canal ni la forma.

## 2. Lo verificado empíricamente (2026-08-07) — leer antes de diseñar

### 2.1 ⚠️ No existe ningún agente de soporte. El supuesto era falso

El operador asumió que «el agente ya tiene recursos para responder con info real». **No los tiene, y
no es un agente.** `apps/copiloto/soporte_clasificador.py` lo dice en su propio docstring:

> *«No llama a ningún LLM (cero costo, cero superficie de PII hacia un tercero por esta vía)»*

Lo único que hace `SoporteClasificador` es resolver **de qué archivo del código habla una queja**,
buscando en `graphity-code`, para poder derivarla al forjador de autosanación. Es un **enrutador
hacia la reparación automática**, no un interlocutor. No conversa, no lee los datos del usuario, no
sabe nada del producto.

### 2.2 Y ni siquiera enruta bien el lenguaje natural — medido, no supuesto

Spike del 2026-08-04 (documentado en el mismo archivo, líneas 8-30), 3 queries reales contra
`group_id=code-copiloto-emprendedor`:

| Query | Resultado |
|---|---|
| el símbolo literal (`_run_registrar_presupuesto`) | ✅ top-1 exacto |
| la queja como la escribiría el usuario | ❌ resultados no relacionados |
| versión naturalista **con vocabulario de dominio** | ❌ funciones de otro layer con vocabulario superficial parecido |

**Conclusión que quedó escrita:** la búsqueda semántica sola no es señal de confianza suficiente. La
única señal barata y determinista fue la **mención literal del símbolo o archivo**. Por eso el umbral
es estricto por diseño («sin match claro, `origen=None`, NO intentar adivinar»), y la consecuencia
**esperada y aceptada** es que la mayoría del feedback en lenguaje natural cae a
`necesita_humano=True`.

Ese `necesita_humano=True` es hoy un callejón sin salida. El sprint de soporte puede convertirlo en
una **transición de conversación**, que es donde está el valor.

### 2.3 `copiloto_feedback` es un buzón de una sola dirección

Schema real (`uc_tables.json`), **cuatro columnas**:

```
tipo text NOT NULL · texto text NOT NULL · contexto text · created_at timestamptz
```

Sin respuesta, sin hilo, sin estado, sin autor del mensaje. **Un chat necesita persistencia nueva.**
Esto no es «mostrar lo que ya hay»: es una tabla nueva (o una migración) + el registro de quién dijo
qué y cuándo.

### 2.4 La maquinaria de conversación durable SÍ existe, y es reusable

`motor/clients/agent/channels/web.py` — canal web genérico del motor:
`session_id = channel_ref`, `send` persiste el reply vía `reply_sink` y un endpoint `/reply` lo sirve
por long-poll. El `ConversationWorkflow` (`motor/backend/agent/conversation_workflow.py:80`) es
**durable y agnóstico** — declarado capa PLANTILLA, cosechable.

Es decir: el chat de soporte **no arranca de cero**. La pregunta es si monta encima de esto o estrena
(§4.B).

### 2.5 La consola es read-only sobre soporte

`apps/copiloto/admin_soporte.py` lee `copiloto_feedback` y lo muestra. No hay ninguna acción que
permita responder. Si el operador va a poder contestar, esa es una **acción que muta** y necesita su
fila en `copiloto_auditoria`, como `tenant.estado` y `trauma.reintento`.

## 3. Inventario — qué se reutiliza (canon: nada se re-implementa)

| Pieza | Path | Rol en el sprint |
|---|---|---|
| Clasificador de origen | `apps/copiloto/soporte_clasificador.py` | **conservar** — resuelve el enrutado a autosanación, que el agente no reemplaza |
| Workflow de clasificación | `apps/copiloto/soporte_feedback_workflow.py` | conservar |
| Activities | `apps/copiloto/soporte_feedback_activities.py` | extender (hoy: `encolado_para_reparacion` \| nada) |
| Persistencia actual | `apps/copiloto/feedback_store.py` + `copiloto_feedback` | **insuficiente** — ver §2.3 |
| Lectura desde la consola | `apps/copiloto/admin_soporte.py` | extender con la acción de responder |
| Auditoría | `copiloto_auditoria` (CONS1) | **precondición** de toda acción que mute |
| Canal web durable | `motor/clients/agent/channels/web.py` | candidato a reusar (§4.B) |
| Motor conversacional | `motor/backend/agent/conversation_workflow.py:80` | candidato a reusar (§4.B) |
| UI de feedback (mobile) | `apps/mobile/src/modules/feedback/PantallaFeedback.tsx` | se **reemplaza** por el chat |
| Entrada en el menú (mobile) | `apps/mobile/src/modules/ajustes/PantallaCuenta.tsx:59` | se re-apunta |
| UI en la web | — | **no existe**, contrato CTA3 frenado esperando este diseño |

## 4. Las tres decisiones abiertas

### A · ¿De qué se alimenta el agente? ← la decisión que bloquea a las otras dos

El operador quiere que el agente escriba primero, respondiendo la consulta. Para eso hay que
**construirlo**. La pregunta no es «¿qué modelo?» sino **qué fuentes de verdad tiene**:

| Fuente | Qué le da | Qué NO |
|---|---|---|
| Grafo de código (`graphity-code`) | sabe cómo funciona el sistema | no sabe nada del usuario |
| Datos del propio tenant | sabe su caso concreto | eso ya es el copiloto — riesgo de duplicarlo |
| Base de conocimiento del producto | respuestas de producto reales | **no existe, hay que escribirla** |
| Estado vivo (salud, DLQ, uso) | «esto está roto y ya lo sabemos» | requiere darle lectura de la consola |

**Riesgo central:** un agente sin fuente definida contesta con seguridad y se equivoca. En soporte
eso es **peor que no contestar** — el usuario actúa sobre una respuesta falsa. El diseño tiene que
decir explícitamente qué pasa cuando el agente no sabe.

**Recomendación de planificación:** el agente contesta primero pero **acotado** — responde sólo lo
que puede sostener con el estado del sistema y los datos del propio usuario, y cuando no sabe **lo
dice y deriva el hilo al operador**, en vez de improvisar. Eso reusa el `necesita_humano=True` que ya
existe (§2.2) convirtiéndolo en transición en lugar de callejón.

### B · ¿Monta sobre el motor o estrena?

- **Reusar** `ConversationWorkflow` + canal web: durabilidad, reintentos y long-poll gratis. Costo:
  el motor es el cerebro del copiloto — separarlo de verdad exige otro system prompt, otro toolset y
  probablemente otro `task_queue`, o el «chat diferente» es cosmético.
- **Estrenar**: más limpio conceptualmente, más caro, y hay que re-ganar la durabilidad que es
  justamente el moat del producto.

Sin decidir. Depende de A: cuanto más acotado el agente, más barato reusar.

### C · ¿Por dónde entra la respuesta del operador?

Hoy no entra por ningún lado. Implica: una acción que muta en la consola + su fila en auditoría +
que el hilo del usuario reciba el mensaje. Es la pieza más chica de las tres, pero **no es gratis**.

## 5. Lo que NO hay que hacer (trampas ya identificadas)

- ❌ **Portar `PantallaFeedback` a la web.** El operador decidió chat; portar el formulario de una
  sola dirección es construir algo que se reemplaza. Por eso `CTA3` está en el buzón con
  `DISPARADOR: pendiente` y no arrancable.
- ❌ **Borrar el clasificador** «porque ahora hay un agente». Resuelve el enrutado a autosanación, que
  es otra cosa; su umbral estricto está justificado por spike.
- ❌ **Dar por hecho que el agente puede responder con info real.** Ver §2.1. Es exactamente el
  supuesto que hay que validar con un spike antes de diseñar.
- ❌ **Meter soporte adentro del chat del copiloto.** Decidido en contra, §1.

## 6. Cómo retomar — el primer paso concreto

1. **Cerrar §4.A con el operador.** Es lo único que bloquea todo lo demás.
2. **Spike antes de diseñar** (§2.1 es el precedente de por qué): con la fuente elegida en A, probar
   contra **quejas reales** —las que ya están en `copiloto_feedback`— si el agente produce una
   primera respuesta que el operador firmaría. Si no, el diseño cambia antes de escribirse, no
   después. El spike anterior costó una tarde y evitó construir sobre arena.
3. Recién con eso: trifecta (estado del arte + failure map + decision matrix) y contrato.

## 7. Punteros

- Contrato frenado esperando esto: `coordinacion/abierto/2026-08-07_contrato_planificacion-a-frontend_CTA3-la-web-no-tiene-por-donde-pedir-soporte.md`
- Trifecta del clasificador actual (BETA-4a): `docs/copiloto-emprendedor/Manejo de errores/08-TRIFECTA-agente-soporte-BETA4a.md`
- Autosanación, a donde deriva el clasificador: `docs/copiloto-emprendedor/Manejo de errores/06-RUNBOOK-autosanacion.md`
- Glosario del dominio (antes de nombrar entidades nuevas): `CONTEXT.md`
