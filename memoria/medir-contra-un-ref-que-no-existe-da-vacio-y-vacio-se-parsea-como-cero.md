---
name: medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero
description: Un barrido de "qué trabajo está en riesgo" medido contra el ref equivocado falla en las DOS direcciones — omite y también inventa; el único control que cierra es preguntar por el EFECTO.
metadata:
  type: feedback
---

**2026-09-29, reconstruyendo el estado después de que un corte de créditos matara las sesiones.** Dos
mediciones del mismo hecho —«¿qué trabajo quedó sólo en disco?»— dieron resultados opuestos, y **las
dos estaban mal por la misma raíz: comparar contra una referencia que no era la que respondía la
pregunta.**

| quién | midió | dijo | era |
|---|---|---|---|
| backend | `git rev-list --count origin/<rama>..HEAD` | **0 sin pushear** | **7 ramas** que no existían en el remoto |
| yo | `git rev-list --count origin/main..HEAD` | **13 commits en riesgo** | **0** — ya estaban en `main` por squash |

## Por qué ninguno de los dos falla ruidosamente

**El de backend omite.** Si `origin/<rama>` **no existe**, `git rev-list` no imprime nada. Ese vacío,
metido en `$(...)` y leído como número, **es `0`** — y `0` en esa columna significa «no hay nada sin
pushear». O sea **«no puedo ver» se imprimió como «no hay»**, que es exactamente
[[un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo]] en versión git. Y el caso en que la
rama nunca se pusheó —el único que el barrido existe para cazar— es **precisamente** el caso en que
el ref no existe: el instrumento es ciego justo donde tiene que ver.

**El mío inventa.** Con **squash-merge**, los commits de la rama **nunca** entran a `main` por hash.
`origin/main..HEAD` los sigue contando para siempre, aunque su contenido esté mergeado hace una
semana. Una rama cerrada y una rama nunca pusheada se ven **idénticas** con esa medida.

## El control que cierra los dos, y es uno solo

No es «usar el otro ref»: es **dejar de preguntarle a un ref y preguntar por el EFECTO**.

```bash
git ls-remote origin "refs/heads/$rama"        # ¿existe allá? (no: ¿tengo yo una copia del ref?)
git cat-file -e "origin/main:$artefacto"       # ¿el efecto está en main? (no: ¿está el commit?)
git merge-base --is-ancestor HEAD origin/main
```

`ls-remote` **habla con el remoto**; `origin/<rama>` es una copia local que puede no existir por no
haberse traído nunca. Y el artefacto en `origin/main` responde «¿esto ya llegó?» sin depender de
cómo se mergeó.

> **La pregunta que separa las dos familias:** *¿mi medición interroga al sistema, o a mi copia de lo
> que creo del sistema?* Es el mismo eje que [[el-instrumento-respondio-sobre-otro-sujeto]].

## Y el corolario que más cuesta ver

Mi falso positivo apareció **mientras le señalaba a backend el suyo**, con el mismo tipo de error, en
el mismo turno. Saber que existe la clase no te saca de ella: lo que me sacó fue **correr el control
de efecto sobre mi propio resultado antes de reportarlo**, no la advertencia que acababa de escribir.

El caso espejo —dos errores opuestos que **se cancelan** y el total confirma— está en
[[una-cifra-que-coincide-con-la-fuente-independiente-puede-coincidir-por-compensacion]]. Acá
divergieron y ninguno de los dos totales servía; allá coincidieron y el total mentía. Misma familia:
**un número no dice contra qué se midió.**

**Why:** porque un reporte de riesgo es lo que decide si alguien puede borrar un worktree. Un `0`
por ceguera hace perder trabajo real —acá había un `test(RATCH)` de aislamiento cross-tenant sólo en
disco—, y un «13 en riesgo» inventado gasta el turno de otra sesión en rescatar lo que ya está
guardado.

**How to apply:** ante cualquier barrido de «qué falta / qué está en riesgo», antes de reportar:
(1) preguntá si cada `0` puede significar «no medí» y no «no hay» — probá el caso que el barrido
existe para cazar y exigí que se vea; (2) para «¿ya llegó?», medí el EFECTO en `origin/main`, nunca
la distancia en commits, porque el squash la deja alta para siempre; (3) corré el control sobre tu
propio resultado **aunque acabes de escribir la advertencia** — el turno en que detectás la clase es
el turno en que más confiado estás.
