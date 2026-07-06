---
name: gate-jsdom-no-ve-gestos-tactiles
description: "El gate vitest/jsdom NO modela el touch real (touch-action, pointer-capture, momentum, resize) → los bugs de gesto pasan en verde y fallan en el teléfono. Verificar gestos en device o con Playwright touch, no solo con el gate."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

En frontend móvil, **un fix de gesto que pasa el gate (vitest/jsdom) en verde NO está verificado**. jsdom no modela `touch-action`, pointer-capture implícito de touch, inercia/momentum, ni resize/scroll-anchoring reales. Los bugs de swipe/scroll/tap **solo aparecen en el dispositivo**.

**Why:** en el sprint de UX móvil del copiloto (2026-07-04) se shippearon 3-4 fixes "verdes" seguidos que en el Android del operador fallaban distinto cada vez (swipe-to-dismiss que no cerraba por falta de `touch-action:none`; oscilación del chrome por resize-scroll que jsdom no reproduce). Cada deploy verde-pero-roto quemó una ronda y la paciencia del operador ("renegamos más que creando una app entera"). La raíz no era perder contexto: era confiar en un gate ciego al touch.

**How to apply:** (1) tratá el gate jsdom como necesario-pero-no-suficiente para gestos táctiles — verde ≠ verificado en device. (2) Antes de declarar un fix de gesto "listo", reproducí el gesto real: en el teléfono del operador, o con Playwright + emulación móvil/touch contra el sitio vivo (es más barato que 2 rondas de adivinar; el operador rechazó Playwright cuando era para reproducir lo que ya se sabía, pero para gestos device-only SÍ vale). (3) Cuando el fix sea "por construcción" (ej. gate por dedo-apoyado en el hide-on-scroll), escribí el test que fija ese contrato aunque jsdom no ejercite el gesto — el test protege la invariante, no reemplaza el device. (4) No shippees fix-tras-fix de gesto a ciegas: hacé snapshot del comportamiento real primero (G-1), no stream. [[copiloto-frontend-movil-ux-estado]] [[no-codificar-la-esperanza-principio-raiz]] [[no-pelear-con-la-fabrica-hand-fix-primero]]
