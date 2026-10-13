# Ronda 2 — lo que apareció DESPUÉS de congelar el padrón en 54

> **Por qué existe este archivo.** El corpus del mapeo declara: *«Un id que aparezca después va a
> una **lista de ronda 2** y **no reabre** ninguna fila cerrada»*
> (`2026-10-12-mapeo-prototipo-vs-nativo.md`, encabezado). Medido el 2026-10-13: esa lista
> **no existía como archivo** — sólo como frase. Un destino de desborde que no existe no avisa que
> está vacío: lo que se encuentre después de congelar **desaparece**, y la desaparición se ve igual
> que «no había nada». Mismo patrón que un mecanismo roto hacia el «no», que nunca da síntoma.
>
> **Qué NO es.** No es una re-apertura. Ninguna entrada de acá mueve el padrón (**32/54** sobre
> `53786937`) ni cambia un veredicto: por **DEC-18** un hallazgo nuevo no reabre una fila cerrada.
> Entrar acá es exactamente lo contrario de reabrir — es el lugar donde algo espera **sin** inflar
> el criterio del sprint vigente.
>
> **Medido sobre `origin/main` `10d8029a`**, árbol limpio (`C:/gfw-src/wt-medir-main`).

---

## Cómo se buscó, y qué NO puede encontrar este método

1. **Cruce de ids.** Los 85 `id="…"` del prototipo contra los 54 del padrón (quitando el prefijo
   `s-`): **60 sin fila**. Publicar «60 huecos» sería una cifra sin unidad — el padrón mide
   **pantallas y estados**, no nodos del DOM. Clasificados por su clase: de los 60, **uno solo es
   `class="subp"`** (una pantalla): `s-plan`. El resto son botones, rótulos, contenedores de scroll
   y paths de SVG (`cerrar-aj`, `total-gastos`, `scallopPathProto`…), o capas de pantallas que ya
   tienen fila (`midia` → `tablero`, `escritorio` → `apps`, `hilo` → `chat`, `calma` → `vacio`,
   que cita `index.html:1713-1857`).
2. **Cobertura por línea.** Para lo que no tiene id propio: qué rangos de `index.html` citan las 54
   filas, y qué quedó entre dos citas.

🔴 **El punto ciego, declarado porque sin él esta lista parecería completa:** el cruce de ids
encuentra **nodos**, no **mecanismos**. El segundo inquilino de abajo se encontró leyendo los
comentarios del CSS del prototipo, no por su id — su `#snack` tiene id, pero el gesto que lo dispara
vive en cuatro comentarios de diseño sin id ninguno. **Un mecanismo repartido en reglas de CSS y
handlers no tiene un id que cruzar**, así que esta lista es *lo encontrado*, nunca *lo que falta*.
Para afirmar completitud hace falta un barrido por **función** del prototipo, pantalla por pantalla,
que es lo que construyó el mapeo original — y eso es un frente, no un párrafo.

---

## R2-1 · `plan` — «Mi plan»: acciones del mes y límites

| qué | dónde |
|---|---|
| prototipo, pantalla | `index.html:s-plan` (`class="subp"`) — «Mi plan · Profesional», `64 de 200 acciones este mes`, dos bloques «Gasta / No gasta», y la regla del tope: *«Si llegás al tope, Odobi deja de ejecutar pero sigue respondiendo: podés seguir preguntando todo el mes»* |
| prototipo, entrada | fila propia de Ajustes: «Mi plan → Acciones del mes y límites» (`index.html:2108-2140`, 4ª de «Tu negocio») |
| app | **no existe, y es deliberado**: `AjusteKey` tiene 8 claves y ninguna es plan (`PantallaAjustes.tsx:15-23`); salió por **DEC-8** (2026-10-06) con **control negativo** que lo fija (`PantallaAjustes.test.tsx:54-59`, `ajuste-tile-miPlan` nulo) |
| backend | **sin mecanismo de medición de acciones.** Grep de `acciones_mes` / `cuota` / `quota` / `limite_acciones` en `apps/copiloto/*.py` sólo pega en `autosanacion_workflow.py` y `ciclo_autosanacion.py`, que son de otra cosa |

**Por qué entra acá y no al padrón:** no es un hueco del corpus — es **alcance post-beta** con
decisión firmada. Entra para que no se pierda: el prototipo modela una **superficie de producto
entera** (medidor de acciones + qué consume + comportamiento al tope) que hoy no tiene ni fila, ni
backend, ni dueño. **Esto no es una pantalla: es un frente** — cuando se tome, arranca por el
contador del backend, no por la pantalla.

## R2-2 · `descarte` — descartar un aviso deslizando, con «Deshacer»

| qué | dónde |
|---|---|
| prototipo, gesto | *«descartar un aviso deslizando»* (`index.html:1567`), fondo de descarte terracota `#B04A2E` con tacho blanco (`:1580`), y razonamiento de eje en cuatro lugares (`:1289`, `:1341`, `:1374`, `:1429`) |
| prototipo, confirmación | `#snack` → **«Aviso descartado · Deshacer»** (`:2644`, estilos `:1593-1599`) |
| app | el swipe **existe** y está bien hecho: `ReanimatedSwipeable` (`PantallaMiDia.tsx:741`, no un `Gesture.Pan` a mano), con la skill citada en el código (`:704`). Pero **revela botones** —«Avanzar» y «Borrar» (`:706-737`)— y `onBorrar()` **ejecuta de inmediato**: no hay snackbar ni deshacer |
| padrón | **ninguna fila lo cubre.** Ninguna de las 54 cita `:1567-1599` ni `:2644` (las citas vecinas son `:2623` y `:2688-2692`), y ninguna menciona swipe / descarte / deslizar en su divergencia |
| docs | 0 resultados para «descartar un aviso» / «swipe de descarte» / «deslizando» en `docs/copiloto-emprendedor/*.md` |

**Las dos mitades no valen lo mismo, y conviene no mezclarlas:**

- **La forma del gesto** (revelar botones vs. descartar deslizando) es UX, y puede haber sido una
  decisión del contrato §2.3 que pidió «swipe corto» — **no lo afirmo**: no leí ese contrato, y la
  diferencia podría estar decidida.
- **La ausencia de «Deshacer» es lo que muerde**, y es independiente de la forma: hoy «Borrar»
  es una acción **destructiva e inmediata** sobre una fila de Mi día, y el prototipo la diseñó con
  una ventana de reversa. Eso no es estética: es la diferencia entre un error recuperable y uno que
  no. **Entra como el ítem con prioridad de esta lista.**

---

## Regla de esta lista

1. **Una entrada NO reabre nada.** Si al medirla aparece que una fila cerrada estaba mal, eso va
   como **enmienda anotada** en la fila (con su evidencia), y el padrón no se mueve — DEC-18.
2. **Cada entrada declara qué midió y qué no.** Una entrada sin `path:línea` de los dos lados
   (prototipo y app) es una sospecha, no una entrada.
3. **No se prioriza acá.** Esta lista no compite con el sprint vigente; la toma el operador o la
   planificación al abrir la ronda siguiente. Lo único que esta lista garantiza es que **existe el
   lugar**: eso era lo que faltaba.
