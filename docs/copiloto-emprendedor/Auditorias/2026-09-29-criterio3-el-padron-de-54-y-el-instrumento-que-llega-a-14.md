# Criterio 3 · El padrón de los 54 — y los 17 que no tiene nadie

**2026-09-29** · **Emite:** auditoría (`wt-aud-criterio3`) · **Para:** planificación
**SHA medido:** `bbce99c0c9d81fa2c443d1bef2e34677a82cbea5` (`origin/main`, resuelto con `git fetch` previo)
**Encargo:** decisión (a′) del operador — *republicar los 54 ids sobre el SHA actual*. DoD: «los **54**,
no 48 ni 29, con el SHA medido en la cabecera».

> **Veredicto en una línea:** el padrón de los 54 **queda establecido y verificado** (54 de 54, con
> control positivo y negativo), y el criterio está **bastante más cerca de lo que yo mismo escribí esta
> mañana**: **37 de 54 ya tienen veredicto o declaración** por las cuatro vías de `medido_contra:`, y
> sólo **17 no tienen nada**. De esos 17, **5 los cierra el instrumento corriéndolo hoy**, **3** ya
> tienen su motivo escrito y nadie lo pasó al registro, y **9** son trabajo real — **los 9 alcanzables**.
> En todo el padrón hay **un solo** id que no se puede reproducir sin un efecto real hacia afuera
> (`cobro-voz`). El criterio 3 **no está bloqueado**: está sin terminar, que es otra cosa.

---

## §0 · Método, los controles que lo pueden refutar, y mis cuatro defectos

Tres capas, según el contrato de esta sesión: **capa 0 script** (determinista, cero tokens) → **capa 1
sub-agentes** (recolectan, no juzgan) → **capa 2 yo** (el veredicto, que no se delega).

**La decisión de diseño que más importa:** el padrón sale de la **spec**, **no** del generador. Si
saliera del generador, los ids que le faltan no aparecerían como huecos: **desaparecerían**, y
«17 de 17 ✅» se leería como criterio cumplido (`memoria/instrumento-que-no-mira-nunca-falla.md`).

| control | qué refutaría | resultado |
|---|---|---|
| **positivo del padrón** | si el extractor no saca los 54 que la spec declara en su propio encabezado, falla el extractor, no la spec | ✅ **54 = 54** |
| **positivo por id** | `ingresos` y `cuenta` tienen que salir del padrón **y** de `CAMINO` | ✅ los dos |
| **positivo del cruce, uno por fuente** | `afip` sólo vive en el cierre [A], `reveal` sólo en el [B] | ✅ los dos |
| **negativo** | un id inventado (`zznomatchzz`) no puede aparecer en ningún conjunto | ✅ **0** |
| **de cobertura** | el script imprime **cuántos examinó**, no sólo el resultado | ✅ `54 de 54` |
| **de pertenencia** | un id con veredicto que no esté en la spec es dato, no error: se reporta | ✅ **0** huérfanos |
| **de segunda fuente** | un `0` de mi propio extractor no prueba ausencia: se contrasta con `grep -c` de la cadena cruda | ✅ (§2) |

**Cuatro defectos míos, medidos, no confesados de más:**

1. **Mi padrón infló el numerador en 3.** Marcaba `entrada`/`hitl`/`splash` como `MEDIBLE_HOY` por tener
   `CAMINO`, ignorando `MEDIBILIDAD`. Es exactamente el orden de evaluación que `criterio3-matriz.mjs:82`
   documenta haber corregido («primero *¿se puede medir?*, después *¿por dónde se llega?*»): **el defecto
   que audito es fácil de repetir, y lo repetí.** Corregido en `criterio3-padron.sh:99-105`.
2. **Mi hipótesis del 47-vs-37 era falsa en el mecanismo.** Número correcto, razón inventada (§2).
3. **Mi cruce leyó uno de dos cierres, y mi control positivo no lo detectó** — los dos ids de control que
   elegí vivían **los dos en el mismo documento**. Un control que no toca **ambas** fuentes no prueba que
   ambas se lean. Corregido: ahora toma un id de cada cierre (`criterio3-cruce.sh:64-70`).
4. **No inventarié lo que ya existía antes de despachar.**
   `docs/.../Auditorias/2026-09-28-barrido-caminos-de-acceso-de-los-54-ids.md` está en `origin/main` desde
   ayer y barre los caminos de estos mismos 54 ids. Lo encontraron **los sub-agentes**, por su cuenta, no
   yo. Canon 3: todo diseño abre con el inventario de lo existente. El trabajo se salvó porque ambos lo
   trataron como mapa y verificaron cada fila contra `origin/main` — mérito de su método, no del mío.

---

## §1 · El padrón: 54 de 54, y qué sabe el **instrumento** de cada uno

| conjunto | de dónde sale | cuántos |
|---|---|---|
| **universo `spec`** | la spec de BL-P5 (**la fuente**) | **54** |
| `CAMINO` (sabe por dónde se llega en la app) | `criterio3-matriz.mjs:236` | **17** |
| `PROTO_VISTA` (sabe qué selector esperar en el prototipo) | `criterio3-matriz.mjs:111` | **25** |
| `MEDIBILIDAD` (declarado **no** capturable, con motivo) | `criterio3-matriz.mjs:77` | **3** |
| default si nadie pasa `SOLO_IDS` | `criterio3-matriz.mjs:375` | **7** |
| **medibles por el instrumento hoy** | `CAMINO` − los declarados no medibles | **14** |

**El numerador del instrumento no es 17: es 14.** `entrada`, `hitl` y `splash` tienen camino pero el
generador los saltea por diseño (`captura === false`, con motivo escrito).

**Y acá está la trampa que yo mismo pisé:** «padrón − `CAMINO` = 37» mide **lo que le falta al
instrumento**, no lo que le falta al criterio. No son lo mismo, y confundirlos es el §3 que este
documento tuvo que reescribir.

**13 de esos 37 tienen `PROTO_VISTA` pero no `CAMINO`** (`ajustes`, `apps`, `clientes`, `consent`,
`gastos`, `hablar`, `ingresar`, `reveal`, `tablero`, `vozchat` entre ellos): el lado **prototipo** ya se
sabe capturar y falta el lado **app**. Esa asimetría sigue siendo información útil para priorizar.

---

## §2 · Dos cifras que parecían contradecirse, reconciliadas contra los tokens

El dictamen del 23/09 dice **«47 ids sin navegación escrita»**; yo medí **37**. Ninguna está mal: miden
el mismo hecho en dos momentos.

| SHA | `CAMINO` | default `IDS` | «sin navegación» |
|---|---|---|---|
| `78320bf0` (el del dictamen del 23/09) | **la tabla no existía** | 7 | 54 − 7 = **47** ✅ |
| `f0f84f10` (arreglo del instrumento, PR #685) | 17 | 7 | 54 − 17 = **37** |
| `bbce99c0` (**hoy**) | 17 | 7 | 54 − 17 = **37** ✅ |

**Control de segunda fuente, porque un 0 de mi propio extractor no alcanza:** en `78320bf0` la cadena
`CAMINO` aparece **0 veces** (`grep -c`, no sólo 0 matches de mi patrón `awk`), y el archivo tenía 145
líneas contra 450 hoy. El 0 es real, no ceguera del instrumento.

**Y mi primera hipótesis era falsa.** Supuse «el 23/09 `CAMINO` tenía 7 entradas». No existía, y el 7
venía del **default `IDS`**. El número coincidía por la razón equivocada. Lo que lo cerró fue medir los
tres SHA, no razonar sobre uno.

---

## §3 · La cobertura real — y por qué mi propio §3 sobreestimaba el hueco

**Este apartado refuta lo que este mismo documento decía hace tres horas.** Decía, textual: *«los 37
faltantes no son una corrida pendiente sino caminos de navegación sin declarar»*, y repartía el encargo
como «declarar los 37 caminos (frontend) + emitir los 54 veredictos (auditoría)».

**Está mal, y el error tiene una forma que yo mismo había escrito ese mismo día:** miré **sólo el
instrumento**. El criterio 3 **no se mide sólo con el instrumento** — el contrato de medición admite
cuatro vías, cada una con su `medido_contra:` (`leido@<rama>:<sha>` · `proto@<sha>` · `servido@<sha>` ·
`reconstruido@<path>:<commit>`), y FE1/FE2 ya midieron decenas de ids por esas vías. Esos veredictos
viven en los **cierres del buzón**, que **no están versionados**, y por eso no aparecen en ningún
barrido del repo. Recortar el campo de visión **no te hace perder el hallazgo: te hace
sobreestimarlo** — la mitad exculpatoria vive fuera del recorte, y lo que queda adentro alcanza para
acusar.

Cruce medido (`criterio3-cruce.sh`, que lee los cierres como **fuente**, no una lista copiada a mano):

| población | cuántos | ids |
|---|---|---|
| **con veredicto en los cierres** | **34** | `afip` `agenda` `ajustes` `apps` `bi` `bi-refresh` `bi-vacio` `bloqueado` `card-factura` `chat` `clientes` `cobro-voz` `consent` `cuenta` `detalle` `fact-cae` `fact-hitl` `fact-voz` `feedback` `gastos` `hablar` `ingresos` `negocio` `onb-cumplida` `onb-promesa` `preg` `pres-ciclo` `pres-hitl` `presu` `recibo` `reveal` `tablero` `vacio` `vacio-visto` |
| **`PENDIENTE_DEVICE` declarado** | **3** | `grabando` `pres-voz` `vozchat` |
| **sin veredicto ni declaración** | **17** | ver descomposición abajo |
| **CUBIERTOS** | **37 de 54** | |
| con veredicto pero fuera de la spec | **0** | — |

Y los 17 **no son un bloque**: se descomponen en tres poblaciones con dueño y costo muy distintos.

| # | población | ids | qué hace falta |
|---|---|---|---|
| **A** | **5** — el instrumento **ya sabe llegar**; nadie corrió | `apar` `comousar` `esc` `factura` `soporte` | **correr el instrumento.** Cero trabajo de código. |
| **B** | **3** — motivo **ya escrito** en `MEDIBILIDAD`, nunca pasado al registro | `entrada` `hitl` `splash` | **transcribir**, no investigar. El instrumento explica por qué no los captura; el registro no lo sabe. |
| **C** | **9** — trabajo real | `(vacio)` `caida` `card` `card-cliente` `card-cobro` `card-presu` `ingresar` `ingresar-error` `volver` | declarar camino + medir. **Los 9 son alcanzables** (§4). |

Aritmética verificada por script: 34 + 3 + 17 = **54**; 5 + 3 + 9 = **17**.

**Lo que esto cambia para planificación:** el criterio 3 no está a 37 caminos de distancia. Está a **una
corrida (A) + una transcripción (B) + nueve filas (C)**. El acta hablaba de «29 de 54»; la cobertura
medida es **37**, y ninguna de las seis definiciones de conteo que probé reconstruye 29 (§6, C3-9).

---

## §4 · Alcanzabilidad: **un solo** id del padrón exige un efecto real

Lote de 25 estados, clasificados por un eje explícito — *¿se llega sin emitir ante ARCA, sin generar un
cobro de MercadoPago y sin mandar mails?* — con control positivo contra los 3 ids que `MEDIBILIDAD` ya
declara. El control validó el método y además separó dos ejes que se estaban confundiendo: `splash` y
`entrada` están declarados no medibles por un problema de **captura**, no de **efecto**.

| categoría | cuántos | consecuencia |
|---|---|---|
| `ALCANZABLE_NAVEGANDO` | **16** | no necesitan nada salvo camino declarado |
| `REQUIERE_ESTADO_SEMBRADO` | **7** | el seed **ya existe** |
| `NO_REPRODUCIBLE_SIN_EFECTO` | **1** (+1 rama) | `cobro-voz`, y la rama (a) de `fact-cae` |

**El hallazgo que destraba la mayor parte: el seed ya está escrito y nadie lo usa para esto.**
`deploy/copiloto/seed-midia-e2e.py` siembra datos reales en DB para el tenant canónico **sin tocar ARCA
ni MercadoPago nunca**: comprobantes con `cae="SEEDCAE%08d"` vía `AfipComprobanteStore` (`:87-98`, usado
4× en `:133-178`), un presupuesto pendiente (`:120-124`), una conexión MercadoPago **caída** vía
`mp.marcar_reauth` (`:189-191`) y un certificado AFIP por vencer en ambiente `dev` (`:184`). Es
idempotente y dry-run por defecto. Se suman dos mecanismos más: `CLAVE_DIAS_CALMA` en `localStorage`
(`EstadoVacio.tsx:16,50-52`), 100 % cliente, y la tool `marcar_presupuesto` (`tool_catalog.py:1201-1259`),
que mueve `pendiente`→`aprobado` con un UPDATE local.

**`cobro-voz` es el único sin sustituto:** `tool_catalog.py:591,643` llama de verdad a
`POST /checkout/preferences` de MercadoPago **antes** de renderizar `TarjetaLinkDeCobro`. Cuando la card
se ve, el artefacto real ya existe en la cuenta del tenant. No hay fixture ni seed que lo produzca.

---

## §5 · Los caminos de 12 pantallas, y cuatro asimetrías que el padrón no modela

Lote de 12, con control positivo redescubriendo `cuenta` y `negocio` **sin mirar `CAMINO` primero** y
comparando después: coincidieron exactamente. Cuatro de las 12 filas tocan el **diseño** del padrón, no
sólo su relleno:

- **`tablero` y `(vacío)` son el mismo componente con el mismo testid** (`pantalla-midia`, ambas
  plataformas). Lo que cambia es el sub-testid interno (`midia-lista` vs `midia-vacio`), no la pantalla.
  El padrón cuenta dos ids donde hay una pantalla en dos estados de datos.
- **`apps` son dos componentes distintos según plataforma**: web resuelve a `ConnectionsScreen`
  (`connections-screen`), mobile a `PantallaApps` (`pantalla-apps`). La comparación web↔mobile de ese id
  no es 1:1. Y **`AppsScreen.tsx` (web) no tiene ningún caller** — `AppShell.tsx:110-117` deja la rama
  viva a propósito.
- **`recibo`: web 5 flujos, mobile 1.** Sólo `TarjetaFacturaPropuesta.tsx:130` monta el `Recibo` del chat
  en mobile; gasto, ingreso, presupuesto y cliente no pasan por ese componente.
- **`chat` en mobile no se alcanza por tap sino por gesto** (`PanelDeslizable`). Playwright no lo
  ejercita: es de la clase que ya sabemos que un gate web/jsdom no ve.

---

## §6 · Hallazgos sobre los **instrumentos** y el registro (no sobre la app)

| # | hallazgo | por qué importa | severidad |
|---|---|---|---|
| ~~**C3-1**~~ | ~~**`vacio` quedó `NO_REPRODUCIBLE_SIN_EFECTO` mientras su gemelo `vacio-visto` fue reclasificado** (Q3RECL) a `DESVÍO` — «el fix llegó a uno de los dos gemelos».~~ **RETIRADO 2026-09-29 17:05: era falso positivo.** Las dos filas **preguntan cosas distintas** — `vacio-visto` se responde por **ausencia de mecanismo** (no hay contador equivalente, el cuerpo nunca cambia) y `vacio` exige **ver la pantalla vacía**. El criterio real de Q3RECL, escrito en el cierre [B] `:58-60`, no es «¿es reproducible?» sino **«¿la comparación ya tiene resultado?»**. Con ese criterio, la asimetría es **correcta**. | Apliqué el patrón «el fix llegó a un gemelo» sin verificar su precondición: que ambos lados respondan lo mismo. Emparejar por simetría habría **inventado una comparación que la fila declara ausente** (`N/A — no hubo comparación`). Ver `memoria/una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal.md`. | ~~🔴~~ **retirado** |
| **C3-1′** | **El cajón de `vacio` sí está mal, pero por otra razón: el estado ES reproducible sin efecto externo.** El eje del contrato es el efecto hacia afuera (ARCA/MP/mail), no tocar la DB; marcar tarjetas como `hecha` en el tenant de prueba es un UPDATE local, y `seed-midia-e2e.py` ya siembra 8 tarjetas activas — llegar a `vacio` es la operación inversa, mismo tipo y mismo costo. No corresponde `DESVÍO` (no hay comparación) **ni** `NO_REPRODUCIBLE_SIN_EFECTO` (sí es reproducible): corresponde **pendiente de medición con estado sembrado**. | `NO_REPRODUCIBLE_SIN_EFECTO` es un cajón que **apaga trabajo** — nadie vuelve a mirar lo que está ahí. Un id reproducible metido en ese cajón desaparece del plan sin que nadie decida sacarlo. **El falso positivo de C3-1 me estaba tapando este hallazgo.** | 🟠 media |
| **C3-2** | **`cobro-voz` no está en `MEDIBILIDAD`** pese a ser el único id del padrón que exige un efecto real hacia afuera. Hoy el generador lo trataría como medible. | Un id irreproducible sin declarar produce o un fallo confuso, o la tentación de generar un cobro real para «completar la matriz». | 🔴 **ALTA** |
| **C3-3** | **El seed existe, es idempotente, y no se está usando para el criterio 3.** 7 ids dependen de estado sembrado y el mecanismo ya está escrito y probado. | Trabajo ya pago que se está por volver a pagar — o peor, se declara «no reproducible» lo que el seed produce (ver C3-1). | 🟠 media |
| **C3-4** | **El barrido del 2026-09-28 declara haber medido contra el checkout compartido «con cambios locales sin commitear»**, no contra `origin/main`. Verificado: su cita `ChatScreen.tsx:121` para `consent` no corresponde a nada de consent en `origin/main` (ahí esa línea es el `<Composer>`). | Un barrido medido contra un árbol sucio **no es reproducible por nadie**, ni por su autor mañana. Sus filas no se pueden citar sin re-verificar una por una. | 🟠 media |
| **C3-5** | **El cierre [A] no tiene campo `plataforma` en ninguna fila**, aunque el criterio exige ✅ en web **y** mobile. | Un veredicto sin plataforma no puede satisfacer un criterio que pide las dos. | 🟠 media |
| **C3-6** | **El «29 de 54» del acta no lo reconstruye ninguna de las seis definiciones de conteo probadas** (25/30/31/32/36/37/40). La cobertura medida es **37**. | El número que gobierna un criterio de cierre no se puede reproducir desde ninguna fuente. | 🟠 media |
| **C3-7** | **[A] declara «21 mediciones» y tiene 20 encabezados de fila.** | Tercera fuente independiente del mismo patrón de compensación: un conteo declarado que no coincide con el contenido. | 🟡 baja |
| **C3-8** | **`bi-vacio` tiene `medido_contra` sin `proto=`; `clientes` tiene un literal `proto=leido@` sin SHA.** El vocabulario declarado es de 7 valores y sólo 6 tokens son identificables. | El campo que hace auditable todo lo demás no está validado por nada. | 🟡 baja |
| **C3-9** | **`AppsScreen.tsx` (web) no tiene caller.** | Código muerto que además hace parecer simétrico un id que no lo es. | 🟡 baja |

**Un cruce que confirma, no que acusa:** el lote de caminos reportó que el id `consent` **no existe como
cadena** en `origin/main` y propuso `SheetRequiereConexion` como equivalente funcional, marcándolo
explícitamente como hipótesis. El cierre [A] ya lo había medido exactamente así, con 5 capturas de 3
intentos reales (`:186-194`). Dos barridos independientes, mismo mapeo: la hipótesis queda confirmada y
`consent` no es un hueco.

---

## §7 · Alcance declarado — qué **no** afirma este documento

- **No emite los 54 veredictos de comparación proto↔app.** Establece el padrón, mide la cobertura real y
  nombra lo que falta con nombre propio.
- **No re-verifica las 34 filas con veredicto ajeno.** Las cuenta como cubiertas porque declaran su
  `medido_contra:`; auditar su contenido es otro encargo. Lo que **sí** audito es el **registro**: C3-1,
  C3-5, C3-7 y C3-8 salen de ahí.
- **No afirma que los 14 medibles estén ✅**: la corrida sobre este SHA quedó en curso al momento de
  cerrar este turno, y su resultado se agrega **con el exit code**, no con el texto.
- **No corrió nada en device.** Los 3 `PENDIENTE_DEVICE` siguen pendientes por orden del operador.
- **`caida` está clasificado por inferencia mía**, no por una fila medida: ninguno de los dos lotes lo
  cubrió, y lo ubico en «sembrable» porque `seed-midia-e2e.py:189-191` produce exactamente ese estado.
  Vale como pista, no como medición.
- **Las clasificaciones de `onb-cumplida` y `bi-vacio` dependen del estado vivo de la DB del tenant**, que
  el lote no pudo verificar (era read-only). Quedan marcadas como inferencia en su propia fila.
- **No toqué** `criterio3-matriz.mjs`, ni la spec, ni el prototipo. Lo nuevo son dos scripts de
  evidencia.

---

## §8 · Filas para planificación — ninguna es mía de ejecutar

| fila | qué | dueño natural | DoD binario |
|---|---|---|---|
| **C3-A** | correr el instrumento sobre `apar comousar esc factura soporte` | auditoría (ya en curso) | 5 filas con SHA, o el fallo honesto de cada una |
| **C3-B** | pasar al registro los motivos ya escritos de `entrada` `hitl` `splash` | dueño del registro | los 3 con motivo citado desde `criterio3-matriz.mjs:77-91` |
| **C3-C** | declarar `CAMINO` de los 9 de la población C | **frontend** (es conocimiento de la app) | 9 entradas; los 9 son alcanzables (§4) |
| ~~**C3-1**~~ | ~~revisar la clasificación de `vacio` con la misma vara que su gemelo~~ — **retirada**, era falso positivo (§6) | — | — |
| **C3-1′** | mover `vacio` de `NO_REPRODUCIBLE_SIN_EFECTO` a pendiente-con-estado-sembrado, y medirlo con el seed | backend (dueño del seed) + quien emitió [B] | `vacio` con comparación real contra `#calma`, o su motivo re-fundado sobre el eje correcto |
| **C3-2** | agregar `cobro-voz` a `MEDIBILIDAD` con motivo | frontend o auditoría | entrada escrita; el motivo ya está redactado en el tono del archivo |
| **C3-3** | usar `seed-midia-e2e.py` para los 7 ids sembrables | backend (dueño del seed) | los 7 estados alcanzados sin tocar ARCA/MP |
| **C3-4** | re-verificar o retirar las filas del barrido del 28/09 | quien lo emitió | cada fila citada contra un SHA de `origin/main` |
| **C3-5/6/7/8** | validar el registro de mediciones: `plataforma` obligatoria, conteo declarado = filas, `medido_contra` con SHA | planificación (dueña del contrato) | un control que **falle** ante una fila sin plataforma o sin SHA |

**C3-1′ es la que pido mirar primero**, y no por costo: es un veredicto que apaga trabajo. Un id marcado
irreproducible no lo vuelve a mirar nadie. Ojo con el argumento que **no** hay que usar para moverlo: no
es «su gemelo fue reclasificado, emparejemos» — eso fue mi C3-1 retirada, y emparejar habría inventado
una comparación ausente. Es que **el estado es reproducible sin efecto externo y el seed ya existe**.

---

**Instrumentos de este dictamen** (idempotentes, imprimen cuántos elementos examinaron, y su veredicto
es el **exit code**, no el texto): `scripts/evidencia/criterio3-padron.sh` · `scripts/evidencia/criterio3-cruce.sh`.

**delegación:** 4 sub-agentes (0 haiku / 4 sonnet) · ~30 lecturas inline · scripts: 2 propios escritos,
11 corridas · 1 corrida del instrumento de terceros.
