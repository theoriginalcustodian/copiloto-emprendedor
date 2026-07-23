---
name: regla-escrita-sobre-el-setup-de-otro
description: "Cinco veces le escribi a otra sesion una regla que no podia cumplir, porque asumi su setup en vez de preguntarselo. Y la peor variante: ABLANDAR una instruccion del operador hasta que encaje con lo que uno cree del sistema. Es el eje A de [[el-contrato-afirma-el-mecanismo-que-no-opero]]. LEER antes de asignarle una accion a otro en un contrato o regla."
metadata:
  node_type: memory
  type: feedback
---

**Cuando una regla o un contrato le asigna una acción a otro, la factibilidad y la forma de esa
acción las confirma quien la ejecuta — antes de que quede escrita.**

**Cuatro casos en un solo día (2026-07-22), todos míos:**

| Escribí | El dato que no tenía | Quién lo tenía |
|---|---|---|
| «rama por hito, de acá en más» | FRONTEND comparte el **checkout**: `checkout -b` mueve el árbol de las tres sesiones | FRONTEND |
| «armá tu worktree propio» | Ese worktree **mueve el árbol que Metro sirve** — y había dos corridas en device pendientes contra el actual | FRONTEND |
| «backend no tiene el aparato, la corrida la hace quien lo tenga» | BACKEND tiene **ADB por USB** al teléfono | BACKEND / el operador |
| «no hay ningún segmento fijo que compita con `/clientes/{id}`» | `clientes.ts` ya llamaba a **`/clientes/opciones`** desde antes | el repo (un `grep`) |
| «provisioná el tenant `copiloto` con `provision-tenant.sh`» (a BACKEND, 2026-07-22) | BACKEND **no tiene admin de Graphity** — `provision-tenant.sh` da **403**; su key es común | BACKEND (un intento contra `/admin`) |

**Las cinco veces el dato lo tenía el que iba a ejecutar, y las cinco veces era barato pedirlo.** Esta
entrada es el **eje A** (setup de una persona/sesión) de un patrón más amplio: ver
[[el-contrato-afirma-el-mecanismo-que-no-opero]], que suma el **eje B** (mecanismo de un sistema) y el
guardrail común.

## Por qué pasa, y no es descuido

Escribir la regla se siente como el trabajo, y confirmarla como un trámite. Peor: **el documento que
describe el setup se lee como el setup**. La matriz de dueños decía «device de pruebas → FRONTEND» —
cierto para builds de EAS— y yo lo leí como «el teléfono es inaccesible para backend». **Un documento
no es el sistema: es la foto de cuando alguien lo escribió**, y quien lo escribió tampoco tenía todo
el cuadro.

El costo no es la regla mal escrita: es que **el otro la incumple y parece indisciplina**. Una regla
que el destinatario no puede cumplir por setup es peor que no tenerla.

## 🔴 La variante peor: ablandar la instrucción hasta que encaje

El caso del teléfono no fue sólo una premisa falsa. **El operador ya me lo había dicho el día
anterior** —*«la sesión de backend tiene que probar todo desde el propio teléfono»*— y yo lo
reinterpreté como *«lo hace quien tenga el aparato»*, porque no me cerraba con lo que yo creía del
setup.

**No ignoré la instrucción: la ablandé.** Y eso es mucho más difícil de detectar que desobedecerla,
porque **queda escrito algo parecido** y todos siguen adelante creyendo que se cumplió. El operador
tuvo que decirlo tres veces.

**Señal de alarma, y es interna:** cuando una instrucción no encaja con tu modelo del sistema, la
tentación es ajustar la instrucción. **Lo que hay que ajustar es el modelo** — o preguntar. Si te
escuchás escribiendo una versión «más razonable» de lo que te pidieron, ahí está el error.

## La regla operativa

1. Si la acción la ejecuta otro → **confirmá con él antes de escribirla**, no después.
2. Si la regla depende de una superficie del repo (una ruta, un módulo, un nombre) → **grepeá esa
   superficie antes de declararla libre**. Un contrato no nace sobre terreno vacío.
3. Si una instrucción del operador no te cierra → **preguntá**. No la traduzcas a algo que sí te
   cierre.

**Lo que rinde de esto es barato:** las cuatro veces, un mensaje al buzón o un `grep` habrían
alcanzado. Y las cuatro se cazaron igual —porque el que iba a ejecutar levantó la mano— pero tarde:
con la regla ya escrita, ya acusada, y en un caso con el trabajo ya empezado.

[[verificar-que-el-camino-recomendado-existe]] [[mensaje-entregado-donde-nadie-mira]]
[[coordinacion-tres-sesiones-buzon]] [[no-codificar-la-esperanza-principio-raiz]]
