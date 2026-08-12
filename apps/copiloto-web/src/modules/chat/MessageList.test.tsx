import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import type { ReplyChoice } from '../../lib/api';
import { MessageList } from './MessageList';
import type { ChatMessage } from './useChat';

const CONFIRM_CANCEL: ReplyChoice[] = [
  { label: 'Sí, cobrar $15.000', value: 'confirm_charge_1' },
  { label: 'Cancelar', value: 'cancel_charge_1' },
];

const DISAMBIGUATION: ReplyChoice[] = [
  { label: 'Juan Pérez', value: 'juan_perez' },
  { label: 'Juan Gómez', value: 'juan_gomez' },
];

describe('MessageList', () => {
  it('muestra el mensaje de bienvenida cuando no hay mensajes', () => {
    render(<MessageList messages={[]} onChoice={vi.fn()} emptyHint="Contame qué necesitás." />);
    expect(screen.getByText('Contame qué necesitás.')).toBeInTheDocument();
  });

  it('renderiza burbuja de usuario y de asistente sin choices', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', text: 'Hola' },
      { id: 'a1', role: 'assistant', text: 'Hola, en qué te ayudo?' },
    ];
    render(<MessageList messages={messages} onChoice={vi.fn()} />);
    expect(screen.getByText('Hola')).toBeInTheDocument();
    expect(screen.getByText('Hola, en qué te ayudo?')).toBeInTheDocument();
  });

  it('choices de desambiguación -> burbuja + chips (no HitlCard)', () => {
    const messages: ChatMessage[] = [
      { id: 'a1', role: 'assistant', text: 'Tenés dos "Juan". ¿A cuál le cobro?', choices: DISAMBIGUATION },
    ];
    render(<MessageList messages={messages} onChoice={vi.fn()} />);
    expect(screen.getByText('Tenés dos "Juan". ¿A cuál le cobro?')).toBeInTheDocument();
    expect(screen.getByTestId('disambiguation-chips')).toBeInTheDocument();
    expect(screen.queryByTestId(/hitl-card-/)).not.toBeInTheDocument();
  });

  it('choices confirmar/cancelar -> SOLO HitlCard (sin burbuja duplicada), con la app real del `card`', () => {
    const messages: ChatMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        text: 'Voy a generar un link de cobro de MercadoPago por $15.000. ¿Confirmás?',
        choices: CONFIRM_CANCEL,
        card: { service: 'mercadopago', label: 'Mercado Pago' },
      },
    ];
    render(<MessageList messages={messages} onChoice={vi.fn()} />);
    expect(screen.getByTestId('hitl-card-mercadopago')).toBeInTheDocument();
    expect(screen.queryByTestId('disambiguation-chips')).not.toBeInTheDocument();
  });

  it('elegir un chip de desambiguación dispara onChoice con el value', () => {
    const onChoice = vi.fn();
    const messages: ChatMessage[] = [
      { id: 'a1', role: 'assistant', text: '¿Cuál Juan?', choices: DISAMBIGUATION },
    ];
    render(<MessageList messages={messages} onChoice={onChoice} />);
    fireEvent.click(screen.getByRole('button', { name: 'Juan Gómez' }));
    expect(onChoice).toHaveBeenCalledWith('juan_gomez');
  });

  it('card `presupuesto_propuesto` -> TarjetaPresupuestoPropuesto editable (no burbuja lisa, no HitlCard)', () => {
    const messages: ChatMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        text: 'Te armé un borrador de presupuesto para Juan Pérez.',
        card: {
          kind: 'presupuesto_propuesto',
          data: {
            concepto: 'diseño de logo',
            receptor: { nombre: 'Juan Pérez' },
            items: [{ descripcion: 'diseño de logo', cantidad: '1', precio_unitario: '50000' }],
          },
        },
      },
    ];
    render(<MessageList messages={messages} onChoice={vi.fn()} />);
    expect(screen.getByTestId('presupuesto-propuesto')).toBeInTheDocument();
    expect(screen.getByTestId('presupuesto-concepto')).toHaveValue('diseño de logo');
    expect(screen.queryByTestId(/hitl-card-/)).not.toBeInTheDocument();
    // La burbuja plana con el `text` NO se monta por separado: la card la reemplaza entera.
    expect(screen.queryByText('Te armé un borrador de presupuesto para Juan Pérez.')).not.toBeInTheDocument();
  });
});

/**
 * Blindaje del hide-on-scroll (regresión 2026-07-04, la 3ª sobre el mismo mecanismo). El chrome
 * (tab-bar + composer) se ocultaba solo apenas se mostraba: mostrarlo anima el `padding-bottom` del
 * ancestro del scroller -> lo achica -> el navegador emite un scroll que el usuario NO hizo ->
 * disparaba hide. Fix de raíz: sólo cuenta como hide-on-scroll un scroll con el DEDO APOYADO; el
 * scroll inducido por layout ocurre siempre con el dedo levantado, así que ya no puede ocultar.
 * Estos tests fijan ese contrato por construcción (no dependen de timings ni del navegador real).
 */
function setScrollTop(el: Element, value: number) {
  Object.defineProperty(el, 'scrollTop', { value, configurable: true, writable: true });
}

describe('MessageList — hide-on-scroll sólo con el dedo apoyado', () => {
  it('scroll SIN dedo apoyado (inducido por layout) NO oculta el chrome', () => {
    const onHideChange = vi.fn();
    render(<MessageList messages={[]} onChoice={vi.fn()} onHideChange={onHideChange} />);
    const list = screen.getByTestId('message-list');

    setScrollTop(list, 40); // salto hacia abajo (delta 40, lejos del tope) pero sin pointerdown
    fireEvent.scroll(list);

    expect(onHideChange).not.toHaveBeenCalled();
  });

  it('scroll hacia abajo CON el dedo apoyado oculta el chrome', () => {
    const onHideChange = vi.fn();
    render(<MessageList messages={[]} onChoice={vi.fn()} onHideChange={onHideChange} />);
    const list = screen.getByTestId('message-list');

    fireEvent.pointerDown(list);
    setScrollTop(list, 40);
    fireEvent.scroll(list);

    expect(onHideChange).toHaveBeenCalledWith(true);
  });

  it('tras SOLTAR el dedo, un scroll posterior (inercia/resize) ya no oculta', () => {
    const onHideChange = vi.fn();
    render(<MessageList messages={[]} onChoice={vi.fn()} onHideChange={onHideChange} />);
    const list = screen.getByTestId('message-list');

    fireEvent.pointerDown(list);
    fireEvent.pointerUp(document); // el dedo se levanta (el listener vive en document)
    setScrollTop(list, 80);
    fireEvent.scroll(list);

    expect(onHideChange).not.toHaveBeenCalled();
  });
});
