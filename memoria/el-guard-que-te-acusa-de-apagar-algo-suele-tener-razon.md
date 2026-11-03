---
name: el-guard-que-te-acusa-de-apagar-algo-suele-tener-razon
description: Un guard que rechaza tu fix diciendo «esto es un apagado» casi siempre acertó; la salida no es editarlo sino volver tu cambio incapaz de causar lo que teme.
metadata:
  type: feedback
---

**El guard que te acusa de apagar algo suele tener razón, y la salida NO es editarlo.**

Medido el 2026-11-03 en `#1466`. Mi fix hacía que un broadcast `a-todos` no interpelara a los roles
sin sesión en el sprint — correcto en su intención. `test-escalador-roles-declarados.sh` caso 1 lo
rechazó: *«cambió el comportamiento por defecto — esto NO es un fix, es un apagado»*. Y tenía razón:
un broadcast cuyos destinatarios se filtran uno por uno puede terminar **sin interpelar a nadie**, y
una alarma que no interpela a nadie no se reclama nunca.

**Why:** desde afuera, un fix y un apagado son **indistinguibles por la intención** — los dos
reducen el ruido, los dos dejan el gate más callado. Lo único que los separa es una propiedad
verificable: **la exclusión no puede dejar el conjunto VACÍO**. Mientras esa propiedad no esté en el
código, la buena fe del autor es la única garantía, que es exactamente lo que un guard existe para
no tener que creer.

**How to apply:**
- Un guard rojo sobre tu propio cambio es un hallazgo, no un obstáculo. Antes de tocarlo, preguntate
  qué estado teme y si tu cambio **puede** producirlo. Si puede, el guard acertó.
- La salida es un **FAIL-OPEN**: si el filtro dejaría cero elementos, caé al universo completo.
- El test que te cazó se **conserva intacto** y se corre con el default neutralizado por env
  (`UC_ROLES_SIN_SESION= correr`), nunca reescrito para que pase. Y entra un caso nuevo que es el
  control del mecanismo agregado: excluyendo a TODOS, el escalador sigue nombrando a alguien.
- Error de método que lo dejó llegar a CI: corrí **sólo mi propio test**, no la suite.
  [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] · [[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]
