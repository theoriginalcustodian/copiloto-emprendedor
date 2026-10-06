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

---

## 4 🔴 `NODRIFTCONJUNTO` — y con esto el patrón deja de ser una fila

Seguí con **`no-drift.sh`**, el 6º job del CI (`drift`) y el guard del ADR-001: *«la definición de la
suite vive en `scripts/ci/`, no en `tests.yml`»*. Es un guard **bien escrito** —trae `--self-test`
horneado, y su comentario nombra el problema mejor que yo: *«Un guard que nunca vio un rojo no está
verificado: su rotura se ve idéntica a su funcionamiento — silencio en ambos casos»*.

**Su regla 1 (`:50-58`) es condicional a que el job exista:**

```bash
for j in "${JOBS[@]}"; do
  if grep -qE "^[[:space:]]+${j}:" "$wf"; then        # <- si el job NO esta declarado...
    if ! grep -qE "bash[[:space:]]+scripts/ci/${j}\.sh" "$wf"; then ... fi
  fi                                                   # <- ...no se exige NADA
done
```

Medido con `WORKFLOW_FILE`, que el propio script parametriza (`:141`) — sin tocar `.github/`:

| fixture | rc | |
|---|---|---|
| `--self-test` (los 4 fixtures del guard) | **0** | ✅ los 4 ok |
| los 5 jobs delegando *(control +)* | **0** | 🟢 correcto |
| `mobile` declarado y **sin** delegar *(control +)* | **1** | 🔴 correcto |
| `npx vitest run` **inline** *(control +)* | **1** | 🔴 correcto |
| `.github/workflows/tests.yml` **real** *(control +)* | **0** | 🟢 correcto |
| **falta el job `mobile` entero** | **0** | 🟢 **VERDE** |
| **sólo 2 de los 5 jobs** | **0** | 🟢 **VERDE** |
| **`jobs:` y nada más** (el caso vacío) | **0** | 🟢 **VERDE** |
| **un yml que no es un workflow en absoluto** | **0** | 🟢 **VERDE** |
| **`lint` renombrado a `checks`** | **0** | 🟢 **VERDE** |

Los cinco controles positivos dan lo esperado, así que las cinco filas de abajo miden el guard y no mi
arnés. **Un archivo ausente sí es rojo** (`:44-47`), así que el fail-closed existe para «no hay archivo»;
lo que no existe es para «el archivo no tiene lo que busco».

> **El guard verifica el CONTENIDO de los jobs declarados y nunca el CONJUNTO de jobs.** Y el caso
> realista no es borrar un job: es **renombrarlo**. `lint` → `checks` y el guard del ADR-001 queda
> **mudo** — justo en el movimiento más común de drift de un workflow.

**Y su `--self-test`, que es su mayor virtud, tiene el mismo punto ciego:** sus 4 fixtures varían **el
contenido de un job declarado** (sano / inline / sin delegar / comentario). **Ninguno varía el conjunto de
jobs.** Tercera aparición del eje no movido, en el guard que más explícitamente se preocupa por estar
verificado.

**Fila `NODRIFTCONJUNTO`** · dueño **planificación** · **severidad media** (alcanzable con un rename
normal, no da síntoma). **DoD:** aserir que los 5 de `JOBS` estén **declarados**, no sólo que deleguen si
están. **Control positivo:** los fixtures (falta uno / sólo 2 / vacío / renombrado) como casos 5-8 del
`--self-test`.

⚠️ **Trampa del fix, y es la razón de nombrarla acá:** el fixture *sano* del `--self-test` declara sólo
`core` y `web`. Aserir el conjunto dentro de `auditar()` **lo pondría rojo** y el guard se auto-rompería —
`[[barrer-llamadores-incluye-los-instrumentos-de-verificacion]]`. La aserción del conjunto va **fuera** de
`auditar()` (sólo contra el workflow real), o el fixture sano se ensancha a los 5. **En el mismo cambio.**

## 5 ⇒ Lo que esto revela, y es más que tres filas

**Tres veces en un día, el mismo patrón estructural:**

| el productor declara protección | quien de verdad protege |
|---|---|
| `gate.sh:40-41`: *«su recibo jamás va a la copia real»* | **`recibo-cubre.sh`**, exigiendo los 5 jobs |
| `no-drift.sh`: el guard contra la divergencia de la suite | **`ci-verde.sh`**, aserendo los 6 jobs **por nombre** |
| `secretos-check.sh:58-59`: *«control positivo con un canario `ghp_`»* | la regla `github-pat` **de gitleaks**, no la config del repo |

> **Las defensas de esta cadena viven del lado del CONSUMIDOR, y los productores declaran garantías que
> no dan.** Hoy el sistema es correcto —el consumidor cubre— pero la consecuencia es concreta y nadie la
> tiene escrita: **`ci-verde.sh` y `recibo-cubre.sh` sostienen defensas que sus productores se atribuyen.**
> Tocar el denominador de `ci-verde.sh` no afloja «un chequeo de jobs»: afloja **el guard anti-drift**, sin
> que nada en `no-drift.sh` lo diga.

**Sugerencia concreta, y es de una línea cada una:** que `no-drift.sh` y `gate.sh` digan en su cabecera
**quién completa su defensa**. Un comentario que atribuye bien es un guard que no se puede desmantelar por
accidente — y es más barato que el guard que falta.
