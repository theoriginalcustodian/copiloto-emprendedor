# Plan de infraestructura de producción — Copiloto del Emprendedor (3 nodos dedicados)

> **Fecha:** 2026-07-05 · **Estado:** DISEÑO (decidido, no provisionado) · **Owner:** operador
> **Fuente de datos:** footprint **medido en vivo** en el VPS de dev + precios **reales** de la Hetzner Cloud API (2026-07-05). Los números de capacidad por usuario son `[ESTIMADO — pendiente load test]`.
> Memoria: `copiloto-arquitectura-prod-3-nodos`. Reemplaza el sizing especulativo por uno con evidencia.

---

## 0. Objetivo y principio

Sacar el Copiloto de producción del VPS actual (`unreal-copilot`, CX33) —que es **solo dev/test** y comparte RAM con Hermes, WhatsApp y la fábrica— a **su propia infra dedicada de 3 nodos**, con datos y auth propios (independencia real de `fusion`).

**Principio de sizing (contraintuitivo, confirmado por medición):** el LLM corre en APIs externas → el nodo de aplicación **casi no consume**. El peso está en los servicios **stateful** (Postgres/Supabase y, sobre todo, Neo4j/Graphity). El nodo "app" NO es el que hay que agrandar.

---

## 1. Footprint MEDIDO (dev VPS, 2026-07-05)

VPS de dev completo: **2.1 GB usados de 7.6 GB** (con Hermes + WhatsApp + fábrica encima). Desglose de lo que es **solo del Copiloto**:

| Componente | RAM idle medida | Nota |
|---|---|---|
| Temporal server | 195 MB | El moat; latencia-sensible |
| Temporal Postgres | 73 MB | |
| Temporal admin-tools + UI | 148 MB | **Dev-only** — se dropean en prod |
| GoTrue (auth + su Postgres + proxy) | ~48 MB | Muy liviano |
| `uc-copiloto-web` (uvicorn + BFF + SPA) | 138 MB | |
| `uc-copiloto-worker` (Temporal worker) | 79 MB | |
| **Total nodo App (prod, sin dev-tools)** | **~530 MB idle** | Crece con concurrencia (pools + workflows en vuelo), no con nº de usuarios registrados |

**Conclusión:** el nodo App entra holgado en 8 GB incluso con mucho headroom de concurrencia. `fusion` y `graphity` no fueron medibles desde el VPS (viven en otros hosts) → se sizean por blueprint (§4).

---

## 2. Arquitectura objetivo (3 nodos + red privada)

```
                 Internet (HTTPS)
                       │
              ┌────────┴─────────┐
              │  NODO APP        │   copiloto.<dominio> + auth.<dominio>
              │  Temporal + PG   │   web (uvicorn+SPA) · worker · GoTrue
              └───┬──────────┬───┘
    red privada   │          │   red privada (Hetzner Cloud Network, sin salida a Internet)
   ┌──────────────┴──┐    ┌──┴───────────────┐
   │ NODO FUSION      │    │ NODO GRAPHITY    │
   │ Supabase/Postgres│    │ Neo4j + Graphiti │
   │ (datos SoT)      │    │ (memoria grafo)  │
   └──────────────────┘    └──────────────────┘
```

- **Nodo App** — el único con cara a Internet (Caddy: `copiloto.*` + `auth.*`). Corre Temporal + su Postgres + worker + web + GoTrue.
- **Nodo fusion** — clon dedicado de la Supabase/Postgres del Copiloto (datos: `uc_factory.tenants`, `mp_credentials`, etc.). **Solo escucha en la red privada.**
- **Nodo Graphity** — clon dedicado de Neo4j + el servicio Graphiti (memoria de largo plazo). **Solo escucha en la red privada.**

**Alcance:** 1 clon fusion + 1 clon graphity sirven a **TODOS** los emprendedores del Copiloto (multi-tenant adentro, RLS [VERIFIED]). NO es una instancia por usuario.

---

## 3. Red privada + seguridad (no negociable)

- **Hetzner Cloud Network (privada)** entre los 3 nodos, misma network-zone `eu-central`. Postgres (5432) y Neo4j (7687/7474) **jamás** escuchan en la IP pública — solo en la privada. En dev hoy se usa túnel SSH; en prod eso no va.
- **Firewall Hetzner:** nodo App abre 80/443 (+ 22 restringido); nodos fusion/graphity **cero puertos públicos** salvo 22 desde IP de gestión.
- **Auth loopback:** GoTrue queda en el nodo App en loopback (como hoy), servida al browser solo por el vhost OAuth-only (`auth.*`, ya diseñado, ver `copiloto-gotrue-dedicada-cutover`).
- **Secretos** server-side (env 600), nunca en repo. TLS Let's Encrypt automático (Caddy) para los vhosts públicos.

---

## 4. Sizing por nodo (con precios reales Hetzner — net EUR/mes, EU: hel1/nbg1)

> Línea **CX** (Intel, cost-optimized) = mejor €/GB hoy; disponible en **hel1**. Si se prefiere `nbg1`/`fsn1`, usar CPX (AMD) o CAX (ARM) — tabla de equivalencias abajo. Precios **net (sin IVA)**, verificados contra la API el 2026-07-05.

### 4.1 Recomendación — Tier PILOTO (arranque, ≤ cientos de activos/día)

| Nodo | Server | vCPU / RAM / disco | €/mes | Por qué |
|---|---|---|---|---|
| **App** | **CX33** | 4 / 8 GB / 80 GB | **8,99** | Idle ~530 MB → 8 GB sobra; headroom de concurrencia |
| **fusion** | **CX43** | 8 / 16 GB / 160 GB | **18,49** | Supabase self-host (varios contenedores) + DB que crece |
| **Graphity** | **CX43** | 8 / 16 GB / 160 GB | **18,49** | Neo4j es hambriento de RAM (heap + page-cache) |
| Red privada | Cloud Network | — | **0** | Gratis en Hetzner |
| **Subtotal** | | | **~45,97 €/mes** | ≈ **$50 USD** |
| Backups (auto, +20%) | | | **~9,20 €/mes** | Opcional pero recomendado |
| **TOTAL PILOTO** | | | **~55 €/mes** | ≈ **$60 USD** |

### 4.2 Recomendación — Tier CRECIMIENTO (miles de activos)

| Nodo | Server | vCPU / RAM | €/mes | Cambio |
|---|---|---|---|---|
| **App** | CX43 | 8 / 16 GB | 18,49 | + réplica horizontal del worker cuando haga falta |
| **fusion** | CX53 | 16 / 32 GB | 34,99 | DB grande + read-replica futura |
| **Graphity** | CX53 | 16 / 32 GB | 34,99 | Grafo grande + embeddings |
| **TOTAL** | | | **~88 €/mes** (+backups ~€18) | ≈ **$115 USD** |

### 4.3 Cuando Temporal sea el cuello (escala alta)
Mover **Temporal + su Postgres** a un nodo **dedicado** (vCPU dedicada = sin *noisy neighbor*): **CCX23** (4 dedic / 16 GB, €101,49) o **Temporal Cloud** (gestionado). Es el moat y lo latencia-sensible → primero en aislar.

### 4.4 Tabla de equivalencias (si se elige otra línea/DC)

| RAM | CX (Intel, hel1) | CPX (AMD, nbg1/fsn1) | CAX (ARM, nbg1/fsn1) | CCX (dedicada) |
|---|---|---|---|---|
| 8 GB | CX33 €8,99 | CPX31 €20,49 | CAX21 €12,49 | CCX13 €50,49 |
| 16 GB | CX43 €18,49 | CPX41 €37,99 | CAX31 €24,99 | CCX23 €101,49 |
| 32 GB | CX53 €34,99 | CPX51 €83,49 | CAX41 €48,49 | CCX33 €162,99 |

> Los 3 nodos deben estar en la **misma network-zone** (`eu-central`) para la red privada. Si se usa la línea CX (solo hel1), los 3 van a **Helsinki**. Traffic: 20 TB incluidos por nodo → sobra.

---

## 5. Capacidad por tier de usuarios `[ESTIMADO — pendiente load test]`

El cuello del nodo App no es CPU/usuario (LLM externo) sino **concurrencia + pools**. Con uso *bursty* (1 msg cada pocos min):

| Server nodo App | Activos/día (uso *light*) | Activos/día (uso *heavy*: tareas concatenadas + cobros + memoria intensa) |
|---|---|---|
| CX33 (8 GB) | ~300–600 | ~50–150 |
| CX43 (16 GB) | ~800–1500 | ~150–400 |
| + réplicas de worker | escala ~lineal | escala ~lineal |

> **Estos números son estimados sin medición.** El §8 (load test) los reemplaza por datos. El límite real probable aparece antes en **fusion/Graphity** (conexiones a DB, latencia de Neo4j) que en el nodo App.

---

## 6. Migración de datos + auth off-`fusion` (el trabajo real)

Hoy: datos del Copiloto en la Postgres de `fusion` (compartida) · auth en la GoTrue dedicada del VPS de dev. Independencia real exige moverlos:

1. **fusion → nodo fusion propio:** `pg_dump` de los schemas del Copiloto (`uc_factory` + lo que use) → restore en el Postgres del nodo nuevo. Repuntar `DATABASE_URL` (`fusion-pg.env`) a la IP privada del nodo fusion. Verificar RLS + extensiones.
2. **GoTrue → nodo App de prod:** desplegar el stack `deploy/copiloto/gotrue/` (ya idempotente) en el nodo App; migrar usuarios (`migrate_tenants.py`, ya existe) o re-alta. Repuntar `SUPABASE_URL` a la GoTrue del nodo App.
3. **Graphity → nodo graphity propio:** clonar la instancia (blueprint Graphity) + repuntar el `MemoryProvider` a la IP privada. Verificar aislamiento cross-emprendedor [VERIFIED] contra la instancia nueva (spike de aislamiento ya existe).
4. **Cutover:** DNS de `copiloto.*`/`auth.*` al nodo App nuevo; smoke E2E (login email + Google, chat con tarea concatenada, cobro MP, recall de memoria) ANTES de dar de baja el dev.

> Cada repunte es **grep-first** (enumerar TODAS las ocurrencias del ID/URL viejo en un solo barrido) para no dejar mitades. Rollback = repuntar envs a los valores previos + restart.

---

## 7. Backups / DR (día 0, no afterthought)

- **fusion:** `pg_dump` diario + snapshot Hetzner; retención 7–30 días; **restore probado** (un backup sin restore probado no es backup).
- **Graphity:** dump de Neo4j (`neo4j-admin database dump`) + snapshot; el grafo es reconstruible-parcial desde los datos de fusion pero costoso → tratar como stateful de primera.
- **Tooling:** `fleet-platform` ya trae backups/DR + observabilidad `obs-*` → vendorear, no reinventar.
- **Snapshots automáticos Hetzner** (+20% del precio) como red de seguridad barata.

---

## 8. Load test (reemplaza los estimados por datos) — 1ª tarea técnica

Antes de comprometer tiers, **medir**: script que simule N usuarios concurrentes contra el nodo App (login + chat + polling de reply + una tarea concatenada), escalando N hasta que la latencia p95 degrade. Output: curva **usuarios concurrentes → p95 / RAM / CPU** por tamaño de nodo. Recién ahí el §5 deja de ser `[ESTIMADO]`.

---

## 9. Escalado por eje (cómo crece cada nodo, sin big-rewrite)

| Eje | Cómo escala |
|---|---|
| **App/worker** | Horizontal: más réplicas del worker (stateless) apuntando al mismo Temporal. Barato. |
| **Temporal** | Vertical → nodo dedicado (CCX) → Temporal Cloud. Task Queue **Fairness** para que un tenant grande no *starve* a los chicos (multi-tenant). |
| **fusion (Postgres)** | Vertical → read-replicas → connection pooler (PgBouncer/Supavisor) para muchas conexiones. |
| **Graphity (Neo4j)** | Vertical (RAM: heap + page-cache tuneados). Sharding solo si el grafo explota. |

---

## 10. Plan de ejecución (fases)

1. **F0 — Load test en dev** → número real de capacidad (§8). *(De-risk: valida el sizing antes de gastar.)*
2. **F1 — Provisionar 3 nodos + red privada + firewall** (idempotente, IaC/scripts; blueprints `supabase-self-host-blueprint` + Graphity + `fleet-platform`).
3. **F2 — Migrar fusion (datos) + Graphity (memoria)** a sus nodos (§6.1, §6.3) con restore probado.
4. **F3 — Desplegar nodo App** (Temporal + web + worker + GoTrue) + repuntes a IPs privadas (§6.2).
5. **F4 — Cutover** (DNS + smoke E2E completo) + baja controlada del dev-as-prod.
6. **F5 — Backups/DR + observabilidad** verificados (restore real, alertas).

**Estimación wall-time (con scripts idempotentes + blueprints existentes):** F1–F5 ≈ **1–2 días de trabajo efectivo** (no semanas — casi todo es blueprint ya probado + repuntes). F0 (load test) ≈ medio día.

---

## 11. Decisiones abiertas (para el operador)

1. **¿Clon fusion completo (stack Supabase) o solo Postgres?** El Copiloto usa la DB directo (`DATABASE_URL`) y la auth ya es la GoTrue dedicada → podría alcanzar **solo Postgres** (más barato/liviano) en vez del stack Supabase completo. *Recomendación: confirmar qué features de Supabase se usan; si es solo la DB, nodo fusion = Postgres puro (CX33 8 GB alcanza).*
2. **Ubicación:** ¿Helsinki (hel1, línea CX barata) o Nuremberg (nbg1, CPX/CAX)? Afecta latencia al usuario final (LatAm) — todas son EU; la latencia la domina el LLM externo, no el DC.
3. **Temporal Cloud vs self-host** cuando escale (§4.3): gestionado (menos ops, más caro) vs nodo propio.

---

## 12. Bottom line

- **Piloto dedicado de 3 nodos ≈ €55/mes (~$60 USD)** con backups — barato para una infra de producción real y aislada.
- El nodo App es liviano (medido: ~530 MB); el gasto está en fusion y Graphity.
- Cimientos correctos; el trabajo real es la **migración de datos/auth** + un **load test** que convierta los estimados en números. Nada de esto es terreno nuevo: todo se apoya en blueprints ya probados del workspace.
