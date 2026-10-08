# Arranque del sprint MOBILE — inventario hecho, para no empezar explorando

> **Fecha:** 2026-10-08 · **Baja:** PLANIFICACIÓN · **Estado:** listo para tomar.
> **Por qué existe:** `DEC-19` sacó los puntos **3** y **5** de `§13` del cierre beta y los pasó a
> este sprint. Una sesión que arranque leyendo «matriz mobile 13/54» tiene una **cifra**, no una
> cola: no sabe cuáles son los 41 que faltan ni con qué instrumento mirarlos. Este doc es ese
> inventario, medido hoy, con `path:línea`.
>
> **Esto NO declara el sprint abierto.** Lo abre el operador, igual que firma el cierre de la beta.

---

## §0 · Inventario de lo que YA existe (leer antes de escribir una línea)

| Instrumento | Qué da | Qué NO da |
|---|---|---|
| [`scripts/evidencia/criterio3-padron.sh`](../../scripts/evidencia/criterio3-padron.sh) | El **universo**: los 54 ids, sacados de la **spec**, no del generador (`--tsv` para alimentar otro script) | Nada de veredictos |
| [`scripts/evidencia/criterio3-cruce.sh`](../../scripts/evidencia/criterio3-cruce.sh) | El **cruce** padrón × cierres, con las cuatro poblaciones disjuntas **y sus ids por nombre** | **No discrimina plataforma** — su único flag es `--tsv` (`:17`) |
| [`scripts/evidencia/contar-veredictos.py`](../../scripts/evidencia/contar-veredictos.py) | La **cifra por plataforma** (`VOCABULARIO_PLATAFORMA`, `:1292`) → hoy `web 54/54` · `mobile 13/54` | La **lista** de los ids que faltan en una plataforma |
| [`scripts/evidencia/criterio3-matriz.mjs`](../../scripts/evidencia/criterio3-matriz.mjs) | El generador que **sabe medir** 17 ids (`CAMINO`); default 7 | Los otros 37 — y por eso el padrón NO se saca de acá |

**Medido hoy** con `criterio3-cruce.sh` (unidad: *cualquier* plataforma, 54 ids de la spec, 2 cierres
leídos):

| población | n | ids |
|---|---|---|
| con veredicto en los cierres | **34** | `afip agenda ajustes apps bi bi-refresh bi-vacio bloqueado card-factura chat clientes cobro-voz consent cuenta detalle fact-cae fact-h…` |
| `PENDIENTE_DEVICE` declarado | **3** | `grabando` · `pres-voz` · `vozchat` |
| sin veredicto ni declaración | **17** | `(home) apar caida card card-cliente card-cobro card-presu comousar entrada esc factura hitl ingresar ingresar-error soporte splash v…` |
| medibles por el instrumento (se solapan) | 14 | `afip agenda apar bi bi-refresh comousar cuenta detalle esc factura ingresos negocio presu soporte` |

---

## 🔴 El hueco que hay que tapar PRIMERO, y no es una pantalla

**Los dos instrumentos no se cruzan en la unidad del criterio.** El que emite **lista con nombres**
(`criterio3-cruce.sh`) cuenta «con veredicto por cualquier vía» y **no mira plataforma**; el que
**sí** sabe de plataforma (`contar-veredictos.py`) emite **cifra**, no lista. Así que hoy la
pregunta *«¿cuáles 41 ids no tienen veredicto en mobile?»* **no tiene instrumento que la responda**,
y es literalmente la cola del sprint.

Es la clase de defecto que este repo ya pagó cuatro veces el 2026-07-21: **cada lado verifica su
mitad y la costura no es de nadie**. Acá la costura es la unidad de medida — y el síntoma es
engañoso, porque los dos scripts están *bien* y **ninguno falla**: simplemente contestan preguntas
distintas de la que el criterio hace.

**M-00 · DoD binario (y es precondición de todo lo demás):** `criterio3-cruce.sh` acepta
`--plataforma <web|mobile>` y, con `mobile`, emite las cuatro poblaciones **restringidas a los
veredictos cuya plataforma declarada incluye `mobile`**. Verde = la suma de poblaciones da 54, la de
«con veredicto» da **13** (o se explica por qué no, con el id en la mano), y corre un **control
positivo** que falle si el filtro no filtra (p. ej. `--plataforma web` tiene que dar 54, no 13).

> ⚠️ El filtro tiene una trampa ya documentada en el propio medidor (`:1329-1332`): hay celdas que
> dicen `ambas (mobile [ASSUMED_PENDING_VERIFY])`, y un lector ingenuo las cuenta como medición
> **limpia** de `mobile` porque `mobile` es el único token del vocabulario que aparece en la celda.
> El filtro de `M-00` tiene que **excluir** esas, y su test tiene que incluir una.

---

## La cola, después de `M-00`

| id | trabajo | dueño | DoD binario |
|---|---|---|---|
| **M-00** | `--plataforma` en el cruce (arriba) | quien arranque | la lista de los ids que faltan en `mobile`, con control positivo |
| **M-01** | Teléfono listo: dev-client instalado + Metro por USB | **BACKEND** (orden del operador, 22/09) | `adb devices` con el device y un bundle servido; **sin rebuild** |
| **M-02** | Medir en device los ids que `M-00` liste, por lotes | frontend | cada id con veredicto del **vocabulario cerrado** y su `medido_contra:` |
| **M-03** | Los 3 `PENDIENTE_DEVICE` ya declarados (`grabando`, `pres-voz`, `vozchat`) | frontend | idem, y salen de `PENDIENTE_DEVICE` |
| **M-04** | Punto **5** de `§13`: tester externo con video | operador + quien lo asista | el video existe y su hallazgo entra como fila, no como impresión |

**Recetas que ya existen y no hay que redescubrir** (son memoria del repo, no folklore):

- Iterar en device **no compila nada**: dev-client instalado + Metro local por USB →
  `memoria/iterar-en-device-es-metro-local-con-dev-client-ya-instalado.md`.
- El device **no corre `main`**, corre lo que Metro sirve → `memoria/el-device-no-corre-main-corre-lo-que-metro-sirve.md`.
- Gestos con `adb`: **`input motionevent` DOWN/MOVE/UP**, nunca `input tap`; y `uiautomator dump`
  miente con animación → `memoria/adb-no-puede-ejercitar-el-toque-corto-de-un-gesture-pan.md`.
- El device exige **dueño único**: dos ADB fabrican evidencia falsa →
  `memoria/device-fisico-exige-dueno-unico.md`.
- El dev-server sirve el **checkout compartido**, no tu worktree →
  `memoria/metro-sirve-el-bundle-del-checkout-compartido-no-del-worktree.md`.
- Usuario de prueba canónico, a fuego: **`e2e-device@copiloto.test`** (prod tiene **un solo** email
  habilitado y el alta es fail-closed: sin invitación no entra nadie, ni por Google).

---

## Lo que NO entra en este sprint

- **El cierre de la beta.** Su criterio quedó satisfecho y medido sobre `4ca28551`
  ([`ALCANCE-CIERRE-BETA.md`](ALCANCE-CIERRE-BETA.md), bloque 🏁); lo que falta ahí es la **firma del
  operador**, y `DEC-19` dejó dicho que los puntos 3 y 5 **cambian de sprint, no de alcance**. Un
  hallazgo nuevo en mobile **no reabre** un punto cerrado (`DEC-18`).
- **Re-medir `web`.** Está en `54/54` y mergeado. Si alguien lo re-mide «por las dudas», eso es
  trabajo sin disparador.
