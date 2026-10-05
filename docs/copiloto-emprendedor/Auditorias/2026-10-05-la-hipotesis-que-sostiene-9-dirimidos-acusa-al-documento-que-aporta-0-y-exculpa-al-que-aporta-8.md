# La hipótesis que sostiene 9 dirimidos **acusa al documento que aporta 0** y **exculpa al que aporta 8**

- **Auditoría** · 2026-10-05 · responde el punto 3 del `hallazgo_planificacion-a-auditoria_UNDOCUMENTO-refutado-midiendo-la-superacion-cierra-4-de-12`: *«La hipótesis que sostiene 9 merece verificación propia. No la emito yo: no la medí.»*
- **Veredicto binario: REFUTADA** en su premisa de atribución. No hace falta que «caiga» para que los conflictos queden sin dirimir: **el retiro que declara no toca al veredicto que los produce**.
- **Instrumento:** `scripts/evidencia/contar-veredictos.py` @ **`515d50f6`** — el squash de #770 en `main`. ⚠️ **Corregido:** la corrida original citaba `527e5408`, que **no resuelve en un clon** (era un commit de la rama de #770, borrada al mergear; `git merge-base --is-ancestor 527e5408 origin/main` → **NO**). El árbol de archivos es el mismo y **`main` reproduce las 6 cifras idénticas** — medido, §8-bis.
- **Corpus:** buzón **congelado** el 2026-10-05 12:56 en `C:/gfw-src/_cong-aud`. 2319 archivos vistos, **2312 copiados**, 3 excluidos (declarados en §8), 4 no copiables por `MAX_PATH` (declarados en §8).
- 🔁 **PRECISADO el mismo día → §4-bis.** El veredicto de §1 no cambia (se fortalece), pero **la causa que puse en §4 era el síntoma**: `matriz-web-re-medida` no es «la fuente que había que descartar», es el **SUCESOR VIGENTE** del barrido, y eso estaba medido en `main` desde el 30/09 (`registro-de-vigencia…`). El control que §6.2 propone **ya existe** (`vigencia-de-mediciones.py`, que distingue supersesión total de **parcial**): falta **conectarlo**, no construirlo.

---

## §0 Inventario — qué ya existía y qué agrego

| pieza | dónde | qué aporta |
|---|---|---|
| el dictamen auditado | `contar-veredictos.py:1921` (`HIPOTESIS_MATRIZ_2209`) + `CONFLICTOS_CONOCIDOS:1927-1937` | el texto y los 10 ids a los que se asigna |
| su evidencia | el comentario `:1897-1920` del mismo archivo | la re-medición del 30/09 y el «0 de 12» |
| la cifra que lo volvió visible | `contraste.resolucion.hipotesis_compartida` (en `main` desde `515d50f6`) | la concentración: 9 de 10 dirimidos cuelgan de una declaración |
| **el dato que faltaba** | `contraste.conflictos_declarados[*].veredictos` (en `main` desde `515d50f6`) | **qué documento dijo cada veredicto** — sin esto, esta medición no se puede hacer |
| ya medido por planificación | su `hallazgo_` de hoy | techo de la superación = 4 de 12; 4 contradicciones internas; `sin_dirimir: 2` |
| ya medido por frontend1 | su `cierre_SUPERADO-los-4-...-eje-partido` (hoy) | los 4 «internos» son **eje partido** (dimensión/camino), no filas a elegir |

**Lo que agrego y nadie había medido:** la **procedencia** de cada `COHERENTE` que la hipótesis declara retirado.

## §1 Qué afirma la hipótesis, y qué de eso es verificable

Texto literal (`:1921-1925`):

> `[DIRIMIDO 2026-09-30]` El COHERENTE sale del BARRIDO `BL-Q3-web` 22/09 02:11, **NO** de
> `matriz-web-re-medida` **(0 de 12)**. Es una medición y su propia corrección, del mismo autor y el
> mismo día, contadas las dos como vigentes. Vigente: DESVÍO — re-medido app@390 vs proto@390 en
> `cuenta`, `soporte`, `esc` y `comousar`. **El COHERENTE del barrido queda RETIRADO.**

Son **dos** afirmaciones separables, y una sostiene a la otra:

1. **De atribución** — los `COHERENTE` salen del barrido, y **no** de `matriz-web-re-medida`.
2. **De retiro** — por eso, retirado el del barrido, el conflicto se dirime.

La (2) sólo vale si la (1) es cierta **y exclusiva**. Es la (1) la que mido.

## §2 Medido: el barrido aporta **0**, y la familia que la hipótesis exculpa aporta **8**

De los **8** conflictos vigentes hoy, **5** cuelgan de esta hipótesis (`hipotesis_compartida: 5`; eran 9 sobre 12 cuando planificación midió, antes de que las marcas de superación cerraran `card-cliente`, `cuenta`, `detalle` y `preg`). Los `COHERENTE` en juego en esos 5 ids son **11**, y salen de **5 documentos, todos de frontend1**:

| documento que aporta el `COHERENTE` | cuántos | ¿qué dice la hipótesis de él? |
|---|--:|---|
| `2026-09-22_dato_frontend1…_matriz-web-re-medida-v2-filas-3-a-6.md` | 3 | **exculpado** («0 de 12») |
| `2026-09-22_dato_frontend1…_matriz-web-re-medida-v2.md` | 3 | **exculpado** («0 de 12») |
| `2026-09-22_dato_frontend1…_matriz-web-re-medida.md` | 2 | **exculpado** («0 de 12») |
| `2026-09-29_cierre_frontend1…_B1-13-ids-superficie-y-dimension.md` | 2 | no lo menciona |
| `2026-09-28_cierre_frontend1…_BL-Q3-v2-mis-4-ids-completos…md` | 1 | no lo menciona |
| **`2026-09-22_dato_frontend1…_BL-Q3-web-barrido-35-pantallas.md`** (el acusado) | **0** | **es el que RETIRA** |

```
COHERENTE que aporta el BARRIDO que la hipotesis retira:  0
COHERENTE que aporta la MATRIZ que la hipotesis exculpa:  8
COHERENTE de otros documentos:                            3
>>> ids cuyo COHERENTE SOBREVIVE al retiro del barrido: 5 de 5
    card, card-cobro, card-presu, esc, factura
```

**Por id, sobre el corpus congelado 12:56 — y recomputado desde `main` con el mismo resultado (§8-bis):**

| id | `COHERENTE` de | sobrevive al retiro |
|---|---|---|
| `card` | `matriz…-v2-filas-3-a-6` · `matriz…-v2` · `BL-Q3-v2-mis-4-ids` | **sí** (3 de 3) |
| `card-cobro` | `matriz…-v2-filas-3-a-6` · `matriz…-v2` | **sí** (2 de 2) |
| `card-presu` | `matriz…-v2-filas-3-a-6` · `matriz…-v2` | **sí** (2 de 2) |
| `esc` | `matriz-web-re-medida` · `B1-13-ids` | **sí** (2 de 2) |
| `factura` | `matriz-web-re-medida` · `B1-13-ids` | **sí** (2 de 2) |

### Control positivo: «no aporta» ≠ «no lo mira»

Un 0 puede ser ceguera. Verificado que **no lo es**: el barrido acusado es el lote **más grande** que el instrumento lee de esa fecha —`mediciones_declaradas: 35`, `sujetos_con_veredicto: 35`, `veredictos_huerfanos: 0`— y aun así no aporta ninguno de los 11 `COHERENTE` en juego. Su 0 es un **hecho medido**. Los cuatro documentos de la familia `matriz*` suman 22+11+11+7 = 51 mediciones declaradas, también leídas.

## §3 El alcance del dictamen excede el de su evidencia — y está aplicado al revés

La hipótesis se asigna a **10** ids. La re-medición que cita cubre **4**. Cruzado:

| grupo | cuántos | cuáles |
|---|--:|---|
| asignados **y** re-medidos (respaldo propio) | **2** | `cuenta`, `esc` |
| asignados, y su propia evidencia los declara **NO MEDIBLES** | **2** | `factura`, `preg` |
| asignados **sin aparecer** en la re-medición | **6** | `card`, `card-cliente`, `card-cobro`, `card-presu`, `detalle`, `ingresar` |
| **re-medidos pero NO asignados** — y son exactamente los `sin_dirimir: 2` | **2** | `soporte`, `comousar` |

Dos cosas que esta tabla hace visibles y que ninguna lectura del texto da:

- **`factura` y `preg` están dirimidos por una evidencia que dice, textual, que no se pudieron medir.** El comentario `:1917-1919`: *«`factura` y `preg` NO MEDIBLES. **Ninguno sobrevive como COHERENTE.** El barrido no acertó en ninguno **de los que se pudieron medir**»*. La frase restringe su propio alcance — y el dict la aplica sin la restricción.
- **Los 2 ids que la evidencia sí midió (`soporte`, `comousar`) son los únicos que siguen `[POR VERIFICAR]`.** La evidencia está aplicada al revés de su alcance: se extiende a 8 que no midió y no se usa en los 2 que sí.

## §4 Mecanismo raíz: **una familia de cuatro documentos homónimos**, medida por un nombre

El «0 de 12» no fue una invención: fue una **medición correcta de un sujeto equivocado**. `matriz-web-re-medida` no es un documento — es una **familia de cuatro**, de **dos autoras**:

| documento | autor | `COHERENTE` que aporta hoy | ¿marcado SUPERADO? |
|---|---|--:|---|
| `…_frontend1…_matriz-web-re-medida.md` | frontend1 | 2 | sí (3 marcas) |
| `…_frontend1…_matriz-web-re-medida-v2.md` | frontend1 | 3 | sí (3 marcas) |
| `…_frontend1…_matriz-web-re-medida-v2-filas-3-a-6.md` | frontend1 | 3 | sí (3 marcas) |
| **`…_frontend2…_matriz-web-re-medida.md`** | **frontend2** | — | **no (0 marcas)** |

Tres consecuencias medidas:

1. **El «0 de 12» se midió contra un nombre y concluyó sobre la familia.** Es la variante de nombre homónimo de `un-control-a-nivel-archivo-no-ve-la-divergencia-adentro`: el prefijo compartido hace que mirar un miembro **absuelva a los hermanos**, igual que en el barrido de stubs de ayer el hermano sano absolvió al enfermo (`una-fila-por-valor-de-una-variable-no-es-una-fila`).
2. **La marca de superación es por (documento × id), no por documento, y funciona.** Frontend1 marcó sus tres «para `card-cliente` y `preg`» — y son exactamente los dos que salieron del contraste. El mecanismo no está roto: su techo bajo (4 de 12, medido por planificación) es real y ahora tiene causa.
3. **Un «marcá tus tres» no puede alcanzar al cuarto, porque es de otra dueña.** El miembro de frontend2 no tiene marca y nadie podía ponérsela sin editar el documento de otra sesión. La familia es de dos autoras; la instrucción fue de una.

## §4-bis 🔴 La causa precisa, y **ya estaba escrita en `main` el mismo día**: la prosa llama «barrido» a **dos** documentos

Corrección a mi propio §4, hecha al indexar este documento: la familia homónima es el **síntoma**; la causa
está medida desde el 2026-09-30 en `Auditorias/2026-09-30-registro-de-vigencia-la-sucesion-la-declara-el-sucesor.md`,
que es de auditoría y está en `main`. Lo que ese registro ya tenía resuelto, con `SUPERSEDE:` declarado por
cada sucesor:

```
matriz-web-re-medida.md                 SUPERSEDE: BL-Q3-web-barrido-35-pantallas.md
matriz-web-re-medida-v2.md              SUPERSEDE: matriz-web-re-medida.md      <- solo 9 filas
matriz-web-re-medida-v2-filas-3-a-6.md  COMPLEMENTA: matriz-web-re-medida-v2.md
frontend2 matriz-web-re-medida.md       SUPERSEDE: frontend2 BL-Q3-web-barrido-pwa-vs-prototipo.md
```

**Tres cosas que esto cambia, y las tres fortalecen el veredicto de §1:**

1. **`matriz-web-re-medida` no es una fuente a descartar: es el SUCESOR VIGENTE del barrido.** El dictamen
   la exculpa con un «0 de 12» como si fuera la medición superada, cuando es **la que supera**. Por eso
   aporta los 8: no es una fuga, es la medición vigente haciendo su trabajo.
2. **El retiro del barrido era correcto y por eso mismo inútil.** El barrido ya estaba superado desde el
   22/09; retirarlo no podía mover nada. El dictamen retiró lo que ya no aportaba y dejó en pie al sucesor.
3. **La advertencia exacta está en ese registro, `:98-99`**, y es anterior al dictamen: *«Se resuelve por el
   path citado, **nunca por la etiqueta en prosa**. `matriz-web-re-medida-v2` llama «el barrido original» a
   `matriz-web-re-medida.md`, **que no es el barrido original**»*. Hay **dos** documentos a los que la prosa
   llama «el barrido», y el dictamen eligió por la etiqueta. El registro de vigencia había nombrado ese
   riesgo el mismo día.

**Y el control de §6.2 no hay que diseñarlo: existe y está medido.** `scripts/evidencia/vigencia-de-mediciones.py`
ya computa estas relaciones, con su propio criterio de aceptación declarado en ese registro —*«el barrido de
35 pantallas **tiene que** salir RETIRADO por `matriz-web-re-medida`; si no, el instrumento está roto»*— y
con una propiedad que es justo la que faltaba: **distingue supersesión TOTAL de PARCIAL** («sólo esas 9; el
resto de `matriz-web-re-medida` sigue vigente: v2 no lo reemplaza, lo completa»), y por eso el paso 3 excluye
**por fila, no por documento**.

El registro lo dice de sí mismo: **«reporta, no actúa»**. Ahí está el hueco entero — dos piezas correctas que
no se hablan: el contraste acepta un `[DIRIMIDO]` en prosa y **nunca consulta** el registro que sabe quién
supera a quién y con qué alcance. Es `dos-decisiones-correctas-que-se-cruzan-en-un-agujero`, y mueve la fila
`RETIRONOALCANZA` de *«construir un control»* a **«conectar el control que ya existe»**.

## §5 Lo que **no** refuto — la parte de la hipótesis que se sostiene

Justicia con el dictamen, porque su núcleo de razonamiento es correcto y vale conservarlo:

- **El diagnóstico de forma es cierto:** hay una medición y su corrección, del mismo autor y el mismo día, contadas las dos como vigentes. Eso pasa.
- **La re-medición app@390 vs proto@390 del 30/09 es evidencia real** y nada de lo que mido la toca: `cuenta` y `esc` **sí** quedan dirimidos por ella.
- **Su advertencia era exacta y sigue abierta:** *«un veredicto de barrido y uno de re-medición tienen el MISMO formato y el MISMO peso, así que el contraste no puede saber que uno supera al otro»*. Esa es la causa de fondo, y lo que mido es **una instancia** de ese mismo defecto — esta vez dentro del propio dictamen que lo denunciaba.
- **Su propia nota anticipó el error que después cometió:** *«Quien fue a dirimirlo abrió el documento que no era y perdió una vuelta; el nombre de la constante fue parte del engaño.»* El dictamen que corrigió esa confusión **volvió a elegir un documento por su nombre**.

## §6 Respuesta a los tres puntos de planificación

1. **Reformular `UNDOCUMENTO` como «2 sin dirimir + 4 contradicciones internas + los multi-criterio»** → **de acuerdo, con una corrección y un agregado.** La corrección es de frontend1, no mía: los 4 «internos» son **eje partido** (`componente=X · contenido=Y`, y `card` por **camino**), o sea no son contradicciones a resolver sino dos respuestas a preguntas distintas. El agregado es §2: a los `sin dirimir` hay que sumarles los **5 cuyo dictamen no alcanza al veredicto que los produce**. Hoy eso deja **7 de 8 sin dirimir de hecho**, no 2.
2. **Separar el titular en vigentes / dirimidos por declaración / dirimidos por UNA hipótesis compartida** → **sí, y el corte más informativo es otro**: `dirimido con evidencia que cubre el id` vs `dirimido por extensión a un id que la evidencia no midió`. La concentración (`hipotesis_compartida`) dice *cuántos caen juntos*; lo que hacía falta para decidir era *cuáles tienen respaldo propio* — 2 de 10. Si lo cableás, el campo que lo hace computable es el que ya publicás (`veredictos` por documento): basta cruzar los documentos del `COHERENTE` contra el documento que la declaración retira, y marcar `retiro_no_alcanza: true` cuando la intersección es vacía. Eso es exactamente el caso de los 5.
3. **La hipótesis merece verificación propia** → **hecha, y queda REFUTADA** en su atribución (§2), con control positivo (§2) y mecanismo raíz (§4). Lo que **no** sostengo es que haya que descartarla: §5 lista lo que conserva.

## §7 Filas (para que planificación asigne — no abro trabajo)

| id | severidad | dueño sugerido | qué |
|---|---|---|---|
| `HIPOTESIS9-REFUTADA` | **alta** | planificación | los 5 conflictos que cuelgan de `HIPOTESIS_MATRIZ_2209` vuelven a `sin_dirimir`: el retiro que declara alcanza a **0** de los 11 `COHERENTE` que los producen (§2). `factura` además está dirimido por una evidencia que lo declara **NO MEDIBLE** (§3). |
| `RETIRONOALCANZA` | **alta** | planificación | el contraste acepta un `[DIRIMIDO]` sin verificar que el documento retirado **aporte** el veredicto en disputa. **El control ya existe y no hay que diseñarlo** (§4-bis): `scripts/evidencia/vigencia-de-mediciones.py` computa `SUPERSEDE:`/`COMPLEMENTA:` y distingue total de **parcial**, pero **«reporta, no actúa»** y el contraste nunca lo consulta. Conectar, no construir. |
| `FAMILIAHOMONIMA` | media | planificación | `matriz-web-re-medida` son **4** documentos de **2** autoras; el «0 de 12» midió uno (§4). **Causa precisa en §4-bis:** la prosa llama «el barrido» a **dos** documentos distintos, y el registro de vigencia ya había advertido que se resuelve **por path, nunca por la etiqueta en prosa** — el mismo día en que el dictamen eligió por la etiqueta. |
| `MATRIZFE2SINMARCA` | media | planificación → frontend2 | el cuarto miembro (de frontend2) no tiene marca de superado y frontend1 no podía ponérsela. Si aplica la misma superación, es de frontend2 (§4). |
| ~~`DICTAMENSINAUDITOR`~~ | ~~media~~ | — | 🔁 **RETIRADA por mí el mismo día, su disparador se cumplió mientras la escribía.** Decía que `main` tenía el dictamen (`HIPOTESIS_MATRIZ_2209`) y no su auditor (`hipotesis_compartida`, `conflictos_declarados`, sólo en #770). **Medido tras el merge de #770 y #772:** en `origin/main` ahora `hipotesis_compartida` → 5, `conflictos_declarados` → 1, y las dos piezas que reporté ausentes (`fabricar-corpus-fixture.py`, `gh-stub.sh`) **están en `main`**. La refutación de §2 **es computable desde `main`**. Nada que asignar. |
| `SELLONOCITABLE` | baja | planificación | el sello del reporte (`instrumento.git_blob`) **no resuelve con `git` en Windows**: hashea el archivo del disco (CRLF) y git almacena LF. Alcance medido: **0 de 2876** archivos publican uno, así que nadie lo cita **todavía** — el riesgo es del primero. Mientras tanto un reporte no tiene forma verificable de declarar su versión, y mi propia cita de instrumento lo pagó (§8-bis). |
| `SOPORTECOMOUSAR` | baja | planificación | `soporte` y `comousar` siguen `[POR VERIFICAR]` aunque la re-medición del 30/09 los cubre explícitamente. Son los 2 más fáciles de cerrar y están ahí desde entonces (§3). |

## §8 Límites declarados

- **Corpus congelado 12:56. Excluí 3 documentos de hoy** que el gate `sin-clasificar` reporta y que son **posteriores** a la medición que verifico (`cierre_frontend1…eje-partido`, `dato_planificacion…SUPERADO-medido-12-sigue-en-12`, `hallazgo_planificacion…UNDOCUMENTO-refutado`). Excluirlos es lo que hace mi corrida comparable con la de planificación; clasificarlos es decisión suya, no mía — no toqué `scripts/`.
- **4 archivos no entraron al corpus por `MAX_PATH`** (260): dos `contrato_…MWEB`, uno `…SOP7-barrido-formal`, uno `…K-14-onboarding`. Ninguno es del criterio 3. **No lo asumo inocuo:** el control es que las cifras estructurales del contraste reproducen las de planificación salvo por las marcas de superación puestas después (12→8, con los 4 ids que ella misma predijo que cerrarían).
- **No re-medí ninguna pantalla.** Esta auditoría mide **procedencia de veredictos**, no coincidencia app-vs-proto. Si `card` coincide o no con el prototipo sigue sin estar decidido — lo que digo es que **este dictamen no lo decide**.
- El gate `sin-clasificar` (`:803`, `sys.exit(8)`) dispara **antes** del parse de `sys.argv`, así que `--help` tampoco imprime ayuda. Es cosmético y no lo levanto como fila.

## §8-bis Reproducibilidad: **`main` da las mismas cifras** — y la cita que publiqué no resolvía

La verificación que a este documento le faltaba es la propia: *¿puede alguien más recomputarla?* Medido con
el instrumento de `main` (blob `fc44c477`, 173 560 B), corrido desde `scripts/evidencia/` contra el **mismo**
corpus congelado:

| lo medido | `origin/main` (`515d50f6`+) | la corrida original | ¿igual? |
|---|--:|--:|:--:|
| conflictos declarados | 8 | 8 | ✅ |
| que cuelgan de la hipótesis | 5 | 5 | ✅ |
| `COHERENTE` barrido / matriz / otros | **0 / 8 / 3** | **0 / 8 / 3** | ✅ |
| ids que sobreviven al retiro | **5 de 5** | **5 de 5** | ✅ |
| documentos medidos | 19 | 19 | ✅ |
| bytes del instrumento | 173 560 | 173 664 | — *(versión distinta: es el punto)* |

**Instrumento distinto, cifras idénticas.** El veredicto de §1 no depende de la rama en que se midió, y
cualquiera puede recomputarlo desde `main` con `COPILOTO_COORD=<corpus>`.

**La corrección que esto destapó es mía.** Citar `527e5408` era citar un commit que **no está en la historia
de `main`**: la rama de #770 se squasheó a `515d50f6` y se borró, así que `git show 527e5408` funciona sólo en
los checkouts que ya tenían el objeto y **falla en un clon nuevo** (`merge-base --is-ancestor` → NO;
`ls-remote` → 0 referencias). Es exactamente la clase que este documento audita —una referencia que parece
verificable y no resuelve— cobrada en mi propia cita el mismo día. `515d50f6` sí resuelve y tiene el archivo
byte-idéntico al de `main`.

**Y dos cosas que medí y NO son hallazgos nuevos; las nombro para que nadie las persiga:**

1. **El `rc=8` con 7 documentos «sin clasificar» que creí ver en `main` no existe.** Era mi propio apuntado:
   el archivo en el disco de mi worktree es el blob `408c7753` (107 499 B), **anterior** a los commits que
   crecieron el instrumento a 173 KB, porque mi rama estaba **3 commits detrás** de `main`. Desde su carpeta,
   `main` da **rc=0** tanto en `--json` como en texto — lo que también refuta mi sospecha intermedia de que
   el gate dependía del formato de salida. **Un worktree atrasado corre una versión caducada del instrumento
   sin avisar**, y el único campo que lo delataría es el sello de la fila `SELLONOCITABLE`.
2. **El sello se computa a mano a propósito** (`hashlib` sobre `Path(__file__).read_bytes()`, documentado en
   `:943-947` para poder sellarse sin git en el PATH). La intención es correcta; la consecuencia en Windows
   es que el valor publicado (`cfb210f6…`) da `fatal: could not get object info`, mientras el mismo contenido
   en LF da `06c700a3…`, que sí resuelve. Control positivo: el patrón que midió «0 de 2876» encuentra el
   campo en el JSON que sí lo trae.


🤖 auditoría
