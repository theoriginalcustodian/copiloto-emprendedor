# Pasada 2 — Robustez (los errores que todavía no descubrimos)

> **Estado:** PLAN, sin ejecutar. **Índice:** [ESTRATEGIA](2026-08-12-ESTRATEGIA-tres-pasadas-de-auditoria.md)
> **Precondición:** Pasada 0 cerrada. **Paralela con:** Pasada 1 (worktrees separados).
> **Muta código:** NO. Read-only; los fixes se diseñan y contratan después del triaje conjunto.

---

## Pregunta que responde esta pasada

> El E2E pasa. ¿Qué se rompe igual cuando hay **datos reales, concurrencia, fallos parciales de
> terceros y semanas de uptime** — es decir, todo lo que el happy-path de una sesión de device no
> ejercita?

Esta es la pasada que realmente decide "casi listo para producción". La Pasada 1 pregunta si alguien
puede *atacar* la app; ésta pregunta si la app se cae sola.

**Por qué "todo funciona E2E" no la vuelve innecesaria:** el E2E se corrió con **un** tenant, **un**
device, sin concurrencia, sin fallos de red inducidos y con volúmenes de juguete. Tres de los
hallazgos vivos de agosto (C1 pool/N+1, C2 idempotencia, C7 latencia Composio) son exactamente de esta
clase: **invisibles en E2E, fatales en producción**.

---

## Instrumento

No hay plugin de seguridad para esto. Se usa lo que el repo ya tiene:

1. **El loop Fable documentado** —
   `Fable 5 zero-context AUDITA → Opus ANALIZA + DISEÑA fixes de raíz + CONTRATA → implementan + E2E device`
   (`memoria/loop-auditoria-fable-analisis-opus-contratos-e2e.md`). Ya produjo dos pasadas útiles en
   julio. El valor del zero-context es que **no comparte los supuestos del que escribió el código**.
2. **Agentes headless por subsistema**, en paralelo (`claude -p ... --output-format json`,
   `run_in_background`). El gate del harness bloquea sub-agentes inline: se lanzan headless.
3. **`/diagnosing-bugs`** para cualquier síntoma concreto que aparezca.
4. **El mapa de clases de error ya existente** — `2026-07-23-mapa-clases-error-insumo-fable-v2.md`
   (9 clases × 5 dimensiones). Se **reutiliza como insumo dirigido**, no se reinventa.

---

## Los seis frentes

### F1 — Conexiones y carga (hereda C1)

**C1 está 🔴 VIVO y confirmado el 2026-08-12**, con evidencia dura: `git grep
ConnectionPool|psycopg_pool|pgbouncer` en `apps/copiloto` → **0**. Las 2 raíces siguen con
`psycopg2.connect` directo (`serve.py:96`, `worker_b.py:384`) y **el patrón se propagó a 5 stores
nuevos** durante el sprint (`concepto_store`, `feedback_store`, `grafo_sync_store`, `metering_store`).
N+1 de `margen_por_trabajo` (`inteligencia_queries.py:418`) intacto (~1+3N). Conexiones bare sin
`with`: `mp_dedup_store`, `reply_store`, `mp_credential_store`.

El diagnóstico ya está hecho; lo que falta acá es la **medición** y el diseño del fix:

- **Consulta clave (el entregable):** ¿cuál es el `max_connections` real y a cuántos usuarios
  concurrentes equivale? Hoy nadie tiene ese número, y es el que define si la beta aguanta.
- Los 4 workers de Temporal + la web, ¿comparten ese techo? ¿Qué pasa exactamente al agotarlo:
  degradación o caída dura?
- Fix declarado: PgBouncer + pool `ThreadedConnectionPool` detrás de `conn_factory`. Evaluar cuál de
  los dos, o ambos.
- Las conexiones bare sin `with` son fugas: cuantificar.

### F2 — Idempotencia y writes externos (hereda C2, C7, D-B)

- **C2 — ⚠️ PARCIAL, mejoró este sprint:** `mp_dedup_store.py` tapa **1 de las 2 rutas** de
  MercadoPago. Falta la otra, y falta Composio entero. Un retry de Temporal sobre la ruta destapada
  sigue siendo **doble cobro**: consecuencia económica directa.
- **C7 — 🔴 VIVO, confirmado:** `git grep TTLCache|lru_cache|cachetools` en `apps/copiloto` → **0**.
  `/me` (`web.py:869/882`), `/catalog` (`web.py:906`) y `/afip/estado` (`afip_web.py:557`) golpean el
  SDK síncrono **en cada request**. Está en el camino caliente de la app.
- **D-B:** timeout no explícito (bajo).
- El patrón bueno ya existe (`cobro_store`): la pregunta es **dónde no está aplicado**.
- Precedente real y reciente: el bug de prod donde `channel_ref` no era idempotente y rompía el
  `workflow_id` de Temporal en hilos largos (PR#375). Misma clase. **Buscar las hermanas.**

### F3 — Durabilidad de Temporal (el moat)

Es la columna del producto: si falla acá, falla la promesa entera.

- **Determinismo:** ¿algún workflow usa `datetime.now()`, `random`, `uuid4()` o I/O directo fuera de
  una activity? Un no-determinismo rompe el replay de ejecuciones **ya en vuelo**.
- **Versionado:** hay 47 ejecuciones abiertas de `conversation_workflow` anteriores a un deploy
  (medido en CTXW1). ¿Qué pasa con ellas ante el próximo cambio de código? ¿Se usa `patched`/versioning?
- Políticas de retry: ¿hay alguna activity con reintento infinito, o sin backoff?
- Timeouts: `start_to_close` y `heartbeat` en las activities largas (AFIP, Composio, LLM).
- Tamaño de payload: el claim-check para historiales grandes, ¿está aplicado donde hace falta?

### F4 — Caminos de error y DLQ (hereda C3)

El frente de manejo de errores está cerrado en prod y hay autohealing global — **por eso mismo** hay
que verificar sus bordes, no asumirlos.

- **C3 — ⚠️ PARCIAL, mejoró:** ya loguea el `motivo` con fingerprint, pero **falta la DLQ real**. El
  fallo se ve, pero nadie lo recupera.
- **D-A — 🔴 4 errores tragados, los 4 siguen vivos**, y la re-verificación anota algo peor: durante
  el sprint se agregaron **comentarios que documentan y justifican el mutismo** en vez de arreglarlo.
  Un `except` silencioso con un comentario que lo explica sigue siendo un error invisible: la clase
  entera se revisa acá.
- ¿Qué otros caminos de error **no** depositan trauma? Un error que no llega a la DLQ no existe.
- El fingerprint `(workflow + nodo + error_type + payload_shape)`: ¿colisiona o se fragmenta?
- El autohealing abre PRs solo: ¿qué pasa si se dispara sobre un error que *no* puede arreglar —
  loop de PRs?
- **Print de PHI** (`agent_activities.py`) 🔴 vivo → se cierra en la **Pasada 1** (es fuga de datos).
- **0 traumas reales:** la DLQ nunca recibió un trauma de producción. Es el mismo patrón que
  "instrumentos que confirman en vez de verificar": un pipeline de errores que nunca procesó un error
  real no está verificado. **Control positivo obligatorio:** inducir un fallo real y ver el trauma
  llegar de punta a punta.

### F5 — Límites y volumen (hereda C6)

- **C6:** chat y listas sin cota, "M-WEB duplicó". Una sesión de chat de 6 meses, ¿qué renderiza?
- Paginación: ¿qué endpoint de lista devuelve **todo** sin `limit`? Con 3 años de facturas, `/afip/comprobantes` es el candidato.
- La ventana de contexto se subió a `REACT_TAIL=80` (CTXW1): ¿cuál es el costo real por turno a los
  21 turnos, y cuándo se vuelve caro?
- Crecimiento sin techo: tablas de actividad, auditoría, metering. ¿Hay retención o crecen para siempre?

### F6 — Configuración y secretos en runtime

- ¿Algún `cliente_id`/tenant sale de una env var en vez del `context_factory`? (viola la regla 6 del
  proyecto; el metering de SOP4 ya tuvo un caso de worker mal cableado).
- Fail-closed vs fail-open: si Composio/Groq/AFIP no responde, ¿el sistema **niega** o **deja pasar**?
- ¿Qué pasa al arrancar sin una env var? ¿Crash ruidoso (bien) o `None` silencioso que rompe 40
  minutos después (mal)?

---

## Método

1. **Barrido zero-context** (Fable o headless equivalente) sobre los 6 frentes, en paralelo, uno por
   frente. Prompt dirigido por el mapa de clases de error existente.
2. **Consolidar y deduplicar** contra los 9 hallazgos de la Pasada 0 — un hallazgo ya conocido no es
   un hallazgo nuevo.
3. **Reproducir** cada candidato contra el sistema real: test de integración, query a Temporal, o
   medición en el VPS. **Un hallazgo no reproducido no entra al reporte** (canon 1 y 7).
4. **Rankear** por `consecuencia × probabilidad`, no por facilidad de arreglo.
5. **Diseñar fixes de raíz** (canon 6): parche con TODO+dueño+fecha sólo si la raíz es MAYOR y se
   escala.

**Mocks no cuentan:** la regla del proyecto es integración > mocks. Un fallo de idempotencia se prueba
con Postgres real y un retry real de Temporal, no con un doble.

---

## Definition of Done — Pasada 2

- [ ] Los 6 frentes recorridos, cada uno con veredicto explícito (incluso "sin hallazgos", con evidencia).
- [ ] C1, C2, C3, C6, C7, D-B con estado actualizado y reproducción real (o cierre demostrado).
- [ ] **Número de concurrencia conocido:** cuántos usuarios simultáneos aguanta hoy, medido, no estimado.
- [ ] Cada hallazgo tiene reproducción documentada (comando o test que lo exhibe).
- [ ] Fixes de raíz diseñados y contratados; lo MAYOR escalado al operador con Plan v1 + v2.
- [ ] Nada aceptado por autoevaluación de un agente.

## Lo que esta pasada NO hace

- No busca vulnerabilidades de seguridad (Pasada 1) — salvo que un hallazgo de robustez resulte
  explotable, en cuyo caso se pasa a la Pasada 1.
- No refactoriza por estilo ni legibilidad (Pasada 3).
- No implementa los fixes: los **diseña y contrata**. La implementación va después del triaje conjunto.
