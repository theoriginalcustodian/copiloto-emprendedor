# Ingesta determinista al grafo (0-LLM) — qué existe, verificado, y cómo copiarlo

**Fecha:** 2026-07-22 · **Método:** leído contra el código real de los dos lados (servidor `Graphity`, consumidor `documed`), no contra docs ni memoria. Cada afirmación abajo tiene ruta + línea.

> **La pregunta que responde este documento:** ¿qué tenemos instalado y funcionando para meter información en un grafo **sin pasar por un LLM**, y qué hace falta para replicarlo acá?

---

## 0. TL;DR

| | |
|---|---|
| **El mecanismo existe y está probado en producción** | `POST /api/v2/graph/structured` con `dedup:"exact"` — **0 llamadas LLM** (sí genera embeddings). Servidor: `Graphity/src/graphity_memory/services/structured_ingest.py:711` |
| **Es agnóstico de dominio** | El propio **grafo de código** (`CodeSymbol`/`calls`) se ingesta por esta vía. No hay nada clínico en el mecanismo. |
| **El consumidor de referencia** | `documed` — 5 módulos, ~5.500 líneas, ~46 tests del escritor + una suite adversarial de 1.388 líneas + un E2E contra servidor real. |
| **Qué tiene HOY `copiloto-emprendedor`** | **Nada de esto.** Su único cliente de grafo es `apps/copiloto/graphity_memory_client.py` (243 L), que usa la vía **con LLM** (`add_messages` → extracción server-side, timeout 35 s). Cero ocurrencias de `graph/structured`, `uuid5` o dedup de grafo en todo el repo. |
| **Qué se copia tal cual** | `graph_identity.py` (105 L, solo stdlib) — de ahí, ~50 líneas son 100 % agnósticas. |
| **Qué se re-escribe** | El *mapping* de dominio (en documed: 1.923 L de entidades clínicas). Eso es tu ontología, no la de ellos. |
| **El mejor punto de partida** | `documed/spikes/graphity_structured/` — `spike.py` (16 KB) + `RESULT.md` (17,6 KB) = las 8 preguntas contestadas **contra el servidor real**. Leer el `RESULT.md` **antes** de escribir una línea. |

---

## 1. El contrato del servidor (Graphity) — verificado

### 1.1 Endpoints

| Verbo · ruta | Para qué | Dónde |
|---|---|---|
| `POST /api/v2/graph/structured` | **Crear** nodos+aristas en batch, 0-LLM | `api/v2/graph.py:1562-1621` |
| `GET /api/v2/graph/structured/{migration_id}` | Pollear el resultado | `api/v2/graph.py:1624-1637` |
| `PATCH /api/v2/graph/edge/{uuid}` | **Invalidar** una arista (`invalid_at`) | `api/v2/graph.py:3145-3203` |
| `GET /api/v2/graph/edges/{uuid}` | Leer una arista **con sus `attributes`** | `api/v2/graph.py:1810-1835` |
| `POST` o `PUT /api/v2/graph/../entity-types` | Registrar la ontología | `api/v2/graph.py:2439-2599` |

⚠️ `POST /api/v2/graph/ontology` está **deprecado y devuelve 501**. Usar `/api/v2/entity-types`.

### 1.2 El request (`StructuredIngestRequest`, `models/api/structured.py:109-134`)

```python
mapping: StructuredMappingSpec        # source_entity + edges
rows: list[dict]                      # min 1, MAX 10_000
group_id: str | None
dedup: Literal["exact", "smart"] = "exact"
validate_only: bool = False           # dry-run → 200, no escribe
on_error: Literal["partial", "strict"] = "partial"   # ⚠️ el default es el peligroso
```

El `mapping` (`structured.py:15-106`) declara **una entidad raíz por dataset** y N aristas salientes:

```python
source_entity = {
  "entity_type": "...", "name_column": "...", "external_id_column": "...",
  "property_map": {col: atributo}, "edges": [ ... ]
}
edge = {
  "column": "...",                       # la columna que nombra el destino
  "target_entity_type": "...", "edge_type": "...",
  "target_external_id_column": "...",    # ⚠️ omitirlo = dedup por VALOR (ver trampa 7)
  "fact_template": "{source} X {target}",
  "valid_at_column": "valid_at",
  "property_map": {...}, "target_property_map": {...}
}
```

**Regla estructural:** una fila = **una** entidad raíz + N aristas salientes. Todo lo que no sale de esa raíz **es otro dataset** (otro POST). Es la restricción que más forma le da al diseño.

### 1.3 La respuesta y el polling

`POST` → **202** `{migration_id, status:"pending", rows_queued, chunks_total, status_url, ...}`.

**El 202 NO significa escrito — significa encolado.** Hay que pollear `GET .../structured/{migration_id}` hasta `status ∈ {completed, failed}`, y ahí leer `totals {created, updated, skipped, failed}` + `row_errors`.

### 1.4 Auth y tenancy

- Header **`X-API-Key: gphy_…`** (falta → 401). El tenant sale de la key.
- El endpoint structured **exige project scope**: sin él → **400 "Project scope required for structured ingest"** (`graph.py:1593-1598`).
- El `group_id` que mandás es **lógico**; el servidor persiste `{tenant_id}__{lógico}`. Importa para el punto siguiente.

### 1.5 Límites duros

| Límite | Valor | Dónde |
|---|---|---|
| filas por request | **10.000** | `structured.py:113` |
| triples expandidos por request | **50.000** (`STRUCTURED_MAX_TRIPLES_PER_REQUEST`) | `config.py:274` |
| tamaño de chunk encolado | 1.000 (10–10.000) | `config.py:272` |
| texto para embedding | truncado a 8.000 bytes UTF-8 | `structured_ingest.py:93-116` |

---

## 2. La identidad determinista — el corazón de todo

El servidor genera los UUID con `uuid5`, y **vos podés calcular el mismo uuid localmente**. Eso es lo que permite **invalidar una arista sin buscarla primero**. Sin esto, no hay bitemporalidad.

Servidor (`services/structured_transform.py:145-173`) y cliente (`documed/apps/documed/graph_identity.py:41-46`) — **idénticos**:

```python
STRUCTURED_NS = uuid.uuid5(uuid.NAMESPACE_URL, "graphity://structured")

def normalize_key(v):            # NFC + casefold + colapso de espacios
    v = unicodedata.normalize("NFC", str(v)).casefold()
    return re.sub(r"\s+", " ", v).strip()

def node_uuid(group_logico, entity_type, natural_key):
    return str(uuid.uuid5(STRUCTURED_NS, f"{group_logico}|{entity_type}|{normalize_key(natural_key)}"))

def edge_uuid(group_logico, src_uuid, edge_type, tgt_uuid):
    return str(uuid.uuid5(STRUCTURED_NS, f"{group_logico}|{src_uuid}|{edge_type}|{tgt_uuid}"))
```

**Tres cosas que rompen esto y no dan error visible:**

1. **Usar el `group_id` físico en el seed.** Va el **lógico** (sin el prefijo `{tenant}__`). Si usás el físico, tus uuid no son los que Graphity persistió.
2. **Mandar el uuid5 ya calculado en `external_id_column`.** El servidor **re-hashea** lo que le mandes → `uuid5(uuid5(...))`. En las filas va la **clave natural en texto**; el uuid5 lo calculás vos aparte, solo para invalidar.
3. **Un `normalize_key` distinto** del servidor. Si difiere en un tilde o un espacio, apuntás a un nodo que no existe — y no falla: devuelve vacío.

> Un uuid repetido **actualiza** (`MERGE (n) ... SET n = node`), no duplica. La ingesta es idempotente por diseño.

---

## 3. Ontología: opcional, pero decide si el sistema te protege

- Se registra con `POST /api/v2/entity-types`, con `graph_ids=[tu_group_id]` (o `user_ids`). **Nunca dejar ambos scopes vacíos** = project-wide, y la instancia está compartida entre proyectos.
- **Sin ontología registrada → modo permisivo:** `validate_mapping` saltea las validaciones de tipo (`structured_transform.py:556-559`). Escribís cualquier cosa y nadie te avisa.
- **Con ontología → validación estricta y 422** si el `entity_type`, el `edge_type`, el par `(source,target)` o un atributo de `property_map` no están declarados. Sin fallback a `("Entity","Entity")`.

Registrala. El 422 es la única red que tenés: es la diferencia entre un typo que falla en 200 ms y un typo que envenena el grafo en silencio.

---

## 4. Bitemporalidad: `valid_at` sí, `invalid_at` NUNCA automático

- `valid_at` viaja en el POST vía `valid_at_column` (ISO-8601 → UTC-aware). Si no hay columna: `None`.
- **`invalid_at` el path structured NO lo setea jamás** (`structured_ingest.py:625-636`). Se escribe **después**, con `PATCH /api/v2/graph/edge/{uuid}` (`SET` parcial, allowlist `{name, fact, valid_at, invalid_at, expired_at}`).
- **No hay invalidación automática de contradicciones** en `dedup:"exact"`. Eso solo ocurre en `add_episode` / `add_triplet` (los caminos con LLM). Si nadie invalida, el hecho viejo queda vigente para siempre.
- `created_at` **se re-estampa** en cada re-corrida (consecuencia de `SET e = edge`).

**Orden obligatorio:** primero el `POST`, después los `PATCH`. Invertirlo invalida algo que el POST siguiente resucita.

---

## 5. Las 10 trampas (esto es lo que vale el documento)

Cada una está confirmada en código **y** en un spike contra el servidor real.

| # | Trampa | Consecuencia si la ignorás |
|---|---|---|
| 1 | **`dedup:"smart"` NO es 0-LLM.** Reusa `add_triplet` → dedup por LLM, identidad fuzzy, uuid4 random. | Creés que ahorraste el LLM y no. Usar **siempre** `"exact"`. |
| 2 | **`on_error` default es `"partial"`.** Termina `status:"completed"` con filas perdidas (`totals.failed>0`). | Un éxito indistinguible de una escritura completa. Mandar `"strict"` **siempre** + chequear `totals`/`row_errors` igual. |
| 3 | **El 202 no es "escrito".** | Reportás éxito sobre un job que después falló. Pollear. |
| 4 | **`SET e = edge` es reemplazo TOTAL.** Un re-POST del mismo dataset pisa `invalid_at` con `None`. | **Resucita una arista invalidada.** Guard obligatorio: `GET /edge/{uuid}` antes del POST y excluir de las filas lo ya invalidado. |
| 5 | **`PATCH {"invalid_at": null}` devuelve 200 OK y no hace nada.** Des-invalidar no existe. | Creés que revertiste algo y sigue invalidado. La reactivación se hace escribiendo un hecho **nuevo** con clave distinta. |
| 6 | **`/search` (scope=edges) y `/traverse` NO proyectan `attributes`.** Solo `GET /edge/{uuid}`. | Todo lo que quieras poder *leer* tiene que estar interpolado en el **`fact_template`**, no solo en `property_map`. |
| 7 | **Sin `target_external_id_column`, el destino se dedupe por el VALOR de la columna.** | Dos menciones distintas con el mismo texto colapsan en un nodo → y el 3er POST resucita la invalidación. Componé una clave explícita para las entidades que son **eventos** (cada mención = nodo nuevo). |
| 8 | **`/search` y `/traverse` NO filtran lo invalidado por default** (`only_valid` es opt-in). | Devolvés hechos vencidos como vigentes. El filtro client-side es la **única** defensa, no una capa redundante. |
| 9 | **Los atributos reservados se descartan EN SILENCIO.** Nodo: `uuid, name, group_id, summary, created_at, name_embedding, labels`. Arista: + `source_node_uuid, target_node_uuid, fact, episodes, expired_at, valid_at, invalid_at, reference_time, fact_embedding`. | Tu atributo custom desaparece sin error. (Y un atributo llamado `source`/`edge`/`target` choca con los placeholders del `fact_template` → 422.) |
| 10 | **Todas las aristas se guardan como `(:Entity)-[:RELATES_TO]->(:Entity)`**; el tipo semántico vive en `r.name`. | Un Cypher que filtra por `type(r)` devuelve **200 con lista vacía** — se lee como "no hay datos" cuando la query estaba mal. |

**Las trampas 2, 4, 6, 8 y 9 comparten un patrón:** el fallo devuelve **200 y vacío**, no un error. Ninguna te va a doler hasta que sea tarde.

---

## 6. El consumidor de referencia (`documed`) y qué se copia

Repo: `Agencia_IA_HyC\documed`, carpeta `apps/documed/`.

| Módulo | Líneas | Acoplamiento al dominio | ¿Copiar? |
|---|---|---|---|
| `graph_identity.py` | 105 | mínimo (solo la tabla `clave_natural`) | ✅ **Tal cual.** Solo stdlib (`re`, `unicodedata`, `uuid`). Cambiás `clave_natural`. |
| `graph_writer.py` | 1.586 | alto (275 menciones clínicas) | ⚠️ **Extraer el patrón, no el archivo.** Adentro está la máquina de estados HTTP (POST→poll→PATCH), el guard anti-resurrección, el `Idempotency-Key`, el presupuesto de pared. |
| `graph_mapping.py` | 1.923 | total (561 menciones) | ❌ Es la ontología clínica hecha código. Se re-escribe para tu dominio. |
| `ontology_documed.py` | 542 | total | ❌ Se re-escribe. Copiar el **patrón** de `apply_ontology` (scope por `graph_ids`, cacheado una vez por grafo). |
| `graph_reader.py` | 1.324 | medio | ⚠️ El filtro client-side de vigencia (trampa 8) sí conviene mirarlo. |

Decisiones de diseño que valen para cualquier dominio (documentadas en `documed/docs/Arquitectura_Estrategia/`, **ADR-009** y **ADR-017**):

- **Provenance como atributo de arista**, no como nodo: cada arista lleva `{entrada_id, sha256}` → así podés reconstruir de qué fuente salió cada hecho.
- **La fuente de verdad es un log append-only en Postgres; el grafo es un índice derivado y reconstruible.** Eso habilita el "re-derivador": si la escritura falla, se re-postea el log entero y converge.
- **`Idempotency-Key` atado a contenido + scope**, nunca al índice posicional de la partición (dos entidades con el mismo contenido colisionarían).
- **Nada que defina una arista puede depender del estado mutable del grafo** (ADR-017). Ni su identidad ni sus fechas. Todo sale del log inmutable. Si metés un campo temporal en el hash del uuid5, la identidad se fragmenta en cada rebuild.
- **El presupuesto de polling tiene que ser menor que el timeout de la activity Temporal** que lo envuelve (en documed: 90 s de poll dentro de 120 s de activity).

---

## 7. Receta para este repo

1. **Leé `documed/spikes/graphity_structured/RESULT.md`** (17,6 KB). Contesta 8 preguntas contra el servidor real. Es el ahorro más grande de esta lista.
2. **Definí la ontología del dominio emprendedor** (entidades + aristas + qué se deduplica y qué es evento). Esta es la decisión de diseño real; el resto es plomería.
   - Criterio duro: una entidad que representa un **evento** (cada mención es nueva) **no se deduplica nunca** — si se dedupe, una repetición futura genera el uuid5 de una arista ya invalidada y el re-POST la resucita.
3. **Registrala** con `POST /api/v2/entity-types` + `graph_ids=[tu_group]`. Nunca scope vacío.
4. **Copiá `graph_identity.py`** y reemplazá `clave_natural` por tu tabla.
5. **Escribí tu `graph_mapping`**: payload de dominio → `list[dict]` de datasets, con `dedup:"exact"`, `on_error:"strict"`, `fact_template` que contenga todo lo que después vas a querer leer, y `property_map` con la provenance.
6. **Portá la máquina de estados** del writer: POST → poll hasta `completed`/`failed` → chequear `totals.failed`/`row_errors` → recién entonces los PATCH de invalidación. Con el guard anti-resurrección (trampa 4).
7. **Probá con `validate_only:true`** antes de escribir nada real: responde 200 sin tocar el grafo.

**Reusable ya existente en la familia:** `unreal-copilot/deploy/worker/graphity_client.py` (161 L) ya tiene `set_ontology` vía `POST /api/v2/entity-types` y el patrón de polling (`ingest_fact_triples`). Sirve como referencia de auth/SDK — pero ojo: usa **fact-triples**, que es el camino `add_triplet` (**con LLM**, trampa 1), no el structured.

---

## 8. Lo que NO está verificado acá

- No corrí ninguna escritura contra el servidor vivo en esta pasada. Todo lo de arriba sale de leer el código de ambos lados + los `RESULT.md` de spikes que **sí** corrieron contra el servidor real (jul-2026). Si el servidor se actualizó después, revalidar con un `validate_only:true` antes de confiar.
- El docstring de `apps/copiloto/graphity_memory_client.py:4` apunta a `deploy/worker/graphity_client.py`, que **no existe en este repo** (vive en `unreal-copilot`). Drift de documentación, menor.
