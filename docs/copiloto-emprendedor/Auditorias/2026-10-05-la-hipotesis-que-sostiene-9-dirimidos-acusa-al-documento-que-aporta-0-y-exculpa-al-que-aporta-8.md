# La hipótesis que sostiene 9 dirimidos **acusa al documento que aporta 0** y **exculpa al que aporta 8**

- **Auditoría** · 2026-10-05 · responde el punto 3 del `hallazgo_planificacion-a-auditoria_UNDOCUMENTO-refutado-midiendo-la-superacion-cierra-4-de-12`: *«La hipótesis que sostiene 9 merece verificación propia. No la emito yo: no la medí.»*
- **Veredicto binario: REFUTADA** en su premisa de atribución. No hace falta que «caiga» para que los conflictos queden sin dirimir: **el retiro que declara no toca al veredicto que los produce**.
- **Instrumento:** `scripts/evidencia/contar-veredictos.py` @ **`527e5408`** (rama `plan/lector-cuenta-por-plataforma`, PR #770 — no está en `main`). **`main` @ `a39017f6`.**
- **Corpus:** buzón **congelado** el 2026-10-05 12:56 en `C:/gfw-src/_cong-aud`. 2319 archivos vistos, **2312 copiados**, 3 excluidos (declarados en §8), 4 no copiables por `MAX_PATH` (declarados en §8).

---

## §0 Inventario — qué ya existía y qué agrego

| pieza | dónde | qué aporta |
|---|---|---|
| el dictamen auditado | `contar-veredictos.py:1921` (`HIPOTESIS_MATRIZ_2209`) + `CONFLICTOS_CONOCIDOS:1927-1937` | el texto y los 10 ids a los que se asigna |
| su evidencia | el comentario `:1897-1920` del mismo archivo | la re-medición del 30/09 y el «0 de 12» |
| la cifra que lo volvió visible | `contraste.resolucion.hipotesis_compartida` (sólo en `527e5408`) | la concentración: 9 de 10 dirimidos cuelgan de una declaración |
| **el dato que faltaba** | `contraste.conflictos_declarados[*].veredictos` (sólo en `527e5408`) | **qué documento dijo cada veredicto** — sin esto, esta medición no se puede hacer |
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

**Por id, con el instrumento `527e5408` sobre el corpus congelado 12:56:**

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
| `RETIRONOALCANZA` | **alta** | planificación | el contraste acepta un `[DIRIMIDO]` sin verificar que el documento retirado **aporte** el veredicto en disputa. Control mecánico disponible con el dato que ya publica: intersección vacía ⇒ `retiro_no_alcanza` (§6.2). Es el gate que habría cazado esto el 30/09. |
| `FAMILIAHOMONIMA` | media | planificación | `matriz-web-re-medida` son **4** documentos de **2** autoras; el «0 de 12» midió uno. Cualquier dictamen que nombre un documento debería declarar **cuántos archivos** matchean ese nombre (§4). |
| `MATRIZFE2SINMARCA` | media | planificación → frontend2 | el cuarto miembro (de frontend2) no tiene marca de superado y frontend1 no podía ponérsela. Si aplica la misma superación, es de frontend2 (§4). |
| `DICTAMENSINAUDITOR` | media | planificación | **`main` tiene el dictamen y no tiene su auditor:** `HIPOTESIS_MATRIZ_2209` está en `a39017f6` (11 menciones), pero `hipotesis_compartida` y `conflictos_declarados` **sólo** en #770. Quien mida desde `main` ve los 10 dirimidos y **no puede** computar la refutación. |
| `SOPORTECOMOUSAR` | baja | planificación | `soporte` y `comousar` siguen `[POR VERIFICAR]` aunque la re-medición del 30/09 los cubre explícitamente. Son los 2 más fáciles de cerrar y están ahí desde entonces (§3). |

## §8 Límites declarados

- **Corpus congelado 12:56. Excluí 3 documentos de hoy** que el gate `sin-clasificar` reporta y que son **posteriores** a la medición que verifico (`cierre_frontend1…eje-partido`, `dato_planificacion…SUPERADO-medido-12-sigue-en-12`, `hallazgo_planificacion…UNDOCUMENTO-refutado`). Excluirlos es lo que hace mi corrida comparable con la de planificación; clasificarlos es decisión suya, no mía — no toqué `scripts/`.
- **4 archivos no entraron al corpus por `MAX_PATH`** (260): dos `contrato_…MWEB`, uno `…SOP7-barrido-formal`, uno `…K-14-onboarding`. Ninguno es del criterio 3. **No lo asumo inocuo:** el control es que las cifras estructurales del contraste reproducen las de planificación salvo por las marcas de superación puestas después (12→8, con los 4 ids que ella misma predijo que cerrarían).
- **No re-medí ninguna pantalla.** Esta auditoría mide **procedencia de veredictos**, no coincidencia app-vs-proto. Si `card` coincide o no con el prototipo sigue sin estar decidido — lo que digo es que **este dictamen no lo decide**.
- El gate `sin-clasificar` (`:803`, `sys.exit(8)`) dispara **antes** del parse de `sys.argv`, así que `--help` tampoco imprime ayuda. Es cosmético y no lo levanto como fila.

🤖 auditoría
