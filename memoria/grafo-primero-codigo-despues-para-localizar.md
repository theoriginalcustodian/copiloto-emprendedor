---
name: grafo-primero-codigo-despues-para-localizar
description: Hay un grafo de código del repo (MCP graphity-code) que devuelve file:line exactos — localizar con el grafo ahorra greps y tokens, pero probar SIEMPRE contra el archivo real
metadata:
  type: reference
---

Instrucción del operador, 2026-07-24: *"Podés consultar el grafo para información precisa y luego
verificar con código. **Es regla canónica para todas las sesiones** — nos ahorra mucho trabajo de
grepeado y de tokens. Es fundamental."*

Existe un **grafo de código del repo** (archivos, funciones, clases, `CALLS`/`DEFINES`/`IMPORTS`),
extraído **sin LLM** por `graphify`, servido por MCP `graphity-code`, **actualizado incremental en cada
`git push`**. Manual: `docs/copiloto-emprendedor/2026-07-23-HANDOFF-consultar-el-grafo-de-codigo.md`.
Canonizado en COORDINACION §4.2.octies.

## La regla, en dos tiempos — los dos obligatorios

1. **LOCALIZAR con el grafo.** Antes de barrer con greps, preguntale dónde vive lo que buscás → devuelve
   `source_file` + `source_location`.
2. **PROBAR con el archivo.** El grafo dice *dónde mirar*, **no** *qué es verdad hoy*. Andá al `file:line`
   y leelo. **Nunca cites el grafo como evidencia final** — citá el código.

```
ToolSearch "select:mcp__graphity-code__graphity_search,mcp__graphity-code__graphity_traverse_node"
graphity_search(query="...", group_id="code-copiloto-emprendedor", scope="nodes",
                node_labels=["Function","Class"])
```

## Los tres filos sin los cuales miente

- 🔑 **`group_id="code-copiloto-emprendedor"` SIEMPRE.** El tenant aloja **4 repos**; sin scopear
  mezclás repos y tomás un símbolo ajeno por propio.
- 📁 **Los paths omiten el prefijo `apps/`**: `copiloto/afip_web.py` en el grafo = `apps/copiloto/afip_web.py`
  en disco. No es un nodo roto.
- ⚠️ **Puede haber nodos stale** (el reconcile quedó en pausa por un guard) → la **presencia de un nodo
  NO prueba que el símbolo exista hoy**. Por eso el paso 2 no es opcional.

**Alcance — un vacío acá NO es hallazgo.** Cubre `apps/*`, `packages/core`, `motor`, `scripts`, `spikes`,
`deploy`. **NO cubre** `docs/`, `coordinacion/`, `memoria/`, `_evidencia/`, `code/`. Si buscás algo de
ahí y no aparece, está **fuera de alcance, no roto** ([[vacio-no-es-hallazgo-correr-el-control]]).

## Evidencia — el control se corrió ANTES de canonizar la regla

2026-07-24, cruzado contra código verificado a mano minutos antes: **4 de 4 exactos** —
`FacturaWorkflow` L66 · `.confirmar_factura` L312 · `_confirm_choices` L609 · `confirmarFactura` L882.
Y trajo **3 nodos que un barrido con grep NO había encontrado**: `workflow_id_de_factura`
(`presupuesto_store.py:67`, justo el mecanismo del handoff presupuesto→factura), `EstadoFacturar`, y el
test de idempotencia de anulación.

**Por qué rinde tanto:** un grep contesta *"¿dónde aparece este string?"*; el grafo contesta *"¿qué
existe que haga esto?"* — que es **exactamente la pregunta del `§0 Reutilización`**
([[reutilizacion-es-regla-el-inventario-va-antes-del-diseno]]). Buscar reuso con grep obliga a adivinar
el nombre; con el grafo se busca por semántica. Las dos reglas se potencian: **el grafo es la forma
barata de construir el inventario de reutilización.**
