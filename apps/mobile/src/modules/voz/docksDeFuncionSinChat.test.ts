import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ORDEN 2026-11-06 (contrato «la card se prellena DENTRO de la función»): Gastos, Ingresos, Presupuestos, Clientes y
 * Facturación dictan y prellenan SIN pasar por el chat. `DockAlChat` despacha al chat y dice «El chat todavía no está listo» si no
 * hidrató, así que volver a montarlo en cualquiera de las cuatro reintroduce el defecto de raíz.
 *
 * Es un guard de fuente y no un render a propósito: las cuatro pantallas comparten UN solo defecto posible (el import) y
 * el render con chat sin hidratar de Gastos ya lo prueba de punta a punta (`PantallaGastos.test`).
 * Inteligencia NO está acá: sigue en el chat (no es una de las 5 funciones de la orden).
 */
const PANTALLAS = [
  'gastos/PantallaGastos.tsx',
  'ingresos/PantallaIngresos.tsx',
  'presupuestos/PantallaPresupuestos.tsx',
  'clientes/PantallaClientes.tsx',
  'facturacion/PantallaFacturacion.tsx',
];

describe('docks de función sin chat', () => {
  it.each(PANTALLAS)('%s no usa DockAlChat', (rel) => {
    const fuente = readFileSync(join(__dirname, '..', rel), 'utf8');
    expect(fuente).not.toMatch(/DockAlChat/);
    expect(fuente).toMatch(/DockFuncion/);
  });
});
