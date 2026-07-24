---
name: loop-auditoria-fable-analisis-opus-contratos-e2e
description: LOOP REUTILIZABLE (operador 2026-07-23, "lo usaremos en varias ocasiones") — auditar con Fable zero-context → analizar + diseñar fixes de raíz con Opus/planificación → redactar contratos → backend/frontend implementan y prueban E2E desde el teléfono → funcionando. El reparto por modelo aplicado a la mejora continua
metadata:
  type: feedback
---

Patrón de **mejora dirigida por auditoría**, reusable cada vez que haya que subir la calidad de un
frente (perf, seguridad, resiliencia, UX). Cuatro fases, cada una en el rol/modelo que le corresponde
([[verificar-la-composicion-root-no-el-default]] del reparto: auditor fresco → diseñador con contexto →
ejecutor barato).

## Las 4 fases

1. **AUDITAR — Fable 5 headless, zero-context, report-only.**
   Un revisor sin los supuestos acumulados de la sesión (máxima objetividad). **Detecta y recomienda, NO
   toca código.** Salida = doc estructurado de hallazgos. Detalle de cómo correrla:
   [[eval-global-app-fable5-zero-context-pendiente]].

2. **ANALIZAR + DISEÑAR — Opus / planificación (esta sesión, 1M de contexto).**
   Leer la salida de Fable y **diseñar los mecanismos de mejora que resuelven de RAÍZ** cada hallazgo
   ([[raiz-no-parche]]), **sin sobreingeniería** — la solución más simple que cumple, sin gold-plating.
   Para **ambos** frentes (backend + frontend). Es el paso de JUICIO: por eso vive en Opus, no en el
   ejecutor. 🔴 **Gate spike-first:** si un hallazgo se apoya en un supuesto crítico no validado (ej.
   *"un SQLite local daría más velocidad"*), **medir/spikear ANTES de diseñar** — el diseño sale del
   resultado, no de la recomendación de Fable ([[no-codificar-la-esperanza-principio-raiz]]). Fable
   flaggea candidatos; Opus decide qué es real y cómo se resuelve.

3. **CONTRATAR — redactar los `contrato_` para backend/frontend.**
   Cada contrato = el diseño de la fix + **DoD binario** + la exigencia de **probar E2E desde el
   teléfono**. Si cruza la junta backend↔app, baja como `contrato_` con la forma del endpoint ANTES de
   que nadie implemente ([[coordinacion-tres-sesiones-buzon]]). Localizado y estructurado, no una orden
   genérica ([[localizacion-estructurada-feedback-agentes]]).

4. **EJECUTAR + PROBAR — backend/frontend (Sonnet) implementan y verifican E2E en device.**
   No cierra hasta **"listo y funcionando perfectamente E2E desde el teléfono"** — verde en jest ≠
   verificado ([[gate-jsdom-no-ve-gestos-tactiles]], [[entrega-progresiva-y-e2e-en-device]]). El device
   es de dueño único ([[device-fisico-exige-dueno-unico]]).

## Por qué el reparto es así (no es casual)
- **Fable audita** porque el sesgo de la sesión (supuestos acumulados) ciega al que construyó; ojos
  frescos ven lo que el autor no. Zero-context es la feature, no un límite.
- **Opus diseña** porque convertir hallazgos en una arquitectura de fix de raíz es juicio cross-dominio
  — el rol que retiene el cuadro entero (las 3 sesiones, la historia, la junta). No se delega al ejecutor.
- **Sonnet ejecuta** porque implementar un contrato preciso es scope acotado — barato y suficiente.

## Cuándo usarlo
Cualquier subida de calidad no trivial: perf/velocidad, seguridad, resiliencia, refactor de deuda,
hardening. NO para un fix trivial single-file (ahí el overhead del loop no rinde). Primera instancia
pendiente: las auditorías de eficiencia backend+frontend de [[eval-global-app-fable5-zero-context-pendiente]].
