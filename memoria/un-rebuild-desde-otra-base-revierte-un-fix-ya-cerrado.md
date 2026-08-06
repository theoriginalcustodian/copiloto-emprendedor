---
name: un-rebuild-desde-otra-base-revierte-un-fix-ya-cerrado
description: Un build binario cortado de una base vieja deshace un fix ya mergeado y verificado — y no da síntoma hasta que alguien vuelve a probar esa función concreta
metadata:
  type: project
---

**LEER antes de disparar un rebuild EAS / APK / imagen de contenedor.** Caso raíz: 2026-08-06, el
device pass del hito 6 de ODOBI quedó bloqueado por un fix **cerrado tres días antes**.

## Qué pasó

| Fecha | Hecho |
|---|---|
| 03-08 | `expo-image-picker` faltaba en el dev-client → PR#215 + rebuild EAS desde `main@a9b8736` → APK bueno instalado, hallazgo cerrado |
| 05-08 | Rebuild EAS **para otra cosa** (BETA-4b, sign-in nativo), cortado de una base **previa** a PR#215 → el APK nuevo **pisó** al bueno |
| 06-08 | La app crashea entera al iniciar sesión: `Cannot find native module 'ExponentImagePicker'` |

El fix nunca se revirtió en git. `main` siempre tuvo PR#215. Lo que retrocedió fue **el binario
instalado en el device**, que no vive en ninguna rama.

## Por qué no dio síntoma durante 2 días

Nadie volvió a probar `chat-foto` después del install del 05-08. Un fix verificado **se archiva
mentalmente como permanente** — y lo es, en el repo. En el device es apenas el estado de la última
instalación.

Peor: el daño fue desproporcionado al módulo. `PantallaPrincipal.tsx:30` importa `ChatView` sin
condicionar, y `chat/index.ts` arrastra `useCapturaFoto.ts:3` — así que un módulo nativo de **una
función opcional** tumba la app **completa** apenas hay sesión. No hubo degradación parcial que
avisara antes.

## La regla

Un rebuild es un **corte de una base**, no una acumulación. Antes de disparar uno, nombrar de qué
commit sale y verificar que contiene los fixes nativos ya cerrados:

```bash
git merge-base --is-ancestor <commit-del-fix> <base-del-build> && echo "el fix está adentro"
```

Y después del install, medir el **binario**, no el build:

```bash
adb shell dumpsys package <app> | grep lastUpdateTime   # ¿es de HOY?
```

## El control que importa: positivo, sobre la función

Que el build "salga exitoso" es exactamente lo que pasó el 05-08. El único control que distingue es
**ejercitar la función del módulo nativo** en el device (abrir el selector de fotos), no leer el log
de EAS. Hermana de [[instrumento-que-no-mira-nunca-falla]]: un build verde no mira si el módulo
linkeó.

Y si `lastUpdateTime` sigue viejo, el `adb install` no reemplazó nada — seguir midiendo ahí mide el
APK anterior y **confirma** lo que ya sabías.

Relacionado: [[iterar-en-device-es-metro-local-con-dev-client-ya-instalado]] ·
[[el-checkout-compartido-sirve-comandos-viejos]] · [[borrar-el-archivo-no-borra-su-contrato]]
