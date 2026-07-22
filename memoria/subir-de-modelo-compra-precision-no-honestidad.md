---
name: subir-de-modelo-compra-precision-no-honestidad
description: El OCR se declaró legible=true en CADA alucinación — un gate sobre la autoevaluación del modelo está siempre abierto
metadata:
  type: project
---

**LEER antes de confiar en un campo donde un LLM se autoevalúa** (`legible`, `confidence`, `seguro`,
`pude_leerlo`), y antes de pre-cargar en la UI un dato que salió de un modelo.

Spike de OCR de tickets (2026-07-21, 4 fotos reales de teléfono + 2 controles hostiles):

| Control | Resultado |
|---|---|
| Ruido puro (no es un ticket) | ✅ devolvió `null` |
| TOTAL tapado, ítems visibles | ⚠️ devolvió un **subtotal** como si fuera el total |
| Foto muy borrosa | 🔴 **inventó `1076.21`** y se declaró **`legible: true`** |

**Dos hechos que deciden diseño de producto, no de código:**

**1. `legible` no sirve como señal.** En **cada** alucinación el modelo se declaró legible. Un gate
construido sobre ese campo está **siempre abierto** — ni siquiera sirve para pintar un aviso.

**2. La alucinación es de la TAREA, no del modelo.** `gpt-4o` corrigió los errores de lectura del
`mini` y **inventó igual** ante la foto ilegible, sólo que otro número. **Subir de modelo compra
precisión; no compra honestidad.** No hay modelo que arregle esto: el fix es de diseño.

**Lo que salió de ahí:** el monto **no se pre-carga** en la card. Arranca vacío, con el valor leído
ofrecido al lado como sugerencia de un toque. Un campo relleno con un `1076.21` plausible **se
confirma sin leer** — la confirmación deja de ser un control y pasa a ser un trámite. Y es peor que en
la voz: dictando, el emprendedor **escuchó** lo que dijo; con la foto no tiene con qué contrastar
salvo el papel, que es justo lo que queremos que mire.

**El error de método que casi lo tapa:** el pedido del spike preguntaba *«¿el OCR lee bien?»*. Lee
bien —4/4 con `gpt-4o`, incluido un ticket rotado 90°—. **Si sólo hubiera medido eso, habría
reportado verde y el monto se pre-cargaría.** Lo que decidió el diseño fue el control hostil, que casi
nadie corre porque el caso feliz ya pasó.

Hermanas: [[instrumentos-que-confirman-en-vez-de-verificar]] · [[vacio-no-es-hallazgo-correr-el-control]]
