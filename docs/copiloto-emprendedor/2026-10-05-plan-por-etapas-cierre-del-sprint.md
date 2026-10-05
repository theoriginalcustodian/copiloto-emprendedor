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
| Criterio 3 medido | **web 49 de 54** (90%) · 12 mediciones sin columna `plataforma` | re-medido 05/10, huella `4060ca304ff5` |
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


**Filas abiertas el 05/10, durante el desbloqueo del push** (todas con dueño, ninguna invisible):

| id | qué | dueño |
|---|---|---|
| **`INSTRDISCO`** | **16 instrumentos del gate están VIEJOS en el checkout compartido** (medido por auditoría: 113 examinados, 22 distintos de `main`, 16 son el HEAD de `4a9f4f7c`). Incluye `gate.sh`, `ci/lint.sh`, `.githooks/pre-push`, `secretos-check.sh`, `seed-memory.sh`, `contar-veredictos.py`. **Decisión tomada: el checkout compartido es EDITOR, no EJECUTOR** — un instrumento que vive en un árbol que nadie puede actualizar no es un instrumento, así que el fix no es actualizarlo sino dejar de ejecutarlo. El caso peor es `secretos-check.sh`: sin el discriminante FTL anuncia «encontró posibles secretos» sobre un escaneo que **nunca corrió**, y ese falso rojo ya empujó a una sesión a editar `.gitleaksignore` el 22/09 | planificación (la regla + el guard de árbol divergente) |
| **`GRAFOCONF`** | la config del grafo de ESTE repo vive en el working tree de OTRO (`graphify-graphity-bridge`), sin dueño declarado. Causó el bloqueo total de push de hoy | planificación (dueño) + backend (push) |
| **`BRIDGEPUSH`** | esa config **nunca llegó a `origin/master`** del bridge: 8 commits locales de 2 meses tocando 3 repos. Mientras siga así, cualquier `checkout` ahí repite el bloqueo. **Decidido: se pushean**; el argumento de las rutas absolutas no aplica (`graphity-memory` ya está versionado con `C:/Proyectos/…`) | backend ejecuta |

### E3 · ✅ CERRADO — criterio 3 en **web 50 de 50 alcanzables** (2026-10-05)

| | |
|---|---|
| **Estado** | ✅ **CERRADO el 05/10** |
| **Dueños** | frontend2 (20 celdas), auditoría (11 filas), planificación (el techo y el lector) |
| **Tardó** | ~40 min en paralelo (estimado ~1 h 30) |

⚠️ **Corregido el 05/10 contra el instrumento, no contra la memoria.** Acá decía «53 de 54, falta
`(home)`». Las dos mitades eran falsas, y las refutó frontend2:

- **`(home)` SÍ está medida** — 30/09, veredicto **DESVÍO** («home ≡ tablero»); su `cierre_` ya figura
  en `MEDICIONES_DECLARADAS` de `origin/main:scripts/evidencia/contar-veredictos.py:164`. No fue olvido
  de nadie: el id era **ilegible para el parser**, así que su veredicto quedaba huérfano y «la cifra no
  podía pasar de 53 de 54 por mucho que se midiera». Lo que la destrabó fue el instrumento dejando de
  ser ciego, no trabajo nuevo.
- **La cifra del criterio no es 53/54 ni 54/54: es `web 49 de 54` (90%)** — medido en
  `plan/lector-cuenta-por-plataforma`, huella `4060ca304ff5`. El `54 de 54` que el contador imprime
  abajo es el **agregado en cualquier plataforma**, y el propio script avisa que **no es la cifra del
  criterio**. `mobile 13/54` es del sprint siguiente (device/EAS).

**Lo que falta de verdad son las 12 `indeterminada`** — y no son pantallas sin medir: son mediciones
**sin columna `plataforma`**. El contador dice dónde están y cuántas, y **sólo quien midió sabe en qué
plataforma lo hizo**, así que esto no es trabajo de planificación:

| Dueño | Documento | Filas |
|---|---|---|
| **frontend2** | `2026-09-28_cierre_frontend2-…BL-Q3-v2-lote-B-11-de-11-completo.md` | **16** |
| **auditoría** | `2026-09-30_cierre_…mis-6-mediciones-del-criterio-3-tabla-limpia…md` | **6** |
| **auditoría** | `2026-09-29_cierre_…poblacion-A-medida-y-el-criterio-3-NO-TIENE-referencia…md` | **5** |

35 filas de tabla admiten la columna; otras 21 mediciones viven en heading o bullet y usan el campo
inline `plataforma: <valor>` — mecanismo que **ya existe**: frontend1 lo usó 21 veces en el lote A.

Resto, de planificación: `PLATCONV`, `CRIT2DER`, `CITA751`, `TABLACITA`, `VIGENCIA`, `SUCESION`.
`Q3RECLFE1` **ya estaba cerrado** por frontend1 el 30/09 (su `dato_` del 05/10 lo archivó).

⚠️ **El DoD anterior era INALCANZABLE, y lo descubrí midiendo quiénes faltaban.** Decía «el contador
imprime `web 54 de 54`». Nombré los 5 que faltaban y cuatro **no pueden cerrarse en web**:

| id | por qué no |
|---|---|
| `cobro-voz` · `fact-voz` · `pres-voz` · `vozchat` | medidos **en mobile**. Son capacidades de **dictado**; en `BL-P5` no tienen referencia de prototipo propia (tres con `—`, y `cobro-voz` es `BL-F2`, que «no figura en ningún mapa»). Auditoría ya lo había medido el 29/09: *«el criterio 3 NO TIENE referencia de escritorio»* |
| **`gastos`** | medido pero **sin `plataforma` legible** ← el único accionable; asignado a frontend2 |

⇒ **el techo de web es 50, no 54. Estamos en 49 de 50 alcanzables (98%).**

Y el error que lo escondía: asumí que **cerrar indeterminadas subía la cifra web**. No la sube —
completar la `plataforma` de un id que ya contaba como web no agrega ningún id nuevo. Las 27 filas que
auditoría y frontend2 completaron hoy bajaron `indeterminada` de 12 a 9 y las filas de tabla de 35 a 8,
con la cifra web quieta en 49. Un DoD así deja el sprint abierto para siempre persiguiendo un número
que no existe, y el trabajo real parece no avanzar aunque avance.

**DoD binario corregido — y CUMPLIDO el mismo día:**

```
web  50 de 54   (92%)        <- 50 de 50 ALCANZABLES
mobile  13 de 54              (sprint siguiente, con device/EAS)
indeterminada  4 de 54        (card, card-cobro, card-presu, factura — los 4 YA cubiertos en web)
```
huella del lector `4060ca304ff5` · `rc=0`

Trayectoria medida del frente, sin interpolar: **42 web (30/09) → 49 (05/10 08:25) → 50 (05/10 08:4x)**.
Los 4 de voz quedan **declarados fuera de alcance web**, no pendientes. Las 4 `indeterminada` que
restan son mediciones *redundantes* de ids que ya cuentan en web: no bloquean nada.

Lo cerró frontend2 con `gastos` + sus 3 vecinos del mismo bullet-block (`ingresos`, `presu`, `recibo`),
que tenían el mismo defecto y arregló sin que se lo pidiera — mismo archivo, mismo fix.

⚠️ **Y quedó un defecto de MI lector, que frontend2 cazó refutando mi asignación.** Le atribuí
«3 filas sin `plataforma`» a su doc `C3-2-mediciones-mas-A2b…`; esas 3 filas (líneas 24-26) son una
tabla de **campos DOM** (`presupuesto-item-0-precio`, `gasto-monto`, `ingreso-monto`) con columnas
`value`/`placeholder`/colores RGB: **no son mediciones del criterio 3 y sus ids no están en el padrón.**
El lector las reporta como accionables porque tienen forma de tabla y no declaran la columna — si
alguien «arregla» eso, le agrega una columna `plataforma` a una tabla de colores. Un instrumento que
manda a hacer trabajo inútil infla su propio denominador de lo pendiente. Fila `ACCFALSO`, mía.

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
