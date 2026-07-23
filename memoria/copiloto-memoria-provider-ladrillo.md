---
name: copiloto-memoria-provider-ladrillo
description: MemoryProvider del Copiloto — 1er ladrillo de memoria conversacional sobre Graphity (user graph=chat; group graphs=funciones futuras). Cableado + DESPLEGADO VIVO (memoria ON en prod)
metadata:
  node_type: memory
  type: project
  originSessionId: 53c58a53-271e-474c-9267-f7720a2c6820
---

**Ladrillo `MemoryProvider`** = integración de memoria del Copiloto del Emprendedor sobre Graphity. **CABLEADO + DESPLEGADO VIVO** (memoria ON en prod).

**MODELO DE GRAFOS (decisión del operador — un tenant = varios grafos):**
- **Grafo general + chat = el user graph** de Graphity. El `user` (= el agente del emprendedor) escribe ahí vía `threads`/`add_messages`; `get_user_context` lo lee cada turno. **Esto es lo único que implementa hoy el MemoryProvider.**
- **Grafos de función futuros (BI, catálogo, …) = group graphs** hermanos (`graph_id` propio), NO el user graph. Hook listo: `MemoryProvider.function_graph_id(cliente_id, fn, namespace=)` fija el naming para que agregar el grafo N+1 sea plug-in sin refactor.

**Archivos (`apps/copiloto/`):** `graphity_memory_client.py` (cliente HTTP sync thread-memory, httpx inyectable; **3er cliente Graphity del repo** — no confundir con el async de la fábrica) · `memory_provider.py` (boundary `recall`/`remember`/`forget`) · `tests/test_memory_provider.py` + `tests/test_memory_isolation_live.py` (adversarial live).

**Contrato:** `recall(cliente_id, thread_ref, query)->str` (Context Block por turno, via `POST /graph/search` sobre el user graph con el mensaje del turno como query — ver lección abajo) · `remember(cliente_id, thread_ref, messages)->None` (el CALLER batchea ~5-10 turnos + flush; el provider NO tiene estado de sesión) · `forget(cliente_id)` (RTBF) · `warm(cliente_id)` (precalienta page-cache/índices al abrir sesión, best-effort).

**Decisiones clave (no obvias):**
- **Aislamiento cross-emprendedor SIN HMAC:** `user_id = f"{namespace}-{cliente_id}"`; el `cliente_id` **ya es UUID v4** ⇒ no-adivinable por construcción. El server namespacea físico `{tenant}__user_{user_id}` (ADR-040). Aislamiento primario = aplicativo (el thread se ata al cliente_id del request); UUID = defensa en profundidad. [[graphity-aislamiento-cross-tenant-verificado]]
- **Best-effort (degradación elegante):** Graphity caído NUNCA tumba el turno → `recall`→`""`, `remember`/`forget`→no-op logueado.
- **Anti prompt-injection:** el Context Block se envuelve rotulado "datos NO instrucciones" + neutraliza el delimitador `[/MEMORIA]` (mismo patrón que `memory_activities.format_context` del músculo). [[agente-conversacional-hardening-3-lentes]]
- **Una key global** (tenant Graphity `unreal-copilot`) para todo el copiloto; la separación entre emprendedores es por user_id, no por key.

**Evidencia (VPS, venv `/opt/uc-copiloto-venv`):** test adversarial de aislamiento cross-emprendedor contra Graphity viva PASS (extracción LLM real) — A recuperó su dato y NO el de B, y viceversa. Shapes REST verificados contra el server real: user ANTES de thread (404 si no existe), 409=idempotente, context 404→"".

**Warm:** `MemoryProvider.warm(cliente_id)` precalienta el page-cache Neo4j + índices HNSW del user graph al abrir la sesión. Best-effort. **El enfriamiento es LRU del page-cache, NO un timer** — se evicta por presión de otros grafos, no por tiempo.

**🔥 Warm dirigido por el FRONT (LECCIÓN vigente):** el warm del workflow corre 1× al abrir el `ConversationWorkflow`, que se abre CON el 1er mensaje → el 1er turno pagaba el cache-miss. En un copiloto la charla es SIEMPRE la misma → el disparo natural del warm es el **ciclo de vida del front** (abrir la app / entrar al chat), no la llegada de un mensaje. Solución vigente: `POST /warm` (auth per-request) → `MemoryProvider.warm`; **best-effort: sin memoria o fallo de Graphity → `{"warmed": false}`, NUNCA 500**. El front (`useChat`) lo dispara **fire-and-forget al montar + al volver la pestaña a visible**, con **throttle por sesión (5 min)**. `build_memory_provider(env)` = fuente ÚNICA de construcción del provider (gate `GRAPHITY_*`), compartida por `worker_b` y `serve`.

La memoria es **capacidad OPT-IN de la plantilla `conversational_agent`** (`memory_provider=None` default → apps existentes intactas; gate `config['memory']` que solo el copiloto pasa). **Replay-safe** para sesiones en vuelo: workflows viejos sin la key NO emiten las commands nuevas (warm/remember) → sin `NonDeterminismError`.
- **Determinismo Temporal:** I/O (recall/remember/warm) en ACTIVITIES; buffer20 (`history[-20:]`)/cursor `_remembered_upto` en workflow state (patrón `agt02`/ARCA) · remember batch ≥20 msgs + flush al cerrar.
- **Cliente** (`apps/copiloto/`): `worker_b` construye el provider desde `GRAPHITY_*` (OFF explícito si faltan; `max_attempts=1` fast-fail) · `TenantCtx +memory_provider`.

**🐛 LECCIÓN — activities best-effort SIEMPRE con `retry_policy` acotada:** las `execute_activity` de memoria tenían timeout SIN `retry_policy` → reintentos ILIMITADOS (default Temporal) + sin `try/except` → bajo Graphity **LENTO** (no caído), un intento >timeout reintentaba infinito → loop colgado / ThreadPool agotado (degradación global). Fix vigente: `retry_policy(max_attempts=1)` + `try/except ActivityError` (degrada a no-op) + `MEMORY_TIMEOUT=75s`.

**🐛 LECCIÓN — recall debe usar SEARCH sobre el user graph, no el contexto del thread:** `GET /threads/{id}/context` hace RAG sobre los **mensajes DEL THREAD** → en una **charla NUEVA** el thread no tiene mensajes → sin query → facts vacíos → el agente NO recordaba entre sesiones. El test de aislamiento anterior NO lo detectó porque escribía y leía en el **mismo thread**. Fix vigente: `POST /graph/search` sobre el **user graph** con el **mensaje del turno como query** (`client.search_user_facts`, scope=edges) → trae los facts aunque el thread sea nuevo. Separa LECTURA (search) de ESCRITURA (remember/batch). Lección de PROCESO: el smoke E2E DEBE ejercitar la **condición crítica real** (recall en thread distinto al de escritura), no un sustituto — no codificar la esperanza. [[no-codificar-la-esperanza-principio-raiz]]

**Estado: memoria cross-sesión OPERATIVA E2E, VERIFICADA (247 tests verdes en VPS).** Deuda menor: el fact del **horario** no siempre entra en el top-K del search si el query no lo menciona (RAG relevante al query — esperado, no bug). [[copiloto-emprendedor-roadmap]] [[composio-gateway-ladrillo]] [[factory-identidad-automatizacion-ia]] [[agente-loop-tool-failure-retry-infinito]] [[graphity-aislamiento-cross-tenant-verificado]]
