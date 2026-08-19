# Íconos — Phosphor Regular

Set: **[Phosphor](https://phosphoricons.com) · peso `regular`** · licencia **MIT**.
Bajados de `raw.githubusercontent.com/phosphor-icons/core/main/assets/regular/`.

**Reemplaza a Iconoir** (decisión del 28/07) desde el **19/08/2026**. El motivo está medido:
el grosor de Phosphor Regular es **6,25 %** del alto del ícono, y el del isotipo es **6,67 %** —
es el único peso que **pesa como el símbolo de la marca**. Los tiles con Iconoir usaban trazo 2
(8,33 %): el ícono de una tarjeta pesaba más que el signo de Odobi.

## Cómo se usan

- **`viewBox="0 0 256 256"`** (el nativo de Phosphor), inline, con `fill="currentColor"`.
- ⚠️ **Phosphor es `fill`, no `stroke`.** Los íconos vienen outlineados: el color se hereda,
  pero **el grosor NO se ajusta por CSS**. Si hace falta más o menos peso, se baja otro peso
  del set — nunca se toca `stroke-width`.
- En CSS, los contenedores llevan `fill: <color>; stroke: none`.
- Tamaños: **18 px** en tiles de tarjeta y del escritorio · **20 px** en el composer ·
  **34 px** en estados vacíos y encabezados de función.

## Nada de esto aplica al isotipo

El isotipo de Odobi **sí es `stroke`** (1.6 en chico / 1.3 en grande) y tiene su propio `viewBox`.
Convive con Phosphor porque el peso óptico coincide, no porque sean la misma técnica.
