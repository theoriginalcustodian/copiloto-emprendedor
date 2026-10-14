import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/** Las tarjetas de propuesta importan `empujarUnaVez`, que toca `expo-router`. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

import type { ChatMessage } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { ListaMensajes } from './ListaMensajes';

async function montar(messages: ChatMessage[]) {
  const onChoice = jest.fn();
  await render(
    <ThemeProvider>
      <ListaMensajes messages={messages} onChoice={onChoice} />
    </ThemeProvider>,
  );
  return { onChoice };
}

const PREGUNTA: ChatMessage = {
  id: 'a1',
  role: 'assistant',
  text: 'Encontré tres Ana. ¿Cuál es?',
  choices: [
    { label: 'Ana Pérez', value: 'cliente:10' },
    { label: 'Ana Gómez', value: 'cliente:11' },
    { label: 'Ana Ruiz', value: 'cliente:12' },
  ],
};

describe('ListaMensajes — SM-D1: choices de desambiguación', () => {
  it('un `choices` de 3 opciones se pinta como la pregunta + un chip por opción', async () => {
    await montar([PREGUNTA]);
    // Control de ceguera: la pregunta SE VE (si no, un test de chips verde no probaría la burbuja).
    expect(screen.getByText('Encontré tres Ana. ¿Cuál es?')).toBeTruthy();
    expect(screen.getByTestId('chips-desambiguacion')).toBeTruthy();
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('Ana Gómez')).toBeTruthy();
    expect(screen.getByText('Ana Ruiz')).toBeTruthy();
  });

  it('tocar un chip manda el `value` técnico y el `label` como texto visible', async () => {
    const { onChoice } = await montar([PREGUNTA]);
    fireEvent.press(screen.getByTestId('chips-desambiguacion-opcion-1'));
    expect(onChoice).toHaveBeenCalledTimes(1);
    expect(onChoice).toHaveBeenCalledWith('cliente:11', { displayText: 'Ana Gómez' });
  });

  it('si ya llegó otro mensaje, los chips se ven pero NO se pueden volver a mandar', async () => {
    const { onChoice } = await montar([
      PREGUNTA,
      { id: 'u1', role: 'user', text: 'Ana Gómez' },
      { id: 'a2', role: 'assistant', text: 'Listo, con Ana Gómez.' },
    ]);
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chips-desambiguacion-opcion-0'));
    expect(onChoice).not.toHaveBeenCalled();
  });

  it('el par confirmar/cancelar sigue siendo el gate HITL, NO chips', async () => {
    await montar([
      {
        id: 'g1',
        role: 'assistant',
        text: '¿Mando el mail?',
        choices: [
          { label: 'Sí, mandalo', value: 'confirm_x' },
          { label: 'No', value: 'cancel_x' },
        ],
      },
    ]);
    expect(screen.queryByTestId('chips-desambiguacion')).toBeNull();
  });

  it('sin `choices` es la burbuja de siempre, sin chips', async () => {
    await montar([{ id: 'a1', role: 'assistant', text: 'Hola' }]);
    expect(screen.getByText('Hola')).toBeTruthy();
    expect(screen.queryByTestId('chips-desambiguacion')).toBeNull();
  });
});

describe('ListaMensajes — SM-D1: artefactos con enlace', () => {
  afterEach(() => jest.restoreAllMocks());

  const evento = (data: unknown): ChatMessage =>
    ({ id: 'a1', role: 'assistant', text: 'Listo, lo agendé.', card: { kind: 'calendar_event', data } }) as ChatMessage;
  const doc = (kind: string, data: unknown): ChatMessage =>
    ({ id: 'a1', role: 'assistant', text: 'Te lo dejé armado.', card: { kind, data } }) as ChatMessage;

  it('calendar_event: la burbuja, el título del evento y «Ver en Calendar» con el link real', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockClear().mockResolvedValue(true);
    await montar([evento({ url: 'https://calendar.google.com/e/1', fields: { title: 'Reunión con Ana' } })]);
    expect(screen.getByText('Listo, lo agendé.')).toBeTruthy();
    expect(screen.getByTestId('tarjeta-artefacto-titulo')).toHaveTextContent('Reunión con Ana');
    fireEvent.press(screen.getByTestId('tarjeta-artefacto-abrir'));
    await Promise.resolve();
    expect(abrir).toHaveBeenCalledWith('https://calendar.google.com/e/1');
  });

  it('calendar_event sin url: se ve el título y no hay botón (no se inventa un enlace)', async () => {
    await montar([evento({ fields: { title: 'Reunión con Ana' } })]);
    expect(screen.getByTestId('tarjeta-artefacto-titulo')).toHaveTextContent('Reunión con Ana');
    expect(screen.queryByTestId('tarjeta-artefacto-abrir')).toBeNull();
  });

  it.each([
    ['doc', 'Abrir documento'],
    ['sheet', 'Abrir planilla'],
    ['file', 'Abrir archivo'],
    ['email_draft', 'Ver borrador'],
  ])('%s con url: botón «%s» que abre el enlace', async (kind, etiqueta) => {
    const abrir = jest.spyOn(Linking, 'openURL').mockClear().mockResolvedValue(true);
    await montar([doc(kind, { url: 'https://drive.google.com/x' })]);
    expect(screen.getByText(etiqueta)).toBeTruthy();
    fireEvent.press(screen.getByTestId('tarjeta-artefacto-abrir'));
    await Promise.resolve();
    expect(abrir).toHaveBeenCalledWith('https://drive.google.com/x');
  });

  it('doc sin url no tiene acción: queda sólo la burbuja', async () => {
    await montar([doc('doc', {})]);
    expect(screen.getByText('Te lo dejé armado.')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-artefacto')).toBeNull();
  });

  it('un payment_link NO lo toma esta tarjeta (lo resuelve TarjetaLinkDeCobro)', async () => {
    await montar([doc('payment_link', { url: 'https://mpago.la/x', amount: 1000 })]);
    expect(screen.queryByTestId('tarjeta-artefacto')).toBeNull();
    expect(screen.getByTestId('tarjeta-link-cobro')).toBeTruthy();
  });
});
