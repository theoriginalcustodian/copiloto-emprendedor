# El escáner de secretos caza la forma **genérica** y falla en la **real**

**Auditoría · 2026-10-06** · sobre `scripts/secretos-check.sh` + `.gitleaks.toml` + su test, el **único
guard fail-closed** del repo y el que protege lo más caro: **el repo es PÚBLICO** · gitleaks **8.30.1**
fijado · los 4 archivos auditados (`secretos-check.sh`, `.gitleaks.toml`, su test y `.githooks/pre-push`)
verificados **idénticos a `origin/main` = `04a82418`**: 0 líneas de diff cada uno, con control positivo
del mismo comando sobre un archivo que sí difiere.

---

## 0 — Veredicto: el guard dispara, y **tiene un agujero con forma**

El escáner **corre y es fail-closed**: `rc=1` ante un hallazgo, `rc=2` si no pudo correr, y distingue
«encontré un secreto» de «no pude cargar la config» leyendo la línea `FTL` de gitleaks (`:71-77`) —una
distinción que el propio código documenta como medida el 22/09, porque el falso *«ABORTA · hallazgo»*
empuja al `--no-verify`, que apaga el hook entero. Todo eso está bien, y su test lo prueba.

**Lo que no está bien es qué formas caza.** Le pasé **9 formas de credencial que este stack usa de
verdad**, cada una con entropía real, y después repetí cada una en **pares de contraste** para aislar la
causa. El resultado no es «le falta una regla»:

> **El mismo secreto, en la misma variable, con la misma entropía, se caza cuando está suelto y
> ESCAPA cuando lleva su prefijo real o va embebido en una URL.**

| forma del valor | ¿cazado? | regla |
|---|---|---|
| `GITHUB_PAT=ghp_<36>` *(control positivo)* | ✅ | `github-pat` |
| `SUPABASE_SERVICE_ROLE_KEY=<JWT eyJ…>` | ✅ | `jwt` |
| `ANTHROPIC_API_KEY=<95 al azar>` | ✅ | `generic-api-key` |
| **`ANTHROPIC_API_KEY=sk-ant-api03-<95 al azar>`** ← la forma **real** | 🔴 **NO** | — |
| **`ANTHROPIC_API_KEY=sk-ant-<40 al azar>`** | 🔴 **NO** | — |
| `ANTHROPIC_API_KEY=<40 al azar>` | ✅ | `generic-api-key` |
| `POSTGRES_PASSWORD=<24>` · `PGPASSWORD=<24>` | ✅ (las dos) | `generic-api-key` |
| **`DATABASE_URL=postgresql://postgres:<24>@db.interno:5432/fusion`** ← la forma **real** | 🔴 **NO** | — |
| `MP_ACCESS_TOKEN=<48 al azar>` | ✅ | `generic-api-key` |
| **`MP_ACCESS_TOKEN=APP_USR-<12>-100625-<32>-<9>`** ← la forma **real** | 🔴 **NO** | — |
| `GRAPHITY_TOKEN` · `UC_INTERNAL_TOKEN` · `AWS_SECRET_ACCESS_KEY` · `GOTRUE_JWT_SECRET` | ✅ (las 4) | `generic-api-key` |

**Las tres que escapan son las tres que importan acá:** la API key de Anthropic (la credencial que más
circula en este workspace: tres sesiones de Claude Code), la password de Postgres **en la forma en que
vive** (`DATABASE_URL`, no `PGPASSWORD`), y el access token de MercadoPago — **el cobro del producto**.

**La causa mecánica:** con `useDefault = true` no hay regla propia para `sk-ant-` ni para connection
strings de Postgres, así que esos valores dependen de `generic-api-key`, que necesita una **cadena
contigua** de alta entropía. Un prefijo con **guiones** (`sk-ant-api03-`, `APP_USR-…-100625-…`) o un valor
rodeado de `:/@` **parte el match**, y el fragmento que queda no alcanza el umbral. **El prefijo que
identifica a la credencial es, literalmente, lo que la salva del escáner.**

## 1 🔴 Y acá está el hallazgo de verdad: **el test varió todo menos la variable que decide**

`scripts/tests/test-secretos-check.sh` **existe, son 174 líneas y 10 casos, y es un test serio.** No es un
placebo: mirá qué dimensión varía cada caso.

```
 1) NEGATIVO: historia limpia -> 0                   <- modo
 2) POSITIVO: un token con forma de PAT de GitHub    <- FORMA  (ghp_)
 3) rango: limpio->malo falla; base..base pasa       <- modo
 4) --refs-stdin (lo que recibe el hook)             <- modo
 5) fail-closed: binario inexistente -> rc=2         <- fail-closed
 6) la allowlist es por fingerprint                  <- config
 7) --arbol: control positivo/negativo               <- modo
 8) config rota != hallazgo (rc=1 por DOS causas)    <- discriminacion
 9) la exclusion de .claude/worktrees/ calla RUIDO   <- allowlist
10) -v dice DONDE sin decir QUE                      <- salida
```

Y ahora el conteo, que es todo:

```
'ghp_'          -> 4 apariciones  (los 4 controles positivos del test)
'sk-ant'        -> 0
'APP_USR'       -> 0
'postgresql://' -> 0
'eyJ' (JWT)     -> 0
```

*(control positivo de mi propio grep sobre el mismo archivo: `rc=1` → 4, `arbol` → 22 — si el grep
estuviera roto, darían 0.)*

> **Diez casos verdes ejercitan exhaustivamente los MODOS del instrumento —árbol, rango, refs-stdin,
> worktrees, fail-closed, verbosidad— y mantienen CONSTANTE la única variable que decide si caza algo:
> la forma del secreto.** Y la constante elegida, `ghp_`, es la única de las tres formas reales de este
> stack que tiene **regla dedicada** en gitleaks. El test no podía fallar en esta dimensión: no la mueve.

Lo mismo dice el comentario del script en `:58-59` —*«control positivo con un canario `ghp_` que SÍ se
detecta»*— pero el comentario es una línea y el test son 174: **la cobertura se verificó con rigor en
todos los ejes salvo el que importa.** Un test de los **modos** del escáner se lee, de buena fe, como un
test del **escáner** → [[instrumento-que-no-mira-nunca-falla]] ·
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]].

Y lo pagué en carne propia, en la dirección opuesta. **Mi primer canario produjo un hallazgo falso de
severidad máxima**: usé relleno `AAAA…` y gitleaks **filtra por entropía**, así que ni el `ghp_` se cazó y
la tabla decía *«1 de 7»*. Si lo hubiera reportado, acusaba de ciego al único guard que sí funciona.
**El fixture era el defecto, no el escáner** → [[un-control-positivo-con-esperado-falso-acusa-al-script]].

⇒ **La lección, que vale para cualquier guard de patrón:** un control positivo con un valor **sintético
suelto** sale verde aunque el guard sea ciego a la credencial real. El control tiene que usar la **forma
REAL** —prefijo incluido, y en el contenedor donde el secreto aparece (una URL, un `.env`, un JSON)— y en
**pares de contraste**: la misma entropía con y sin prefijo. **El par es lo que convierte «no lo cazó» en
«lo salvó el prefijo».**

## 2 — El inventario de riesgo del repo **nombra** lo que el guard no cubre

El `CLAUDE.md` del repo cita la auditoría del 2026-08-06 sobre toda la historia: *«claves privadas 0,
`ghp_` 0, `sk-ant-` 0»*. Esa auditoría se hizo con **greps por patrón**, uno por uno, con control positivo.
**El guard automático que hoy protege cada push no cubre `sk-ant-`.**

⇒ **La cobertura del guard no coincide con el inventario de riesgo que el propio repo escribió.** Lo que
se buscó a mano no es lo que se vigila solo, y nada lo señala: el escáner sale **verde** tanto si no hay
una clave de Anthropic como si hay una.

## 3 — Lo que el guard **sí** hace bien (para que la fila no se lea como «está roto»)

| | |
|---|---|
| ¿dispara? | **sí**, `rc=1` medido sobre el árbol real, y aborta el push (`pre-push:13-16`) |
| ¿fail-closed? | **sí**, explícito: *«hallazgo o escáner roto ⇒ el push aborta»*, con test (caso 5) |
| ¿distingue «no pude correr» de «encontré»? | **sí**, por la línea `FTL`, no por el rc (`:71-77`, caso 8) — el `rc=1` de gitleaks es ambiguo y el script lo sabe |
| ¿filtra el valor del secreto de su salida? | **sí**, `--redact` ⇒ `Secret: REDACTED`, con control negativo |
| ¿binario fijado y verificado? | **sí**, versión + sha256 por plataforma (`:19-21`) |
| la allowlist, ¿baja la cobertura? | **no**, y está razonada en la propia config: `\.env\.e2e$` (secreto local real, nunca trackeado) y `^\.claude/worktrees/` (checkouts de ramas; el camino a publicación es commit+push, donde manda el modo `git`, que corre **primero** y fail-closed). Caso 9 del test |

**Fila `SECRETOSFORMAREAL`** · dueño **planificación** (`scripts/` y `.gitleaks.toml` son suyos) ·
**severidad alta: el repo es público y estas tres credenciales son justo las que circulan.**

**DoD** — reglas propias en `.gitleaks.toml` (`[[rules]]` convive con `useDefault = true`), mínimo:

```
sk-ant-[A-Za-z0-9_-]{20,}                        # Anthropic (api03 y futuros prefijos)
postgres(ql)?://[^:/\s]+:[^@\s]{8,}@             # password embebida en connection string
APP_USR-[0-9A-Za-z-]{20,}                        # MercadoPago produccion
TEST-[0-9]{8,}-[0-9]{6}-[0-9a-f]{20,}            # MercadoPago sandbox
gphy_[A-Za-z0-9]{16,}                            # Graphity (hoy cae por generic, no por forma)
```

**Control positivo, y es la mitad del DoD:** la tabla de §0 **con sus pares de contraste**, corrida por
`--arbol`. **Hoy sale verde en las 3 filas rojas** — sin el par, el fix es indistinguible de no hacerlo.
Va horneado como **caso 11 de `test-secretos-check.sh`** —no como script aparte— porque el agujero no fue
que faltara un test: fue que **el test que existe no mueve esta variable**. El caso 11 es, literalmente,
«variá la forma». El día que alguien suba gitleaks o toque la allowlist, esa es la pregunta que hay que
volver a hacer.

**No duplica nada:** `ls scripts/tests/ | grep -i forma` → 2 hits, y los dos son de otra cosa
(`test-lector-cuenta-por-plataforma.sh`, `test-parser-veredictos-formas-de-tabla.sh`).

## 4 — Cómo corrí el canario, y qué NO hice

Los fixtures son **sintéticos de alta entropía** (`secrets.choice`), **ninguno es una credencial real**, y
**nunca se commitearon**: se escribieron en un archivo del worktree, se escanearon con `--arbol` —el modo
que lee el filesystem sin git— y se borraron con un `trap EXIT`. **Control de limpieza verificado después,
por comando aparte:** `ls CANARIO*` → nada, `git status --porcelain | grep -c canario` → **0** en el
worktree y en el checkout compartido; las salidas crudas del escáner (que salen redactadas) también
borradas.

**No toqué la historia** (`--historia` es one-off y tarda), **no edité `.gitleaksignore`** —el 22/09 ya
hubo una sesión empujada a editarlo a mano para destrabar un PR, y eso es exactamente el desarme del
guard— y **no pusheé ningún fixture**, así que el camino `--refs-stdin` del pre-push quedó sin ejercitar
por mí: lo cubre el caso 4 del test, que existe y pasa.

🤖 auditoría · Opus 5 (1M context)
