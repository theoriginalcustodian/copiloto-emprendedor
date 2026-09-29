---
name: un-callback-que-recibe-un-parametro-y-lo-ignora-no-da-sintoma
description: Una capa puede calcular y propagar un dato que el último call-site descarta sin error, warning ni lint; el tipo admite una función de cero argumentos donde se esperaba una de uno
metadata:
  type: project
---

# 🔌🕳️ Un callback que RECIBE un parámetro y lo ignora no da síntoma

`onAbrirGasto?: (id: number) => void` acepta `() => changeTable('gastos')` sin queja: en TypeScript una
función de **menos** argumentos es asignable donde se espera una de más. Así que el último call-site
puede **descartar el dato** que tres capas calcularon y propagaron, y no hay error, ni warning, ni lint,
ni test que lo note. **La pantalla que aparece es plausible y el usuario no sabe qué debería haber
pasado.**

## El caso (2026-09-28, hallazgo `ACTID`)

| capa | qué hace | path:línea |
|---|---|---|
| destino | **calcula** `{ pathname:'/gastos', params:{ gastoId } }` | `modules/actividad/destinoActividad.ts:54-55` |
| fila | **propaga** `onAbrirGasto?: (id: number) => void` | `modules/actividad/FilaActividad.tsx:26,31` |
| **shells** | **lo tiran** (4 call-sites) | `shell/AppShell.tsx:213,232` · `shell/DesktopShell.tsx:141,159` |

Tocar un gasto en Actividad abre **la lista** de gastos, no ese gasto.

## La pregunta que lo caza

Es la de [[la-costura-leia-un-campo-que-nadie-escribe]] **al revés**: ahí alguien leía un campo que nadie
escribe; acá alguien **escribe un dato que nadie lee**. Entonces la pregunta al mirar una capa es doble,
y hay que hacer las dos:

- **¿quién ESCRIBE lo que leo?** (el caso conocido)
- **¿quién LEE lo que escribo?** ← esta falta casi siempre

## Y el fix suele existir al lado

`onAbrirCliente` **sí** estaba cableado (`AppShell.tsx:131-134`, `abrirCliente(id)`). Dos callbacks
hermanos, misma forma, uno conectado. **Cuando encontrás uno así, grepeá los hermanos antes de diseñar
nada** — es [[el-fix-ya-existe-en-otro-call-site]] y suele ser copiar 4 líneas.

**Ojo con el falso positivo:** `presupuesto`/`factura`/`ingreso` devuelven `null` **a propósito** en el
mismo archivo (`:58-63`, con comentario). Eso es deuda **declarada** y está bien. La diferencia no es
«hay un `null`»: es que el destino **exista y se descarte**.

Lo cazó una sesión que fue a verificar un camino de un contrato antes de asumirlo — ver
[[un-contrato-define-que-declarar-no-asigna-anclas-que-no-medi]].
