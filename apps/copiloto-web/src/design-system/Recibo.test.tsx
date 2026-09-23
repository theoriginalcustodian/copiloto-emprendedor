import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Recibo } from './Recibo';

describe('Recibo (BL-F1)', () => {
  it('🔴 se anuncia: role=status y aria-live=polite (WCAG 4.1.3)', () => {
    render(<Recibo testId="r" titulo="Gasto anotado: $ 1.000" tono="exito" />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Gasto anotado: $ 1.000');
  });

  it('tono exito marca la variante; neutro no', () => {
    const { rerender } = render(<Recibo testId="r" titulo="ok" tono="exito" />);
    expect(screen.getByRole('status').className).toContain('propuesta-card--exito');
    rerender(<Recibo testId="r" titulo="no" />);
    expect(screen.getByRole('status').className).not.toContain('propuesta-card--exito');
  });

  it('pinta líneas secundarias y nota', () => {
    render(
      <Recibo
        testId="r"
        titulo="Factura emitida."
        lineas={[{ etiqueta: 'CAE', valor: '7412', testId: 'cae' }]}
        nota={{ texto: 'Preparando el PDF…', testId: 'nota' }}
      />,
    );
    expect(screen.getByTestId('cae')).toHaveTextContent('7412');
    expect(screen.getByTestId('nota')).toHaveTextContent('Preparando el PDF…');
  });

  it('la acción con href es un link seguro; con onClick es un botón', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Recibo testId="r" titulo="t" accion={{ etiqueta: 'Ver PDF', href: 'https://x/y.pdf', testId: 'a' }} />,
    );
    const link = screen.getByTestId('a');
    expect(link).toHaveAttribute('href', 'https://x/y.pdf');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));

    rerender(<Recibo testId="r" titulo="t" accion={{ etiqueta: 'Ver cliente', onClick, testId: 'a' }} />);
    fireEvent.click(screen.getByTestId('a'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
