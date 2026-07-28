---
name: un-test-sin-cota-cuelga-en-vez-de-decirte-que-falta
description: Un `while` esperando una condición que nunca llega no falla — cuelga hasta el timeout del runner, y no dice nada. Con cota + el estado real en el mensaje, el mismo test te dice en una corrida exactamente qué faltaba.
metadata:
  type: feedback
---

**LEER al escribir cualquier test que espere a que un sistema llegue a un estado** (workflows de
Temporal, polling, colas, UI asíncrona).

2026-07-28. Un test del gate HITL de `FacturaWorkflow` hacía:

```python
while (await handle.query("estado"))["estado"] != "esperando_confirmacion":
    pass
```

El borrador nunca llegaba a ese estado. El test **no falló**: consumió los 400 s del runner, se fue a
background, y el único dato que dejó fue "timeout". Cero información sobre la causa.

Con la cota puesta:

```python
for _ in range(300):
    estado = await handle.query("estado")
    if estado["estado"] == "esperando_confirmacion":
        return handle
raise AssertionError(f"la factura no llegó al gate HITL: {estado}")
```

La corrida siguiente contestó, textual: `estado='borrador'`, `faltantes=[{'codigo':
'condicion_venta_vacia', ...}]`. **Un dato exacto en 2 segundos**, donde adivinar habría costado
varias vueltas de "probá agregando esto".

**Por qué rinde tanto para lo que cuesta.** Un test que cuelga y uno que falla se ven parecidos desde
afuera —los dos "no pasaron"— pero informan cosas opuestas: el que falla trae el estado real, el que
cuelga trae la nada. Y el que cuelga además **castiga**: bloquea el runner, se lleva el turno entero,
y empuja a diagnosticar por hipótesis en vez de por lectura.

**Dos detalles que importan:**
1. **Volcar el estado ENTERO, no los campos que creés relevantes.** Mi primera versión imprimía
   `estado['errores']` → `KeyError`: la clave se llamaba `faltantes`. Adiviné hasta en el mensaje de
   error. `f"...: {estado}"` no puede equivocarse.
2. **La cota no es un timeout disfrazado.** No es "esperá más": es "si no llegó en N vueltas, algo
   estructural está mal y quiero saber qué era".

Aplica igual al código de producción: [[una-espera-sin-disparador-nombrable-es-paralisis]] es esta
misma idea al nivel del agente. Y es hermana de
[[instrumentos-que-confirman-en-vez-de-verificar]]: allá el instrumento miente en verde, acá se calla.
