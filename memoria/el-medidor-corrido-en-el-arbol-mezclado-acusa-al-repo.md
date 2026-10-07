---
name: el-medidor-corrido-en-el-arbol-mezclado-acusa-al-repo
description: Un medidor que lee el DISCO corrido en un checkout con HEAD viejo y ediciones a mano culpa al repo de un defecto que vive en el checkout. Y el diff dice para qué lado: el disco estaba 11.713 líneas ATRASADO, no adelantado.
metadata:
  type: feedback
---

El medidor del índice de memoria falló con **`FALLA: 64 entradas sin línea en MEMORY.md ni
HISTORIA.md`**. Con eso abrí una fila (`MEMHUERFANAS`) que afirmaba 64-68 lecciones *«invisibles para
toda sesión»*, el índice **pasado de techo en los dos lados** (25354 y 25112 contra 24000) y una causa
raíz documental.

El mismo medidor, corrido en un **worktree limpio desde `origin/main`**, dijo lo contrario:

```
[OK ] cobertura: 378/378 entradas indexadas
[OK ] presupuesto: 23344 / 24000 bytes  (181 líneas)
Índice sano: 378 entradas, todas alcanzables.
```

**Cero huérfanas. Bajo el techo.** El defecto no era del repo: era del árbol donde corrí el
instrumento — un checkout compartido con **HEAD viejo** y ~100 archivos editados a mano. El medidor
lee el **disco**: ahí veía archivos de memoria que el `MEMORY.md` *de ese mismo disco* (una versión
atrasada) no indexaba. Las dos corridas eran correctas; **sólo una respondía la pregunta que yo creía
estar haciendo.**

## La medición que lo cerró, y la dirección invertida

- De los **70** archivos untracked en `memoria/`, **64 YA estaban en `main`** — exactamente el 64 del
  `FALLA`. Sólo **6** no: `memoria/checkpoints/*` de agosto, estado de sesión caduco.
- `git diff --stat origin/main -- memoria/` ⇒ **141 archivos, 263 insertions, 11.713 deletions.**

⚠️ **Ese signo es todo.** Yo había supuesto que el checkout tenía trabajo *nuevo* que no llegaba a
`main`. Está **atrasado**: entradas enteras con `+0 -563`. Lecciones realmente perdidas: **0**.
⇒ **Commitear `memoria/` desde el checkout compartido no rescataría nada: borraría 11.713 líneas de
memoria de `main`.** El riesgo era el opuesto al que escribí, y un `git add memoria/` bien intencionado
lo ejecutaba.

## Qué hacer

1. **Un medidor que lee el disco se corre en un worktree limpio, o su veredicto es sobre el checkout,
   no sobre el repo.** Si acusa al repo, la primera pregunta es *¿contra qué árbol midió?*
2. **`memoria/` no se commitea ni se siembra desde el checkout compartido.** Verificable antes de
   tocar nada: `git diff --stat origin/main -- memoria/` — si hay deletions masivas, el disco está
   atrasado y cualquier commit de esa carpeta es destructivo.
3. **El número puede estar bien y la conclusión invertida.** El `64` era real; lo que no se seguía era
   *«64 lecciones invisibles»*. Mismo día, misma clase: auditoría midió `git ls-tree` (0 `.otf` en el
   árbol) y concluyó que `filter-repo` no serviría, cuando `filter-repo` opera sobre la **historia**
   (10 objetos alcanzables).

**Lo que SÍ era real y se corrigió:** `coordinacion/COORDINACION.md` afirmaba que `seed-memory.sh`
espeja con `--delete`. Falso desde el 2026-07-31 (`seed-memory.sh:15` es comentario histórico; `:117`
es `rsync -a --update`, y `:96` rescata slug→repo). Era el documento que las tres sesiones leen al
arrancar, y sembraba miedo a correr la herramienta que reconcilia.

Relacionado: [[instrumento-que-no-mira-nunca-falla]] · [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] ·
[[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]] ·
[[memoria-repo-vs-slug-drift]] · [[el-universo-externo-del-instrumento-tiene-su-propio-denominador-incompleto]]
