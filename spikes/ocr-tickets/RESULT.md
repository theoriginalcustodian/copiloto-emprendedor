# Spike OCR de tickets — RESULTADO

> **Pedido:** `pedido_planificacion-a-backend_spike-ocr-de-tickets` · **Fecha:** 2026-07-21
> **Veredicto en una línea:** la foto **sirve como camino de entrada**, pero **el monto que devuelve
> no se puede tratar como dato bueno** — los modelos inventan montos y se declaran legibles mientras
> lo hacen.

---

## 0. Contra qué se midió (para que nadie complete el resto con optimismo)

Cuatro fotos **reales** de Wikimedia Commons, sacadas con teléfono. **Ninguna es argentina** — no
encontré tickets argentinos con licencia libre. El ground truth lo leí **yo, mirando cada foto**,
antes de correr el modelo; sin eso "extrajo bien" sería una opinión sobre un texto que suena bien.

| foto | qué es | dificultad |
|---|---|---|
| `t1_austria` | ticket de bar austríaco, arrugado, con reflejos | media |
| `t2_nepal` | matricial, **poca luz**, total al pie tras 4 subtotales | alta |
| `t3_canada` | **rotado 90°**, arrugado, foto de teléfono | **alta — el caso duro** |
| `t4_bill` | escaneo limpio B/N | **baja — el caso fácil** |

**Lo que NO se probó:** papel **térmico descolorido** argentino. `[ASSUMED_PENDING_VERIFY]` — aparece
solo en el primer uso en device. El caso duro más parecido que conseguí es el rotado+arrugado.

---

## S1 · Modelo y costo — el resultado es contraintuitivo

| modelo | tokens de imagen | USD/ticket | aciertos en las 4 fotos |
|---|---|---|---|
| `gpt-4o-mini` (el que usa hoy el worker) | **14.261** | 0.0030 | **2 / 4** |
| `gpt-4o` | **842** | **~0.0027** | **4 / 4** |

🔴 **`gpt-4o` es más preciso y NO es más caro.** Parece un error de tipeo y no lo es: `gpt-4o-mini`
cobra **17× más tokens por la misma imagen** (su tiling de visión es mucho más granular), y eso
compensa casi exactamente su precio por token más bajo. Elegir el modelo barato para OCR era pagar lo
mismo por peores resultados.

Sólo se midió midiendo el `usage` real. Mi estimación previa —1.400 tokens por imagen— estaba **10×
abajo**; cualquier cálculo de costo hecho sobre esa tabla subestima.

**A cualquier precio, el costo es irrelevante para la decisión:** ~330 tickets por dólar. El OCR no
necesita esconderse detrás de una confirmación *por costo*. Sí por otra razón — ver S4.

*(No se pudo comparar con Gemini/Qwen: el copiloto **no va por OpenRouter**. Ver §Hallazgo.)*

---

## S2 · ¿Extrae bien de un ticket real?

`gpt-4o-mini` — **2 de 4**, y los dos errores son del tipo que no protesta:

| foto | esperado | obtuvo | qué pasó |
|---|---|---|---|
| t4 limpio | 97.23 | ✅ 97.23 | — |
| t1 austria | 0.00 | ✅ 0.00 | pero **inventó el año** (`2003-08-03`; el año no está en el ticket) |
| t2 nepal | 739.**59** | ❌ 739.**09** | **un dígito**, con `legible: true` |
| t3 canada | 34.96 | ❌ 30.40 | tomó el **subtotal** en vez del total, con `legible: true` |

`gpt-4o` — **4 de 4**, incluidos el rotado y el de poca luz.

**El patrón importa más que el puntaje:** ningún error fue un fallo. Fueron **números plausibles** —
un dígito cambiado, un subtotal que existe en el ticket. Nada que un usuario detecte mirando por
encima una pantalla de confirmación que ya viene rellena.

---

## S3 · Transporte — ✅ anda

`content-parts` (`type: image_url` con `data:` URI en base64) funciona con el cliente actual —
`urllib` + `json` a mano, **sin SDK**. No hay riesgo técnico y no hace falta dependencia nueva.
Lo único a extender es `complete()`, hoy texto puro (eso es del sprint, no del spike).

---

## S4 · 🔴 El control que decide el diseño — y falló

| control | qué debería hacer | `gpt-4o-mini` | `gpt-4o` |
|---|---|---|---|
| **C1** ruido puro (no es un ticket) | decir que no puede | ✅ `null`, `legible: false` | — |
| **C2a** TOTAL tapado, ítems visibles | `null`, o sumar y avisar | ⚠️ **89.00** — devolvió un *subtotal* como si fuera el total, `legible: true`, sin motivo | — |
| **C2b** TOTAL e ítems tapados | `null` | ✅ `null` (pero `legible: true`, incoherente) | — |
| **C3** la misma foto **muy borrosa** | `null`, `legible: false` | 🔴 **187.28 inventado**, `legible: true` | 🔴 **1076.21 inventado**, `legible: true` |

### Las dos conclusiones que se llevan al contrato

**1. `legible` no sirve como señal.** En cada alucinación el modelo se declaró legible. Un gate
construido sobre ese campo estaría siempre abierto. **No lo uses para decidir nada.**

**2. La alucinación NO se arregla con un modelo mejor — es de la tarea.** `gpt-4o` corrigió los dos
errores de lectura, pero ante la foto ilegible **inventó igual**, con otro número. Subir de modelo
compra precisión; no compra honestidad. **El fix tiene que ser de diseño.**

### Qué propongo para el contrato de Gastos

- **El monto NO se pre-carga.** Los otros campos sí (fecha, proveedor, categoría). El monto se muestra
  **vacío**, con el valor leído ofrecido aparte como sugerencia que el usuario toca para aceptar. Un
  campo vacío obliga a mirar el ticket; uno relleno con `187.28` plausible se confirma sin leer — y ahí
  la "confirmación editable" deja de ser un control y pasa a ser un trámite.
- **Pedirle al modelo la evidencia, no sólo el número:** que devuelva el texto crudo de la línea donde
  leyó el total. Un monto sin su línea de respaldo es un monto que no vio. Barato de pedir y hace
  auditable la lectura.
- **`gpt-4o`, no `gpt-4o-mini`,** para esta tarea. Mismo costo, el doble de aciertos.

---

## Hallazgo que cambia la premisa del pedido

El §2 del pedido dice *"el motor ya va por OpenRouter, es cambiar el string del modelo"*. **Cierto para
el motor, falso para el copiloto:** `apps/copiloto/worker_b.py:78-81` sobreescribe el default y usa
**OpenAI directo** con `gpt-4o-mini` y `OPENAI_API_KEY`. **En el VPS no existe `OPENROUTER_API_KEY`.**

La conclusión práctica del pedido sobrevive —**no hace falta proveedor nuevo**— pero por otra puerta:
mismo cliente, misma key, y `gpt-4o` ya acepta imágenes. Si algún día se quiere comparar contra Gemini
o Qwen, eso **sí** requiere dar de alta una key de OpenRouter.

---

## Cómo reproducir

```
spikes/ocr-tickets/probar_ocr.py         # transporte + control sintético
spikes/ocr-tickets/inventario_modelos.py # catálogo de visión y precios en OpenRouter (informativo)
```
Las fotos se bajan de Wikimedia Commons (URLs en este documento). Desechable: no está lindo, está
medido.
