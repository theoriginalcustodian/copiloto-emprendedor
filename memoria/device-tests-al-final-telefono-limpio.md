---
name: device-tests-al-final-telefono-limpio
description: "Orden del operador: TODO lo móvil/device pasa al SPRINT SIGUIENTE (2026-09-22); este sprint se cierra sin device; el Android limpio se monta allá, lo hace BACKEND"
metadata: 
  node_type: memory
  type: project
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-21T22:23:37.724Z
---

Orden del operador (2026-09-21, ~22:30): el teléfono **ya está conectado a la PC**, pero es un
**Android recién instalado, limpio**: no tiene dev-client ni nada. Antes de probar hay que montar
Metro y todo lo necesario, y después instalar la app.

**Las pruebas en el teléfono se hacen AL FINAL, cuando termine toda la implementación.** Hasta
entonces **no se baja ningún contrato ni pedido sobre el teléfono a ninguna sesión**.

**Why:** el operador prefiere terminar de programar todo y hacer una sola tanda de pruebas en el
teléfono, no intercalarlas.

**How to apply:**
- Las filas táctiles quedan en CIERRA_SALVO_DEVICE sin reclamo; no son bloqueo mientras se programa.
- Los `pedido_…device…` que ya están en `en-curso/` se dejan quietos: no se re-empujan ni se escalan.
- Disparador para arrancar: cola de implementación vacía (Cierre A salvo device). Ahí
  planificación le baja a **BACKEND** el contrato de puesta a punto del teléfono. **Planificación
  NO prepara el teléfono** (corrección del operador, 2026-09-21): lo prepara BACKEND, dueña de las
  tandas de device (plan §5.6). Hay que montar dev-client + Metro por USB desde cero: la memoria
  [[iterar-en-device-es-metro-local-con-dev-client-ya-instalado]] asume un dev-client ya
  instalado, y acá no lo hay. Recién con el teléfono listo se baja la tanda de pruebas.
- Usuario de prueba: [[usuario-de-prueba-canonico-uno-solo-a-fuego]].

**Actualización 2026-09-22 (después del corte de luz):** el operador decidió que **todo lo relativo al móvil pasa
al sprint siguiente**. Este sprint **se cierra sin device**: las filas `PENDIENTE_DEVICE` no lo bloquean, y
la puesta a punto del teléfono (que hace BACKEND) ya no es el último paso de este sprint sino el primero del
próximo. Los crones de las sesiones se apagan **al terminar la implementación**, por mensaje directo.
