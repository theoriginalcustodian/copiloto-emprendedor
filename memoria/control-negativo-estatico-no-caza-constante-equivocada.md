---
name: control-negativo-estatico-no-caza-constante-equivocada
description: Auditar control negativo leyendo el test (estático) confirma el acople pero no una constante de aserción mal puesta; sólo correr el test —o computar la constante— la caza.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: da9be060-d90c-4585-bc9c-77c1b657fe22
  modified: 2026-08-12T19:30:17.628Z
---

Auditar un control negativo de forma **estática** (leer el fix + el test y razonar que la aserción
está acoplada al fix) confirma la **estructura** del control, pero **NO puede cazar una constante de
aserción equivocada**. `git show` del test no corre nada.

**Why:** En Fase D de lote B (#407, 2026-08-12) certifiqué "B1-STT ✅ CIERRA" citando
`assert '"chars": 38'` como evidencia. El fake `"quiero cancelar mi pedido del martes"` mide **36**,
no 38 → el test estaba **ROJO** en el commit que audité, y main estuvo roja por eso. Cité la constante
rota como si fuera prueba de que pasa: razonamiento circular. Lo cazó backend corriendo el gate, no yo.
Es el hueco empírico que yo mismo había flaggeado en el avance — se realizó donde dije. Instancia
audit-específica de canon 7 y de [[instrumentos-que-confirman-en-vez-de-verificar]].

**How to apply:** Cuando una verificación estática cite un **literal del código** como evidencia
(constante, string exacto, número), no lo des por bueno: **computalo independientemente** (contá los
chars, evaluá el f-string) o **corré el test** (VPS). Si no podés correrlo, decí explícito "acople
verificado, valor concreto NO ejecutado" — no "cierra/verde". Un `avance_` de auditoría que dice
"verde" sin ejecución es una autoevaluación, no evidencia.
