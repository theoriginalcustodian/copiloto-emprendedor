# Barrido de comentarios del prototipo Odobi — 4 hallazgos, 2 descartados, y el recorte que **sobreestima**

**Sesión:** AUDITORÍA (`wt-aud-criterio3`) · **2026-09-29**
**Sujeto:** `Prototipo frontend/odobi-ui/prototipo/index.html` — **3899 líneas / 305 719 bytes** (recomputado).
**Alcance:** los ~107 candidatos de comentario que quedaban del barrido del 28/09, partidos en dos rangos.
**No abrí trabajo nuevo.** Los 4 hallazgos son filas para que planificación asigne; no toqué el proto.

---

## §0 · Método y controles

- **Procedencia, recomputada y no citada.** `wc -l` = 3899, `wc -c` = 305 719; ancla `:2111` →
  `<div id="ajustes">`, ancla `:2337` → `<div class="subp" id="s-apps">`. Hay **27** `index.html`
  bajo ese árbol —26 que no son el sujeto— recomputados con `find` (control negativo `index.htmlZZ` → 0): el guard de procedencia no es ceremonia, es lo único que distingue el archivo vivo
  de una copia.
- **Control del instrumento (mi grep).** Positivo `grep -c '<!--'` → **70** (>0). Negativo
  `grep -c 'ZZNOMATCHZZ'` → **0**. El par **discrimina**: si los dos hubieran dado lo mismo, no habría
  medido nada ([[vacio-no-es-hallazgo-correr-el-control]]).
- **Delegación con control horneado.** Dos sub-agentes sonnet barrieron `1‑1950` y `1951‑3899`, cada
  uno obligado a reencontrar contradicciones **ya conocidas** del 28/09 antes de que su barrido
  contara. Los dos las reencontraron (rango 1: `:796-802` SIETE vs 10 `.aj-fila`; `:347-352` 12 px vs
  `padding:14px 0`. Rango 2: `:2802-2803` vs `:3784-3785`; `:3103-3106` vs `:3819`).
- **El juicio no se delegó.** Los **seis** contradichos que reportaron los re-verifiqué yo contra el
  archivo, y **dos no sobrevivieron** (§3).

### Error propio, declarado antes del veredicto

Iba a entregar un hallazgo **🔴 ALTA**: «el proto afirma cumplir WCAG 2.5.1 con un checkbox que no
existe». **Es falso.** La alternativa de un solo puntero existe y está **cableada**: `.borrar` en el
markup (`:1708` `<div class="borrar" data-borrar>`, `:2498` `<div class="accion" data-borrar>`) con su
handler en `:3857` (`document.querySelectorAll('[data-borrar]')`).

Lo que me llevó al falso rojo fue **una ventana de 5 líneas sobre un comentario de 7**: leí
`:1425-1429` y la frase que exculpa está en la línea 6 —

> «La alternativa de un solo puntero que exige WCAG 2.5.1 pasa a ser **"Borrar" dentro de la tarjeta
> expandida**» (`:1430-1432`).

El hallazgo caminó 🔴 ALTA → 🟠 MEDIA → 🟡 BAJA, y cada paso salió de leer **más del archivo real**.
La lección general está en §4; es la más valiosa de esta pasada.

**Y una segunda vez, sobre mi propio hallazgo.** Escribí P-1 como «tres comentarios **del 20/08**». Sólo `:1855` cita esa fecha; los otros dos no citan ninguna, y yo la heredé del vecino que sí leí. Mismo mecanismo: la ventana. Lo que apareció al leer los bloques **hasta su delimitador** fortaleció el hallazgo en vez de tumbarlo — `:1667` deroga «el "avance del día" **(20/08)**» por nombre, y `:3729-3730` enumera el conjunto de FIJOS—, pero eso es suerte: la atribución estaba mal y podía haber caído para el otro lado.

---

## §1 · Veredicto binario

| frente | veredicto |
|---|---|
| ¿el ejecutable contradice comentarios del proto? | ✅ **SÍ, 4 casos nuevos confirmados** (además de los 4 del 28/09, reencontrados como control). |
| ¿hay una violación de accesibilidad? | ⛔ **NO.** WCAG 2.5.1 tiene su camino de un solo puntero, vivo y cableado. Mi alarma inicial era mía, no del proto. |
| ¿queda cubierto el universo de comentarios? | ⛔ **NO.** Se abrieron **~73 de ~187** candidatos con forma verificable (**39 %**). Ver §5. |

---

## §2 · Hallazgos con severidad

| # | sev | hallazgo | `path:línea` | causa raíz |
|---|---|---|---|---|
| **P-1** | 🟠 MEDIA | **Un edit del 25/08 dejó vivos tres comentarios que describen el mecanismo anterior** (uno fechado 20/08, dos sin fecha). `:1855` «el avance… se muda acá» · `:1859` «su línea de pendientes… ahora quedan **FIJOS**» · `:3744-3746` «el avance se muda al bloque de calma… diciendo **"2 de 6"**». El ejecutable dice lo contrario en dos lugares independientes. | comentarios `:1855`, `:1859`, `:3744-3746` vs código `:3739` y `:3843-3850` | Un solo cambio, **tres** comentarios sin barrer. **La derogación está escrita dos veces y bien** —`:1667-1671` en markup, `:3843-3845` en JS— y `:1667` incluso **deroga por nombre** «el "avance del día" (20/08)», que es exactamente la nota que sigue viva en `:1855`. **El archivo carga la prueba de su propia obsolescencia.** |
| **P-2** | 🟠 MEDIA | **`:3172` documenta `?vacio=1`; el parámetro que el código lee es `ver`.** La URL documentada **entra a medias**: dispara `:3682` por el fallback `location.search.includes('vacio')`, pero **no** `:3680`, que exige `ver === 'vacio'` para `localStorage.removeItem('odobi-calma-dias')`. | `:3172` vs `:3680`, `:3682`; el nombre real en `:3669`, `:3717`, `:3835` | El **fallback genérico** hace que la URL equivocada *parezca* funcionar. No falla: **difiere**. Quien siga el comentario reproduce un estado distinto del que el comentario promete, y sin síntoma. |
| **P-3** | 🟡 BAJA | **Encabezado vencido sobre código correcto.** `:3852-3853` titula «3 · checkbox, sólo en tarjetas propias» y le atribuye la alternativa de WCAG 2.5.1 a un checkbox: `grep -c 'type="checkbox"'` = **0**. El código de esa misma sección (`:3857`) es el handler de `[data-borrar]` — que **es** la alternativa, como dice `:1427-1432`. | `:3852-3853` vs `:1427-1432`, `:1708`, `:2498`, `:3857` | Se renombró el mecanismo (20/08) y **no el encabezado de su propia sección**. El control funciona; el rótulo quedó del mecanismo retirado. Riesgo real pero acotado: un port que lea el encabezado reconstruye el control equivocado. |
| **P-4** | 🟡 BAJA | **`:3539-3540` «Mismo rebote que el swipe de descarte: pasado el tope avanza el 30 %»** — el descarte usa `* 0.28` (`:3134`), este pull-to-refresh usa `* 0.3` (`:3541`). No es «el mismo». | `:3539-3541` vs `:3134` | Se copió el comentario con el número redondeado. (Los `0.35` de `:2732`/`:2741` son **umbrales**, no factores de rebote: no entran.) |

### P-1, la evidencia enfrentada

| el comentario afirma | el ejecutable |
|---|---|
| `:1859` la línea de pendientes «ahora **queda FIJA**» | `:3729-3730` define el conjunto de FIJOS con exactamente **dos** miembros —«el rótulo "Para hoy" y su "Ver tablero ›"… igual que "Ahora / Ver agenda ›"»— y `:1859` mete un **tercero**. El código oculta ese tercero: `:3739` `$('#prog').style.display = calmo ? '' : 'none'`, y `:3736-3738` lo dice con todas las letras: «La línea de la semana aparece **SÓLO** con el día limpio (Martin, 25/08)». |
| `:3744-3746` el avance «se muda al bloque de calma», «diciendo **"2 de 6"**» | `:3845` «`pintarAvance()` quedó **DEROGADO** el 25/08 junto con la barra de cerradas» · `:3850` `function pintarAvance(){}` — cuerpo **vacío**. Y `:3843-3844`: «lo hecho no se comunica, sólo lo que falta» — **"2 de 6" es exactamente el vocabulario que la derogación retira.** |
| `:1855` el avance «se muda acá» (dentro de `#calma`) | En el DOM `#calma` y `#prog` (`:1672`, `<div class="pend" id="prog">`) son **hermanos**: no hay anidamiento. |

El elemento en disputa es uno solo y tiene nombre: `:1672`
`<div class="pend" id="prog"><b id="prog-txt">2 cosas</b> más vencen esta semana</div>`.

---

## §3 · Descartados, con motivo (el barrido reportó 6; entrego 4)

| reportado | por qué NO es fila |
|---|---|
| `:395` `.chip-act` «borde y texto, **sin relleno**» vs `:399-401` `background:var(--blanco)` + `box-shadow` | El propio comentario define qué evita, en la línea siguiente: «si fueran **terracota plena** competirían con el botón del HITL, que es la decisión de verdad». Un relleno **blanco** no es eso. Es imprecisión de vocabulario en una frase que su propio contexto desambigua — no una afirmación que el código refute. |
| «el proto afirma cumplir WCAG 2.5.1 con un checkbox inexistente» (mío, no del barrido) | La alternativa **existe y está cableada** (`:1708`, `:2498`, `:3857`). Lo único vencido es el rótulo ⇒ degradado a **P-3 🟡 BAJA**. Ver §0. |

Un dictamen que hubiera copiado los 6 habría entregado **una violación de accesibilidad que no existe**
y **una contradicción que el propio comentario resuelve**. La diferencia entre 6 y 4 es el juicio, y es
el único trabajo que esta sesión no podía delegar.

---

## §4 · La lección que produjo el propio barrido

> **Recortar el campo de visión no te hace PERDER el hallazgo: te hace SOBREESTIMARLO.** La mitad que
> exculpa vive afuera del recorte, y lo que queda adentro alcanza para acusar.

Dos mecanismos distintos, el mismo día, la misma dirección del error:

1. **La ventana de líneas.** `sed -n '1425,1429p'` sobre un comentario de 7 líneas devolvió las 5
   primeras. La 6ª nombraba el mecanismo que cumple el requisito. El recorte no avisa: devuelve exit 0
   y un texto que se lee completo.
2. **El rango del barrido.** El sub-agente de `1951‑3899` encontró `:3852` y midió bien que no hay
   ningún checkbox en el archivo. Lo que no tenía en su rango era `:1427`, que dice **a dónde se mudó**
   la alternativa. Su hallazgo era **correcto en el hecho y excesivo en la conclusión** — y el otro
   rango, que sí tenía `:1427`, lo clasificó **CONSISTENTE**. Las dos mitades acertaron; el sentido
   sólo aparece en el **par**.

**El control, y es barato:** cuando la evidencia es un bloque de prosa, **leé hasta su delimitador de
cierre (`*/`, `-->`), no hasta un número de líneas**; y antes de escribir una conclusión que el rango
no puede verificar, grepeá **el archivo entero** por el mecanismo que el comentario nombra. El
sub-agente no podía hacerlo por diseño: **quien parte el barrido se queda con la costura.**

Hermana de [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] (ahí el falso rojo sale de un contador
roto; acá de un campo de visión recortado) y de
[[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]] (ahí el hueco vive en el par de decisiones;
acá el **sentido** vive en el par de fragmentos).

---

## §4.bis · La clase tiene FIRMA MECÁNICA, y el archivo tiene control positivo

P-1 no es un caso: es una **clase** con firma buscable. Los comentarios del proto **citan fecha** — 16 dicen «20/08», 12 «25/08», 10 «30/08», 9 «19/08» (denominador recomputado con `grep -oE '[0-9]{1,2}/0[0-9]' | sort | uniq -c`, control negativo `99/99` → 0). Cada par de fechas distintas que describe **el mismo mecanismo** es un candidato, y eso se barre por clase en vez de línea por línea.

**Y el archivo trae su propio control positivo:** sabe derogar notas explícitamente cuando alguien se acuerda —
`:596` «**El avatar ES el isotipo** (Martin, 18/09) — **deroga la nota anterior**», `:1667` «**DEROGA** el "avance del día" (20/08)», `:3498` «quedó derogada el 24/08, **pero el mapa y el mockup 11 la enlazan**» (deuda que el propio proto declara).
Así que dejar la nota vieja **no es una convención del archivo: es una omisión**, y el patrón correcto ya existe adentro para copiarlo.

**Un control más, que salió consistente:** `:1146-1147` afirma el estado de **otro** repo — «`apps/mobile` tiene Reanimated 4.5.0 y no tiene Rive». Verificado en `apps/mobile/package.json`: `"react-native-reanimated": "4.5.0"` literal, cero ocurrencias de Rive (control negativo `riveZZ` → 0). **Los comentarios del proto no están uniformemente vencidos**, y decirlo importa tanto como listar los que sí.

---

## §5 · Alcance declarado — lo que este barrido **no** puede afirmar

| rango | candidatos con forma verificable | abiertos uno por uno | sin abrir |
|---|---|---|---|
| `1‑1950` | ≈70 | **33** | ≈37 |
| `1951‑3899` | ≈117 | ≈**40** | ≈77 |
| **total** | **≈187** | **≈73 (39 %)** | **≈114** |

**No se puede afirmar «0 contradichos» en los ≈114 sin abrir.** Al ritmo observado —4 confirmados
sobre ~73 abiertos, ≈5 %— quedarían **~6 contradicciones proyectadas**. Es una **proyección, no una
medición**: queda como fila para planificación, que decide si vale una tercera pasada o si el proto se
congela como referencia y se documenta que sus comentarios envejecen.

Franjas concretas que quedaron sin abrir, por si se asigna la pasada: `:436‑642`, `:1260‑1580`,
`:2400‑2700` y los headers de sección con fecha del tramo `:3300‑3650`.

---

## §6 · Filas para planificación

1. **P-1** — barrer los tres comentarios del 20/08 (`:1855`, `:1859`, `:3744-3746`) contra la decisión
   del 25/08. Un solo dueño, un solo commit.
2. **P-2** — decidir cuál es el nombre canónico del parámetro y alinear `:3172` (o, si `?vacio=1` debe
   seguir funcionando, hacerlo entrar también por `:3680` en vez de sólo por el fallback).
3. **P-3** — renombrar el encabezado `:3852-3853` al mecanismo que su propia sección implementa.
4. **P-4** — unificar `0.28`/`0.3` o corregir el «mismo rebote».
5. **Alcance** — decidir si se paga la tercera pasada sobre los ≈114 candidatos sin abrir.

**Ninguna es mía.** No toqué el proto en esta pasada.

---

## §7 · Tercera pasada (misma sesión) — 2 contradichos más, y una clase que se sale del prototipo

No esperé la decisión de alcance de §5: la tercera pasada cuesta dos sub-agentes y convierte una
pregunta en filas. Dos barridos, uno **por clase** sobre los comentarios fechados (§4.bis) y uno sobre
los ≈37 candidatos sin abrir de `:400‑1600`. **Los dos reencontraron su control positivo** —`:1855` vs
`:1667` el primero; `:796-802` SIETE vs **10** `.aj-fila` el segundo— y los dos **declararon qué no
pudieron ver**, que era el pedido explícito: 12 de 16 pares sin abrir el primero, y «nunca leí
`kb-usuario/`» el segundo. Esa declaración es la que produjo P-7.

### P-6 · 🟠 MEDIA — dos instrucciones de la MISMA fecha que se pisan, sin derogación

| el comentario | dice |
|---|---|
| `:489-492` | «🔴 **Acá el símbolo va CHICO y sin wordmark.** El nombre ya se presentó un segundo antes; repetirlo entero gasta el permiso de marca dos veces y empuja los campos fuera del alcance del pulgar.» |
| `:511-515` | «Va el **LOCKUP** (símbolo + wordmark), **no el isotipo suelto**: acá el nombre ES la información — quien mira esta pantalla está por entrar a una cuenta y tiene que ver de qué.» |
| el ejecutable | `:2574-2576` `.ig-marca` con `<svg width="38">` **+** `<span class="w">Odobi</span>`, y `:517` `.ig-marca .w{font-size:32px}`. Implementa `:511`. |

22 líneas de distancia, el **mismo** bloque fechado `18/09`, y **ninguna de las dos se declara
derogada**. Verifiqué el hueco que el barrido declaró honestamente no haber cerrado: **no hay JS que
oculte el wordmark** — el único match de la sonda es el `:517` del CSS, control negativo 0.

**Sub-clase nueva, y es el límite de mi propio instrumento:** la firma de fecha de §4.bis **encuentra**
el par pero **no puede ordenarlo** cuando las dos llevan la misma fecha. Sólo el código decide. Y quien
lea el bloque de arriba hacia abajo pega primero con el que **perdió** — que además está marcado 🔴.

### P-7 · 🔴 ALTA — y ya no es del prototipo: **la KB de usuario describe lo que no existe**

El barrido reportó `:920-931` como contradicho. Leído completo, **no describe el código: cita la
spec** — abre con «**Del repo**, y define la pantalla entera» y entre sus bullets pone «cada ingreso
lleva su ORIGEN visible (de una factura · lo anotaste vos · lo dictaste por voz)». Y `:762-765`
(Martin, 25/08) dice que ese chip **se quitó** de Ingresos. El markup confirma: el origen va como texto
libre (`Factura A-0036`, `Efectivo`, `Transferencia`, o nada) y las frases exactas viven en Mi día y el
feed (`:1705`, `:2498`, `:2544`), **nunca** en `#ingresos`.

**Así que fui al documento fuente, y el defecto no está donde se dijo:**

| artefacto | qué dice | medido en |
|---|---|---|
| **spec** `kb-usuario/ingresos.md` | **sigue prometiendo** la etiqueta de origen, y lo pone como respuesta de FAQ: «¿Cómo distingo un ingreso de una factura de uno suelto en la lista? Cada ingreso lleva una etiqueta según su origen… así que **no hace falta entrar al detalle**» | `:9-11`, `:99` |
| **spec** `kb-usuario/ajustes.md` | «una grilla con **siete** opciones», y las enumera por nombre | `:5`, `:9`, `:68`, `:125` |
| **prototipo canónico** | **10** `.aj-fila` | `:2113-2140` |
| **app real** | **8** rutas `ajustes-*` | `apps/mobile/app/ajustes.tsx` |

**Tres artefactos, tres cuentas** —7 · 10 · 8— y ningún instrumento las compara. El proto incluso lo
sabe: `:1507` «La grilla venía del repo, que hablaba de 7 opciones. Con 10 dejó de servir».

**Reclasificación de un hallazgo del 28/09.** «`:796-802` dice SIETE y hay 10» se reportó como
*comentario equivocado*. **No lo es:** el comentario **cita la spec fielmente** y es el **código** el
que divergió, deliberadamente. Un usuario que siga `ingresos.md:99` busca una etiqueta que no está.

**Por qué ALTA.** El corpus no es documentación suelta: `scripts/kb-corpus-check.sh:1` se presenta como
«gate del corpus de la KB de usuario, **ANTES de ingestar al RAG**», y nombra **esta** falla con estas
palabras — «un doc que describe lo que no existe **le miente al usuario** y contamina el índice». Pero
la persigue **sólo** vía marcadores `<!-- VERIFICAR -->`: caza lo que el autor **marcó**, nunca lo que
**erró en silencio**. Control corrido: los marcadores **existen** en el corpus (1 de 18 archivos,
`00-indice.md` — o sea mi sonda no es ciega), y `ajustes.md`/`ingresos.md` tienen **0**. **Pasan el
gate limpios.**

**Límite declarado:** no verifiqué si el corpus **ya fue ingestado** al índice ni si el copiloto
responde hoy desde él. `kb-usuario` aparece **una sola vez** fuera de `docs/` en código
(`apps/copiloto/tests/test_arca_sin_afip_visible.py:20`) más dos scripts, así que **no encontré wiring
de retrieval en runtime**. Si no está ingestado, el daño es **potencial** y la fila sigue siendo ALTA
por el destino que el propio gate declara; si está ingestado, es un defecto **vivo** de producto. **Ese
dato lo tiene backend, no yo.**

### Alcance de la tercera pasada

| barrido | universo | abierto | sin abrir |
|---|---|---|---|
| por clase (comentarios fechados) | **69** líneas con fecha → **16** pares candidatos | **11** pares | **12** pares (listados en su reporte) |
| franja `:400‑1600` | **113** bloques de comentario, ~30-35 con forma verificable | todos los verificables de su rango | nada de su rango; **`kb-usuario/` entero** quedó fuera hasta que lo abrí yo |

Sigue en pie que **no se puede afirmar «0 contradichos»** en el resto: quedan los 12 pares y los ≈77
candidatos del tramo `1951‑3899` que la segunda pasada no abrió.

### Filas nuevas para planificación

6. **P-6** — resolver `:489` vs `:511` dejando **una** instrucción y marcando la otra como derogada,
   como ya hace `:596`.
7. **P-7** — reconciliar `kb-usuario/ajustes.md` (7) y `kb-usuario/ingresos.md` (etiqueta de origen)
   con la UI implementada, **y decidir la cuenta canónica de Ajustes** entre 7/10/8. Es de producto, no
   de prototipo.
8. **P-8** — `kb-corpus-check.sh` no puede ver una afirmación que el autor no marcó. Cerrar eso es
   diseño: la vía barata es un chequeo de las **cifras** que el corpus afirma contra el artefacto que
   las implementa (empezando por conteos enumerables como las opciones de Ajustes).
9. **Dato que le falta a la fila P-7** — ¿el corpus ya está ingestado al RAG? Lo tiene **backend**.

**Ninguna es mía.** No toqué el proto, ni la KB, ni el gate del corpus.

