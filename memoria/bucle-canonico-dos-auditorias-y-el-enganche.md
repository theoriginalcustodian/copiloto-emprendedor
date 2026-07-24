---
name: bucle-canonico-dos-auditorias-y-el-enganche
description: El ciclo de desarrollo con agentes en paralelo, canonizado el 2026-07-24. Dos auditorías externas en los extremos + captura continua en el medio. Doc completo en docs/BUCLE-CANONICO.md.
metadata:
  type: project
---

**Documento canónico: [`docs/BUCLE-CANONICO.md`](../docs/BUCLE-CANONICO.md)** (PR#122, v1.0, agnóstico
de repo — se replica a todos los proyectos). Acá sólo lo que hay que recordar sin abrirlo.

**El ciclo:** F0 sincronizar el índice de código *y verificarlo* → F1 plan **sobre código real** →
**F2 auditoría del PLAN (bloquea el reparto)** → F3-F4 contratos y construcción → F5 captura continua
de aprendizajes → F6 verificación real → **F7 auditoría del RESULTADO** → F8 corte y plan N+1.

**Las dos auditorías no se solapan, y ésta es la razón:** A1 audita una **intención** (un texto que
dice lo que vamos a hacer); A2 audita un **hecho** (código escrito + el proceso que ocurrió + el propio
A1). Hay cosas que no se pueden saber antes de construir, por definición — el delta plan↔realidad, lo
que el sprint destapó, si los consejos de A1 sirvieron.

**Las tres piezas que más rinden, y que son las que se olvidan:**

1. **A1 tiene que poder RECHAZAR.** Su criterio nº1 es el anclaje: toda afirmación de existencia o
   ausencia con `path:línea` verificable; si falla, no se mira el resto. Si A1 aprueba todos los
   planes, no se está aplicando — se está usando como sello.
2. **Capturar ≠ consolidar.** Coordinación captura barato y en vivo (una línea + evidencia, append a
   `coordinacion/APRENDIZAJES-SPRINT.md`); A2 consolida una vez al cierre. Si cada micro-aprendizaje
   se vuelve documento permanente, el índice de memoria crece sin techo y su costo se paga en **cada**
   sesión, para siempre. Si no se captura en el momento, se pierde.
3. **Taxonomía de enganche — mecánico > contextual > documental.** Un aprendizaje sin enganche es una
   nota; con enganche es un órgano. Subir siempre al nivel más alto que el error permita, y aplicar el
   test binario: **¿puede volver a pasar?** Si la respuesta es sí, el aprendizaje está anotado, no
   cerrado. *Una regla escrita protege del **olvido**, no de la **racionalización*** — evidencia: el
   canon de git compartido se recita cada turno y sigue sin hook que lo bloquee; backend conocía la
   regla del buzón y la ignoró «por reflejo, no por decisión».

**Quién hace qué:** coordinación **nunca** implementa código de producto; la auditoría **no vive** —
se invoca dos veces por sprint, headless, con un modelo **distinto** al de las sesiones que trabajan
(un auditor del mismo modelo valida el mismo razonamiento que produjo el plan).

**Verificado el 2026-07-24:** el auditor headless tiene acceso al MCP del grafo y al código real, y
ejecutó el ciclo canónico solo — grafo para localizar, archivo para confirmar. Ver
[[grafo-primero-codigo-despues-para-localizar]].

Relacionadas: [[instrumentos-que-confirman-en-vez-de-verificar]] (la ley de los instrumentos, §11 del
doc) · [[la-regla-que-te-obliga-a-mirar-el-instrumento-equivocado]] · [[cero-deuda-no-gestionada]] (lo
que no entra en el corte de A2 queda como deuda visible con dueño).
