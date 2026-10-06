---
name: cuatro-de-seis-filas-del-contrato-estaban-mal-y-las-cazo-quien-iba-a-implementar
description: Un §0 "ya medido" escrito por quien no va a tocar el archivo falla ~la mitad de las veces; la línea que invita a rechazarlo es lo que evita que se implemente contra el texto.
metadata:
  type: feedback
---

**2026-10-06.** Bajé a frontend un contrato de 6 filas con §0 «medido contra `origin/main`, con
`path:línea`, no inventaríes nada». **CUATRO de las seis estaban mal, y las cuatro las cazaron las sesiones
que iban a implementarlas, antes de escribir código.** Ninguna la cacé yo. De las seis, **sólo una
— A10 — salió limpia**: la sexta quedó *sin confirmar*, también por mi culpa.

| Fila | Lo que escribí | Lo que era | Cómo falló mi medición |
|---|---|---|---|
| `A2` | «el front **no manda** la clave de idempotencia» | la manda, **en las dos apps** (`FormularioGasto.tsx:68` web / `:87` mobile) | busqué `idem_key` en la **tarjeta**; la clave la arma el **formulario** al que la tarjeta delega. Medí el archivo equivocado y leí el vacío como ausencia |
| `A3` | «usá el guard **B**, como las otras cuatro» · plataforma `mobile` | el guard B **no aplica** (la anulación no es un mensaje) · es `ambas` (web tiene el gemelo en `:84`) | importé una analogía de **otro caso**: las otras cuatro son tarjetas de chat, y ésta no lo es |
| `A4` | «alta desde mobile ⇒ fila en `tenant_legal_store`» | **mobile no tiene alta** (signup web-only) | el DoD pedía un flujo **que el producto no tiene** |
| `A6` | «`pctTapado=100`, franja libre **0 px**» | **1.2%**, 43 de 44 filas libres ⇒ el DoD **ya se cumplía en `main`** | medí bien… **un código que ya no existe**: el 100% es de la versión **sin portal de BottomSheet** |
| `A5` | «mobile deja la card con `opacity`» | **nadie pudo confirmarlo** | mi grep de HITL en `apps/mobile/` volvió vacío y lo escribí igual. **Vacío no es dato** |

**Why:** el §0 existe para que la sesión dueña no gaste el arranque inventariando — pero un
inventario escrito por quien **no va a tocar el archivo** mide desde afuera, y hoy falló de las tres
maneras posibles: el archivo equivocado, la analogía importada, y el flujo inexistente. **3 de 6 no
es mala suerte: es la tasa esperable.** Y el daño de que no lo cacen es peor que el de no tener §0:
cumplir mi texto habría significado duplicar una derivación que ya existía (`A2`), pedirle al backend
un endpoint innecesario (`A3`) y **inventar un flujo de UX** (`A4`). Un contrato equivocado no frena
el trabajo: lo manda en la dirección equivocada con la autoridad de un contrato.

**How to apply:** el §0 de un contrato es una **hipótesis medida, no un hecho**, y el contrato tiene
que decirlo con esas palabras **e invitar explícitamente al rechazo**. La línea que lo hizo funcionar
hoy, y que va en todo `contrato_` de acá en adelante:

> *«El §0 está medido contra `origin/main`, no supuesto. Si una fila no coincide cuando abras el
> archivo, es un error mío y quiero saberlo ANTES de que implementes alrededor.»*

Las tres sesiones emitieron `pedido_` en vez de implementar contra el texto, que es exactamente lo
que esa línea autoriza. Sin ella, el camino de menor resistencia es cumplir el contrato.

**Corolario sobre quién mide mejor:** la corrección de `A2` la trajo auditoría **más afinada que la
mía propia** — yo dije «ya está hecho, sale de la cola» y era incompleto: el **código** está en las
dos apps, pero el **test** de la derivación sólo existe en mobile (93 líneas con control positivo)
y en web no (22 líneas, cero menciones). La fila no salía: se reducía. Dos mediciones sucesivas del
mismo hecho dieron tres respuestas distintas, y la última fue la de quien iba a escribir el test.

**El modo de falla de `A6` es el peor de los cuatro, porque mi número era CIERTO.** `pctTapado=100`
fue verdad — antes del portal de BottomSheet. Un dato que fue correcto no se siente como un error:
no hay vacío que me alerte, ni analogía importada, ni flujo inexistente. **Envejeció, y nada en el
número dice cuándo se midió.** Lo que lo cazó fue que FE2 corrió **las dos versiones** (con portal
1.2% / sin portal 100%) en vez de limitarse a contradecirme: reprodujo mi número y encontró **en qué
mundo era cierto**. Eso es el control positivo del hallazgo ajeno, y es lo que separa una refutación
de una simple asimetría entre dos mediciones ([[una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal]]).
**Todo número en un §0 va con la fecha y el commit contra el que se midió.**

Relacionadas: [[instrumento-que-no-mira-nunca-falla]] ·
[[el-contrato-que-manda-a-hacer-algo-ya-hecho]] · [[el-fix-ya-existe-en-otro-call-site]] ·
[[reutilizacion-es-regla-el-inventario-va-antes-del-diseno]] ·
[[planificacion-no-implementa-baja-contratos]] ·
[[un-contrato-define-que-declarar-no-asigna-anclas-que-no-medi]] ·
[[un-umbral-calibrado-es-una-foto-del-sistema-de-ese-dia]] · [[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]]
