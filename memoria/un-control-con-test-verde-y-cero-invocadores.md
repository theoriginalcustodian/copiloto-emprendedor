---
name: un-control-con-test-verde-y-cero-invocadores
description: Un script con test verde que nadie invoca es indistinguible de uno que no existe — y un permiso en la allowlist se lee como si fuera el cableado.
metadata:
  type: feedback
---

# Un control con test VERDE y CERO invocadores no existe

**Medido el 2026-10-18.** Había **145 worktrees** acumulados. `scripts/podar-worktrees.sh`
existía **desde agosto**, 374 líneas, tres guardas independientes bien pensadas (ancestro de main ·
GitHub dice MERGED · contenido idéntico a `origin/main`), dry-run por default, y **test verde**.
Nunca podó nada. Dos mitades, y cada una sola habría bastado para el mismo resultado:

1. **Nadie lo invocaba.** `grep -rn 'podar-worktrees'` sobre todo el repo daba **un solo hit fuera
   del propio script**: una entrada de **permiso** en `.claude/settings.local.json`
   (`Bash(bash scripts/podar-worktrees.sh:*)`). Ningún cron, ningún hook, ningún gate.
2. **Su default era ciego.** El contraste antes/después midió **0 de 3** worktrees entrando al
   análisis con las bases por default (7 directorios declarados a mano, de los cuales ninguno era
   donde hoy viven) contra **162** después de derivarlas de `git worktree list`. Es decir: incluso
   cableado, habría reportado `0 podables` sin haber mirado nada.

## Por qué el test verde no acredita nada

El test probaba el **artefacto**, no el **disparador**. Son preguntas distintas y sólo una de las
dos estaba cubierta:

| Pregunta | ¿Quién la contesta? | ¿Estaba? |
|---|---|---|
| ¿el script decide bien a quién podar? | el test de agosto | ✅ |
| ¿alguien lo corre alguna vez? | nada | ❌ |

Un artefacto correcto con cero invocadores y un artefacto inexistente producen **exactamente el
mismo estado del mundo**. La diferencia es que el primero **tranquiliza**: aparece en el grep, tiene
cabecera, tiene test. Eso es peor que no tenerlo, porque apaga la búsqueda.

## El permiso disfrazado de cableado

El hit del grep era una entrada de **allowlist**. Un permiso dice *«si alguien lo corre, dejalo»* —
no dice que alguien lo corra. Pero al grepear, un `settings.local.json` que nombra al script se lee
como integración. **Un permiso no es un disparador.** Al medir si algo está cableado, el hit sólo
cuenta si es un **invocador** (cron, hook, `ci/*.sh`, otro script): contá invocadores, nunca
menciones.

## Agravante: `0 podables` se lee como «está limpio»

El reporte de un instrumento ciego es indistinguible del de un instrumento que mira y no encuentra
nada. `0 podables` **significa** «no miré» y **se lee** «está limpio». Por eso el default de un
instrumento se **deriva** del estado real (acá: `git worktree list`), nunca se **declara** en una
lista a mano que envejece en silencio. La cabecera del script incluso afirmaba que *«el default
conserva el comportamiento de los crones que ya lo invocan»* — los crones no existían.

## Es la CUARTA vez que este repo lo paga

`scripts/ci/lint.sh:60-115` ya tiene tres gates cableados a mano por el mismo motivo, cada uno con
su cartel de «CERO invocadores»: `CONTROLESDEPLOYSINGATE` (6 controles), `DURABGATE`,
`MAPEOSINGATE`. El patrón no es el dominio — es que **escribir el control y cablearlo son dos
trabajos**, y el segundo no tiene síntoma propio cuando falta.

**Why:** el repo ya había medido que una norma escrita no se cumple sola (el buzón pasó de 32 a 136
archivos **con** la regla de archivado manual escrita, y sólo lo arregló un janitor automático:
[[buzon-se-ordena-por-janitor-no-por-disciplina]]). Un script sin disparador es la misma falla una
capa más abajo: la parte mecánica quedó dependiendo de que alguien se acuerde.

**How to apply:**
- Al declarar listo un control, medí su **disparador** con un comando, no con la memoria:
  `grep -rn '<script>' --include='*.sh' --include='*.mjs' --include='*.yml' --include='*.json'` y
  **descartá los hits de permisos y de docs**. Si el único resultado es el propio script, no está
  cableado.
- El test tiene que cubrir **que dispare**, no sólo que decida bien. El de hoy
  (`scripts/tests/test-hook-poda-worktrees.sh`) lleva un control **positivo** explícito —«sin marca
  previa, LANZA»— porque sin él el control del throttle saldría verde aunque el hook no lanzara
  nunca: verde por ausencia ([[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]).
- Los defaults de un instrumento se **derivan** del estado del sistema. Una lista declarada a mano
  es un [[instrumento-que-no-mira-nunca-falla]] esperando a envejecer.
- Y antes de diseñar el control: buscá si ya existe. El trabajo de ayer reinventó a mano lo que este
  script ya hacía mejor. [[el-fix-ya-existe-en-otro-call-site]]

**Cierre:** `11c02fb3` (PR #1303, CI 6/6) — hook `SessionStart` +
`scripts/poda-worktrees-en-background.sh` + bases derivadas + test del disparador, documentado en
`CLAUDE.md §3.sexies`. Efecto medido: **145 → 3 worktrees**.
