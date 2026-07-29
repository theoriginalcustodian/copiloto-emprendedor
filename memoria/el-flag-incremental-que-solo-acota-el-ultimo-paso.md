---
name: el-flag-incremental-que-solo-acota-el-ultimo-paso
description: `--since` en el sync del grafo NO hace el trabajo incremental: acota sólo la ingesta (paso 3). La extracción y la reconciliación recorren el repo y el grafo completos por diseño — por eso un push de 1 archivo tarda 17 minutos.
metadata:
  type: project
---

**LEER antes de intentar acelerar el `pre-push` del grafo de código, o de asumir que un flag
`--since` / `--incremental` / `--changed-only` hace lo que su nombre promete.**

2026-07-28. Un push con **un solo archivo** cambiado tardó **17m16s** y reportó *"sync OK — 4181
filas, 0 zombies borrados"*. Yo había "arreglado" el hook para que usara `merge-base` en ramas nuevas
(en vez de forzar `full`) creyendo que ahí estaba el costo. **El fix era correcto pero no era la
raíz**: el tiempo no depende de cuántas filas se suben.

**Lo que `--since` hace realmente** (leído en `graphify-graphity-bridge`, no supuesto):

| Paso | ¿Lo acota `--since`? | Dónde |
|---|---|---|
| 1. Copiar los `source_dir` al workdir | ❌ `_copy_tree` borra + copia **cada dir completo**, siempre | `graphify_runner.py:46-54` |
| 2. Extraer el grafo (`graphify update` + `cluster-only`) | ❌ corre sobre **todo el workdir**, no recibe filtro | `graphify_runner.py:74,76` |
| 3. **Ingerir** | ✅ **único paso acotado** — `subgraph(graph, touched)` | `sync.py:62-67` |
| 4. Reconciliar (zombies) | ❌ `expected_uuids` usa el grafo **completo** y pagina **todo** el grafo remoto de a 200 | `sync.py:93-96` · `client/graphity.py:117-145` |

Y **está documentado así en el propio código** (`sync.py:36-39`, `incremental.py:1-9`: *"el reconcile
SIEMPRE usa el grafo completo"*). No es un bug: es el contrato. El nombre del flag es lo que induce a
error.

**La lección portable:** un flag llamado `--since`/`--incremental` describe **su** alcance, no el del
comando. Antes de optimizar apoyándose en él, preguntar **de qué paso concreto recorta trabajo** — y
leerlo en el código, porque el nombre sugiere "todo el pipeline" y suele significar "el último paso".
Optimicé la entrada de un pipeline cuyo costo estaba en la salida. Hermana de
[[verificar-la-composicion-root-no-el-default]]: el nombre de la pieza no dice qué hace la
composición.

**Deuda abierta, con orden de ataque** (del más barato al más caro):

1. **Gratis:** leer el log `"--since %s → %d archivos, %d aristas tocadas"` (`sync.py:68-74`) de una
   corrida real. ⚠️ En mi medición ese log no apareció **porque yo trunqué el output con `tail -6`** —
   el vacío era de mi instrumento, no del bridge ([[vacio-no-es-hallazgo-correr-el-control]]). Capturar
   el log completo es el primer paso, no discutir la causa.
2. **Bajo:** ver si `graphify update` acepta una lista de paths (su docstring sugiere caché AST por
   archivo cambiado). Si acepta, pasarle `changed_files` evita el copytree + extracción completos.
3. **Medio:** acotar `list_node_uuids`/`list_edge_uuids` con filtro server-side, si la API de Graphity
   lo soporta — **validar contra la spec antes de asumir que existe** (V-EXT).
4. **Alto / ADR:** reconcile event-driven sobre borrados reales en vez de recomputar `expected_uuids`
   entero.

**Lo que NO se debe hacer:** mandar el sync a background para "no esperar". Rompe el fail-closed del
hook, y el grafo pasaría a estar desactualizado en silencio justo cuando se lo consulta para no
reinventar lo que ya existe — que es el único motivo por el que el grafo vale algo.

**Disparador para retomar:** si un push vuelve a superar ~5 minutos. Dueño: quien toque el bridge.
