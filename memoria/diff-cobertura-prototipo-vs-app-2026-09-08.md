---
name: diff-cobertura-prototipo-vs-app-2026-09-08
description: Primer diff de cobertura funcional (no de color) entre los 14 mockups del prototipo Odobi y los 18 módulos de la app web — 3 pantallas enteras no existen
metadata: 
  node_type: memory
  type: project
  originSessionId: 5975a22d-dd06-4444-b72a-8d422b4efdc3
  modified: 2026-09-08T13:48:10.540Z
---

El repintado de tokens (18 módulos, 20 gates) NUNCA implicó cobertura funcional completa del
prototipo. Hasta 2026-09-08 nadie había medido si cada pantalla mockeada existe en la app — la
auditoría #498 cubrió sólo tokens/contraste/color. planificación abrió un contrato de lectura pura
para frontend1, que delegó las 14 comparaciones a sub-agentes en paralelo (uno por mockup) y las
volcó en `docs/copiloto-emprendedor/Auditorias/2026-09-08-diff-pantalla-por-pantalla-prototipo-vs-app.md`
(PR #502).

**Resultado:** 2 CUBIERTO (`06-presupuestos`, `12-funciones`) · 8 PARCIAL · 3 AUSENTE · 1 N/A.

**Las 3 AUSENTE son gaps reales, no de repintado:**
- `01-onboarding`: el prototipo pide un onboarding de 3 actos (wordmark animado con pronunciación,
  conversación que pide Mercado Pago + Google, primer insight financiero real como mensaje de
  chat). La app tiene formularios planos de email/password sin nada de eso.
- `08-plan-limites`: el propio mockup se autodeclara "único mockup de visión" — el backend no
  expone plan/consumo (`MeResponse` sin ese campo). `AccountScreen.tsx` sólo tiene una fila
  estática "Plan: Profesional" con un `// TODO backend` propio.
- `10-arranque`: propone una arquitectura de navegación por capas con gestos (sin tabbar), 6 tiles
  con Ajustes movido al avatar — es una síntesis/propuesta de rediseño (marcada "deroga la
  Decisión A" en su propio DECISIONES.md), no algo que ya deba existir.

**Por qué importa:** es la primera vez que existe evidencia escrita de que "implementamos todo el
prototipo" es falso — antes era una laguna de conocimiento, no un hecho medido. Ninguno de los 3
gaps se implementó en este contrato (alcance explícitamente de sólo-lectura); son decisión abierta
del operador sobre qué construir y en qué orden.

Ver también [[copiloto-facturacion-afip]] (05-facturacion salió PARCIAL: el wizard clásico existe
pero es la alternativa que el mockup descarta; falta el flujo conversacional completo con CAE en
el hilo del chat) y el "modelo de capas" ya conocido como decisión abierta (10-arranque es la
misma familia de propuesta que esa).
