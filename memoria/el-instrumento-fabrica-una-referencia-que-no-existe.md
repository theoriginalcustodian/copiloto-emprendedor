---
name: el-instrumento-fabrica-una-referencia-que-no-existe
description: Capturar la referencia en un viewport/modo que la referencia no soporta no produce "nada" — produce un archivo con nombre de referencia que no lo es. El instrumento no falla, y quien mire esa captura acusa al producto por un artefacto
metadata:
  type: feedback
---

**El caso (2026-09-29, criterio 3).** El criterio compara cada pantalla de la app contra el prototipo,
en **teléfono y escritorio**. El generador captura, por cada id, cuatro PNGs:
`…-app-390`, `…-proto-390`, `…-app-desktop`, `…-proto-desktop`.

**`…-proto-desktop` no es una referencia de escritorio.** El prototipo es mobile-only por diseño —
`Prototipo frontend/odobi-ui/prototipo/index.html:57-66`, **única media query en 3900 líneas**:

```css
/* En el teléfono ocupa todo; en escritorio, un marco de 390×844 para verlo en contexto. */
@media (min-width:520px){ #app{width:390px;height:844px;border-radius:40px;...} }
```

A 1440px el prototipo **no reflowea**: dibuja una maqueta de teléfono centrada sobre fondo gris. Así
que la comparación `@desktop` enfrenta el diseño *mobile* del proto contra el layout *desktop* de la
app. **Todo «desvío de escritorio» que salga de ahí es artefacto.**

## Por qué no da síntoma

El instrumento **no falla**: pide la URL, recibe 200, guarda el PNG, sale 0. Produce un archivo cuyo
**nombre afirma** lo que el contenido no cumple. No hay error, no hay vacío, no hay warning — hay
evidencia falsa con nombre correcto.

Y **acusa al producto**: quien mire `app-desktop` contra `proto-desktop` sin abrir el CSS del prototipo
reporta que la app «no respeta el diseño en escritorio». El defecto está en el instrumento y la factura
se la lleva la app ([[el-instrumento-tambien-CONDENA-no-solo-absuelve]]).

## La regla

**Antes de capturar una referencia en un modo, verificá que la referencia EXISTA en ese modo.** El
control no es «¿la captura salió?» sino **«¿la referencia cambia cuando cambio el modo?»**: capturá la
referencia en los dos viewports y **diffeá los dos archivos**. Si son iguales, no hay referencia para
ese modo — y el criterio, en ese eje, no es medible: la mitad que falta no es trabajo pendiente del
producto, es **una referencia inexistente**.

Es el mismo control que [[idempotente-no-es-convergente]] («¿si cambio el valor, cambia el recurso?»),
aplicado a la evidencia: *¿si cambio el modo, cambia la referencia?*

## La vuelta útil (no todo lo inservible es inútil)

La captura `proto-desktop` es inservible como referencia de escritorio, **pero es la referencia mobile
COMPLETA**: muestra el marco entero de 390×844 con el fondo vacío al pie. Eso resuelve otro límite del
mismo instrumento — las capturas son de **viewport**, y el proto corre con `overflow:hidden` y scroll
interno, así que «este bloque no está en el proto» normalmente significa «puede estar debajo del fold»
y **una ausencia no es afirmable**. Con el marco completo a la vista, si sobra fondo al pie, la pantalla
terminó ahí y la ausencia **sí** se puede afirmar.

**Un artefacto entendido cambia de rol: dejó de ser referencia de escritorio y pasó a ser el control de
completitud del mobile.** Lo que no se puede hacer es seguir usándolo con el nombre que tiene.

Emparentado: [[el-nombre-es-una-hipotesis-sobre-el-contenido]] · [[instrumento-que-no-mira-nunca-falla]] ·
[[un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo]] (el instrumento contesta «no hay» cuando
lo cierto es «no veo»).
