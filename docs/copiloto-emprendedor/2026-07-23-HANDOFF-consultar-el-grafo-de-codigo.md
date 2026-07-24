# HANDOFF — Cómo consultar el grafo de código del copiloto (para la sesión de auditoría)

> **Generado:** 2026-07-23 por PLANIFICACIÓN. Todos los ejemplos de acá se **corrieron contra el grafo
> vivo** — no son supuestos. El grafo se pobló hoy con el arco autopoiético (graphify → Graphity bridge)
> y se actualiza incremental en cada `git push`.

---

## 1. Qué es este grafo (y qué NO es)

Es el **grafo de código** del repo: archivos, funciones, clases y sus relaciones (quién llama a quién,
quién define/importa qué, co-cambios históricos). Extraído **sin LLM** (determinista) por `graphify`.

- **SÍ cubre** (los `source_dirs` ingeridos): `apps/copiloto`, `apps/copiloto-web`, `apps/mobile`,
  `packages/core`, `motor`, `scripts`, `spikes`, `deploy`.
- **NO cubre** (excluido a propósito): `code/` (submódulo ajeno), `docs/`, `coordinacion/`, `memoria/`,
  `_evidencia/`, `_staging/`, y los `.txt` de secretos del root. Si buscás algo de ahí y no aparece,
  **no está roto: está fuera de alcance.**

⚠️ **Estado al 2026-07-23:** el **alta** está completa (grafo poblado). El **reconcile** (podado de nodos
de código borrado) quedó en pausa por un guard de seguridad → **puede haber algunos nodos stale de una
ingesta parcial previa.** Para auditar *qué existe hoy en el código*, cruzá siempre contra el archivo real
(el grafo apunta a `source_file:source_location`, andá y leelo). No tomes la sola presencia de un nodo como
prueba de que el símbolo existe hoy.

---

## 2. Cómo conectarse — MCP `graphity-code`

Las herramientas ya están registradas en este entorno con el prefijo **`mcp__graphity-code__`**
(instancia `graphitymt.duckdns.org`, tenant `graphity-selfgraph`). En una sesión de Claude Code,
cargalas con ToolSearch:

```
ToolSearch  "select:mcp__graphity-code__graphity_search,mcp__graphity-code__graphity_traverse_node,mcp__graphity-code__graphity_get_node,mcp__graphity-code__graphity_get_observations"
```

### 🔑 LA REGLA DE PRECISIÓN #1 — SIEMPRE pasá `group_id`

El grafo vive en un tenant que aloja **4 repos**. Si NO scopeás, buscás en el default y **mezclás repos**.
En **toda** consulta del copiloto pasá:

```
group_id = "code-copiloto-emprendedor"
```

(Si algún día querés cruzar varios repos con un ranking unificado, usá `group_ids: [...]` — pero para
auditar el copiloto, es el `group_id` único de arriba.)

---

## 3. El vocabulario (para consultar con precisión, no a ciegas)

**Labels de nodo** (`node_labels` filtra la búsqueda en scope `nodes`):
- `File` — un archivo. `attributes.source_file` = ruta relativa.
- `Function` — función/método. `attributes.source_location` = línea (`L550`).
- `Class` — clase.
- `ExternalSymbol` — símbolo importado de fuera del repo (dep externa).
- `Doc`, `Adr`, `Endpoint` — nodos sintéticos (doc/ADR/ruta HTTP) cuando aplican.

**Tipos de arista** (`edge_types` filtra en scope `edges`):
| Edge | Significa |
|---|---|
| `DEFINES` | archivo/clase **define** función/método |
| `CALLS` | función **llama** a función/método |
| `INDIRECT_CALL` | llamada indirecta (vía referencia) |
| `IMPORTS` | archivo **importa** símbolo |
| `REFERENCES` | referencia sin llamada |
| `RE_EXPORTS` | re-exporta un símbolo |
| `CITES` | doc/código **cita** un ADR/RFC |
| `HANDLED_BY` | Endpoint HTTP **es atendido por** una Function |
| `CO_CHANGES_WITH` | dos nodos **co-cambian** en N commits (señal de acoplamiento histórico) |

Cada arista (`fact`) trae `valid_at` / `invalid_at` (bitemporal). `invalid_at: null` = vigente.

---

## 4. Recetas verificadas (corridas hoy)

### 4.1 Buscar un símbolo y ver sus relaciones inmediatas
`graphity_search` con `scope: "combined"` (edges + nodes juntos):

```
graphity_search
  query   = "registrar_gasto tool handler and conversation workflow"
  group_id= "code-copiloto-emprendedor"
  scope   = "combined"
  limit   = 8
```
Devolvió, entre otros (real):
- nodo `_run_registrar_gasto()` — `Function`, `source_file: copiloto/tool_catalog.py`, `L550`,
  summary *"Propone un gasto dictado. NO persiste…"*.
- aristas `File tool_catalog.py defines Function _run_registrar_gasto()` (DEFINES),
  `Function .tool_executor() calls Function _run_registrar_gasto()` (CALLS).

### 4.2 Explorar a fondo un nodo — `traverse`
Tomá el `uuid` del nodo (de la búsqueda) y navegá sus vecinos:

```
graphity_traverse_node
  node_id    = "<uuid del nodo>"
  direction  = "both"          # incoming | outgoing | both
  edge_types = "CALLS,DEFINES" # vacío = todas
  only_valid = true            # excluí aristas ya expiradas (código viejo)
  limit      = 50
```
- `direction: "incoming"` sobre una función = **quién la llama** (impacto de cambiarla).
- `direction: "outgoing"` = **qué usa ella** (sus dependencias).

### 4.3 Solo entidades (nodos), filtrando por tipo
```
graphity_search
  query      = "workflow durable temporal"
  group_id   = "code-copiloto-emprendedor"
  scope      = "nodes"
  node_labels= ["Function"]
```

### 4.4 Solo relaciones de un tipo (edges)
```
graphity_search
  query     = "quién importa el gateway de composio"
  group_id  = "code-copiloto-emprendedor"
  scope     = "edges"
  edge_types= ["IMPORTS"]
```

---

## 5. Cómo auditar BIEN con esto (el flujo que recomiendo)

1. **Localizá** el área con `graphity_search` (combined) + `group_id`.
2. **Confirmá contra el archivo real** — el nodo trae `source_file:source_location`. Abrilo y leelo.
   El grafo es el índice, **no** la fuente de verdad (y puede tener nodos stale hasta que corra el reconcile).
3. **Medí impacto** con `traverse` `direction:incoming` (quién depende) antes de afirmar "esto se puede tocar".
4. **Acoplamiento histórico**: `CO_CHANGES_WITH` te dice qué archivos cambian juntos — hotspots que un
   grep no ve.
5. **Nunca afirmes "no existe" desde un search vacío** — corré el control (buscá algo que SÍ está, ej.
   `_run_registrar_gasto`) para confirmar que tu consulta/scope funciona antes de concluir ausencia.

---

## 6. Gotchas (los que ya pagué)

- **Sin `group_id` → mezclás 4 repos.** Es el error #1. Siempre scopeá.
- **Reconcile pendiente** → algunos nodos pueden ser de una ingesta parcial vieja. Cruzá contra el archivo.
- **Un `search` vacío no prueba ausencia** — puede ser el scope/label mal puesto. Control primero.
- **El grafo se actualiza en cada push** (incremental). Si auditás justo después de un merge grande, puede
  ir unos minutos atrás del código; el `created_at`/`valid_at` de las aristas te dice de cuándo es el dato.
- **Fuera de alcance ≠ roto:** `docs/`, `memoria/`, `coordinacion/`, `code/` no están en el grafo por diseño.
```
```

**Instancia:** `graphitymt.duckdns.org` · tenant `graphity-selfgraph` · group_id `code-copiloto-emprendedor`.
