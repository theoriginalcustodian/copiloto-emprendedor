import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '../../design-system/themes.css';
import { THEMES } from '../../design-system/ThemeProvider';
import { Bubble } from './Bubble';

describe('Bubble', () => {
  it('renderiza burbuja de usuario con el recibido ✓✓', () => {
    render(<Bubble role="user" text="Cobrale 15 lucas a Juan" />);
    expect(screen.getByText('Cobrale 15 lucas a Juan')).toBeInTheDocument();
    expect(screen.getByText('✓✓ recibido')).toBeInTheDocument();
  });

  it('renderiza burbuja de asistente sin el recibido', () => {
    render(<Bubble role="assistant" text="Listo, ya lo hago." />);
    expect(screen.getByText('Listo, ya lo hago.')).toBeInTheDocument();
    expect(screen.queryByText('✓✓ recibido')).not.toBeInTheDocument();
  });

  it.each(THEMES)('renderiza ambos roles bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(
      <>
        <Bubble role="user" text="Hola" />
        <Bubble role="assistant" text="Hola, en qué te ayudo?" />
      </>,
    );
    expect(screen.getByText('Hola')).toBeInTheDocument();
    expect(screen.getByText('Hola, en qué te ayudo?')).toBeInTheDocument();
  });
});
