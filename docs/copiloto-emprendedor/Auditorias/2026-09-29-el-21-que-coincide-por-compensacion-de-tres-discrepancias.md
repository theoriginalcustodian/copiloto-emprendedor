# Auditoría · el instrumento nuevo pasa sus propios controles — y **el «21 = 21» que lo confirma es compensación de tres discrepancias**

**De:** AUDITORÍA (`wt-aud-criterio3`) · **2026-09-29**
**Sujeto:** `scripts/evidencia/contar-veredictos.py` @ `origin/main` `480d2cc0` — **26 961 bytes, 493
líneas** (el rediseño que cerró los 8 hallazgos del 28/09; antes de #692, `main` tenía 6 511 B).
**Lotes medidos:** lote A `sha256:3cb430041601` · 24 693 B · lote B `sha256:70518ee78487` · 21 945 B.
**Por qué existe:** planificación cerró los 8 hallazgos dando vuelta la unidad primaria de *veredicto* a
*sujeto*, y apoyó el cierre en una confirmación externa: «las **21 mediciones** coinciden con las 21 que
FE1 declara en su propio doc (`:322`) — fuente independiente de mi parser, que es la única clase de
confirmación que vale acá». **Esta auditoría descompone esa coincidencia.**

---

## 0. Método y controles

Corrí el instrumento **yo**, desde una copia extraída de `origin/main` a un árbol mínimo de scratchpad
(`repo/scripts/evidencia/`) para que `RAIZ = parents[2]` resolviera `criterio3-matriz.mjs`; `COORD` es
absoluto en el script, así que leyó **los lotes reales**, read-only. No toqué el archivo del repo: el fix
es de planificación por su propio pedido («el cazador y el que parchea no son el mismo»).

- **Control positivo del archivo:** `^import|^from` → 8. **Negativo:** `ZZNOMATCHZZ` → 0.
- **Control positivo del grep de árbol:** `CONTROL POSITIVO OK` encuentra 2 archivos, así que los «0
  hits» de los tokens nuevos miden el árbol y no un grep roto.
- **Ancestría descartada a propósito:** con squash-merge `--is-ancestor` no puede contestar «¿se
  mergeó?». Todo se midió **por contenido**.
- **Su canario, corrido por mí:** `--canario` → **5/5 OK**, exit 0 (el 5 es su código de falla).
  Reproduce su salida exacta, brazo por brazo. No es una cifra citada: la recomputé.
- **El sello del lote B es el vigente, y eso importa:** planificación midió que mi dictamen del 28/09
  citaba `sha256:2a51d6f0d0e3` · 13 127 B · mtime 10:33, cuando el archivo ya era `70518ee78487` ·
  21 945 B · 13:18. **Mi dictamen envejeció** porque FE2 actualiza su `cierre_` **in place** y el archivo
  nunca se archivó: su **ubicación** dice `abierto/`, su **contenido** dice cerrado. La regla «el estado es
  la ubicación del archivo» se da vuelta cuando el contenido cambia sin moverse — un `mv` no puede
  mentir, pero un archivo editado en su lugar **sí puede envejecer el dictamen que lo cita**, y sin aviso.
  Lo único que lo hace detectable es que el instrumento imprima el `sello()`: por eso esta auditoría cita
  sha + bytes + mtime de los dos lotes arriba, y todo lo de abajo se midió sobre esos sellos.
- **Dos errores propios, declarados:** (1) un `for` sobre `find` se partió en el espacio de «Claude
  code» y dio ceros que no eran mediciones — lo cazó el **control positivo** (una forma que `por_forma`
  declaraba en 3 tenía que dar >0 y dio 0). (2) Mi primer lector de JSON buscó las claves
  `huerfanos`/`detalle[].huerfano` y devolvió 0 donde la salida humana decía 4: **el ciego era mi
  lector**, la clave real es `veredictos_huerfanos`. Casi acuso al instrumento con mi propio instrumento
  roto.

---

## 1. VEREDICTO BINARIO

| frente | veredicto |
|---|---|
| **el instrumento contra sus propios controles** | ✅ **PASA.** Canario 5/5; cabecera por la regla real de markdown (0 huecos de fila); vocabulario cerrado que **encontró un token real fuera de lista**; dedupe por sujeto que mata los 16 falsos huecos de H-C. El rediseño es correcto y no es un parche por forma. |
| **la confirmación externa que respalda el cierre** | ⛔ **NO VALE.** El «21 = 21» es la **cancelación de tres discrepancias** de signo opuesto. Los dos 21 cuentan cosas distintas. |
| **el residuo de los 3 veredictos que planificación dejó abierto** | ✅ **CERRADO acá:** `26 = 23 + 2 + 1`, descompuesto en §7. |

---

## 2. H-1 🔴 ALTA — el «21 = 21» es compensación, no coincidencia

Mediciones que cuenta cada lado, fila por fila:

| sujeto | el parser | FE1 (su doc) | Δ |
|---|---|---|---|
| `clientes` — **listado** (`:156`) + **ficha** (`:179`) | **1** clave (`clientes·único`) | **2** mediciones | **−1** |
| `chat` (`:209`, un encabezado con `PARTIDO:` en 2 caminos) | **1** clave, 3 veredictos | **2** mediciones / 2 veredictos (`:318-320`) | **−1** |
| `cobro-voz` (`:30`) + `fact-voz` (`:31`), filas `PENDIENTE_DEVICE` | **2** mediciones | **0** — «2 declaradas PENDIENTE_DEVICE **sin gastar medición**» (`:322`), y `fact-voz` «no mide aparte» (`:31`) | **+2** |
| **total** | **21** | **21** | **0** |

**−1 −1 +2 = 0.** El agregado coincide porque tres errores independientes se cancelan. La verificación
que se citó como «la única que vale» es la que menos discrimina: **una cifra que coincide con la fuente
independiente puede coincidir por compensación.** Lo que confirma no es el total: es la
**descomposición**.

El detalle que lo vuelve difícil de ver: los 22 **sitios** de declaración están todos en `sitios`, así
que la información no se pierde — se pierde sólo el hecho de que dos de ellos comparten clave.

---

## 3. H-2 🟠 MEDIA — `camino_de()` exige la palabra literal «camino», y dos mediciones se funden en silencio

```python
# :296-299
def camino_de(cola):
    """El sufijo `— camino A (…)` distingue dos mediciones del mismo id. Sin él, `camino: único`."""
    m = re.search(r"—\s*(camino\s+[^(,]{1,40})", cola or "")
    return m.group(1).strip() if m else ""
```

Reconoce `— camino A`, `— camino B`, `— camino ConnectionsScreen`, `— camino AppsScreen`. **No** reconoce
`— listado` ni `— ficha`, que es cómo FE1 distingue las dos mediciones de `clientes`. Las dos caen en
`clientes·único` y `medir()` las agrega:

| línea | encabezado | veredicto |
|---|---|---|
| `:156` | `### ` + `` `clientes` `` + ` — listado` | **COHERENTE** (tras autocorrección) |
| `:179` | `### ` + `` `clientes` `` + ` — ficha` | **FUERA-DE-REFERENCIA** |

**Dos veredictos contradictorios del mismo id quedan atribuidos a UNA medición, y nada lo señala.** No es
un hueco (la clave tiene veredicto), no es un huérfano (está atribuido), no baja ninguna métrica. El
`sitios` guarda `[156, 179]`: **el dato para el control existe y no se usa.**

**Causa raíz:** el parser deriva el camino de una **convención de escritura** (`— camino X`) en un frente
que también usa `— <sustantivo>` para lo mismo. Misma clase que H-A del 28/09: el patrón falla por la
forma de un carácter o de una palabra, no por la semántica.

---

## 4. H-3 🟠 MEDIA — `PARTIDO:` parte los VEREDICTOS pero no parte la MEDICIÓN

`:215` dice `PARTIDO: camino-directo=COHERENTE · camino-buzón-de-pendientes=COHERENTE-por-evidencia-cruzada`
bajo el único encabezado `### ` + `` `chat` ``. FE1 lo declara explícito en `:318-320`: «`chat` partida en
2 caminos… pasa de 1 medición/1 veredicto a **2 mediciones/2 veredictos**».

El parser lee **1 medición con 3 veredictos** (`COHERENTE`, `VOCABULARIO_DESCONOCIDO`, `COHERENTE`). La
partición existe en el texto, el brazo `tabla-partida` la lee como veredictos, y **la unidad primaria no
se enteró**: el sujeto sigue siendo uno.

Esto importa más que su aritmética. La unidad primaria pasó a ser el sujeto justamente para que una
operación nueva del protocolo no pueda esconder una medición. `PARTIDO:` **es** una operación que crea
mediciones, y las crea en un canal (prosa, con `=`) que el detector de sujetos no mira.

---

## 5. H-4 🟡 BAJA — el doc declara «sin gastar medición» y el parser no lee esa declaración

`:28-31` es una tabla de 2 filas con `| ` + `` `cobro-voz` `` + ` | PENDIENTE_DEVICE | causa |`. El parser
las toma como 2 mediciones con veredicto. El propio doc dice lo contrario dos veces: «2 declaradas
PENDIENTE_DEVICE **sin gastar medición**» (`:322`) y «declarada dentro de la fila compuesta
`fact-hitl·fact-voz`, **no mide aparte**» (`:31`).

No es que el parser lea mal: **hay una declaración de alcance en el doc que ningún brazo mira.**
Fail-open silencioso — infla el denominador y el total.

---

## 6. H-5 🟡 BAJA — los 4 huérfanos de lote B son CORRECTOS, y la cuarta forma que los produce es latente

Los 4 `veredictos_huerfanos` de lote B están todos en la sección «Corrección de vocabulario 2026-09-28»
(`:110-120`): prosa que **narra correcciones de veredictos ya contados** en la tabla principal.
Atribuirlos sería contar doble. **El instrumento hace lo correcto** y lo dice en el código («sumarlos al
total los haría parecer atribuidos»).

**Y confirma la hipótesis que planificación dejó sin verificar** — «prosa que narra un veredicto ya
contado en su fila»: verificado, es exactamente eso. Lo que ese flag **no** podía hacer es explicar el
residuo de lote A, porque **lote A tiene 0 huérfanos y 0 líneas sin atribuir**.

Ahora, la forma. Las líneas que los producen son:

```
:113   - `tablero`: `DIFERENCIA` → `DESVÍO`.
:114   - `onb-promesa`: el veredicto ambiguo …
:118   - `gastos` (2026-09-28, tick posterior …
```

Un **bullet con el id en backticks y SIN negrita**. `SUJ_BULLET` exige `\*\*`:

```python
# :292
SUJ_BULLET = re.compile(r"^\s*[-*]+\s+\*\*`?([a-z0-9][a-z0-9\-]{1,30})`?\*\*\s*(.*)$")
```

**Es una cuarta forma de declarar un sujeto, y hoy es inofensiva** porque sólo aparece en una sección de
narración. Pero si un lote declara así una medición real, el sujeto **no entra ni al numerador ni al
denominador** y el ratio sigue en `N de N`; el único rastro sería el contador de huérfanos, y sólo si el
veredicto no está en la misma línea. Reportada como **forma**, no como incidente: no la arreglo.

---

## 7. El residuo de los 3 veredictos, CERRADO

| paso | veredictos |
|---|---|
| lo que mide el parser | **26** |
| − las 2 filas `PENDIENTE_DEVICE`, que el doc declara sin gastar medición ni veredicto (H-4) | 24 |
| − el token extra de `chat`: `COHERENTE-por-evidencia-cruzada` cuenta como un tercer veredicto donde FE1 declara dos (H-3) | **23** |
| **lo que FE1 declara** (`:322`) | **23** ✅ |

El residuo no era prosa huérfana: era **la suma de H-3 y H-4**. Cerrado por descomposición, no por
hipótesis.

---

## 8. Lo que NO se verificó (declarado, no omitido)

- **No re-medí ningún lote contra la app ni el proto.** Esta auditoría mide **el instrumento** y su
  confirmación, no los veredictos de FE1/FE2.
- **Los 107 candidatos de comentarios del proto** siguen sin abrir (techo declarado el 28/09).
- **No verifiqué `criterio3-matriz.mjs`** más allá de que existe (26 791 B) y de que
  `universo_de_sujetos()` extrae ≥15 ids de `PROTO_VISTA` + `MEDIBILIDAD` con control propio (`<15` ⇒
  exit 2). Que la **unión** de esas dos namespaces sea el padrón correcto **no lo medí**: planificación ya
  reportó que `PROTO_VISTA` sola era la namespace equivocada.
- **Ninguno de los 5 hallazgos se arregló.** Son filas para que planificación asigne.
