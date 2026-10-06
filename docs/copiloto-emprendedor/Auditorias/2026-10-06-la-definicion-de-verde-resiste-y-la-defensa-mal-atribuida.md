# La definición de verde **resiste** — y la única grieta es una **defensa mal atribuida**

**Auditoría · 2026-10-06** · quinta pasada de la misma lente, sobre **`gate.sh` + los 5 `scripts/ci/*.sh`**
— la definición de verde del proyecto (ADR-001). La pregunta que la motivó, de planificación: *«si la
definición de verde afirma menos de lo que parece, cambia el significado de cada recibo que citamos para
mergear»*.

**Veredicto: no afirma menos. Cada recibo significa lo que dice.** Ocho candidatos murieron al medirlos.

---

## 0 — Los ocho candidatos, y la medición que mató a cada uno

Entré a buscar un instrumento que pudiera salir **verde sin mirar nada** — el patrón que ya cacé tres
veces hoy (`SMOKEDENOM`, `LINTDENOM`, `CIVERDEDENOM`). No está.

| lo que busqué | por qué se cae |
|---|---|
| `core.sh` sale verde si no hay tests | **`vitest run` con 0 test files → `rc=1`**, «No test files found, exiting with code 1». Control +: 634 passed, `rc=0`. Y `passWithNoTests` **no está declarado** en ninguna config (control + del grep: encontró los `package.json` con vitest/jest) |
| el reintento del EPERM convierte un rojo real en verde | `jest-eperm-reintentable.mjs:41` exige `numFailedTests==0` **y** ninguna aserción roja; `:42` exige que **todas** las suites rojas sean EPERM de caché. Su propio comentario: *«Ante la duda, NO se reintenta: reintentar un rojo real lo convierte en verde falso»* |
| `nativo-freeze.sh` es fail-open y en CI nunca se evalúa | **ya pagado y mecanizado**: `tests.yml:135-145` trae `fetch-depth: 0` con el porqué escrito —*«sin esto el guard de congelamiento nativo NO EVALUABA NUNCA»*— más `fetch-depth-check.py` y `test-nativo-freeze-evalua.sh` |
| el `collect` de `backend.sh` dice validar el motor y colecta sólo `tests` | **63 de 187** archivos de `tests/` importan del motor (18 de `backend.agent`, 45 de `clients.agent`) y `conftest` corre `ensure_paths()`: el collect **sí** valida imports/mount |
| `web.sh` no chequea tipos | **ya pagado**: `--build --force` con el diagnóstico escrito en el script — `tsc --noEmit` sobre un tsconfig de referencias *«compila el proyecto vacío: exit 0 sin mirar un solo archivo»*, y *«este paso nunca chequeó tipos desde que existe»* |
| `gate.sh` toma el rc del pipe y no del job | usa **`PIPESTATUS[0]`** (`:132`). El pipe por `tee` no se come el código |
| un job cuyo script no existe pasa | `bash <inexistente>` → `rc=127` → `failed`. Y cada rama de error del bloque backend (`:186-212`) **escribe `failed`**, no se saltea |
| un recibo sin `.detalle` cubre sin aviso | refutado el día anterior con recibos fabricados: `sin-detalle` y `detalle-null` **sí** avisan |

Dos de los ocho ya estaban **arreglados con el porqué escrito en el propio script** (`web.sh`,
`nativo-freeze`), lo cual es su propia señal: este repo ya pagó esta clase de defecto y dejó la factura
donde se lee.

## 1 — La única grieta: **`GATERECIBOTEST`**, y no es un fail-open

`gate.sh:40-41` afirma:

> *«Una corrida con overrides es un TEST (jobs stub): su recibo jamás va a la copia real, o un stub
> `exit 0` quedaría cubriendo un SHA que nadie probó.»*

**La primera mitad es falsa.** La protección de `:42-44` desvía `RECIBO_COMUN`; a `RECIBO_DIR` (`:37`)
sólo lo desvía `GATE_RECIBO_DIR`. Canario en **repo temporal** (ningún recibo real tocado):

```
A)   GATE_CI_DIR=<stubs>   sin GATE_RECIBO_DIR  ->  recibo en .ci-recibos/<sha>.json   <- el REAL
                                                    jobs: {"core":"ok"}  <- lo escribio un stub
                                                    que imprime "no corri ningun test"
A.2) recibo-cubre.sh <sha>                      ->  NO cubre: web/mobile/lint/backend=ausente
B)   + GATE_RECIBO_DIR            (control +)   ->  se desvia a $T/rec; el real queda vacio
C)   sin ningun override          (control +)   ->  .ci-recibos/ SI + copia al git-common-dir
```

**Lo que impide el falso verde no es la protección que el comentario cita: es `recibo-cubre.sh`
exigiendo los 5 jobs.** La defensa real vive en **otro script**, del lado del consumidor.

> **Es una defensa mal atribuida, y eso es lo que la hace reportable.** Hoy no hay daño: un stub de un
> job no cubre, porque el consumidor pide cinco. Pero quien lea `gate.sh` concluye que el productor está
> protegido, y **no lo está**. El día que `recibo-cubre.sh` se relaje a «los jobs que corrieron» —o que
> alguien stubee los cinco— el agujero se abre, y el comentario seguirá diciendo que está cubierto.

**Y el eje no movido, por segunda vez en el día:** los **tres** tests que usan `GATE_CI_DIR`
(`test-gate-args-y-recibo.sh:28`, `test-recibo-cubre.sh:77`, y `test-gate-hook-secretos.sh:37` con
`env -u`) lo setean **siempre junto con `GATE_RECIBO_DIR`**, o limpian los dos. **Ninguno mueve una sola
de las dos variables** — y el caso interesante es exactamente el de una sola.

**Fila `GATERECIBOTEST`** · dueño **planificación** · **severidad baja** (no alcanzable como falso verde
hoy; es una afirmación falsa en el lugar donde alguien va a confiar). **DoD:** desviar `RECIBO_DIR`
también cuando `GATE_CI_DIR` está presente — o, más honesto, **corregir el comentario para que atribuya
la defensa a `recibo-cubre.sh`, que es quien la hace**. **Control positivo:** un test que setee
`GATE_CI_DIR` **solo** y afirme dónde cayó el recibo; el canario de arriba sirve tal cual.

## 2 — Qué queda sin medir, dicho explícitamente

- **No corrí `gate.sh` completo** sobre el árbol real: el job `backend` toma el candado del stage en el
  VPS y ese estado compartido no es de esta sesión. Lo que medí del recibo se midió en repo temporal, que
  es el mecanismo que usan los propios tests del repo.
- **El job `backend` end-to-end** (`provision.py` + las dos efímeras + `sync-test-backend.sh`) no se
  puede ejercitar desde la PC por diseño (regla 2). Lo que afirmo de `backend.sh` es sobre **qué colecta
  y qué corre**, medido por grep con control positivo, no sobre su corrida.
- **`tests.yml`** lo leí, no lo toqué: vive en `.github/` y no es de esta sesión.

## 3 — El patrón que cierra el día, y ya va por la quinta aparición

```
SMOKEDENOM · LINTDENOM · CIVERDEDENOM        -> un denominador que no se asere contra un esperado
test-secretos-check.sh (10 casos)            -> todos los ejes variados menos LA FORMA del secreto
los 3 tests de GATE_CI_DIR                   -> las dos variables movidas siempre JUNTAS
```

> **Un instrumento verificado con rigor en N ejes es exactamente donde el eje N+1 se vuelve invisible.**
> El verde de los N acredita al que nadie movió. La pregunta operativa no es «¿tiene control positivo?»
> —estos lo tienen, y bueno— sino **«¿qué variable mantuvieron constante todos los casos que existen?»**

→ `[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]` ·
`[[instrumento-que-no-mira-nunca-falla]]` · `[[el-guard-se-satisface-con-su-propio-comentario]]`

🤖 auditoría · Opus 5 (1M context)
