# §13 punto 1 — el acta dice lo contrario que el doc de cierre, y el código dice una tercera cosa

**Auditoría · 2026-10-08** · **sujeto declarado:** worktree `/c/gfw-src/wt-aud-p1`, medido sobre
`origin/main` = **`3bb88882`**. Con este doc, auditoría midió **los cinco puntos** del criterio §13.

> **Por qué este punto y por qué recién ahora.** El punto 1 («todos los `DEC-*` con acta») es el único
> de los cinco que ninguna sesión había re-medido: estaba marcado ✅ desde el principio y nadie volvió.
> Un ✅ que nadie vuelve a tocar es exactamente donde se esconde el drift
> (`el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio`).

## 1 · Lo que afirma el doc de cierre

`ALCANCE-CIERRE-BETA.md:118`:

> *«✅ **13 DEC en la tabla, ninguno marcado abierto.** `DEC-11` está **decidido** («se corrigen, sin
> excepción firmada»); lo que queda de él es ejecución vía `BL-Q4`, no decisión»*

Medido: el acta tiene **13 ids `DEC-*`** (`DEC-1`..`DEC-13`), y el conjunto de ids citados en **todo**
`docs/copiloto-emprendedor/` es **el mismo** — no hay `DEC` huérfano fuera del acta. Esa mitad de la
afirmación es correcta.

## 2 · Lo que dice el acta, y es lo contrario

| línea | qué dice | fecha |
|---|---|---|
| `acta:21` (**tabla**) | `DEC-11` → *«los dos contrastes que fallan (sello de acción, botón de grabar) **se corrigen**, sin excepción firmada»* | 21/09 |
| `acta:44` (**prosa**) | *«`DEC-11` (contrastes) está **abierto** desde la actualización del 29/09: no es deuda de documentación, es una decisión de diseño sin tomar»* | 29/09 |
| `acta:59` (tabla `DA-4`) | *«contrastes **reabiertos** 29/09 (`DEC-11`)»* | 29/09 |
| `acta:98` (**bloque ⚠️**) | título literal: *«ACTUALIZACIÓN 2026-09-29 — **`DEC-11` NO está cerrado**, y no es deuda de documentación»* | 29/09 |

El doc de cierre cita la fila del **21/09** y afirma «ninguno marcado abierto». El acta marca
`DEC-11` **abierto** en tres lugares, todos **8 días más nuevos** que la fila citada. Mismo sujeto
(el estado de `DEC-11`), misma vara (decidido / sin decidir), veredictos opuestos.

⚠️ **Esto no es un puntero mal leído.** Es la distinción que esta sesión ya pagó una vez hoy: un
artefacto que **cita** el estado de otro no contradice a nadie. Acá las dos frases **afirman** el
estado, y la más nueva dice «abierto».

## 3 · Lo que dice el código — y acá se cae mi propia sospecha

Entré a medir esperando confirmar que `DEC-11` seguía sin resolverse. **No es así:**

- **`DEC-11` Pieza A: HECHA.** `apps/mobile/src/modules/chat/BotonVoz.tsx:318-332` usa el degradado
  radial `glass.ub1 → glass.ub2`, con el comentario que nombra el id:
  `DEC-11/DEC11FILL, Pieza A — antes `accent2 -> acento` daba 1,26:1 con el isotipo blanco`. Es
  **exactamente** el fix de fill que el bloque del 29/09 recomendaba.
- **Y tiene guard de regresión**, que es más de lo que el acta pedía:
  `apps/mobile/src/theme/paresPintadosContraste.test.tsx:905` — *«el botón de voz (esfera) no vuelve
  al degradado que terminaba en accent2 (1,26:1)»*. Más el trinquete de `:925`: *«si aparece un
  SEGUNDO par en esta lista, el cambio afloja el gate»*.

⇒ **El acta quedó vieja y nadie retiró su bloque.** El doc de cierre acertó el estado de esa mitad, y
lo justificó con la fila vieja en vez de con el código.

### El control positivo que corrí y declaro NULO

Mi primer control fue grepear `ub1|ub2` en `HudGrabacion.tsx` —el hermano que el acta cita como
precedente— esperando ≥1 hit. Dio **0, porque ese path no existe en `origin/main`**: el control no
validó nada, y un 0 de un archivo inexistente es indistinguible de un 0 real
(`vacio-no-es-hallazgo-correr-el-control`). Lo que sí vale como evidencia: el comentario que nombra
`DEC-11` **dentro** de `BotonVoz.tsx`, y que el grep de `DEC11FILL` devuelve **1 + 4 hits** en dos
archivos distintos, o sea que no está ciego.

## 4 · La mitad que queda, y la pregunta que sólo el operador contesta

El segundo par de `DEC-11` —el **sello de acción**, isotipo blanco sobre acento sólido— **sigue en la
lista de pares como excepción**: clase `logotipo`, `min: 3.16`
(`paresPintadosContraste.test.tsx:836` y `:849`, *«isotipo Odobi (trazo blanco) sobre acento sólido»*).

Dos lecturas, las dos defendibles, y por eso no la resuelvo yo:

- **A favor de que está bien:** WCAG 1.4.3 **exime** el texto que es parte de un logotipo o nombre de
  marca. Y el propio bloque del 29/09 dice que invertir el isotipo *«es una decisión de identidad
  visual, que no es de una sesión»* — o sea que **no tocarlo fue el diferimiento correcto**.
- **A favor de que no:** `DEC-11` dice textual *«se corrigen, **sin excepción firmada**»*. El sello
  vive hoy como excepción **de clase**, y una clase no es una firma.

> **Pregunta abierta, del operador: ¿firmó la clasificación `logotipo` del sello?** Si la firmó,
> `DEC-11` está cumplido y el punto 1 es ✅ limpio. Si no, `DEC-11` está incumplido **en sus propios
> términos**, por una excepción que nadie firmó. **No lo afirmo en ninguna dirección: es una firma,
> y las firmas no las infiere un agente.**

## 5 · Veredicto binario

> **§13 punto 1: 🟠 NO se puede declarar ✅ leyendo el acta, porque el acta afirma lo contrario en su
> contenido más nuevo (`:44`, `:59`, `:98`). El código resuelve una de las dos mitades (Pieza A,
> con guard); la otra depende de una firma del operador que no está registrada.**

Lo accionable, sin abrir trabajo nuevo:

| qué | dueño |
|---|---|
| Retirar o fechar el bloque `⚠️ 2026-09-29` del acta, que hoy contradice al doc de cierre | **planificación** |
| Que el punto 1 del doc de cierre cite **el código** (`BotonVoz.tsx:318`, el guard `:905`) y no la fila del 21/09 | **planificación** |
| La firma —o la negativa— sobre la clase `logotipo` del sello | **operador** |

## 6 · Los cinco puntos de §13, medidos por auditoría

| punto | veredicto | de quién depende lo que falta |
|---|---|---|
| 1 · `DEC-*` con acta | 🟠 acta vieja + una firma sin registrar | planificación + **operador** |
| 2 · familias `BL-*` con su DoD | ✅ **0 filas asignables** (doc del punto 2, hoy) | — |
| 3 · matriz ✅ web **y** mobile | 🔴 **inalcanzable este sprint** (web 54/54 · mobile 13/54) | device, diferido 22/09 |
| 4 · smoke verde contra prod | ✅ **cumplido hoy** (ver §7) | — |
| 5 · tester externo con video | 🔴 | **operador** |


**Ninguno de los cinco está esperando una línea de código de producto.** Dos esperan al operador (la
firma del punto 1, el tester del punto 5), uno es device diferido, y dos están cerrados.

## 7 · El punto 4 cambió de color MIENTRAS escribía esto — y lo verifiqué yo

Cuando empecé este doc, el punto 4 estaba 🔴 en `ALCANCE-CIERRE-BETA.md:103,130` y en mi propio
`urgente_` de la mañana, los dos citando el mismo mecanismo: *«`smoke_beta_e2e.py:19` importa
`meclaves_check` y `run-smoke-prod.sh` lo pipea por stdin, así que el import no resuelve»*. **Esa
causa estaba vencida:** el bug del pipe-por-stdin se arregló el 07/10 (#908). Lo que seguía roto hoy
era otra cosa —`run-smoke-prod.sh` no exportaba `UC_LOGIN_CONTRATO_PATH`, el contrato nuevo que
agregó el #926— y lo cerró el **#932**.

**Lo que verifiqué con mis manos, y no es el eco del SHA:**

| control | resultado |
|---|---|
| `#932` mergeado | `MERGED`, merge commit **`c5727e5d`**, 13:04:17Z |
| SHA vivo en prod (`GET /healthz`) | **`92fd8a06`**, arrancado **13:15:13Z** — 11 min *después* del merge |
| `c5727e5d` es ancestro de `92fd8a06` | **SÍ** ⇒ el proceso vivo **contiene** el fix, no sólo es «del mismo día» |
| `92fd8a06` está en `origin/main` | SÍ |

**Lo que NO verifiqué yo, y lo atribuyo:** la corrida del smoke (39/39, 7/7 críticos, 0 `[FAIL]` por
grep del log completo) y la durabilidad post-restart 8/8 son **evidencia de backend**, en su `cierre_`
de hoy. Vive en un log del VPS que desde la PC no leo, y no voy a entrar por ssh para citarlo. La
mitad que sí es mía —**que el binario que corrió ese smoke contiene el fix**— es la de arriba.

⚠️ **Lo que esto enseña, y es más grande que la fila.** Los puntos 2 y 4 llegaron a ✅ **el mismo día
en que el doc los declaraba 🔴** — el 2 lo cerré yo esta mañana, el 4 lo cerró backend. Un doc de
cierre no envejece en semanas: **envejece en horas**. Y las dos filas rojas no estaban equivocadas al
escribirse: estaban citando una causa que ya había muerto. ⇒ **el estado de un criterio de cierre se
re-mide al DECLARAR, no al planear** (`un-inventario-de-procesos-vivos-es-un-snapshot-no-un-estado`).

Lo que queda, entonces, es más chico de lo que decía el doc esta mañana: **§13 = 1 🟠 · 2 ✅ · 3 🔴
device · 4 ✅ · 5 🔴 device**. Dos de los cinco dependen de la tanda de device que el operador
difirió el 22/09, y uno de una firma suya. **Cero código de producto.**

— AUDITORÍA (Opus 5, 1M)
