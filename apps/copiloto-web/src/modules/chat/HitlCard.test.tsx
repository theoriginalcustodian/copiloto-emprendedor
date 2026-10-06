import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import { THEMES } from '../../design-system/ThemeProvider';
import { HitlCard } from './HitlCard';

function renderCard(overrides: Partial<ComponentProps<typeof HitlCard>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <HitlCard
      service="googledocs"
      label="Google Docs"
      concept="Voy a crear el documento «Presupuesto eléctrico» en Docs. ¿Confirmás?"
      confirmLabel="Confirmar"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe('HitlCard', () => {
  it('muestra el nombre REAL de la app (label) + su ícono de marca, no "AGENDA"', () => {
    renderCard();
    const card = screen.getByTestId('hitl-card-googledocs');
    expect(card).toBeInTheDocument();
    expect(screen.getByText('Google Docs')).toBeInTheDocument();
    expect(screen.queryByText('AGENDA')).not.toBeInTheDocument();
    expect(card.querySelector('img[data-testid="logo-googledocs"]')).toBeInTheDocument(); // logo real (BL-X11)
  });

  it('NUNCA muestra la nota "Los turnos duran 60 min." (se eliminó de todos los carteles)', () => {
    renderCard(); // Docs
    expect(screen.queryByText('Los turnos duran 60 min.')).not.toBeInTheDocument();
    renderCard({ service: 'googlecalendar', label: 'Google Calendar' }); // ni siquiera en Calendar
    expect(screen.queryByText('Los turnos duran 60 min.')).not.toBeInTheDocument();
  });

  it('Mercado Pago: badge REVISAR + monto aislado + nombre real', () => {
    renderCard({
      service: 'mercadopago',
      label: 'Mercado Pago',
      badge: { variant: 'warning', text: 'REVISAR' },
      amount: '15.000',
    });
    expect(screen.getByText('REVISAR')).toBeInTheDocument();
    expect(screen.getByText('15.000')).toBeInTheDocument();
    expect(screen.getByText('Mercado Pago')).toBeInTheDocument();
  });

  it('Instagram: badge IRREVERSIBLE + advertencia + preview si se pasa', () => {
    renderCard({
      service: 'instagram',
      label: 'Instagram',
      badge: { variant: 'danger', text: 'IRREVERSIBLE' },
      dangerBorder: true,
      preview: { title: '−20% primera sesión', caption: 'Válido esta semana' },
    });
    expect(screen.getByText('IRREVERSIBLE')).toBeInTheDocument();
    expect(screen.getByText(/No se puede deshacer/)).toBeInTheDocument();
    expect(screen.getByTestId('hitl-preview')).toBeInTheDocument();
  });

  it('sin service (legacy): tarjeta neutra "hitl-card-plain" con label "Confirmación"', () => {
    renderCard({ service: '', label: 'Confirmación' });
    expect(screen.getByTestId('hitl-card-plain')).toBeInTheDocument();
    expect(screen.getByText('Confirmación')).toBeInTheDocument();
  });

  it('confirmar dispara onConfirm', () => {
    const { onConfirm } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancelar dispara onCancel', () => {
    const { onCancel } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // H-A4-9 — control positivo + negativo: con `disabled`, los dos botones quedan `disabled` nativo
  // (bloquea el click sin lógica extra, ver `Button`) y un click NO dispara ningún callback. Sin
  // este control, un click tardío sobre una card ya respondida reenviaría confirm/cancel.
  it('H-A4-9: disabled=true bloquea confirmar/cancelar (nativo) y NO dispara ningún callback', () => {
    const { onConfirm, onCancel } = renderCard({ disabled: true });
    const botonConfirmar = screen.getByRole('button', { name: 'Confirmar' });
    const botonCancelar = screen.getByRole('button', { name: 'Cancelar' });

    expect(botonConfirmar).toBeDisabled();
    expect(botonCancelar).toBeDisabled();

    fireEvent.click(botonConfirmar);
    fireEvent.click(botonCancelar);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('sin disabled (default): los botones NO están disabled — control negativo del test anterior', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'Confirmar' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).not.toBeDisabled();
  });

  // BL-F1 — control positivo + negativo: resuelta ⇒ `Recibo` (role=status, con el título de lo
  // elegido y SIN botones). Si el componente ignorara `resuelta`, quedan los botones y este test
  // se pone rojo; el de abajo fija que sin `resuelta` los botones siguen ahí.
  it('BL-F1: resuelta muestra Recibo con lo elegido y sin botones', () => {
    renderCard({ resuelta: { titulo: 'Sí, enviar', tono: 'exito' } });
    const recibo = screen.getByTestId('hitl-card-googledocs');
    expect(recibo).toHaveTextContent('Sí, enviar');
    expect(recibo.querySelector('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });

  it('BL-F1: sin resuelta la card sigue activa con sus botones — control negativo del test anterior', () => {
    renderCard();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderCard({
      service: 'mercadopago',
      label: 'Mercado Pago',
      badge: { variant: 'warning', text: 'REVISAR' },
      amount: '15.000',
    });
    expect(screen.getByTestId('hitl-card-mercadopago')).toBeInTheDocument();
  });
});
