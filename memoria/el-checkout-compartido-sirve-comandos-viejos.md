---
name: el-checkout-compartido-sirve-comandos-viejos
description: Los slash commands, hooks y scripts se leen del checkout donde estás parado. Si esa rama es vieja, corrés la versión anterior de tus propias herramientas — y grepear ahí "verifica" un estado que ya no existe.
metadata:
  type: project
---

Una auditoría externa reportó que `.claude/commands/monitoreo.md` seguía instalando dos crones que se
habían retirado esa misma mañana. Lo grepeé, **confirmé el hallazgo**, y estaba equivocado: en `main`
ya estaban podados. Lo que grepeamos —los dos— fue el **checkout compartido**, parado en una rama de
feature creada antes del fix.

**El hallazgo era falso y el problema era real, pero otro:** ese checkout es desde donde trabajan las
sesiones, así que **sirve la versión vieja de los slash commands** hasta que su rama avance. Un
mecanismo retirado sigue vivo para quien está parado en la rama anterior.

**Dos reglas que salen de acá:**

1. **Para verificar el estado del repo, consultá `origin/main`, no el working tree.**
   `git show origin/main:<path>` o `git ls-tree -r origin/main`. El working tree responde «qué hay en
   mi rama», que casi nunca es la pregunta cuando verificás si algo está arreglado.
2. **Todo lo que el harness lee del cwd —`.claude/commands/`, hooks del repo, `scripts/`— hereda la
   antigüedad de la rama del checkout.** Un fix mergeado a `main` no está activo para una sesión que
   sigue en una rama vieja, y **no hay ningún aviso**: el comando existe, corre, y hace lo de antes.

Es hermana de [[sincronizar-al-vps-desde-el-worktree-equivocado]]: la misma clase de error —el
artefacto correcto leído desde el lugar equivocado— pero acá el que queda desactualizado es **tu
propio instrumental**, no el destino.

Relacionadas: [[la-evidencia-vence-y-el-documento-no-lo-dice]] ·
[[verificar-la-composicion-root-no-el-default]].

## La combinación que hace RE-IMPLEMENTAR lo que ya existe (2026-08-07)

Fui a tomar un hito del tablero (`RAILz`: sacar `ajustes` de `TABS`, estado **pendiente**, disparador
cumplido). Grepeé `TABS` en el checkout: **5 entradas y ningún `ajustes`**. La lectura inmediata fue
«este no es el archivo». Era el archivo correcto **en la versión de hace 237 commits**. En
`origin/main` el hito estaba **hecho desde hacía horas**, con las dos puertas de reemplazo nombradas
en el propio docstring.

**Por qué muerde más que el caso de arriba.** Ahí el checkout viejo producía un hallazgo falso —algo
que uno va a intentar arreglar y descubre—. Acá produce **trabajo duplicado que sale limpio**: el
tablero dice «pendiente», el archivo efectivamente no tiene el cambio, la implementación compila, los
tests pasan y el PR se ve impecable. Nada en el camino contradice la premisa. El conflicto recién
aparece al mergear, o nunca — si el diff es equivalente, se pisa solo y queda como si nada.

Es un **caso de dos evidencias viejas que se confirman entre sí**: el tablero envejece por un lado, el
checkout por el otro, y coinciden. Dos fuentes desactualizadas de forma independiente se leen como
corroboración.

**How to apply:** antes de tomar un hito de `PLAN.md`, verificá su condición contra
`git show origin/main:<archivo>`, no contra el disco. Si el hito ya está hecho, el trabajo es un
`dato_` al dueño del tablero — no el hito.

## Corrección: el contador de commits NO mide los archivos del working tree (2026-08-12)

Usé el «237/364 commits atrás» como si midiera los archivos, y **no los mide**.
`git rev-list --count HEAD..origin/main` mide el **HEAD** del checkout compartido, que está parado en
una rama vieja. Pero ese checkout tiene ~100 archivos **modificados sin commitear**, porque las
sesiones escriben scripts y docs directamente ahí: esos archivos pueden estar **al día o incluso más
nuevos que `main`**.

Concretamente: escribí en el registro de deuda un bloqueante **con dueño operador** afirmando que
`scripts/vigilancia-check.sh` del checkout compartido era la versión vieja «sin el chequeo», y que por
eso los fixes de vigilancia #394/#400/#409/#414 tampoco corrían. Una línea lo desmintió:

```
$ diff <(git show origin/main:scripts/vigilancia-check.sh) scripts/vigilancia-check.sh
  → sólo faltaba mi propio bloque de 23 líneas
```

Estaba al día. Los otros fixes **sí** corren. La causa real era mucho más chica y era mía: escribí el
script en un worktree y nunca lo copié al checkout que ejecuta.

**Por qué esto no contradice lo de arriba, y por qué muerde igual.** El checkout compartido no es
«viejo»: es **inconsistente** — archivos trackeados sin tocar viven en la rama vieja, y archivos que
alguna sesión editó a mano están al día. Un solo número no puede describir las dos mitades, así que
cualquier conclusión sacada del contador es una inferencia disfrazada de medición.

**How to apply:** para saber qué versión de un archivo corre en ese checkout, **diffealo**
(`diff <(git show origin/main:<path>) <path>`). Nunca lo deduzcas del contador de commits, y nunca
generalices de un archivo a «todo `scripts/`». Y si vas a escribir la conclusión en un registro
versionado con dueño ajeno, la barra es más alta, no más baja:
[[una-orden-cerrada-exige-evidencia-de-device]] es la misma exigencia en otro contexto.

---

## Faz nueva (2026-09-30): con squash-merge, «¿este commit está en main?» es un NO **permanente**

El gancho de esta entrada dice «diffeá el archivo; el contador de commits no lo mide». Falta el porqué, y
el porqué es lo que hace que el error se sienta como una medición sólida.

**Este repo mergea por squash.** Un squash crea en `main` un commit **nuevo**, con otro SHA y el **mismo
árbol**. El commit original de la rama **nunca** pasa a ser ancestro de `main` — ni antes de mergear, ni
después. Por lo tanto:

```bash
git merge-base --is-ancestor <commit-de-una-rama> origin/main   # -> NO, para siempre
```

**no distingue «falta mergear» de «ya se mergeó hace una semana».** Es un falso negativo por construcción,
y el peor tipo: **no tiene estado de recuperación**, así que ninguna re-medición lo corrige.

**Caso.** Verifiqué por efecto un ítem de cola (los hallazgos P-1..P-4 del prototipo). `--is-ancestor`
dijo NO, `git branch -r --contains` confirmó que el commit sólo vivía en su rama, y emití un `pedido_` a
frontend2 diciendo que su trabajo no llegaba a `main`. **Estaba mergeado desde el PR #717**: el blob del
`index.html` del prototipo era **idéntico** (`2d20e38a`) en las dos puntas. Dos de los tres archivos que
reclamé ya estaban, y el tercero estaba **más nuevo en `main`** que en su rama — o sea que mi reclamo
apuntaba al revés. Tuve que retractarme ante una sesión par.

**El test correcto es el blob, y cuesta lo mismo:**

```bash
[ "$(git rev-parse "$RAMA:$f")" = "$(git rev-parse "origin/main:$f")" ] && echo IDENTICO || echo DIFIERE
```

Sobre los 25 archivos que los commits tocaban: **18 idénticos · 7 difieren · 0 sólo en la rama**, con
control positivo horneado (un archivo que se sabe igual **tiene** que salir idéntico, o el comparador está
roto). Y cuando difiere, **el signo del diff dice la dirección**: `−11 líneas` del lado de la rama significa
que `main` es el que está adelante.

**Cómo aplicarlo:** cualquier afirmación de la forma «esto no llegó a `main`» se mide por **contenido**, no
por pertenencia de commits — y antes de mandársela a otra sesión, con la dirección del diff escrita. Ver
[[el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama]] y
[[push-es-el-ultimo-paso-no-el-primero]].
