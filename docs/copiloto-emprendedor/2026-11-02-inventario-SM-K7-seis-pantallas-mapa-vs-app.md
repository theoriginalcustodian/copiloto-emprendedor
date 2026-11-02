# Inventario SM-K7 — seis pantallas secundarias: mapa vs app

> **Ficha:** SM-K7 (frontend2). **Método:** capturas del relevamiento
> (`2026-10-16-relevamiento-capturas/proto-mapa-*.png` contra `app-*.png`) + lectura del código de cada
> pantalla + HTML del prototipo (`Prototipo frontend/odobi-ui/prototipo/index.html`). **Sin teléfono**:
> es el inventario previo al cambio; las capturas de device se toman al implementar cada pantalla.
> **Clasificación:** *divergencia* = se corrige la app · *enmienda fundada* = se corrige el mapa, con el motivo
> medido · *ya resuelta* = la premisa de la ficha venció.

## Resumen

| Pantalla | Divergencias a corregir | Enmiendas fundadas | Ya resuelta / de otra ficha |
|---|---|---|---|
| `comousar` | contenedor, numeración, chevron | sección «Lo que le podés pedir» | — |
| `soporte` | — | — | **clip ya existe** (#1115, 2026-10-13); botón de voz grande → **SM-I2** |
| `feedback` | estructura en tarjeta, posición del mes | «Mandar» deshabilitado en vacío | — |
| `negocio` | título duplicado, tarjeta única, rótulo de «Cómo te habla» | «A quién» como selector, «Guardar» explícito, sin validación de 10 caracteres, bloque del modo | — |
| `apar` | mosaico (mini-vista), chevron de «Como el teléfono» | frase «Se aplica al instante…» | — |
| `hablar` | control de selección (filas con radio dentro de una tarjeta) | «Así te respondería», botones explícitos | — |

## 1 · `comousar` — Cómo usar la app

Código: `apps/mobile/src/modules/ajustes/PantallaComoUsarLaApp.tsx`. Prototipo: `index.html:2138`.

- **Divergencia — contenedor** (`:95-121`): el mapa pone los 5 temas en **una tarjeta con divisores**; la app
  dibuja **una `Row` por tema**.
- **Divergencia — numeración** (`:103-112`): el mapa usa un **círculo tintado** con el número; la app un numeral
  suelto (`width: 20`).
- **Divergencia — chevron**: el mapa lleva `›` a la derecha de cada tema; la app no (y cada fila es tocable:
  sin la flecha no hay señal de que lo sea).
- **Enmienda fundada — «Lo que le podés pedir»** (`:128-191`): no está en el mapa. Es la guía viva de
  `GET /capacidades` (docstring `:33-37`: sólo publica capacidades con tool viva), no se escribe a mano.

## 2 · `soporte` — Soporte técnico

Código: `apps/mobile/src/modules/soporte/PantallaSoporte.tsx`. Prototipo: `index.html:2153`.

- **Ya resuelta — «falta el clip»**: `Composer` recibe `onFoto={alAdjuntarFoto}` (`:286`) desde
  `e3d1efa3` (#1115, **2026-10-13**), tres días **antes** del relevamiento (10-16). En la captura
  `app-soporte.png` el botón izquierdo de la barra es el clip, atenuado. **A confirmar en device** qué
  muestra y si se ve como el del mapa (círculo con clip a la derecha del campo en el prototipo; a la
  izquierda en la app).
- **De otra ficha — botón de voz grande** (`:253-262`): sale con el dock «campo + mic chico» de
  **SM-I2** (frontend1, decisión D2: «sale también en Soporte»). No se toca acá.
- **Fuera de alcance de K7**: el encabezado «Soporte técnico» aparece dos veces (título + «Soporte de Odobi»);
  es copy propio de la pantalla (`:198-219`) y el mapa dice «Soporte de Odobi». Si se quiere igualar es otra ficha.

## 3 · `feedback` — Contanos qué tal

Código: `apps/mobile/src/modules/feedback/PantallaFeedback.tsx` + `LoPedisteVos.tsx`. Prototipo: `index.html:2185`.

- **Divergencia — estructura** (`:105-176`): el mapa agrupa título «¿Qué le cambiarías?», campo y pie
  («Dictarlo» a la izquierda, «Mandar» a la derecha) en **una tarjeta**; la app los deja sueltos, con el
  título fuera y los botones debajo.
- **Divergencia — posición del mes** (`LoPedisteVos.tsx:64-83`): el mapa lo pone **a la derecha** de cada
  fila, en mayúscula pequeña (`JULIO`); la app lo pone **debajo** («Enviado · Septiembre»).
- **Divergencia — contenedor de la lista**: el mapa las agrupa en **una tarjeta con divisores**; la app las
  lista sueltas.
- **Enmienda fundada — «Mandar» deshabilitado** (`:176-190`): el mapa lo dibuja sólido porque es una
  maqueta estática; con el campo vacío la app lo deshabilita. Enviar un feedback vacío no tiene sentido y
  el estado se deriva del contenido.
- **Dato, no estructura**: la lista de la captura tiene filas de pruebas E2E del canónico; el mapa muestra 3.

## 4 · `negocio` — Mi negocio

Código: `apps/mobile/src/modules/ajustes/negocio/PantallaPerfilNegocio.tsx`. Prototipo: `index.html:2273`.

- **Divergencia — título duplicado** (`:361`): la `Seccion titulo="Mi negocio"` repite el título de la
  pantalla.
- **Divergencia — contenedor** (`:361-432`): el mapa pone los 6 campos en **una tarjeta con divisores**; la
  app los deja sueltos.
- **Divergencia — rótulo de sección** (`:482`): «Cómo te habla» es en el mapa un rótulo chico en mayúscula
  (`CÓMO TE HABLA`); en la app un encabezado grande.
- **Enmienda fundada — «A quién le vendés» como selector** (`:376-382`, comentario `:477-478`): el backend
  lo guarda como enum de 3 valores; texto libre rompería el contrato.
- **Enmienda fundada — «Guardar» explícito por sección** (`:420-431`, comentario `:481`): cada sección
  tiene su ciclo de guardado; no hay edición inline.
- **Enmienda fundada — sin validación de 10 caracteres** (`:478-480`): bloquear Guardar sobre perfiles ya
  guardados es un cambio de contrato (MAYOR).
- **Enmienda fundada — bloque «Cómo trabaja tu copiloto»** (`:434-473`): el mapa sólo muestra la línea de
  estado (que la app **también** tiene, `:353-360`); el bloque agrega la acción «Volver a pedir
  confirmación» cuando el modo es automático, que necesita un lugar. En modo «pedir confirmación» el bloque
  repite el dato de la línea de arriba: **decisión pendiente** de planificación si se oculta en ese modo.

## 5 · `apar` — Apariencia

Código: `apps/mobile/src/modules/ajustes/PantallaSkins.tsx`. Prototipo: `index.html:2397-2408`.

- **Divergencia — mosaico** (`SkinCard` `:35-75`): el mapa muestra una **mini-vista** (una píldora con dos
  trazos: tinta y terracota) y la etiqueta debajo, con aro terracota en el elegido; la app muestra **cuatro
  muestras de color** y «✓ Activo».
- **Divergencia — chevron** (`:95-122`): «Como el teléfono ›» lleva flecha a la derecha en el mapa; la app no.
- **Enmienda fundada — frase «Se aplica al instante y queda guardado para la próxima sesión»**: es
  información funcional que el mapa no da.

## 6 · `hablar` — Cómo hablarle

Código: `apps/mobile/src/modules/ajustes/negocio/PantallaTono.tsx` (`CampoSelect` `:15,21-28`). Prototipo: `index.html:2410`.

- **Divergencia — control de selección**: el mapa usa **filas con radio** (círculo a la derecha) dentro de
  una tarjeta con divisor; la app usa opciones sueltas que **toman el ancho de su contenido** (en
  `app-tono.png` las cuatro tienen anchos distintos) y marcan el elegido sólo con el color del texto.
- **Enmienda fundada — «Así te respondería»** (`:163-165`): el ejemplo vivo existe en el mapa (mockup 13)
  y es copy propio.
- **Enmienda fundada — botones «Guardar» y «Volver a Mi negocio»** (`:184`): el guardado es explícito (ver
  `negocio`).

## Orden de implementación propuesto

1. `hablar` y `apar` (control de selección y mosaico: componentes pequeños y aislados).
2. `comousar` (una tarjeta + badge + chevron).
3. `feedback` (tarjeta + mes a la derecha).
4. `negocio` (tarjeta única, título, rótulo).
5. `soporte`: sólo **verificar el clip en device** y capturar; el botón grande queda para SM-I2.

Cada una con su captura de device (RF8T318RN9T, canónico). Cualquier hallazgo de lógica abre ficha propia
(ver DoD de SM-K7).
