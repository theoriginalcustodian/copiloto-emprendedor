---
name: una-tabla-ignora-el-max-width-de-su-celda
description: Dos defectos de tabla en dos PRs seguidos que la suite no pudo ver — display:block le saca a la tabla el reparto de ancho, y max-width sobre un td lo ignora table-layout:auto. jsdom no hace layout
metadata:
  type: project
---

**LEER antes de tocar CSS de tablas, y antes de creerle a una suite verde sobre algo visual.**

Dos defectos reales en la consola de operador, en dos PRs consecutivos (2026-08-06/07). Los dos
compilaron, pasaron **la suite entera sin un solo rojo**, y los cazó el gate visual en Chromium.

## Los dos, con la medición

**1. `display: block` sobre una `<table>` le saca el reparto de ancho.** Se lo puse para conseguir
`overflow-x: auto`. Una tabla en modo bloque deja de repartir el ancho entre columnas: se apelmazan
contra el borde izquierdo con media tarjeta vacía al lado.

    antes: display block, ancho 386 de 1536 de interior de tarjeta
    después (overflow-x movido a la TARJETA): display table, ancho 1534

**2. `max-width` sobre un `<td>` lo ignora `table-layout: auto`.** El algoritmo automático reparte
según contenido; el `max-width` de una celda no participa.

    con max-width:34ch en el td:  ancho 860px · scrollWidth 860 · recortado FALSE   <- cero efecto
    con el recorte en un <span> block-level interno:  ancho 238 · contenido 576 · recortado TRUE

**Las dos salidas para el caso 2** son el span interno o `table-layout: fixed`. La segunda está
descartada acá: cambia el reparto de **todas** las columnas y revierte el fix del caso 1.

## Por qué la suite no puede verlo (y por qué eso no es un bug de la suite)

**jsdom no hace layout.** No calcula anchos, no resuelve `table-layout`, no aplica el algoritmo de
tablas. `getBoundingClientRect()` devuelve ceros. Los 22 tests del módulo pasaban **idénticos** antes
y después de los dos fixes: miden qué se renderiza, no dónde queda.

Es la versión de layout de [[gate-jsdom-no-ve-gestos-tactiles]]: aquella regla vale para gestos, ésta
para geometría. Mismo principio — verde en vitest no es "verificado", es "verificado en lo que vitest
puede medir".

## Lo que generaliza

**Un comentario de CSS puede afirmar un comportamiento que el CSS no tiene, y nada lo contradice.**
El caso 2 no era sólo un defecto visual: la regla venía con un comentario explicando por qué hacía
falta el `max-width` — y el `max-width` no hacía nada. Prosa correcta describiendo código inerte.
Nada en el pipeline puede desmentir un comentario. Hermana de
[[el-guard-se-satisface-con-su-propio-comentario]]: allá el comentario **satisfacía** al guard, acá
**describe** algo que no ocurre. En ambos, el texto explicativo es lo único que sostiene la creencia.

**La medición tiene que ejercitar la condición, no observarla.** `recortado: scrollWidth >
clientWidth` sobre el texto largo **y** sobre uno corto: si los dos dieran `true`, el instrumento no
discrimina — recortaría todo. El par es el control, no un lujo.

## El costo de no correr el gate visual

Cero, si se corre: los dos defectos aparecieron en **una** pasada de ~3 minutos cada uno. La
alternativa era que los viera el operador en pantalla, que es el peor lugar donde encontrarlos.

## Cómo se corre (receta corta)

`npx vite --port <libre>` en el worktree → Playwright → montar la pantalla con `createRoot` y el
`fetch` stubbeado → medir con `getComputedStyle` / `getBoundingClientRect`.

Dos trampas propias, ya pagadas:
- `import('react')` no resuelve: hay que pedir `/node_modules/.vite/deps/react.js`. Y
  `react-dom_client.js` exporta `createRoot` **dentro de `.default`**, no como named export.
- **Verificá que el puerto que contesta es el tuyo** — [[el-puerto-que-contesta-puede-ser-de-otra-sesion]].
  Pasó otra vez el 2026-08-07: el 5199 devolvía 200 y era un `node` de otra sesión arrancado 2 h
  antes. Control barato: `curl <puerto>/src/<tu archivo>` y grepear un símbolo que **sólo** exista en
  tu rama, más un control negativo con una cadena inventada.
