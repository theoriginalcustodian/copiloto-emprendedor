---
name: eval-global-app-fable5-zero-context-pendiente
description: Tarea FUTURA (gated a "cuando termine lo pendiente") — evaluación global de la app con Fable 5 headless zero-context para máxima objetividad; scope = robustez/resiliencia/seguridad/escala-sin-fricción/VELOCIDAD percibida; excluye infra externa y features faltantes conocidas
metadata:
  type: project
---

**DISPARADOR: cuando cierre TODO lo pendiente del sprint actual (IN + mobile-first).** El operador
(2026-07-23) pidió una **evaluación global de la app** con **Fable 5 en headless, con CERO contexto de
conversación** — a propósito, para máxima objetividad: un revisor sin los supuestos acumulados de esta
sesión, ojos frescos sobre el código. (Alineado con "verificación por perspectiva independiente".)

## Qué evalúa (el foco)
- **Áreas de conflicto** (race conditions, consistencia de estado, el bug "narra sin hacer", coordinación).
- **Mejoras** hacia **escalar con CERO fricción**: modular, eficiente, boundaries limpios (motor
  vendorizado, multi-tenant per-request).
- **Seguridad**: aislamiento multi-tenant (los guards/tests adversariales), auth/GoTrue, secretos.
- **Resiliencia/confiabilidad**: gran parte YA lograda con **Temporal** (el moat durable) — el foco es
  *dónde quedan huecos NO-durables*.
- **🔴 VELOCIDAD PERCIBIDA** (lo que el operador subrayó): la rapidez con que se muestran info y pantallas.
  Hipótesis suya a evaluar: *¿un SQLite local daría más velocidad?* — **medir dónde está la latencia real
  ANTES de prescribir** (ver abajo).

## Fuera de scope (explícito del operador)
- **Infra externa**: servidores, bases de datos, etc. — "no es de nuestra incumbencia". Dejamos una app
  lista para escalar a miles de usuarios; el afuera no.
- **Features faltantes conocidas**: selección de planes, elementos de gestión de la app. NO es por ahí.

## La hipótesis SQLite (mi lectura preliminar, para no codificar la esperanza)
SQLite local en el cliente (RN/PWA) es un patrón **local-first** que puede mejorar la velocidad
**percibida** (la pantalla pinta del cache al instante, sincroniza en background) — ataca el *cold-fetch
al montar*. PERO: (1) es optimización de **lectura**, no fuente de verdad (la verdad es el backend durable
multi-tenant); (2) agrega complejidad (invalidación de cache, sync, conflictos); (3) NO ataca la latencia
del patrón `POST /chat` fire-and-forget + polling `/reply`, que es inherente al agente durable. **Regla:
la eval debe MEDIR dónde se van los ms (red/backend vs render/TTI vs cold-fetch) antes de recomendar
SQLite** — prescribir sin profiling es exactamente codificar la esperanza. [[el-modelo-barato-cobra-17x-tokens-de-imagen]]
(medir el costo), [[no-codificar-la-esperanza-principio-raiz]].

## Cómo correrla (cuando toque)
Headless (`claude -p`, sesión fresca, modelo `claude-fable-5`) con un prompt de eval **estructurado por
las dimensiones de arriba + las exclusiones**, y que ella misma siga measure-first (profilear TTI/latencia
real, verificar contra el código vivo, no afirmar). Relacionado: [[agente-conversacional-hardening-3-lentes]]
(barrido adversarial 3 lentes ya hecho al agente), [[copiloto-economia-cogs]], [[factory-identidad-automatizacion-ia]].
