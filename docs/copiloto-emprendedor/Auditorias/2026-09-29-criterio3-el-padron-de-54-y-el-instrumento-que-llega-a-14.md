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

---

# ADENDA 20:10 — **me corrijo dos veces**, y una de las correcciones destapó un DESVÍO que no existe

Esta adenda corrige dos afirmaciones **mías** publicadas en la adenda anterior de este mismo
dictamen. Las dos venían del mismo defecto de método, y una de ellas estaba a punto de costar una
decisión de producto sobre una pantalla que ya coincide.

## 1. 🔴 Corrección de (a): **11 de 20 filas del lote A midieron a 1280×900**

La adenda anterior abre con «**(a) 🟢 Ninguno de los veredictos previos midió contra
`proto-desktop`. Los 38 no están contaminados por C3-10**». **Es falso.**

FE1 contestó la pregunta de una línea que había despachado, **midiendo los archivos**; lo verifiqué
leyendo el IHDR de los 54 PNG de `evidencia-out/bl-q3-v2-lote-a/`:

```
{(1280, 900): 30, (390, 844): 24}
```

**Por qué mi instrumento no podía encontrarlo.** Grepeé `1440` — el ancho que usa **mi** generador
(`criterio3-matriz.mjs:54`). FE1 capturó a **1280**. El `0` no era evidencia de ausencia: era un
control positivo calibrado al valor que **yo mismo** produzco. No decía «no hubo comparación de
escritorio», decía «no hubo comparación con *mi* escritorio». Lo que destapó el error fue haber
declarado el límite y despachado la pregunta — no el instrumento.

### El desglose correcto: dos regímenes, y ninguna fila los declara

Cruzado **fila por fila contra el ancho real del PNG que cada una cita** (control: 35 PNG citados,
**0 ausentes**):

| régimen | filas | ids |
|---|---|---|
| **@1280×900** ambos lados | **11** | `afip` · `agenda`-A · `ajustes` · `apps`-Connections · `bi` · `bi-refresh` · `bloqueado` · `clientes`-listado · `clientes`-ficha · `consent` · `cuenta` |
| **@390×844** ambos lados | **6** | `chat` · `preg` · `feedback` · `card-factura` · `fact-hitl` · `fact-cae` |
| sin PNG (sustento por lectura) | **3** | `agenda`-B · `apps`-AppsScreen · `bi-vacio` |

**Y qué es realmente un `proto-*@1280`.** El prototipo **no reflowea**: `prototipo/index.html:63`

```css
@media (min-width:520px){ #app{width:390px;height:844px;border-radius:40px;
     border:1px solid #C9C1B4;box-shadow:0 24px 64px rgba(26,21,18,.18)} }
```

A cualquier ancho ≥520px dibuja **un teléfono de 390×844 centrado, con marco y sombra**. Así que una
captura `proto-*@1280` no es «el proto a escritorio»: es **el proto móvil dentro de un marco**. Las
11 filas @1280 compararon *app con layout de escritorio* contra *proto móvil enmarcado* — **dos
sujetos distintos**. (El mecanismo lo aportó planificación; la línea está verificada acá.)

## 2. 🔴 C3-17 · el DESVÍO `bi` es un **falso positivo de captura**

El motivo escrito dice: «app muestra **2 cards** (Gastos/Cobrado) vs proto **4 cards**
(Ingresos/Gastos/Facturado/Cobrado) + bloque "Saldo en caja"/"Entró" que la app no expone así».

**Las dos afirmaciones son falsas**, verificado por **código**, no por foto:

| la afirmación | lo que dice el código |
|---|---|
| «la app muestra 2 cards» | `InteligenciaScreen.tsx:224-227` renderiza **las 4**: `['Ingresos',…]['Gastos',…]['Facturado',…]['Cobrado',…]` |
| «la app no expone Saldo en caja / Entró» | `:200-211` renderiza **«Saldo en caja»** + mini-grid **Entró/Salió**, y `:196` cita literal el mockup **`.bi-grid`** — que es el selector del proto `:731` |
| el lado proto | `index.html:1960-1963` las 4 `kpi` idénticas · `:1945-1949` «Saldo en caja» + `Entró` |

Están construidos uno contra el otro.

**El mecanismo es C3-10 puro.** Miré las dos capturas: el **Rail lateral expandido tapa la columna
izquierda entera** de una grilla de 2 columnas. Las 2 cards contadas como «las que tiene la app» son
la **columna derecha**; `Ingresos` y `Facturado` —justo las dos declaradas ausentes— están **debajo
del Rail**. Ídem `Entró`, tapado, mientras `Salió` se lee. El Rail **sólo existe en el shell de
escritorio** (`InteligenciaScreen.tsx:121`: «web conserva su propio chrome (Rail/TabBar)»): a 390 no
hay Rail y no habría nada tapado.

`medido_contra:` app = `InteligenciaScreen.tsx` sha256 `16dc85cd…`, último commit **`2c247335` del
21/09**, o sea **sin tocar desde antes de la captura del 28/09**: la app fotografiada es exactamente
ésta. proto = `7f63e94e…` (working tree de hoy; el suyo fue `proto@54fac3ea`, que no puedo igualar —
lo declaro).

**Estado:** planificación lo tenía como «pregunta de producto» (§4) y lo **retiró** al recibir esto.
Queda como recaptura sin Rail + reclasificación a COHERENTE. Dueño: FE1.

## 3. El criterio de validez de una fila @1280 — general, no caso por caso

Verifiqué los **6** DESVÍO @1280 motivo por motivo, porque «el ancho no invalida ninguno» es un
veredicto que **desactiva trabajo** y exige más evidencia, no menos:

| DESVÍO @1280 | qué mira su motivo | veredicto |
|---|---|---|
| `ajustes` | grid plano vs 3 secciones con encabezados → **contenido** | sobrevive |
| `apps`-Connections | taxonomía de agrupación → **contenido** | sobrevive |
| `consent` | causa raíz `kind:payments` vs `kind:composio` → **backend** | sobrevive |
| `cuenta` | inventario de filas → **contenido** | sobrevive |
| `bloqueado` | composición de controles → **contenido** (y atribuyó el frame mobile-card al proto) | sobrevive |
| **`bi`** | **cuántas cards se ven → visibilidad del render** | **🔴 CAE** |

**La regla que sale de acá, y reemplaza la verificación a mano:** una fila @1280 **sobrevive si su
motivo es sobre contenido**, y **cae si es sobre disposición o visibilidad**. El contenido no depende
del ancho de la referencia; cuántos elementos se ven, sí.

## 4. 🟠 C3-18 · el contador suma las **notas de corrección de vocabulario** como veredictos: 13 donde hay 11

Segunda corrección mía. La adenda anterior dice «**13 desvíos, no ≥3**». **13 es correcto en
veredictos y equivocado como trabajo.** El JSON del contador da 13 ocurrencias, y **dos traen
`"corregido": true`** en las líneas `:113` y `:120` del lote B — que están bajo el encabezado
`## Corrección de vocabulario 2026-09-28` y son **re-menciones** de `tablero` y `gastos`, ya contados
en `:23` y `:31`.

| unidad | cifra |
|---|---|
| ocurrencias de DESVÍO (lo que reporta el contador) | **13** |
| **sujetos con DESVÍO** (lo que es trabajo) | **11** |
| menos `bi`, falso positivo (§2) | **10 desvíos reales** |

**11 coincide exactamente con el triage de FE1** («triage de los 11 DESVÍO»): FE1 tenía el número
bien y el mío traía el doble conteo. El brazo `reclasif` del canario **ve** esas formas —por eso
aparecen— pero las **suma** en vez de deduplicar por sujeto. Dueño: planificación (`scripts/` suyo).

**Es la tercera vez en esta misma auditoría que la unidad rompe una cifra:** veredictos ≠ sujetos ≠
comparaciones · archivos ≠ pares (35 archivos son **6** pares completos) · y ahora menciones ≠
sujetos. Deja de ser un desliz: **cada cifra declara su unidad o no se cita.**

## 5. La clase que vale más que el caso: **nadie audita un COHERENTE**

La salvedad del Rail —«la captura quedó parcialmente tapada… si hace falta certeza total,
recapturar»— está escrita en `bi` (**DESVÍO**, acusa) y **no** en `bi-refresh` (**COHERENTE**,
absuelve). Misma pantalla, mismo ancho, mismo método, misma corrida. Verifiqué mirando las dos
imágenes: **el Rail tapa idénticamente la misma columna en las dos.**

`bi-refresh` **sobrevive** —lo que afirma («Actualizando…» idéntico) está en la zona visible— pero
eso es suerte, no método. De los 9 COHERENTE del lote A, **2 están @1280** (`bi-refresh` y
`clientes`-listado, éste re-declarado por lectura de código): los dos sobreviven por razones
nombrables, y **nadie los había mirado hasta hoy**.

**El sesgo de revisión tiene dirección.** Se audita lo que acusa. Un falso DESVÍO cuesta una
recaptura y alguien lo encuentra al ir a arreglarlo; **un falso COHERENTE cierra un frente que
estaba roto y no deja rastro** — y es el veredicto que desactiva trabajo, o sea el que menos ojos
recibe y el que menos puede permitírselo.

**El fix estructural: una salvedad de captura es de la CORRIDA, no de la fila.** Se declara una vez
y se hereda a todas las filas que citan PNG de esa corrida; el que quiera exceptuar una, lo escribe.
Al revés no funciona, porque depende de que el autor sospeche justo en la fila correcta.

## 6. Filas que deja esta adenda

| fila | dueño |
|---|---|
| `bi`: recapturar sin Rail + reclasificar a COHERENTE | FE1 |
| marcar las 11 filas @1280 con `medido_contra: <archivo>@<ancho>x<alto>` | FE1 |
| C3-18: deduplicar por sujeto las notas de reclasificación en el contador | planificación |
| salvedad de captura heredada por corrida, no por fila | planificación (norma del registro) |
| cada cifra declara su unidad o no se cita | planificación (norma del registro) |

**delegación:** 0 sub-agentes · 14 lecturas inline (2 imágenes: `app-bi.png`, `app-bi-refresh.png`) ·
**scripts: 6 corridas** (IHDR de los 54 PNG · cruce fila↔ancho de las 20 filas · `contar-veredictos.py`
`--json` · 3 greps de código con control positivo) · 0 en background.

---

# SEGUNDA ADENDA (2026-09-29, tarde) — **C3-20 · C3-21 · C3-22**

Salieron de un ítem que parecía menor: *«46 ocurrencias `VOCABULARIO_DESCONOCIDO`; cuatro documentos
aportan 17 ids donde el 100% de los veredictos cae ahí — vocabulario de triage, no del criterio 3»*.
La hipótesis era que esos cuatro documentos **no miden**. Uno de ellos era una medición mía real, y
tirar de ese hilo destapó un defecto del instrumento y dos problemas del padrón.

**La cifra no se mueve: 50 de 54.** Todo lo de abajo cambia la GARANTÍA, no el número — y lo cambia en
los dos sentidos: peor en lo que el instrumento podía detectar, mejor en la independencia.

## C3-20 🔴 · El contador perdía **15 de 199 filas** de tabla, por dos defectos que se encadenan

Medido sobre el corpus completo (`42f1468b`), 16 de 16 documentos declarados medición:

```
FILAS DE TABLA examinadas: 199 de 199
PIERDEN un veredicto del VOCABULARIO CERRADO: 15   (emoji 9 · reversed 6)

  matriz-web-re-medida  (FE1, 22/09)  4  COHERENTE  bi · apar · soporte · factura
  C3-poblacion-C        (FE2, 29/09)  5  DESVÍO     card · card-cliente · card-cobro · card-presu · caida
  poblacion-A-medida    (auditoría)   3  DESVÍO     comousar · esc · soporte
  BLOQUE-A              (auditoría)   2  (son CITAS de veredictos ajenos: NO se recuperan)
  BL-Q3-v2-lote-B       (FE2, 28/09)  1  COHERENTE  onb-promesa
```

**Causa 1 — `limpiar()` enumera la decoración conocida en vez de definir la clase**
(`scripts/evidencia/contar-veredictos.py:167`). Saca backticks y asteriscos; el `re.match` está
**anclado** al inicio de la celda, así que `🔴 **DESVÍO**` → `🔴 DESVÍO` → **sin match**. Su propio
docstring ya nombra la clase — «cada patrón fallaba por UN carácter y perdía la medición sin dar
hueco» — y el fix de entonces **agregó dos caracteres a la lista y dejó la clase abierta**.
Verificado sobre 6 de 6 formas de celda: `**DESVÍO**` matchea, `🔴 **DESVÍO**` no.

**Causa 2 — `reversed(celdas)` + `break`** (`:518-524`): se toma la primera celda que matchea
recorriendo **de derecha a izquierda**, de modo que cualquier columna a la derecha del veredicto lo
tapa. La matriz de FE1 es `| Pantalla | Veredicto | Diferencias | Resolución | Capturas |`: ganaba
`Resolución` («H-A4-3 confirmado desplegado…»).

**Y la composición es lo que lo hace mudo.** Sin la causa 2, el emoji habría producido
`SIN_VEREDICTO_PARSEABLE` — un **hueco visible, que el reporte ya imprime**. La columna de la derecha
**rellena el hueco con un token falso** (`SIN_REFERENCIA`, `REQUIERE_TRIAGE`, `H-A4-3…`) y lo apaga.
Dos defectos que por separado se delatan; juntos, silencio limpio.

### Lo que esto invalida del ítem original, y es lo incómodo

**`poblacion-A-medida` SÍ es una medición.** Su tabla tiene `DESVÍO` ×3 — vocabulario **cerrado**, no
de triage — y aporta 0 porque el parser no los lee. **El «100% de veredictos desconocidos» de ese
documento era un síntoma del bug, no una propiedad del documento.** Clasificarlo `NO_SON_MEDICION` por
ese motivo habría grabado una razón falsa en la lista, y con ella la falsa validación del gate nuevo.

### C3-20.bis · el gate nuevo mide el síntoma del bug, no el rol

El gate «MEDICIÓN QUE NO MIDE» (exit 9) acusa a *una medición declarada que aporta cero ids con
veredicto del vocabulario cerrado*. **Ese cero es, palabra por palabra, lo que produce la causa 1.**
Corrido antes del fix acusa a `poblacion-A-medida`, que mide 5 ids con evidencia por fila. Un gate
cuyo predicado es el síntoma de un bug abierto **convierte el bug en veredicto de rol**, y el veredicto
sobrevive al fix. Remedio: correrlo después del fix, o partir el predicado — «0 cerrados **y** ningún
token del vocabulario en ninguna celda» es rol; «0 cerrados **pero** hay tokens en el texto» es defecto
de lectura, con otro exit y otro mensaje.

**Y la dependencia de orden tiene espejo:** arreglar el parser **sin** excluir antes a los analíticos
hace lo contrario — los `COHERENTE` que `BLOQUE-A` **cita** de FE2 empezarían a contar como mediciones
propias. **Excluir primero, arreglar después.**

## C3-21 🔴 · El defecto no costaba cobertura: **silenciaba los CONFLICTOS entre veredictos**

Éste es el hallazgo de más valor de la jornada, y refuta el reparto de culpas de mi propia adenda
anterior sobre `bi`.

`cerrado/2026-09-22/…matriz-web-re-medida.md:75-76` declara, seis días **antes** del `DESVÍO`:

```
| `bi`         | COHERENTE | H-A4-3 confirmado desplegado. Recapturado con espera real a datos
|              |           | (`page.waitForFunction`, no el wait insuficiente de 500ms) …
| `bi-refresh` | COHERENTE | … estructura idéntica al proto (Saldo en caja, …)
```

Contra el **mismo prototipo** (`54fac3ea`, capturas `-proto.png`). **Dos veredictos opuestos sobre la
misma pantalla, y el instrumento no podía exhibirlos juntos porque no leía uno de los dos.**

Mi falso positivo de `bi` costó una investigación de imágenes + código. **Con los dos veredictos
visibles se cazaba con un cruce de dos líneas.** Y lo cacé sólo porque el contrato me obliga a exigir
más evidencia al veredicto que desactiva trabajo; nada en el instrumento apuntaba ahí.

**La reformulación que importa:** un parser de veredictos se lee como instrumento de **cobertura**
(«¿cuántos ids están medidos?») y así se lo audita. Pero su función más valiosa es de **CONTRASTE**: es
lo único capaz de exhibir dos veredictos incompatibles sobre el mismo sujeto — y el contraste es donde
vive el **falso COHERENTE**, el veredicto que desactiva trabajo y que nadie audita. Un veredicto
perdido no cuesta cobertura: **cuesta la capacidad de detectar el error de juicio.**

**Fila concreta, y es la de mayor rendimiento del criterio 3:** un contraste `id → veredictos` que
liste todo id con veredictos incompatibles entre documentos. Barato (ya está el JSON), y es el único
control que puede cazar un falso verde.

## C3-22 🟠 · El padrón suma **dos preguntas distintas** bajo el mismo vocabulario

Al cruzar los veredictos recuperados aparecieron dos ids con COHERENTE de un lado y DESVÍO del otro
**sobre el mismo hecho**:

| id | FE1 · 22/09 · web | auditoría · 29/09 · teléfono |
|---|---|---|
| `soporte` | **COHERENTE** — «título "Soporte técnico" (ya no "Soporte de Odobi")» | **DESVÍO** — «app "Soporte técnico" vs proto "Soporte de Odobi"» |
| `comousar` | **COHERENTE** — «mismos 5 ítems, mismos títulos y subtítulos» | **DESVÍO** — «el proto numera 1-5 con chevron; la app usa tarjetas sueltas» |

**Las dos mediciones observaron lo mismo y lo nombraron distinto.** La columna `Resolución` de FE1 da
la clave: su pregunta era *¿el hallazgo H-A4-4 quedó resuelto y desplegado?*; la mía, *¿coincide con el
prototipo?*. Dos preguntas legítimas, **un solo token** (`COHERENTE`), sumadas en el mismo padrón. Se
agrega una segunda capa: el mismo id nombra **superficies distintas** (web de un lado, teléfono del
otro) sin que ninguna fila lo declare.

**Consecuencia sobre la cifra:** el 50 de 54 responde «¿este id tiene un veredicto?», **no** «¿este id
coincide con el prototipo?». Son dos afirmaciones distintas y hasta hoy se leían como una. Queda
pendiente de FE1 confirmar cuál era su pregunta — es una línea, y cierra C3-22 sin re-medir nada.

## Lo que NO se movió, verificado por vía nueva

| control | resultado |
|---|---|
| **la cifra** | **50 de 54**. Los ids de las 15 filas tapadas ∩ los 4 sin veredicto (`grabando`,`pres-voz`,`vozchat`,`(home)`) = **VACÍA, 0 de 4** |
| **aporte de los 4 documentos de rol dudoso** | **0 ids exclusivos cada uno** → clasificarlos de cualquier modo no toca la cifra |
| **independencia** | **mejora: 20 → 17** ids que dependen de un solo documento. `apar` 1→2 · `caida` 1→2 · `soporte` 1→3 |

## Clasificación de los 4 documentos, con motivo escrito (uno por uno, no en bloque)

| documento | veredicto | motivo |
|---|---|---|
| `BLOQUE-A` (auditoría, 23/09) | **NO_SON_MEDICION** ✅ | su tabla pone el veredicto **de FE2 citado** en la col2 y el juicio propio (`REQUIERE_TRIAGE — no se sostiene`) en la col3. Re-evaluación de veredictos ajenos, misma clase que este dictamen |
| `delta-516` (auditoría, 21/09) | **NO_SON_MEDICION** ✅ | su tabla es `Qué / Al 16/09 / Al 21/09` — **delta de inventario del prototipo**; sus «ids» son conteos, no pantallas comparadas |
| `filas-nuevas-volver-e-ingresar` (planificación, 21/09) | **NO_SON_MEDICION** ✅ | es un **encargo** a FE1, vocabulario propio `AUSENTE`/`PARCIAL`. Verificado que no pierde nada: `volver`/`ingresar`/`ingresar-error` tienen **3 aportantes cada uno** |
| **`poblacion-A-medida`** (auditoría, 29/09) | **🔴 ES MEDICIÓN — no excluir** | mide 5 ids con evidencia por fila y **`DESVÍO` ×3 del vocabulario cerrado**. Su 0 es el bug del emoji (C3-20) |

## Corrección de una cifra propia, al mismo nivel en que la afirmé

En la primera adenda sostuve que mi dictamen «cita **54 de 54** ids del padrón», y de ahí que
clasificarlo como medición cerraría el criterio en 100% sin medir voz ni home. **Eran menciones con
backticks contadas a mano; medido con el padrón da 29, y veredictos atribuidos 12.** El hallazgo
estructural (un control de corroboración cruzada premia al documento que más cita) **se sostiene**; el
cálculo del daño **no**. Es la cuarta vez en el día que la unidad rompe una cifra mía — y esta vez
dentro del mensaje que corregía a otro por unidades.

## El cierre del eje, que es mejor que cualquiera de los dos controles

El control (a) de corroboración cruzada se retiró. Su reemplazo (cobertura >80%) se midió antes de
embarcarlo: **techo de menciones de una medición 29/54 vs. de un descartado 29/54 — empate literal**, un
gate que nunca dispararía. **Dos discriminantes estructurales opuestos, los dos inertes.** Eso no es
mala suerte: **el formato no codifica el rol.** Lo único que protege es la clasificación **declarada**
con motivo escrito y abort por documento sin clasificar, más el **vocabulario cerrado**, que neutraliza
a un analítico aunque esté mal clasificado. El empate quedó impreso en el reporte con la marca «NO es
un gate: no separa» — un callejón sin señalizar se recorre dos veces.

**delegación:** 0 sub-agentes · 9 lecturas inline · **scripts: 7 corridas** (control del `reversed`
sobre 199 filas · control del emoji sobre 6 formas de celda · barrido 199 filas × 16 docs con las dos
causas separadas · cruce ids-tapados ↔ 4 faltantes · independencia por id antes/después · aporte
exclusivo de los 4 dudosos · re-resolución por basename exacto) · 0 en background.
**Un error propio en el camino:** resolví un documento con `rglob`+`startswith` y medí
`matriz-web-re-medida-v2` creyendo que era `matriz-web-re-medida`; las 4 filas volvieron sin ids y casi
las descarté como ruido. Repetido con igualdad de basename salieron `bi`/`apar`/`soporte`/`factura` —
o sea C3-21 entero estuvo a un `startswith` de no existir.

---

## 🔴 CORRECCIÓN a C3-22 (misma fecha) — **eran DOS casos, no uno, y mi explicación absolvía de más**

FE1 contestó la pregunta de una línea mirando su propia celda fila por fila, y **partió C3-22 en dos**:

| id | qué resultó | evidencia que lo decide |
|---|---|---|
| `soporte` | ✅ **dos preguntas distintas**, como planteé | su celda del 22/09 dice textual: «el proto sigue mostrando "Soporte de Odobi"… es **mockup desactualizado** respecto al fix (**drift esperado, no bug**)». Su COHERENTE contestaba *¿se desplegó H-A4-4?* |
| `comousar` | 🔴 **NO es ese caso: misma pregunta, medición más superficial** | su COHERENTE del 22/09 decía sólo «mismos 5 ítems, mismos títulos y subtítulos» — miró **texto**, no layout ni la sección extra «LO QUE LE PODÉS PEDIR». Las dos preguntaban *¿coincide con el proto?*. **El DESVÍO del 29/09 gana; el COHERENTE queda superado** |

**Lo que estaba mal en mi C3-22:** metí los dos ids en la misma bolsa y ofrecí una sola explicación. Y
la explicación que elegí es la peligrosa: **«son dos preguntas distintas» ABSUELVE a los dos lados.**
Aplicada a un caso que en realidad es (b), **deja vivo un COHERENTE superado — o sea fabrica exactamente
el falso verde que este dictamen vino a cazar.** Es cómoda justamente porque no obliga a que nadie se
haya equivocado.

**La regla que sale, y es la que hay que usar al desempatar:** dos veredictos opuestos sobre el mismo
sujeto tienen **tres** resoluciones, no dos —

1. **dos preguntas distintas** → los dos son válidos y el padrón debe declarar cuál responde;
2. **misma pregunta, profundidades distintas** → gana el más profundo y el otro queda **superado**, no
   «vigente con otra pregunta»;
3. **uno está mal** → se corrige.

**Elegir (1) por defecto es el error**, porque es la única de las tres que no deja a nadie equivocado.
El discriminante es barato y siempre está disponible: **leer qué dice el motivo de cada lado que miró**,
no qué veredicto puso. `soporte` cita el proto y lo declara desactualizado a propósito → (1). `comousar`
cita ítems de texto contra un motivo que habla de layout y de una sección entera → (2).

**Y el corolario que corrige mi propia fila de trabajo:** en el tablero de 11 desvíos, `comousar` **no**
es un caso de vocabulario ni de referencia — **es un DESVÍO vigente**, con el COHERENTE del 22/09
superado. No hay nada que reconciliar ahí.

`bi` quedó **reclasificado a COHERENTE sin recaptura**, citando el código y la matriz del 22/09, con
`medido_contra: app=servido@b7fa0e23@1280x900 · proto=proto@54fac3ea@1280x900`. C3-21 cerrado del lado
de FE1.

**delegación:** 0 sub-agentes · 1 lectura inline (el `cierre_` de FE1) · scripts: 0 · 0 en background.

---

## C3-23 · El instrumento corrido sobre población A: **EXIT CODE 0** — y qué NO dice ese cero

Planificación pidió, textual, *«correr el instrumento sobre los 5 de población A (`apar comousar esc
factura soporte`) e incorporar su EXIT CODE al dictamen, no su texto»*. Corrido:

```
./scripts/evidencia/correr-criterio3.sh apar,comousar,esc,factura,soporte

EXIT REAL DEL GENERADOR: 0
EXIT CODE DEL INSTRUMENTO = 0
```

**Elementos examinados: 5 de 5 pedidos.** El log nombra los cinco (`· midiendo SOLO:
apar,comousar,esc,factura,soporte`) y emite una línea `→` por cada uno, así que el N pedido y el N medido
coinciden — el control que caza el caso del filtro que se ignora en silencio y cae al default
(`IDS=` en vez de `SOLO_IDS=`: el script mide 7 e informa con total normalidad). Acá el argumento va
posicional, que es el remedio ya horneado.

Las cuatro precondiciones salieron resueltas por el propio script, no a mano: `NODE_PATH`,
`CHROME_PATH`, `ENV_E2E` (apuntado, **su contenido no se imprime**) y el prototipo respondiendo
`HTTP 200`, más un control de concurrencia `8/8 pedidos sin cuelgue`. Es la razón por la que se pidió el
exit code: un `exit 2` habría significado «no pude medir» y es distinguible de «medí y no encontré nada».

### Por qué el pedido dice «el exit code, no el texto» — y por qué eso es lo correcto

Este exit `0` es una afirmación sobre **el instrumento**, no sobre **las pantallas**. Tres de los cinco
ids (`comousar`, `esc`, `soporte`) están hoy en `DESVÍO`, y el instrumento salió `0` igual: es un
generador de capturas, no un juez, así que su código de salida **es insensible al veredicto por
diseño**. Confundir los dos sujetos sería el error que este dictamen entero viene cazando — el mismo
molde del caso en que un `0` con control positivo verde contestaba sobre un rango equivocado.

Lo que el `0` sí habilita, y es exactamente lo que faltaba: **las capturas de población A no están
viciadas por una corrida fallida**, así que los tres `DESVÍO` de esos ids se sostienen sobre evidencia
producida por un instrumento que pudo mirar. Sin este cero, cada uno de esos tres veredictos tenía dos
causas suficientes —la pantalla difiere, o la captura salió mal— y el diferencial no atribuía.

Y el texto del log, que **no** entra al dictamen como veredicto, sí deja una precondición documentada que
vale registrar aparte, porque es una trampa de sujeto y no de medición: el id `factura` mide **el
listado, no el wizard**, y el wizard tiene **dos orígenes con UI distinta** (la pill «Nueva factura» abre
un borrador vacío; el chip «Completar a mano» del chat lo abre prellenado). Una fila que diga
«Facturación» sin decir cuál de los tres es, mide un sujeto ambiguo.

**delegación:** 0 sub-agentes · 1 lectura inline (el log del instrumento) · scripts: 1 corrida
(`correr-criterio3.sh`, 5 de 5 ids) · 1 en background.

---

## C3-24 🔴 **ALTA** · Ocho de los diez «conflictos» son contra **evidencia retirada**, y el formato no codifica la vigencia

Planificación agrupó 13 conflictos de veredicto, **10 bajo una sola hipótesis** (`HIPOTESIS_MATRIZ_2209`:
*todos COHERENTE en la matriz web del 22/09 y DESVÍO en los lotes posteriores*), y propuso un test de
falsación: re-medir **uno** a 390px y, si coincide con su COHERENTE, **cerrar los diez juntos**.

**El test no había que correrlo: la premisa es falsa para 8 de los 10.** Medido documento por documento,
sin recapturar una sola pantalla:

| id | barrido original 22/09 (`BL-Q3-web-barrido-35-pantallas`) | matriz RE-MEDIDA 22/09 (la vigente) |
|---|---|---|
| `card` · `card-cliente` · `card-cobro` · `card-presu` | **COHERENTE** | **REQUIRES_TRIAGE** — «+Nuevo» abre formulario en blanco vs card de revisión prellenada del proto |
| `preg` | **COHERENTE** | **INCOMPLETO — no verificado, no es hallazgo** (el script nunca tipeó la pregunta) |
| `esc` | **COHERENTE** «misma estructura de rail + tabs» | COHERENTE «misma grilla de 6 tiles» |
| `factura` | **COHERENTE** | una de las **4 que la auditoría refutó** |
| `ingresar` | **COHERENTE** | COHERENTE |
| `cuenta` · `detalle` | no aparecen | no aparecen |

Y la matriz re-medida **declara el retiro en su propio encabezado**, textual: *«Por contrato, eso invalida
como evidencia las 22 filas completas — no sólo las 4 muestreadas»*. Su resultado fue **13 de 22
confirmadas**.

**Entonces no hay diez conflictos de veredicto.** Hay ocho filas que comparan un `DESVÍO` vigente contra
un `COHERENTE` **que ya fue retirado como evidencia el mismo día en que se emitió** — y dos (`cuenta`,
`detalle`) que no tienen medición del 22/09 en ninguno de los dos documentos, así que su conflicto es
contra una fuente todavía sin ubicar.

### La raíz: tercera aparición de la misma clase, ahora sobre la VIGENCIA

El corpus contiene un documento **entero** cuyos veredictos están retirados, y **ninguna de sus 36 filas
lo dice**. Para cualquier parser son indistinguibles de las vigentes. La clasificación
`MEDICIONES_DECLARADAS` / `NO_SON_MEDICION` no lo cubre, y no por descuido: **el barrido original *era*
una medición** — sólo que ya no cuenta. Hace falta un tercer estado, `RETIRADO_POR: <doc>`, y que el
contraste excluya esas filas en vez de exhibirlas como conflicto.

Es la misma raíz que ya apareció dos veces hoy en dos sistemas sin relación: fundamento-vs-entregable en
`plan-drift-check.sh`, medir-vs-citar en `contar-veredictos.py`, **vigente-vs-retirado** acá.

### Y el orden vuelve a decidir, igual que con la exclusión de los analíticos

Si se arregla el contraste **antes** de marcar el retiro, las ocho filas se leen como «COHERENTE vs
DESVÍO» y la resolución cómoda —«son dos preguntas distintas»— **cierra las diez juntas**. Eso fabricaría
exactamente el falso verde que este eje vino a cazar, **sobre diez filas de una sola vez y con la firma
de una hipótesis validada**. Marcar el retiro primero; contrastar después.

### El único conflicto real de los diez, dirimido

**`esc`.** Sus dos COHERENTE afirman **presencia**: «misma estructura de rail + tabs» (original), «misma
grilla de 6 tiles de Funciones» (re-medición). La medición del 29/09 a 390px, con el instrumento en
verde, encontró:

- **el título difiere**: app «Funciones» vs proto «**Tus funciones**»;
- **el orden de la fila 1 del grid está invertido**: app `Facturación · Ingresos · Gastos`, proto
  `Gastos · Ingresos · Facturación` (la fila 2 coincide);
- la app pone chevron en «Actividad reciente»; el proto, no.

**Un orden invertido no lo produce una captura mala.** Es resolución (2) de las tres: misma pregunta,
profundidades distintas → gana el más profundo y el `COHERENTE` queda **superado**. `DESVÍO` vigente, sin
recaptura pendiente.

### La causa común existe, pero es la inversa de la supuesta — y es falsable leyendo, no midiendo

La hipótesis suponía que los `COHERENTE` eran correctos y los `DESVÍO` posteriores artefactos. Los motivos
dicen lo contrario: **el barrido del 22/09 verificó por PRESENCIA y CONTEO de elementos, nunca por ORDEN
ni por COPY exacto** — «misma estructura de rail + tabs», «misma grilla de 6 tiles», «mismo patrón»,
«mismo copy de ejemplos». Es el mismo mecanismo de `comousar`, que contó cinco ítems de texto y no miró
layout. Se comprueba leyendo los motivos de las 36 filas; no requiere una sola captura.

### El universo medible del instrumento: **17 ids, no 54**

`scripts/evidencia/criterio3-matriz.mjs:236` declara la tabla `CAMINO` con **17** ids —`afip agenda apar
bi bi-refresh comousar cuenta detalle entrada esc factura hitl ingresos negocio presu soporte splash`—
contra los **54** del padrón. De los diez de la hipótesis, sólo **cuatro** son medibles hoy (`cuenta`,
`detalle`, `esc`, `factura`); los cuatro `card-*`, `ingresar` y `preg` **no tienen camino declarado**.

Así que el test de falsación no podía cerrar a seis de los diez ni aun saliendo COHERENTE: **el
instrumento no puede verlos.** Verificado ejercitándolo: `correr-criterio3.sh ingresar,card` sale **exit
1** con «SIN CAMINO DECLARADO … esta corrida NO sirve como evidencia» — falla cerrado, no entrega una
medición inventada.

### Un vacío propio, cazado por el control positivo antes de publicarlo

La primera pasada de esta medición devolvió **«no aparece» para los diez ids** en el barrido original, y
la lectura natural era «ese documento no los tiene». El control positivo sobre ids que el encabezado de
la matriz garantiza que existen (`factura`, `bi`, `soporte`, `apar`) devolvió **también cero** — y ahí se
vio: el barrido original escribe los ids **sin backticks** (`| esc | COHERENTE |`), la matriz re-medida
**con** (`` | `esc` | COHERENTE | ``). Mi regex exigía backticks. Diez ceros falsos, con forma de
hallazgo. Sin el positivo en la misma corrida, este C3-24 se publicaba al revés.

**delegación:** 0 sub-agentes · 4 lecturas inline (los dos documentos del 22/09, mi población A, el
`cierre_` de planificación) · scripts: 2 corridas del instrumento (`apar,comousar,esc,factura,soporte` →
exit 0, 5 de 5; `ingresar,card` → exit 1 por diseño) + 1 medición de `CAMINO` (17 de 17 ids) · 2 en
background.

---

## C3-24-bis ⚠️ **Dos correcciones a C3-24 (son 5 de 10, no 8) y un hallazgo peor: una fila VIGENTE que se contradice a sí misma**

FE1 pidió verificar una cita antes de aceptar C3-24 y **tenía razón dos veces**: mi celda de `factura`
estaba mal, y cuando fui a refutarlo **medí el sujeto equivocado**. Va acá con la misma prominencia que el
hallazgo original, porque el «8 de 10» ya salió en el `cierre_` al buzón y en dos mensajes directos.

### Corrección 1 — el recuento: **5 de los 10**, no 8

Dije que `factura`, en la matriz vigente, era «una de las 4 que la auditoría refutó». **Falso.** La matriz
vigente, línea 81, le da `COHERENTE`: *«H-A4-5 confirmado desplegado y verificado visualmente con espera real
a datos: aterriza en el listado/resumen ("Facturado este mes", "Te deben", "ÚLTIMAS EMITIDAS" + botón "+
Nueva factura"), **no** en el wizard — coincide con el proto»*. Es del mismo bloque de fixes verificados que
`soporte`, escrito **después** de registrar las 4 con diferencias: **las 4 refutadas fueron el disparador de
la re-medición, no su resultado.** Confundí el motivo por el que un documento se escribió con el veredicto
que produjo.

| | ids | situación |
|---|---|---|
| **5** | `card` · `card-cliente` · `card-cobro` · `card-presu` · `preg` | `COHERENTE` **sólo** en el barrido retirado; en el vigente `REQUIRES_TRIAGE` (los 4) e `INCOMPLETO — no es hallazgo` (`preg`) → **conflicto contra evidencia retirada** |
| **3** | `esc` · `factura` · `ingresar` | `COHERENTE` **vigente** → se dirimen uno por uno |
| **2** | `cuenta` · `detalle` | sin medición del 22/09 en **ninguno** de los dos documentos → fuente sin ubicar |

**El mecanismo de C3-24 sobrevive entero y sigue 🔴 ALTA** —cinco filas comparan un `DESVÍO` vigente contra
un `COHERENTE` retirado el mismo día, y ninguna de las 36 filas del documento retirado lo dice—, igual que
la conclusión operativa: **los diez no se cierran juntos.** Lo que se cae es mi cifra.

**Y el sesgo vale nombrarlo: inflé la cifra en la dirección que hacía más fuerte mi propia tesis.** El «8 de
10» sostenía el hallazgo del documento retirado mejor que el «5 de 10». No lo verifiqué fila por fila.

### Corrección 2 — fui a refutar a FE1 y **medí el sujeto equivocado**

FE1 sospechaba que la fila 81 citaba un elemento inexistente. Fui a verificarlo y medí **la app**:
`SeccionMeDeben.tsx:87` → `<h2>Te deben</h2>`, presente en `origin/main`, creado el **2026-08-04**
(`c9cee1d0`, PR #258), declarado **sección FIJA** en `PantallaFacturacion.tsx:512`. Con eso iba a dar la
cita por legítima.

**La afirmación de FE1 era sobre el PROTO, no sobre la app** — y la fila dice, textual, «coincide con el
proto». Medido sobre el sujeto correcto, contra el mismo SHA que la matriz cita (`54fac3ea`):

| elemento que la fila 81 enumera como coincidencia | en el proto @`54fac3ea` |
|---|---|
| «Facturado este mes» | **1** archivo |
| «+ Nueva factura» | **4** archivos |
| «…emitidas» | **4** archivos |
| **«Te deben»** | **0** — **no existe** |

Control positivo dentro de la misma corrida: el instrumento **ve** el proto y encuentra los otros tres.
Así que el cero no es ceguera. **De los cuatro elementos que la fila enumera como coincidencia con el proto,
tres están y uno no.**

Es mi propia clase, y la nombró planificación antes que yo:
[[el-instrumento-fabrica-una-referencia-que-no-existe]]. Un `COHERENTE` que afirma coincidencia **sobre un
elemento ausente del lado de la referencia**, y cae del lado que importa: el veredicto que **desactiva**
trabajo.

### El veredicto de `factura`, que es mío y lo doy con el corte fino

**Se sostiene lo que la fila realmente midió; se cae la cláusula que extiende la afirmación.**

- Su pregunta es *«¿se desplegó H-A4-5 — aterriza en el listado y no en el wizard?»*. Para eso, «Te deben»
  **en la app** es evidencia válida y suficiente: el aterrizaje ocurrió. **Ese COHERENTE, sobre esa
  pregunta, queda en pie.**
- La cláusula **«coincide con el proto»** es **falsa para uno de los cuatro elementos que ella misma
  enumera**, y no se puede reparar con una recaptura: el elemento no está en la referencia. La fila afirma
  dos cosas y sólo una está medida.
- **Acción:** la fila se parte. Queda `COHERENTE` para *«fix H-A4-5 desplegado»* y se abre una fila nueva
  para *«¿el listado de facturación coincide con el proto?»*, que hoy **no tiene veredicto** — porque
  además mi medición de población A la dejó **NO MEDIBLE** por otra razón («las 2 filas de ÚLTIMAS EMITIDAS
  salen completamente vacías», app sin datos) y el COHERENTE del 22/09 dice explícitamente «con **espera
  real a datos**». Dos mediciones del mismo id con el tenant en estados distintos.

### Y esto responde la pregunta de diseño de planificación: **son DOS mecanismos, no uno**

Planificación preguntó si `RETIRADO_POR:` alcanza para una fila inválida dentro de un documento vigente. **No
alcanza, y la razón es dónde vive la invalidación:**

| | el barrido retirado | la fila 81 |
|---|---|---|
| ¿existe la invalidación? | **sí**, declarada en el encabezado de otro documento | **no existe en ninguna parte** |
| el problema es | **no viaja** a lo retirado | la fila **se contradice consigo misma** |
| lo resuelve | `RETIRADO_POR: <doc>` — un puntero que propaga algo que ya está escrito | **ningún estado**: hace falta un **control de contenido** que verifique que cada elemento citado existe **en los dos lados** |

Conclusión para el formato: **el estado de vigencia conviene por fila** (más granular no molesta y cubre
retiros parciales), **pero el segundo caso no es un problema de estado** — es un gate que compara las citas
contra la referencia. Y planificación tiene razón en que es **más grave**: el retiro al menos está declarado
en algún encabezado; esto no está declarado en ninguna parte, y sólo apareció porque alguien fue a leer la
celda.

### Lo que este par de correcciones enseña, y es el filo

**Las dos veces me corrigió el sujeto del dictamen leyendo su propia evidencia** — FE1 con el número de
línea, planificación con el lado de la comparación. Tercera vez hoy. Eso ya no es anécdota: **la señal más
barata para auditar un juez es preguntarle al juzgado cómo le fue**, y en este eje viene siendo más
productiva que mis propios controles.

Y el segundo error es peor que el primero, porque **fui a verificar con un control positivo bien puesto y
contesté sobre otro universo**: medir la app prueba que el elemento existe en el producto, no que exista en
la referencia. Un control positivo prueba la sensibilidad del instrumento, **nunca la pertinencia del
sujeto** — y acá el sujeto correcto estaba escrito en la propia celda («coincide con **el proto**»).

**delegación:** 0 sub-agentes · 3 lecturas inline (la fila 81, el módulo de facturación, el mensaje de FE1) ·
scripts: 0 · 8 mediciones `git` (`git grep` sobre `54fac3ea` y `git cat-file`/`log` sobre `origin/main`),
cada barrido con su control positivo y un negativo.

---

## C3-25 🔴 **ALTA — un falso verde PROBADO dentro del instrumento: el veredicto SUPERADO es el único legible. Y el recuento cierra en 2 de 10, después de decir 8, 5 y 0**

Esta adenda hace dos cosas: retira mi propio hallazgo central de C3-24 —que era falso por tercera
vez— y lo reemplaza por uno **medido con el módulo real del parser**, que es más grave y no es una
hipótesis. Va con la serie completa de mis cifras equivocadas, porque el patrón de por qué fallaron es
el dato más útil de todo el eje.

### 1. El falso verde, probado

Los dos documentos de frontend2 del 22/09 están **ambos** en `MEDICIONES_DECLARADAS`. Corriendo
`medir()` e `ids_del_criterio()` de `scripts/evidencia/contar-veredictos.py` importado como módulo
(read-only, sin modificarlo), con `universo_de_sujetos()` real = **54 ids**:

```
barrido f2 (COHERENTE, 02:11)   cuenta·único   -> ['COHERENTE']
barrido f2 (COHERENTE, 02:11)   detalle·único  -> ['COHERENTE']
re-medida f2 (posterior)        cuenta·único   -> ['VOCABULARIO_DESCONOCIDO']
re-medida f2 (posterior)        detalle·único  -> ['VOCABULARIO_DESCONOCIDO']
```

**El único veredicto legible para `cuenta` y `detalle` es el `COHERENTE` que una re-medición posterior
ya bajó.** Esa re-medición existe, es del mismo autor, y dice `REQUIERE_TRIAGE` con diferencias
concretas: *«Título "Cuenta" (app) vs "Mi cuenta" (proto). Falta el link "‹ Ajustes" que tiene el
proto. Falta subtítulo descriptivo»*. Para el instrumento que cuenta los COHERENTE, esa corrección
**no existe**.

> **Ningún defecto por separado produce esto.** Hacen falta los dos: que la sucesión entre documentos
> no esté declarada en ninguna parte, **y** que el estado con el que se corrige un COHERENTE no esté en
> el vocabulario que el parser admite. El primero deja vivo el veredicto viejo; el segundo enmudece el
> nuevo. El producto es un `COHERENTE` vigente, legible, contado, y **superado hace una semana**.

Esto es lo que este eje buscaba desde el principio, y estaba **adentro del instrumento**, no en las
filas: [[un-parser-que-pierde-veredictos-silencia-los-conflictos]] ·
[[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]].

### 2. Los tres defectos, cada uno con su canario diferencial

**H-1 · Una tabla de DOS columnas pierde todos sus veredictos, y no deja hueco.** La misma fila, con lo
único que cambia siendo el ancho de la tabla:

| entrada sintética | ids que el parser ve |
|---|---|
| 3 columnas, `` | `card` (gasto) | COHERENTE | foo.png | `` | `['card']` |
| **2 columnas**, `` | `card` (gasto) | COHERENTE | `` | **`[]`** |
| 2 columnas, id sin sufijo | `[]` |
| control positivo: `` `factura` `` a 3 columnas | `['factura']` |

En el corpus real el par existe y mide lo mismo por los dos lados:

| documento | pipes por fila | ids vistos | filas COHERENTE | celdas con backtick |
|---|---|---|---|---|
| `matriz-web-re-medida-v2.md` | 4 | **9** | 9 | 9 |
| `matriz-web-re-medida-v2-filas-3-a-6.md` | 3 | **0** | **7** | 7 |

Mismos ids, mismos veredictos, distinto ancho. **Daño real hoy: cero**, porque `v2` cubre esas 7 filas
con tres columnas. Es un fixture diferencial que el corpus regaló y que no se puede fabricar: dos
documentos que dicen lo mismo y sólo uno es legible.

**H-2 · Sin backticks se pierde todo igual** (`3 columnas, SIN backticks -> []`, porque `SUJ_CELDA`
—`contar-veredictos.py:546`— exige el backtick). Eso es el barrido de 35 pantallas: **0 celdas con
backtick, 22 filas COHERENTE, 0 ids reconocidos → INVISIBLE.** No llega a `candidatos`, así que el
guard de «documentos sin clasificar» —que sí existe y funciona— tampoco lo ve.

⚠️ **Y el matiz lo empeora en vez de salvarlo:** ese documento **está retirado como evidencia**, así que
no contarlo es el resultado *correcto*. **El parser acierta por accidente.** Una medición vigente
escrita sin backticks desaparece del mismo modo, y nadie lo va a notar, porque el único caso visible
hoy salió bien. Es [[un-gate-cuyo-predicado-es-el-sintoma-de-un-bug-abierto]] al revés: un defecto cuyo
síntoma actual es el comportamiento deseado.

**H-3 · `VOCABULARIO_DESCONOCIDO` no produce hueco, y eso está bien.** Medido: `sin(huecos)=[]` para los
tres tokens. El diseño es deliberado y está escrito en el código —«visible y MAL es peor que un
hueco»— y es la decisión correcta. **El defecto no es del parser: es del contrato §15.5.** El
vocabulario tiene 7 tokens (`COHERENTE`, `DESVÍO`, `DESVIO`, `NO_MEDIBLE`, `FUERA-DE-REFERENCIA`,
`NO_REPRODUCIBLE_SIN_EFECTO`, `PENDIENTE_DEVICE`) y ninguno cubre un estado que **dos autores usan en
6 archivos**, con la grafía partida por autor:

| grafía | archivos del buzón |
|---|---|
| `REQUIRES_TRIAGE` | 3 |
| `REQUIERE_TRIAGE` | 3 |
| `INCOMPLETO` | fuera del vocabulario también |

Un parser que elija una de las dos grafías pierde las filas del otro autor sin dar señal. La decisión
es de planificación, dueña del contrato: si es veredicto del criterio, entra con **grafía única**; si
no lo es, hay 10 filas del 22/09 que no son mediciones y conviene que lo digan. Lo que no puede
sostenerse es que **el estado con el que se corrige un COHERENTE sea ilegible para el instrumento que
cuenta los COHERENTE** — ahí nace §1.

### 3. El recuento definitivo, y las cuatro cifras que dije

| ids | COHERENTE viene de | estado de esa fuente | ¿es el mecanismo de C3-24? |
|---|---|---|---|
| `card` · `card-cliente` · `card-cobro` · `card-presu` · `preg` | `matriz-web-re-medida-v2` (+ el gemelo de 2 columnas) | **vigente** — `v2` existe *para* cerrar esas filas | **no** |
| `esc` · `factura` · `ingresar` | `matriz-web-re-medida` (f1) | **vigente** | **no** |
| **`cuenta` · `detalle`** | barrido pwa f2 (02:11) | **superado** por la re-medida f2, ilegible para el parser | **SÍ — 2 de 10** |

**8 de 10 tienen COHERENTE vigente. 2 de 10 comparan contra un veredicto superado.** La hipótesis de
planificación era **más sólida** de lo que dije, no menos: lo que cerró la fila fue el universo medible
de 17 de 54 ids, no mi hallazgo.

**Dije 8, después 5, después 0, y cierra en 2.** Las cuatro fallaron por lo mismo, y no por
razonamiento: **el universo de documentos**.

- **8 y 5** salieron de leer **2 de 6** documentos de medición del 22/09, elegidos **por el nombre del
  archivo** (mi filtro pedía «matriz-web-re-medida» o «barrido-35-pantallas»). Los `REQUIRES_TRIAGE`
  que cité como «el veredicto vigente» eran el estado **intermedio** que `v2` vino a cerrar — y el
  encabezado de `v2` lo dice solo: «consolida las 9 filas que el barrido original dejó "sin veredicto"».
- **0** salió de un cruce de 10 ids × 5 documentos cuyo patrón no matcheaba las celdas: **la primera
  columna no es el id**, es `` `detalle` (Mi día, tarjeta expandida) ``, `` `card` (gasto) ``,
  `` `afip` (Facturación ARCA) ``. Un grep por `` | `id` | `` da **falso cero con la fila delante**.
  Tercera forma distinta del mismo falso cero en un día: backticks a la mañana, nombre-de-archivo al
  mediodía, paréntesis-de-sufijo ahora. El `SUJ_CELDA` del parser lo maneja bien; el bug era mi grep.
- **2** es lo que queda cuando el universo es el corpus completo y el veredicto se lee con el módulo
  del parser en vez de con un grep propio.

### 4. El corpus no tiene índice, y por eso «el documento vigente» es una elección del lector

Medido sobre el buzón entero: **149 filas de veredicto en 34 archivos**, en `abierto/`, `en-curso/` y
`cerrado/<fecha>/`, de tres autores. Sólo del 22/09 hay **6 documentos de medición web**, con esta
cadena y **ninguna marca de sucesión en ningún lado**:

```
barrido BL-Q3 f1 (35 pantallas, 22 COHERENTE)  ← retirado por el siguiente, sus 36 filas no lo dicen
   └─ matriz-web-re-medida f1 (22 ids)          ← refuta 4, deja 9 sin veredicto
        ├─ matriz-web-re-medida-v2 f1 (9 ids)   ← cierra esas 9
        └─ ...-v2-filas-3-a-6 f1 (7 ids)        ← el detalle delegado, INVISIBLE (2 columnas)
barrido pwa f2 (7 pantallas ✅)                  ← superado por el siguiente, sin marca
   └─ matriz-web-re-medida f2 (7 ids)           ← baja 5 a REQUIERE_TRIAGE, ilegible para el parser
```

Elegí «el vigente» por tamaño y por parecido de nombre, y caí en el **del medio de una cadena**. Eso
corrige el remedio que propuse en C3-24-bis: **`RETIRADO_POR:` no alcanza, porque la mitad de los casos
no es un retiro total sino un cierre parcial de filas abiertas.** Necesita su par en el documento que
llega después — `SUPERSEDE:` / `CIERRA_FILAS_DE:` — declarado por quien escribe el nuevo, que es el
único que sabe a qué viene. Y sigue valiendo el orden: **marcar la sucesión primero, contrastar
después**.

La generalización de [[el-formato-no-codifica-el-rol-dos-discriminantes-opuestos-fallaron]] aguanta y se
endurece: no es sólo que el retirado no diga que lo retiraron. **Es que hay cuatro candidatos a
«vigente» y ninguno dice cuál manda.** Una cadena de versiones sin sucesión declarada no tiene un
documento vigente: tiene el que eligió el lector.

### 5. Lo que sobrevive de C3-24 y C3-24-bis, separado de lo que se cae

**Se cae:** «5 de 10 comparan un DESVÍO vigente contra un COHERENTE retirado» → son **2**, y no por
retiro sino por **sucesión ilegible**.

**Sobrevive, cada uno por su propia evidencia:**

1. El defecto de formato del barrido retirado es real y sigue justificando la marca por fila: está
   retirado y **ninguna de sus 36 filas lo dice**. Lo que ya no puede afirmar es que explique estos
   conflictos.
2. **La fila 81 (`factura`, «Te deben») queda reforzada** con mejor instrumento. Universo: los **19
   `.html`** del proto @`54fac3ea` (`prototipo/index.html` navegable + `mockups/` + `mapa-pantallas/`,
   excluidos `explorations/` y `audit/`), **7.687.291 chars** normalizados —tags removidos y entidades
   resueltas, para que un texto partido por markup no dé un falso ausente—, control positivo **3/3** y
   «Te deben» en **0**. Sobre todo el árbol: **21 archivos** lo contienen y **ninguno bajo
   `Prototipo frontend/`**. La partición de la fila queda igual.
3. El universo medible **17 de 54** y la partición de `factura`: intactos.

### 6. Dos cosas que este eje deja para otros, ya medidas

- **`CONFLIC2` cerrada, no reencuadrada.** `cuenta`/`detalle` **sí** están entre las 7 pantallas que
  frontend2 re-midió; no es «un barrido de estatus sin declarar». La re-medición ocurrió, el veredicto
  nuevo existe y el instrumento no lo lee. Es §1.
- **El guard de documentos sin clasificar funciona, y me cazó a mí.** `contar-veredictos.py` aborta con
  **exit 8** porque mi propio `cierre_` del buzón produce veredictos del criterio y no está clasificado.
  Es correcto: mi `cierre_` **cita** los 10 ids para dictaminar, no los mide, así que va a
  `NO_SON_MEDICION` con ese motivo. Sólo yo, como autor, puedo declararlo; se lo paso a planificación
  porque `scripts/` es suyo. [[el-guard-que-caza-a-su-propio-autor]].

**delegación:** 0 sub-agentes · 4 lecturas inline (los 4 documentos del 22/09 que faltaban) · **scripts:
5 corridas** — 3 probes propios contra el módulo real del parser (descubrimiento de 6 de 6 documentos ·
canario diferencial de columnas y vocabulario · el par superado/legible), 1 spike de citas contra el
proto con controles 3/3, 1 corrida de `correr-criterio3.sh ingresar` (exit 0). Cada corrida con su
control de denominador («N de N examinados»), y **los dos errores de universo de esta sesión los cazó ese
control, no una lectura**: el spike esperaba 2 documentos y encontró 5, y su umbral de archivos del proto
estaba calibrado contra el universo equivocado y **frenó bien igual** — un control de denominador mal
calibrado sirve porque su trabajo es discrepar, al revés de un control positivo, que mal calibrado da
verde y te deja pasar.
