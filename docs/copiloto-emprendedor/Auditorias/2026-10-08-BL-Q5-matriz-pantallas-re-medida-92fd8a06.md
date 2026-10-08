# BL-Q5 · Matriz de pantallas re-medida — `origin/main` @ `92fd8a06`

**Fecha:** 2026-10-08 · **Dueña:** FRONTEND2 · **Cierra:** `BL-Q5` (criterio §13 punto 3 del backlog
`2026-09-21-backlog-beta-odobi-con-dod.md:1051-1058`) · **Padrón:** `2026-09-22-BL-P5-...md §2` (54
ids `spec`).

> **Corrección recibida antes de escribir esto (planificación, 2026-10-08):** la primera versión de
> esta tarea iba a re-medir las 54 ids por sub-agentes leyendo código fresco. Eso mide una cosa
> DISTINTA de lo que el criterio pide para mobile — wiring de código, no comportamiento verificado en
> **device**. Por eso el número que se cita acá para mobile es el del instrumento del propio repo
> (`scripts/evidencia/contar-veredictos.py`), no una re-derivación mía. Ver §0.

> **No es la primera republicación.** `2026-09-30-criterio3-los-54-republicados-sobre-el-sha-medido.md`
> (auditoría) ya hizo esto una vez, sobre `d131b3d2`/PR #742, y cerró dejando **explícitamente
> pendiente** una pregunta de juicio, no de dato: *«13 ids tienen veredictos incompatibles entre
> documentos (`bi`, `card`, `card-cliente`, `card-cobro`, `card-presu`, `comousar`, `cuenta`, `detalle`,
> `esc`, `factura`, `ingresar`, `preg`, `soporte`) ... se resuelve triando cuál medición es vigente»* —
> y dijo textualmente que esa triage **«es otra fila y otro dueño»**. Eso es lo que §2 hace para web:
> de esos 13, **12 re-medidos hoy contra código real salen ✅** (la disputa venía de un bug de código ya
> corregido entre el 28/09 y hoy) y **1 (`cuenta`) sigue siendo `DESVÍO` real** — confirmado, no
> heredado. Esta sección reemplaza al §4 de ese documento para esos 13 ids; no lo contradice, lo cierra.

## 0. Qué mide esto y qué NO mide (leer antes de citar un número)

Instrumento: `scripts/evidencia/contar-veredictos.py` (hash del script:
`6d4437b80bf4`, su propio `git hash-object`). Escanea el **corpus de documentos ya cerrados del
buzón** (`coordinacion/cerrado/`, `abierto/`) buscando veredictos del vocabulario cerrado
(`COHERENTE`, `DESVÍO`, y los de no-comparación `NO_MEDIBLE`/`FUERA-DE-REFERENCIA`/
`NO_REPRODUCIBLE_SIN_EFECTO`/`PENDIENTE_DEVICE`) declarados por id+plataforma. **No lee código y no
corre nada en device**: cuenta qué ya quedó MEDIDO y escrito por alguien, no si ese algo pasa.

Tres unidades, nunca intercambiables (la trampa que el propio instrumento marca como `CIFRASINUNIDAD`):

| Unidad | Qué responde | Cifra hoy |
|---|---|---|
| **Cobertura del criterio** — ids únicos de los 54 con **algún** veredicto del vocabulario cerrado, por plataforma | ¿Se las midió, aunque sea para decir "no pasa"? | **web 54/54 (100%)** · **mobile 13/54** |
| **Sin comparación** (subconjunto de arriba) | De las medidas, ¿cuántas en realidad no tuvieron contra qué comparar? | web 9/54 · mobile 5/54 |
| **Indeterminada** | NO es plataforma: filas que el lector no pudo leer (falta la columna) | 4/54 |

**web 54/54 NO significa "54 pantallas pasan".** Significa que las 54 tienen un veredicto legible —
puede ser `COHERENTE` (pasa) o `DESVÍO` (no pasa) o uno de no-comparación. El desglose real pasa/no
pasa está en §2.

**mobile 13/54 es la cifra que cita el criterio.** Cerrar las 41 que faltan requiere **device/EAS**,
que el operador diferió al sprint siguiente el 2026-09-22 (`device-tests-al-final...md`). No lo
recorrí con sub-agentes para "completarlo": sería medir wiring de código y publicarlo bajo el mismo
número que pide comportamiento verificado en teléfono — exactamente el error que se evitó acá.

## 1. Control de ceguera (horneado, no exento)

- **✅ conocido:** `splash` — `COHERENTE` sin disputa en ningún documento del corpus, confirmado hoy
  por lectura directa de `apps/copiloto-web/src/modules/onboarding/Onboarding.tsx` (BL-X10).
- **🔴 conocido:** `cuenta` (BL-J11) — "Cambiar el mail" sigue sin SMTP/Caddy; `DESVÍO` en el corpus
  (`2026-09-28_cierre_frontend1-...lote-A...md`, `2026-09-30_cierre_auditoria-...md`) y confirmado hoy
  de nuevo por lectura directa de código: el flujo de cambio de mail no está, el de contraseña sí.
  Grep del instrumento discrimina — si esto saliera ✅ a secas, el control fallaría.

## 2. Matriz completa — 54 ids spec, web

Columna **web**: verdicto re-medido HOY contra `origin/main @ 92fd8a06` (lectura de código +
evidencia `path:línea`/commit; es legítimo para web porque web no depende de device). Donde el
corpus tenía un `DESVÍO` histórico (09-28/09-29/09-30) que hoy sale distinto, se anota —no se oculta.

Columna **mobile**: **sólo** los 13 ids que el instrumento ya cuenta como cubiertos en el corpus
(ninguno agregado por mí). El resto queda `— (pendiente device/EAS, sprint siguiente)`, sin excepción.

| id | web (hoy, `92fd8a06`) | mobile (instrumento) | nota |
|---|---|---|---|
| *(vacío)* Mi día | ✅ | — pendiente device | |
| `esc` | ✅ | — pendiente device | corpus tenía `DESVÍO` 29-30/09 (app@390 vs proto@390); re-medido hoy ✅ |
| `chat` | ✅ | — pendiente device | |
| `splash` | ✅ | — pendiente device | control de ceguera (✅), ver §1 |
| `entrada` | ✅ | — pendiente device | |
| `reveal` | ✅ | — pendiente device | |
| `volver` | ✅ | — pendiente device | BL-X10 web |
| `ingresar` | ✅ | — pendiente device | uno de los 13 ids con veredictos incompatibles sin triar del 30/09 (`COHERENTE`·`DESVÍO`); re-medido hoy ✅ |
| `ingresar-error` | ✅ | — pendiente device | |
| `tablero` | ✅ | ✅ cubierto | corpus tenía `DESVÍO` 28/09, **conflicto NO declarado en `CONFLICTOS_CONOCIDOS`** (hallazgo de hoy, ver §4.bis); re-medido hoy ✅ |
| `agenda` | ✅ | — pendiente device | BL-J13 |
| `detalle` | ✅ | — pendiente device | corpus tenía `DESVÍO` 28/09; re-medido hoy ✅ |
| `grabando` | ✅ | — pendiente device | sin comparación en el corpus (no bloquea: hay referencia de escritorio, re-medida hoy) |
| `bloqueado` | ✅ | — pendiente device | corpus tenía `DESVÍO` 28/09; re-medido hoy ✅ |
| `card` | ✅ | ✅ cubierto | corpus: conflicto `card` DIRIMIDO 30/09 a `DESVÍO`; re-medido hoy ✅ (BL-J7) |
| `card-cobro` | ✅ | ✅ cubierto | mismo dirimido que `card`; re-medido hoy ✅ |
| `card-factura` | 🔴 | — pendiente device | **sin mic en Facturación en NINGUNA plataforma** — fuera del DoD declarado de BL-J7, no es regresión; coincide con "sin comparación" del corpus |
| `card-presu` | ✅ | ✅ cubierto | mismo dirimido que `card`; re-medido hoy ✅ |
| `card-cliente` | ✅ | ✅ cubierto | corpus: `DESVÍO` 29/09; re-medido hoy ✅ |
| `vozchat` | ✅ | ✅ cubierto | sin comparación en el corpus (no mide contra escritorio); re-medido hoy ✅ |
| `bi-vacio` | ✅ | — pendiente device | sin comparación en el corpus; re-medido hoy ✅ |
| `bi-refresh` | ✅ | — pendiente device | BL-W6 |
| `onb-promesa` | ✅ | ✅ cubierto | BL-X8/DEC-7 — `Onboarding.tsx:106` + `PantallaOnboarding.tsx:121`, commits `f46ba0ae`/`2bebe393` |
| `onb-cumplida` | ✅ | ✅ cubierto | BL-X8/DEC-7 — `Onboarding.tsx:190` + `PantallaOnboarding.tsx:197`, mismos commits; sin comparación de escritorio en el corpus |
| `consent` | ✅ | — pendiente device | BL-J8 |
| `caida` | ✅ | — pendiente device | BL-J4; corpus tenía `DESVÍO`/`NO_MEDIBLE` 29/09, **conflicto NO declarado en `CONFLICTOS_CONOCIDOS`** (hallazgo de hoy, ver §4.bis); re-medido hoy ✅ |
| `preg` | ✅ | — pendiente device | BL-X3; uno de los 13 ids con veredictos incompatibles sin triar del 30/09 (`COHERENTE`·`DESVÍO`·`INCOMPLETO`); re-medido hoy ✅ |
| `fact-cae` | ✅ | — pendiente device | BL-C2; gap mobile cerrado por commit `c5cad182`, re-medido hoy ✅ |
| `pres-voz` | ✅ | ✅ cubierto | sin comparación en ninguna de las dos plataformas (dictado dentro de un flujo, no pantalla de escritorio) |
| `pres-hitl` | ✅ | — pendiente device | BL-D1/BL-J1 |
| `pres-ciclo` | ✅ | — pendiente device | BL-J9 |
| `vacio-visto` | ✅ | — pendiente device | BL-W5; corpus tenía `DESVÍO` 28/09; re-medido hoy ✅ |
| `vacio` | ✅ | — pendiente device | BL-W5; sin comparación en el corpus |
| `comousar` | ✅ | — pendiente device | BL-W9; corpus: conflicto dirimido a `DESVÍO` 30/09; re-medido hoy ✅ |
| `soporte` | ✅ | — pendiente device | BL-W10; corpus marca este id **`[POR VERIFICAR]`, sin dirimir** (ambigüedad de qué se pregunta, no de dato) — re-medición directa hoy lo resuelve a ✅ |
| `feedback` | ✅ | — pendiente device | BL-W3/BL-J12 |
| `hitl` | ✅ | — pendiente device | BL-D3 |
| `gastos` | ✅ | — pendiente device | BL-J7; corpus tenía `DESVÍO` 28/09; re-medido hoy ✅ |
| `ingresos` | ✅ | — pendiente device | BL-J7 |
| `factura` | ✅ | — pendiente device | BL-C2; corpus: conflicto dirimido a `DESVÍO` 30/09; re-medido hoy ✅ |
| `presu` | ✅ | — pendiente device | BL-J7 |
| `bi` | ✅ | — pendiente device | BL-X2; corpus tenía `DESVÍO` 29/09; re-medido hoy ✅ |
| `clientes` | ✅ | — pendiente device | BL-J6/BL-J7 |
| `ajustes` | ✅ | — pendiente device | BL-X1; corpus tenía `DESVÍO` 28/09; re-medido hoy ✅ |
| `negocio` | ✅ | ✅ cubierto | BL-J10/BL-X7 |
| `afip` | ✅ | — pendiente device | BL-C6 |
| `apps` | ✅ | — pendiente device | BL-C1/BL-W2/BL-C5; corpus tenía `DESVÍO`+`FUERA-DE-REFERENCIA` 28/09; re-medido hoy ✅ |
| `cuenta` | 🔴 | — pendiente device | BL-J11 — **"Cambiar el mail" sigue sin SMTP/Caddy, diferido**; control de ceguera (🔴), ver §1 |
| `apar` | ✅ | — pendiente device | BL-X4 |
| `hablar` | ✅ | — pendiente device | BL-X7 |
| `cobro-voz` | ✅ | ✅ cubierto | BL-F2; sin comparación en ninguna de las dos plataformas |
| `recibo` | ✅ | — pendiente device | BL-F1; sin comparación en el corpus (re-medido hoy, referencia sí existe) |
| `fact-voz` | ✅ | ✅ cubierto | sin comparación en ninguna de las dos plataformas |
| `fact-hitl` | ✅ | — pendiente device | BL-D3; corpus tenía `NO_REPRODUCIBLE_SIN_EFECTO`; re-medido hoy ✅ |

**Total web: 52 ✅ · 2 🔴 (`card-factura`, `cuenta`) · 54/54 medidas.**
**Total mobile cubierto por el corpus: 13/54** (lista exacta: `caida, card, card-cliente, card-cobro,
card-presu, cobro-voz, fact-voz, negocio, onb-cumplida, onb-promesa, pres-voz, tablero, vozchat`) —
**41/54 sin ninguna medición mobile todavía**, pendientes de device/EAS el sprint siguiente.

## 3. Los 2 🔴 de web, en detalle

- **`card-factura` (BL-J7):** no existe entrada de micrófono en la tarjeta de Facturación propuesta,
  en ninguna plataforma. El DoD de BL-J7 nombra 4 cards con mic (`gasto`, `cobro`, `presupuesto`,
  `cliente`); `factura` no es una de ellas — no es una regresión, es una pantalla fuera del alcance
  declarado de ese ítem. No se toca código para "subir" esta fila: el contrato de `BL-Q5` prohíbe
  expresamente ampliar el backlog cerrado desde esta medición.
- **`cuenta` (BL-J11):** "Cambiar contraseña" funciona; "Cambiar el mail" no, porque depende de
  SMTP/Caddy que todavía no está desplegado. Mismo gap que el corpus viene registrando desde
  28-30/09; sigue abierto hoy, sin dueño asignado a la fecha.

## 4. Fix aplicado — columna `plataforma` faltante (lo accionable sin device)

El instrumento señaló, antes de este fix:

```
indeterminada 4 de 54
 └─ ACCIONABLE (agregar la columna): 4 fila(s) de tabla
 └─ ACCIONABLE con el campo inline: 18 medición(es) en heading o bullet sin columna posible
 └─ NO accionable: 4 (sujeto fuera del padrón: card-ingreso, gasto-monto, ingreso-monto, presupuesto-item-0-precio)
 └─ donde agregar la columna primero: 2026-10-05_cierre_frontend1-...-SIN-REFERENCIA-DE-ESCRITORIO-...md (4)
```

**Hecho:** agregué la columna `plataforma: web` a la tabla sin columna de ese documento
(`coordinacion/cerrado/2026-10-05/...SIN-REFERENCIA-DE-ESCRITORIO-confirmado-empirico.md`, tabla
"## Resumen"). Re-corrido el instrumento después del cambio:

```
└─ ACCIONABLE (agregar la columna): 0 fila(s) de tabla   ← era 4
```

Verificado por re-medición, no por inspección visual del diff (CANON 1).

**También hecho** (delegado a un sub-agente de sólo lectura+edición de metadata en `coordinacion/`,
nunca en código): las 18 mediciones en heading/bullet sin columna posible, en 7 documentos del
corpus de 09-22 a 10-05 (`card`, `card-cobro`, `card-presu`, `card-cliente`, `chat`, `feedback`,
`hablar`, `factura`, `vozchat`, `cobro-voz`). Las 18 eran `plataforma: web` (medición contra el
prototipo/escritorio, nunca mobile — inferido del contexto de cada bloque, nunca inventado). Re-medido
tras el cambio: **0** quedan sin columna. Ninguno cambia un número de este cierre (esos ids ya
tenían veredicto legible vía otro documento), pero destraba que el instrumento corra de punta a
punta sobre el corpus sin huecos con nombre.

## 4.bis · Hallazgo nuevo (no mío de resolver): `caida`/`tablero` sin triar en `CONFLICTOS_CONOCIDOS`

Al correr el instrumento completo tras el fix de §4, salió `CONTRASTE: CONFLICTO NUEVO — ['caida',
'tablero']`: estos 2 ids tienen veredictos `DESVÍO` (28-29/09) y `COHERENTE` (hoy, en esta misma
medición) sin que ningún documento declare cuál es el vigente — el mismo patrón que el documento del
30/09 ya había resuelto para otros 13 ids, pero `caida`/`tablero` no estaban en esa lista y quedaron
sin triar. **No lo dirimo yo:** es una decisión de contenido entre mediciones de distintas sesiones,
y el propio `2026-09-30-criterio3-...md §4` dice que triar cuál medición es vigente "es otra fila y
otro dueño". Lo que sí puedo afirmar con evidencia propia: re-medí ambos hoy contra `92fd8a06` y
los dos dan `COHERENTE` (✅, tabla de §2) — así que la fila de esta matriz no depende de cómo se
resuelva ese triage, pero `CONFLICTOS_CONOCIDOS` sigue sin la entrada. Dueña: planificación.

Hallazgo aparte, de la misma corrida: la rama de trabajo donde se detectó esto
(`fe2/bl-o6-legal-parte-a-y-parte-b-web`, checkout compartido) tiene
`scripts/evidencia/criterio3-matriz.mjs` desactualizado respecto a `origin/main` (ya no define
`PROTO_VISTA`/`MEDIBILIDAD`). No lo toqué — es de quien sea dueño de esa rama.

## 5. Cierre — §13 punto 3

**NO CUMPLE** el punto 3 del criterio §13 tal como está escrito (requiere web Y mobile a la vez sobre
un mismo SHA). Medido sobre `origin/main @ 92fd8a06`, unidad «ids con veredicto del vocabulario
cerrado, por plataforma»:

> **§13 punto 3: NO CUMPLE — web 54/54 (52 ✅ + 2 🔴 reales: `card-factura`, `cuenta`), mobile 13/54,
> diferido al sprint siguiente por orden del operador del 2026-09-22.**

Web está completo (medido, no "todo pasa": 2 de 54 no pasan, y están identificados arriba, no
escondidos). Mobile no puede completarse este sprint porque las 41 filas que faltan necesitan
device/EAS, que es exactamente lo que el operador diferió. Esto no es una falla de ejecución: es la
misma conclusión a la que llegó el `urgente_` de auditoría de hoy sobre los 5 puntos de §13 — la
decisión de redefinir el criterio o cerrar contra otro es del operador, no de esta sesión.

— FRONTEND2
