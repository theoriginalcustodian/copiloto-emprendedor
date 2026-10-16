# Sprint MOBILE — registro de estado vigente

> **Qué es esto.** El estado de cierre del **sprint mobile**, con cada cifra pegada a la pregunta que
> contesta, al instrumento que la mide y al SHA sobre el que se midió. Es el hermano de
> [`2026-09-22-registro-A4-estado-vigente.md`](2026-09-22-registro-A4-estado-vigente.md), que es el
> registro de la **beta Odobi** — otro sprint y otra pregunta.
>
> **Por qué existe.** El 2026-10-15, al ir a «propagar el cierre a los docs maestros», el maestro que
> el `README` manda a leer —el de A4— tenía **0 menciones** del mapeo y de la cifra `/54`: escribir el
> estado del sprint mobile ahí habría puesto una cifra en el doc de otra pregunta, que es el defecto
> con nombre propio de este repo (*una cifra sin unidad se deja citar para cualquier pregunta*). El
> `README` además lo presenta como «el sprint en curso», y el sprint en curso es **mobile** desde el
> 2026-10-08. El registro del sprint mobile no existía: las cifras vivían en el veredicto de **un**
> brazo (`2026-10-13-veredicto-bloque-chat-backend.md`) y en `coordinacion/`, que **no se versiona y
> se archiva por TTL**. Es la misma enfermedad que hizo nacer el registro de A4.

**Medido el 2026-10-15 sobre `origin/main @ 410250ec`** (más el fix del contraste que entra con este
mismo PR, declarado abajo). Las cifras son idénticas a las de `71b9b668`, donde se midieron primero.

---

## 1. DOS medidores, DOS preguntas, los MISMOS 54 ids

Citar una por la otra es el error más repetido del sprint. Ninguna de las dos es «la cifra del sprint».

| | **Criterio 3** | **Mapeo prototipo → nativo** |
|---|---|---|
| **Pregunta** | ¿cada una de las 54 pantallas `spec` tiene un **veredicto medido** (COHERENTE / DESVÍO / NO_MEDIBLE…)? | ¿cada fila del mapeo **cumple su DoD**, el que su propio contrato le escribió? |
| **Instrumento** | `scripts/evidencia/contar-veredictos.py` | `scripts/evidencia/medir-mapeo-implementacion.py` |
| **Corpus** | `coordinacion/` (el buzón) | `docs/copiloto-emprendedor/` |
| **Cifra vigente** | **web 54/54 (100%)** · **mobile 53/54** | **54/54 (100%)** cumplen su DoD ✅ @`2741fe19` |
| **Letra chica** | web está **acotada por `DEC-14`** (criterio 3 acotado a web, sprint cerrado el 08/10). De los 54 web, **9 sin comparación**; de los 53 mobile, **13 sin comparación** — «medida» no es «comparada». | **48/54 (88%)** están cerradas **en código**; las otras 6 cumplen por **enmienda fundada**. |
| **Lo que falta** | `(home)` es el **único** id sin veredicto mobile. | **Nada — `PENDIENTE-DECLARADA` 0/54.** |


> ✅ **La columna del mapeo cerró el 2026-10-15 23:5x: de `53/54` a `54/54`, y `PENDIENTE-DECLARADA` de 1 a 0.** La única que faltaba era **`soporte`**, y no le faltaba código: su única divergencia era un **`D ⛓`** — una decisión A/B/C del operador sobre el dictado por función — y **esa decisión ya estaba tomada** desde ese mismo día, escrita en **otro documento**. O sea que la ficha esperaba algo que ya existía: el destrabe fue **relayearla**, no trabajar ([[sesion-parada-la-respuesta-existe-pero-enterrada]]). FE2 la tomó y la cerró en minutos (#1281, `2741fe19`). **La cifra anterior queda dicha y no borrada:** era `53/54 (98%)` con `47/54` en código, medida @`410250ec`.
>
> ⚠️ **Y la columna del criterio 3 NO se movió con esto**: su `53/54` de mobile sigue siendo el techo por `(home)`, que depende de **Google Calendar conectado** — OAuth externo, frente abierto, disparador **afuera** de las tres sesiones. `soporte` pasó de `D` a `E` en el **mapeo**; mover la otra columna por este merge habría sido citar una cifra por la otra, que es el error que esta sección entera existe para frenar.

**`(home)`** ya estaba cerrada por enmienda del lado del mapeo, y su historia está en el comentario de
`MEDICIONES_DECLARADAS`: nadie la había medido nunca y **no por olvido** — su id era ilegible para el
parser, así que la cifra no podía pasar de 53 por mucho que se midiera.

> 🚧 **Y ese `53/54` de mobile es TECHO, no deuda.** `(home)` no es trabajo pendiente de ninguna
> sesión: su lado mobile exige **Google Calendar conectado** (la agenda «Ahora» inline), que es OAuth
> externo y frente abierto — el disparador está **afuera** de las tres sesiones, que es justo la
> categoría que `cola-check.sh:198` reserva para `⏳`. FE2 lo dejó dicho sin que nadie se lo pidiera:
> *«no re-emito `(home)` ni `reveal`: tienen decisión del operador pendiente y no son mías de
> cerrar»*. **Leer «falta 1» como «falta trabajo» es el error**: mientras no haya Calendar conectado,
> 53 es el techo alcanzable, igual que web declara el suyo en 54.

## 2. La única pendiente real: `soporte`

No cumple su DoD y **está bien que no lo cumpla**: su bloqueante es el **hold-to-record**, que espera
una decisión A/B/C del operador. No es trabajo parado por falta de ejecución, es una decisión abierta.

## 3. Qué se cerró el 2026-10-15, y qué lo prueba

| Qué | Prueba |
|---|---|
| `reveal` cumple su DoD | consumidor real fuera de su archivo y de sus tests (`EntradaSesion.tsx:6` import, `:32` uso) **y se ve en device** (`screenrecord` del arranque en frío). PR #1266 `17d0c7bc` |
| Los 5 `DECLARAR` del operador cierran `NO_MEDIBLE` con `Falta:` terminal | PR #1263 `d8d689e9` |
| 4 ids de device medidos (`hablar`, `factura`, `presu` DESVÍO · `grabando` COHERENTE) | `cierre_` de frontend2 sobre `d8d689e9`, device `RF8T318RN9T`. **Verificado contra el código, no citado:** `PantallaFacturacion.tsx:686`, `PantallaPresupuestos.tsx:307`, `PistasVoz.test.tsx:52`, `PantallaTono.tsx:174,180` |
| `CLIENTESCUIT`: la forma decidida está implementada **y servida** | `packages/core/src/api/clientes.ts:254-270` devuelve el documento completo sin máscara, **idéntica en el SHA de prod `2e7d2af5`**; forma fijada por test en #1261 `6ddfe2f9`; control negativo de enmascarado en `modules/clientes/`: 0 hits |

**El «muestra teléfono donde el prototipo pide CUIT» no era un defecto:** `subtituloDeCliente` devuelve
el documento **sólo si `docNro` no está vacío**, y si no cae al teléfono por diseño. El cliente de esa
medición no tenía documento cargado. Es la **tercera** vez en el día que el estado vacío del tenant se
leyó como capacidad ausente (las otras dos: `soporte`/«ver tickets anteriores», que existía desde
#1115, y la card de resultado de `preg`, que el mapeo daba por inexistente).

## 4. El contraste de veredictos ya no cruza plataformas (fix de este PR)

El cruce de veredictos incompatibles se hacía **por id**, tirando la plataforma que la clave ya traía
(`id·camino·plataforma`, desde `515d50f6`). Con el sprint midiendo los mismos 54 ids en mobile, eso
reportaba como contradicción lo que son **dos superficies**: la clase son **9 ids** —`afip`, `apar`,
`bi-refresh`, `clientes`, `detalle`, `hablar`, `hitl`, `presu`, `reveal`— y los 9 son web-COHERENTE
contra mobile-DESVÍO, `detalle` al revés.

**Que la clase ya se venía pagando a mano lo prueba el PR ajeno #1268**, mergeado mientras esto se
medía: declaró `hablar` y `presu` en el ratchet con la lectura *«PLATAFORMAS DISTINTAS, no
contradicción… dos superficies, las dos vigentes»*, que es la misma frase que ya tenían `reveal` y
`afip`. Nueve entradas escritas una por una para decir lo que el dato de la clave contestaba solo.

- **Control negativo:** los 9 dejan de conflictuar. Sus declaraciones quedan huérfanas y el script
  **lo dice solo** (`declaradas_sin_conflicto_vigente`: 8 antes → 17 después, y los conflictos
  vigentes bajan de 13 a 4). No las oculta: las expone para que alguien las retire con su motivo.
- **Control positivo, con dato real y no con fixture:** siguen disparando **4** conflictos —`card`,
  `esc`, `factura`, `soporte`— y los 4 son **intra-plataforma web**; tres de ellos con COHERENTE y
  DESVÍO en el **mismo** documento. La detección que importa queda intacta.
- **Lo que no se afloja:** una emisión **sin** plataforma declarada sigue cruzando contra **todas** las
  del id. No se sabe qué superficie midió, así que no se le concede que hable de otra.

Y el efecto sobre la cifra: declarar el `cierre_` de los 4 ids de device —hecho en #1268 y, en
paralelo, acá— movió **mobile de 49/54 a 53/54**. No era una cifra más baja: el gate es **fail-closed**, así que mientras ese documento estuviera
sin clasificar el medidor salía **`rc=8` sin emitir ninguna cifra**. Un `cierre_` que delega su propio
enganche al corpus deja el instrumento **mudo**, no incompleto.

## 6. La TERCERA cifra: las 27 FICHAS del backlog — y el sprint cierra en ella

> ⚠️ **No es «la cifra del sprint» que falta: es OTRO SUJETO.** Las dos de §1 miden los **54 ids** del criterio 3 y del mapeo. Ésta mide las **27 fichas** del backlog, que es la unidad en la que el sprint se declara terminado (`CLAUDE.md §3.quater.bis`: el registro único es el backlog). Un id de pantalla y una ficha de trabajo no son la misma cosa, y una ficha puede cerrar con varios ids dentro. **Citar 25/25 como si fuera «las 54 pantallas» es el mismo error que §1 previene**, en una capa más arriba.

| | **Fichas del backlog** |
|---|---|
| **Pregunta** | ¿cada ficha del sprint está **resuelta** — DoD completo con sha en `origin/main`, o cerrada por decisión con su `Decision:` (quién/cuándo/dónde)? |
| **Instrumento** | `scripts/sprint-estado.py --pct` (el registro **escribe** el estado; nadie lo marca a mano, y `--check` lo rechaza si no cumple su propia regla) |
| **Corpus** | `docs/copiloto-emprendedor/2026-10-11-BACKLOG-sprint-mobile-beta.md` (**versionado** — un gate cuyo corpus vive fuera del repo mide al equipo, no al commit) |
| **Cifra al 2026-10-15 23:5x** | **DoD completo 19/27 = 70,4%** · **resueltas 25/27 = 92,6%** · **alcance vivo 25/25 = 100,0%** |
| **Reparto** | `TERMINADO` 19 · `CERRADO-POR-DECISION` 6 · `DIFERIDO` 2 · **`PENDIENTE` 0 · `EN-CURSO` 0 · `DOD-PARCIAL` 0** |
| **Control del instrumento** | `--autotest` **VERDE, 0 fallos de 17 casos** (9 negativos + 3 controles positivos). Su fixture de sha se deriva de `merge-base HEAD origin/main`, no de `HEAD`: con `HEAD` el control positivo sólo era verde donde no hacía falta (fix `c8f6ce1f`) |

**Las tres cifras responden tres preguntas y ninguna es «el %» del sprint a secas.** Lo que cierra el sprint es la tercera: **0 fichas pendientes, en curso o parciales**.

### Por qué el alcance vivo es 25/25 y no 27/27

Las 2 que faltan están **`DIFERIDO`**, y diferir no es cerrar: el DoD queda intacto y la ficha sale del denominador (`SM-C5`, SMTP/dominio, bloqueado en DNS desde el 2026-07-25; `SM-F5`, tester externo con video). Las eligió el operador el 15-10. Las **6** `CERRADO-POR-DECISION` declaran el hueco en un `Falta:` terminal en vez de borrarlo, y cada una cita el doc versionado de la decisión — por eso el 100,0% es auditable y no una absolución.

### La última en cerrar, y la parte que es lectura mía

`SM-D1` fue la última ficha viva. Cerró `CERRADO-POR-DECISION` el 15-10 con la medición de device de frontend2 (`RF8T318RN9T`, prod `2e7d2af5`, bundle de `origin/main` `9123bf52`): **`NO_MEDIBLE`** porque el canónico no tiene **ninguna** app externa conectada y las acciones que emiten el par `Confirmar/Cancelar` son justamente las de herramientas externas. La ampara la regla **§4.1** del operador; **la subsunción de esa ficha bajo esa regla la hizo planificación**, está escrita como refutable en [`2026-10-15-decisiones-del-operador-cierre-del-sprint-mobile.md`](../2026-10-15-decisiones-del-operador-cierre-del-sprint-mobile.md) §2, y su disparador de reapertura es concreto: una cuenta de prueba con Gmail conectado por OAuth de Composio.

## 5. Lo que NO está en mis manos

| Qué | De quién | Disparador exacto |
|---|---|---|
| `soporte` | **operador** | decisión A/B/C del hold-to-record |
| 11 filas fiscales (`SM-E1` + 10 de `SM-F2`) | **operador** | **A** vincular el perfil fiscal de homologación al canónico (`deploy/copiloto/setup_tenant_pruebas.py` con `COPILOTO_TENANT_PRUEBAS_EMAIL=e2e-device@copiloto.test`, comando listo) ó **B** declararlas `NO_MEDIBLE` |
| ~~revisión de PII de `CLIENTESCUIT`~~ | ~~backend~~ | ✅ **CONTESTADA el 15-10**, y la midió planificación en vez de volver a preguntar: las tres binarias salieron SÍ/NO/NO y la lista **no persiste** el documento. Fila cerrada |
| ~~11 filas fiscales (`SM-E1` + 10 de `SM-F2`)~~ | ~~operador~~ | ✅ **resueltas por la vía B** el 15-10: `SM-F2` quedó `CERRADO-POR-DECISION` declarando el hueco (§4.1), sin vincular el perfil fiscal al canónico. La vía **A** sigue disponible y reabriría con el DoD intacto |
| `SM-D1` (device de las 2 `choices` + artefacto) | **operador** | **A** una cuenta de prueba con **Gmail conectado** por OAuth de Composio — y la ficha se reabre con su DoD intacto — ó **B** confirmar el cierre por §4.1 que ya está aplicado. Medida `NO_MEDIBLE` en device, no supuesta |
