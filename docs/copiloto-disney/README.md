# Copiloto Disney — evaluación de vertical

> **Estado: EN EVALUACIÓN. No se construye nada todavía.** El producto entero cuelga de un supuesto
> sin validar (S1, abajo). Fecha de arranque: 2026-07-20.

---

## Qué es

Evaluación de un copiloto vertical para **agentes de viajes especializados en Disney**: un asistente
activo tipo secretario (NO un CRM) que captura las ventas sin fricción, mantiene el estado del negocio,
vigila los deadlines derivados de las reglas del proveedor y **actúa** proactivamente.

Disparador: la hermana del operador es agente Disney y pasó como referencia la app **Venselo**, que se
usa acá como fuente de dominio — no como benchmark de producto.

## Decisiones ya tomadas por el operador

| # | Decisión | Fecha |
|---|---|---|
| 1 | **Producto vertical comercial**, no herramienta interna. Precio objetivo **US$50/usuario/mes**, posicionado como categoría nueva ("copiloto/secretario") por encima de los CRM Disney de $10-40. | 2026-07-20 |
| 2 | **Núcleo agnóstico, primer mercado concreto.** Modelo y reglas parametrizados desde el día 0 (moneda, idioma, proveedor); integraciones concretas solo para el primer mercado (LatAm/USD). | 2026-07-20 |
| 3 | **Línea roja:** prohibido usar credenciales de My Disney Experience del cliente final. Práctica extendida en el nicho, viola TOS de Disney y expone datos de tarjetas de terceros. | 2026-07-20 |
| 4 | **Owner humano del ruleset** con vigilancia automática asistida (RSS + clasificador LLM que propone, humano que aprueba). Patrón del docketing legal. | 2026-07-20 |
| 5 | **Disney como ruleset cargado, no como esquema.** El ledger y el motor son agnósticos de proveedor. Precedente: comisiones de aerolíneas 2002. | 2026-07-20 |
| 6 | **Aislamiento extractor/agente** contra la lethal trifecta: el componente que lee mails no tiene tools ni comparte contexto con el que ejecuta acciones. Recomendación del agente, sin objeción del operador. | 2026-07-20 |

## El gate: nada se construye antes de S1

**S1 — ¿los mails *trade* que recibe la agente traen los datos del booking?** (fechas, monto, deadline de
pago final, número de confirmación). Toda la propuesta de valor —captura cero-touch, backfill del inbox
como onboarding mágico, deadlines duros extraídos del documento— cuelga de esto.

Evidencia a favor: TripIt parsea todos los formatos consumer de Disney desde antes de los LLM. Evidencia
en contra: nadie documentó nunca el parseo de mails *trade*, y la reserva vive en el sistema propietario
de Disney/VAX.

- **Spike:** 20-30 mails reales de la usuaria-cero → correr el extractor del stack.
- **Criterio:** ≥90% de precisión field-level; deadline de pago final presente en ≥80% de los mails de paquete.
- **Plan B si falla:** captura conversacional-first + import de planilla. Sigue ganándole a una categoría
  100% manual, pero **es otro producto** y el posicionamiento se re-aprueba.

Insumo del spike: [guión de entrevista](2026-07-20-guion-entrevista-agente-disney.md) (incluye el pedido
de los mails).

## Investigación

Seis informes, todos con fuentes citadas y etiquetado explícito de verificado / inferido / no verificado.

| # | Documento | Qué contiene |
|---|---|---|
| 01 | [Dominio del agente Disney](research/01-dominio-agente-disney.md) | Cómo opera el negocio, comisiones por proveedor, **las fechas-regla** (WDW/DCL/Universal), dolores documentados, herramientas del nicho. |
| 02 | [Modelo de dominio de Venselo](research/02-venselo-modelo-dominio.md) | Reconstrucción del modelo de datos del competidor desde screenshots. |
| 03 | [SOTA canónico](research/03-trifecta-sota-canonico.md) | Cómo la industria construye esto: legal docketing, proactividad, extracción, durabilidad, memoria, HITL. |
| 04 | [SOTA lateral](research/04-trifecta-sota-lateral.md) | Los atajos que colapsan el problema: el inbox como fuente única, host agencies como canal. |
| 05 | [Failure map](research/05-trifecta-failure-map.md) | 30 modos de fallo con trigger observable, severidad y mitigación de industria. |
| 06 | [Decision matrix](research/06-trifecta-decision-matrix.md) | **La síntesis.** 42 decisiones IF/THEN, 6 decisiones mayores, 7 supuestos críticos, 14 cosas que no construir. |

## Restricciones de diseño con número (no son opiniones)

- **Presupuesto de interrupciones:** >6 push/semana → 3.4× desinstalaciones a 30 días. La métrica de
  producto es el **% de alertas accionadas**, no cuántas se mandan.
- **Extracción sin validar:** alucina campos en 28.7% de los documentos; 68% de los errores financieros
  son números inventados. Validación multi-etapa lo baja a 3.5%. El confirm-gate es control de
  integridad, no UX.
- **Confianza (Dietvorst):** un error visible del algoritmo destruye la confianza más rápido que el mismo
  error humano, y con errores grandes no hay recuperación. Contramedida: deadlines editables y
  "mostrame de dónde lo sacaste" desde la v1.

## Qué sigue

1. Conseguir los mails y los audios de la usuaria-cero.
2. Correr S1 (y de paso S2, S4, S7, que salen del mismo corpus).
3. **Recién ahí**: arquitecturas candidatas, recomendación y spec.

Las decisiones mayores que quedan abiertas (canal de inbox, distribución host-vs-asiento, packaging,
marco de privacidad) están en la §2 de la [decision matrix](research/06-trifecta-decision-matrix.md) y
varias dependen del resultado de los spikes — no se deciden antes.
