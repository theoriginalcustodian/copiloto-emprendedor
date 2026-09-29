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
| **P-1** | 🟠 MEDIA | **Un edit del 25/08 dejó vivos tres comentarios del 20/08 que describen el mecanismo anterior.** `:1855` «el avance… se muda acá» · `:1859` «su línea de pendientes… ahora quedan **FIJOS**» · `:3744-3746` «el avance se muda al bloque de calma… diciendo **"2 de 6"**». El ejecutable dice lo contrario en dos lugares independientes. | comentarios `:1855`, `:1859`, `:3744-3746` vs código `:3739` y `:3843-3850` | Un solo cambio, **tres** comentarios vecinos sin barrer. Y la contradicción está **fechada**: los tres viejos citan «20/08», el nuevo cita «Martin, 25/08» — el dato para detectarla ya está escrito en el archivo. |
| **P-2** | 🟠 MEDIA | **`:3172` documenta `?vacio=1`; el parámetro que el código lee es `ver`.** La URL documentada **entra a medias**: dispara `:3682` por el fallback `location.search.includes('vacio')`, pero **no** `:3680`, que exige `ver === 'vacio'` para `localStorage.removeItem('odobi-calma-dias')`. | `:3172` vs `:3680`, `:3682`; el nombre real en `:3669`, `:3717`, `:3835` | El **fallback genérico** hace que la URL equivocada *parezca* funcionar. No falla: **difiere**. Quien siga el comentario reproduce un estado distinto del que el comentario promete, y sin síntoma. |
| **P-3** | 🟡 BAJA | **Encabezado vencido sobre código correcto.** `:3852-3853` titula «3 · checkbox, sólo en tarjetas propias» y le atribuye la alternativa de WCAG 2.5.1 a un checkbox: `grep -c 'type="checkbox"'` = **0**. El código de esa misma sección (`:3857`) es el handler de `[data-borrar]` — que **es** la alternativa, como dice `:1427-1432`. | `:3852-3853` vs `:1427-1432`, `:1708`, `:2498`, `:3857` | Se renombró el mecanismo (20/08) y **no el encabezado de su propia sección**. El control funciona; el rótulo quedó del mecanismo retirado. Riesgo real pero acotado: un port que lea el encabezado reconstruye el control equivocado. |
| **P-4** | 🟡 BAJA | **`:3539-3540` «Mismo rebote que el swipe de descarte: pasado el tope avanza el 30 %»** — el descarte usa `* 0.28` (`:3134`), este pull-to-refresh usa `* 0.3` (`:3541`). No es «el mismo». | `:3539-3541` vs `:3134` | Se copió el comentario con el número redondeado. (Los `0.35` de `:2732`/`:2741` son **umbrales**, no factores de rebote: no entran.) |

### P-1, la evidencia enfrentada

| el comentario afirma | el ejecutable |
|---|---|
| `:1859` la línea de pendientes «ahora **queda FIJA**» | `:3739` `$('#prog').style.display = calmo ? '' : 'none'` — **oculta por defecto**. Y el comentario de al lado (`:3736-3738`) lo dice con todas las letras: «La línea de la semana aparece **SÓLO** con el día limpio (Martin, 25/08)». |
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
