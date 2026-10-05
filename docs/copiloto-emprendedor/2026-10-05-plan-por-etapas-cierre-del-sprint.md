# Plan por etapas — cierre del sprint

**Creado:** 2026-10-05 · **Dueño:** sesión PLANIFICACIÓN · **Pedido por el operador:**
*«separá el trabajo que nos queda en etapas… dejá esas etapas asentadas en un plan aparte del que ya
tenemos… quiero saber con certeza qué fue lo que se terminó, cuánto tardamos y qué nos queda»*.

> **Qué es este documento y qué NO es.** Es el **tablero de control del operador**: etapas con DoD
> binario, duración **medida** y estado verificable. **No reemplaza `coordinacion/PLAN.md`**, que
> sigue siendo la cola de trabajo con sus 20 filas y sus disparadores — ahí se ejecuta, acá se
> controla. Una fila de `PLAN.md` pertenece a exactamente una etapa de acá.
>
> **Toda cifra de este documento está medida, con el comando al lado.** Las estimaciones van
> marcadas como tales y en **horas**, nunca en días.

---

## 1. Qué se terminó — con evidencia, no con autoevaluación

| Hito | Evidencia verificable | Cuándo |
|---|---|---|
| 12 commits integrados a `main` | `git log origin/main` → de `4f5692ef` a `148f9639` | **30/09, 08:28 → 17:08** |
| Criterio 3 medido | 53 de 54 pantallas | al 30/09 |
| Grafo destrabado (1406 zombies) | marcador `c1e91870a003` → `148f9639c414`, `motivo=ok`, dry-run `ZOMBIES 0 · FALTANTES 0` | 30/09 20:00 |
| Parada segura de 4 sesiones | 4 `cierre_` en el buzón, 0 merges, 0 deploys | 30/09 20:29-20:37 |
| **`SABOTEXIT` pagada** | `test-sabotaje-exit-cobertura.sh` **4/4**, commit `a8d73c51` pusheado | **05/10** |
| 8 PR abiertos con trabajo completo | `gh pr list` → **+4.924 / −116** líneas, todos del 30/09 | 30/09 |

### Cuánto tardamos — el dato que importa

- **Jornada productiva del 30/09: ~8 h 40 min** para 12 merges (08:28 → 17:08). Ése es el ritmo real
  de la flota de 4-5 sesiones en paralelo, y es la base de las estimaciones de abajo.
- **Parada: 4 días 18 h con CERO avance** (30/09 17:08 → 05/10 ~11:00). `origin/main` no se movió un
  solo commit. **La causa no fue técnica**: el trabajo estaba hecho y pusheado. La parada se ejecutó
  por orden del operador y **nadie la revirtió** — planificación cerró su turno pidiendo permiso para
  reanudar en vez de tratar la pregunta del operador como el disparador.
- **Corolario que este plan incorpora como regla:** toda parada nace con su **condición de salida
  escrita**. Un estado que sólo puede terminar porque alguien se acuerde, no termina.

---

## 2. Las etapas

Orden por dependencia real, no por preferencia. Las estimaciones asumen **waves en paralelo** con las
4 sesiones vivas; el equivalente serial va al lado porque es lo que se paga si la flota queda en una.

### E0 · Desbloquear el merge — **BLOQUEADA, y el bloqueo es del operador**

| | |
|---|---|
| **Estado** | 🔴 bloqueada |
| **Dueño del disparador** | **el operador** |
| **Duración** | minutos, una vez desbloqueada |

`gh pr merge 770` fue **denegado por el clasificador de permisos** (`Merge Without Review`) con el CI
medido en **6/6 y control de jobs presentes**. No se persigue por otra vía, ni se le pide a otra
sesión: un peer ejecutando lo que esta sesión tiene denegado saltea una decisión del operador.

**DoD binario:** existe una regla `Bash(gh pr merge:*)` en los settings, o el operador mergea él.
**Hasta que esto no pase, E1 no puede correr y las ~6 h restantes no bajan.**

### E1 · Integrar los 8 PR abiertos

| | |
|---|---|
| **Estado** | ⏸️ lista, esperando E0 |
| **Dueño** | planificación (cada sesión sólo sus propios PR) |
| **Estimación** | **~1 h** en paralelo · ~1 h 30 serial |

Orden medido: **#770 → #771** (el árbol del par da `rc=0`, hunks disjuntos). **No son 8 PR limpios** —
mapa medido del rollup, no del badge (auditoría, 05/10 ~11:00):

| PR | mergeable | CI | qué necesita antes del merge |
|---|---|---|---|
| #770 | MERGEABLE | ⚠️ **recibo INVALIDADO** | **re-medir sobre `a8d73c51`**: el 6/6 que cité era de `5344b393`, y mi propio push posterior cambió el SHA |
| #771 | MERGEABLE | ✅ verde sobre `ce8e0c55` | nada |
| #772 | MERGEABLE | ❌ fail:1 | **arreglar el STUB del test**, no el script (ver E2 · `STUBGH`) |
| #773 #774 #775 #777 | MERGEABLE | ✅ 6/6 | nada |
| **#776** | 🔴 **CONFLICTING** | ✅ 6/6 | **resolver 5 conflictos**, incl. `memoria/MEMORY.md`, `HISTORIA.md` y un **add/add** |

**Dos cosas que este mapa deja claras:**
- **El badge verde no dice mergeable.** #776 pasa 6/6 **y está CONFLICTING**: el CI mide el commit, no
  la integración. Son dos preguntas distintas y sólo una la contesta el badge.
- **Un recibo pertenece a un SHA, y el que lo invalidó fui yo.** Medí #770 en 6/6, después pusheé el
  test de `SABOTEXIT` al mismo PR, y con eso el recibo quedó viejo: `push-es-el-ultimo-paso-no-el-primero`
  aplicado a mí mismo, el mismo día que se lo advertí a las otras sesiones.

**Precondiciones que NO se saltean:**
1. **Re-medir el CI de cada PR sobre su HEAD ACTUAL**, no sobre el SHA que tenía cuando se midió.
   Vale para #770 (`a8d73c51`) y para #771 (`ce8e0c55`): «sólo agrega markdown» no es una medición.
2. **#776 se resuelve por su dueño antes de entrar**, y sus conflictos tocan el índice de memoria ⇒
   se coordina con `MEMDRIFT` e `IDXMERGE` de E2, o se pisa lo que la otra etapa acaba de arreglar.
3. **Pushear/mergear de a uno**, verificando la **bitácora** del grafo y no el exit code:
   `motivo=contencion-otro-sync` es `--no-verify` obtenido por carrera.

**DoD binario:** `origin/main` contiene los 8, y cada merge cita el recibo **del SHA que mergeó**.

### E2 · Los instrumentos que mienten

| | |
|---|---|
| **Estado** | 🟡 en curso (1 de 8 cerrada) |
| **Dueño** | planificación |
| **Estimación** | **~2 h** en paralelo · ~3 h serial |

Es la etapa que más rinde, porque un instrumento que miente **desactiva trabajo sin dejar rastro**.

| fila | qué está mal | prioridad |
|---|---|---|
| `SABOTEXIT` | ✅ **CERRADA 05/10** — 4/4, `a8d73c51` | — |
| **`MEMDRIFT`** | 🔴 **el índice que las sesiones CARGAN está truncado**: el slug pesa **25.210 B** contra un techo de 24.000 ⇒ **12 líneas finales no existen** para ninguna sesión (se pierden `(home)`-adyacentes, las 4 de «Frontend móvil» y el puntero a `HISTORIA.md`). Además 2 entradas divergen: `una-orden-de-parada…` sólo en el repo, `telegram-composio-canal-operador` sólo en el slug | **la más alta** |
| `IDXMERGE` | el techo del índice no lo ve ningún gate cuando el índice se arma en un **merge**: `merge-tree` da `rc=0` igual | alta |
| `OCIOPARADA` | el gate anti-ocio no conoce el estado «parada vigente» y grita en su caso normal, 2 crones × 3 min | media |
| `DEUDAEXIT` | `ci-verde.sh:69-73` + barrido de llamadores | media |
| `CIVERDE4` | el propio test cazó la primera versión del fix | media |
| `LINTALCANCE` | `lint.sh` mide al **equipo**, no al commit (corpus vivo por ruta absoluta); y es una **cadena**, no una suite: 3 corridas ejecutaron 47, 8 y 33. Requiere **decisión A/B** | media |
| **`STUBGH`** | 🔴 **el stub de `gh` responde el MISMO array de 6 jobs a cualquier subcomando**, así que `pr view --json mergeable` recibe el rollup, el script no puede leer `mergeable` y sale `exit 2` fail-closed — **correcto el script, viejo el fixture**. Es el rojo de #772. Fix: despachar por subcomando (`pr view` → `MERGEABLE/CLEAN`, rollup → el array) **más un caso `CONFLICTING/DIRTY` que espere exit 4**, que el stub hoy no puede fabricar y sólo se ejercita contra un PR real | **alta: bloquea #772** |
| `IDXRAMA` | las 12 de #731 | baja |

> **Lo que `STUBGH` enseña, y por eso está acá y no en E1:** un fixture que no acompaña al script
> **acusa al código correcto**. El rojo de #772 señalaba al script y el defecto estaba en el doble que
> lo mide — y un rojo falso enseña a saltear el gate igual que un verde falso enseña a confiar. El
> caso 4 además sólo existe contra un PR real: **hoy #776 es ese PR**, y cuando se resuelva su
> conflicto desaparece el único `CONFLICTING` disponible para probarlo.

**DoD binario por fila:** el gate **dispara** sobre un sabotaje deliberado y **no** dispara en el caso
normal. Sin las dos direcciones medidas, la fila no cierra.

### E3 · Cerrar el criterio 3 — de 53/54 a 54/54

| | |
|---|---|
| **Estado** | 🟢 arrancada |
| **Dueños** | frontend2 (`(home)`), frontend1 (`Q3RECLFE1`), planificación (el resto) |
| **Estimación** | **~1 h 30** en paralelo · ~3 h serial |

`(home)` **asignada a frontend2 el 05/10** — es la única nunca medida, y se escapa de los barridos
porque no tiene `?ver=` como las otras 53. Además: `PLATCONV`, `Q3RECLFE1`, `CRIT2DER`, `CITA751`,
`TABLACITA`, `VIGENCIA`, `SUCESION`.

**DoD binario:** el contador imprime **54/54** con su huella al lado, y cada fila declara su
`plataforma`.

### E4 · Deuda de producto y reconciliación

| | |
|---|---|
| **Estado** | ⏸️ lista |
| **Dueños** | planificación (`WIPCOMPART`), backend (`BLO4OUT`, bridge) |
| **Estimación** | **~1 h 30** en paralelo · ~2 h 30 serial |

- **`WIPCOMPART`** — 22 archivos del checkout compartido, **+1.058/−191**, que no llegan a ninguna
  rama. No se pierden solos (están en disco, no en un `stash`); el riesgo real es un `clean`/`checkout`
  ahí, prohibido por CANON 9. Se reconcilia **archivo por archivo**, no por contador de commits.
- `FACTNOMED` · `BLO4OUT` (PR ya abierto en `fleet-platform`) · `CIERREB`.
- **`COCHANGE`** queda **deliberadamente intacta**: deuda declarada y visible, que es la única clase
  permitida.

**DoD binario:** cada uno de los 22 archivos termina **mergeado o descartado con motivo escrito**.
Cero archivos sin veredicto.

### E5 · Device / móvil — **FUERA de este cierre, por tu orden**

Diferida al **sprint siguiente** por orden del operador del 22/09 («el sprint cierra sin device»).
No cuenta en el tiempo restante. Cuando entre, «terminado» exige evidencia **en device**, no en CI.

---

## 3. Lo que queda, en una línea

| etapa | estado | paralelo | serial |
|---|---|---|---|
| E0 desbloquear merge | 🔴 **bloqueada (operador)** | minutos | minutos |
| E1 integrar 8 PR | ⏸️ espera E0 | ~1 h | ~1 h 30 |
| E2 instrumentos | 🟡 1/9 (entró `STUBGH`) | ~2 h | ~3 h |
| E3 criterio 3 | 🟢 arrancada | ~1 h 30 | ~3 h |
| E4 deuda y WIP | ⏸️ | ~1 h 30 | ~2 h 30 |
| **TOTAL** | | **~6 h** | **~10 h** |

**El número no bajó entre el 30/09 y el 05/10 porque no corrió trabajo, no porque el trabajo creciera.**
Las ~6 h son horas-de-flota, no de calendario: con las 4 sesiones vivas y E0 desbloqueada, entran en
una jornada.

---

## 4. Cómo se actualiza este documento

1. **Una etapa cambia de estado sólo con evidencia citada** — SHA, recibo, salida del instrumento.
   El estado va en la tabla de §3, que es el único lugar donde se lee el avance.
2. **Cada cierre de etapa anota su duración REAL** al lado de la estimación. Es lo que calibra la
   próxima: hoy la referencia es «12 merges en 8 h 40 con 5 sesiones».
3. **Si una etapa se bloquea, se escribe el disparador y su DUEÑO.** Una espera sin disparador
   nombrable es parálisis, no espera.
4. Este archivo es **versionado** a propósito: `coordinacion/` está gitignoreada y no sobrevive a un
   clon. El puntero vive en `coordinacion/PLAN.md`.
