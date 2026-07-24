---
name: definicion-delgada-de-ux-se-llena-con-el-port-del-canonico
description: Cuando el plan NOMBRA un componente/interacción pero no la ESPECIFICA, es una decisión abierta, no cerrada — y "portar del canónico (documed)" importa en silencio la respuesta de ESA app, que puede exceder o contradecir la intención; agravado si se mis-cita una decisión cerrada ajena como autoridad
metadata:
  type: feedback
---

Una línea del plan que **nombra** algo sin **especificarlo** —"`BotonVoz` + `Onda` (feedback visual)"—
NO es una decisión cerrada: es un `[ASSUMED_PENDING_VERIFY]` disfrazado de spec. El vacío se llena, y
se llena con el **port entero del canónico** (documed), que trae **más** (o **distinto**) de lo que la
intención pedía.

**Caso raíz (2026-07-23, dictado por voz):** F6 definió "`BotonVoz` + `Onda`". El implementador portó de
documed el **glass HUD completo** (contador + 4 botones, abierto por un toque) — over-build — y a la vez
**quitó** el gesto de documed (mantener-apretado + deslizar-para-fijar) — under-build — atribuyendo
**ambas** cosas a *"D6 fijó dictado corto"*. Pero **D6 gobierna el camino de DATOS** (mic→Groq, sin
retención), **no la UX**. Se mis-citó una decisión cerrada ajena como autoridad de una decisión que nunca
se tomó. Y el matiz espejo: la memoria del **propio operador** ("habíamos definido hold+deslizar, sin
glass") **tampoco estaba literal en F6** — era el comportamiento de documed. **Los dos lados driftaron
desde un spec delgado hacia su propio modelo del canónico.**

**Why:** un spec delgado no se siente abierto — se siente cerrado, porque nombra el componente. Nadie lo
marca como pendiente, así que el vacío de interacción/superficie lo resuelve quien implementa, en
silencio, y "portar de documed" hace ese relleno **invisible**: importa la respuesta de una app cuyo caso
(consulta clínica de 40 min, retención local, huérfanos) es **más pesado** que el nuestro (dictado corto,
cero retención). El resultado es indistinguible de una decisión tomada — hasta que el operador lo prueba
en device y no es lo que quería. Es la cara "de definición" de [[el-contrato-afirma-el-mecanismo-que-no-opero]]
y el reverso de [[consultar-documed-siempre-antes-de-implementar]] (portar ADAPTANDO, no ciego): acá el
problema no fue copiar de más un mecanismo, fue que **la definición de origen era el hueco**.

**How to apply:**
1. **Si el plan nombra un componente pero no su interacción/gesto/superficie (modal, glass, contador),
   eso es abierto → verificar la intención ANTES de portar, no llenarlo con el canónico.** "BotonVoz"
   no dice tap-vs-hold; "Onda" no dice glass-vs-flotante.
2. **Una decisión cerrada (D6) sólo autoriza lo que literalmente cubre.** Antes de citar "X ya lo fijó",
   leer qué fijó X. D6 = retención de datos, no UX. Mis-citar una decisión cerrada convierte un supuesto
   en falso-consenso.
3. **Al portar del canónico, declarar QUÉ comportamiento se importa y por qué** — documed tiene DOS
   grabadores (clínico pesado con retención/anclaje, y voz-comando corto): traer el equivocado es el
   error espejo. Nombrar cuál y contra qué requisito.
4. **El síntoma en device es el juez** del spec, no la autoevaluación: "se reinicia / solo arranca
   deslizando" reveló que ni el toque simple funcionaba (robo de gesto por el `ScrollView` ancestro).
