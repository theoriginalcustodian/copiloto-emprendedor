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
de aprendizajes → F6 verificación real → **F7 auditoría del RESULTADO** → **F7.5 implementar los
aprendizajes** → F8 corte y plan N+1.

**Las dos auditorías no se solapan, y ésta es la razón:** A1 audita una **intención** (un texto que
dice lo que vamos a hacer); A2 audita un **hecho** (código escrito + el proceso que ocurrió + el propio
A1). Hay cosas que no se pueden saber antes de construir, por definición — el delta plan↔realidad, lo
que el sprint destapó, si los consejos de A1 sirvieron.

**Las cuatro piezas que más rinden, y que son las que se olvidan:**

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

4. **Implementar antes de volver a empezar (F7.5).** Un aprendizaje redactado y no implementado es
   **información**, no aprendizaje. La cola vive en `docs/aprendizajes/pendientes/` — **versionada**,
   porque en `coordinacion/` (gitignored) un `clean` la evapora. Implementar = `git mv` a
   `docs/aprendizajes/<fecha>/`: el estado es la ubicación, no un tablero que hay que acordarse de
   actualizar. **`pendientes/` vacío es gate binario del REPARTO (F3), no de F0**: los ganchos
   cambian *cómo se construye*, no cómo se redacta — con el gate en F3, planificación escribe y
   audita el plan N+1 mientras las implementadoras cierran el N, y desaparece el valle en que las
   tres sesiones paran juntas. Y **sólo el nivel 1 genera cola** (el
   2 se hace en el acto, el 3 ya está hecho al escribirlo) — meter los tres la vuelve impagable y se
   abandona entera. Dos colas distintas y en este orden: **fixes de aprendizaje primero, fixes de la
   app después** — los primeros cambian *cómo se construye*.

**R8 de A1 — lo que separa un sprint autónomo de uno que se cuelga:** todo insumo que **sólo una
persona** puede dar (credencial, decisión de producto, device, habilitación externa) se declara en el
plan y se provee **antes** del reparto, o el hito no entra. El ejecutor autónomo no negocia con el
mundo: llega al muro más rápido y con media cosa construida.

**Quién hace qué:** coordinación **nunca** implementa código de producto; la auditoría **no vive** —
se invoca dos veces por sprint, headless, con un modelo **distinto** al de las sesiones que trabajan
(un auditor del mismo modelo valida el mismo razonamiento que produjo el plan).

**Verificado el 2026-07-24:** el auditor headless tiene acceso al MCP del grafo y al código real, y
ejecutó el ciclo canónico solo — grafo para localizar, archivo para confirmar. Ver
[[grafo-primero-codigo-despues-para-localizar]].

Relacionadas: [[instrumentos-que-confirman-en-vez-de-verificar]] (la ley de los instrumentos, §12 del
doc) · [[la-regla-que-te-obliga-a-mirar-el-instrumento-equivocado]] · [[cero-deuda-no-gestionada]] (lo
que no entra en el corte de A2 queda como deuda visible con dueño).
