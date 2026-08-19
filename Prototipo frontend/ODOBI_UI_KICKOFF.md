# KICKOFF — Odobi App UI (sesión Claude Code)

> Pegá este documento como primer mensaje en Claude Code, parado en una carpeta vacía `odobi-ui/`.
> Antes de empezar: copiá también `ODOBI_HANDOFF.md` a la raíz del repo. Es la fuente de verdad de marca.

---

## 0. CONTEXTO

Soy Martin, cofundador de Odobi ("tu copiloto emprendedor"): copiloto conversacional y de voz para emprendedores en Argentina. La marca está cerrada (ver `ODOBI_HANDOFF.md`). Ahora diseñamos la UI de la app: mockups anotados → prototipo HTML navegable → deck de justificación para mi socio.

**Rol esperado:** asesor directo, sin vueltas. Toda decisión de diseño se justifica con Wilensky (*La Promesa de la Marca*), Chaves (*La Marca Corporativa*), el IF Design Patterns Catalogue (https://catalogue.projectsbyif.com/) o principios UX verificables. Nada por gusto.

**App actual (auditada el 22/07/2026 sobre https://copilotoemprendedor.duckdns.org/):**
- Stack: SPA Vite + PWA (service worker), sin framework SSR. Los mockups en HTML/CSS puro son portables directo.
- Navegación: 4 secciones (Chat / Apps / Conexiones 1-8 / Cuenta). Input con mic siempre visible. "✓✓ recibido" estilo WhatsApp. **Esto se conserva.**
- Problemas: (1) 4 skins intercambiables (Aurora Glass, Soft Daylight, Refined Dark, Tema AI) que cambian toda la identidad; (2) orbe azul con glow = cliché de asistente IA; paleta azul-violeta genérica; (3) 4 familias tipográficas (General Sans, Manrope, JetBrains Mono, Space Grotesk); (4) el agente responde en tuteo neutro ("tienes que decirme qué necesitas") cuando el discurso de marca es voseo rioplatense.

---

## 1. REGLAS DURAS (no negociables, no reabrir)

**Nombre:** siempre *Odobi* — mayúscula inicial, resto minúscula. NUNCA "ODOBI", ni en logos, etiquetas ni versalitas. Si una etiqueta va en versalitas, se reformula para no contener el nombre.

**Paleta (cerrada 22/07/2026):**
| Rol | Hex | Uso |
|---|---|---|
| Lienzo | `#FFFFFF` / `#F7F3EC` | fondo dominante (modo claro) |
| Estructura | `#1A1512` | texto, fondos oscuros (modo oscuro) |
| Acento | `#DE7250` | terracota — CTA, marca, estados. **Máx 10% de la pantalla. Señal, no ambiente.** |
| Acento sobre claro | `#B04A2E` | texto/links terracota sobre fondos claros |
| Apoyo | `#E8A088` | arena — jerarquía secundaria sobre oscuro |

**Contraste WCAG (calculado, no a ojo):** texto sobre terracota → solo `#1A1512` (5.71:1). Blanco sobre terracota (3.17:1) prohibido en UI. Terracota como texto sobre crema prohibido → usar `#B04A2E` (4.91:1). Toda combinación nueva se calcula antes de usarse.

**Proporción 60/30/10:** lienzo ≈60%, estructura ≈30%, terracota ≤10%. Excepción declarada: terracota plena solo en piezas display (splash, celebración, onboarding-reveal), nunca UI operativa.

**Tipografía:** NeueEinstellung Bold (display/títulos) + Inter Regular/Medium (UI/cuerpo). Nada más. Si NeueEinstellung no está disponible en el entorno, usar un placeholder geométrico bold y marcarlo `/* SWAP: NeueEinstellung */`.

**Temas:** exactamente 2 — claro (crema/blanco) y oscuro (negro tostado). Identidad constante en ambos: terracota fija, misma tipografía, mismos componentes. Los 4 skins actuales se eliminan del diseño (la infraestructura de theming del código se reusa).

**Prohibiciones visuales:** orbes/esferas con glow, degradés azul-violeta, glassmorphism decorativo, estética "IA genérica". Diferenciarse de Odoo, Siri/Alexa/Copilot y fintechs azules es requisito de marca (§4.3 del handoff).

**Discurso en UI:** voseo rioplatense siempre ("contame", "dale", "ojo"). Léxico prohibido: "estoy aquí para ayudarte", "solución integral", "potenciar", tuteo neutro. Microcopy de error: frontal y con salida. Todo texto de mockup respeta los guiones de §5 del handoff.

---

## 2. ESTRUCTURA DEL REPO

```
odobi-ui/
├── CLAUDE.md              ← generar en tarea 0: resumen operativo de este kickoff (reglas duras + paleta + criterios)
├── ODOBI_HANDOFF.md       ← lo copio yo (fuente de verdad de marca)
├── .mcp.json              ← config 60FPS (abajo)
├── tokens/
│   └── odobi.css          ← variables CSS: colores, tipografía, espaciado (grilla 8pt), radios, sombras, motion
├── audit/
│   └── AUDITORIA.md       ← hallazgos de §0 formalizados (base del slide 4 del deck)
├── explorations/
│   └── wise-ab/           ← tarea 1
├── mockups/               ← tarea 2: una carpeta por pantalla
│   ├── 01-onboarding/
│   ├── 02-conexiones/
│   ├── 03-home-conversacional/
│   ├── 04-confirmacion-hitl/
│   ├── 05-facturacion-arca/
│   ├── 06-presupuestos/
│   ├── 07-insight-proactivo/
│   └── 08-plan-limites/
└── deck-assets/           ← exports PNG 2560×1440 para el deck (se arma en claude.ai)
```

**Formato de cada mockup:** un `index.html` autocontenido (CSS embebido, sin build) que muestra la pantalla en un frame mobile de **390px** sobre fondo neutro, con **anotaciones estilo uxsnaps**: flechas y etiquetas alrededor del frame explicando cada decisión (patrón aplicado + fundamento en una línea). Cada carpeta lleva un `DECISIONES.md`: tabla elemento → decisión → fundamento (Wilensky / Chaves / IF Catalogue / heurística UX) → alternativa descartada y por qué.

**MCP 60FPS** (`.mcp.json`, reemplazo yo la key):
```json
{
  "mcpServers": {
    "60fps": {
      "url": "https://mcp.60fps.design/mcp",
      "headers": { "Authorization": "Bearer <7C612015-F9364BD9-80CA40B2-A747D6FA>" }
    }
  }
}
```
Uso: referencias de motion y patrones por pantalla (estados de voz/escucha, confirmaciones, transiciones). Cada referencia usada se cita en el `DECISIONES.md` de la pantalla. Si el MCP no responde, seguir sin él y marcar `TODO motion-ref`.

---

## 3. PLAN DE TAREAS (en orden, una a la vez, aprobación mía entre tareas)

**Tarea 0 — Setup:** crear estructura, `CLAUDE.md`, `tokens/odobi.css` (2 temas con las mismas variables semánticas), `audit/AUDITORIA.md`.

**Tarea 1 — Experimento Wise (A/B, timeboxed):** dos versiones del home conversacional con los mismos tokens:
- **A:** 60/30/10 estricta.
- **B:** dosis Wise *acotada a lo permitido*: tipografía display más protagonista, iconografía monocroma sobre fondo plano, color pleno solo en momento display (ej. estado de escucha activa a pantalla completa).
- Prohibido en B: pantallas operativas teñidas de terracota.
- Entregable: `explorations/wise-ab/index.html` (A y B lado a lado) + veredicto contra criterio escrito. Si B rompe 60/30/10, se declara muerto y se documenta. Si gana B, entra al deck como decisión.

**Tarea 2 — Mockups (8 pantallas):** en este orden — 03 home → 04 HITL (patrón madre) → 05 facturación y 06 presupuestos (heredan el patrón HITL) → 07 insight → 01 onboarding → 02 conexiones → 08 plan. Reglas específicas:
- 04-HITL: es LA pantalla. "Vos confirmás, Odobi ejecuta" como componente reutilizable (propuesta → detalle editable → confirmar/cancelar).
- 05-facturación: doble HITL según guión §5 del handoff. Es visión de producto (feature en pausa): el mockup no promete fechas.
- 02-conexiones: patrón just-in-time consent del IF Catalogue — pedir acceso cuando aporta valor, no todo junto.
- 01-onboarding: codifica pronunciación o-DO-bi + promesa del primer minuto con plata real (guión §5).
- Thumb zone: CTAs en el tercio inferior. Tap targets ≥44pt. Grilla 8pt estricta.

**Tarea 3 — Deck assets:** export PNG 2560×1440 de cada mockup anotado + los A/B, a `deck-assets/`. El deck (16 slides, esqueleto ya aprobado) se arma después en claude.ai.

---

## 4. CRITERIOS DE APROBACIÓN (cada mockup se autoevalúa antes de mostrármelo)

1. ¿Terracota ≤10% de la pantalla? (excepción display declarada aparte)
2. ¿Todos los pares texto/fondo pasan WCAG AA calculado?
3. ¿Máximo 2 familias, 4 tamaños, 2 pesos?
4. ¿Todo el copy en voseo, sin léxico prohibido, coherente con §5 del handoff?
5. ¿Cero orbes, glow azul, glassmorphism decorativo?
6. ¿"Odobi" con caja correcta en todas las apariciones?
7. ¿Espaciado en grilla 8pt, CTAs en thumb zone, targets ≥44pt?
8. ¿Cada decisión anotada tiene fundamento citable en `DECISIONES.md`?

Si un punto falla, se corrige antes de presentar. No mostrar trabajo que incumple las reglas duras.
