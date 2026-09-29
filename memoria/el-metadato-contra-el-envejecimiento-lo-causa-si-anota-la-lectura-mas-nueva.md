---
name: el-metadato-contra-el-envejecimiento-lo-causa-si-anota-la-lectura-mas-nueva
description: Una fila que mezcla captura fresca con descripción heredada anota el SHA de la captura y pasa el control de caducidad, justo el envejecimiento que el campo existía para impedir.
metadata:
  type: project
---

Cuando un documento perecedero se blinda con un campo «medido contra el SHA X», el campo sólo
funciona si el SHA que anota es **el de la lectura que sostiene el veredicto**. Si la fila se apoya en
**más de una** lectura y el campo toma la más nueva, el control de caducidad **da luz verde
precisamente a la fila mezclada** — y la mezcla es el caso frágil, no el robusto.

**Caso raíz (2026-09-28, matriz del criterio 3, fila `detalle`).** Auditoría dictaminó NO al agregado
porque faltaba el SHA medido en **34 de 36** filas. Al ir a llenarlo salió el problema: `detalle`
tenía **captura de hoy** (PNG de 09:44, SHA `b7fa0e23`) y su celda decía «descripción validada
**22/09**; `?ver=detalle` exacto **no releído esta pasada**». Un `sha_medido` tomado de la captura
habría anotado `b7fa0e23` y la fila **pasaba** el control — cuando la parte que sostiene el veredicto
es del 22/09 y es justo la que los tres commits de BL-V23 impactan. El campo pedido *contra* el
envejecimiento silencioso lo habría **producido**, y con apariencia de rigor nuevo.

**Cómo se arregla — regla del eslabón más viejo.** Si el veredicto se apoya en varias lecturas y
alguna es heredada, se anota **la más VIEJA de las que lo sostienen**. Test operativo:
*¿qué lectura, si estuviera desactualizada, cambiaría el veredicto?* Esa es la que se anota.

**Y el campo no puede ser «el SHA» a secas**, porque no todas las filas se miden igual: una medida
capturando anota `servido@<sha>` (el instrumento lo escribe en el `mtime` del PNG, no la memoria del
medidor); una medida **leyendo código** anota `leido@<rama>:<sha>` **del worktree que se leyó**, que
difiere de `origin/main` en los dos sentidos. Medido: el lote B citaba **un solo** `.png` para 16
mediciones — casi todo se había medido leyendo, y anotar `origin/main` ahí sería anotar un árbol que
nadie leyó.

⚠️ **Límite que queda abierto:** sin marcador de build en la app (`/healthz` devuelve sólo
`{"status":"ok"}`), `servido@<sha>` es un **techo**, no el SHA desplegado — si el deploy venía
atrasado, la captura midió una superficie más vieja y el control **falla abierto por el atraso**.

Hermanas: [[el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio]] ·
[[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]] ·
[[el-tipo-de-mensaje-decide-si-alguien-lo-persigue]] · [[el-guard-falla-abierto-en-su-caso-de-activacion]]
