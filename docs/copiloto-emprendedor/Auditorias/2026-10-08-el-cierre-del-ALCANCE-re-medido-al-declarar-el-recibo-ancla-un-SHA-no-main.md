# El cierre del ALCANCE, re-medido al DECLARAR: el recibo ancla un SHA, y «main» no es un SHA

**Auditoría · 2026-10-08** · **sujeto declarado:** `origin/main` = **`50c81351`**, worktree
`/c/gfw-src/wt-aud-misfilas`. Instrumentos: `scripts/recibo-cubre.sh`, `git rev-list`, `git show <ref>:<path>`.

> **Por qué este criterio y por qué recién ahora.** Medí los cinco puntos de **§13** —el cierre de la
> BETA— y nadie había medido el criterio del **cierre del ALCANCE**, que es el corto, el de este
> documento, y **el que el operador va a declarar hoy**. Estaba marcado `✅ CUMPLIDO Y VERIFICADO` y
> nadie volvió. Sería la forma más caricaturesca del error del día: auditar con lujo de detalle el
> criterio contra el que **no** se cierra.

## 0 · Veredicto binario

> **El cierre del ALCANCE es ✅ DECLARABLE HOY — pero sobre `92fd8a06`, no sobre «`main`».**
> Las 7 filas están mergeadas ahí, el recibo **CUBRE** ese SHA, y **ninguna de las 7 envejeció** en
> los 12 commits posteriores. Lo que **no** es declarable es «el ALCANCE está cerrado sobre `main`»:
> para `50c81351` **ningún recibo cubre**, y mientras las sesiones sigan mergeando, **ningún SHA de
> `main` va a tener uno**.

## 1 · El criterio, textual

`ALCANCE-CIERRE-BETA.md` lo define en una línea:

> *«Las **7** filas de arriba mergeadas — `A3` · `A5` · `A7` · `A8` · `P1` · `P3` · `C1` — con su DoD
> cumplido y el recibo de `scripts/gate.sh` citado **por su SHA**»*

Tres exigencias, y las tres se miden distinto. La tercera es la que decide, porque es la única que
nombra un **SHA**: un recibo no atestigua «el proyecto», atestigua **un árbol**.

## 2 · Las tres exigencias, medidas

| exigencia | resultado | instrumento |
|---|---|---|
| 7 filas mergeadas | ✅ las 7, en `92fd8a06` | el propio doc, fila por fila |
| DoD cumplido | ✅ las 7, **y sigue cumplido hoy** (§4) | `git show <ref>:<path>` |
| recibo del SHA | ✅ **para `92fd8a06`** · ❌ **para `50c81351`** | `recibo-cubre.sh` |

```
recibo-cubre.sh 92fd8a06  ->  ✅ CUBRE   (.git/ci-recibos/92fd8a06….json · sesión plan · 13:30:57Z)
recibo-cubre.sh 50c81351  ->  ❌ ningún recibo cubre 50c81351 (árbol 2e26ef7e; 0 con el mismo árbol)
```

**Control positivo del instrumento, y no es decorativo:** el mismo script **reprueba** a un recibo que
sí existe (`096d8d08`: *«mismo árbol, NO cubre — corrieron con el árbol SUCIO, lint=failed»*) y
**aprueba** a `92fd8a06`. Discrimina en las dos direcciones ⇒ el ❌ de `50c81351` es un cero real, no
ceguera (`vacio-no-es-hallazgo-correr-el-control`).

## 3 · La pregunta que decide: ¿el ✅ de ayer envejeció?

Un recibo de `92fd8a06` sólo sirve hoy si **lo que atestigua no cambió**. `main` avanzó **12 commits**
desde ahí. Medí los 7 archivos de las filas cerradas, uno por uno:

| fila | archivo | commits después de `92fd8a06` |
|---|---|---|
| `A3` | `apps/mobile/src/modules/facturacion/SeccionMisComprobantes.tsx` | **0** |
| `A5` | `apps/copiloto-web/src/modules/chat/HitlCard.tsx` | **0** |
| `A5` | `apps/mobile/src/modules/chat/ListaMensajes.tsx` | **0** |
| `A7` | `apps/copiloto/services/drive.py` | **0** |
| `A8` | `apps/copiloto/services/sheets.py` | **0** |
| `P1` `P3` | `docs/…/2026-09-21-acta-decisiones-beta-odobi.md` | **1** (`2cd29750`, #942) |
| `C1` | `scripts/foco-check.sh` | **0** |

**Control del instrumento:** el mismo `rev-list` da **5** para `ALCANCE-CIERRE-BETA.md` (que sé que
cambió cinco veces hoy) y **0** para un path inventado. Mide, y el `0` de las seis filas de código es
un cero real.

⇒ **Seis de las siete filas son intactas por construcción: su código no se tocó.** El recibo de
`92fd8a06` sigue atestiguando exactamente el mismo árbol para ellas.

## 4 · La séptima: el acta cambió, y el DoD sobrevivió

`2cd29750` (#942) tocó el acta **después** del recibo, así que el DoD de `P1`/`P3` quedó fuera de lo
atestiguado. No alcanza con decir «es documentación»: lo medí en los **dos** SHAs.

| DoD | en `92fd8a06` | en `50c81351` |
|---|---|---|
| `P1` — el acta declara qué libera la Parte 2 y si la reunión ocurrió (`§1.bis`) | **1** | **1** |
| `P3` — la tabla `§2` con dueño, fecha y plataformas (6 columnas) | **7 pipes** | **7 pipes** |

Y el cambio fue **+24 / −1** (135 → 158 líneas): #942 **agregó** el bloque que marca vencida la
corrección del 29/09 sobre `DEC-11` y no quitó nada de lo que `P1`/`P3` exigen. (Control positivo:
una frase inventada da 0 en el mismo archivo.)

⇒ **el DoD de la séptima fila sigue cumplido hoy**, verificado por contenido y no por «es sólo un doc».

## 5 · El hallazgo: el criterio, leído sobre «main», es una carrera que no se puede ganar

El renglón pide «el recibo de `gate.sh` citado por su SHA». Si ese SHA se lee como **el `main` del
momento de declarar**, el criterio es **inalcanzable mientras haya actividad**:

1. se corre `gate.sh` sobre un SHA (1398 s: ~23 minutos);
2. en esos 23 minutos, otra sesión mergea;
3. el `main` que se quiere declarar ya **no** es el del recibo;
4. volver al paso 1.

Hoy pasó exactamente eso, **12 veces**. No es negligencia de nadie: es la forma del criterio. Es
`idempotencia-con-un-if-tiene-ventana` aplicada al cierre — la ventana entre medir y declarar se llena
de merges.

**Y la salida no baja la vara, la precisa:** se declara contra **un SHA congelado** —el SHA en que la
lista llegó a 7/7, `92fd8a06`— **más** la evidencia de que lo atestiguado no cambió (§3 y §4, dos
comandos con control positivo). Así el cierre **no envejece** aunque `main` avance, que es justo lo que
un cierre tiene que lograr.

> **Fila para que planificación asigne** — `H-ALCANCESINANCLA` 🟠: el renglón que define «cerrado» dice
> «el recibo … citado por su SHA» sin decir **cuál** SHA, y el ✅ de la tabla de DOS CIERRES no lleva
> ninguno. **DoD binario:** el renglón nombra el SHA anclado y exige, junto al recibo, el
> `rev-list --count <sha>..main -- <los 7 paths>` que prueba el no-envejecimiento. **100% LOCAL.**

## 6 · Lo que esto cambia para la declaración de hoy

| | antes de esta medición | después |
|---|---|---|
| cierre del ALCANCE | ✅ sin SHA ⇒ se lee como «sobre `main`», y sobre `main` es **falso** | ✅ **sobre `92fd8a06`**, con el no-envejecimiento probado |
| qué tiene que citar el operador | «el recibo» | `92fd8a06` + `recibo-cubre.sh` ✅ + los 7 conteos de §3 |
| qué sigue bloqueando | — | nada del ALCANCE. §13 sigue en manos del **operador** (device + una firma) |

**Ninguna de las dos cosas que faltan es código de producto**, y el ALCANCE —el criterio corto, el de
este documento— **está cerrado y es declarable hoy citando su SHA**.

— AUDITORÍA (Opus 5, 1M)
