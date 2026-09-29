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
| **C** | **9** — trabajo real | `(home)` `caida` `card` `card-cliente` `card-cobro` `card-presu` `ingresar` `ingresar-error` `volver` | declarar camino + medir. **Los 9 son alcanzables** (§4). |

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

- **`tablero` y la home son el mismo componente con el mismo testid** (`pantalla-midia`, ambas
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

---

# ADENDA 2026-09-29 17:40 — población A medida (5/5), y el criterio 3 **no tiene referencia de escritorio**

Cierra el §7, que declaraba pendiente la corrida sobre los 5 ids de población A.

## El instrumento: dos defectos arreglados, uno de raíz

`correr-criterio3.sh` colgaba para siempre justo después de `✓ prototipo … (HTTP 200)`, sin escribir
una captura. **Causa: levanta el server del prototipo con `nohup … &` y después hace `wait` SIN
argumentos**, que espera a *todos* los jobs del shell — incluido un server que no termina.
Reproducción mínima aislada: `wait` pelado ⇒ timeout; `wait $pids` ⇒ pasa; sin server en background el
`wait` pelado tampoco cuelga (control negativo). Intermitente porque si el server ya está vivo, el
runner no lo levanta y no hay job que esperar.

**Y el comentario del propio script invertía la causa**: mandaba a «matá ese server y dejá que este
runner levante el propio» — el consejo que *garantiza* el cuelgue. Corregido (PR #722, `34ed5fb1`).

Con el fix: **exit 0**, 20 PNGs (5 ids × 2 viewports × app/proto) + `criterio3-caminos.json`.

## 🔴 C3-10 · No existe referencia de escritorio (afecta a todos los lotes)

`Prototipo frontend/odobi-ui/prototipo/index.html:57-66`, **única media query en 3900 líneas**:

```css
/* En el teléfono ocupa todo; en escritorio, un marco de 390×844 para verlo en contexto. */
@media (min-width:520px){ #app{width:390px;height:844px;border-radius:40px;...} }
```

El prototipo **es mobile-only por diseño**. A 1440 no reflowea: dibuja una maqueta de teléfono
centrada. Entonces la comparación `@desktop` enfrenta el diseño *mobile* del proto contra el layout
*desktop* de la app, y **todo desvío de escritorio derivado de ahí es artefacto del instrumento**.

Peor: el instrumento **no falla** — produce 10 archivos `…-proto-desktop.png` cuyo nombre afirma lo que
el contenido no cumple. Es un instrumento que acusa al producto por un defecto propio.

**No afirmo que los 34 veredictos existentes estén mal**: no declaran `plataforma` (C3-5), así que no se
puede saber contra qué midieron. Sí afirmo: **si alguno midió desktop contra el proto, esa fila no es
válida.** La decisión de alcance es de planificación.

## 🟠 C3-11 · El instrumento no puede afirmar ausencias — y la vuelta útil

Las capturas son de **viewport**, y el proto corre con `overflow:hidden` + scroll interno: «no está en
el proto» puede ser «está debajo del fold». **Pero** la captura `proto-desktop`, inservible como
referencia de escritorio, **es la referencia mobile completa** (marco entero de 390×844 con fondo vacío
al pie). Si sobra fondo, la pantalla terminó y la ausencia **sí** es afirmable. Ese es el criterio
usado abajo.

## Los 5 veredictos · teléfono · `medido_contra: proto@34ed5fb1` + app servida

| id | @390 | qué | @desktop |
|---|---|---|---|
| `apar` | ✅ **COINCIDE** | misma estructura, orden y textos; termina con fondo vacío en ambos ⇒ comparación completa | `SIN_REFERENCIA` |
| `comousar` | 🔴 **DESVÍO** | proto: los 5 temas en **una tarjeta, numerados 1-5, con chevron**; app: tarjetas sueltas **sin número ni chevron**. Y la app **agrega** «LO QUE LE PODÉS PEDIR» (GASTOS/INGRESOS/FACTURAS), que el proto no tiene | `SIN_REFERENCIA` |
| `esc` | 🔴 **DESVÍO** | título «Funciones» vs «**Tus funciones**» · **fila 1 del grid invertida**: app `Facturación·Ingresos·Gastos`, proto `Gastos·Ingresos·Facturación` (fila 2 coincide) · chevron en «Actividad reciente» sólo en app | `SIN_REFERENCIA` |
| `soporte` | 🔴 **DESVÍO** | proto tiene breadcrumb «‹ Ajustes» y **H1 de página**; en la app el título vive **dentro de la burbuja** · emisor «Soporte técnico» vs «**Soporte de Odobi**» · **affordance**: app ofrece **micrófono**, proto ofrece **adjuntar (clip)** | `SIN_REFERENCIA` |
| `factura` | ⚠️ **NO MEDIBLE — app sin datos** | las 2 filas de «ÚLTIMAS EMITIDAS» salen **vacías** (placeholders): no se puede comparar estructura de fila. Lo comparable coincide (header, card negra, «+ Nueva factura») | `SIN_REFERENCIA` |

**Supuesto declarado, no verificado —** `[ASSUMED_PENDING_VERIFY]`: el proto **nunca** dibuja la barra
inferior y navega por gesto («Subí para volver a Mi día»); la app la muestra siempre. Se la pasé a los
recolectores **como legítima**, así que pudo sesgarlos. Si no es decisión tomada, es un desvío que
atraviesa las 5 pantallas.

## 🟠 C3-12 · Hallazgo de producto, de rebote (no es del criterio 3)

En `factura`, el mismo dato está en un viewport y falta en el otro:

| | «Facturado este mes» | píldora |
|---|---|---|
| app @390 | **$165.000,00** | «3 facturas · 3 impagas» |
| app @desktop | **«—»** | **ausente** |

Mismo tenant, misma corrida. Un importe que está a 390 y no a 1440 no es del prototipo: es de la app.
Fila para frontend (o backend, si el shell desktop lo pide por otra query).

## Corrección de nomenclatura

El id `(vacio)` de la población C **no existía en la spec: lo fabricaba este dictamen** vía
`criterio3-padron.sh`. La celda real es `*(vacío)* Mi día` — **la home** (`?ver=` sin valor) — y el
nombre colisionaba con `vacio` (BL-W5, spec `:43`), que es otro id. Renombrado a **`(home)`**. Le costó
un turno a frontend2, cuya población C queda en **8 ids**; la home pasa a la cola de auditoría. El
conteo no se mueve: 27 filas × 2 columnas = 54 celdas, control de no-regresión en 54 = 54.

## `(home)` MEDIDO — sale de los 17, sin correr el instrumento

El id que tomé de la población C queda cerrado por la vía `leido@` (el contrato admite cuatro, y el
criterio no se mide sólo con el generador):

- **Cuerpo:** la home es el mismo componente que `tablero` — `MidiaScreen.tsx:192` es **el único** lugar
  que monta `data-testid="pantalla-midia"` (los otros 7 hits del grep son tests). El veredicto de
  `tablero` (lote B) cubre el cuerpo.
- **Lo único propio de la home es el ruteo por defecto**, y está verificado:
  `AppShell.tsx:31` `const DEFAULT_TAB: TabKey = 'midia'` · `:63`
  `useState<TabKey>(initialTab ?? DEFAULT_TAB)` · `App.tsx:79` pasa `undefined` salvo signup reciente.
- **Y hay test, en los dos breakpoints:** `AppShell.test.tsx:61-68` («por default aterriza en Mi día
  (BL-X1)», asertando además `aria-current="page"` en el botón «Mi día») y
  `ResponsiveShell.test.tsx:61-70` («en ambos breakpoints monta la misma pantalla de módulo (Mi día)
  por default»).

**Consecuencia para el conteo de huecos:** la población C baja de **9 a 8** (los 8 de frontend2), y
`(home)` pasa a **medido**. Los 17 sin nada pasan a **16**.

## El supuesto de la tab bar: VERIFICADO — es decisión declarada, no desvío. Y señala el camino de C3-10

Declaré `[ASSUMED_PENDING_VERIFY]` que la barra inferior de la app (ausente en el prototipo, que
navega por gesto) fuera decisión tomada. **Lo es, y está escrito desde antes del prototipo** —
`docs/copiloto-emprendedor/2026-07-03-cliente-web-mobile-design-handoff.md`:

- `:48` — «**Forma UX:** Híbrido: chat protagonista + rail de módulos. **Desktop = split (rail ⟺ chat);
  mobile = chat full + tab bar.**»
- `:90-91` — «**Desktop:** rail izquierdo: Chat · Conexiones · Caja · Agenda · Cuenta. · **Mobile:** tab
  bar inferior (mismos ítems).»
- `:259` — «**Responsive real** (desktop split / mobile tab bar / tablet)».

Control de que el prototipo efectivamente no la tiene: **0 ocurrencias de «Consola»** —el nombre de una
de las pestañas— en las 3900 líneas del prototipo, con control positivo verde («Funciones» aparece).

**Los 5 veredictos no cambian:** la diferencia existe pero es arquitectura de navegación decidida
(handoff 03/07), no desvío contra el prototipo (spec 22/09).

### Y esto le da salida a C3-10

El mismo handoff **declara un diseño de escritorio** («Desktop = split (rail ⟺ chat)», rail izquierdo
con sus ítems) que el prototipo, siendo una maqueta de teléfono de 390×844, **no modela ni pretende
modelar**. Entonces la referencia de escritorio del criterio 3 **no es el prototipo por definición del
propio diseño** — y existe candidata: el handoff `2026-07-03-cliente-web-mobile-design-handoff.md` y
`docs/copiloto-emprendedor/DESIGN-SYSTEM-EXTRACT-WEB.md`.

**Recomendación a planificación** (la decisión sigue siendo suya): el eje `@desktop` del criterio 3 se
mide contra el handoff/design-system web por la vía `leido@`, no contra `proto@`. No hace falta
construir una referencia nueva: **ya existe y nadie la estaba usando.**

---

## ADENDA 18:40 — la pasada de verificabilidad de los previos: **ninguno midió contra `proto-desktop`**, y el contador es ciego a 28 de los 54

**Encargo** (acta re-emitida §3.bis, dueño: auditoría): en **una** pasada, (a) cuáles de los veredictos
previos midieron contra `proto-desktop` ⇒ no valen, y (b) el desglose **coincide vs desvío** que el acta
no tenía. Planificación declaró explícitamente que **no lo estimaba**, y no lo estimó.

**Instrumentos: los dos ya existían y se reutilizaron sin tocarlos** — `scripts/evidencia/contar-veredictos.py`
(493 líneas, vocabulario cerrado, canario por brazo) y `scripts/evidencia/criterio3-padron.sh`. Cero
scripts nuevos.

### (a) 🟢 Ninguno de los veredictos previos midió contra `proto-desktop`. Los 38 **no** están contaminados por C3-10

Los veredictos previos viven en **dos** archivos del buzón, no en 107:

| lote | archivo | versión medida |
|---|---|---|
| A | `abierto/2026-09-28_cierre_frontend1-…_BL-Q3-v2-lote-A-14-filas-mas-2-pendiente-device.md` | `sha256:501d42969120` · 24.960 B · mtime **2026-09-29 10:47:31** |
| B | `abierto/2026-09-28_cierre_frontend2-…_BL-Q3-v2-lote-B-11-de-11-completo.md` | `sha256:70518ee78487` · 21.945 B · mtime **2026-09-28 13:18:55** |

| huella de una comparación de escritorio | lote A | lote B | **control positivo** (este dictamen) |
|---|---|---|---|
| `proto-desktop` | **0** | **0** | **3** |
| `1440` | **0** | **0** | (22 hits de desktop/1440/escritorio) |
| `viewport` | 1 | 0 | — |

**Y la evidencia positiva del método:** los **34 PNG distintos** que cita el lote A no llevan **ningún**
sufijo de viewport — son `app-afip.png` / `proto-afip.png`, `app-bi.png` / `proto-bi.png`: **un par
app/proto por id, no un par de anchos.** Un grep de `desktop|1440` sobre esa lista de nombres da **0**, y
uno de `390|mobile|movil` también da **0**. El lote B casi no cita PNG (1) y midió por **código** — lo
declaró él mismo en
`dato_frontend2-a-planificacion_C3-10-no-me-afecta-mi-metodo-fue-codigo-no-captura-de-escritorio`.

**Las 3 menciones de «desktop» del lote A no son comparaciones**, son otra cosa: `:22` un hallazgo aparte
(`AppsScreen` muerto en desktop), `:113` una cita de código (`DesktopShell.tsx:81-83`), y `:147` —la
interesante— **«además usa un frame tipo mobile-card incluso en viewport desktop (inconsistencia propia
del proto)»**. FE1 **vio** la maqueta de teléfono a ancho de escritorio y la atribuyó **al prototipo**, no
a la app. Es exactamente la lectura correcta de C3-10, hecha un día antes de que C3-10 se escribiera, y es
la conducta opuesta a la que el instrumento induce
(`memoria/el-instrumento-fabrica-una-referencia-que-no-existe.md`).

**El límite de lo que puedo afirmar, declarado:** los nombres **no declaran el ancho**, así que lo medido
es **«no hubo comparación de dos anchos»**, no «fueron @390». Si el lote A hubiera capturado el par a 1440
sin decirlo en el nombre, seguiría siendo artefacto. `:147` es evidencia lateral fuerte en contra, pero no
es una declaración. **`[ASSUMED_PENDING_VERIFY]` — FE1: ¿a qué ancho corriste los 34 PNG?** Es una
pregunta de una línea, **no** una re-medición: si contesta «390», los 38 quedan verificados sin tocar nada.

### (b) El desglose coincide/desvío, **medido** — y la unidad, que es lo que rompió el acta anterior

Canario del contador corrido, **no prometido**: los 5 brazos tienen control (`campo` 21→6, `tabla` 15→6,
`bullet` 15→12, `tabla-partida` 21→19, `reclasif` 21→20). Ningún brazo es invisible.

| lote | sujetos c/ veredicto | **COHERENTE** | **DESVÍO** | no-comparación | veredictos |
|---|---|---|---|---|---|
| A (FE1) | 21 de 21 declaradas | **9** | **7** | 10 (5 `NO_MEDIBLE` · 3 `FUERA-DE-REFERENCIA` · 2 `PENDIENTE_DEVICE`) | 26 |
| B (FE2) | 15 de 15 declaradas | **10** | **6** | 5 (3 `NO_REPRODUCIBLE_SIN_EFECTO` · 2 `FUERA-DE-REFERENCIA`) | 21 |
| **total** | **36 sujetos** | **19** | **13** | **15** | **47** |

**Tres advertencias que viajan con esos números, y sin ellas el número miente:**

1. **La unidad.** 47 es en **veredictos**; 36 en **sujetos**; 32 en **comparaciones** (19+13). Una medición
   partida por dimensión emite dos veredictos. El acta dice **38**: la diferencia con 36 son los sujetos
   cuyo veredicto **no vive en estos dos archivos** (la home, cerrada por `leido@`). No relleno el hueco.
2. **13 desvíos, no «≥ 3».** El acta re-emitida anota «≥ 3» para población A. El instrumento mide **13**
   en los dos lotes previos. Es trabajo de frontend ya medido que no está en el tablero como filas.
3. **4 veredictos huérfanos en el lote B** — leídos, pero sin sujeto declarado arriba, así que no se
   atribuyen a ninguna medición. No son un hueco de medición: son un hueco de **atribución**.

### 🔴 C3-13 — el universo «externo» del contador cubre **26 de los 54**, y los otros 28 no pueden aparecer ni como hueco

`contar-veredictos.py:20-25` da vuelta el numerador a propósito: la unidad primaria es el **sujeto**, y el
universo sale de una fuente **externa al parser** «por eso una forma de registro nueva no puede esconder un
sujeto: el id sigue en la lista, y si no se le pudo leer veredicto aparece como **HUECO CON NOMBRE**».
El diseño es correcto y el canario lo prueba. **Pero esa fuente externa tiene su propio denominador:**

| fuente | ids | control |
|---|---|---|
| spec BL-P5 (fuente de verdad) | **54** | `criterio3-padron.sh`: `54 de 54` @ `db18820b` |
| `criterio3-matriz.mjs` (universo del contador) | **27** | 26 en la spec + `plan` |
| **ciegos al contador** | **28** | `26 + 28 = 54` ✅ |

**Los 28, nominados** (un id fuera del universo no baja ninguna métrica, no genera hueco y el canario
tampoco lo ve — el canario prueba los **brazos del parser**, no la **cobertura del universo**):

```
(home)  bi-refresh  bi-vacio  bloqueado  caida  card  card-cliente  card-cobro
card-factura  card-presu  chat  cobro-voz  fact-cae  fact-hitl  fact-voz  feedback
grabando  ingresar-error  onb-cumplida  onb-promesa  preg  pres-ciclo  pres-hitl
pres-voz  recibo  vacio  vacio-visto  volver
```

No son los marginales: están `cobro-voz` (el gate duro), las cuatro `card-*` (las cards por voz),
`fact-hitl`/`fact-voz`/`pres-voz`/`pres-hitl`, `vacio`/`vacio-visto` y la home. **Así que «21 de 21
declaradas» es cierto y suena completo, y lo que manda es «26 de 54 del universo».**

**El control que falta** (y es del mismo script, no uno nuevo): diff nominal del universo contra la spec,
que **falle** si hay un id de la fuente de verdad fuera del universo sin justificación.
`criterio3-matriz.mjs:119` ya lo confesaba —«Ampliables para el Bloque B (los 22 ids de FE1 y **el resto de
los 54 de la spec**)»— y nadie lo leyó como un límite del **conteo**. **Dueño: planificación** (declaró
`scripts/` suyo).

### 🟠 C3-14 — `plan` es un id **retirado** que el instrumento sigue contando

`plan` está en el universo y **no** en la spec. La spec lo saca explícitamente: `:95` «**−2:** `plan` y
`limite` salen (visión, DEC-8)», y `:72` lo marca «⚠️ VISIÓN: el backend no expone plan ni consumo».

Y la ironía mide sola: `:8` de esa misma spec dice que la lista existe porque **«48/48 coherentes» se
medía contra pantallas que nadie va a construir: `plan` figuraba como una**. La spec corrigió el defecto
en su primera página; `criterio3-matriz.mjs` lo heredó y lo sigue contando como sujeto legítimo.
**Un diff de universo es bidireccional:** faltantes (28 ciegos) y sobrantes (1 retirado que infla).

### Lo que esta pasada **no** es

No es una re-medición de los 38, y no la pide nadie: el encargo era de **verificabilidad**, y se contesta
con la huella del método, que es más barata y más dura que volver a mirar 38 pantallas. Tampoco declaro
verificados los 38 — declaro que **la causa por la que no eran verificables (C3-10) no los afecta**, y que
lo único que falta es una línea de FE1 sobre el ancho.

**delegación:** 0 sub-agentes (la capa 0 lo resolvió entero: 2 instrumentos ya existentes + 4 cruces
deterministas; no hubo barrido que necesitara criterio para recolectar) · 8 lecturas inline ·
**scripts: 6 corridas** (`contar-veredictos.py` ×3 incl. `--canario`, `criterio3-padron.sh`, 2 cruces
python) · 0 en background.

### 🔴 C3-15 — el contador lee **dos paths fijos**, y el registro ya tiene tres archivos. Mis cifras de arriba son correctas **para esos dos**, no son el estado del registro

Esto lo encontré **después** de escribir el desglose de (b), buscando el motivo de los 3 ids de
transcripción. Corrige el alcance de mis propios números, así que va acá y no en una nota al pie.

`contar-veredictos.py:366` fija el universo de **documentos**:

```python
docs = {"lote_A": ubicar("lote-A"), "lote_B": ubicar("lote-B")}
```

Dos archivos del **28/09**. Pero **el 29/09 FE1 cerró B1 con 13 ids** —
`abierto/2026-09-29_cierre_frontend1-a-planificacion_B1-13-ids-superficie-y-dimension.md`, **251 líneas**,
16 ocurrencias de `COHERENTE` y 13 de `DESVÍO` — y **el contador no lo mira**. Mismo defecto de clase que
C3-13, en el otro eje: **C3-13 es el universo de sujetos incompleto; C3-15 es el universo de documentos
incompleto.** El script blindó el numerador de sujetos y dejó los dos denominadores sin control.

| medición | cifra | qué es exactamente |
|---|---|---|
| sujetos con veredicto legible en los **2** archivos que el contador lee | **36** | dura, con canario de 5 brazos verde |
| ids del padrón **citados con backticks** en los **3** cierres | **48 de 54** | **cota superior** — citado ≠ tiene veredicto |
| por archivo | A **22** · B **18** · B1 **13** | del padrón de 54 |

**No resuelvo la diferencia con los «43» del acta.** Las tres cifras miden cosas distintas y sólo la
primera es una medición de veredictos. Lo que sí afirmo: **el registro está más avanzado que lo que
cualquiera de los instrumentos reporta**, y ninguno de los dos números puede citarse como «el estado».

### 🟠 C3-16 — los **5** ids de mi población A están los **5** en el B1 de FE1 del mismo día

| | |
|---|---|
| mi población A (29/09) | `apar` · `comousar` · `esc` · `factura` · `soporte` |
| en el B1 de FE1 (29/09) | **los 5** |
| solapamiento B1 ↔ lote A | 3 (`bi`, `bi-refresh`, `comousar`) |
| solapamiento B1 ↔ lote B | 0 |

**No afirmo que sea trabajo duplicado, y ése es el punto.** El cierre de FE1 se llama «superficie y
dimensión» y el mío midió paridad visual @390: si los **ejes** son distintos, es complementario y está
bien; si son el mismo, dos sesiones midieron los mismos 5 ids el mismo día sin saberlo. **Nadie puede
distinguir los dos casos leyendo el registro, porque el registro no declara `eje`** — que es exactamente
el campo que planificación acaba de crear en la acta re-emitida (`eje ∈ {paridad@390, consistencia-app}`).

Esto es evidencia empírica a favor de ese campo, y sube su prioridad: sin él, el registro no puede
distinguir **cobertura** de **repetición**, y las dos se ven igual — un id con dos filas parece mejor
medido que uno con una, cuando puede ser el mismo trabajo hecho dos veces.

**Y el costo ya se pagó en mi propia cola:** iba a transcribir los motivos de `entrada`/`splash`/`hitl`
como «trabajo de transcripción pendiente». **FE1 ya lo hizo hoy**, en ese mismo B1: `:142` «`entrada` /
`splash` — motivo transcripto textual desde `criterio3-matriz.mjs`», con las dos filas declaradas
**NO_MEDIBLE** y citando `leido@auditoria/controles-propios-y-barrido-proto:de533f80`. El aviso estaba en
el buzón, en un `cierre_` dirigido **a planificación**, no a mí — y por eso no lo abrí. **Un `cierre_`
dirigido a otro puede contener exactamente tu cola.**

### 🟢 Lo que sí queda cerrado de los 3 «de transcripción»

Con `entrada` y `splash` ya transcriptos por FE1, el motivo de los tres está en el generador
(`criterio3-matriz.mjs:77-104`) y es **declarado, no un hueco**:

| id | por qué no se mide con captura | quién lo cerró |
|---|---|---|
| `splash` | app determinista (`SPLASH_TOTAL_MS = 6840`, estado final estable) vs **proto en loop `setInterval(play, 11000)` sin estado final**. Una captura compara un frame arbitrario del loop contra el final de la app: «la foto sale limpia y la comparación no significa nada». **El lado no medible es el proto, no la app** | FE1, B1 `:48` |
| `entrada` | igual con otros números: app `ENTRADA_TOTAL_MS = 1500` (sólo en reload) vs proto en loop de 6 s. Y **no emular `prefers-reduced-motion`** para medirlas: la app colapsa el timeout a 0 ms y la pantalla no llega a pintarse | FE1, B1 `:47` |
| `hitl` | **técnicamente medible** —pantalla determinista, estado estable— pero **no se puede llegar sin cruzar el contrato del barrido** (§2.5, «prohibido producir efectos reales»): su único camino es pedirle al chat una acción real. Si el HITL fallara abierto, el costo sería un cobro o una factura **reales** para sacar una captura de paridad visual. Se mide con ruta de fixture, o en device con un operador mirando | declarado en el generador; **fila mía cerrada acá** |

**Y un falso verde que el propio generador denuncia y nadie transcribió** (`criterio3-matriz.mjs:105-107`):

> «Los dos ids de arriba están hoy declarados **COHERENTE** en la matriz de FE1. Ese veredicto se emitió
> sobre un par de capturas que el instrumento no podía tomar bien — no es una medición equivocada, **es una
> medición imposible que salió verde**.»

**Medido: ese COHERENTE ya no está.** `splash` tiene **0** ocurrencias en el lote A (control positivo del
grep en el mismo archivo: `agenda` 17, `afip` 4, `gastos` 2), y en el B1 de hoy las dos filas figuran
**NO_MEDIBLE**. Así que el comentario documenta un estado **ya corregido** — pero sigue escrito en presente
en el generador, y el próximo que lo lea va a buscar un falso verde que no existe. **Fila de una línea para
planificación: actualizar ese comentario** (es `scripts/`, tuyo). Es el caso exacto de
`el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio`: **el registro envejece en silencio y el
comentario es el último en enterarse.**
