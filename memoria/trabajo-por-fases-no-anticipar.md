---
name: trabajo-por-fases-no-anticipar
description: El operador valida por fases con disciplina. No martillar con dependencias/riesgos de fases futuras mientras se valida la actual.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 22f9be26-6dc0-477b-b7b3-0d6b7afc3ac6
---

El operador trabaja **por fases, una validación por vez** — es disciplina deliberada, no un descuido. Cuando una fase valida el componente X (ej: el verificador/gate de tests del loop), el análisis y la verificación se enfocan en X. No se arrastra el riesgo/dependencia de una fase posterior a la mesa actual.

**Why:** insistir con un pendiente de otra fase (caso concreto 2026-06-16: martillar repetidamente con "el cross-corte sigue sin validar" durante el spike que validaba el *verificador* del loop) es ansiedad, rompe el foco de la fase y termina siendo aprobación-ritual invertida — el espejo del failure mode que el global prohíbe. "Vamos por fases, no todo junto" es la postura correcta.

**How to apply:** distinguir "luz verde para construir el siguiente componente" de "fase N validada" está bien decirlo **una vez** si aporta claridad de alcance. Repetirlo es martillar. Mencioná una dependencia de fase futura como mucho una vez; no vuelvas a traerla salvo que el operador la ponga en mesa. La validación empírica del global se aplica **a la fase activa**, no a anticipar las que vienen. Relacionado: el diferenciador durable del proyecto vive en [[loop-engineering-framing]] — es real pero su prueba es una fase propia, futura, no un caveat a repetir en cada turno.
