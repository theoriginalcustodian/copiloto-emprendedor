# Mapa de clases de error del copiloto — insumo para la 2ª pasada dirigida de Fable

> **Fase 2.5 del loop de auditoría** (2026-07-23, sesión de auditoría / Opus). La 1ª pasada de Fable
> (zero-context, report-only) dio 7 hallazgos + menores. En vez de parchear síntoma por síntoma,
> esta fase los **eleva a clases de error sistémicas** y barre grafo + código (contra `origin/main`)
> para encontrar TODAS las instancias — auditadas y no. El output alimenta una **2ª pasada de Fable
> dirigida**: en vez de "auditá la app", le damos las áreas exactas + el patrón + los paths.
>
> **Método:** 6 sub-agentes Sonnet en paralelo (read-only, glob exclusivo). El grafo de código
> (`code-copiloto-emprendedor`) LOCALIZA; el código real DECIDE (grafo no es fuente de verdad:
> reconcile pendiente + ciego a callables inyectados por DI). Toda instancia verificada
> archivo:línea contra `origin/main` (086becde), no contra la rama congelada ni el grafo.
>
> **Objetivo (operador):** fixes de RAÍZ orientados a **escalar con cero fricción** — no una guerra
> de fixes puntuales, sino saber con certeza **qué áreas auditar** ahora que estos errores revelaron
> sus clases.

---

## 1. Taxonomía de clases (juicio Opus)

### Clases confirmadas por Fable (síntoma → clase sistémica)

| Clase | Definición | Síntomas semilla | Frente |
|---|---|---|---|
| **C1** | Acceso a Postgres sin pool / I/O por elemento (N+1) | #2, #4.3, #6.1, #6.2, #6.4 | backend |
| **C2** | Writes externos no idempotentes bajo retry at-least-once | #3, #1.2 | backend |
| **C3** | Writes multi-sistema fuera de Temporal (best-effort, sin DLQ) | #3.2 | backend |
| **C4** | Superficie expuesta sin barrera (auth/rate-limit/costo) | #2.1, #2.2 | backend/infra |
| **C5** | Acoplamiento por string derivado, no FK real | #4.2 | backend |
| **C6** | Crecimiento sin cota / render proporcional al uso | #5.2, #5.3, #7 | frontend |
| **C7** | API externa síncrona en path caliente sin cache | #6.3 | backend (perf front) |
| **C8** | Firma que promete y no cumple (param ignorado) | #1.4 | backend |
| **C9** | Secretos/PII en el árbol del repo | #2.4, #2.5 | repo/higiene |

### Dimensiones NUEVAS (Fable NO las barrió)

| Dim | Qué sondea | Veredicto del barrido |
|---|---|---|
| **D-A** | Errores tragados en silencio (`except: pass`) | 🔴 SÍ auditar — 4 sitios de alto impacto sin log |
| **D-B** | Timeouts/cancelación en llamadas externas | 🟠 acotado — Composio SDK sin timeout |
| **D-C** | Validación de input en boundaries HTTP | 🟢 ya resuelto (patrón `Decimal(str())` repetido) |
| **D-D** | datetime naive vs aware | 🟢 disciplina alta (reloj inyectado); residuo defensivo |
| **D-E** | Logging estructurado / fingerprint DLQ | 🔴🔴 SÍ auditar — gap TOTAL sistémico |

> **Nota macro (grafo):** el `traverse` de `conn_factory` unió **C1↔C3** — `_generar_doc_y_fila`
> (best-effort fuera de Temporal) es también consumidor del conn sin pool. Las clases no son
> ortogonales: **C1 es la raíz que agrava a C6.1-backend y a C3**.

---

## 2. Superficie por clase (verificada contra `origin/main`)

### C1 — Postgres sin pool / N+1 · MUY ampliado vs Fable
- **86 call-sites / 20 archivos** abren conexión nueva (control ejecutado: `git grep -c` → 86/20 exacto). Fable nombró ~11%; el resto es la misma clase colgando de la misma raíz.
- **3 NUEVOS de severidad alta:**
  1. `inteligencia_queries.py:178 portada()` — endpoint de home (el más visitado); el docstring dice "UNA conexión" pero abre 2 (instrumento que confirma en vez de verificar).
  2. `context_factory.py:35 → mp_credential_store.first_seller_user_id()` — abre conexión en **cada activity `dispatch_intent`** del ReAct, más frecuente que el request HTTP.
  3. `cliente_store.py:451 derivar_clientes()` — N+1 por loop (≥1+2P+C conexiones), offline.
- `trabajo_store.imputar()` = mismo doble-open que `margen()` (nuevo, medio).
- Densidad: `inteligencia_queries.py` (8), `afip_credential_store.py` (11), `cobro_store.py` (11).
- **FIX RAÍZ:** pool en el ÚNICO punto raíz (`_conn_factory_from_env` serve.py + closure worker_b.py) → `conn_factory()` presta del pool, sin tocar la firma de los 20 stores. **NO tocar 86 sitios.** OJO: en psycopg2 `with conn` hace commit pero NO cierra → el pool debe devolver la conexión explícitamente en un context manager.

### C2 — Writes externos no idempotentes + C3 — writes fuera de Temporal
- **11 writes externos sin protección real** (8 C2 en activity con retry + 3 C3 fuera del moat); **solo 1 (MP react) tiene dedup**, y con ventana TOCTOU.
- **Inventario de idempotencia:** gmail ❌ · googledocs ❌ · googledrive ❌ · googlesheets (append+update_range) ❌ · calendar ❌ · MP ⚠️ (solo react) · AFIP ✅ (child-workflow, fuera de glob) · Doc/Sheet presupuesto ❌.
- **RAÍZ estructural (más grave que la semilla):** dos engines, `engine_mode` default = **dispatch**. `dispatch_intent` (`conversation_workflow.py:270-275`) **NO recibe `idem_key` en su payload** → el modo dispatch no tiene por dónde conectar dedup para NINGÚN write, ni `mp_charge` (`dispatcher_emprendedor.py:104`). `execute_tool` (react) sí lo recibe pero `_execute_proposal` no lo propaga a `gateway.execute`.
- `presupuesto_doc.py:106-152`: `generar_doc` calcula un `motivo` de fallo y lo **descarta**; `registrar_en_sheet` hace `except: return None` sin log → fallo invisible hasta para debug (C3, MEDIA-ALTA).
- **`[REQUIRES_LIVE_VALIDATION]`:** qué tenants corren cada modo (config por tenant, fuera del glob).
- **FIX RAÍZ:** tabla de dedup genérica `(cliente_id, idem_key) → resultado` con claim-first (INSERT ON CONFLICT RETURNING antes del efecto), consultada en el executor genérico; **derivar `idem_key` en modo dispatch** (hoy no viaja). Mover `_generar_doc_y_fila` a activity Temporal o, mínimo, persistir `doc_pendiente=true` consultable.

### C4 — Superficie sin barrera · Fable exhaustivo, 0 huecos nuevos
- **71 endpoints inventariados; exactamente 3 huecos** (`web.py:654 /auth/signup`, `:662 /auth/login`, `:674 /auth/refresh` — confirmados por control). 68/71 con `Depends(require_tenant)`/`require_claims` verificado uno por uno. `/mp/callback` y `/mp/webhook` = barrera cripto propia OK.
- **Rate-limit = 0 de 71** en todo el repo (ni app ni Caddy). El hueco no tiene mitigación de borde.
- Solo `/auth/signup` crea recurso facturable (tenant → habilita `/chat` con COGS LLM $1-12/user/mes).
- **FIX RAÍZ:** invite-token de env (fail-closed) o deshabilitar signup email/password en prod dejando OAuth; rate-limit en Caddy sobre `/auth/*`.

### C5 — Acoplamiento por string derivado · ampliado vs Fable
- Formato `factura-{cliente_id}-{factura_id}`: **5 sitios / 3 archivos** (`web.py:206`, `presupuesto_store.py:79` y `:107`, `trabajo_store.py:102` y `:116`). Fable vio 2 → 40% de la superficie; faltaban `presupuesto_store.py:107` (SQL de `facturado`) y `trabajo_store.py:116` (inversa del `resolver()`).
- **Raíz:** `afip_comprobantes` solo guarda `workflow_id`, sin `factura_id` propio → NO hay FK. wf_id = única columna de enlace.
- **Agujero de test:** solo 1 de 5 reconstrucciones atada por test → cambio de formato rompe 4 en silencio.
- **FLAG auditoría aparte:** `conv-` (wf_id de ConversationWorkflow) cruza boundary motor↔copiloto — sería C5 cross-capa si se reconstruye del lado copiloto (hoy no). Requiere `motor/**` en scope.
- **FIX RAÍZ:** persistir la FK real (`afip_comprobantes.factura_id` o `copiloto_presupuestos.comprobante_id`) al momento en que ya se conoce; joinear por columna. El wf_id vuelve a ser privado de `web.py`.

### C6 — Crecimiento sin cota (front) + C7 — externa sin cache
- **9/9 hallazgos de Fable confirmados.** Peor caso: Chat (Capa 1, montado permanente) = reducer sin cota (`chatMachine.ts:187,228`) + persistencia O(N) por evento (`useChat.ts:116`) + render sin virtualizar (`ListaMensajes.tsx:171`).
- **NUEVO:** 4 pantallas de listado (`Presupuestos/Gastos/Clientes/Ingresos`) con el mismo `.map`-en-`ScrollView` vía `ScrollFormulario` → **un fix al patrón cubre las 4**. Control negativo: `ListaActividad.tsx` ya usa `FlatList` (precedente correcto en el repo).
- `EscritorioFunciones.tsx:267` setState por frame (Capa 0, montado permanente).
- C7: `/me`, `/catalog`, `/afip/estado` llaman `list_connections` sin TTL; `/afip/estado` es el PEOR (pagina 2× vía `connection_status`→`list_connections`). 4º call-site `web.py:629` `[ASSUMED_PENDING_VERIFY]`.
- **FIX RAÍZ:** cap `slice(-N)` en persistir/hidratar chat; guardar booleano no píxel en el onScroll; variante virtualizada de `ScrollFormulario`; TTL-cache per-tenant en el gateway Composio invalidado por connect/disconnect.

### C8 — Firma mentirosa · confirmado, sin nuevos
- `signal_anulacion` (`web.py:309-314`) ignora `payload`; gemela sana `signal_factura` (`web.py:272-277`). Único caller manda `None` → inocuo hoy, se pierde sin error con el primer payload real. Barrido de afip_web.py (25 handlers) + presupuestos_web.py sin más casos.

### C9 — Secretos/PII: riesgo git en checkout COMPARTIDO (acción inmediata)
- 3 `.txt` de secretos + `.env.e2e` = gitignoreados OK (pero el nombre queda público en `.gitignore`).
- **`Factura/` (fotos comprobantes=PII), `_evidencia/` (capturas de login, salvo `.apk`), `code/` (clon de otro repo) NO tienen regla `.gitignore`** (control: `git check-ignore` rechaza los 3). Hoy untracked, pero un `git add -A` los commitea — y el checkout lo comparten 3 sesiones. **Acción: gitignorar/mover YA** (independiente del resto).

### Dimensiones nuevas (D-A..E)
- **D-E (logging/fingerprint) 🔴🔴:** 0 ocurrencias de `fingerprint`/`structlog`/`dlq`/`trauma`. `print()` es el status de prod (`serve.py:231,249,267`, `worker_b.py:126,248`). `agent_activities.py:87` imprime la **transcripción de voz completa a stdout** sin gatear (comentario advierte PHI). Gap total contra la doctrina.
- **D-A (errores tragados) 🔴:** 4 sitios sin log — `tool_catalog.py:1131` (hot path ReAct), `inteligencia_chat.py:144/168` (chat dice "no sé" ante cualquier fallo), `services/__init__.py:26` (módulo roto saltea sin rastro), `mercadopago_gateway.py:119` (firma-atacante vs bug interno mezclados).
- **D-B (timeouts) 🟠:** `composio_gateway.py:94` `Composio()` sin timeout → fuga de threads bajo `asyncio.to_thread` cuando Temporal marca timeout a 120s pero el I/O bloqueante sigue vivo. Único de 3 gateways sin timeout.
- **D-C 🟢** ya resuelto (`Decimal(str())` + 400 en ≥10 sitios). **D-D 🟢** disciplina alta (`workflow.now()`/reloj inyectado); residuo: cada lector nuevo de `reference_time` de Graphity debe repetir la normalización de `graphity_memory_client.py:_parse_iso`.

---

## 3. Áreas a auditar con certeza (lo que el operador pidió)

Ordenadas por riesgo de escala (qué se rompe primero al pasar de N a 1000× usuarios/datos):

| # | Área | Clase | Por qué es superficie, no punto |
|---|---|---|---|
| 1 | **Árbol de stores DI (pooling)** | C1 | 86 sitios, 1 raíz. Techo de `max_connections` con ~65 conn/s a 50 usuarios. |
| 2 | **Modo dispatch + `services/*`** (idempotencia) | C2 | El modo default no transporta `idem_key`; 5 servicios Composio sin dedup. |
| 3 | **Observabilidad transversal** | D-E | Sin logging estructurado ni fingerprint, no se puede diagnosticar a escala multitenant. |
| 4 | **Hot-path del agente ReAct** (errores tragados) | D-A | Fallos sistemáticos invisibles hasta el síntoma de usuario. |
| 5 | **Writes multi-sistema fuera de Temporal** | C3 | `presupuesto_doc` + cualquier otro efecto fuera del moat durable. |
| 6 | **wf_id como clave de negocio** | C5 | 5 reconstrucciones del mismo literal; 1 test las ata. |
| 7 | **Gateway Composio** (timeout) | D-B | Punto de mayor superficie de red de terceros, sin timeout. |
| 8 | **Superficie `/auth/*` + higiene de root** | C4, C9 | 3 huecos + 0 rate-limit; 3 dirs con PII sin gitignore en checkout compartido. |

---

## 4. Prompt v2 para Fable (headless, zero-context, DIRIGIDO)

> La diferencia con la v1: NO es "auditá la app". Es "acá está el patrón de CADA clase + los
> archivos donde ya se detectaron instancias + el criterio de raíz; confirmá/refutá cada instancia
> leyendo el código, encontrá las que se nos escaparon, y rankeá TODO por riesgo de escala".
> Fable sigue siendo zero-context y report-only; le damos el mapa como input, no como conclusión a
> ratificar (debe poder refutar).

```
Sos un revisor externo zero-context del repo copiloto-emprendedor (agente conversacional durable
multitenant: Temporal + FastAPI + React Native). Report-only, NO tocás código. Verificá CADA
afirmación contra el código real (git show origin/main:<path> / git grep), no asumas ni tomes este
documento como verdad — podés y debés refutar lo que no se sostenga.

Hubo una 1ª pasada tuya. Esta es DIRIGIDA por clases de error. Por CADA clase de abajo te damos:
la definición, los archivos donde YA se detectaron instancias (con línea), y el criterio de fix de
raíz que proponemos. Tu trabajo por clase:
  1. CONFIRMAR o REFUTAR cada instancia listada, leyendo el código real.
  2. Encontrar instancias NUEVAS de la misma clase que no están en la lista.
  3. Juzgar si el FIX DE RAÍZ propuesto escala con CERO fricción o le falta algo (efectos de borde,
     un caso que rompe, deuda que reintroduce).
  4. Rankear TODO (viejo + nuevo) por RIESGO DE ESCALA: qué se rompe primero cuando la app pase de
     N a 1000× usuarios/datos.

[INYECTAR AQUÍ las secciones §2 de este dossier, clase por clase, con sus instancias verificadas y
 el fix raíz propuesto. Incluir los [REQUIRES_LIVE_VALIDATION] y [ASSUMED_PENDING_VERIFY] como
 preguntas abiertas para que Fable las marque, no las resuelva a ciegas.]

Foco del operador: escalar con CERO fricción. No microoptimización — riesgo estructural.
Fuera de scope: infra externa (servidores/DB), features faltantes conocidas.
NO re-auditar: el bug "narra sin ejecutar" (ya en curso con dueño) y la hipótesis SQLite (descartada
con evidencia en la 1ª pasada, D5.5).
```

---

## 5. Coordinación (§5 del handoff)

Esta sesión es la **4ª sobre checkout compartido**. Este dossier es un **entregable de diseño**, no
un volcado al buzón: los contratos `contrato_` NO se emiten a `coordinacion/` sin coordinar con la
sesión PLANIFICACIÓN (dueña del buzón), que está mid-sprint cerrando el E2E device. **Próximo paso
sugerido:** el operador decide si (a) lanzamos la 2ª pasada de Fable con el prompt §4, o (b) primero
priorizamos qué clases bajan a `contrato_` (con DoD binario + E2E device) y en qué orden, sin
saturar a backend/frontend. La acción C9 (gitignore de `Factura/`, `_evidencia/`, `code/`) es la
única que conviene ejecutar YA por el riesgo en checkout compartido, y es de una línea.

---

*Dossier de la Fase 2.5 (mapa de clases), 2026-07-23. Los 6 reportes de barrido crudos viven en el
scratchpad de sesión (`mapa-C1..D-*.md`). Toda instancia verificada contra `origin/main`; el grafo
de código se usó para localizar, no como fuente de verdad.*
