---
name: la-consola-se-construye-con-las-piezas-de-la-app
description: Instrucción directa del operador (2026-08-06) — la consola de operador NO estrena stack ni componentes: se arma con lo que ya existe en copiloto-web, y el inventario va antes de escribir una línea
metadata:
  type: feedback
---

**LEER antes de escribir cualquier pantalla de la consola de operador (sprint CONSOLA, hitos CONS5-CONS8).**

Instrucción textual del operador, 2026-08-06: *"recuerda reutilizar cosas si ya tenemos cosas hechas
no reinventes la rueda… si se pueden usar cosas del frontend de la app usalas para la consola"*.

Coincide con lo que el plan ya decía en la fila de CONS5 —**"reusa M-WEB, no crea"**— pero el
operador lo repitió igual, y eso importa: la consola **se siente** un producto aparte (otro público,
otro tipo de dato, "panel de admin"), y esa sensación es exactamente lo que empuja a estrenar tabla
propia, cliente HTTP propio, layout propio. La distancia conceptual no es distancia técnica.

## Qué se reusa, con path (medido 2026-08-06, no de memoria)

| Necesidad de la consola | Ya existe en | No escribir |
|---|---|---|
| Llamar al backend con auth | `lib/api/client.ts:142` `apiClient` | otro `fetch`: ya trae Bearer, refresh-on-401 **single-flight** y `ApiError`/`Forbidden`/`Unauthorized` |
| Estado ok / warning / error | `design-system/Badge.tsx` (`ok\|warning\|danger\|neutral`) | otro chip de estado |
| Tarjetas | `design-system/Surface.tsx` (`card\|tile\|bubble`) | otra card |
| Carga | `design-system/Skeleton.tsx` | otro spinner |
| Layout de pantalla | el contrato que cumplen las 19 `.X-screen`: `flex:1; min-height:0; overflow-y:auto` | otro contenedor: encaja en los dos shells sin tocarlos |
| Lista con estados | `modules/actividad/ActividadScreen.tsx:38` (`cargando\|ok\|error` + guard de desmontaje) | otra máquina de estados |
| Gráficos | `modules/inteligencia/graficos/` (`GraficoBarras`, `GraficoTorta`) | otra librería de charts |

## El orden que hace que esto funcione

El inventario va **antes** de diseñar, no después de escribir. Enunciar el problema como *"la consola
necesita X"* invita a construir X; enunciarlo como *"¿qué de lo que existe cubre X, y qué le falta?"*
casi siempre termina en una extensión de tres líneas. Ver [[reutilizacion-es-regla-el-inventario-va-antes-del-diseno]].

## El límite: reusar el componente NO es reusar el criterio

En CONS5 aparecieron dos cosas que **no** se podían resolver con la pieza existente, y meterlas
adentro habría sido el error espejo:

1. **`/admin/*` no montado devuelve 200 con el `index.html`**, no 404 (medido: la ruta admin y una
   inventada dieron respuestas byte a byte idénticas). Eso hace reventar el `res.json()` de
   `client.ts` con un `SyntaxError` que no explica nada. La validación de forma se puso en
   `lib/api/admin.ts`, **no** en `client.ts`: ese cliente lo usan las 19 pantallas y ninguna tiene
   este modo de fallo — arreglarlo ahí es cobrarle a todas el problema de una.
2. **`BadgeProps` no extiende `HTMLAttributes`**, así que no acepta `data-testid`. Se envolvió en un
   `<span>` en vez de tocar el primitivo compartido por una necesidad de una pantalla.

La regla completa entonces es: **reusá la pieza; poné en tu módulo lo que es propio de tu módulo.**
Tocar el componente compartido para resolver un caso local es la otra forma de romper el reuso.
