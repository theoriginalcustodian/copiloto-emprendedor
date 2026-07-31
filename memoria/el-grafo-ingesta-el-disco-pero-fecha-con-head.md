---
name: el-grafo-ingesta-el-disco-pero-fecha-con-head
description: el bridge parsea el working tree en disco pero sella valid_at con la fecha de HEAD — con el checkout compartido en una rama vieja, el contenido es actual y la fecha miente
metadata:
  type: project
---

# 🕰️🕸️ El grafo ingesta el **disco**, pero pone la fecha de **`HEAD`**

**Medido el 2026-07-31.** El canon dice *«el grafo conoce lo PUSHEADO»*. Es **impreciso**, y la
imprecisión importa justo cuando más se confía en el grafo.

## Lo que hace de verdad

`graphify` parsea el **working tree en disco**. El `valid_at` de cada edge sale del **commit date de
`HEAD`**. Son dos fuentes distintas y nadie las reconcilia.

Probado con un diferencial, no deducido:

| Hecho | Medición |
|---|---|
| `spikes/s5-parche-y-auditor/spike.py` **no existe en `HEAD`** | `git cat-file -e HEAD:<path>` → falla |
| …está en disco | `ls` → existe |
| …y **el grafo lo tiene** | nodo `auditar()`, `created_at` 19:48Z |
| `valid_at` de *todos* los edges | `2026-07-27T22:50:48Z` |
| commit date de `HEAD` | `2026-07-27T19:50:48-03` = **`22:50:48Z`** ← idéntico |

El checkout compartido estaba en `feat/hito9-emitir-factura-por-voz`, **111 commits detrás de
`main`**. Resultado: **contenido actual con fecha 4 días vieja, uniforme para todo el grafo.**

## Por qué muerde

La frase del canon induce dos conclusiones falsas en direcciones opuestas:

- *«Está pusheado, entonces el grafo lo sabe»* → **falso**. El grafo sabe lo que estaba **en disco en
  la última corrida del sync**. Trabajo pusheado desde otro worktree es invisible acá.
- *«No está pusheado, entonces el grafo no lo sabe»* → **también falso**, y es el más peligroso: el
  grafo puede tener código que no está en ninguna rama —un spike a medio hacer, un experimento sin
  commitear— y presentarlo como hecho establecido, fechado con un commit que no lo contiene.

Y el `valid_at` uniforme rompe cualquier consulta temporal: *«¿qué cambió desde X?»* devuelve todo o
nada, porque todos los edges comparten la misma fecha, que es la del `HEAD` de turno.

## Regla

1. **La frescura del grafo es la hora del ÚLTIMO SYNC, no la del último push.** Para saber si el
   grafo conoce algo, comparar `created_at` de sus nodos contra el `mtime` en disco del archivo —
   ese diferencial es barato y no miente. Fue el que resolvió este caso: sync a las 16:50, módulos
   escritos 17:02-17:32, corte exacto.
2. **No leer `valid_at` como «cuándo se escribió ese código».** Es el commit date del `HEAD` del
   checkout que corrió el sync. Si ese checkout está en una rama vieja, es ruido.
3. **Antes de sincronizar, mirar en qué rama está el checkout** — `git rev-list --count HEAD..origin/main`.
   Sincronizar desde un checkout atrasado no corrompe el contenido, pero envenena las fechas.

## El error de razonamiento que casi cometo

Afirmé *«Graphity está caído, lo resuelve el operador»* **de memoria**, y quedó escrito en tres
lugares del doc de estado. El operador preguntó *«¿lo revisaste o me lo decís de memoria?»* —
`/health` y `/ready` dieron verde a la primera. Estaba arriba hacía rato.

Peor: cuando la búsqueda semántica no encontró los módulos de la Fase 3, la explicación cómoda
—*«claro, el grafo está desactualizado porque Graphity estuvo caído»*— **encajaba perfecto y era
falsa**. La causa real (el sync corrió 18 min antes de que existieran los archivos) sólo apareció
cruzando `mtime` contra `created_at`. Un vacío admite infinitas causas y la primera plausible siempre
entra sola.

[[vacio-no-es-hallazgo-correr-el-control]] · [[grafo-primero-codigo-despues-para-localizar]] ·
[[instrumentos-que-confirman-en-vez-de-verificar]] · [[sincronizar-al-vps-desde-el-worktree-equivocado]]
