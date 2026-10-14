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

  it('AVATARASIST: el mensaje del asistente lleva el isotipo y el del emprendedor NO (par por rol)', () => {
    const { container: asistente } = render(<Bubble role="assistant" text="Listo, ya lo hago." />);
    expect(asistente.querySelectorAll('[data-testid="marca"]')).toHaveLength(1);
    // El isotipo es la FILA del mensaje, no un adorno suelto: va junto a la burbuja del asistente.
    const fila = asistente.querySelector('.chat-asistente');
    expect(fila?.querySelector('[data-testid="marca"]')).not.toBeNull();
    expect(fila?.querySelector('.chat-bubble--assistant')).not.toBeNull();
    // El isotipo va dentro del DISCO del avatar (el del header), no suelto.
    expect(fila?.querySelector('.chat-asistente__avatar [data-testid="marca"]')).not.toBeNull();

    const { container: usuario } = render(<Bubble role="user" text="Cobrale 15 lucas a Juan" />);
    expect(usuario.querySelectorAll('[data-testid="marca"]')).toHaveLength(0);
    expect(usuario.querySelector('.chat-asistente__avatar')).toBeNull();
    // …y el emprendedor conserva la otra mitad del par: la meta «✓✓ recibido».
    expect(screen.getAllByText('✓✓ recibido')).toHaveLength(1);
  });

  it('AVATARASIST: el disco del avatar lee el set `--avatar-*` y NO declara colores propios', () => {
    // Una sola definición del disco: si el CSS del mensaje trajera sus propios literales, el próximo
    // ajuste del avatar del header llegaría a uno solo. Se lee el CSS real, no un mock.
    const css: string = require('fs').readFileSync(require('path').join(__dirname, 'chat.css'), 'utf8');
    const regla = css.match(/\.chat-asistente__avatar\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(regla).toMatch(/var\(--avatar-bg\)/);
    expect(regla).toMatch(/var\(--avatar-border\)/);
    expect(regla).toMatch(/var\(--avatar-shadow\)/);
    expect(regla).toMatch(/--btn-fg:\s*var\(--avatar-fg\)/);
    expect(regla).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it('AVATARASIST: un mensaje del asistente con card (artifact) lleva UN solo isotipo, no uno por pieza', () => {
    const { container } = render(
      <Bubble
        role="assistant"
        text="Listo, generé el link de cobro."
        card={{ kind: 'payment_link', data: { url: 'https://mpago.la/x', amount: 5000 } }}
      />,
    );
    expect(container.querySelectorAll('[data-testid="marca"]')).toHaveLength(1);
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

  it('BL-J7 (H-A3-7): un mensaje escrito no muestra el chip «Por voz»', () => {
    render(<Bubble role="user" text="Cobrale 15 lucas a Juan" />);
    expect(screen.queryByTestId('chat-bubble-voz')).not.toBeInTheDocument();
  });

  it('BL-J7 (H-A3-7): un mensaje llegado por dictado muestra el chip «Por voz · m:ss»', () => {
    render(<Bubble role="user" text="anotá un gasto de 500" porVoz={{ duracionSeg: 7 }} />);
    expect(screen.getByTestId('chat-bubble-voz')).toHaveTextContent('Por voz · 0:07');
  });
});
