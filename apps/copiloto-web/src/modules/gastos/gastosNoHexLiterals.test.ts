import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), no un módulo real (mismo patrón que modules/connections/connectionsNoHexLiterals.test.ts).
import gastosCss from './gastos.css?raw';
import gastosScreenSource from './GastosScreen.tsx?raw';
import formularioGastoSource from './FormularioGasto.tsx?raw';
import resumenMesSource from './ResumenMes.tsx?raw';
import tarjetaGastoSource from './TarjetaGasto.tsx?raw';

/**
 * Gate "cero color literal" (Global Constraint del plan: "Ningún componente usa color literal —
 * todo token"). `gastos` cayó en el hueco entre las 6 de mi Tarea 1 y las 6 de FE-2 (repinta en mi
 * Tarea 3 pero no tenía dueña de gate) — asignado a FE-1 por planificación 2026-09-07 (censo previo
 * de FE-2: 0 hex reales). Mismo criterio que `modules/contabilidad/contabilidadNoHexLiterals.test.ts`.
 *
 * `sinComentarios` (hallazgo de frontend2): descarta comentarios antes de buscar hex — evita el
 * falso positivo de un docstring que cite un PR (`#457` es hex sintácticamente válido, no color).
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

const sinComentarios = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

const SOURCES: Record<string, string> = {
  'gastos.css': gastosCss,
  'GastosScreen.tsx': gastosScreenSource,
  'FormularioGasto.tsx': formularioGastoSource,
  'ResumenMes.tsx': resumenMesSource,
  'TarjetaGasto.tsx': tarjetaGastoSource,
};

describe('módulo gastos — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = sinComentarios(source).match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });
});
