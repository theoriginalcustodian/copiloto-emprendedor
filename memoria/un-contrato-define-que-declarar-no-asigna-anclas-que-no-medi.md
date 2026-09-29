---
name: un-contrato-define-que-declarar-no-asigna-anclas-que-no-medi
description: Las reglas de qué declarar sobreviven; las prescripciones concretas que su autor no midió se refutan — y en un contrato una hipótesis se ejecuta en vez de probarse
metadata:
  type: feedback
---

# 📜🎯 Un contrato define QUÉ DECLARAR — no asigna anclas que su autor no midió

En un contrato, **una instrucción se ejecuta; una hipótesis se prueba.** Si se escribe una hipótesis en
modo imperativo, se ejecuta — y encima con autoridad, que es justo lo que impide que la refuten a tiempo.

**Un contrato no asigna anclas concretas (`path:línea`, ids, selectores) que su autor no midió.** Si hace
falta una, va marcada `[ASSUMED_PENDING_VERIFY]` y la reemplaza quien mide.

## La evidencia: 4 de 4 en un día (2026-09-28, BL-Q3 v2)

| Lo que escribí | Qué era | Cómo cayó |
|---|---|---|
| §8.6 «cambien el `waitUntil`» | hipótesis ajena, sin brazo de control | el A/B mostró que la causa era el server; `domcontentloaded` también colgaba |
| §10 «reasignen a `vozchat`» | asumí una plantilla sin contar componentes | son **seis** componentes con su archivo y su rama |
| §9 «midan por `mercadopago`» | ancla inventada | `service-card-status-*` sólo existe en `connected` (`ServiceCard.tsx:134`) |
| el `NO_MEDIBLE` que casi firmé | diagnóstico impecable sobre la pregunta equivocada | el estado estaba en prod, consistente, todo el tiempo |

**Las cuatro las refutó quien fue a medir.** Y las **reglas de qué declarar** —camino (§1), superficie
(§10), dimensión (§11)— sobrevivieron todas.

## El corolario que más rinde

**Dos veredictos opuestos pueden ser verdaderos a la vez** si la fila no declara su dimensión: FE1 firmó
`hitl` COHERENTE **por componente** y auditoría no-comparable **por contenido**, y ninguna se equivocó —
`HitlCard` renderiza un cobro MP o un recordatorio (`hitlMapping.ts:24`, clasifica por `choices`, no por
tipo de negocio). Cuando dos sesiones competentes firman lo contrario, **lo primero a sospechar es el
campo que falta en el contrato**, no la medición de ninguna.

Emparenta con [[el-nombre-es-una-hipotesis-sobre-el-contenido]],
[[una-fila-por-valor-de-una-variable-no-es-una-fila]] y
[[al-juez-tambien-hay-que-darle-el-plano]]. Y con [[prometer-no-es-ejecutar-el-gate-media-la-palabra]]:
una prescripción sin medición propia es una promesa con forma de orden.
