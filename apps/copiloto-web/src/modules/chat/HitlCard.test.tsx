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

  it('BL-F1: el recibo conserva el texto de lo que se aprobó o canceló (rastro)', () => {
    renderCard({ resuelta: { titulo: 'Sí, enviar', tono: 'exito' } });
    expect(screen.getByTestId('hitl-card-googledocs')).toHaveTextContent(
      'Voy a crear el documento «Presupuesto eléctrico» en Docs. ¿Confirmás?',
    );
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

  // C-D3 — el gate con `detalle` pinta lo que se va a ejecutar (título, filas, cita ENTERA, nota).
  describe('C-D3 — `detalle`', () => {
    const CUERPO = ['Hola Lucía,', '', 'Te recuerdo la reunión del lunes. '.repeat(30), '', 'Saludos'].join('\n');
    const detalle = {
      titulo: 'Mail a lucia@x.com',
      filas: [
        { clave: 'Para', valor: 'lucia@x.com', sub: null, editable: false },
        { clave: 'Asunto', valor: 'Recordatorio', sub: null, editable: false },
      ],
      cita: CUERPO,
      nota: 'Se manda desde tu Gmail.',
    };

    it('🔴 pinta título, filas, cita entera y nota — y no repite el concepto suelto', () => {
      renderCard({ service: 'gmail', label: 'Gmail', detalle, concept: 'Voy a mandar un mail a Lucía.' });

      expect(screen.getByTestId('confirmacion-detalle-titulo')).toHaveTextContent('Mail a lucia@x.com');
      expect(screen.getAllByTestId('confirmacion-detalle-fila')).toHaveLength(2);
      expect(screen.getByText('lucia@x.com')).toBeInTheDocument();
      // La cita ENTERA y con sus saltos de línea (white-space: pre-wrap en el CSS).
      expect(screen.getByTestId('confirmacion-detalle-cita').textContent).toBe(CUERPO);
      expect(screen.getByTestId('confirmacion-detalle-nota')).toHaveTextContent('Se manda desde tu Gmail.');
      expect(screen.queryByText('Voy a mandar un mail a Lucía.')).toBeNull();
    });

    it('con `detalle` los botones siguen confirmando y cancelando', () => {
      const { onConfirm, onCancel } = renderCard({ service: 'gmail', label: 'Gmail', detalle });

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('control negativo: sin `detalle` pinta el concepto de siempre', () => {
      renderCard({ service: 'gmail', label: 'Gmail', concept: 'Voy a mandar un mail a Lucía.' });

      expect(screen.queryByTestId('confirmacion-detalle')).toBeNull();
      expect(screen.getByText('Voy a mandar un mail a Lucía.')).toBeInTheDocument();
    });

    it('resuelta con `detalle`: el recibo conserva las filas y la cita (rastro de lo aprobado)', () => {
      renderCard({
        service: 'gmail',
        label: 'Gmail',
        detalle,
        resuelta: { titulo: 'Enviar', tono: 'exito' },
      });

      const recibo = screen.getByTestId('hitl-card-gmail');
      expect(recibo).toHaveTextContent('lucia@x.com');
      expect(recibo).toHaveTextContent('Recordatorio');
      expect(recibo).toHaveTextContent('Te recuerdo la reunión del lunes.');
    });
  });
});
