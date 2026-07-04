import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import { THEMES } from '../../design-system/ThemeProvider';
import { HitlCard, type HitlVariant } from './HitlCard';

const VARIANTS: HitlVariant[] = ['cobro', 'agenda', 'publicar'];

function renderCard(variant: HitlVariant, overrides: Partial<ComponentProps<typeof HitlCard>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <HitlCard
      variant={variant}
      name="Juan Pérez"
      amount="15.000"
      concept="Sesión de asesoría · hoy"
      confirmLabel="Sí, cobrar $15.000"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe('HitlCard', () => {
  it.each(VARIANTS)('renderiza la variante "%s"', (variant) => {
    renderCard(variant);
    expect(screen.getByTestId(`hitl-card-${variant}`)).toBeInTheDocument();
  });

  it('variante cobro muestra badge REVISAR y el monto aislado', () => {
    renderCard('cobro');
    expect(screen.getByText('REVISAR')).toBeInTheDocument();
    expect(screen.getByText('15.000')).toBeInTheDocument();
  });

  it('variante agenda no muestra badge y sí la nota de 60 min', () => {
    renderCard('agenda');
    expect(screen.queryByText('REVISAR')).not.toBeInTheDocument();
    expect(screen.queryByText('IRREVERSIBLE')).not.toBeInTheDocument();
    expect(screen.getByText('Los turnos duran 60 min.')).toBeInTheDocument();
  });

  it('variante publicar muestra badge IRREVERSIBLE + advertencia + preview si se pasa', () => {
    renderCard('publicar', {
      preview: { title: '−20% primera sesión', caption: 'Válido esta semana' },
    });
    expect(screen.getByText('IRREVERSIBLE')).toBeInTheDocument();
    expect(screen.getByText(/No se puede deshacer/)).toBeInTheDocument();
    expect(screen.getByTestId('hitl-preview')).toBeInTheDocument();
  });

  it('confirmar dispara onConfirm', () => {
    const { onConfirm } = renderCard('cobro');
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cobrar $15.000' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancelar dispara onCancel', () => {
    const { onCancel } = renderCard('cobro');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderCard('cobro');
    expect(screen.getByTestId('hitl-card-cobro')).toBeInTheDocument();
  });
});
