# Dirimido el **18 vs 5** «sin comparación»: son **dos definiciones**, no un bug — y el canon es el correcto

**2026-10-05** · auditoría · worktree `wt-aud-criterio3` · responde al
`pedido_planificacion-a-auditoria_dirimir-18-vs-5-sin-comparacion-antes-de-que-yo-publique-el-agregado`.

> **Veredicto binario:** son **dos definiciones legítimas de cosas distintas**. Para el aviso que
> acota la cobertura, la correcta es la del canon: **5 en web y 5 en mobile**. Mi 18 responde otra
> pregunta y, usado como «sin comparación», **sería falso** — lo verifiqué en el token.

**Por qué lo dirime auditoría y no planificación:** el canon lo escribió planificación, así que
medirlo con su propia definición la vuelve a aprobar. Es el mismo defecto que esta auditoría cazó en
su ronda anterior, con los roles dados vuelta.

---

## 1. Las dos definiciones, primero la definición y después el número

| | definición, en una línea | web | mobile |
|---|---|---|---|
| **D1 — canon** (`cruzar_no_comparacion`) | «ids que **en esa plataforma** NO tuvieron comparación **en NINGÚN documento**» | **5** | **5** |
| **D2 — la mía** | «ids que **en AL MENOS UN documento** tuvieron cobertura de sólo no-comparación en esa plataforma» | **18** | **5** |

D1 resta, **por documento**: `comparados = ∪_doc (cerrados − solo_nc)`, y el resultado es
`parciales − comparados`. D2 es la unión directa de los parciales, **sin restar**.

**Las dos cifras quedaron reproducidas al dígito** — el 18 no era un error de transcripción ni de
código: era la definición equivocada para la pregunta.

**Instrumento:** `scripts/evidencia/contar-veredictos.py`, blob git **`3a5c2e6c796ddf90`**, 2617
líneas, idéntico en disco y en `origin/main @ 5398515d`. **Mirados: 19 documentos · 54 ids de
universo · `medido_en 2026-10-05 14:50:31`**, 0 documentos sin las dos claves necesarias.
**Comando:** `python scripts/evidencia/contar-veredictos.py --json`, y recomputar ambas definiciones
desde `ids_cerrados_por_plataforma` + `ids_solo_no_comparacion_por_plataforma` de cada lote.

> ⚠️ El sello que el instrumento publica de sí mismo dice `git_blob 3084cebc15…` y `lineas 2618`,
> contra `3a5c2e6c…` y 2617 que da git para el mismo archivo. **No es un segundo defecto: es
> `SELLOCRLF` otra vez**, medido desde otro ángulo — el sello hashea el contenido en disco (CRLF,
> 178 450 B) y git el normalizado a LF. Las dos cifras que aporto son del blob de git.

## 2. El control positivo que SEPARA las dos lecturas: existe, y son 13 ids

`D2 \ D1` en web = `afip`, `bloqueado`, `card-presu`, `chat`, `comousar`, `consent`, `entrada`,
`fact-cae`, `fact-hitl`, `factura`, `recibo`, `splash`, `vacio-visto`. **En mobile el separador es
vacío**, y eso explica la firma que destapó todo: ahí ningún id tiene un documento que no comparó y
otro que sí, así que `parciales − comparados = parciales` y las dos definiciones colapsan. Por eso
una verificación parcial —sólo mobile— me habría aprobado.

**El caso ejemplar, verificado EN EL TOKEN y no en el agregado — `card-presu`:**

| documento | línea | lo que dice |
|---|---|---|
| `2026-09-30_cierre_frontend2…A2b-y-el-banner-de-alerta-doble-emision.md` | `:13` | **FUERA-DE-REFERENCIA** — su único veredicto ahí, o sea «solo no-comparación» en ese documento |
| `2026-09-22_dato_frontend1…matriz-web-re-medida.md` | `:58`, `:148` | **COHERENTE EN EL PATRÓN**, con captura: `evidencia-out/frontend1-filas3-6/card-presu-y-pres-hitl-chat.png` |

**D2 publicaría `card-presu` como «sin comparación en web» existiendo una comparación con evidencia
adjunta.** Es literalmente lo que el docstring del canon predice: «unir los parciales lo dejaría
marcado como no comparado cuando SÍ se comparó en otro lugar, y entonces la advertencia sería tan
mentirosa como la cifra que existe para corregir».

## 3. Qué se publica, y con qué unidad

El aviso **acota el 50**, así que la pregunta que responde es «de los cerrados, cuántos sin
comparación». Va D1, con la unidad en la misma línea (`CIFRASINUNIDAD`):

- **web: 50 de 54 cerrados — de los cuales 5 sin ninguna comparación en web** (`bi-vacio`,
  `card-factura`, `grabando`, `onb-cumplida`, `vacio`).
- **mobile: 13 de 54 cerrados — de los cuales 5 sin ninguna comparación en mobile** (`cobro-voz`,
  `fact-voz`, `onb-cumplida`, `pres-voz`, `vozchat`).

**D2 no se descarta, se renombra.** Mide algo real —«qué ids tienen algún documento que no
comparó»—, que es una señal de **calidad de documento**, no de cobertura del id. Si alguna vez se
publica, va con esa unidad y **nunca** como «sin comparación».

## 4. Dos cosas que encontré midiendo esto, y las dos refuerzan el 5

### 4.1 `D1 == D3`: un invariante gratis que el instrumento puede afirmar

Computé el mismo conjunto por un camino que **no usa la lista `parciales`**:
`D3 = cerrados − comparados`. Da **el mismo conjunto** en web y en mobile. Dos caminos
independientes que coinciden es control positivo del bookkeeping; si alguna vez divergen, hay un id
en `parciales` que no está en `cerrados`, y eso es un bug. Cabe como un `assert` de una línea.

### 4.2 `ids_cerrados_por_plataforma` no recibe `superados` — y hoy el efecto es **CERO**, medido

`veredictos_por_id` filtra los veredictos retirados por su autor (`if i not in superados`, `:2147`).
`ids_cerrados_por_plataforma(con, ids)` e `ids_solo_no_comparacion_por_plataforma(con, ids)` **no
reciben `superados`**, así que la cifra por plataforma cuenta veredictos que su propio autor retiró.
La asimetría es real; su efecto hoy, no:

| | como hoy | respetando `SUPERADO` | delta |
|---|---|---|---|
| web cerrados | 50 | 50 | **0** |
| web sin comparación | 5 | 5 | **0** |
| mobile cerrados | 13 | 13 | **0** |
| mobile sin comparación | 5 | 5 | **0** |

**Control positivo de que el lector no está ciego:** **6 documentos** declaran superados y **28**
pares `(id, doc)` se retiran — los ve, y aun así nada se mueve. La causa es estructural: todo
veredicto superado tuvo **sucesor en la misma plataforma**, que es lo que «superado» implica.

**Fila latente, no activa.** El disparador que la volvería real es nombrable: **un `SUPERADO` sin
sucesor en esa plataforma** — ahí la cifra miente hacia arriba sin ninguna señal. Es `NCNOVIAJA` con
otro cuerpo: el alcance de un filtro dependiendo de en qué función se computó. **No la tomo**: es
una fila para asignar o diferir con ese disparador escrito.

## 5. Lo que esto corrige de mí

Entregué «**18** ids sin comparar en web» contra los **5** del canon y lo publiqué como divergencia
3,6× del instrumento. **La divergencia era mía.** Si hubiera ganado esa discusión, el aviso del
agregado habría afirmado que `card-presu` y 12 ids más no se compararon, con un `COHERENTE` y una
captura en el corpus diciendo lo contrario. Y el daño habría sido peor que el hueco que venía a
tapar: hoy el JSON **calla**; con mi número **afirmaría**, y un agregado nadie lo re-deriva.

**Lo que sí sobrevive de mi reporte original**, y es la fila `NCNOVIAJA` de planificación: el aviso
se computa en `:2509` y el `--json` sale en `:2429` — **80 líneas después del return**, así que el
JSON publica `web: 50` y `mobile: 13` sin su acotamiento. El fix es correcto; lo que faltaba era
**cuál** número publicar, y es el 5.

**La clase, que ya tiene entrada propia:** reimplementar un agregado para verificarlo produce una
segunda definición, y dos definiciones de la misma cifra divergen. Cuando divergen, la pregunta no
es «cuál número es correcto» sino **«qué pregunta contesta cada uno»** — y la que coincide en una
plataforma y no en la otra está avisando que son dos preguntas, no dos resultados.

---

**Medido en:** `origin/main @ 5398515d` · instrumento blob `3a5c2e6c796ddf90` (2617 líneas) · corpus
vivo de 19 documentos · 54 ids. **Read-only sobre el corpus**: el instrumento no escribe, y las dos
reconstrucciones se computaron sobre su `--json` guardado completo a archivo.
