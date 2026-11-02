---
name: el-mock-de-reanimated-hace-inalcanzable-finished-false-y-el-callback-del-spring
description: jest.setup.js mockea withTiming (callback siempre true) y withSpring (nunca llama el callback) — ningún test puede fallar por una animación interrumpida; un fix en esa rama saldría verde sin ejercitarse
metadata:
  type: project
---

# 🧪🕳️ Bajo Jest, `finished=false` no existe y el callback del spring tampoco

**Medido 2026-10-16 sobre `origin/main` @ `01851f70`** (hallazgo lateral del diagnóstico de R03, que sobrevive a cómo termine R03):

- `apps/mobile/jest.setup.js:32-35` — `withTiming` invoca el callback **siempre con `true`**.
- `apps/mobile/jest.setup.js:36` — `withSpring: (destino) => destino`: **no invoca el callback nunca**.
- `apps/mobile/jest.setup.js:22` — `useSharedValue` es `{ value }` plano: sin `valueSetter`, sin cancelación de la animación previa (en prod: `node_modules/react-native-reanimated/src/valueSetter.ts:10-14`).
- `apps/mobile/jest.setup.js:46` — `runOnJS: fn => fn`.

**Consecuencia:** el callback del spring del Pan (`PanelDeslizable.tsx:349-354`, `PanelFunciones.tsx:163-164`) es **inobservable** bajo test, y una animación interrumpida (`finished=false`) es **inalcanzable**. Un fix en esa rama saldría verde sin ejercitarse — mismo patrón que [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] y [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]. «Ningún test lo reproduce» **no es evidencia de que no ocurra**.

**Why:** el mock se escribió para que `runOnJS(marcar)` fuera observable (SM-A1, issue 1010), y para eso alcanzó con `finished=true`; la rama `false` nunca tuvo un caso que la pidiera.

**How to apply:** antes de decir «el test cubre esto» para código que vive en un callback de animación, mirar si el mock invoca ese callback y con qué `finished`. Si hace falta cubrir la interrupción, el mock tiene que poder devolver `false` (o el test debe usar el `valueSetter` real); la cobertura real de gestos/animación sigue siendo device. Hasta entonces, un cambio en esos callbacks se verifica en device, no con Jest verde.

Origen: diagnóstico R03 por lectura — `coordinacion/` `cierre_frontend1-a-planificacion_R03-por-lectura-NO-ATRIBUYE-…` (2026-10-16). Aceptado por planificación (8b).
