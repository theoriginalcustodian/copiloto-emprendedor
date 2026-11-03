---
name: una-receta-con-premisa-vencida-produce-un-falso-VERDE
description: Cuando una receta de verificación declara el estado esperado, una premisa vencida convierte el defecto en el resultado esperado y la evidencia sale verde POR el bug.
metadata:
  type: feedback
---

**Una receta de verificación con una premisa vencida no da un falso rojo: da un falso VERDE.**

Medido el 2026-11-03. frontend2 bajó una receta de capturas de device impecable —ruta, estado
previo, gesto, archivo de salida y «qué debe verse» por ficha— y en `SM-N35` declaró: *«hoy backend
no persiste la categoría, así que la captura reabierta esperada es Sin definir»*. Persistía de punta
a punta desde `4a5bb923` (#1469): `afip_web.py:90-99` recibe y `:235-238` valida A…K ·
`afip_credential_store.py:254-273` la escribe en el UPSERT · `:279-291` el `SELECT` la devuelve ·
`packages/core/src/api/afip.ts:588-636` traduce snake↔camel. La premisa era de **un día antes** del
merge que la invalidó.

**Why:** una receta es poderosa justamente porque dice **qué tiene que verse** — sin eso, el que
captura no puede acreditar nada. Pero ese mismo campo es el que invierte el signo del error: con
«Sin definir» declarado como esperado, una pantalla que mostrara «Sin definir» **por un defecto
real** habría cerrado el DoD. Un falso rojo se investiga; un falso verde **nadie lo revisa**, porque
parece trabajo terminado. El riesgo no vive en las premisas obvias sino en las que el autor escribió
con razón ayer y quedaron vencidas por un merge de otra sesión.

**How to apply:**
- Toda premisa de una receta se escribe **con su medición y su sha**, no con su conclusión. «Backend
  no persiste» es una conclusión; «`afip_web.py:90` no tiene el campo @`<sha>`» se puede re-verificar
  en un grep.
- Antes de **ejecutar** una receta ajena, re-medí los «esperado» que dependen de otra sesión. Lo que
  no depende de nadie más no hace falta re-medirlo.
- La receta es correcta igual: no se descarta por esto, se le corrige el punto. Es el patrón de
  [[gate-de-device-se-corre-con-receta-no-con-ventana-viva]], que sigue siendo el que destraba el
  cuello del device.
- Síntoma hermano, mismo día: `packages/core/src/api/afip.ts:258` sigue diciendo
  `[ASSUMED_PENDING_VERIFY]` sobre una persistencia que ya existe — un marcador que miente apaga la
  búsqueda del próximo que lo lea.
  [[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]] ·
  [[un-test-que-afirma-el-sintoma-del-defecto-lo-vuelve-inmortal]]
