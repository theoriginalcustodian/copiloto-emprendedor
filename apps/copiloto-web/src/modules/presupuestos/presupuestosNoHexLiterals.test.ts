import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), no un módulo real (mismo patrón que modules/connections/connectionsNoHexLiterals.test.ts).
import presupuestosCss from './presupuestos.css?raw';
import detallePresupuestoSource from './DetallePresupuesto.tsx?raw';
import formularioPresupuestoSource from './FormularioPresupuesto.tsx?raw';
import presupuestosScreenSource from './PresupuestosScreen.tsx?raw';
import tarjetaPresupuestoSource from './TarjetaPresupuesto.tsx?raw';

/**
 * Gate "cero color literal" (Global Constraint del plan: "Ningún componente usa color literal —
 * todo token"), acotado a mi ownership de este Task (módulo Presupuestos). Mismo criterio que
 * `modules/connections/connectionsNoHexLiterals.test.ts` / `modules/chat/chatNoHexLiterals.test.ts`.
 *
 * `sinComentarios` (hallazgo de frontend2): descarta comentarios antes de buscar hex — evita el
 * falso positivo de un docstring que cite un PR (`#457` es hex sintácticamente válido, no color).
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

const sinComentarios = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

const SOURCES: Record<string, string> = {
  'presupuestos.css': presupuestosCss,
  'DetallePresupuesto.tsx': detallePresupuestoSource,
  'FormularioPresupuesto.tsx': formularioPresupuestoSource,
  'PresupuestosScreen.tsx': presupuestosScreenSource,
  'TarjetaPresupuesto.tsx': tarjetaPresupuestoSource,
};

describe('módulo presupuestos — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = sinComentarios(source).match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });
});
