---
name: el-instrumento-versionado-difiere-por-rama
description: Si el script que mide vive DENTRO del repo, cada rama corre su propia versión — así que comparar el rc entre ramas mueve el corpus Y el código que lo mide al mismo tiempo, y el resultado no atribuye nada; hay que fijar uno de los dos, y el control que lo prueba es un archivo que ninguna rama toca.
metadata:
  type: feedback
---

**2026-09-30.** Medí el rc del criterio 3 en tres refs y concluí que **cada rama tenía la mitad** del
verde (`main` 6 · la mía 8 · la de planificación 6 · **las dos juntas 0**), de ahí derivé que el verde
sólo existía en el par, y lo publiqué como titular de un `pedido_`. **Era falso.** Planificación lo
refutó y la refutación resistió mi propia verificación.

## La prueba, que no necesita correr nada

| ref | blob de `scripts/evidencia/criterio3-matriz.mjs` | ocurrencias de `preg` |
|---|---|---|
| `origin/main` | `f5e0c834` | 0 |
| `plan/lector-cuenta-por-plataforma` | `f5e0c834` | 0 |
| `auditoria/rev-parse-ecoa-el-arg` | **`e79cbee5`** | **5** |

**El control que lo vuelve concluyente:** `CLAUDE.md`, que ninguna de las dos ramas toca, da el **mismo**
blob (`7a2acddb`) en ambas. Sin ese control, la diferencia de arriba podía ser un artefacto de cómo
extraje los árboles; con él, queda probado que el instrumento **difiere por rama** y `CLAUDE.md` no.

## Por qué la precaución que tomé era justo la que metía el defecto

El script resuelve sus rutas con `parents[2]`, así que correrlo desde otro directorio mide el cambio de
directorio y no el de código. Lo "arreglé" **extrayendo cada versión a su propio directorio** — y eso
garantizó que cada rama corriera **su propia versión del medidor**. Cada celda de mi tabla movía
**dos** variables: el corpus vivo y el código que lo mide. El `0` del par no probaba
complementariedad; probaba que esa combinación de script y corpus da 0. Escribí la nota metodológica
(«cada versión extraída a su propio directorio») creyendo que mostraba rigor, y era la confesión del
defecto.

**Why:** un instrumento versionado dentro del repo que mide **el repo** no tiene una sola identidad:
tiene una por rama. La comparación entre ramas se siente controlada —mismo comando, mismo corpus,
distinto ref— y en realidad es un experimento de dos factores sin control, del que no sale ninguna
atribución. Y el modo de fallo es cómodo: los números salen, son distintos entre sí, y cuentan una
historia plausible («cada rama tiene la mitad») que nadie va a cuestionar porque viene con tabla.

**How to apply:**
1. **Antes de comparar ramas, preguntá si el instrumento es parte de lo comparado.** Si `git rev-parse
   <ref>:<script>` da blobs distintos, no estás midiendo ramas: estás midiendo pares (script, corpus).
2. **Fijá uno de los dos factores y decilo en la tabla.** O un solo blob del medidor corriendo contra
   los distintos corpus, o un solo corpus medido por los distintos blobs. Una tabla rama-por-rama que
   no declara cuál fijó está midiendo la suma.
3. **El control es un archivo que ninguna rama toca.** Mostrar que ése sí coincide es lo que separa
   «el instrumento difiere» de «mi método de extracción difiere». Es el mismo rol que el control
   positivo en [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]].
4. **Cuando te refuten, medí la refutación y separá causa de observación**
   ([[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]]): acá cayó el relato de
   las dos mitades y **sobrevivió el orden de merge**, que estaba sostenido por otra medición.
5. **Corregí el TITULAR, no sólo el cuerpo.** El `pedido_` se llamaba «el-verde-del-lint-esta-PARTIDO…»:
   un apéndice al pie deja la afirmación refutada en el nombre, que es lo que se lee en el listado
   ([[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]).

---

## Refuerzo 2026-10-05 · el eje peor no es la rama: es el DISCO de un checkout mezclado

Un `pre-push` fail-closed frenó a las cuatro sesiones. Dos sesiones lo diagnosticaron distinto, y la
diferencia era el archivo que cada una ejecutó:

| `scripts/graph-sync.sh` | blob | ¿tiene el guard que nombra la causa? |
|---|---|---|
| `origin/main` y mi rama | `8331fc2c` | sí (línea 145) |
| **disco del checkout compartido** | `467f870a` | **no** |

La que corrió la copia del disco recibió un error del sistema de más abajo, que apuntaba a otro
lugar, y publicó un diagnóstico equivocado («config ambigua, falta `--repo`») sobre una causa que era
«la config no existe en esta rama». El guard correcto existía y estaba en `main`: simplemente no
estaba en el archivo que se ejecutó.

**Por qué es peor que la rama:** una rama es un nombre que se puede citar y reproducir. El disco de un
checkout mezclado **no corresponde a ninguna rama**, así que el mensaje que produce no es reproducible
por nadie — ni por quien lo vio. Un diagnóstico así no se puede atribuir ni refutar: se hereda.

**How to apply (se suma a las de arriba):**
- Cuando dos sesiones reportan **causas distintas del mismo fallo**, la primera medición no es la causa:
  es `git hash-object` del instrumento en cada lado. Si los blobs difieren, no estaban discutiendo lo
  mismo.
- **Un mensaje de error es evidencia de qué archivo corrió**, no sólo de qué pasó. Antes de heredar un
  diagnóstico ajeno, preguntá qué blob lo emitió.
- Si el repo tiene un checkout compartido, el control que falta es el que ya existe para lo vendoreado:
  comparar los blobs de `scripts/` contra `main` y listar los divergentes (`no-drift.sh` es el patrón).
