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

## 🔴🔴 DOS auditorías de eficiencia DEDICADAS (backend + frontend) — elevado por el operador (2026-07-23)
La UI "por momentos se nota muy lenta". El operador lo separa en **dos auditorías**, porque la latencia
vive en lugares distintos:
- **Auditoría FRONTEND:** render/TTI, re-renders, tamaño del bundle, **cold-fetch al montar**, jank de
  gestos/animación, virtualización de listas. Skills que la alimentan: `callstack-react-native-performance`
  (jank/FPS/TTI/re-renders/bundle), `swmansion-rn-animations`/`swmansion-rn-gestures`.
  - **🎯 SÍNTOMA PRECISO #1 (operador, 2026-07-23):** lo que MÁS lento se siente = **el tap en un botón
    → tarda en abrir/ejecutar la apertura del glass; la animación del glass EN SÍ levanta bien.** O sea
    la demora está en el **disparo del tap**, no en el render de la animación. Hipótesis del operador (a
    VERIFICAR, no asumir): *¿el glass se abre al SOLTAR el botón (`onPress`/press-out) en vez de al
    presionar (`onPressIn`)?* — en RN `onPress` dispara al release, y puede sumar demora por
    desambiguación tap-vs-pan (el shell compone Pan del panel + scroll + press). Candidatos a mirar:
    `onPressIn` vs `onPress`, `delayLongPress`/`activeOffset`/`hitSlop`, y si el handler de apertura
    hace trabajo síncrono pesado antes de pintar. Vive en el **shell de glass (`MarcoGlass`/tiles)** —
    mismo hotspot que el freeze. Meta: apertura **ultra-veloz** (idealmente feedback en press-down).
- **Auditoría BACKEND:** latencia de queries, **N+1** (ya hay uno flaggeado: `margen-trabajo` sobre
  `TrabajoStore`, el propio backend lo marcó), cadencia del polling `/reply`, tiempos de respuesta de
  endpoints, eficiencia de queries SQL.

**El método que la hace PRECISA (insistencia del operador: "darle información precisa a Fable"):** una
auditoría vale lo que vale su input. Cada una = (a) **LOCALIZAR** los caminos lentos —qué pantallas/
interacciones, medido en device, frío vs caliente— NO "la app está lenta"; (b) **darle a Fable ese
localizado + el código de ese path + el excerpt de la skill relevante** (así aplica patrones probados de
RN, no consejos genéricos); (c) fix **de raíz, simple, SIN sobreingeniería**. El input #1 de precisión es
la **observación del operador de QUÉ momentos se sienten lentos** — cuanto más específico, mejor la
respuesta. Sigue valiendo **opción A**: el profiling en device se dispara por hallazgo.

## La hipótesis SQLite (mi lectura preliminar, para no codificar la esperanza)
SQLite local en el cliente (RN/PWA) es un patrón **local-first** que puede mejorar la velocidad
**percibida** (la pantalla pinta del cache al instante, sincroniza en background) — ataca el *cold-fetch
al montar*. PERO: (1) es optimización de **lectura**, no fuente de verdad (la verdad es el backend durable
multi-tenant); (2) agrega complejidad (invalidación de cache, sync, conflictos); (3) NO ataca la latencia
del patrón `POST /chat` fire-and-forget + polling `/reply`, que es inherente al agente durable. **Regla:
la eval debe MEDIR dónde se van los ms (red/backend vs render/TTI vs cold-fetch) antes de recomendar
SQLite** — prescribir sin profiling es exactamente codificar la esperanza. [[el-modelo-barato-cobra-17x-tokens-de-imagen]]
(medir el costo), [[no-codificar-la-esperanza-principio-raiz]].

## Cómo correrla (cuando toque) — decisiones del operador FIJADAS (2026-07-23)
- **Report-only**: la eval **detecta y recomienda, NO toca código** (un agente zero-context no tiene el
  contexto para arreglar sin riesgo; los fixes los triageamos nosotros con contexto). Salida a un doc
  estructurado por las dimensiones.
- **Velocidad = opción A (elegida por el operador):** un agente headless leyendo código **NO puede MEDIR**
  la velocidad percibida — sólo revisa anti-patrones y **flaggea candidatos** (incl. SQLite). El
  **profiling real en device** (TTI/latencia/cold-fetch) se dispara **por hallazgo, no por default**
  (device hoy es de backend). La eval mide primero lo que sí puede (seguridad, resiliencia, modularidad,
  anti-patrones de perf); el número de velocidad sale de un profiling posterior sólo si algo aparece.
- Headless (`claude -p`, sesión fresca, modelo `claude-fable-5`) con prompt **estructurado por las
  dimensiones + las exclusiones**, y que ella misma siga measure-first (verificar contra el código vivo,
  no afirmar).

Relacionado: [[agente-conversacional-hardening-3-lentes]] (barrido adversarial 3 lentes ya hecho al
agente), [[copiloto-economia-cogs]], [[factory-identidad-automatizacion-ia]].
