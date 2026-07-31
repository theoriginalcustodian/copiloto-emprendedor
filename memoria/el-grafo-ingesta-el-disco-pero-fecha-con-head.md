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

## 🧾 Deuda abierta — el reconcile aborta (dueña: sesión de planificación · desde 2026-07-31)

La reingesta del 2026-07-31 terminó con **exit real 1** (el harness dijo `0`: era el status del
`| tail`, [[el-pipe-se-come-el-exit-code]]). La **ingesta** sí entró —los 5 módulos están, verificados
por consulta— pero el **reconcile abortó**:

```
reconcile abortado: el diff borraría 221 objetos (tope absoluto 200)
```

**El guard funcionó**: se negó a un borrado masivo. **No se corrió con `--force`**, y no debe correrse
a ciegas: `bridge sync` sólo ofrece `--force`, **no hay dry-run que permita ver cuáles son los 221**,
así que forzar es un borrado sin inventario — justo lo que el guard existe para evitar.

**El impacto NO era bajo, y el reconcile no es opcional.** Medido después: el guard **aborta el
`pre-push`**, que es fail-closed → **ningún push entra** mientras el diff supere el tope
(`EXIT_REAL=1`, `failed to push some refs`). Deja de ser higiene del grafo y pasa a bloquear el
trabajo diario. Y para un grafo que es el **modelo de la app sobre sí misma**, un reconcile que nunca
corre significa que el grafo **sólo agrega y jamás olvida**: acumula piezas fantasma.

### Los 221, enumerados (no hay dry-run: hubo que escribirlo)

`bridge sync` sólo ofrece `--force`. Se escribió un dry-run reusando el propio `expected_uuids` /
`plan_deletions` del bridge para reproducir el mismo `present − expected` **e imprimirlo** con nombre
y `source_file`. Resultado: **27 nodos + 194 aristas, `FALTANTES = 0`** (nada de lo esperado faltaba
en el grafo — la ingesta estaba completa). Todos huérfanos:

- **26 funciones locales** (`conn_factory`, `factory`, `f`) de los 16 test files del refactor de RLS
  de ese mismo día — confirmado en el código: quedan **0** en `test_context_factory` y
  `test_actividad_store`.
- **1 `TestClient` viejo + sus 165 aristas** colgando.

### ⚠️ Tres hipótesis mías, las tres refutadas al medir — y todas por el mismo error

1. *«La causa es el enricher `co_change` con la historia del checkout atrasado»* → **falso**: el repo
   no es shallow (457 commits) y graphify extrajo 7.963 nodos.
2. *«La identidad de los `ExternalSymbol` es inestable y cada sync fabrica huérfanos, así que el 221
   va a crecer»* → **falso**: `node_uuid` es **determinístico** (`identity.py:32`) y el contador dio
   **221 en dos corridas seguidas**. Los tres nodos `TestClient` son `node_id` distintos (el símbolo
   entra por varias puertas), no el mismo nodo re-creado.
3. *«Falta la relación de herencia: 26 aristas `extends` descartadas — agujero estructural»* →
   **falso**: `inherits` (81 aristas) **ya está mapeado** a `INHERITS`. Las 26 `extends` son de
   archivos de **configuración** (`tsconfig` `lib`/`include`, `app.json` `plugins`/`permissions`).

**El patrón común: inferí desde el NOMBRE en vez de leer el CONTENIDO.** "extends" sonó a herencia,
"tres nodos iguales" sonó a identidad rota, "grafo viejo" sonó a enricher roto. Ninguna resistió
`Read` + un conteo. Es [[vacio-no-es-hallazgo-correr-el-control]] aplicado a los **nombres**: un
identificador sugestivo es una hipótesis disfrazada de dato, igual que un vacío.

### La raíz real, y el sello que faltaba

El deploy es **`tar | ssh`**: en el VPS **no hay git**. Pero *sí* hay ancla parcial — el gate de drift
(`deploy.sh:43-55`) **aborta** si `apps/copiloto` o `motor` difieren de `origin/main`. Cubre **2 de
los 5 paths** que empaqueta el tar; `apps/copiloto-web`, `deploy/worker` y `deploy/copiloto` van sin
verificar (16 archivos sucios en la primera medición).

Por eso se agregó **`DEPLOY-MANIFEST.json`** al árbol desplegado: SHA de `origin/main`, si el gate se
aplicó o se salteó, **qué paths están anclados y cuáles no**. Sin ese sello, el ciclo de autosanación
no puede distinguir *«el grafo está al día»* de *«el grafo describe otra cosa»* — y parchearía a
ciegas un código que no es el que tiró el trauma. `[PENDIENTE_VERIFICAR_EN_DEPLOY_REAL]`: validado
por sintaxis y por JSON parseado, **no** contra un deploy vivo.

**Decisión abierta del operador:** desde qué árbol sincroniza el grafo. Un grafo de **prod** (lo que
necesita el sanador) y uno de **desarrollo** (lo que necesitan las sesiones para localizar) son dos
preguntas distintas; un solo grafo le miente a uno de los dos consumidores.

[[vacio-no-es-hallazgo-correr-el-control]] · [[grafo-primero-codigo-despues-para-localizar]] ·
[[instrumentos-que-confirman-en-vez-de-verificar]] · [[sincronizar-al-vps-desde-el-worktree-equivocado]] ·
[[el-pipe-se-come-el-exit-code]] · [[cero-deuda-no-gestionada]]
