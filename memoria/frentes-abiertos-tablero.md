---
name: frentes-abiertos-tablero
description: Índice maestro de TODOS los desarrollos/frentes abiertos vive en docs/ESTADO-FRENTES-ABIERTOS.md — consultarlo al preguntar por lo abierto; actualizarlo al registrar estado de un frente
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 47c379b0-b500-4c46-9538-51cb02755a1e
---

El **índice único de todos los desarrollos/frentes abiertos** vive en `docs/ESTADO-FRENTES-ABIERTOS.md` (tablero WIP creado 2026-07-02). Tracks PRODUCTO / FÁBRICA / SEGURIDAD, una fila por frente (estado · **doc de verdad** · próximo paso · dependencia · done verificable) + **grafo de dependencias** (el orden de trabajo sale de la precedencia, no de opinión). Es **PUNTERO, no bitácora**: cada fila apunta al doc que tiene la verdad de ese frente; el detalle NO se re-narra en la tabla.

**Why:** el operador necesita un único lugar para ordenar el trabajo. El `ROADMAP.md` quedó desactualizado (no absorbió voz Fase 3, Copiloto del Emprendedor ni los 7 servicios Composio) → dejó de servir como mapa completo de lo abierto. Distinto propósito: ROADMAP = "qué falta a nivel producto/prioridad"; este tablero = "qué está en vuelo y dónde vive su verdad".

**How to apply:**
1. Cuando el operador pregunte *"qué desarrollos/frentes tenemos abiertos", "relevamiento de lo abierto", "qué falta terminar", "ordenar el trabajo"* → **leer `docs/ESTADO-FRENTES-ABIERTOS.md` PRIMERO** (después, el doc de verdad de cada frente si hace falta profundizar).
2. Cuando pida *"guardá el estado de este frente / registrá que X quedó abierto / actualizá dónde estamos"* → **actualizar la fila del frente en ese tablero** (estado · próximo paso · dependencia) **+ el doc de verdad del frente**. NO re-narrar detalle en la fila (rompe el "puntero-no-bitácora"). Si es un frente nuevo, agregar fila en el track que corresponda.
3. Mantener el puntero recíproco: el ROADMAP apunta al tablero en su cabecera.

Related: [[factory-identidad-automatizacion-ia]] · el "🚦 Estado vivo" de MEMORY.md apunta acá · [[propagar-cierre-a-docs-maestros]] (al CERRAR un frente, propagarlo a ROADMAP+ARCHITECTURE+tablero).
