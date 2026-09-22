---
name: el-disco-lleno-fabrica-rojos-de-gate-que-parecen-del-codigo
description: El gate de backend dio rojo en web y lint por ENOSPC, no por el código. La causa estructural es que cada worktree de agente instala su propio node_modules de ~1 GB — 47 copias, 49 GB. Un recurso de la MÁQUINA agotado no se reporta como tal: se disfraza de defecto del código.
metadata:
  type: feedback
---

# 💾🎭 El disco lleno fabrica ROJOS DE GATE que parecen del código

**LEER cuando un gate, un build o un test da rojo en jobs que no tocaste, o cuando varias sesiones
paralelas empiezan a fallar a la vez.**

## Qué pasó (2026-09-22)

FE2 avisó de rebote —un `find` le falló con «No space left on device»— que `C:` estaba al **100%, con
540 MB libres sobre 466 GB**. En paralelo, el gate de backend sobre `wt-store3-http-test` había dado
`rc=1` con **`web` y `lint` en rojo** y `core`/`backend`/`mobile` en verde.

Ese rojo **no era del código**: era `ENOSPC`. Backend lo leyó bien y lo dijo. Si no lo hubiera mirado,
el veredicto natural habría sido «el PR rompe web y lint» — y el fix habría sido sobre código sano.

## La causa estructural, medida

- **47 worktrees conservaban su propio `node_modules` de ~1.055 MB → ~49 GB**, que es prácticamente
  todo `C:/gfw-src` (44 GB medidos). El checkout principal sólo suma 1,1 GB.
- El disco vivía al ~90% por esa duplicación. Bastó que **dos o tres gates corrieran `npm install` en
  paralelo** para pasar de 90% a 100%.
- Al matar los gates, el disco volvió solo de 540 MB a 44 GB libres: **36 GB eran temporales de los
  `npm install` en vuelo**. O sea el pico es transitorio y no deja rastro para el post-mortem.

Ese último punto es lo que lo hace difícil de cazar: cuando vas a investigar por qué el gate falló, el
espacio **ya volvió**, y la medición te dice que estaba todo bien.

## Por qué no da síntoma como lo que es

Un recurso de la **máquina** agotado no se reporta en el vocabulario de la máquina: se reporta en el
vocabulario de la **herramienta que lo pidió**. `vitest` no dice «el disco está lleno», dice que falló.
El rollup del gate no dice «ENOSPC», dice `web ❌`. Y un job rojo en un PR tiene una explicación
disponible y plausible —el código— que llega antes que la correcta.

Peor: es **parcial y no determinista**. Ganan los jobs que ya habían escrito lo suyo (`core`,
`backend`, `mobile` pasaron), pierden los que escribían en ese instante. Eso produce un patrón de
fallo que *parece* señal («justo web y lint, que son los que toca este PR»).

## La regla

1. **Ante un rojo en jobs que no tocaste, o en varias sesiones a la vez, leé el CUERPO del log antes
   de atribuirlo al código.** Grepeá `ENOSPC|no space left|disk full|EMFILE|ENOMEM` con control
   positivo. El semáforo del rollup no distingue «falló» de «no pudo correr».
   Hermana: [[el-parte-del-proveedor-existe-y-no-lo-lei]].
2. **Un rojo producido en una ventana de disco lleno queda `[INVALIDADO]` hasta releerlo.** Con el
   **verde** el caso es distinto y conviene no exagerarlo: en esta corrida el gate de `wt-a4reg`
   completó 5/5 en verde (583 s, `sucio:false`) durante la misma ventana, y `vitest`/`eslint` fallan
   **ruidosamente** ante `ENOSPC` — no lo saltean en silencio. Así que el verde queda **en duda, no
   anulado**: se confirma releyendo el log por `ENOSPC` y mirando que la duración y el número de
   tests sean los de siempre. Decir «ningún recibo de esa ventana vale» suena riguroso y es una
   afirmación más fuerte que la evidencia — el espejo exacto del error que esta entrada denuncia.
3. **Medí la máquina antes de la hipótesis de código** cuando el fallo es transversal: `df -h` cuesta
   un segundo. La señal «varias sesiones fallan a la vez» casi nunca es código: es un recurso común.
4. **La duplicación por worktree es deuda de disco con interés.** Cada `git worktree add` + `npm
   install` cuesta ~1 GB. Con N sesiones de agente abriendo worktrees por tarea, N crece solo y nadie
   lo mide. `node_modules` es gitignored y regenerable con `npm ci`: podarlo es **reversible**, y es
   la poda de mayor impacto por menor riesgo. Los worktrees cuyo PR ya está `MERGED`/`CLOSED` y sin
   nada sin commitear se remueven enteros.
5. **Al podar, «sin PR» NO es luz verde para borrar.** El squash-merge no deja rastro por ancestry, así
   que una rama sin PR puede ser tanto basura como trabajo sin embarcar. Se conserva y se revisa a
   mano. Mismo criterio que [[vacio-no-es-hallazgo-correr-el-control]].

## El detalle del instrumento que casi me muerde

Mi primer inventario de worktrees usó `awk '/^worktree /{p=$2}'` — que **parte por espacios**. Los
worktrees bajo `C:/Proyectos/Claude/Claude code/...` salieron todos como `Claude`, con path roto: 7
worktrees invisibles, sin error. El control que lo cazó fue mirar la columna, no confiar en el conteo.
Y el control positivo obligatorio del inventario es que **`git -C <path inexistente>` FALLE**: si
contesta, está contestando por el checkout principal y todo el inventario mide otro sujeto
([[el-instrumento-respondio-sobre-otro-sujeto]]).

Relacionado: [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] ·
[[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]] ·
[[el-puerto-que-contesta-puede-ser-de-otra-sesion]] ·
[[una-sesion-en-worktree-es-invisible-para-el-monitor-el-slug-sale-del-cwd]]
