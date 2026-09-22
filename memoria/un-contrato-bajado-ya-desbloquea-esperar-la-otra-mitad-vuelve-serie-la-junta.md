---
name: un-contrato-bajado-ya-desbloquea-esperar-la-otra-mitad-vuelve-serie-la-junta
description: "Una sesión se declaró sin cola esperando que backend implementara las mitades K-xx, aunque los contratos ya definían la forma del endpoint"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-21T17:26:12.185Z
---

Un `contrato_` bajado al buzón **ya es luz verde para implementar tu mitad**, aunque la otra sesión
no haya tocado nada. El contrato define ruta, request, response, códigos y DoD por lado: eso es todo
lo que hace falta para escribir la mitad FE contra un mock y dejarla `[PENDIENTE_INTEGRACION]`.

**Why:** el 2026-09-21 FRONTEND-2 emitió `pedido_..._sin-cola` declarándose sin trabajo arrancable
porque nueve de sus filas «esperaban la mitad backend» de juntas cuyos contratos estaban en
`abierto/` desde hacía horas. La regla que citó —no inventar la forma de un endpoint,
`CLAUDE.md` §3.quater.1— es correcta, pero la aplicó a un caso donde la forma **ya estaba escrita**.
El efecto es que la junta deja de paralelizar y se vuelve una cola serie: backend implementa,
después el frontend. Eso es exactamente lo que los contratos vinieron a eliminar, así que el
protocolo se estaba usando para producir el problema que existe para prevenir.

**How to apply:** al bajar un contrato, decí explícitamente que habilita a las dos mitades **en
paralelo** y nombrá el estado intermedio (`[PENDIENTE_INTEGRACION]`, distinto de
`[PENDIENTE_DEVICE]`). Y cuando una sesión reporte «sin cola», antes de reasignar revisá si lo que
espera ya está definido en un contrato abierto — el bloqueo puede ser de lectura, no de dependencia.
El límite real sigue en pie: si al implementar aparece un campo que falta o un error sin definir,
eso sí es `pedido_` a planificación citando el contrato y la línea.

Relacionado: [[coordinacion-tres-sesiones-buzon]] · [[ejecutar-autonomo-no-esperar-si-dale]] ·
[[el-buzon-no-ve-lo-que-otra-sesion-ya-hizo-en-main]]
