# Auditoría UI — app actual (22/07/2026)

**Objeto:** https://copilotoemprendedor.duckdns.org/ · SPA Vite + PWA (service worker), sin SSR.
**Propósito:** base del slide 4 del deck. Qué se conserva, qué se corrige y por qué, con fundamento citable.

---

## 1. Qué se conserva (funciona y es coherente con la marca)

| Elemento | Por qué se conserva | Fundamento |
|---|---|---|
| Navegación de 4 secciones (Chat / Apps / Conexiones / Cuenta) | Arquitectura de información simple, ya aprendida por usuarios de prueba | Heurística Nielsen #6 (reconocimiento antes que recuerdo); cambiar IA sin motivo = costo sin beneficio |
| Input con mic siempre visible | La voz es el canal identitario ("el nombre es el comando", handoff §3). El acceso a voz no puede depender de navegación | Wilensky: la invocación por voz es impresión de marca (20+/día). Ocultarla contradice la estrategia |
| "✓✓ recibido" estilo WhatsApp | Toma prestada una convención que el emprendedor argentino ya domina. Cero curva de aprendizaje | Jakob's Law: los usuarios prefieren que tu app funcione como las que ya usan. WhatsApp es EL referente local |
| Infraestructura de theming del código | El mecanismo técnico (variables intercambiables) sirve para los 2 temas oficiales | Se reusa el motor, se eliminan los skins (ver hallazgo 1) |

---

## 2. Hallazgos críticos (se corrigen en este rediseño)

### Hallazgo 1 — Cuatro skins intercambiables destruyen la identidad
**Evidencia:** Aurora Glass, Soft Daylight, Refined Dark, Tema AI. Cada uno cambia paleta, atmósfera y personalidad completa de la app.
**Problema:** una marca que cambia de piel a gusto del usuario no acumula reconocimiento. Chaves: la identidad exige *constancia de los signos identificadores*; la versatilidad es adaptarse a contextos **sin perder identidad**, no ofrecer identidades alternativas. Wilensky: los distintivos de marca deben ser estables para capitalizar cada exposición.
**Corrección:** exactamente 2 temas (claro/oscuro) con identidad constante: misma terracota, misma tipografía, mismos componentes. El theming técnico se reusa; los skins mueren.

### Hallazgo 2 — Orbe azul con glow = cliché de asistente IA
**Evidencia:** orbe/esfera con glow como representación del agente; paleta azul-violeta genérica.
**Problema:** es el signo visual más saturado de la categoría (Siri, Copilot, Gemini y decenas de wrappers). Chaves: la *singularidad* es parámetro de calidad — un signo que usan todos no identifica a nadie. Además colisiona con la diferenciación obligatoria del handoff §4.3 (vs. asistentes con esferas/degradés y fintechs azul-violeta).
**Corrección:** prohibición dura de orbes, glow y degradés azul-violeta. El agente se representa con el sistema de marca (terracota como señal, territorio O+onda delegado a la diseñadora) y con **estados de interfaz** (escucha, procesa, listo), no con una mascota luminosa.

### Hallazgo 3 — Cuatro familias tipográficas
**Evidencia:** General Sans, Manrope, JetBrains Mono, Space Grotesk conviviendo.
**Problema:** ruido jerárquico y señal de improvisación. Ninguna es la tipografía de marca. Chaves: *calidad gráfica* y *ajuste tipológico* — el sistema tipográfico es un signo identificador, no una colección.
**Corrección:** 2 familias cerradas — NeueEinstellung Bold (display) + Inter Regular/Medium (UI). 4 tamaños, 2 pesos de UI. Tokens en `tokens/odobi.css`.

### Hallazgo 4 — El agente tutea cuando la marca vosea (REVISADO tras auditar el repo)
**Evidencia original:** "tienes que decirme qué necesitas" (tuteo neutro) en el sitio desplegado (22/07).
**Matiz del repo (auditado 22/07):** el código en main YA está en voseo — system prompt "Sos el copiloto… respondé en español rioplatense" (`apps/copiloto/system_prompt.py`), placeholder "Escribile a tu copiloto…" (`Composer.tsx`), "Retomá donde quedaron" (`AccountScreen.tsx`). El tuteo detectado vive en el **deploy desactualizado**, no en el código actual.
**Problema real:** desincronización deploy/main. En este producto el discurso ES la interfaz (handoff §5): cada día que el deploy viejo sigue arriba, el brand character se erosiona en cada mensaje (Wilensky).
**Corrección:** redeploy de main + los mockups consolidan el voseo con los guiones §5 como fuente. Sigue siendo el fix de mayor impacto y menor costo: ya está hecho en código, falta publicarlo.

---

## 3. Priorización

| # | Hallazgo | Impacto marca | Costo de corrección |
|---|---|---|---|
| 4 | Tuteo → voseo | Alto (cada mensaje) | Bajo (copy) |
| 1 | 4 skins → 2 temas | Alto (acumulación de identidad) | Medio (se reusa el motor) |
| 2 | Orbe azul → sistema de marca | Alto (diferenciación de categoría) | Medio |
| 3 | 4 tipografías → 2 | Medio | Bajo (tokens) |
