# Load test (F0) — spec de instrumentación del Copiloto

> **Fecha:** 2026-07-05 · **Estado:** DISEÑO (listo para construir) · **Owner:** operador
> **Objetivo:** reemplazar el `[ESTIMADO ~1k–5k activos/día]` del plan de infra por un **número medido**, y — clave — **atribuir el cuello a un componente concreto** (Neo4j vs extracción async vs embeddings vs Temporal vs Postgres vs rate-limits externos), no solo "el sistema se puso lento".
> Complementa: `2026-07-05-plan-infra-produccion-3-nodos.md` §8/§10-F0.

---

## 0. Principio

Un load test que solo mide "p95 de la respuesta" dice *cuándo* cede pero no *quién*. Instrumentamos **por componente** para que la curva de capacidad venga con **atribución**: cuando la latencia sube, sabemos si fue el grafo, la cola de ingest, el embedding, el worker o un 429 externo.

**Modelo de carga realista (input del operador):** usuario de uso medio ≈ **50–100 acciones/día**, **textos cortos**, **recall 1×/turno**, **remember batcheado cada 20 mensajes** (verificado en código: `conversation_workflow.py:203` + `memory_provider.py`).

---

## 1. Las 3 métricas de Graphity (el pedido)

| # | Métrica | Qué responde | Cómo se captura |
|---|---|---|---|
| **G1** | **Neo4j — QPS + latencia de recall** (`search_user_facts`) p50/p95/p99 | ¿El grafo es el cuello? (esperado: NO a estos volúmenes) | **Client-side:** timer alrededor de `MemoryProvider.recall` en el worker → histograma etiquetado `op=recall`. **Server-side:** Neo4j query log / `SHOW TRANSACTIONS` muestreado + métricas Prometheus de Neo4j (`db.query.execution`, active transactions). Correlacionar ambos. |
| **G2** | **Cola de extracción async (ingest)** — profundidad + latencia batch→extraído | ¿La ingesta se atrasa bajo carga? (es async, no gatea el chat, pero si se atrasa la memoria "llega tarde") | **Client-side:** timer de `remember` + contador de batches enviados/seg + si la API devuelve `202 + ingq_<id>`, registrar el task_id. **Server-side (Graphity):** profundidad de la cola de ingest (tareas `ingq_` pendientes) muestreada cada N s + tiempo `add_messages → episodio procesado` (poll del task hasta completado). |
| **G3** | **Embeddings/turno** — nº + latencia + tokens | El recall semántico embebe la query del turno → 1 llamada externa/turno (centavos, pero es dependencia por turno) | **Server-side (Graphity):** contador de llamadas al modelo de embedding por request de search (si el embed es API externa: nº + tokens + latencia; si es modelo local: throughput + saturación). Requiere un contador en el servicio Graphity o leer sus logs. **Fallback client-side:** descomponer la latencia de `recall` (total − tiempo Neo4j puro ≈ embedding + red). |

> **Nota de implementación:** G1 client-side y G2 client-side salen **gratis** (solo timers en el `MemoryProvider`/worker). G1/G2/G3 **server-side** requieren tocar el nodo Graphity: habilitar métricas Prometheus de Neo4j + exponer un contador de ingest-queue y de embeddings en el servicio Graphiti. Es una **deuda de observabilidad gestionada** (registrar TODO + hacerlo en el F1 de infra, junto con `obs-*` de `fleet-platform`).

---

## 2. Métricas de app / infra (para el número de capacidad)

| # | Métrica | Cómo |
|---|---|---|
| A1 | **Latencia E2E del turno** p50/p95/p99 (send → reply visible por polling) | En el driver (VU): timestamp al POST /chat y al reply del /reply. |
| A2 | **Concurrencia sostenida** (turnos en vuelo) + throughput (turnos/seg) | Contador en el driver. |
| A3 | **Recursos por nodo** (RAM/CPU) app · temporal · fusion · graphity | Sampler `docker stats`/`node_exporter` cada 5–10 s por nodo → serie temporal. |
| A4 | **Temporal** — latencia de workflow/activity task + backlog de task-queue | Métricas nativas de Temporal (`temporal_*` Prometheus) + `tctl`/UI. |
| A5 | **Postgres (fusion + temporal)** — conexiones activas, latencia de query, pool saturado | `pg_stat_activity` muestreado + PgBouncer stats si hay pooler. |
| A6 | **Rate-limits externos** — nº de **429** de LLM / Composio / MercadoPago | Contador en las activities de esos boundaries (etiqueta por proveedor). |
| A7 | **Error rate** — turnos fallidos / colgados / timeout | Driver + logs del worker. |

---

## 3. Diseño del driver (VUs realistas)

- **Herramienta:** Locust (Python — reusa el stack) o k6. Cada **VU** = 1 emprendedor sintético con token propio (provisionado por la admin API de GoTrue, prefijo `loadtest-`).
- **Comportamiento por VU** (modela las 50–100 acciones/día comprimidas a la ventana de test):
  - Envía un mensaje cada `T` s (distribución **Poisson**, no uniforme → simula picos).
  - Mezcla de acciones (parametrizable): ~80% chat/recall · ~15% acción con tool (ejercita ReAct + Composio/MP) · ~5% turno memoria-intensa. Cada 20 turnos dispara el **flush batch** de remember (natural del sistema).
  - Textos **cortos** (corpus sintético fiel al uso real).
- **Rampa:** subir VUs por escalones hasta que **A1 p95 cruce el umbral** (ej. 3–5 s de respuesta percibida) **o** A7 > 1%. Ese escalón = **la rodilla de capacidad**.
- **Salida:** curva **VUs concurrentes → {A1, A3 por nodo, G1, G2, A6}**. La rodilla + la métrica que saturó primero = el número duro + su causa.

---

## 4. Dos corridas (separa infra de rate-limits/COGS)

1. **Corrida A — LLM MOCK (cuello de INFRA puro).** Stub del proveedor LLM (respuestas canned con latencia realista sorteada). Mide el techo de **Neo4j + Temporal + Postgres + worker** SIN gastar tokens y SIN que un 429 externo enmascare la infra. **Es la que da el número de "cuántos aguanta el hardware".**
2. **Corrida B — LLM REAL, N chico (calibración).** Con N moderado y LLM real: calibra la latencia real del turno + **cuándo aparecen los 429** (A6) + el COGS/turno real. **Es la que dice si el techo llega antes por rate-limit/plata que por hardware.**

> Sin separar las dos, "el sistema aguanta X" mezcla 3 límites distintos y no sabés cuál mover.

---

## 5. Seguridad / decisiones ANTES de correr (gate — MAYOR)

Correr esto tiene externalidades reales; el operador decide:

1. **¿Contra qué target?** (a) el **VPS de dev actual** (compartido con Hermes/WhatsApp/fábrica → el test puede molestarlos + los números NO son los de un nodo dedicado) · (b) un **clon aislado efímero** (números limpios, cuesta levantarlo). *Recomendación: Corrida A contra un clon efímero del nodo app+graphity para número limpio; Corrida B chica contra dev.*
2. **Polución de datos:** el test escribe en fusion + Graphity. **Tenants sintéticos `loadtest-` + cleanup al final** (o correr contra clon descartable). Nunca tocar data de tenants reales.
3. **Costo:** Corrida A (mock) ≈ $0 de LLM. Corrida B (real) = tokens reales → acotar N y duración.
4. **Observabilidad server-side (G1/G2/G3):** requiere el paso de habilitar métricas en el nodo Graphity (ver §1 nota). Si no está listo, la 1ª pasada corre solo con instrumentación **client-side** (G1/G2 parciales) y se completa cuando el F1 monte `obs-*`.

---

## 6. Entregable del F0

Un reporte con: **curva de capacidad** (VUs → p95) + **tabla de atribución** (qué saturó primero y a cuántos VUs) + los **3 números de Graphity** (G1 QPS/latencia, G2 profundidad-de-cola, G3 embeddings/turno) + **COGS/turno real** (de la Corrida B). Con eso, el §5 del plan de infra deja de ser `[ESTIMADO]`.

---

## 7. Deuda de observabilidad gestionada (registrar, no invisible)

La instrumentación **server-side de Graphity** (métricas Neo4j Prometheus + contador de ingest-queue + contador de embeddings) **no existe hoy** → es una tarea del **F1 de infra**, junto con el vendoring de `obs-*` de `fleet-platform`. **Propietario:** operador · **Condición de pago:** antes de la Corrida A "limpia" (si no, esa corrida sale con G1/G2 client-side parciales y G3 estimado por descomposición de latencia). Marcado acá para que no sea invisible.
