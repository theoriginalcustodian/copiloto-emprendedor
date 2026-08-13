---
name: el-instrumento-respondio-sobre-otro-sujeto
description: Un chequeo que sale limpio porque miró el lugar equivocado es indistinguible de uno que pasó. Seis veces en un día — la respuesta llega, es plausible, y es de otro sujeto. El caso peor - git -C sobre un worktree roto responde por el checkout principal sin fallar.
metadata:
  type: feedback
---

# 🎯🕳️ El instrumento respondió, pero sobre otro sujeto

El 2026-08-13 este error apareció **seis veces en un día**, en seis instrumentos distintos.
Siempre igual: el comando corre, devuelve algo plausible, y **el sujeto medido no es el que creías**.

| # | Instrumento | Lo que devolvió | El sujeto real |
|---|---|---|---|
| 1 | chequeo de deuda gateado con `-f $BUZON/PLAN.md` | verde | `coordinacion/` está gitignoreada: en un worktree el gate no se cumple y el chequeo **se saltea solo** |
| 2 | caso 8 del test en Actions | «todo verde» | el caso **no corrió**: sin ref `origin/main`, se salteaba |
| 3 | `merge-base --is-ancestor` para "¿está mergeado?" | 18 de 29 "no mergeados" | acá se mergea con **squash**: la rama nunca es ancestro, así que medía otra cosa |
| 4 | búsqueda de worktrees huérfanos | 0 huérfanos | miraba `$REPO_ROOT/.claude/worktrees`, que **no existe** cuando el script corre desde un worktree. Había 21 |
| 5 | escalador de edad del buzón | `999999min` (≈1900 años) | comparaba `fecha_del_nombre != hoy` para decir «de un día **anterior**». Las sesiones nombran en UTC y `date` corre en local: a las 22:41 los **13 archivos de hoy** eran «de otro día» |
| 6 | lint de contratos «PROSA PURA» | contrato sin artefacto | aceptaba `docs/…`, `.png`, `mockup` — **no** un path de código. El contrato citaba `…/FormularioIngreso.tsx:255` y salía marcado |

## El caso que da más miedo, porque git no falla

```
$ cd .claude/worktrees/cal1-google-calendar     # registrado en `git worktree list`
$ git rev-parse --show-toplevel
C:/Proyectos/Claude/Claude code/copiloto-emprendedor      # ← el CHECKOUT PRINCIPAL
$ git status --porcelain | wc -l
405
```

Ese directorio perdió su archivo `.git`. Git **no da error**: camina hacia arriba hasta encontrar un
repositorio y responde por **ese**. Un script de higiene que preguntaba «¿este worktree está limpio?»
estaba recibiendo el estado del checkout compartido — 405 archivos modificados de otras sesiones.

Lo salvó una decisión de diseño tomada antes, no la lógica: **`git worktree remove` sin `--force`**.
Git se negó a borrar cuatro directorios y el script los dejó intactos. Si hubiera puesto `--force`
razonando «son sólo `node_modules`», habría borrado contenido que **no se puede verificar** (sin
`.git`, ninguna herramienta de git puede decir qué hay ahí que no esté en `main`).

## Por qué es distinto de "control positivo falso"

[[un-disparador-cumplido-no-avisa-a-nadie]] cubre *«sale verde» no es un control positivo*. Esto es un
paso antes: **el instrumento sí ejerce su lógica, y la ejerce sobre el sujeto equivocado**. No hay
salteo visible, no hay error, no hay silencio sospechoso — hay una respuesta bien formada sobre otra
cosa. Por eso no lo caza revisar la lógica: la lógica está bien.

## Tres vueltas de tuerca que aparecieron en los casos 5 y 6

**(a) Una alarma permanente es un instrumento apagado, no uno estricto.** El `999999min` sonaba en
*todos* los ciclos. Nadie lo apagó — se leyó, se descartó por absurdo, y se siguió. Eso es peor que
no tenerlo: el próximo pedido realmente abandonado se lee **igual que los otros trece**. Un
instrumento que nunca calla no distingue, y no distinguir es exactamente lo que se le pide.

**(b) Al arreglar una mentira, fijate para qué lado empieza a mentir.** Corregido el atajo por fecha,
el mismo pedido de 40 minutos reales pasó a reportar **0**: sin sidecar previo, el primer avistamiento
asumía «ahora». El escalador dejó de mentir hacia arriba y empezó a mentir **hacia abajo**, que es
peor porque *no se nota* — un `999999` te hace sospechar, un `0min` te tranquiliza. El fix completo
fue poner el `mtime` como piso. **Después de arreglar un instrumento, medí el mismo caso real que lo
destapó y comparalo con la verdad conocida**, no sólo con el test.

**(c) Un instrumento puede estar desmentido por el resultado del trabajo que juzga.** El lint marcaba
«PROSA PURA» un contrato que frontend ejecutó sin una sola pregunta, cerrando PR #433 con control
negativo propio. Esa contradicción estaba disponible desde el primer ciclo y nadie la miró: la señal
más barata para auditar un juez es **preguntarle al juzgado cómo le fue**.

## How to apply

Antes de creerle a un chequeo que sale limpio, **verificá que vio al sujeto**:

- **Poné el positivo primero en el test.** Si el instrumento no puede nombrar al sujeto que está
  midiendo, los negativos no prueban nada. En `test-podar-worktrees.sh` el caso 3 («¿aparece el
  worktree de prueba en el informe?») va **antes** que los dos negativos, por esto.
- **Identidad explícita**: cuando una herramienta puede resolver un contexto por su cuenta (git
  caminando hacia arriba, un path relativo, una ref por defecto), comparalo contra lo que esperabas —
  `[ "$(git -C "$d" rev-parse --show-toplevel)" = "$d" ]`.
- **Un cero es una hipótesis, no un resultado** (canon 5). «0 huérfanos», «0 hallazgos», «nada
  pendiente»: contrastá con un conteo independiente antes de reportarlo.
- **Cuidado con lo que parece prudencia.** El caso 3 se ve conservador («no mergeado, no toco»), y por
  eso pasó desapercibido: un instrumento que nunca dice que sí es indistinguible de no tenerlo.

Relacionadas: [[el-checkout-compartido-sirve-comandos-viejos]] (el contador de commits no mide el
working tree) · [[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]].
