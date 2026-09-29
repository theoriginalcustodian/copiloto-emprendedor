---
name: un-criterio-de-cierre-con-algo-fuera-de-alcance-no-se-cumple-nunca
description: Un sprint que "se estira" sin causa visible puede tener la causa en su propia definición de terminado — un criterio que quedó fuera de alcance por una decisión posterior, y que nadie volvió a leer.
metadata:
  type: feedback
---

**2026-09-29.** El operador preguntó por qué la beta se venía estirando hacía más de una semana sin
avanzar de forma consistente. Medí tres hipótesis y **las tres eran falsas**:

| lo que creíamos | lo que midió |
|---|---|
| «se re-trabaja todo varias veces» | 1,51 PRs por ítem; **62 de 87 ids cerraron en un solo PR** |
| «vamos lento» | **85 PRs mergeados en un solo día** (21/09) |
| «hay ramas con trabajo perdido» | las 8 candidatas eran **residuo**: 44 archivos verificados por contenido en `main` |

La causa estaba en la **definición de terminado**. El Cierre A tenía 7 criterios y el nº5 exigía «APK
`preview` build #2 instalado en el device». Ocho días antes, el mismo operador había movido
**device/EAS al sprint siguiente**. Nadie releyó el criterio después de esa decisión.

## Por qué no da síntoma, y por eso dura

Un criterio inalcanzable **no falla**: queda sin tildar. El sprint se ve «casi terminado» en cada
vuelta, y la vuelta siguiente vuelve a encontrar lo mismo —«está todo, menos esto que no se puede
tocar»—, así que la sensación es de lentitud o de re-trabajo, que es donde se busca la causa. Se
optimiza la velocidad de algo que no tenía un problema de velocidad.

Y el dato que más incomoda: **el tablero ya lo decía textualmente.** La fila `SOP7` llevaba días con
«no cierra en este sprint — lo que resta exige rebuild EAS y el operador difirió device/EAS al SPRINT
SIGUIENTE». Estaba escrito, se leyó varias veces, y se leyó como *el estado de esa fila* en vez de
como *una contradicción con el criterio de cierre global*. Un hecho archivado en el renglón
equivocado es indistinguible de un hecho que nadie sabe.

> Es el reverso de [[lo-que-no-esta-en-la-tabla-de-hitos-no-existe]]: acá **sí** estaba en la tabla, y
> tampoco existió — porque estaba en la fila de un frente y la consecuencia era del sprint entero.

## El control, y cuándo se corre

**Cada vez que se declara algo fuera de alcance, se releen los criterios de cierre buscando ese algo.**
No al final: en el mismo turno en que se difiere. Diferir es barato y se siente como una simplificación
del trabajo; la parte cara —que la meta ahora es inalcanzable— no se ve en ese momento.

La pregunta que lo caza en una línea: *¿algún criterio de terminado menciona lo que acabo de sacar de
alcance?* Si sí, hay dos salidas y ninguna es «seguir»: se re-declara el criterio por acta, o se
acepta explícitamente que el sprint no cierra.

El síntoma que tiene que disparar la revisión, aunque nadie sospeche del criterio: **un cierre que se
pospone más de una vez sin que ninguna medición explique por qué.** Ahí el sospechoso número uno no es
la ejecución, es la definición.

## El corolario del segundo hallazgo

Al medir esto salió también que el esfuerzo había migrado del producto al registro: últimos 7 días,
`fix`+`docs` = **72 %** de los PRs contra 19 % de `feat`, y **10 784 líneas** en
`docs/`+`memoria/`+`scripts/` contra **4 431** en `apps/*`+`motor/`. Eso **no es la causa** del
estiramiento —el trabajo de instrumentos de esta semana cazó defectos reales—, pero sí explica por
qué la sensación de avance no acompañaba: el avance existía y **no era del producto**.

**Why:** porque cuando un cierre se pospone, el reflejo es acelerar la ejecución o buscar re-trabajo,
y si la causa está en la definición ninguna de las dos cosas mueve la aguja. Se gastan sprints enteros
optimizando lo que no falla. Acá fue una semana, con cuatro días de cero commits en el medio.

**How to apply:** (1) en el mismo turno en que difieras o saques algo de alcance, grepeá los criterios
de cierre por ese algo y resolvé la contradicción ahí; (2) si un cierre se posterga dos veces sin una
medición que lo explique, **auditá la definición antes que la ejecución**; (3) cuando una fila de
tablero diga que algo «no cierra en este sprint», preguntá de qué es consecuencia además de esa fila
— el alcance de un hecho casi nunca es el alcance del renglón donde quedó escrito.
