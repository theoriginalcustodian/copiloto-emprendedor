---
name: un-guard-despues-de-la-confirmacion-humana-contradice-al-usuario-informado
description: Un guard automático ubicado DESPUÉS de que el humano confirmó no es redundante: le niega lo que ya aprobó viendo el dato.
metadata:
  type: feedback
---

Medí el orden real en `apps/mobile/src/modules/facturacion/PantallaFacturacion.tsx` en vez de
razonarlo: `confirmarDictado` corre **antes** y el umbral de ≥2 palabras de `useDictadoFactura.ts`
**después**. Con ese orden el guard no filtra basura — rechaza un dictado que el usuario ya leyó y
aprobó. Por eso el revert fue lo correcto, no el ajuste del umbral.

**Why:** un guard es un sustituto del juicio humano. Puesto después de ese juicio deja de ser una red
y pasa a ser una contradicción, y encima pega justo en el caso más frágil, el de una palabra
([[la-senal-de-confianza-del-stt-ordena-al-reves-del-caso-de-uso]]).

**How to apply:** antes de agregar o mover una validación automática, **medí el call-site** (quién
llama a quién, con `path:línea`) y preguntá *¿esto corre antes o después de que el humano vio el
dato?* Si corre después, lo que falta es **mostrar mejor el dato**, no cortar más.
