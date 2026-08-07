# Soporte técnico — brief maestro para el sprint siguiente

> **Estado: DIFERIDO a un sprint propio.** Decisión del operador, 2026-08-07. No se implementa nada
> de esto todavía. Este documento existe para que retomarlo no cueste re-descubrir lo que ya se
> midió — que fue lo caro.
>
> **Antes de diseñar, leé §2.** Ahí está el supuesto que parecía obvio y resultó falso; si lo das por
> bueno, todo lo que apoyes encima se cae.
>
> **Actualizado 2026-08-07 (+3 h): las 3 decisiones abiertas de §4 están CERRADAS.** El diseño que
> sale de ellas está en **§8**. §4 queda como registro del razonamiento, no como pendiente.

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

> ✅ **Las tres están cerradas desde el 2026-08-07 (+3 h). El resultado, en §8.** Lo de arriba queda
> como registro del razonamiento — no lo vuelvas a decidir.

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

---

# 8. DECISIONES CERRADAS (2026-08-07) y el diseño que sale de ellas

## 8.1 Lo que decidió el operador

| # | Decisión | Textual / consecuencia |
|---|---|---|
| **A** | El agente se alimenta de **datos del sistema + base de conocimiento del producto** | Cubre las 3 categorías de consulta. La KB es el trabajo de contenido nuevo |
| **A.bis** | Cuando no sabe: **lo dice, escala a soporte humano y entrega un IDENTIFICADOR DE TICKET** | «le da el número de operación, un identificador del ticket, y deriva a humano» |
| **KB** | Vive como **RAG en fusion** (preferencia del operador) | Ver §8.4 — el RAG **existe y es maduro**; falta sólo el CONTENIDO |
| **Modelo** | **GPT-4o-mini** para las dos funciones conversacionales: **soporte técnico** y **cómo uso la app** | Decisión del operador, 2026-08-07. Ver §8.4.bis — barato y coherente con el proveedor del RAG, pero **un modelo chico exige MÁS gates, no menos** |

**A.bis no es un matiz: cambia la arquitectura.** «Derivar» sería un flag; **un ticket con
identificador es un objeto con estado, nombrable por el usuario y buscable por el operador.** Eso
obliga a persistencia propia (§8.3), no a un campo más en `copiloto_feedback`.

## 8.2 Lo que decidió planificación (táctico, criterio: reutilizar)

**B — monta sobre el motor, con cerebro propio.** `ConversationWorkflow` está declarado capa
PLANTILLA cosechable y el canal web ya resuelve `session_id = channel_ref` + long-poll de `/reply`:
la durabilidad (el moat) sale gratis. Pero con **workflow, system prompt, toolset y `task_queue`
propios** — si comparte el cerebro del copiloto, el «chat distinto» que pidió el operador es
cosmético y hereda una superficie de herramientas que en soporte no se quiere.

**C — la respuesta del operador entra por la consola**, sección Soporte, como **acción que muta** con
su fila en `copiloto_auditoria`. Mismo patrón que `tenant.estado` y `trauma.reintento`; no se inventa
un canal nuevo. Precondición ya satisfecha: CONS1.

## 8.3 Persistencia — lo que hay que crear

`copiloto_feedback` (4 columnas: `tipo · texto · contexto · created_at`) **no alcanza y no se
extiende a la fuerza**: un hilo con autor, estado e identificador no es un feedback con campos extra.

Dos tablas nuevas, con RLS por `cliente_id` como el resto:

- **tickets** — `cliente_id`, **código legible** (el «número de operación» que ve el usuario),
  `estado`, `created_at`, `updated_at`
- **mensajes** — `ticket_id`, `autor` (`usuario` | `agente` | `operador`), `texto`, `created_at`

El **código legible** es requisito del operador, no adorno: el usuario lo dicta por teléfono y el
operador lo busca. Legible ⇒ no un UUID. Y **no** derivarlo de un contador global: continue-as-new
reinicia números y dos tenants colisionan
([[derivar-la-clave-dentro-de-la-activity-no-tocar-el-payload]]).

`copiloto_feedback` **no se toca ni se migra**: sigue siendo el buzón de una dirección que ya
funciona, y la consola lo sigue leyendo. Lo nuevo convive.

## 8.4 La base de conocimiento — CORREGIDO 2026-08-07: **el RAG existe, y es maduro**

> ⚠️ **Esta sección afirmaba lo contrario, y era falso.** Se conserva el error visible porque la
> forma en que se produjo vale más que el dato: es el modo de fallo que esta constitución más
> persigue.

**Lo que decía:** «Tablas con columna `vector`: ❌ ninguna · Código de embeddings/RAG: ❌ cero → no
falta el contenido: falta el pipeline entero, cinco piezas». **El operador lo corrigió dos veces**
(*«vps fusion tiene un rag… ya te lo dije… lo construí yo»*), y la sesión del repo
`supabase-self-host-blueprint` llegó al mismo sitio por su cuenta.

**Por qué el chequeo salió limpio estando equivocado:** consultó `information_schema`, que **filtra
por privilegios** — el rol usado no tiene permisos sobre el schema `rag`, así que sus 18 tablas
simplemente no aparecían. `pg_catalog` **no** filtra y las mostró todas a la primera. El instrumento
no decía «no hay»: decía **«no veo»**, y se leyó como lo primero. Se sumó un segundo sesgo: se buscó
el tipo `vector`, no `tsvector`/`halfvec`. Ver [[vacio-no-es-hallazgo-correr-el-control]] y
[[un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo]] — misma familia: un vacío que no
protesta.

### Lo que hay realmente (verificado read-only por la sesión de fusion, 2026-08-07)

| Chequeo | Resultado |
|---|---|
| `rag_health_check` | ✅ healthy (5/5) |
| Schema `rag` en fusion | ✅ **18 tablas** — `documents`, `chunks`, `embeddings`, `configs`, `query_logs`, `eval_sets`, `routing_decisions`, `embedding_cache`, `hype_questions_v076`, … |
| Índice vectorial | ✅ HNSW `halfvec` inner-product, construido (+ IVFFlat y GIN sobre `tsvector`) |
| RPCs disponibles | ✅ `rag.rag_query(...)` · `rag.hybrid_search(...)` · `rag.rag_health()` |
| Namespaces vivos | 5 — `arca-docs`, `arca-suite`, `soporte`, `test-sql`, `default` |
| Vault de keys | ✅ `<cliente_id>/embeddings/openai_api_key` |
| Ratio anti-alucinación ya medido ahí | FPR 8,2 % · RA 100 % · HR 3,0 % (sobre `arca-suite`) |

Es la **misma base** que usa la app (`deploy/copiloto/deploy.sh` sourcea `fusion-pg.env`). Chunking
header-aware, búsqueda híbrida con RRF, telemetría de costo y pipeline de evaluación **ya están en
producción**.

**De las «5 piezas», falta exactamente una: el contenido.**

⚠️ **Trampa de nombre:** el namespace `soporte` que ya existe **NO es de copiloto** — tiene docs de
arquitectura de otro sistema. No reusarlo; el namespace de la KB lo nombra la sesión de fusion.

### Qué cambia esto en el plan (y qué no)

**Se cae el argumento de sobreingeniería.** «RAG después» se apoyaba en no construir 5 piezas contra
un corpus inexistente. **No hay nada que construir**, así que el costo de usarlo desde el día 1 es
ingestar, no desarrollar.

**Sigue en pie el orden: contenido primero.** No por costo de infra, sino porque **el corpus de
usuario no existe** — 0 documentos, verificado sobre `origin/main` @ `4438b0ff` (barrido por
`manual|guía|faq|onboarding|tutorial|cómo-` en `docs/`: 1 hit, y es un falso positivo de un doc de
research). Lo que cambia es qué significa «primero»: ya no *«escribir y ver si hace falta RAG»*, sino
**escribir el corpus con la forma que el pipeline premia** — Markdown con jerarquía de headers real,
un tema por documento, prosa antes que bullets sueltos. Escribirlo sin esa forma sería tener que
rehacerlo.

### El inventario ya entregado a fusion (2026-08-07)

| Punto | Respuesta medida |
|---|---|
| **Son dos corpus, con materia prima opuesta** | «Cómo usar la app»: **0 docs, hay que escribirlo**. Soporte interno: **349 `.md` · ~2,4 MB** (`docs/` 105 · 1.570 KB; `memoria/` 244 · 886 KB) |
| Índice del corpus de usuario | Las **17 funciones** de la app (rutas reales); ~1 doc por función |
| Formato | **100 % Markdown**; en `docs/` los únicos no-`.md` son 9 `.otf` + 5 `.svg`. Cero PDF/HTML |
| Jerarquía de headers | ✅ real y consistente (`##` 6-13, `###` 0-14 por doc) |
| ¿Por tenant? | **Común a todos** → un namespace por corpus. **Los datos del negocio NO van al RAG jamás** — viven en Postgres con RLS y se consultan por SQL. «Que sepa mis facturas» se resuelve con una tool, no ingestando |
| Idioma | Español rioplatense (BM25 `spanish`) |
| PII | Corpus de usuario: no. Corpus interno: **sí, filtrar** (emails de prueba, IPs, hostnames, rutas). De clientes reales, nada — no hay clientes |

### 🔴 El hueco duro: no hay preguntas reales, y no se inventan

El eval-set necesita 10-20 preguntas reales con ground truth. **No existen: la app tiene cero
usuarios** — está desplegada y verificada, pero las invitaciones no se mandaron; `copiloto_feedback`
tiene 2 filas y salieron del E2E. Fabricarlas y presentarlas como reales contaminaría **la única
medición que justifica el trabajo**. Se entregan **etiquetadas como sintéticas** (sirven para el
spike de retrieval: *¿trae el chunk correcto?*), la fuente real más cercana es **el operador**, y el
ratio que se mida antes de la beta se declara **provisional** hasta re-medirlo con tickets reales.

### 🔺 Decisión MAYOR abierta — la lleva el operador

El objetivo *«el mismo ratio anti-alucinación»* **no se hereda con el camino A tal como estaba
confirmado** (redactor propio de la app sintetizando sobre los chunks): A hereda el *retrieval*, no
las *defensas* — los gates de sufficiency y grounding viven en el orquestador `pipeline_v2`
(`/opt/v070`), que hoy no expone HTTP.

| | Qué implica | Costo |
|---|---|---|
| **A+gates** | El redactor de la app replica sufficiency + grounding | Barato en infra, pero **hay que re-medir el ratio acá** — con el corpus del hueco de arriba, o sea sin ground truth |
| **C** | Exponer el orquestador v2 por HTTP; la app consume respuesta ya verificada | Infra nueva en fusion, pero **el ratio ya está medido y no se re-litiga** |

**Recomendación de planificación: C.** A+gates hereda la promesa sin la prueba, que es
[[no-codificar-la-esperanza-principio-raiz]] con otro nombre. **Contrapunto honesto:** C agrega una
dependencia viva más, y si el orquestador cae, cae el chat de soporte — justo adonde va el usuario
cuando algo falla. Si se elige C, **hay que definir qué contesta el agente con el orquestador caído**,
y que sea honesto («no puedo consultar la base ahora, escalo tu ticket»), nunca un fallback que
alucine.

**Canal vivo:** `coordinacion/Supabase fusion Rag/` ↔ `supabase-self-host-blueprint/Coordinacion/
Copiloto emprendedor/` (`COORDINACION.md` §8).

## 8.4.bis El modelo: **GPT-4o-mini** — decisión del operador (2026-08-07)

> Textual: *«para el soporte usa gpt 4o mini… agente de cómo uso y de soporte técnico»*.

Aplica a las **dos funciones conversacionales**: soporte técnico y cómo usar la app. (Feedback no
conversa — es one-shot con la frase fija de §9.3, así que no consume modelo.)

**Lo que juega a favor, y no es menor:**

- **Mismo proveedor que el RAG.** El vault de fusion ya guarda `<cliente_id>/embeddings/openai_api_key`
  para los embeddings → **una sola credencial**, un solo proveedor que auditar y rotar. Elegir otro
  vendor para el redactor habría duplicado esa superficie sin ganancia.
- **Costo por consulta bajísimo**, que es lo que vuelve viable contestar *toda* consulta con el agente
  antes de escalar — la filosofía declarada por el operador: la app se autogestiona lo máximo posible
  y el HITL humano queda para lo que de verdad lo necesita.

**El contrapunto que hay que diseñar contra, no ignorar:** un modelo chico es **más** propenso a
sostener con seguridad algo que el contexto no dice. Eso no invalida la elección — la condiciona:
**con 4o-mini los gates de sufficiency y grounding dejan de ser un refinamiento y pasan a ser la
pieza que hace funcionar el conjunto.** Un modelo grande perdona un gate flojo; éste no.

→ **Refuerza la recomendación C** de la decisión MAYOR de arriba: si el ratio ya medido en fusion
(FPR 8,2 %) sale del pipeline con gates y no del modelo, heredarlo por HTTP es más seguro que
replicar los gates acá y confiar en que 4o-mini se porte igual. Si el operador elige A+gates, los
gates hay que **medirlos**, no copiarlos — y con el hueco del eval-set (no hay preguntas reales) eso
es precisamente lo que hoy no se puede hacer.

**No decidido todavía y hay que decidirlo antes de implementar:** qué modelo hace el *clasificador*
de las tres funciones (§9.2). Puede no hacer falta ninguno — el enrutado por elección explícita del
usuario es determinista y gratis.

## 8.4.ter 🔴 DoD: E2E en la app, no en la suite — orden del operador

> Textual, 2026-08-07: *«recordá que todo debe estar probado y funcionando E2E, listo para usar en la
> app»*.

Es la compuerta 3 de `COORDINACION.md` §6.2 aplicada a este sprint. **Nada de esto se declara
terminado con tests verdes.** Verde en la suite prueba que el código hace lo que el test dice; no
prueba que un emprendedor obtenga una respuesta útil.

El sprint cierra cuando, **en la app corriendo** (device para mobile, navegador para web):

- [ ] El usuario abre el chat de soporte desde la app y **el primer mensaje es del agente**,
      respondiendo su consulta concreta (requisito explícito del operador, §1).
- [ ] Una pregunta de **«cómo uso la app»** se responde **con contenido del RAG**, y la respuesta
      es correcta — verificado contra el corpus, no contra la impresión de que suena bien.
- [ ] Una consulta que el agente **no puede sostener** termina en: lo dice · entrega el código
      `SOP-XXXX` · el ticket queda creado y visible en la consola. Sin improvisar una respuesta.
- [ ] El **feedback** devuelve la frase fija y **no** abre hilo.
- [ ] La respuesta del operador desde la consola **llega al usuario** y le aparece la notificación
      en Actividad, enlazada al mensaje.
- [ ] **Control negativo:** con el RAG/orquestador caído, el agente contesta honestamente y escala —
      no alucina un fallback. Se prueba **apagándolo a propósito**, no razonándolo.
- [ ] Aislamiento: un tenant **no** ve el ticket de otro (test adversarial, regla dura del repo).

El último control negativo no es celo: es el único que distingue *«funciona»* de *«funcionó la vez
que lo miré»*. Un gate que sólo se ejercita con el camino feliz aprueba igual un sistema roto hacia
el «no» ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]).

## 8.5 El flujo, punta a punta

```
usuario escribe en el chat de soporte (ventana discreta, dentro de la app)
   └─> agente responde PRIMERO, con:
         · traumas del propio tenant  (¿hay un error registrado suyo? workflow, fecha, estado)
         · su actividad / datos de cuenta
         · la base de conocimiento del producto
   └─> ¿puede sostener la respuesta con esas fuentes?
         SÍ  -> responde
         NO  -> lo DICE + crea el ticket + entrega el CÓDIGO + escala a humano
                   └─> el operador responde desde la consola (acción que muta -> auditoría)
                         └─> el mensaje aparece en el hilo del usuario
```

**La regla dura del agente:** no improvisa. Una respuesta falsa en soporte es peor que ninguna,
porque el usuario **actúa** sobre ella. El spike del 04-08 (§2.2) ya midió qué pasa cuando este
sistema adivina: ruido, no señal.

## 8.6 Primer paso al retomar — reemplaza a §6

1. **Escribir la KB** — es el camino crítico y no depende de ninguna decisión técnica pendiente.
   Empezar por las 10 preguntas que un emprendedor haría la primera semana.
2. **Spike con quejas reales** (§6.2 sigue vigente): con la KB escrita y las fuentes de datos
   enchufadas, probar contra las quejas que ya están en `copiloto_feedback` si la primera respuesta
   es una que el operador firmaría. Si no, el diseño cambia **antes** de escribirse.
3. Recién con eso: trifecta + contratos por capa.

**Lo que NO bloquea a nada y se puede adelantar ya:** las dos tablas (§8.3) y el destrabe de `CTA3`
(la entrada de soporte en la web) — su forma ya está decidida: es la ventana de chat.

---

# 9. TRES FUNCIONES, UN SOLO CHAT (decisión del operador, 2026-08-07)

> «hay que dividir funciones… una es soporte técnico, otra es feedback y otra es cómo usar la app…
> debemos separar esto en funciones diferentes dentro del mismo chat de soporte»

## 9.1 Por qué la separación no es cosmética

**Los tres terminan en lugares distintos y tienen un «terminado» distinto:**

| Función | Destino | ¿Ticket con código? | Cierra cuando |
|---|---|---|---|
| **Soporte técnico** | trauma → grafo → cola de autosanación → issue si no se resuelve | **sí** | el error se repara o el issue se cierra |
| **Feedback** | `copiloto_feedback` (ya existe) — se registra, **no se repara** | no | se registró |
| **Cómo usar la app** | base de conocimiento — se responde y termina | no | el usuario entendió |

**Protege de dos errores caros y opuestos:** un bug entrado como *feedback* muere en silencio en una
tabla que nadie repara; una idea de mejora entrada como *soporte técnico* entra a la cola de
autosanación y quema presupuesto del forjador buscando un bug que no existe.

**El ticket es SÓLO de soporte técnico.** Si todo genera número, el número deja de significar
«alguien se va a hacer cargo». Feedback y how-to no prometen resolución ⇒ no prometen seguimiento.

## 9.2 Elige el usuario, no adivina el agente

Tres opciones al abrir el chat. **No** clasificación automática desde el texto: en este repo ya está
**medido** que eso falla (§2.2 — la queja en lenguaje natural no resuelve nada). Preguntar cuesta un
toque y es determinista.

**Excepción explícita:** si el usuario eligió mal, el agente **lo propone en voz alta** («esto parece
un error, ¿lo reporto como soporte técnico?») y **nunca reclasifica en silencio**.

## 9.3 Persistencia por función — DEFAULT de planificación

`[ASSUMED_PENDING_VERIFY]` — el operador no lo confirmó todavía; se implementa así salvo que diga
otra cosa:

- **Soporte técnico** → hilo completo (tickets + mensajes, §8.3)
- **Feedback** → como hoy: una fila en `copiloto_feedback`, sin hilo
- **Cómo usar la app** → **no persiste** más allá de la conversación

Si el operador quiere las tres como hilos con historial, es **otra tabla** y cambia §8.3.

# 10. El salto que hace funcionar el acceso al grafo

> Pedido del operador: «al agente de soporte también hay que darle acceso al grafo del repositorio…
> y a errores del usuario y de la app… puede citar dónde está el problema al escalar el ticket».

## 10.1 Eso ya existe — y ya se midió que NO alcanza

`soporte_clasificador.py` **ya** consulta `graphity-code` para resolver el origen de una queja, y
`clasificar_y_encolar_feedback` **ya** encola a autosanación. El flujo pedido está construido.

Lo que el spike del 04-08 midió (§2.2): **la queja en lenguaje natural no encuentra el archivo.** Ni
con vocabulario de dominio. Sólo acierta cuando el texto menciona el símbolo o el archivo literal.
Por eso hoy casi todo cae a `necesita_humano=True`.

## 10.2 El arreglo: al grafo no se le da la QUEJA, se le da el TRAUMA

`copiloto_traumas` tiene `workflow`, `error_type` y `costura` — **vocabulario técnico exacto**, que es
justo lo que el grafo sí resuelve (el caso 1 del spike: símbolo literal → top-1 exacto).

```
queja del usuario  ──►  encontrar el TRAUMA de ESE tenant   (cliente_id + ventana temporal)
                          └─►  workflow / error_type / costura   ← vocabulario técnico
                                └─►  grafo del repo  ──►  archivo:línea
                                      └─►  se cita al escalar el ticket
```

**La queja sirve para encontrar el trauma, no para encontrar el código.** Ese salto intermedio es lo
que hoy no existe, y es lo que convierte el pedido del operador en viable — por un camino distinto
del que se planteó.

## 10.3 Autosanación primero — con dos reparos

El operador: «este ticket tendría que pasar por autohealing primero… si se puede resolver se resuelve
y si no se escala a issue como está configurado». Correcto, **y ya es el flujo**. Dos condiciones:

1. **Sólo entra a la cola lo clasificado como falla técnica.** «¿Cómo cargo un gasto?» no es un bug:
   si entra, ensucia el loop y gasta forjador. Lo garantiza §9.2 (el usuario elige la función).
2. **El usuario NO espera al loop.** Autosanación tarda; alguien que escribió «no me anda» necesita
   respuesta ahora. El agente contesta **de inmediato** con lo que ve —«hay un error registrado en tu
   cuenta del martes en facturación, ya está en reparación, tu ticket es `SOP-…`»— y el ticket sigue
   su camino **en paralelo**. Bloquear la respuesta detrás del loop reinstala el silencio que este
   sprint existe para eliminar.
