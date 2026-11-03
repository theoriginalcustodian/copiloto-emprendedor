import { describe, expect, it } from 'vitest';
// `?raw` (mismo patrón que `catalog.contrato.paridad.test.ts`): el .py se lee como texto de build-time.
import catalogSource from '../../../../apps/copiloto/catalog.py?raw';
import { CLAVES_CON_ICONO_DE_MARCA } from './serviceIcons';

/**
 * SM-N17: Instagram no es un servicio de Copiloto (`service_risk_contrato.py`: «cero módulo, cero
 * tool»), pero seguía cableado en la UI y el emprendedor veía avisos de una conexión que no existe.
 * Este test es rojo si Instagram vuelve a ofrecerse: como entrada del catálogo (`_PRESENTATION`) o
 * como ícono de marca en la web. El lado mobile lo mide `PantallaApps.test.tsx`.
 *
 * Lo que NO mide a propósito: `SERVICE_RISK.instagram` (`hitl.ts`), excepción fechada y con dueño en
 * `service-risk-excepciones.json` para que un historial viejo rehidrate con su advertencia.
 */

function clavesDePresentacion(fuente: string): string[] {
  const bloque = /_PRESENTATION:\s*dict\[str, dict\]\s*=\s*\{([\s\S]*?)\n\}\n/.exec(fuente.replace(/\r\n/g, '\n'));
  if (!bloque) throw new Error('no encontré `_PRESENTATION` en apps/copiloto/catalog.py');
  return [...(bloque[1] ?? '').matchAll(/^ {4}(?:"([a-z_]+)"|([A-Z_]+)):/gm)].map((m) => m[1] ?? m[2] ?? '');
}

describe('SM-N17: Instagram no se ofrece como servicio', () => {
  // 🐤 Control positivo: si el parser no encuentra servicios, un «no está instagram» sería vacío.
  it('🐤 el parser del catálogo ve los servicios reales', () => {
    const claves = clavesDePresentacion(catalogSource as string);
    expect(claves).toContain('MERCADOPAGO_KEY');
    expect(claves).toContain('gmail');
  });

  it('el catálogo del backend no presenta `instagram`', () => {
    expect(clavesDePresentacion(catalogSource as string)).not.toContain('instagram');
  });

  it('la web no dibuja ícono de marca para `instagram`', () => {
    expect(CLAVES_CON_ICONO_DE_MARCA).not.toContain('instagram');
    expect(CLAVES_CON_ICONO_DE_MARCA).toContain('gmail');
  });
});
