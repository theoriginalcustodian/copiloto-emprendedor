---
name: la-skill-swmansion-dice-runOnJS-removido-y-en-reanimated-4-5-0-existe
description: swmansion-rn-animations afirma que runOnJS está removido en Reanimated 4; en la 4.5.0 instalada existe (re-export deprecado de worklets) — la skill es canónica del dominio, no de la versión instalada
metadata:
  type: feedback
---

# 📚⚖️ La skill es canónica del dominio, no de la versión instalada

`swmansion-rn-animations` (Critical Rules) dice «**NEVER use `runOnJS`. It is removed in Reanimated 4**». Medido el 2026-10-16 en `node_modules/react-native-reanimated` (`4.5.0`, con `react-native-worklets` `0.10.0`): **`runOnJS` existe** — `src/index.ts:305`, `src/workletFunctions.ts:12,56` (re-export de `runOnJS` de worklets, deprecado, no removido). La app lo usa en `PanelDeslizable.tsx`, `PanelFunciones.tsx` y funciona en device.

La skill de multithreading lo dice más fino: «`runOnJS` is replaced by `scheduleOnRN`» (deprecated), no «removed».

**Why:** una skill describe la última API del dominio; el `node_modules` es la verdad de esta versión. Citar la skill como si fuera el contrato instalado produce un falso diagnóstico («`runOnJS` no existe → ese callback no corre») que ningún test caza (ver [[el-mock-de-reanimated-hace-inalcanzable-finished-false-y-el-callback-del-spring]]).

**How to apply:** ante una afirmación de la skill sobre una API (existe / está removida / cambió), **grepeá `node_modules` antes de usarla como premisa**. Para código nuevo la skill sigue mandando: `scheduleOnRN` de `react-native-worklets`. Migrar los `runOnJS` existentes es decisión aparte; no es parte de ningún fix en curso.

La skill tampoco enumera **qué cancela** una animación (sólo «false si se cancela»): la regla está en `valueSetter.ts:10-14` — cualquier escritura al shared value con animación en curso cancela y llama `callback(false)`, aun con el mismo valor (ese bloque corre antes del chequeo «mismo valor», `:71-73`).
