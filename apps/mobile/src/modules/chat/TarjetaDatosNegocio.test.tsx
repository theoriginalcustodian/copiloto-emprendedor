import { render, screen } from '@testing-library/react-native';

import type { DatosNegocio } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaDatosNegocio } from './TarjetaDatosNegocio';

// Las tres formas de `apps/copiloto/datos_card.py`: con nota y chip, con chip null, con nota null.
const ESTE_MES: DatosNegocio = {
  titulo: 'Este mes',
  cifras: [
    { clave: 'Entró', valor: '$0,00' },
    { clave: 'Salió', valor: '$0,00' },
    { clave: 'Queda', valor: '$0,00' },
    { clave: 'Facturado', valor: '$0,00' },
    { clave: 'Cobrado', valor: '$0,00' },
  ],
  chip: 'Al 13 de octubre',
  nota: 'Mercado Pago está desconectado: lo que entró puede estar incompleto. Reconectalo para ver el número real.',
};

async function montar(datos: DatosNegocio) {
  return render(
    <ThemeProvider>
      <TarjetaDatosNegocio datos={datos} />
    </ThemeProvider>,
  );
}

describe('TarjetaDatosNegocio (preg-datos)', () => {
  it('pinta el título, las 5 cifras en orden y el chip', async () => {
    await montar(ESTE_MES);
    expect(screen.getByTestId('datos-negocio-titulo')).toHaveTextContent('Este mes');
    expect(screen.getByTestId('datos-negocio-chip')).toHaveTextContent('Al 13 de octubre');
    ESTE_MES.cifras.forEach((c, i) => {
      // `toHaveTextContent(string)` pide el texto EXACTO de la fila (clave + valor pegados): regex.
      expect(screen.getByTestId(`datos-negocio-cifra-${i}`)).toHaveTextContent(new RegExp(`^${c.clave}`));
    });
    expect(screen.queryByTestId('datos-negocio-cifra-5')).toBeNull();
  });

  it('🔴 pinta la `nota` cuando viene: es la salvedad que cambia cómo se lee el número', async () => {
    await montar(ESTE_MES);
    expect(screen.getByTestId('datos-negocio-nota')).toHaveTextContent(/Mercado Pago está desconectado/);
  });

  it('sin `nota` no pinta un renglón vacío', async () => {
    await montar({ ...ESTE_MES, nota: null });
    expect(screen.queryByTestId('datos-negocio-nota')).toBeNull();
  });

  it('sin `chip` no pinta una píldora vacía', async () => {
    await montar({ ...ESTE_MES, chip: null });
    expect(screen.queryByTestId('datos-negocio-chip')).toBeNull();
  });

  it('el valor se pinta TAL CUAL, con el formato que mandó el backend (no se re-formatea)', async () => {
    await montar({
      titulo: 'Facturado por mes',
      cifras: [{ clave: 'septiembre 2026', valor: '$2.500,00 · 3 comprobantes' }],
      chip: 'Últimos 6 meses',
      nota: null,
    });
    expect(screen.getByText('$2.500,00 · 3 comprobantes')).toBeTruthy();
  });

  it('cada fila se lee de corrido para el lector de pantalla («clave: valor»)', async () => {
    await montar({ titulo: 'Lo que te deben', cifras: [{ clave: 'Total', valor: '$205.000,00' }], chip: null, nota: null });
    expect(screen.getByLabelText('Total: $205.000,00')).toBeTruthy();
  });
});
