import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { ThemeProvider } from '../../theme/ThemeProvider';
import { Composer } from './Composer';

function renderComposer(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  return render(
    <ThemeProvider>
      <Composer sendStatus="idle" onSend={jest.fn()} {...props} />
    </ThemeProvider>,
  );
}

describe('Composer -- placeholder (O1: Soporte no es el chat de negocio)', () => {
  it('sin `placeholder`, el del chat general no cambia', async () => {
    await renderComposer();
    await waitFor(() => expect(screen.getByTestId('chat-composer')).toBeTruthy());
    expect(screen.getByTestId('chat-composer').props.placeholder).toBe('Escribí, o hablá…');
  });

  it('con `placeholder`, el campo muestra el que le pasan', async () => {
    await renderComposer({ placeholder: 'Contame qué pasó…' });
    await waitFor(() => expect(screen.getByTestId('chat-composer')).toBeTruthy());
    expect(screen.getByTestId('chat-composer').props.placeholder).toBe('Contame qué pasó…');
  });
});

describe('Composer -- botón de foto (Gastos Fase 2, la única excepción a "sin botones propios")', () => {
  it('sin `onFoto`, el botón de cámara NO existe -- default es el composer sin excepciones', async () => {
    await renderComposer();
    await waitFor(() => expect(screen.getByTestId('chat-composer')).toBeTruthy());
    expect(screen.queryByTestId('chat-foto')).toBeNull();
  });

  it('con `onFoto`, el botón existe y lo dispara al tocarlo', async () => {
    const onFoto = jest.fn();
    await renderComposer({ onFoto });
    await waitFor(() => expect(screen.getByTestId('chat-foto')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('chat-foto'));

    expect(onFoto).toHaveBeenCalledTimes(1);
  });

  it('`disabled` también deshabilita el botón de foto -- no sólo el de enviar', async () => {
    const onFoto = jest.fn();
    await renderComposer({ onFoto, disabled: true });
    await waitFor(() => expect(screen.getByTestId('chat-foto')).toBeTruthy());

    expect(screen.getByTestId('chat-foto').props.accessibilityState?.disabled).toBe(true);
  });
});

describe('Composer -- semilla (hitl a: el aviso de una tarjeta de Mi día)', () => {
  it('siembra el texto en el campo y NO lo manda: lo envía quien lo lee', async () => {
    const onSend = jest.fn();
    await renderComposer({ onSend, semilla: { texto: 'Sobre este aviso de Mi día: «X». Acción: Reclamar', id: 1 } });
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.value).toBe('Sobre este aviso de Mi día: «X». Acción: Reclamar'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('🔴 no pisa un borrador a medias: la semilla va arriba y lo que había queda debajo', async () => {
    const view = await renderComposer();
    await fireEvent.changeText(screen.getByTestId('chat-composer'), 'le quiero decir que');
    await view.rerender(
      <ThemeProvider>
        <Composer sendStatus="idle" onSend={jest.fn()} semilla={{ texto: 'AVISO', id: 1 }} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.value).toBe('AVISO\n\nle quiero decir que'));
  });

  it('el mismo aviso dos veces (otro `id`) vuelve a sembrar; el mismo `id` no re-siembra en cada render', async () => {
    const view = await renderComposer({ semilla: { texto: 'AVISO', id: 1 } });
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.value).toBe('AVISO'));
    await fireEvent.changeText(screen.getByTestId('chat-composer'), '');

    // Mismo `id`, objeto nuevo: NO vuelve a escribir el aviso sobre lo que el usuario ya borró/editó.
    await view.rerender(
      <ThemeProvider>
        <Composer sendStatus="idle" onSend={jest.fn()} semilla={{ texto: 'AVISO', id: 1 }} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('chat-composer').props.value).toBe('');
    await view.rerender(
      <ThemeProvider>
        <Composer sendStatus="idle" onSend={jest.fn()} semilla={{ texto: 'AVISO', id: 2 }} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.value).toBe('AVISO'));
  });

  it('sin semilla el campo arranca vacío (nada cambia para el chat de siempre)', async () => {
    await renderComposer();
    await waitFor(() => expect(screen.getByTestId('chat-composer')).toBeTruthy());
    expect(screen.getByTestId('chat-composer').props.value).toBe('');
  });
});

describe('Composer -- SM-I2: mic, barra y campo que abre', () => {
  const Mic = () => <Text testID="mic-prueba">mic</Text>;
  const Barra = <Text testID="barra-prueba">0:07</Text>;

  it('sin mic (quien no dicta), el avión queda en su lugar, deshabilitado hasta que haya texto', async () => {
    await renderComposer();
    expect(screen.getByTestId('chat-enviar').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('chat-composer'), 'hola');
    expect(screen.getByTestId('chat-enviar').props.accessibilityState?.disabled).toBe(false);
  });

  it('el mic cede su lugar al avión apenas hay texto, y vuelve si se borra', async () => {
    await renderComposer({ mic: <Mic /> });
    expect(screen.getByTestId('mic-prueba')).toBeTruthy();
    expect(screen.queryByTestId('chat-enviar')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('chat-composer'), 'hola');
    expect(screen.queryByTestId('mic-prueba')).toBeNull();
    expect(screen.getByTestId('chat-enviar')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('chat-composer'), '  ');
    expect(screen.getByTestId('mic-prueba')).toBeTruthy();
  });

  it('🔴 con captura en curso el mic se queda aunque haya borrador, y el borrador no se pierde', async () => {
    const { rerender } = await renderComposer({ mic: <Mic /> });
    await fireEvent.changeText(screen.getByTestId('chat-composer'), 'lo que venía escribiendo');

    await rerender(
      <ThemeProvider>
        <Composer sendStatus="idle" onSend={jest.fn()} mic={<Mic />} enLugarDelCampo={Barra} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('barra-prueba')).toBeTruthy();
    expect(screen.getByTestId('mic-prueba')).toBeTruthy();
    expect(screen.getByTestId('chat-composer-campo', { includeHiddenElements: true })).toHaveStyle({ display: 'none' });

    await rerender(
      <ThemeProvider>
        <Composer sendStatus="idle" onSend={jest.fn()} mic={<Mic />} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('chat-composer').props.value).toBe('lo que venía escribiendo');
  });

  it('con `onTocarCampo` el campo no abre teclado: tocarlo avisa', async () => {
    const onTocarCampo = jest.fn();
    await renderComposer({ onTocarCampo });
    expect(screen.getByTestId('chat-composer').props.editable).toBe(false);
    await fireEvent.press(screen.getByTestId('chat-composer-abrir'));
    expect(onTocarCampo).toHaveBeenCalledTimes(1);
  });
});
describe('Composer -- SM-N41: la base del campo es LEGIBLE (decidido por el operador, 2026-11-03)', () => {
  function alfaDeLaBase(): number {
    const { StyleSheet } = require('react-native');
    const estilo = StyleSheet.flatten(screen.getByTestId('chat-composer-campo-base').props.style);
    const m = /^rgba\(\d+,\d+,\d+,([\d.]+)\)$/.exec(estilo.backgroundColor);
    expect(m).not.toBeNull(); // control ciego: si el formato cambia, falla acá y no pasa por vacío
    return Number(m![1]);
  }

  it('la base tapa lo que pasa detrás: alfa >= .95 (con .85 todavía se leía «Editar/Cancelar» a través del campo)', async () => {
    await renderComposer();
    await waitFor(() => expect(screen.getByTestId('chat-composer-campo-base')).toBeTruthy());
    expect(alfaDeLaBase()).toBeGreaterThanOrEqual(0.95);
  });
});
