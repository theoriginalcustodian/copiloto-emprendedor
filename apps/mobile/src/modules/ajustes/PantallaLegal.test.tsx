import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}));

import { LEGAL_VERSION } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaLegal } from './PantallaLegal';

async function montar(kind: 'tos' | 'privacidad') {
  return render(
    <ThemeProvider>
      <PantallaLegal kind={kind} />
    </ThemeProvider>,
  );
}

describe('PantallaLegal — port mobile de LegalScreen (BL-O6 parte A)', () => {
  it('kind="tos" -> testid y título de Términos y Condiciones', async () => {
    await montar('tos');
    expect(screen.getByTestId('legal-screen-tos')).toBeTruthy();
    expect(screen.getByText('Términos y Condiciones')).toBeTruthy();
  });

  it('kind="privacidad" -> testid y título de Política de Privacidad', async () => {
    await montar('privacidad');
    expect(screen.getByTestId('legal-screen-privacidad')).toBeTruthy();
    expect(screen.getByText('Política de Privacidad')).toBeTruthy();
  });

  /** Mismo criterio que web: el aviso de plantilla queda — retirarlo es decisión del operador. */
  it('siempre marca el texto como plantilla', async () => {
    await montar('tos');
    expect(screen.getByTestId('legal-screen-placeholder-notice')).toHaveTextContent(
      /Plantilla estándar genérica/,
    );
  });

  it('nombra los terceros reales verificados contra el código (mismo texto que web)', async () => {
    await montar('tos');
    expect(screen.getByText(/Composio/)).toBeTruthy();
    expect(screen.getByText(/ARCA/)).toBeTruthy();
    expect(screen.getByText(/Mercado Pago/)).toBeTruthy();
    expect(screen.getByText(/OpenRouter/)).toBeTruthy();
  });

  it('muestra la versión compartida del documento', async () => {
    await montar('privacidad');
    expect(screen.getByTestId('legal-screen-version')).toHaveTextContent(new RegExp(LEGAL_VERSION));
  });
});
