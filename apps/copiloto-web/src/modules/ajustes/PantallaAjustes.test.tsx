import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AjustesScreen } from './AjustesScreen';
import { PantallaAjustes } from './PantallaAjustes';

/**
 * DEC-8 (web): «Mi plan» NO entra en la beta. Sin sustrato de planes no hay nada que mostrar, y la
 * fila promete un plan que no existe. Los tests de presencia no bastan para esto: un tile que vuelva
 * deja la lista de presencia verde. Por eso el control negativo afirma la AUSENCIA, en la grilla y
 * en la navegación.
 */
const KEYS_ESPERADAS = [
  'perfilNegocio',
  'facturacionAfip',
  'apps',
  'cuenta',
  'apariencia',
  'comoUsar',
  'soporte',
  'feedback',
];

describe('PantallaAjustes — grilla de 8 entradas (DEC-8, web)', () => {
  it('muestra exactamente las 8 entradas que quedan, en orden', () => {
    render(<PantallaAjustes />);
    const tiles = screen.getAllByRole('button');
    const keys = tiles.map((t) => t.getAttribute('data-testid')?.replace('ajuste-tile-', ''));
    expect(keys).toEqual(KEYS_ESPERADAS);
  });

  it('control negativo: NO existe el tile «Mi plan» ni su texto', () => {
    render(<PantallaAjustes />);
    expect(screen.queryByTestId('ajuste-tile-miPlan')).toBeNull();
    expect(screen.queryByText('Mi plan')).toBeNull();
  });
});

describe('AjustesScreen — «Mi plan» no es alcanzable (DEC-8, web)', () => {
  it('control negativo: la grilla montada no contiene «Mi plan» y no hay sub-vista para él', () => {
    render(<AjustesScreen />);
    expect(screen.queryByText('Mi plan')).toBeNull();
    expect(screen.queryByTestId('ajuste-tile-miPlan')).toBeNull();
    expect(screen.queryByTestId('pantalla-andamiaje')).toBeNull();
  });

  it('las entradas que quedan siguen navegando (no se rompió el resto del menú)', () => {
    const onNavegarTab = vi.fn();
    render(<AjustesScreen onNavegarTab={onNavegarTab} />);
    fireEvent.click(screen.getByTestId('ajuste-tile-cuenta'));
    expect(onNavegarTab).toHaveBeenCalledWith('account');
  });
});
