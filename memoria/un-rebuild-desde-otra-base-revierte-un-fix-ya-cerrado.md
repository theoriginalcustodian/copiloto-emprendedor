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

**REFUERZO 2026-10-05 — un PR cuyo contenido ya llegó a `main` por otra rama no queda «vacío»: queda
REGRESIVO.** Medido en 2 de 3 PR el mismo día. Sus archivos siguen trayendo la versión **vieja** de
las líneas que `main` superó, así que el conflicto se resuelve a favor de una mitad ya obsoleta y el
merge *revierte* trabajo cerrado. Lo peligroso es que el PR se ve sano: CI verde (de su día),
`mergeable`, y un diff que parece aporte.

En el caso concreto, las 5 líneas únicas que quedaban de la rama incluían
`echo "VERDE — se puede mergear"; exit 0` **sin medir `mergeable`** — o sea el fail-open exacto que el
otro PR había venido a matar. Mergearlo lo reintroducía.

**El control que lo distingue en una corrida:** contar las líneas de la rama ausentes en `main` y
mirar **qué son**. Si todas son formas superadas de líneas que `main` ya tiene, el PR se **cierra**,
no se mergea. **Y el inverso también hay que mirarlo:** en el otro PR el código era redundante pero
2 refuerzos de memoria no estaban en `main` (0 hits), así que cerrarlo entero habría perdido 83
líneas que nadie más tenía.

---

## 🔻 2026-10-06 — la versión ATRASADA del instrumento fabrica trabajo que ya está hecho

Corrí `contar-veredictos.py` en el worktree `wt-medidor` (base `148f9639`, 22 commits de una rama ya
squash-mergeada) y me devolvió `rc=8 DOCUMENTOS SIN CLASIFICAR` sobre un documento que **`main` ya
clasificaba desde su línea 491**. Clasifiqué lo clasificado y commiteé. Antes de abrir el PR medí el
diff contra `origin/main`: **181 archivos, 521 inserciones, 9090 borrados** — ese PR habría revertido
trabajo de las otras tres sesiones.

Nada en la corrida avisaba: mismo formato, mismo corpus (19/23), misma cifra (`web 50 de 54`). **El
instrumento se identifica solo y no lo leí** — imprime `🔬 INSTRUMENTO: <hash> · <N> líneas`:

```
f585fe6d90c9 · 2680 líneas   <- main @ 9911ced1 (el bueno)
65a2dd3409a0 · 2614 líneas   <- wt-medidor (atrasado, miente con formato idéntico)
```

→ **Antes de creerle un `rc` o citar una cifra, comparar esa línea contra `main`.** Y para decidir
entre mergear o cerrar una rama vieja, el control que vale es medir si su contenido ya está en main
**archivo por archivo**: la entrada de memoria que parecía rescatable tenía 206 líneas en `main` y 151
en la rama. Un `rev-list --count` alto no distingue «trabajo nuevo» de «base vieja».