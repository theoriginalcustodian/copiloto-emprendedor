import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), no un módulo real (mismo patrón que modules/connections/connectionsNoHexLiterals.test.ts).
import inteligenciaCss from './inteligencia.css?raw';
import chatInteligenciaSource from './ChatInteligencia.tsx?raw';
import inteligenciaScreenSource from './InteligenciaScreen.tsx?raw';
import graficoBarrasSource from './graficos/GraficoBarras.tsx?raw';
import graficosInteligenciaSource from './graficos/GraficosInteligencia.tsx?raw';
import graficoTortaSource from './graficos/GraficoTorta.tsx?raw';

/**
 * Gate "cero color literal" (Global Constraint del plan: "Ningún componente usa color literal —
 * todo token"), acotado a mi ownership de este Task (módulo Inteligencia). Mismo criterio que
 * `modules/connections/connectionsNoHexLiterals.test.ts` / `modules/chat/chatNoHexLiterals.test.ts`.
 *
 * `sinComentarios` (hallazgo de frontend2): descarta comentarios antes de buscar hex — evita el
 * falso positivo de un docstring que cite un PR (`#457` es hex sintácticamente válido, no color).
 *
 * ⚠️ EXCEPCIÓN DECLARADA, no un gap del gate: `GraficoTorta.tsx` trae la paleta `CATEGORICO` (8
 * hex), port 1:1 de `apps/mobile/src/theme/tokens.ts`. Es color CATEGÓRICO (identidad de una
 * categoría de gasto, ej. "sueldos"), no theme-dependent — ninguna piel la toca hoy y el repintado
 * Odobi de Tarea 2 no la alcanza. No la tokenizo en este Task: es una decisión de diseño (¿escala
 * de datos con su propia lógica, o se rearma en clave Odobi?), no táctica. Escalada por separado a
 * planificación/diseño; este gate NO la absuelve en silencio — la corta del match a propósito y
 * queda documentada acá para que quien la resuelva sepa dónde extender el allowlist.
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

const sinComentarios = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

// Paleta categórica de GraficoTorta.tsx — ver la nota de arriba. Cualquier hex FUERA de esta lista
// en ese archivo sigue siendo una falla real del gate (no es un allowlist de archivo completo).
const CATEGORICO_EXCEPCION = [
  '#8c398b', '#eb5484', '#aa3900', '#929d00', '#00915d', '#00a7b8', '#1f57c5', '#876bed',
];

const SOURCES: Record<string, string> = {
  'inteligencia.css': inteligenciaCss,
  'ChatInteligencia.tsx': chatInteligenciaSource,
  'InteligenciaScreen.tsx': inteligenciaScreenSource,
  'graficos/GraficoBarras.tsx': graficoBarrasSource,
  'graficos/GraficosInteligencia.tsx': graficosInteligenciaSource,
};

describe('módulo inteligencia — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = sinComentarios(source).match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });

  it('GraficoTorta.tsx no tiene hex FUERA de la paleta categórica declarada', () => {
    const matches = sinComentarios(graficoTortaSource).match(HEX_COLOR_RE) ?? [];
    const inesperados = matches.filter((h) => !CATEGORICO_EXCEPCION.includes(h.toLowerCase()));
    expect(inesperados, `hex fuera del allowlist: ${inesperados.join(', ')}`).toHaveLength(0);
  });

  it('la paleta categórica declarada sigue siendo la que el gate espera (no creció en silencio)', () => {
    const matches = sinComentarios(graficoTortaSource).match(HEX_COLOR_RE) ?? [];
    expect(new Set(matches.map((h) => h.toLowerCase()))).toEqual(new Set(CATEGORICO_EXCEPCION));
  });
});
