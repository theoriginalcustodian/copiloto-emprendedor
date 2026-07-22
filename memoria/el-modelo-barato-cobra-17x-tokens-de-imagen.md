---
name: el-modelo-barato-cobra-17x-tokens-de-imagen
description: gpt-4o-mini cobró 17× más tokens que gpt-4o por la MISMA imagen — el precio por token no dice nada hasta medir el usage
metadata:
  type: reference
---

**LEER antes de elegir modelo para cualquier tarea con imágenes, y antes de estimar su costo.**

Mismo ticket, misma foto, mismo prompt (spike OCR, 2026-07-21):

| | tokens de imagen | USD/ticket | aciertos |
|---|---|---|---|
| `gpt-4o-mini` | **14.261** | 0.0030 | 2/4 |
| **`gpt-4o`** | **842** | **0.0027** | **4/4** |

**El barato es más caro Y peor.** El `mini` tiene un tiling de visión más granular, así que factura
**17× más tokens por la misma imagen** — y eso se come entero su descuento por token.

**Por qué esto no se deduce:** el precio por token está publicado y el conteo de tokens de imagen no.
Cualquier estimación hecha con la tabla de precios da el resultado **al revés**. El dato sólo aparece
leyendo el `usage` de la respuesta real, con la imagen real.

**La regla:** para tareas multimodales, el costo se **mide** con una llamada, no se calcula. Y el
corolario que vale más: *elegir el modelo barato para OCR era pagar lo mismo por peores resultados* —
la intuición "usemos el chico para tareas simples" es exactamente donde falla.

**Contexto del proyecto:** ~330 tickets por dólar. El costo es irrelevante para el diseño — la
confirmación humana existe por [[subir-de-modelo-compra-precision-no-honestidad]], no por la plata.

**Y un error de método que vino en el mismo paquete:** el pedido afirmaba *«el motor va por
OpenRouter»*. Falso: `worker_b.py` **sobreescribe** el default del motor con OpenAI directo. Se había
leído el `DEFAULT_PRIMARY` de la capa plantilla y no la **composición root** que la configura.
**La configuración efectiva se lee en la composición root o no se leyó.**
