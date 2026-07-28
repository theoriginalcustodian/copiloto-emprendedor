# Manejo de errores de toda la app — análisis profundo

> **Fecha:** 2026-07-28 · **Ref auditado:** `origin/main` @ `7e952fe` · **Alcance:** las 6 capas
> (backend HTTP, motor durable/agente, gateways+persistencia, cliente TS, app mobile, PWA legacy).
> **Método:** inventario cuantificado por script (idempotente, contra el ref) + 6 barridos
> independientes read-only con glob exclusivo + síntesis y juicio propio de la costura.
> **Nada de esto es autoevaluación:** cada afirmación tiene `archivo:línea`, y lo que no se pudo
> verificar leyendo código está marcado, no afirmado.

---

## 0. El veredicto, en cinco líneas

El manejo de errores de esta app **no está mal diseñado: está mal distribuido**. En cada capa existe
al menos una pieza de calidad alta —con docstring que explica el fallo que vino a matar, catálogo
cerrado, test que lo protege— y en cada capa esa pieza **cubre una fracción de los call-sites que le
correspondían**. No hay que reescribir: hay que **propagar lo que ya está bien** y poner los gates
que hoy no existen para que la propagación no dependa de que alguien se acuerde.

Y hay **una línea de código** que probablemente explica el bug que hoy bloquea una feature entera
del producto (§4.1).

**Un hallazgo no es análisis estático:** el journal del VPS muestra que el 21 de julio un emprendedor
real recibió **doce respuestas `200 OK` falsas** sobre su estado fiscal, construidas sobre un error
tragado, sin que nada dejara rastro salvo un WARN de Rust que nadie mira (§6.bis). El bug que lo
originó ya está corregido; **el mecanismo que lo hizo invisible sigue en `main`**.

---

## 1. Método y honestidad del instrumento

| Paso | Qué | Control |
|---|---|---|
| Inventario | `scratchpad/inventario-errores.sh` — densidad de `try/except/catch/throw/log` por capa, silencios candidatos, política Temporal, contrato HTTP, observabilidad | Control **positivo** (1501 `def` en backend) y **negativo** (patrón inexistente = 0) corridos en el mismo script |
| 6 barridos | Ejes A–F, `claude -p` headless sonnet, read-only, glob exclusivo, cada uno obligado a correr control positivo antes de tratar un 0 como hallazgo y a **refutar** lo que se le dio | 6/6 devolvieron refutaciones reales (§5) — un auditor que sólo confirma no está auditando |
| Costura | El contrato de error entre backend y cliente, la observabilidad end-to-end y los gates: lo que ningún eje ve porque está *entre* ejes | Verificado a mano contra el ref |

**Dos veces el instrumento mintió y el control lo cazó:** un grep de timeouts dio 0 por un pathspec
mal armado (los adaptadores existían), y un conteo de endpoints dio 0 con `^@app.` (son 80). En
ambos casos el vacío era del instrumento, no del código. Se corrió el control antes de escribir el
hallazgo — que es exactamente la disciplina que este repo ya tiene canonizada.

---

## 2. Lo que está BIEN (y es la palanca del fix)

Nombrarlo no es cortesía: **cada una de estas piezas es el molde que hay que replicar**, y eso hace
que los fixes sean baratos.

| Pieza | Por qué es de grado alto |
|---|---|
| `apps/copiloto/errores_web.py` | Catálogo **cerrado** de 11 códigos de conflicto, `ValueError` si se inventa uno, docstring que narra las dos veces que el bug mordió, y `test_errores_web.py:73` que **falla si aparece un 409 escrito a mano**. Es el mejor manejo de error del repo. |
| `packages/core/src/api/client.ts` | Un solo camino: `mapearError` único, refresh-on-401 con **single-flight** (porque GoTrue rota el refresh token), `safeJson` que no explota con body no-JSON. |
| `packages/core/src/api/errors.ts` | `ApiError.body` expuesto **con el razonamiento del bug que lo motivó** — y el aviso de que `codigo === null` significa "este deploy todavía no lo manda", no "no es conocido". |
| `apps/copiloto/memory_provider.py` | El molde del silencio **correcto**: degrada best-effort pero loguea `_log.warning` con `cliente_id` y excepción antes de degradar. |
| `motor/clients/agent/providers/llm.py:30` + `graphity_memory_client.py` | El molde del timeout correcto: timeout de red **por debajo** del `start_to_close` que lo envuelve (90s bajo 120s), y `NonRetryableError` para que Temporal no reintente un 401. |
| 8 módulos de `packages/core/src/api/` | `catch → if (noDesplegado) … if (!(err instanceof ApiError)) degradar … throw err`: red degrada, negocio se propaga. Consistente y **con test cada uno**. |
| `apps/copiloto/tests/test_adversarial_*` | Batería sólida de aislamiento cross-tenant. La regla dura del repo ("control sin test adversarial = control no verificado") **sí se cumplió** para autorización. |

---

## 3. La clase raíz única: *el fix existe y no se propagó*

Siete instancias verificadas del **mismo** patrón. No es una coincidencia de siete bugs: es un modo
de fallo del proceso.

| # | El fix que existe | Dónde NO llegó | Consecuencia |
|---|---|---|---|
| 1 | `errores_web.conflicto()` → código de máquina | Sólo los **409**: 12 de ~90 emisiones de error (13%). Los ~46× 400, 22× 404, 6× 503, 401, 403 viajan con `detail` en prosa | La app no puede discriminar la causa de un 400 salvo parseando texto — exactamente el bug que `errores_web` vino a matar, vivo en el 87% restante |
| 2 | `ApiError.body` (creado para leer el body crudo del error **sin** perder el refresh) | `packages/core/src/api/afip.ts:483` sigue bypasseando `apiClient` **citando como razón** justo lo que `ApiError.body` ya resolvió | `guardarPerfil`/`conectarArca` sin refresh-on-401: token vencido en el alta fiscal ⇒ logout |
| 3 | Refresh-on-401 en `request()` | `postMultipart` (`client.ts:162`) y, **por separado**, `apps/copiloto-web/src/lib/api/audio.ts` | Los dos frontends, independientemente, dejaron el **camino de voz** sin refresh: dictar con token vencido ⇒ logout **y audio perdido** (se borra en el `finally`). Asimetría escribir-vs-hablar |
| 4 | PR#114 — "una activity que lanza no puede matar el workflow en silencio" | `afip_anulacion_workflow.py:98-101` y `web.py:274-279` (`make_signal_factura`), agregados **después** del fix | §4.2 |
| 5 | El molde de log-antes-de-degradar de `memory_provider.py` | `presupuesto_doc.registrar_en_sheet`, `services/__init__.py:18`, `mercadopago_gateway.py:119` | Misma degradación, sin una línea de rastro |
| 6 | El molde de timeout-bajo-el-start_to_close de `llm.py` | `composio_gateway.py:94` (`Composio()` sin timeout) y `afip_gateway.py:100` | 2 de 6 gateways tienen la cota correcta; los dos que faltan son los que escriben afuera |
| 7 | try/catch → estado → JSX, bien hecho en ~40 sitios de mobile | `PantallaMiDia.avanzar()/borrar()` (mismo archivo que un `cargar()` impecable), `DetallePresupuesto.compartir()` (línea siguiente a un `abrirDoc()` protegido) | El swipe falla y **no pasa nada visible** |

**Por qué se propaga mal, medido:** no hay ningún mecanismo que lo fuerce.

- **Cero ESLint / ruff / flake8 en todo el repo** (control por contenido: ningún `package.json`
  menciona `eslint` ni un script `lint`; no hay `pyproject.toml` ni `.ruff.toml`). Sólo `tsc --strict`,
  que no ve un `catch {}` vacío ni una promesa flotante.
- **El CI corre 11 de 92 archivos de test Python (12%) y 0 de 96 de TypeScript.** No corre
  `typecheck`.
- **`test_errores_web.py` —el guard que impide un 409 sin código— NO está en la lista del CI.** El
  único mecanismo mecánico de propagación del contrato de error **no está en el camino automático**.

---

## 4. Hallazgos ALTA — los que cambian qué hacer el lunes

### 4.1 · Una línea explica el "narra sin hacer" — y la hipótesis oficial era otra

`motor/backend/agent/conversation_workflow.py:555`

```
trace.append(tc["name"])     # corre para CUALQUIER status != needs_confirmation, incluido "error"
```

El guardrail anti-narración (`:509`, condición `not trace`) usa `trace` para decidir si exigir un
retry `required`. Como una tool que **falló** se registra igual que una que tuvo éxito, si la tool
falla en el step 0 y el LLM cierra "Listo" en el step 1, **el retry no se dispara y el copiloto
narra un éxito que no ocurrió**.

**La hipótesis registrada en la memoria del proyecto —"el historial descarta los `tool_calls`"— es
falsa:** `_react_transcript` (`:389-390`, `:553-554`) apendea `tc_msg`/`tr_msg` con shape nativo en
**todos** los casos, incluido error. Lo que no lee el status es el *guardrail*, que mira una lista
aparte.

**Alcance honesto:** esto explica de forma verificada la variante *"la tool corrió, falló, y narró
éxito"*. La variante *"no llamó ninguna tool y narró éxito"* dejaría `trace` vacío y **sí** dispararía
el guardrail — así que esa otra variante, si existe, tiene otra causa y queda abierta.

**Verificado en primera persona.** El comentario de la propia línea lo dice: `# llegó hasta acá ->
execute_tool corrió de verdad`. El código registra que **corrió**; el guardrail lee eso como que la
acción **se hizo**. Y su comentario (`:507-508`) declara el supuesto explícitamente: *"si el turno YA
ejecutó una tool más temprano, un cierre 'Listo' es VERDAD"* — supuesto que es falso exactamente
cuando la tool devolvió `status="error"`. El único status que se ramifica antes del `append` es
`needs_confirmation`.

**Por qué es lo primero:** condicionar esa línea a `status == "ok"` arregla el guardrail para las ~14
tools sin tocar ninguna. Y este bug es el que sostiene el flag `MODO_AUTOMATICO_NO_DISPONIBLE`
(`errores_web.py`), que **hoy bloquea el modo automático del producto** — con dueño y condición de
retiro ya declarados. Cero test lo ejercita.

⚠️ **Corrección a mi propia estimación de costo:** el guardrail vive dentro de
`workflow.patched("narra-guardrail-required-retry")`, así que **no es "una línea" suelta**. Cambiar el
comportamiento del workflow requiere su propio `workflow.patched(...)` — los workflows en vuelo
replayarían distinto y eso es no-determinismo, que la regla 3 del `CLAUDE.md` prohíbe. El fix real es:
una línea + un patch de versionado + el test del camino `status="error"`. Sigue siendo el ítem más
barato de esta lista, pero se hace con la skill `temporal-developer` a la vista, no a mano alzada.

### 4.2 · Una nota de crédito real de AFIP que queda sin marcar, y una query que miente para siempre

`apps/copiloto/afip_anulacion_workflow.py:98-101` — `marcar_comprobante_anulado` corre **fuera de
todo try/except**, después de emitir la NC con CAE real. Si agota sus 3 reintentos: la NC **existe en
AFIP**, no está marcada localmente, el workflow queda `Failed`, y la query `estado()` responde
`paso="emitiendo_nota_credito"` **indefinidamente** — el cliente polea sobre un workflow muerto.

Es el patrón exacto que este repo ya tiene en memoria como *"el mensaje niega el efecto que ya
ocurrió"*, con dinero fiscal de por medio. Mismo patrón estructural en `web.py:274-279`
(`make_signal_factura`, consumido por 7 endpoints de facturación, incluido `confirmar_factura`): un
`handle.signal()` sin try/except.

**Y es la instancia más nítida de la clase raíz del §3: el criterio correcto está escrito tres líneas
más abajo, en el mismo archivo.** El bloque de deuda gestionada que sigue (`:104-115`, sobre el PDF de
la nota de crédito) dice textual: *"el fallo del PDF NO puede tumbar la anulación, la NC ya tiene
CAE"*. Ese es exactamente el criterio que `marcar_comprobante_anulado` necesita y no tiene — el
`emitir_comprobante` de arriba sí está envuelto en `try/except` con `self._motivo`. No falta el
conocimiento: falta la aplicación al sitio de al lado.

### 4.3 · Un blip de red se presenta como "esa factura no existe"

`web.py:166-170`, `:263-269`, `:343-349` — los tres `consultar_*` hacen `except Exception: return
None` sin log. Un timeout de Temporal colapsa a la **misma rama** que "el workflow nunca existió", y
`afip_web.py:272` lo traduce a **404 "factura no encontrada"**. Es el patrón *discriminar por
ausencia*: el usuario recibe una afirmación falsa sobre sus datos fiscales, y no queda rastro.

### 4.4 · Sin red de seguridad de render: pantalla blanca total en las dos apps

**0 `ErrorBoundary`** en `apps/mobile` (215 archivos) y **0** en `apps/copiloto-web`; además 0
`window.onerror` / `unhandledrejection` en la PWA y 0 `ErrorUtils` en mobile. Un `undefined.map` en
cualquier pantalla desmonta el árbol entero — y como mobile es una cáscara glass con Capa 0 y Capa 1
montadas de forma permanente, **no se pierde una pantalla: se pierde la app**, sin forma de volver
sin cerrarla. El disparador más probable no es exótico: un `kind` nuevo en una card que el mapping no
contemple.

### 4.5 · Ninguna request de la app tiene cota de tiempo

`apps/mobile/src/adapters/http.native.ts:36,52` — `fetch` sin `signal` y `uploadAsync` sin timeout,
en el **único** archivo que toca la red. **0 `AbortController` en las tres capas cliente.** Del lado
servidor la cota existe pero no es única ni corta: el peor caso depende de la activity —
`120s × 5 = 600s` en el loop del agente, `3min × 3 = 9min` en la emisión AFIP, `10min × 1` en el
alta— y **no hay un solo `activity.heartbeat()` en el repo**, así que un worker que muere a mitad no
se detecta hasta agotar el intento completo.

### 4.6 · Un fallo de `AsyncStorage` desloguea a un usuario que sí tenía sesión

`apps/mobile/src/adapters/almacen.ts:23-25` — `leer()` devuelve `null` tanto si no hay token como si
`getItem` **falló de verdad**, y el guard de `_layout.tsx` lee ese `null` como "no hay sesión" y
manda a login.

### 4.7 · El catch-all del agente funde tres clases de fallo en un mensaje, sin log

`apps/copiloto/tool_catalog.py:1492-1500` — un `except Exception` convierte error de negocio, error
técnico y **bug de programación** en el mismo *"no pude completar la acción; probá de nuevo"*, y es la
única rama del executor que **no** loguea. El contrato "nunca excepción → observación" (correcto,
lección de PR#114) se implementó como catch-all ciego en el borde, en vez de discriminar tipos como
sí hace el dispatcher legacy.

---

## 5. Refutaciones — lo que se creía y es falso

Incluye correcciones a mis propias hipótesis de esta sesión y al dossier del 2026-07-23.

| Se creía | La verdad, con línea |
|---|---|
| "El historial descarta los `tool_calls`" (memoria del proyecto) | Falso. `conversation_workflow.py:389-390,553-554` apendean siempre. La raíz es el guardrail (§4.1) |
| "`engine_mode` default = dispatch" ⇒ toda la clase de idempotencia del dossier 2026-07-23 colgaba de eso | Matizado, no refutado del todo: `worker_b.py:222` registra el dominio con `engine_mode="react"` **literal**, pero el modo con que ramifica el workflow (`conversation_workflow.py:207`) viene de `COPILOTO_ENGINE_MODE` que `web.py:501,542` le pasa. **La composición root está partida en dos** y el modo efectivo lo decide una env del VPS → `[REQUIRES_LIVE_VALIDATION]`. `worker_b.py:203-205` ya declara esta deuda con owner=operador ("un rollback a dispatch correría el dispatcher con el prompt de react"). Lo que sí cae es dar por cierto el "default = dispatch" leyendo sólo `agent_runtime.py:24` |
| Un 500 puede filtrar stack/SQL/credenciales al cliente | Falso. Sin `debug=True`, Starlette responde `PlainTextResponse("Internal Server Error")` fijo. El riesgo no es el leak: es que **no queda log** |
| "`getLogger` sin `basicConfig` ⇒ los logs se van al vacío" | Falso. `logging.lastResort` manda `warning+` a stderr y el unit tiene `StandardOutput=journal`. Los `_log.warning` **sí** llegan a journald (los `.info` no) |
| `crearCliente` bypassea `apiClient` (lo dice el docstring de `errors.ts`) | Ya no: `clientes.ts:340-350` usa `apiClient.post`. El único bypass vigente es `afip.ts:483`. **El comentario quedó viejo y me hizo afirmarlo** |
| El `client.ts` de la PWA legacy es un duplicado degradado | Falso. Tiene las 4 capacidades (single-flight refresh, clases tipadas, lectura tolerante) y 9 casos de test. El drift real es sólo `audio.ts` |
| `useChat` deja al usuario esperando sin feedback | Falso. Propaga a `sendStatus`/`motivoFallo` y `ChatView.tsx:186-191` lo renderiza. Mis números de línea estaban viejos |
| Los `.catch(() => {})` "vacíos" del grep son fallos silenciosos | Falso en la mayoría: el cuerpo tenía una línea que el grep no expandió. Sólo 2 casos genuinos, ambos documentados |
| `presupuesto_doc` "calcula un motivo y lo descarta" (dossier 2026-07-23) | Parcial: `generar_doc` **sí** lo conserva en `ResultadoDoc(motivo=…)`. El que lo tira es `registrar_en_sheet` |
| "El patrón bueno cubre 3 de ~90 emisiones" (mi conteo) | 12 de ~90 (13%). La conclusión cualitativa se sostiene; el numerador estaba subestimado |

---

## 6. Observabilidad: la mitad del sistema es ciega, y la otra mitad la salva Temporal

No es "gap total" como decía el dossier previo — hay que dividir:

- **Lo que pasa por un workflow es observable**: el history de Temporal registra cada activity, su
  fallo, sus reintentos y sus payloads. El moat durable **es** observabilidad, gratis.
- **Lo que no, es ciego.** De los **80 endpoints**, sólo `web.py` toca Temporal (16 sitios): los
  ~64 restantes son CRUD directo a Postgres. Con **6 loggers reales** en 32k LOC de backend y
  **0** `fingerprint` / `dlq` / `trauma` / `structlog` / `request_id` en toda la app, un 400 o un 500
  ahí no deja rastro.
- **El cliente no deja rastro de ningún tipo**: 0 `console.error`, 0 Sentry, 0 endpoint de logging,
  0 `window.onerror`, en las tres capas. Los 27 `catch` de la PWA y los 61 de mobile: 0 con rastro.
  El matiz que el barrido aportó y hay que respetar: la mayoría de esos catch son **degradaciones
  deliberadas y documentadas** — el problema no es que cada catch esté mal, es que **no existe ningún
  canal que un catch pudiera usar si quisiera**.
- **Retención de Temporal: 24 h.** Medido en el VPS vivo, no asumido:
  `Config.WorkflowExecutionRetentionTtl = 24h0m0s` (namespace `default`).

**Traducido, y es el dato más consecuente de todo el análisis:** la única observabilidad real del
sistema **se borra a las 24 horas**. Si un emprendedor dice *"ayer no me anduvo"* —el caso normal, no
el excepcional, porque la gente reporta cuando puede, no cuando pasa— **no hay absolutamente nada que
mirar**: el history ya se fue, no hay log estructurado de negocio, y el cliente nunca reportó nada a
ninguna parte. La ventana de diagnóstico del sistema es **más corta que su ciclo de feedback con el
usuario**.

Eso es lo que sube el canal de logging de "deuda de higiene" a **precondición para operar con
usuarios reales**: hoy el equipo puede arreglar sólo los bugs que alguien mira el mismo día.

---

## 6.bis · Lo que el journal dice que YA PASÓ (evidencia de producción, no análisis estático)

Todo lo anterior sale de leer código. Esto sale de `journalctl` del VPS, y **confirma el §4.3 con un
caso real**.

**El vacío que había que interrogar:** en las últimas 24 h, `uc-copiloto-web` y `uc-copiloto-worker`
tienen **0** líneas con traceback/error. Ese cero **no era un hallazgo**: el control positivo mostró
169 líneas totales y 155 requests 2xx en el web, y **2 líneas** en el worker — o sea, tráfico mínimo.
Un cero sobre casi-nada no dice nada. Ampliando a **7 días** (7051 líneas web / 700 worker):

| Patrón | Ocurrencias en 7 d |
|---|---|
| `Traceback` | 29 |
| `NonDeterministicError` (WARN del SDK) | 20 |
| `ImportError` | 15 |
| `NonRetryableError` | 2 (esperado — es el diseño de `llm.py`) |
| `HTTPError` / `AttributeError` | 2 / 1 |

**Primer resultado, que resuelve un pendiente:** los tracebacks **sí** llegan al journal. La
observabilidad de excepciones no capturadas existe, y su ventana es más larga que las 24 h del history
de Temporal. Lo que falta no es el transporte: es que los errores **tragados** nunca llegan a ser
excepción, así que no aparecen acá.

**Segundo resultado, y es el importante — la cadena causal completa, todo el 21 de julio:**

1. **15 × `ImportError: cannot import name 'make_consultar_anulacion' from 'web'`** — un deploy con
   `web.py` y `afip_web.py` desincronizados. Exactamente la clase de fallo que un `pytest --co` habría
   cazado… y el CI **sí** corre `--co`, pero el deploy no espera al CI.
2. Ese día, el `AfipOnboardingWorkflow` de un usuario terminó en **`WorkflowExecutionFailed`**
   (event id 11, run `019f85cd-…`).
3. Durante los **20 minutos siguientes** (18:10 → 18:30), una IP real refrescó su pantalla de AFIP.
   Cada `GET /afip/perfil` era seguido de un `GET /afip/estado` que hacía **query sobre el workflow ya
   fallado**. La query reventaba —`[TMPRL1100] Nondeterminism error: Complete workflow machine does not
   handle this event: HistoryEvent(id: 11, WorkflowExecutionFailed)`— **12 veces**.
4. **Y el endpoint devolvió `200 OK` las 12 veces**, porque `consultar_onboarding` (`web.py:166-170`)
   hace `except Exception: return None` y el handler traduce ese `None` a un estado de negocio normal.

**Lectura correcta (y corrección de la primera lectura, que fue mía):** esto **no** es "20 workflows
rotos por replay" ni el moat durable fallando. Es **un** workflow fallado, más un endpoint que traga el
error de la query y responde 200. El `NonDeterministicError` es un WARN del SDK sobre la *query*, no
sobre la ejecución — y es el **único** rastro que quedó, en un log de Rust que nadie mira.

**Lo que esto cambia:** el hallazgo §4.3 deja de ser hipotético. Un emprendedor real recibió, doce
veces seguidas, una afirmación falsa sobre su estado fiscal, construida sobre un error tragado, sin que
nada ni nadie se enterara. El bug del deploy **ya está corregido**; el mecanismo que lo hizo invisible
**está en `main` hoy** — la próxima vez que un workflow quede `Failed`, vuelve a pasar igual.

Y cierra el círculo con §6: para investigar esto hoy, el history de Temporal de ese run **ya no
existe** (retención 24 h). Lo único que sobrevivió 7 días fue el WARN del journal, por casualidad.

---

## 7. Orden de ataque (impacto ÷ costo, no severidad sola)

| # | Acción | Costo | Por qué ahí |
|---|---|---|---|
| 1 | `conversation_workflow.py:555` → condicionar a `status == "ok"`, **bajo su propio `workflow.patched(...)`** + test del camino `status="error"` | 1 línea + 1 patch de versionado + 1 test | Desbloquea el modo automático (feature de producto frenada por flag) y mata el falso "listo". Nada más en esta lista tiene esta relación. Con `temporal-developer` a la vista: toca un workflow |
| 2 | `ErrorBoundary` raíz en `apps/mobile/app/_layout.tsx` y en `apps/copiloto-web/src/App.tsx` + `window.onerror`/`unhandledrejection` en la PWA | 2 archivos | Convierte "app muerta sin retorno" en "pantalla con botón". Lo más barato de todo lo ALTA |
| 3 | Meter `test_errores_web.py` y `npm run typecheck` + `core:test`/`mobile:test` en el CI; agregar ESLint con `no-empty`, `no-floating-promises`, `require-await` | 1 workflow + 1 config | **Es lo único que impide que el §3 vuelva a pasar.** Barato y de una vez |
| 4 | `try/except` + persistir motivo en `afip_anulacion_workflow.py:98-101`; ídem `make_signal_factura` | 2 sitios | NC real sin marcar + query que miente para siempre |
| 5 | Timeout de red: `AbortController` en `http.native.ts` (2 requests, un archivo), `Composio(timeout=…)`, cliente AFIP | 3 sitios | Toda request de la app pasa por el primero: un fix, cota global |
| 6 | Refresh-on-401 en el camino de voz: `postMultipart` (core) y `audio.ts` (PWA) | 2 sitios | **Subió de prioridad al medir `GOTRUE_JWT_EXP=3600`**: con token de 1 h y uso esporádico, el dictado con token vencido es lo esperable, no un borde. Y el audio se borra en el `finally`: no hay reintento posible |
| 7 | Un `reportError(err, ctx)` (cliente) y el wrapper Temporal→HTTP con log (backend) — enchufados en los `catch` que ya existen | 2 helpers | **Subió al medir la retención de 24 h**: hoy sólo se pueden diagnosticar los bugs que alguien mira el mismo día. Es precondición para operar con usuarios reales, no higiene |
| 3.bis | Los 3 `consultar_*`: distinguir "no existe" de "no pude preguntar" (503 ≠ 404/estado normal) + log | 3 sitios | **Subió de #8 a acá: §6.bis lo encontró OCURRIDO en producción** — 12 respuestas `200 OK` falsas a un usuario real sobre su estado fiscal. Deja de ser hipotético |
| 9 | `error(status, codigo, mensaje)` hermano de `conflicto()`, y migración **incremental** de los 400/404 con semántica de negocio | incremental | Extiende el mejor patrón del repo a su 87% faltante. NO migrar los 400 de validación de forma |

**Lo que NO hay que hacer:** agregar `try/except` en los ~90 sitios, ni un log en cada uno de los 61
`catch` de mobile (la mayoría son degradaciones correctas), ni tocar los 86 call-sites de conexión
Postgres. Todos los fixes de arriba son de **un punto por clase**.

---

## 8. Lo que no se puede saber leyendo código

### 8.1 · Resuelto en esta sesión contra el VPS vivo (ya no son supuestos)

| Dato | Valor medido | Qué cambia |
|---|---|---|
| `COPILOTO_ENGINE_MODE` | **`react`** | Confirmado: el dispatcher es rama muerta en prod. La clase de idempotencia del dossier 2026-07-23 pierde su premisa (`react` **sí** transporta `idem_key`) |
| `GOTRUE_JWT_EXP` | **3600 s (1 h)** | **Sube la severidad del camino de voz.** Con un token de 1 h y una app de uso esporádico a lo largo del día, que el primer dictado de la tarde caiga con token vencido no es un borde: es lo esperable. El logout + pérdida del audio (§3.3) es un caso **probable**, no teórico |
| `WorkflowExecutionRetentionTtl` | **24 h** | §6 — la ventana de diagnóstico es más corta que el ciclo de feedback del usuario |
| Tracebacks en `journalctl` | **29 en 7 días** | El transporte de excepciones **no capturadas** al journal funciona (pendiente resuelto). Lo que no llega son los errores **tragados**: nunca son excepción |
| `NonDeterministicError` / `ImportError` | **20 / 15**, todos del 21-jul | §6.bis — la cadena causal de un caso real, con 12 respuestas `200 OK` falsas a un usuario |

### 8.2 · Todavía sin verificar

| Marca | Qué falta |
|---|---|
| `[REQUIRES_LIVE_VALIDATION]` | Comportamiento de un throw en render en **release build** en device (blanco vs crash vs mensaje) |
| `[ASSUMED_PENDING_VERIFY]` | Fuga de threads bajo `asyncio.to_thread` con tráfico real (`threading.active_count()` en el tiempo) |
| `[ASSUMED_PENDING_VERIFY]` | Si AFIP puede emitir **después** de que el cliente abandonó la conexión (riesgo de 2º CAE por thread huérfano) |
| `[ASSUMED_PENDING_VERIFY]` | Cuántas filas de trazabilidad faltan hoy en producción por el silencio de `registrar_en_sheet` (`sheet_fila IS NULL AND doc_link IS NOT NULL`) |
| `[ASSUMED_PENDING_VERIFY]` | TTL del access token en GoTrue — determina cuán probable es el logout del §3.2/§3.3 |
| `[REQUIRES_LIVE_VALIDATION]` | El valor de `COPILOTO_ENGINE_MODE` en el VPS — decide si el dispatcher es código muerto o una rama viva, y con ello la severidad real de la clase de idempotencia del dossier anterior (`ssh unreal-copilot "grep ENGINE /etc/unreal-copilot/copiloto.env"`) |

---

## 9. Cobertura adversarial: el sesgo medido

El repo prueba **aislamiento** adversarialmente (batería `test_adversarial_*` cross-tenant, sólida) y
**no prueba resiliencia**: 0 tests de "el gateway tarda más que el timeout", "la activity lanza",
"el worker muere a mitad", "el Sheet falla después de crear el Doc", "el 409 nuevo llega con un
código que el tipo TS no tiene". La regla dura del repo —*un control sin test adversarial es un
control no verificado*— está aplicada a autorización y **no** a manejo de errores. Un test
parametrizado por clase de fallo en `test_agent_activities_react.py` cubriría transversalmente los
hallazgos 4.1, 4.2, 4.5 y 4.7 sin escribir uno por bug.

Y una asimetría de contrato que nadie ata hoy: los 11 códigos de `errores_web.CODIGOS` y los 11 del
tipo `CodigoConflicto` (`errors.ts`) coinciden **por disciplina, no por mecanismo**. Nada cruza el
boundary Python↔TS, y `codigoDeConflicto` hace `as CodigoConflicto` — un código nuevo del backend
entra casteado y cae en el `default` del consumidor, en silencio. Es el mismo bug que `errores_web`
vino a matar, un nivel más arriba.

---

## 10. Reproducirlo

```bash
bash scripts/inventario-errores.sh > /tmp/inventario.md      # idempotente, read-only, contra el ref
REF=origin/main bash scripts/inventario-errores.sh           # o contra cualquier otro ref
```

El script trae sus propios controles (positivo y negativo) en la §10 de su salida: si el control
positivo no da >0, el instrumento está roto y **su silencio no se puede leer como "no hay
hallazgos"** — que es la trampa que este repo ya tiene canonizada como *un instrumento que no mira
nunca falla*.

*Los 6 barridos crudos, con sus refutaciones y sus marcas de no-verificable, quedaron en el
scratchpad de la sesión (`rep-{A..F}.md`); lo que sobrevivió a la verificación está acá.*
