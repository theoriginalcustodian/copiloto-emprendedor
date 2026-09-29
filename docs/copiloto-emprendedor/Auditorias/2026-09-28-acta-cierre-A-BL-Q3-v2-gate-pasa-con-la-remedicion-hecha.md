# Acta de **Cierre A** — BL-Q3 v2 (matriz de fidelidad app ↔ prototipo)

**Fecha:** 2026-09-28 · **Firma que la habilita:** el operador, mismo día, eligiendo explícitamente
**«re-medir las filas invalidadas ANTES de cerrar»** por sobre «cerrar con alcance declarado».
**Sesión que la escribe:** planificación. **Gate independiente:** auditoría (`wt-aud-criterio3`).
**Estado: ✅ CERRADO**, con tres frentes abiertos nombrados abajo, cada uno con dueño y disparador.

---

## 1 · Veredicto, y de dónde sale el número

**GATE DEL AGREGADO: ✅ PASA — 31 veredictos · 22 comparaciones reales · 0 huecos.**
> ⚠️ **Conteo corregido el mismo día: son 24 comparaciones, no 22** (DESVÍO 12 · COHERENTE 11 ·
> CORREGIDO 1). El número de arriba salió de un instrumento CIEGO a una tercera forma de registro —
> ver §7. El resto del acta (huecos, sellos, cajones) no cambia.

| lote | dueño | sha256 (12) | bytes | mtime | veredictos |
|---|---|---|---|---|---|
| A | frontend1 | `ccf510c5b9e4` | 20 752 | 11:50:24 | 19 |
| B | frontend2 | `2d89880c1478` | 20 643 | 12:21:53 | 12 |

Desglose de las comparaciones: **DESVÍO 12 · COHERENTE 11 · CORREGIDO 1** — 24, no 22 (§7: el
contador no leía las mediciones escritas en bullet). Los 9 restantes no son
comparación y están en su cajón declarado (`PENDIENTE_DEVICE` 2 · `NO_MEDIBLE` 2 ·
`FUERA-DE-REFERENCIA` 3 · `NO_REPRODUCIBLE_SIN_EFECTO` 2).

⚠️ **Todas las cifras se recomputaron desde los tokens de los documentos**, con sha256 y bytes de cada
uno — ninguna se copió de una cifra citada, tampoco de las de ayer. **Por eso el 31 no se compara
contra el 32 de ayer:** los dos documentos cambiaron hoy y los hashes lo prueban. Un agregado que cita
su propio conteo anterior mide el conteo, no los documentos.

**Ninguna fila tiene el veredicto mal.** Lo que falló fue la **etiqueta de procedencia** (11 filas) y el
**límite no declarado** (19 campos) — y las dos cosas se arreglan **re-etiquetando, no re-midiendo**.
La distinción importa: si el defecto hubiera sido de veredicto, el cierre no correspondía.

## 2 · Qué habilitó el cierre: la re-medición que el operador pidió, y el conteo que corregí

La firma decía «re-medir las 6 filas invalidadas». **El «6» era un conteo mío que nunca enumeré**, y el
primer paso fue producir la lista con una regla mecánica en vez de defender el número:

> *una fila queda invalidada si su `id` tiene más de un camino **Y** la fila no declara cuál usó.*

Aplicada por FE1 a los 16 ids `MULTI-PATH-UI-DISTINTA` del §3, uno por uno: **la lista da 1, no 6.**

| resultado | cuántos | detalle |
|---|---|---|
| **invalidada** | **1** | `chat` — y es de FE1, que la reportó contra sí misma |
| declara camino, OK | 7 | `card-factura` · `tablero` · `fact-cae` · `gastos` · `presu` · `clientes` (2 filas) |
| fuera del cruce | 7 | ya invalidadas desde §6, en otro frente |
| no aplica | 1 | `pres-voz` (`PENDIENTE_DEVICE`, sin veredicto de fidelidad) |

**No se ajustó a 6.** El 6 era un conteo sin lista; la lista da 1, y el número sale de la lista.
Ésta es la parte del cierre que la firma protegía: si se cerraba «con alcance declarado», el 6 quedaba
escrito como hecho y nadie iba a descubrir que ninguna de las otras 5 existía.

**La fila re-medida, y qué era realmente:** el veredicto de `chat` era correcto para el camino que FE1
midió. El defecto era **una frase que generalizaba sin medir** — *«múltiples puntos de entrada al chat
comparten esta misma UI»* — cuando el §8.3 del contrato dice lo contrario para uno de ellos: el camino
del buzón de pendientes **no** muestra el empty-state, **auto-envía** al montar
(`ChatScreen.tsx:69-72`) y aterriza con burbuja + streaming. Re-medida y partida:
`PARTIDO: camino-directo=COHERENTE · camino-buzón=COHERENTE`, los 3 orígenes reales de `dejarPendiente`
leídos en el archivo (`PreguntarInteligencia.tsx:20`, `AgendaScreen.tsx:98`,
`PantallaComoUsarLaApp.tsx:67`).

## 3 · El spec `medido_contra:` quedó cerrado — y lo cerró un ataque, no un acuerdo

El campo se ejercitó **en filas reales antes de repartir el backfill**, y rompió en tres puntos. Los
tres tienen fix en el contrato (`2026-09-28-contrato-BL-Q3-v2-…`, §15.2 / §15.2.bis / §15.2.ter):

| lo que rompió | dónde quedó resuelto |
|---|---|
| El spec **no es backfilleable**: `leido@` pedido para una pasada vieja devuelve aproximaciones presentadas como mediciones | **cuarta forma `reconstruido@<path>:<ultimo-commit>`**, marcada como reconstrucción, con su límite escrito (§15.2) |
| ¿El **camino de acceso** es eslabón? Dos lecturas defendibles con **4 días** de diferencia en la fila `negocio` | **NO lo es**, salvo que el `Motivo:` afirme algo sobre él. La columna `superficie` es un localizador, no parte de lo afirmado (§15.2.bis) |
| «La más vieja» entre dos commits **del mismo día** es indecidible con fecha sola (6 h 44 m de diferencia) | desempate por **hora** (`git log -1 --date=iso`) (§15.2.bis) |

**Rechazado a propósito:** el campo extra `camino_medido_contra:` que se propuso como alternativa. Un
campo obligatorio más para un dato que no sostiene ningún veredicto es ceremonia, y cada celda
obligatoria nueva es una celda que se llena de memoria.

### 3.bis · El hallazgo más caro del día, y no era de ninguna fila

`servido@<sha>` **no era una medición: era una inferencia** (hora del PNG cruzada contra el log de
`origin/main`). Falló, se midió, y el resultado es más interesante que el fallo:

- Hubo un **deploy a las 11:56:53 -03** en medio de dos lecturas del mismo bundle. Una dio 0
  ocurrencias del `placeholder="1500,50"`, la otra 1. **Las dos eran verdad: el sujeto se movió.**
  Ningún instrumento falló.
- Los 18 `servido@b7fa0e23` **aciertan por contenido** — las capturas son anteriores al deploy.
- ⚠️ **Pero aciertan por el CALENDARIO, no por el método.** Con el deploy a las 10:40, la misma
  inferencia escribía un SHA con 2 commits que la captura no mostraba, **sin un solo síntoma**.

**Un campo correcto por suerte es indistinguible de uno correcto por medición, y esa
indistinguibilidad ES el defecto** — no el riesgo residual. Corolario que queda como regla: *«la fila
coincide» no valida el método que la escribió.*

**Los 19 `servido@` NO se re-miden, y no por costo: ya no se puede.** Los tres testigos posibles están
destruidos o se declaran insuficientes — el bundle fue reemplazado (11:57:13), el manifiesto
sobreescrito (11:56:53), y aun conservándolo su propia `nota` declara que `apps/copiloto-web` no es
identificable por SHA. Quedan con el límite escrito en el contrato.

## 4 · Lo que este acta **NO** cierra — con dueño y disparador, no como «pendientes»

| # | qué | dueño | disparador |
|---|---|---|---|
| **H1** | `DEPLOY-MANIFEST.json` es de **ranura única** (`deploy.sh:123`, `cat >`): cada deploy borra la identidad del anterior. Fix: `>>` + JSONL. DoD real = **dos deploys, dos identidades** | backend | ✅ cumplido — `pedido_` bajado |
| **H3** | 11 filas del lote B con `leido@` donde hubo reconstrucción → re-etiquetar a `reconstruido@`. **No re-medir** | frontend2 | ✅ cumplido — la 4ª forma ya está en el contrato |
| **BUILDSHA** | el marcador de build que convierte `servido@` de inferencia en lectura (`data-build-sha` + `/healthz`) | backend + frontend2 | ✅ cumplido — contrato bajado |
| **`pres-ciclo`** | el único `[ASSUMED_PENDING_VERIFY]` bloqueante | frontend2 | ✅ resuelto acá mismo, §5 |
| **2 filas** | `cobro-voz` y `fact-voz` (`PENDIENTE_DEVICE`) | frontend | device/EAS → **sprint siguiente** (decisión del operador) |
| **H2** | mi propio inventario §0 decía «marcador de build: NO EXISTE» | planificación | ✅ corregido el mismo día, §0.bis del contrato |

**H2 es mío y lo dejo escrito en el acta a propósito:** grepeé las cuatro grafías que esperaba
(`BUILD_SHA`, `GIT_SHA`, `VITE_BUILD`, `__BUILD`) y ninguna alcanza a `origin_main_sha`, que es el
nombre real del campo que `deploy.sh:107-120` ya escribía. **Busqué el nombre, no la función** — el
mismo modo de falla que el §3 de ese contrato existe para cazar en el instrumento, cometido por mí en
la versión humana. No invalida el contrato: cambia la orden de «inventar un marcador» a **«extender el
que hay»**.

## 5 · Decisión de cierre: `pres-ciclo` se **parte**, no se desempata

`pres-ciclo` tenía `medido_contra` **inescribible** porque dos superficies compiten por el id:
`HILOS['pres-ciclo']` (`index.html:3365-3371`, un hilo de chat) vs. los chips de lista `#presu`
(`:2088,2093,2098`). Nadie decidió cuál es la referencia, así que cualquier SHA ahí anotaría el
archivo, no la superficie.

> **Decisión (planificación): no elijo ganadora — la unidad de medición ya resuelve esto.** El §1 del
> contrato dice que la unidad es **`id` + camino**. Dos superficies que compiten por un id no son *una
> fila ambigua*: son **dos filas**, `pres-ciclo·hilo` y `pres-ciclo·chips`, cada una con su propia
> referencia de proto. Quien mida declara **cuál midió**; la otra queda como fila explícita sin medir,
> no como ambigüedad escondida en una celda.
>
> **No es un criterio nuevo:** es exactamente lo que FE2 ya hizo con `recibo` (dos caminos reales → dos
> filas) y lo que FE1 acabó de hacer con `chat`. Elegir una superficie «la más parecida» habría
> inventado una referencia; partir no inventa nada.
>
> **Y el corolario que vale como regla:** cuando `medido_contra` es **inescribible**, eso no es un
> problema del campo — **es el campo funcionando**. Está diciendo que la fila no tiene referencia
> decidida. Se destraba decidiendo la superficie, nunca rellenando la celda con el eslabón medible más
> cercano (que sería anotar un eslabón que no sostiene el veredicto: el defecto (b) de §15.2 con otra
> cara).

## 6 · Criterio de cierre binario — el que hace que este acta no envejezca en silencio

- [x] Gate del agregado corrido por una sesión que **no** midió ninguna fila → PASA, 0 huecos.
- [x] Cifras recomputadas desde los tokens, con sha256 + bytes de cada documento medido.
- [x] Las filas invalidadas **enumeradas** (no contadas) y las que calificaron, re-medidas.
- [x] El conteo que estaba mal (6) **corregido a lo que la lista da (1)**, sin ajustar la lista.
- [x] Único `[ASSUMED_PENDING_VERIFY]` bloqueante resuelto con decisión escrita (§5).
- [x] Cada frente abierto con **dueño + disparador**, y todos los disparadores cumplidos o diferidos
      por decisión explícita del operador (device).
- [x] Los límites que quedan (`servido@` como techo) **escritos en el contrato que se relee**, no en un
      mensaje que se lee una vez.

**Lo que este acta no afirma:** que la app coincida con el prototipo. Afirma que **24 comparaciones
están medidas y son auditables**, y 12 de ellas son DESVÍO — cada uno es trabajo de producto, no de
medición. Esa cola no entra acá.

---

## §7 · Corrección del conteo — mi instrumento leía dos formas y el lote registra TRES

FE1 reportó **12** DESVÍO y este acta decía **11**, en la **misma unidad** (mediciones). O sea: uno de
los dos estaba mal, y era el mío.

`scripts/evidencia/contar-veredictos.py` reconocía dos formas de registro — el campo `veredicto: X` y
la última celda de una fila de tabla. El lote B usa una **tercera**: la medición escrita en un bullet
de prosa (`«Medidos con evidencia nueva»` → `- **`gastos`** … Veredicto sin cambios (sólo
vocabulario): **DESVÍO**`). Ahí «Veredicto» y los dos puntos están separados por 31 caracteres de
texto, así que no matcheaba el patrón de campo; y la línea no empieza con `|`, así que tampoco
entraba por el de fila. **No daba HUECO: desaparecía.** Junto con `gastos` se perdían `ingresos` y
`presu` (COHERENTE), de ahí que también COHERENTE pase de 10 a 11.

**Lo que hay que mirar de esto no es el ±1.** Es que el **control positivo pasó**: verificaba
«≥ 10 filas en lote B», y las filas estaban ahí. Un control que confirma que el formato que el
instrumento **sí** mira sigue existiendo no dice absolutamente nada sobre un segundo formato que no
mira (`memoria/el-registro-vivia-en-tres-idiomas-y-el-lector-hablaba-uno.md`,
`memoria/instrumento-que-no-mira-nunca-falla.md`).

**Fix de raíz, no del número:** tercer brazo `bullet` en el contador + un control propio que cuenta
los bullets de identidad y **aborta** si hay bullets y ninguno rinde veredicto. Y ese control nació
condenando un brazo sano — desempaquetaba una lista de dicts como tuplas, así que leía `"forma"` (la
clave) en vez del valor y daba 0 siempre: falso rojo del propio control, corregido en el mismo commit
(`memoria/el-instrumento-tambien-CONDENA-no-solo-absuelve.md`).

**Medición vigente** (contador con los tres brazos, lote A `sha256:adf4c91324b7` · lote B
`sha256:70518ee78487`): lote A 8 DESVÍO + lote B 4 DESVÍO = **12** · COHERENTE 5 + 6 = **11** ·
CORREGIDO **1**.
