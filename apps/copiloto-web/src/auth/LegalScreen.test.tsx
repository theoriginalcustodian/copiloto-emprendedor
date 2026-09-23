import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LEGAL_VERSION } from '@copiloto/core';

import '../design-system/themes.css';
import { THEMES } from '../design-system/ThemeProvider';
import { LegalScreen } from './LegalScreen';

describe('LegalScreen', () => {
  it('kind="tos" -> título y testid de Términos y Condiciones', () => {
    render(<LegalScreen kind="tos" onVolver={vi.fn()} />);
    expect(screen.getByTestId('legal-screen-tos')).toBeInTheDocument();
    expect(screen.getByText('Términos y Condiciones')).toBeInTheDocument();
  });

  it('kind="privacidad" -> título y testid de Política de Privacidad', () => {
    render(<LegalScreen kind="privacidad" onVolver={vi.fn()} />);
    expect(screen.getByTestId('legal-screen-privacidad')).toBeInTheDocument();
    expect(screen.getByText('Política de Privacidad')).toBeInTheDocument();
  });

  it('siempre marca el texto como plantilla — nunca se confunde con revisión legal específica', () => {
    render(<LegalScreen kind="tos" onVolver={vi.fn()} />);
    expect(screen.getByTestId('legal-screen-placeholder-notice')).toHaveTextContent(
      'Plantilla estándar genérica',
    );
  });

  it('"Volver" llama a onVolver', () => {
    const onVolver = vi.fn();
    render(<LegalScreen kind="tos" onVolver={onVolver} />);
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  it('nombra los terceros reales verificados contra el código (BL-O6)', () => {
    render(<LegalScreen kind="tos" onVolver={vi.fn()} />);
    expect(screen.getByText(/Composio/)).toBeInTheDocument();
    expect(screen.getByText(/ARCA/)).toBeInTheDocument();
    expect(screen.getByText(/Mercado Pago/)).toBeInTheDocument();
    expect(screen.getByText(/OpenRouter/)).toBeInTheDocument();
  });

  it('la clave fiscal se declara no guardada en texto plano', () => {
    render(<LegalScreen kind="privacidad" onVolver={vi.fn()} />);
    expect(screen.getByText(/clave fiscal de ARCA se guardan cifrados/)).toBeInTheDocument();
  });

  it('muestra la versión compartida del documento', () => {
    render(<LegalScreen kind="tos" onVolver={vi.fn()} />);
    expect(screen.getByTestId('legal-screen-version')).toHaveTextContent(LEGAL_VERSION);
  });

  it.each(THEMES)('renderiza sin romper bajo el tema "%s"', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<LegalScreen kind="privacidad" onVolver={vi.fn()} />);
    expect(screen.getByTestId('legal-screen-privacidad')).toBeInTheDocument();
  });
});
