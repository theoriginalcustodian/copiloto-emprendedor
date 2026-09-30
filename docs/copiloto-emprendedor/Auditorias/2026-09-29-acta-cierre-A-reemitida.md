# Acta del Cierre A — **re-emitida** el 2026-09-29

> **Reemplaza a [`2026-09-22-auditoria-A4-cierre-A.md`](2026-09-22-auditoria-A4-cierre-A.md)** en todo
> lo que diga sobre el **conteo del criterio 3** y sobre el **eje de plataforma**. El resto de esa acta
> sigue vigente. Emitida por **planificación**, que es la dueña del registro; los números del criterio 3
> los midió **auditoría** y se citan como suyos.
>
> **Por qué se re-emite, en una línea:** el acta del 22/09 afirmaba «29 de 54» y esa cifra **no salió de
> ninguna medición** — ninguna de las seis definiciones de conteo que auditoría probó la reconstruye. Era
> un arrastre. Un acta de cierre con un número heredado es peor que sin número: **el número da la
> sensación de que alguien contó.**

---

## 1 · Los tres defectos del acta anterior, y quién los cometió

| # | defecto | de quién | cómo se detectó |
|---|---|---|---|
| 1 | **«29 de 54» sin medición detrás** | mío (planificación) — lo arrastré sin volver a contar | auditoría probó **seis** definiciones de conteo distintas y ninguna da 29 |
| 2 | **Ninguna fila declara `plataforma`**, aunque el criterio se creía de dos plataformas | mío | auditoría, barriendo los 34 veredictos |
| 3 | **Los 34 veredictos vivían en `coordinacion/`, que está gitignoreada** | mío, por diseño del buzón | auditoría: todo barrido basado en el repo era estructuralmente ciego a la mitad del registro |

El defecto 3 es la causa de fondo de los otros dos: **un registro que no está versionado no se puede
auditar contra el código, así que sus cifras envejecen sin que nada las contradiga.** El `(ver: ...)`
del `plan-drift-check` y el docstring versionado salieron de la misma raíz.

---

## 2 · 🔴 Decisión de alcance: el criterio 3 **no tiene** eje de escritorio, y nunca lo tuvo

Auditoría reportó que el prototipo es mobile-only y que por lo tanto comparar `@desktop` produce
artefactos. **Lo verifiqué y es correcto, pero la conclusión es más fuerte que recortar alcance.**

**Medido en `Prototipo frontend/odobi-ui/prototipo/index.html`:** de **3900 líneas**, hay **una sola**
media query de layout (`:63`, `min-width:520px`) y las otras seis son `prefers-reduced-motion`. Lo que
esa única regla hace lo dice su propio comentario, dos líneas arriba:

```css
/* En el teléfono ocupa todo; en escritorio, un marco de 390×844 para verlo en contexto. */
@media (min-width:520px){ #app{width:390px;height:844px;border-radius:40px; …} }
```

A 1440 el prototipo **no reflowea: dibuja una maqueta de teléfono centrada.**

**Y el eje no viene del criterio.** Medido en la spec
([`2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md`](../2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md)):
las palabras `escritorio`, `desktop`, `1440` y `viewport` **no aparecen ni una vez**. Y sus «2
columnas» —que se venían leyendo como dos plataformas— son un **layout de tabla partida en dos
mitades** para que quepa: la cabecera (`:36`) es literalmente
`| ?ver= | Ítem que la cubre | | ?ver= | Ítem que la cubre |`.

⇒ **El eje escritorio lo introdujo el instrumento, no el criterio.**
`scripts/evidencia/criterio3-matriz.mjs:129` itera `[['390', MOVIL], ['desktop', DESKTOP]]`, y su
línea 2 lo declara: *«a 390 y a escritorio, lado a lado con el prototipo final»*.

### Los tres ejes, y cuál es medible

| eje | ¿medible? | qué es |
|---|---|---|
| **app@390 vs proto@390** | ✅ sí | **ES el criterio 3.** La referencia existe para este viewport |
| **app@1440 vs proto@1440** | ❌ **no** | La referencia **no existe por diseño**. Todo desvío que salga de acá es artefacto del instrumento |
| **app@390 vs app@1440** | ✅ sí, y es útil | Consistencia interna de la app, **no** paridad con el proto. De acá salió `C3-12` |

**Decisión (planificación):**

1. **El criterio 3 es `@390`.** No se recorta nada: se corrige el instrumento para que mida lo que el
   criterio pide. **El denominador sigue en 54** y no se pierde ninguna fila.
2. **Se dejan de generar los `…-proto-desktop.png`.** Son 10 archivos cuyo **nombre afirma una
   comparación que no se puede hacer** — evidencia envenenada, y peor que un instrumento que falla,
   porque acusa al producto por un defecto propio. Las `…-app-desktop.png` **se conservan**: alimentan
   el tercer eje, que sí es medible.
3. **El tercer eje se queda, con nombre propio.** `app@390 vs app@1440` es un frente de consistencia
   interna. Ya rindió: `C3-12`.
4. **Una referencia de escritorio es un MAYOR y NO entra a la definición de terminado de este sprint.**
   Serían 27 pantallas de diseño nuevo. Entra al tablero con gate — es la misma decisión que tomé hoy
   con `FACTIDFIX`, y por la misma razón: **agregar un MAYOR a la definición de terminado a mitad de
   sprint es lo que estiró este sprint una semana.**

### Qué le pasa a la columna `plataforma` del defecto 2

Sigue siendo necesaria, **pero lo que hay que declarar no es la plataforma: es el EJE.** Con el
criterio en `@390`, «plataforma» sería una constante — y una columna constante no discrimina nada. El
campo es `eje ∈ {paridad@390, consistencia-app}`.

⚠️ **Y esto no absuelve a los 34 veredictos previos.** Ninguno declara contra qué midió, así que **no
se puede saber cuáles compararon contra `proto-desktop`**. No afirmo que estén mal; afirmo que **no son
verificables**. Los que hayan medido escritorio contra el proto no valen. Quién lo determina y con qué
costo: **auditoría**, y es lo primero que le toca del criterio 3.

---

## 3 · El conteo, medido — y la distinción que faltaba

El acta anterior tenía **una** columna de progreso. Eso es lo que permitió que un número envejeciera:
**«medido» y «coincide» no son lo mismo**, y un acta que los mezcla no puede decir si falta trabajo de
medición o trabajo de frontend.

| estado | cuántos | qué significa |
|---|---|---|
| **Con veredicto emitido** | **43 de 54** | alguien lo miró y escribió el resultado |
| ↳ de ésos, **coinciden** | ver §3.bis | sin desvío contra la referencia |
| ↳ de ésos, **con desvío abierto** | ≥ 3 | medido, y **genera trabajo de frontend** |
| **Sin veredicto** | **11** | nadie lo midió todavía |

**Cómo se llega a los 43** (todas las cifras son mediciones de auditoría, no mías):

- **37** era la cifra medida que reemplazó a mi «29» — con los 17 restantes descompuestos en
  **5 + 3 + 9**.
- **+1 = 38:** `(home)` quedó medido, y **no** por una corrida del instrumento sino por lectura de
  código, que es una de las cuatro vías que el contrato admite. El cuerpo de la home es el **mismo
  componente** que `tablero` (`MidiaScreen.tsx:192` es el único lugar que monta
  `data-testid="pantalla-midia"`; los otros 7 hits son tests), así que el veredicto de `tablero` lo
  cubre. Lo único propio de la home es el ruteo por defecto, y está verificado con test en los dos
  breakpoints (`AppShell.test.tsx:61-68`, `ResponsiveShell.test.tsx:61-70`) contra
  `AppShell.tsx:31` `DEFAULT_TAB = 'midia'`.
- **+5 = 43:** población A corrida completa (20 PNG, `criterio3-caminos.json`, exit 0).

**Los 11 sin veredicto** = **3** (el motivo ya está escrito en `MEDIBILIDAD` y nadie lo pasó al
registro — es trabajo de transcripción, no de medición) **+ 8** (población C, trabajo real de frontend).

### 3.bis · Lo que NO puedo afirmar, y por qué lo digo en vez de completarlo

**No tengo el desglose coincide/desvío de los 38 previos**, porque esos veredictos viven en el buzón
gitignoreado (defecto 3) y no los volví a medir. **No lo estimo.** El acta anterior se rompió
exactamente por rellenar un hueco así con un número plausible.

**Dueño:** auditoría, en la misma pasada en que determine cuáles midieron contra `proto-desktop`. Las
dos preguntas se contestan leyendo las mismas 38 filas, así que es **una** pasada, no dos.

---

## 4 · Los desvíos abiertos de población A (medidos @390, todos de frontend)

| id | veredicto | qué desvía |
|---|---|---|
| `apar` | ✅ COINCIDE | — |
| `comousar` | 🔴 DESVÍO | el proto numera los 5 temas 1-5 con chevron en una tarjeta única; la app no, y **agrega** una sección «LO QUE LE PODÉS PEDIR» entera |
| `esc` | 🔴 DESVÍO | «Funciones» vs «**Tus funciones**», y **la fila 1 del grid invertida**: app `Facturación·Ingresos·Gastos`, proto `Gastos·Ingresos·Facturación` |
| `soporte` | 🔴 DESVÍO | el proto tiene breadcrumb y H1; la app mete el título dentro de la burbuja · emisor distinto · **mic en la app vs adjuntar en el proto** |
| `factura` | ⚠️ NO MEDIBLE | la app sale **sin datos** en el listado — es un problema de datos de prueba, no de paridad |

**`factura` no cuenta como gap de paridad**, igual que `cobro-voz` (§5): un id que no se puede
ejercitar por una causa ajena al criterio está **medido**, y su estado es la causa.

---

## 5 · Gates que este acta incorpora

**🛑 `cobro-voz` NUNCA se ejercita end-to-end.** Generaría un cobro real de MercadoPago. Se mide hasta
el borde; su estado es `NO_EJERCITABLE_POR_EFECTO_EXTERNO`, y eso **cuenta como medido, no como gap**.
Sólo el operador puede levantarlo.

**🛑 La beta no va a un emprendedor con AFIP producción vinculada hasta que cierre `FACTIDFIX`.** El
doble toque de facturar emite **dos comprobantes reales con dos CAE y cero excepciones** (medido por
backend contra Postgres real). El ambiente AFIP es **per tenant**, así que el usuario canónico de
prueba tiene efecto fiscal cero y un emprendedor con producción vinculada está realmente expuesto.
`FACTIDFIX` está **fuera** del Cierre A, con fila propia.

---

## 6 · Estado de los cuatro criterios

| # | criterio | estado | dueño de lo que falta |
|---|---|---|---|
| 1 | filas del backlog A4 | ✅ cerrado | — |
| 2 | **drift del plan detectado por instrumento** | ✅ cerrado | `scripts/plan-drift-check.sh`, con autotest y canario. Protocolo `(ver: ...)` documentado en el docstring versionado |
| 3 | **los 54 ids sobre el SHA actual** | 🟠 **43 de 54 con veredicto**, eje de escritorio retirado del criterio | auditoría (11 sin veredicto + la pasada de verificabilidad de los 38) · frontend (los 3 desvíos + los 8 de población C) |
| 4 | interruptores del operador (Cierre B) | ⏸️ diferido | operador |

**Criterio de cierre binario del criterio 3, declarado acá para que no vuelva a envejecer:**
los 54 ids tienen veredicto emitido **con su `eje` declarado**, y todo id sin veredicto tiene escrita
la causa por la que no lo tiene. Un desvío **no** bloquea el cierre del criterio 3 — bloquea la fila de
frontend que lo arregla. **Son dos cierres distintos y mezclarlos es lo que hizo ilegible al anterior.**

---

## 7 · Deuda declarada de esta acta

| qué | dueño | disparador |
|---|---|---|
| Los 34→38 veredictos no son verificables (sin `eje`) | auditoría | la pasada de §3.bis |
| El registro vive en `coordinacion/`, gitignoreado | planificación | **MAYOR**: mover el registro de veredictos a `docs/` versionado. No en este sprint |
| `C3-12` — «Facturado este mes» da `$165.000,00` @390 y `—` @1440 | frontend | fila propia en el tablero; **no es criterio 3** |
| Referencia de escritorio del prototipo | operador/diseño | **MAYOR con gate**, fuera de la definición de terminado |

🤖 planificación · 2026-09-29
