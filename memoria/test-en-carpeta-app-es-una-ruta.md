---
name: test-en-carpeta-app-es-una-ruta
description: Un *.test.tsx dentro de app/ lo carga expo-router como ruta y tumba la app en el device; los gates de jest no lo ven
metadata: 
  node_type: memory
  type: project
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-21T21:57:17.080Z
---

**NUNCA poner un `*.test.tsx` / `*.spec.tsx` dentro de `apps/mobile/app/`.** Esa carpeta es el árbol
de rutas de expo-router: **todo** archivo ahí adentro se convierte en una pantalla navegable y entra
al bundle del device.

**Qué pasa si lo hacés (2026-07-21, copiloto).** Puse `app/ajustes.test.tsx` para cubrir el cableado
de los tiles de Ajustes. Los 322 tests pasaron en verde. Minutos después el operador reportó la app
bloqueada con un error en una card: el archivo se cargó como ruta y ejecutó `jest.mock(...)` en el
teléfono, donde `jest` no existe → arranque muerto.

**Por qué ningún gate lo caza.** En jest el archivo es un test perfectamente válido y verde. El
problema no es QUÉ hace sino DÓNDE vive. typecheck, lint y la suite entera pasan; sólo el device
falla, en runtime, al bundlear.

**El contrato, leído no deducido** (`node_modules/expo-router/_ctx.android.js`): el `require.context`
excluye SÓLO `+api`, `+html`, `+middleware`. Nada de `.test`/`.spec`:
`/^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+html)|(?:\+middleware)))\.[tj]sx?$).*\.[tj]sx?$/`

**Dónde va un test que necesita importar una ruta:** en `src/`, importando `../../../app/<ruta>`. El
import cruza el límite; el archivo no vive en el árbol de rutas.

**El guard que lo hace "no puede volver por construcción":** `src/navegacion/appSoloRutas.test.ts`
falla si aparece cualquier `*.test`/`*.spec` dentro de `app/`. Con control horneado: verifica también
que el readdir efectivamente encuentre las rutas, para que un listado roto no pase por vacío.

Hermana de [[glass-apilado-empujar-una-vez]] (el otro "app bloqueada al volver", causa distinta) y de
[[instrumentos-que-confirman-en-vez-de-verificar]] (verde en jest ≠ funciona en el device).
