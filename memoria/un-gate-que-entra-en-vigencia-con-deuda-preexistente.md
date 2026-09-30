---
name: un-gate-que-entra-en-vigencia-con-deuda-preexistente
description: Un gate nuevo mide el árbol mergeado, así que si la deuda ya vive en el tronco el merge lo deja rojo para todas las sesiones — la deuda se paga en el mismo PR que lo enciende.
metadata:
  type: feedback
---

Cablé un medidor en el gate y su primera corrida en CI encontró **9 entradas huérfanas que ya estaban
en `main`**, llegadas por un PR ajeno sin sus líneas de índice. La tentación era mergear y abrir un
issue por las 9.

**Eso habría dejado `main` en rojo para las cuatro sesiones**, porque un gate nuevo no mide su propio
diff: mide el **árbol mergeado**, y ahí la deuda preexistente ya vive. El gate se habría convertido en
[[el-guard-se-vuelve-el-cuello-de-botella-de-lo-que-protege]] en el minuto mismo de entrar en vigencia,
y el primer reflejo de cualquier sesión bloqueada por un rojo que no es suyo es **desarmarlo**: un
`|| true`, un `--no-verify`, una excepción «temporal».

**La regla: un gate que entra en vigencia con deuda preexistente trae la deuda pagada en el mismo PR.**
Si la deuda es demasiado grande para eso, el gate entra **avisando** primero y aborta en un segundo PR,
con fecha y dueño — nunca abortando sobre trabajo ajeno que no pidió este gate.

## El precedente que fija de dónde sale el margen

Para indexar las 9 hacía falta espacio bajo el techo del índice, y la primera idea fue bajar lecciones
ajenas a `HISTORIA.md`. Medido: **las 6 líneas más gordas del índice eran las 6 que yo había escrito ese
mismo día** (306, 303, 280, 271, 265 y 253 chars, cada una con dos links más prosa). Recortarlas dio
**242 chars sin perder un solo link**, porque el script aborta si un recorte pierde un puntero:

```python
assert viejos == nuevos, "ABORTO: el recorte de %s pierde %s" % (ancla, viejos - nuevos)
```

**Antes de bajar contenido de otro, el margen sale de la verbosidad propia.** No pierde nada, y el
costo lo paga quien lo generó. La otra sesión lo aceptó como refutación de su propia afirmación de que
«el mecanismo de fusión llegó a su techo».

⚠️ **Y el criterio de bajada, cuando bajar es inevitable:** *¿otra línea del índice ya lleva a la misma
raíz?* — no por largo (baja la mejor línea si resulta ser la más explicada) ni por antigüedad (baja la
única de su clase).
