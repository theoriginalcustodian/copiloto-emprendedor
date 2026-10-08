# §13 punto 2 — el residuo de 4 filas, verificado una por una

**Auditoría · 2026-10-08** · **sujeto declarado:** worktree `/c/gfw-src/wt-aud-p2`, medido sobre
`origin/main` = **`557907ea`** (el inventario se corrió desde `/c/gfw-src/wt-aud-hall` @ `57663e51`,
2 commits antes, ninguno de los cuales toca estos archivos). El veredicto es sobre **ESE** SHA, no
sobre «lo último».

> **Por qué este doc existe y quién lo pidió.** `ALCANCE-CIERRE-BETA.md:140-158` publica que el punto
> 2 de §13 pasó «de inmedible a 4 filas nombradas», y acto seguido pone un 🚨 propio: *«Estas 4 filas
> NO se asignan sin verificarlas una por una»*, con el control obligatorio escrito al lado
> (`git log --oneline -3 origin/main -- <el archivo de la mitad que figura sin diff>`).
> **Planificación nombró el paso y lo dejó pendiente. Esto es ese paso corrido.** No es una
> corrección de su medición: es su continuación.

## 1 · La señal del instrumento, reproducida

`scripts/inventario-ola.sh --ola N`, corrido para las 4 olas desde un worktree propio (el script
resuelve `REPO` por **dónde vive el script**, así que desde el checkout compartido mediría otro árbol
sin que nada falle — `el-instrumento-respondio-sobre-otro-sujeto`). Reproduce exactamente las 4
filas publicadas:

| id | mitad que el instrumento marca sin diff | PR que lo cita | dónde salió |
|---|---|---|---|
| `BL-B3` | BACKEND | #601 | `ola1:431` |
| `BL-B5` | BACKEND | #600 | `ola1:432` |
| `BL-Q1` | FRONTEND-1 | #612 | `ola3:434` |
| `BL-Q3` | BACKEND + FRONTEND-1 + FRONTEND-2 | #692, #623 | `ola4:432` |

El instrumento es reproducible y clasifica bien. Lo que no puede hacer —y su propio autor lo
advierte— es distinguir «falta el trabajo» de «el trabajo está y el PR no lo citó».

## 2 · Las cuatro, verificadas

### `BL-B3` — gitleaks en `pre-push` + `lint.sh` + pasada por la historia → ✅ **HECHO**

Dos evidencias independientes, una de ellas **de runtime**:

- `git log -3 origin/main -- .githooks/pre-push` → el commit más reciente es
  **`245fc3f2 ci(seguridad): gitleaks fijado en pre-push y lint.sh, con control positivo/negativo (BL-B3) (#601)`**.
  El id está citado **y** el archivo tiene el diff: la señal «mitad sin diff» es falsa.
- **Lo vi correr hoy.** El `pre-push` de esta misma sesión (commit `ca531fa2`, 10:38) imprimió
  `[secretos] escaneando ca531fa2… --not --remotes` y `no leaks found`, 1 commit escaneado. Eso es
  el control ejecutándose en producción, no un log leído.

⚠️ **Un vacío propio, declarado:** mi primer grep de `gitleaks` sobre `.githooks/pre-push` y
`scripts/ci/lint.sh` dio **0 hits**, y eso no significaba ausencia. El hook delega en
`.githooks/pre-push:15` → `scripts/secretos-check.sh --refs-stdin`; la palabra vive en el script
delegado. Es `el-nombre-es-una-hipotesis-sobre-el-contenido`: busqué el nombre de la herramienta en
el archivo que la invoca **indirectamente**. Si me quedaba en ese 0, el veredicto se daba vuelta.

### `BL-B5` — «ADR-001 dice una sola cosa» → ✅ **HECHO**

`git log -3 origin/main -- docs/copiloto-emprendedor/adr/2026-08-06_ADR-001_*.md` → el commit más
reciente es **`c15eb0f9 docs(adr): ADR-001 dice una sola cosa — mirror no verificado, gate manual en la beta (BL-B5) (#600)`**.
Id citado, archivo con diff. El plan vigente lo confirma con ancla fina
(`2026-10-06-plan-y-backlog-de-cierre-lo-que-falta.md:350`, fila corregida a «⚠️ scriptado, NUNCA
corrido»).

### `BL-Q1` — control de paridad de `testID` en CI → ✅ **HECHO, y ya estaba escrito**

Las tres piezas existen en `origin/main`: `scripts/ci/testid_paridad.py`,
`scripts/ci/testid-paridad-excepciones.json`, `scripts/tests/test-testid-paridad.sh`. Y el plan
vigente ya tiene el veredicto con el ancla del cableado:

    :395 | BL-Q1 | HECHO | `scripts/ci/lint.sh:20` invoca `scripts/ci/testid_paridad.py --check` · …

Está **cableado a un gate**, que es lo que pedía el DoD («en CI»), no sólo presente.

### `BL-Q3` — barrido de pantallas spec → 🟠 **PARCIAL, y es trabajo de DEVICE**

Es la única que no se cae, y no se cae por una razón que **no es falta de trabajo**:

- El plan la tiene partida en dos filas distintas: `:380` **`BL-Q3` (device)** barrido de las
  pantallas spec sobre el build #2 · `:412` **`BL-Q3` (web)** barrido en el PWA. El instrumento la
  cruza como **un** id ⇒ una de las dos mitades aparece sin diff **por construcción**.
- El plan vigente: `:397 | BL-Q3 | PARCIAL | Reemplazado por v2` → el contrato `BL-Q3-v2` («la
  unidad de medición es id + camino»), cuya corrida son **30 filas `(id, camino)` en device**.
- Y device **está fuera del sprint por orden del operador del 2026-09-22**, que
  `ALCANCE-CIERRE-BETA.md:91` registra textual: *«Toda la tanda de device → diferida al sprint
  siguiente»*.

## 3 · Control de ceguera horneado

Un barrido que da todo verde es indistinguible de uno que no miró
(`instrumento-que-no-mira-nunca-falla`). Los controles corridos:

| control | esperado | resultado |
|---|---|---|
| el grep de veredictos sabe encontrar `FALTA` | ≥1 | **4** (`BL-O1`, `BL-O2`, `BL-O3`, `BL-O4`) |
| el grep de veredictos sabe encontrar `HECHO` | ≥1 | **3 de las 4 filas auditadas** |
| una fila que NO se cae (control negativo) | 1 | **`BL-Q3`** — el barrido es capaz de no absolver |
| el instrumento reproduce las 4 filas publicadas | 4 | **4/4**, con línea de salida por ola |

La cuarta fila importa más que las tres primeras: si las cuatro hubieran dado ✅, este doc sería
indistinguible de uno que no midió.

## 4 · Veredicto binario

> **§13 punto 2: el residuo de 4 filas se resuelve en 3 `HECHO` con evidencia ya en `main` + 1
> `PARCIAL` que es trabajo de device diferido por orden del operador ⇒ 0 filas asignables este
> sprint.**

**Lo que se sigue, para la decisión del operador.** Recomputado punto por punto, lo que le falta a
§13 **no es una línea de código de producto**:

| punto | estado medido | de quién depende |
|---|---|---|
| 1 · `DEC-*` con acta | ✅ | — |
| 2 · familias `BL-*` cerradas con su DoD | ✅ **en sustancia** — 0 filas asignables (este doc) | — |
| 3 · matriz ✅ en web **y mobile** | 🔴 **inalcanzable este sprint**: web 54/54, mobile 13/54 | device (diferido 22/09) |
| 4 · smoke en verde contra prod | 🔴 `smoke_beta_e2e.py:19` no resuelve el import por el camino de prod | **backend** |
| 5 · tester externo con video | 🔴 | **operador** |

⇒ **§13 es inalcanzable este sprint por construcción**, y la decisión que queda es MAYOR y binaria:
*(a)* redefinir §13 para este cierre sin la mitad device, o *(b)* cerrar contra otro criterio y dejar
§13 para el sprint siguiente. **Ninguna sesión puede tomarla.**

## 5 · El hallazgo transversal: hoy pasó tres veces lo mismo

Las tres veces, **el artefacto más preciso no fue el que circuló**
(`de-dos-artefactos-con-distinta-precision-gana-el-que-circula`):

1. **9 de 12 hallazgos** entregados hoy no estaban en ningún archivo de `origin/main` — vivían sólo
   en `coordinacion/`, que está gitignored. Bajados en #936.
2. **La conclusión «el punto 3 no se puede cerrar este sprint»** la escribió planificación **57
   segundos después** de mergear el doc de cierre (doc `0b641b2d` 10:30:19 · ENMENDADO del contrato
   `BL-Q5` 10:31:16), y quedó en el buzón. El doc que lee el operador no la tiene.
3. **Los veredictos de estas 4 filas** ya estaban en el plan vigente (`:348`, `:350`, `:395`, `:397`)
   desde el 06/10, con `path:línea`. El doc de cierre publicó en su lugar la señal cruda del
   instrumento.

El patrón no es descuido: en los tres casos el artefacto preciso **existía y era más nuevo**. Lo que
falla es la propagación, y la pregunta que lo caza es **¿este número lo produjo este instrumento, o
hay un artefacto más fino que ya lo respondió?**

— AUDITORÍA (Opus 5, 1M)
