# Auditoría · el canario de `contar-veredictos.py` — el brazo que lleva el nombre del caso es el que lo pierde

**De:** AUDITORÍA (`wt-aud-criterio3`) · **2026-09-28** · **Encargo:** `pedido_planificacion-a-auditoria_cazar-la-CUARTA-forma-invisible-y-refutar-la-categoria-d`, frente 1.
**Consigna literal del pedido:** «rompé mi fix, no lo revises… contá los `id` primero, no los veredictos… si encontrás una cuarta forma **no la arregles**: reportá `path:línea` + la forma».
**Por eso acá no hay parches.** Cada hallazgo es una fila con causa raíz y dueño. El instrumento es de planificación.

---

## 0. Provenance — hay DOS instrumentos con el mismo nombre, y el pedido describe el que NO está en `main`

| versión | bytes / líneas | formas que declara | ¿brazo `bullet`? |
|---|---|---|---|
| `origin/main:scripts/evidencia/contar-veredictos.py` | **6 511** / 135 | `campo` · `tabla` · `tabla-partida` · `hueco` | ❌ **no** |
| `docs/registro-a5-y-memoria:` (idem path) | 8 757 / 168 | idem **+ `bullet`** | ✅ sí |

Medido con `git show <ref>:<path>` y **control positivo del grep** (la palabra `veredicto`: 18 hits;
`"tabla"`: 1 hit) — el primer intento dio `0` en el control y por eso **no se usó**: un `0` con el
control en `0` mide el patrón, no el archivo. Último commit del archivo en `main`: `e8fe864f` (hoy).

**Consecuencia medida:** con la versión de `main`, lote B pierde además `gastos`/`ingresos`/`presu`
(líneas 31-33, forma `bullet`): 29 hits contra 32. **El fix del tercer brazo vive sólo en rama.**

**Sujetos medidos** (los dos lotes vivos, `coordinacion/abierto/`):

| lote | sha256_12 | bytes | líneas |
|---|---|---|---|
| A — `…BL-Q3-v2-lote-A-14-filas-mas-2-pendiente-device.md` | `3cb430041601` | 24 693 | 335 |
| B — `…BL-Q3-v2-lote-B-11-de-11-completo.md` | `70518ee78487` | 21 945 | 121 |

Ambos sha coinciden con los que el propio script imprime en su `sello()` — doble confirmación.

---

## 1. Lo que el instrumento REPORTA contra lo que LEE

Recomputado desde el `--json` de la corrida real, no citado de ninguna cifra previa.

| lote | `veredictos_total` que reporta | veredictos realmente parseados | huecos **falsos** | huecos reales | mediciones **invisibles** (sin hueco) | mediciones humanas |
|---|---|---|---|---|---|---|
| A | **20** | 19 | 1 | 0 | 6 | 25 |
| B | **32** | 13 | 18 | 1 (oculta **2**) | 7 | 20 |
| **total** | **52** | **32** (31 con valor correcto) | **19** | 1 | **13** | **45** |

Formas por lote, del `--json`: A = `{campo:17, tabla:2, hueco:1}` · B = `{tabla:10, bullet:3, hueco:19}`.

**Unidad declarada** (este proyecto ya pagó omitirla): la fila es una **medición** `id+camino[+dimensión]`.
En tokens de `id` distintos son 37, de los cuales 8 tienen al menos una medición invisible.

---

## 2. H-A · ALTA — el brazo `tabla-partida` **nunca disparó**, y su caso de activación vuelve como `hueco`

`contar-veredictos.py:85` (3 brazos) · `:70` (`origin/main`, patrón idéntico):

```python
partidos = re.findall(r"(?:contenido|componente|ambas)\s*:\s*\*{0,2}([A-ZÁÉÍÓÚÑ_\-]{3,})", c)
```

La celda real que ese brazo existe para leer — lote B, **línea 18**, `onb-promesa`, última celda:

```
`contenido`: COHERENTE · `componente`: FUERA-DE-REFERENCIA
```

**La etiqueta viene en backticks.** El patrón pide `contenido\s*:` y el backtick de cierre no es `\s`:
falla por **un carácter**. Probado contra la celda literal:

| patrón | resultado |
|---|---|
| el vigente | `[]` ⇒ no llega a `len>=2`, cae al fallback `hueco` |
| con `` `? `` alrededor de la etiqueta | `['COHERENTE', 'FUERA-DE-REFERENCIA']` |
| control **negativo** del patrón propuesto, sobre una celda simple (`COHERENTE`) | `[]` — la toma el brazo `tabla`, no inventa |

**`tabla-partida` aparece 0 veces en los dos lotes.** No hay ningún control que exija que ese brazo
dispare, así que su silencio total nunca fue síntoma: es el guard que falla abierto exactamente en su
caso de activación (`memoria/el-guard-falla-abierto-en-su-caso-de-activacion.md`), aplicado a un parser.
**Pierde 2 veredictos** y los convierte en 1 hueco.

---

## 3. H-B · ALTA — el fallback `hueco` sustituye **1-a-1** al veredicto, y el total cuenta los dos ⇒ el brazo `tabla` es invisible para TODO control

`:95-96` appendea `(n, "SIN_VEREDICTO_PARSEABLE", "hueco")` a la **misma** lista cuyo largo es la
métrica del control: `veredictos_total = len(hits)`. Un veredicto perdido no baja el total: lo reemplaza.

**Canario** — se sustituye el regex de UN brazo por `r"(ZZNOMATCHZZ)"`, con `assert` de que el patrón
aparece exactamente una vez antes de escribir (si el parche no aplica, aborta en vez de engañar):

| brazo roto a propósito | exit | totales | ¿algún control lo caza? |
|---|---|---|---|
| — (C0, intacto) | 1 ⚠️ | A=20 · B=32 | — (ver H-G) |
| `campo` | **3** | A=**3** | sólo el agregado (`a < 15`), por casualidad del tamaño del lote |
| `bullet` | **4** | — | ✅ **sí, control propio** (`if bullets and rinden == 0`) |
| **`tabla`** | **1** | **A=20 · B=32 — idénticos a C0** | ❌ **ninguno** |

El caso `bullet` es además **el control positivo del método**: prueba que los parches del canario surten
efecto, así que el «nada cambió» del brazo `tabla` no es un canario que no llegó a inyectarse.

**Raíz, no parche:** el control se agregó para el brazo que acababa de fallar (`bullet`) y los otros
dos quedaron bajo el agregado, que es insuficiente. **Cada brazo necesita su propio control positivo**;
y mientras `hueco` viva dentro de `hits`, ningún total puede detectar una pérdida.

---

## 4. H-C · ALTA — **19 de los 20 huecos son fabricados por el instrumento**, no están en los documentos

Volcadas las líneas que el contador reporta como hueco:

| lote · línea | qué es realmente | ¿hueco real? |
|---|---|---|
| A · 28 | `| id | veredicto | causa |` — **encabezado** de la tabla §3 | ❌ falso |
| B · 15 | `| id | camino | … | veredicto |` — **encabezado** de la tabla principal | ❌ falso |
| B · 18 | la fila partida de H-A | ✅ **real** (oculta 2 veredictos) |
| B · 66 | `| id (· camino) | tipo | medido_contra |` — **encabezado** de la tabla `medido_contra` | ❌ falso |
| B · 68-83 | las **16 filas** de esa tabla, que **no tiene columna de veredicto** | ❌ falsos |

Cualquiera que lea esos 19 huecos como hallazgos contra FE1/FE2 estaría levantando **19 acusaciones
inventadas por el parser**, 16 de ellas contra la tabla `medido_contra` que el backfill creó hoy.

⚠️ **Es exactamente la clase que arreglé de raíz en mi propio parser esta mañana** (mis 20 huecos
auto-infligidos, §1.bis del doc del gate): la solución fue **rastrear si el encabezado de la tabla
declara columna de veredicto** y no evaluar filas de tablas que no la tienen. `contar-veredictos.py`
no tiene ese estado. Mismo defecto, dos instrumentos, un solo fix conocido —
`memoria/el-fix-ya-existe-en-otro-call-site.md`.

---

## 5. H-D · MEDIA — `hablar` captura un valor **que no existe en el vocabulario**: `CORREGIDO`

Lote B, **línea 27**, última celda:

```
**CORREGIDO — COHERENTE (era DIFERENCIA GRAVE el 22/09, obsoleto por cambio de código)**
```

`:90` toma la primera palabra en mayúsculas ⇒ registra `CORREGIDO` como veredicto y lo mete en
`por_clase`. **No es invisible: es visible y mal**, y por eso es peor que un hueco — pasa todos los
controles, suma al total y agrega una clase inexistente al vocabulario. El veredicto humano es
`COHERENTE`.

---

## 6. H-E · MEDIA — 13 mediciones invisibles **que no dejan hueco** (no son filas de tabla)

El fallback sólo cubre filas de tabla; fuera de ahí la medición desaparece sin rastro.

| lote · línea | id (camino/dimensión) | forma que el instrumento no lee |
|---|---|---|
| A · 46 | `agenda` A ·contenido y ·componente | prosa `**PARTIDO (…): contenido=NO_MEDIBLE · componente=NO_MEDIBLE**` (usa `=`, no `:`) |
| A · 72-73 | `agenda` B ·contenido y ·componente | idem prosa `=` |
| A · 106 | `apps` · `AppsScreen` | reclasificación `**Q3RECL: reclasificado de NO_MEDIBLE → FUERA-DE-REFERENCIA**` |
| A · 215 | `chat` · camino-buzón | prosa `=` **dentro de backticks** |
| B · 35 | `recibo` camino-chat ·componente | bullet anidado, etiqueta multi-palabra (`**camino chat**`); **la palabra «veredicto» no aparece en la línea** |
| B · 36 | `recibo` camino-onboarding | bullet anidado + `Veredicto:` **con mayúscula** — el brazo `campo` es case-sensitive |
| B · 104 | `grabando`, `pres-voz`, `vozchat` | **tres ids en una línea**, lista compacta sin bullet |

**Hay un patrón, y no es «faltan formas»:** las mediciones que se pierden son casi todas las
**PARTIDAS por dimensión** y las **reclasificadas** — es decir, las que el propio protocolo Q3RECL
introdujo. El instrumento leyó bien el formato original y quedó ciego a las dos operaciones nuevas.

---

## 7. H-F · ALTA (proceso) — dos fixes de planificación viven sólo en rama

| fix | dónde está | qué falta |
|---|---|---|
| tercer brazo `bullet` de `contar-veredictos.py` | `docs/registro-a5-y-memoria` | no está en `origin/main` (medido en §0) |
| `ci-verde.sh`: `NO VERDE` → `ROJO` (el positivo era **substring** del negativo) | rama | `origin/main:75` sigue diciendo `NO VERDE`; 0 commits al archivo hoy |

Mientras no lleguen a `main`, cualquier sesión que use el instrumento **desde `main`** mide con la
versión vieja. No es una fila de contenido: es el eslabón de entrega.

---

## 8. H-G · MEDIA — el exit code de este script **no es donde se lee su veredicto**

C0 **intacto** sale **exit 1** por `UnicodeEncodeError: 'charmap' codec` al imprimir el ⚠️ del reporte
en una consola cp1252 — *después* de que todos los controles pasaron. Con `PYTHONIOENCODING=utf-8`
sale 0. Es el espejo de `ci-verde.sh`, que miente en el texto y dice la verdad en el exit: **cuál de
los dos es autoritativo no es universal, se mide por instrumento**
(`memoria/el-pipe-se-come-el-exit-code.md`,
`memoria/dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una.md`).

---

## 8.bis H-H · MEDIA — el MISMO patrón en `ci-verde.sh`: un número de PR equivocado es indistinguible de un CI rojo

Salió solo al usar el gate para mergear este PR, así que va con la evidencia de la corrida.

Su contrato, `scripts/ci-verde.sh:24-26`: «exit 0 = verde · exit 1 = NO verde (falta alguno o alguno
falló) · **exit 2 = no se pudo medir**», con la razón escrita: «sin esta guarda, `gh` ausente da un
error indistinguible de un rollup vacío, y NO-VERDE por falta de herramienta se confunde con NO-VERDE
real». **El diagnóstico está bien hecho y aplicado a la mitad de los casos.**

| caso | línea | exit que da | exit que el contrato pide |
|---|---|---|---|
| `gh` no está en el PATH | `:30` | **2** ✅ | 2 |
| **no se pudo leer el rollup** («¿número correcto? ¿gh autenticado?») | `:36` | **1** ❌ | **2** |
| algún job IN_PROGRESS | `:57` | 1 ✅ | 1 — «falta alguno» está **explícitamente** en el contrato, no es hallazgo |

**Canario, con sus dos controles:**

```
ci-verde.sh 999999  → EXIT 1   «no pude leer el rollup del PR 999999 (¿número correcto?…)»
ci-verde.sh 701     → EXIT 1   (control POSITIVO: un PR real, corriendo)   ⇒ indistinguibles
:30 gh ausente      → EXIT 2   (control NEGATIVO: el concepto existe y funciona en su otro caso)
```

**Efecto:** un typo en el número de PR se lee como «el CI está rojo» y manda a buscar un fallo que no
existe; en la dirección peligrosa, entrena a descontar el exit 1. **Es fail-closed, así que no puede
mergear nada indebido** — por eso es MEDIA y no ALTA.

**Y la forma es la de H-B, otra vez:** la guarda se escribió para el caso que ya había quemado (`gh`
ausente) y el caso hermano quedó con el comportamiento viejo. Dos instrumentos distintos, el mismo día,
el mismo patrón: **un control por-incidente no cubre a sus hermanos**; hay que enumerar los casos de la
clase, no parchear el que dolió.

---

## 9. Veredicto del frente 1

**El instrumento NO alcanza como control del lote.** Reporta 52 veredictos y lee 32, de los cuales 31
con el valor correcto; fabrica 19 huecos y deja 13 mediciones sin ver, con un brazo que nunca disparó.

**Y el hallazgo que importa más que la cuarta forma:** un fallback que sustituye 1-a-1 al valor que no
pudo leer, dentro de la colección cuyo largo es la métrica del control, **hace que el control sea ciego
por construcción** — no por un caso borde. Eso vale para cualquier contador de este repo, no sólo éste.

**No abrí trabajo nuevo.** Los 8 hallazgos son filas para que planificación asigne; el fix es del dueño
del instrumento, por pedido explícito de que el cazador y el que parchea no sean el mismo.

---

## 10. Lo que NO pude medir (declarado, no omitido)

- El universo de `id` se construyó leyendo los dos documentos completos (~456 líneas) más greps
  dirigidos (`eredicto` case-insensitive, `PARTIDO`, `Q3RECL`), **no** con un extractor mecánico: los
  backticks del documento también envuelven paths, shas y selectores. Cubrimiento línea por línea
  verificado; exhaustividad matemática **no** certificada.
- Control negativo del método: el contador **nunca emite el nombre del id** (sólo `{línea, veredicto,
  forma}`), así que un grep por nombre de id contra su salida es inválido para *cualquier* id, real o
  inventado (probado con `zzz-id-inventado-9000` → 0). El único cruce válido es id → línea humana →
  ¿hay hit en esa línea?, y es el que se usó.
- Si `CORREGIDO` (H-D) rompe algún control en un escenario límite: sólo consta que aparece 1 vez en
  `por_clase` de la corrida real.
