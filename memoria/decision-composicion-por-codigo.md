---
name: decision-composicion-por-codigo
description: Decisión MAYOR del operador (2026-06-23) — el plano de composición de microservicios se hace por CÓDIGO (build-time/monorepo), no por servicio. Por-servicio diferido, no descartado.
metadata:
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**D-1 DECIDIDA (operador, 2026-06-23): composición de la biblioteca de microservicios = por CÓDIGO.** Las piezas van **integradas en un mismo desarrollo** (un solo deployable, acople en build-time vía import/módulo) — la vía de cero fricción para validar la composición. **Por servicio** (cada microservicio desplegado aparte, comunicándose por red HTTP/eventos) queda **diferido, NO descartado**: es la opción de evolución para cuando una pieza necesite escalar sola → el diseño por código **debe dejar la frontera inter-pieza limpia** para no bloquear ese salto (strangler-fig, aditivo).

**Estado del frente composición:** con D-1 cerrada, **Composición-1 (diseñar la capa de composición) está desbloqueada**; resta solo el spike **Composición-0** (componer 2 microservicios de la biblioteca en un mini-sistema para de-riskear). Es el salto que sigue a la biblioteca de primitivas completa ([[frente1-biblioteca-completa]]): de generar UN microservicio → componer N en un sistema (mismo modelo C-2, otro grano — el operador origina el negocio del sistema, Claude deriva qué piezas componer + el pegamento). Doc: `docs/Follow up/2026-06-23-pulido-plano-microservicios-a-composicion.md` (D-1 marcada ✅ ahí, edit en working dir sin commitear aún — batcheado con el próximo trabajo). [[asistente-generar-plano]]
