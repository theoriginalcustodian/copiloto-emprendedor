import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

  it('siempre muestra el aviso de placeholder — nunca se confunde con texto legal final', () => {
    render(<LegalScreen kind="tos" onVolver={vi.fn()} />);
    expect(screen.getByTestId('legal-screen-placeholder-notice')).toHaveTextContent(
      'Texto PLACEHOLDER',
    );
  });

  it('"Volver" llama a onVolver', () => {
    const onVolver = vi.fn();
    render(<LegalScreen kind="tos" onVolver={onVolver} />);
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  it.each(THEMES)('renderiza sin romper bajo el tema "%s"', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<LegalScreen kind="privacidad" onVolver={vi.fn()} />);
    expect(screen.getByTestId('legal-screen-privacidad')).toBeInTheDocument();
  });
});
