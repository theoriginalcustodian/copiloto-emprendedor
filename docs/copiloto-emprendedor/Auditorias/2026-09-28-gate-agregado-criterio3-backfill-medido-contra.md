# Gate del agregado · criterio 3 · los backfills de `medido_contra` — 2026-09-28

**Auditoría** (`wt-aud-criterio3`, Opus 5) · **Encargo:** correr el gate del agregado con los dos lotes
cerrados y revisar los backfills de `medido_contra` de FE1 (lote A) y FE2 (lote B) **contra la cuarta
forma** (`reconstruido@`), distinguiendo lo que es reconstrucción de lo que es lectura.

**Regla del encargo que cumplo explícitamente:** las cifras se **recomputan desde los tokens**, no se
copian de ninguna cifra citada — ni de las mías de ayer.

---

## 1. El agregado, recomputado hoy

Instrumento: `contar-veredictos.py` (control positivo horneado: si un lote da 0, el conteo no se lee).
Los documentos están **vivos**, así que cada cifra va con la versión medida:

| lote | archivo | sha256 (12) | bytes | mtime | veredictos |
|---|---|---|---|---|---|
| A | `cierre_frontend1…lote-A-14-filas-mas-2-pendiente-device.md` | `ccf510c5b9e4` | 20 752 | 11:50:24 | **19** |
| B | `cierre_frontend2…lote-B-11-de-11-completo.md` | `2d89880c1478` | 20 643 | 12:21:53 | **12** |

**Unidad «veredictos en rol de veredicto»: 31.** De ellos **9 no son una comparación**
(`PENDIENTE_DEVICE` 2 · `NO_MEDIBLE` 2 · `FUERA-DE-REFERENCIA` 3 · `NO_REPRODUCIBLE_SIN_EFECTO` 2)
⇒ **22 comparaciones reales.** Desglose: **DESVÍO 11** (8+3) · **COHERENTE 10** (5+5) · **CORREGIDO 1**.
**Huecos: 0.**

> ⚠️ **No comparar este 31 contra el 32 de ayer.** Los dos documentos cambiaron hoy (vocabulario
> `DIFERENCIA`→`DESVÍO`, la partición de `onb-promesa`, la tabla nueva de `medido_contra`), y los
> hashes de arriba lo prueban. Un conteo sin la versión del archivo es la caducidad del criterio 3 en
> escala de minutos.

### 1.bis El instrumento fabricaba 20 huecos, y eran suyos — declarado, no escondido

La primera corrida dio **20 `SIN_VEREDICTO_PARSEABLE`** y **ninguno era del documento**: 2 encabezados
de tabla, **16 filas de la tabla nueva `id | tipo | medido_contra`** (que legítimamente no tiene columna
de veredicto) y 1 fila partida. 2 + 16 + 1 = 19 en lote B, más 1 encabezado en lote A = 20. Cuadra exacto.

**Si lo hubiera reportado, eran 16 hallazgos inventados contra FE2.** Arreglado en la raíz, no
silenciado: el parser ahora reconoce el encabezado que el propio documento declara y **recuerda si esa
tabla tiene columna de veredicto**; si no la tiene, sus filas no se cuentan ni como veredicto ni como
hueco. Y el regex de la fila partida ahora acepta el nombre de la dimensión **con backticks** —
`` `contenido`: COHERENTE · `componente`: FUERA-DE-REFERENCIA `` —: mi fix de ayer asumió el formato
pelado y hoy el mismo hueco volvió con otra cara, perdiendo la fila **entera**, ni 1 ni 2 veredictos.

---

## 2. FE1 (lote A) — `leido@` **es fiel**. Pasa.

FE1 anotó 2 filas con `leido@fe2/bl-o6-legal-parte-a-y-parte-b-web:096d8d08` = «mi HEAD al momento de
leer código». Esa rama es **el checkout compartido**, así que la sospecha razonable era que el SHA no
describiera el árbol leído: un checkout con ediciones fuera de todo commit invalida el `leido@` por
construcción.

**Medido, y la sospecha NO se sostiene:**

| control | resultado |
|---|---|
| HEAD del checkout compartido | `096d8d08`, rama `fe2/bl-o6-legal-parte-a-y-parte-b-web` ✓ coincide |
| archivos tracked modificados sin commitear | **3** — y los tres son `docs/…mapa-de-pantallas…md`, `memoria/HISTORIA.md`, `memoria/MEMORY.md` |
| stage | vacío |
| los `.tsx` que esas filas citan (`DesktopShell.tsx`, `AppShell.tsx`) | **limpios** |

⇒ **`leido@…:096d8d08` describe el árbol que FE1 leyó.** Ningún `.tsx` sucio, así que el campo es
verificable y correcto. **FE1 no necesita la cuarta forma para estas dos filas.**

**Y una nota sobre mi propio método:** yo traía de memoria que ese checkout tenía «~100 archivos
editados a mano». **Eso ya no es cierto** — hoy son 3, y ninguno de código. Iba a acusar con un estado
pasado; una entrada de memoria dice cuándo se escribió, no cómo está el sistema hoy, y por eso se
verifica antes de usarla como evidencia.

---

## 3. FE2 (lote B) — la **sustancia** se sostiene, la **forma del campo** no

### 3.1 El diff que declaró: verificado por mí, y correcto

FE2 afirma que entre su checkout (`096d8d08`) y `origin/main` (`113abc26`) sólo cambiaron
`Tarjeta{Gasto,Presupuesto}Propuesto.tsx` (+1 línea `mensajeId`), `Formulario{Gasto,Presupuesto}.tsx`
(placeholders) y `RevealEntrada.tsx` / `IdentidadEntrada.tsx` / `ListaMensajes.tsx` mobile.

Corrí el diff. **12 archivos, no 9** — los 3 que su lista omite son
`TarjetaPresupuestoPropuesto.test.tsx`, `RevealEntrada.test.tsx` y `FormularioGasto.test.tsx`.
**Son `.test.tsx`: no entran al bundle ni a la superficie**, así que su conclusión —«ningún archivo
citado cambió con efecto estructural»— **se sostiene.** Lo anoto por completitud, no como defecto.

### 3.2 🔴 HALLAZGO (severidad MEDIA) · el campo dice `leido@` donde hubo **reconstrucción**, y anota el **más NUEVO**

Las 11 filas de código del lote B llevan `medido_contra: leido@origin/main:113abc26`. Pero FE2 **no
leyó** `113abc26`: leyó su checkout viejo y **verificó** que los archivos no cambiaron. Él lo explica en
la prosa —«no es una nueva medición, es la confirmación de que la lectura original no quedó
obsoleta»— y lo dice con estas palabras: *«uso `leido@origin/main:113abc26` como el SHA vigente **y más
reciente**»*.

**Dos problemas, y el segundo es el que el propio §15.2 quiso evitar:**

1. **Es la cuarta forma, no la primera.** `leido@<rama>:<sha>` afirma «este árbol se leyó». Lo que pasó
   fue «se leyó otro árbol y se verificó que este no difiere». La prosa lo aclara; **el campo no**, y el
   campo es lo que lee un control automático.
2. **Anota el eslabón más NUEVO, contra su propia regla.** La regla del eslabón más viejo existe
   exactamente contra esto: un control de caducidad que compare `medido_contra` con los commits
   posteriores verá `113abc26` (hoy 10:36) y concluirá «medido hoy, vigente», cuando la lectura que
   sostiene el veredicto es del 22/09. **El campo diseñado contra el envejecimiento silencioso lo
   produciría** — el mismo (b) del §15.2, con otra cara.

**Lo que NO es:** no es un dato inventado ni una medición falsa. La verificación existe y la corrí. Es
un **problema de etiqueta**, y se arregla escribiendo
`reconstruido@apps/…:<ultimo-commit-que-lo-toco>` (cuarta forma, ya aceptada por planificación) con el
límite escrito: *no dice qué tenía el worktree del medidor; sólo que el archivo no cambió después*.

### 3.3 La fila `reveal` **NO caducó** — y esto iba a ser un hallazgo mío equivocado

La fila declara plataforma **`ambas`** con veredicto **COHERENTE** y mobile en
`[ASSUMED_PENDING_VERIFY]`. Y el archivo mobile de esa fila cambió **fuerte** entre el árbol leído y
`origin/main`: `RevealEntrada.tsx` **+68**, `IdentidadEntrada.tsx` 60 líneas. Con eso, aplicando mi
propia regla del ataque 4 (*si el supuesto fuera falso, ¿cambiaría el veredicto?*), la fila quedaba
bloqueante.

**Leí el diff antes de dictaminar, y dice lo contrario:** las 68 líneas son el **port de la animación
del wordmark** del splash web al mobile — `LETRAS_WORDMARK = ['d','o','b','i']`, `OAsentada`,
`LetraWordmark`, fade+bounce con `EASE_BOUNCE` / `EASE_SETTLE`. **Ni una línea toca los CTA**: cero
cambios sobre «Empecemos», «Crear cuenta», `onPress`, `Pressable` o `testID` (el único match del filtro
en 70 líneas fue un `<Text>` de estilo del título). Y la fila declara `dimension: contenido`, que es
justamente lo que no se movió.

⇒ **El veredicto de `reveal` sobrevive y FE2 tuvo razón al dejarlo firme.** Un archivo que cambia mucho
no caduca una fila: **caduca si cambia lo que el veredicto AFIRMA.** Es la misma lección de mi dictamen
de ayer —«FE2 no se equivocó, la fila envejeció»— aplicada al revés: hoy no envejeció, y el tamaño del
diff era una señal falsa.

**Lo que sí queda, sin bloquear:** el `[ASSUMED_PENDING_VERIFY]` de mobile sigue abierto y ahora
convive con 68 líneas nuevas en ese archivo. No cambia el veredicto hoy; sí encarece no resolverlo.

---

## 4. `proto@54fac3ea` — verificado, vigente. Pasa.

FE1 usa `proto@54fac3ea` en **17** de sus campos. Control: `54fac3ea` (2026-09-21 12:09:12) sigue
siendo el último commit que toca `Prototipo frontend/odobi-ui/prototipo/index.html`, y entre él y
`origin/main` hay **0** commits al archivo. ⇒ **la referencia del prototipo no envejeció**, y cualquier
fila cuyo único eslabón dudoso fuera el proto queda firme.

## 5. Alcance del punto que falta: `servido@`

Formas usadas, contadas sobre el documento (no citadas):

| forma | FE1 (lote A) | lote B |
|---|---|---|
| `servido@…` | **18** de 21 campos | 1 (`hablar`) |
| `leido@…` | 2 | 11 |
| `proto@…` | 17 | — |

**19 campos en total dependen de `servido@`**, y ese es el punto que planificación ya midió como
sospechoso: *producción está atrasada de `origin/main`* (el `placeholder="1500,50"` de `#689` tiene 1
ocurrencia en `origin/main` y **0** en el bundle servido, con control positivo de 5 marcadores
presentes). Como `servido@<sha>` anota `origin/main` a la hora de la captura pero **lo capturado fue lo
desplegado**, esos 19 campos anotan un SHA que no es el que se sirvió. **Lo que faltaba es cuánto
atrás**, y es lo que se mide en la sección siguiente.
