import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), no un módulo real (mismo patrón que modules/connections/connectionsNoHexLiterals.test.ts).
import facturacionCss from './facturacion.css?raw';
import catalogosSource from './catalogos.ts?raw';
import detalleComprobanteSource from './DetalleComprobante.tsx?raw';
import etiquetasComprobanteSource from './etiquetasComprobante.ts?raw';
import maquinaEstadoSource from './maquinaEstado.ts?raw';
import pantallaFacturacionSource from './PantallaFacturacion.tsx?raw';
import pasoClienteSource from './PasoCliente.tsx?raw';
import pasoDatosVentaSource from './PasoDatosVenta.tsx?raw';
import pasoItemsSource from './PasoItems.tsx?raw';
import pasoResumenSource from './PasoResumen.tsx?raw';
import resumenFacturacionSource from './ResumenFacturacion.tsx?raw';
import seccionCobroSource from './SeccionCobro.tsx?raw';
import seccionMeDebenSource from './SeccionMeDeben.tsx?raw';
import seccionMisComprobantesSource from './SeccionMisComprobantes.tsx?raw';
import tarjetaComprobanteSource from './TarjetaComprobante.tsx?raw';

/**
 * Gate "cero color literal" (Global Constraint del plan: "Ningún componente usa color literal —
 * todo token"), acotado a mi ownership de este Task (módulo Facturación). Mismo criterio que
 * `modules/connections/connectionsNoHexLiterals.test.ts` / `modules/chat/chatNoHexLiterals.test.ts`.
 *
 * `sinComentarios` (hallazgo de frontend2, ver `coordinacion/`): el patrón viejo matchea `#457` en
 * un docstring que cita un PR — es hex sintácticamente válido, no color. Se descartan comentarios
 * de bloque y de línea antes de buscar; `//` precedido de `:` (URLs) no cuenta.
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

const sinComentarios = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

const SOURCES: Record<string, string> = {
  'catalogos.ts': catalogosSource,
  'DetalleComprobante.tsx': detalleComprobanteSource,
  'etiquetasComprobante.ts': etiquetasComprobanteSource,
  'facturacion.css': facturacionCss,
  'maquinaEstado.ts': maquinaEstadoSource,
  'PantallaFacturacion.tsx': pantallaFacturacionSource,
  'PasoCliente.tsx': pasoClienteSource,
  'PasoDatosVenta.tsx': pasoDatosVentaSource,
  'PasoItems.tsx': pasoItemsSource,
  'PasoResumen.tsx': pasoResumenSource,
  'ResumenFacturacion.tsx': resumenFacturacionSource,
  'SeccionCobro.tsx': seccionCobroSource,
  'SeccionMeDeben.tsx': seccionMeDebenSource,
  'SeccionMisComprobantes.tsx': seccionMisComprobantesSource,
  'TarjetaComprobante.tsx': tarjetaComprobanteSource,
};

describe('módulo facturacion — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = sinComentarios(source).match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });
});
