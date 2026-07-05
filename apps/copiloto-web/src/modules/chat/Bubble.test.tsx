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

  it('linkifica una URL suelta del texto en un <a> clicable (Task 17)', () => {
    render(<Bubble role="assistant" text="Mirá esto: https://ejemplo.com/x" />);
    expect(screen.getByRole('link', { name: /ejemplo\.com/i })).toHaveAttribute('href', 'https://ejemplo.com/x');
  });

  it('texto sin URLs no cambia (misma textContent, sin <a> de más)', () => {
    render(<Bubble role="assistant" text="Listo, ya lo hago." />);
    expect(screen.getByText('Listo, ya lo hago.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('con card kind=payment_link monta el ArtifactView (botón Compartir)', () => {
    render(
      <Bubble
        role="assistant"
        text="Listo, generé el link de cobro."
        card={{ kind: 'payment_link', data: { url: 'https://mpago.la/x', amount: 5000 } }}
      />,
    );
    expect(screen.getByRole('button', { name: /compartir/i })).toBeInTheDocument();
  });

  it('con card kind=confirm NO monta el ArtifactView (lo maneja HitlCard aparte)', () => {
    render(
      <Bubble
        role="assistant"
        text="¿Confirmás?"
        card={{ kind: 'confirm', service: 'mercadopago', label: 'Mercado Pago' }}
      />,
    );
    expect(screen.queryByRole('button', { name: /compartir/i })).not.toBeInTheDocument();
  });

  it('sin card no monta ArtifactView', () => {
    render(<Bubble role="assistant" text="Todo bien." />);
    expect(screen.queryByRole('button', { name: /compartir/i })).not.toBeInTheDocument();
  });
});
