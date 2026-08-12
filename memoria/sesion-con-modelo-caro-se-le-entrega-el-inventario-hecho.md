---
name: sesion-con-modelo-caro-se-le-entrega-el-inventario-hecho
description: "Si una sesión corre con un modelo caro, planificación gasta tokens baratos primero y le entrega el inventario ya hecho"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-08-12T15:12:46.617Z
---

Cuando una sesión de la flota corre con un **modelo caro** (la de auditorías corre con Fable), el
contrato que se le baja no se escribe igual: **planificación gasta sus tokens baratos primero** para
producir el inventario, y se lo entrega hecho dentro del contrato. El pedido apunta a paths y
preguntas exactas, nunca a "explorá y contame".

**Why:** el 2026-08-12 el operador lo puso como restricción explícita — *"la sesión de auditoría corre
con fable, es caro y deben ser precisos y concretos los pedidos para ahorrar en tokens"*. Un contrato
abierto ("mapeá la superficie de la app") le hace re-derivar con el modelo caro lo que se obtiene con
tres `git grep` baratos. Concreto: listar los 33 endpoints con ID en la ruta, los 126 tests
adversariales por archivo, y el estado ya verificado de cada hallazgo costó ~4 comandos acá y le
ahorró todo el trabajo de descubrimiento allá.

**How to apply:** antes de bajar el contrato a una sesión cara, (1) corré vos los `git grep` de
inventario y pegá la tabla resultante en el contrato; (2) escribí una sección **"PROHIBIDO gastar
tokens en"** que nombre lo ya verificado, lo fuera de scope y la exploración abierta; (3) definí el
formato del entregable en líneas máximas, para que no escriba "análisis ejecutivo"; (4) pedile que
declare lo NO cubierto si se le agota el presupuesto — un alcance recortado en silencio se lee como
"cubrimos todo" ([[instrumentos-que-confirman-en-vez-de-verificar]]). Relacionado:
[[aplicar-siempre-ejecutar-con-eficiencia]] · [[coordinacion-tres-sesiones-buzon]]
