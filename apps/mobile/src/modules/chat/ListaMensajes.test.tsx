import { fireEvent, render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/** `TarjetaClientePropuesto` importa `empujarUnaVez`, que toca `expo-router`. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

import type { ChatMessage } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { ListaMensajes } from './ListaMensajes';

// `render` de esta versión de @testing-library/react-native es `async` -- hay que awaitearlo.
async function envolver(messages: ChatMessage[], onChoice = jest.fn()) {
  await render(
    <ThemeProvider>
      <ListaMensajes messages={messages} onChoice={onChoice} />
    </ThemeProvider>,
  );
  return { onChoice };
}

describe('ListaMensajes', () => {
  it('el estado vacío muestra la marca y el texto de bienvenida', async () => {
    await envolver([]);

    expect(screen.getByTestId('chat-vacio')).toBeTruthy();
    expect(screen.getByText('¿En qué te ayudo?')).toBeTruthy();
  });

  it('un mensaje de usuario se renderiza como burbuja simple', async () => {
    const mensajes: ChatMessage[] = [{ id: 'user-1', role: 'user', text: 'hola copiloto' }];

    await envolver(mensajes);

    expect(screen.getByText('hola copiloto')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-confirmacion')).toBeNull();
  });

  it('el gate de confirmación (par confirmar/cancelar) se renderiza como tarjeta, no como burbuja', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Vas a enviarle este mail a Juan. ¿Confirmás?',
        choices: [
          { label: 'Enviar', value: 'confirm' },
          { label: 'Cancelar', value: 'cancel' },
        ],
      },
    ];

    await envolver(mensajes);

    expect(screen.getByTestId('tarjeta-confirmacion')).toBeTruthy();
    expect(screen.getByText('Vas a enviarle este mail a Juan. ¿Confirmás?')).toBeTruthy();
  });

  it('confirmar manda el value de confirmar, sin payload -- es de sólo lectura, no se edita nada', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Vas a cobrar $500 por MercadoPago. ¿Confirmás?',
        choices: [
          { label: 'Cobrar', value: 'confirm' },
          { label: 'Cancelar', value: 'cancel' },
        ],
      },
    ];
    const { onChoice } = await envolver(mensajes);

    await fireEvent.press(screen.getByTestId('tarjeta-confirmacion-confirmar'));

    expect(onChoice).toHaveBeenCalledWith('confirm');
  });

  it('cancelar manda el value de cancelar', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Vas a publicar en Instagram. ¿Confirmás?',
        choices: [
          { label: 'Publicar', value: 'confirm' },
          { label: 'Cancelar', value: 'cancel' },
        ],
      },
    ];
    const { onChoice } = await envolver(mensajes);

    await fireEvent.press(screen.getByTestId('tarjeta-confirmacion-cancelar'));

    expect(onChoice).toHaveBeenCalledWith('cancel');
  });

  it('🔴 un `cliente_propuesto` se renderiza como CARD editable, no como burbuja', async () => {
    // La card no lleva `choices`, así que `mapearGate` la ignora: sin este cableado caería en
    // `Burbuja` y el emprendedor vería el texto del copiloto y ningún lugar donde corregir el nombre.
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Entendí este cliente.',
        card: {
          kind: 'cliente_propuesto',
          data: { nombre: 'Ferretería El Tornillo', doc_tipo: 80, doc_nro: '30712345678', origen: 'voz' },
        },
      },
    ];

    await envolver(mensajes);

    expect(screen.getByTestId('cliente-propuesto')).toBeTruthy();
    expect(screen.getByTestId('cliente-propuesto-formulario')).toBeTruthy();
    // 🔴 Y el texto del copiloto VIAJA a la card. Este test afirmaba lo contrario —que el texto
    // desaparecía— y con eso fijaba el bug: la card reemplaza a la burbuja, así que ahí muere la
    // explicación del backend de un documento que no cierra, que no está en ningún campo.
    expect(screen.getByTestId('cliente-propuesto-texto')).toHaveTextContent('Entendí este cliente.');
  });

  it('una `cliente_propuesto` SIN nombre no pinta un formulario vacío — cae en burbuja', async () => {
    // Pedirle que tipee desde cero lo que ya dictó es peor que mostrarle el texto del copiloto.
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'No entendí el nombre.',
        card: { kind: 'cliente_propuesto', data: { nombre: null, origen: 'voz' } },
      },
    ];

    await envolver(mensajes);

    expect(screen.queryByTestId('cliente-propuesto')).toBeNull();
    expect(screen.getByText('No entendí el nombre.')).toBeTruthy();
  });

  it('🔴 un `ingreso_propuesto` se renderiza como CARD editable, no como burbuja', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Entendí este ingreso.',
        card: { kind: 'ingreso_propuesto', data: { monto: '85000.00', medio: 'efectivo' } },
      },
    ];

    await envolver(mensajes);

    expect(screen.getByTestId('ingreso-propuesto')).toBeTruthy();
    expect(screen.getByTestId('ingreso-propuesto-formulario')).toBeTruthy();
  });

  it('un `ingreso_propuesto` SIN monto no pinta un formulario vacío — cae en burbuja', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'No entendí cuánto.',
        card: { kind: 'ingreso_propuesto', data: { monto: null } },
      },
    ];

    await envolver(mensajes);

    expect(screen.queryByTestId('ingreso-propuesto')).toBeNull();
    expect(screen.getByText('No entendí cuánto.')).toBeTruthy();
  });

  it('🔴 un `presupuesto_propuesto` se renderiza como CARD editable, no como burbuja', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Entendí este presupuesto.',
        card: {
          kind: 'presupuesto_propuesto',
          data: {
            concepto: 'Instalación eléctrica',
            receptor: { nombre: 'Juan Pérez' },
            items: [{ descripcion: 'Mano de obra', cantidad: '1', precio_unitario: '30000' }],
          },
        },
      },
    ];

    await envolver(mensajes);

    expect(screen.getByTestId('presupuesto-propuesto')).toBeTruthy();
    expect(screen.getByTestId('presupuesto-propuesto-formulario')).toBeTruthy();
  });

  it('un `presupuesto_propuesto` SIN ítems no pinta un formulario vacío — cae en burbuja', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'No entendí los ítems.',
        card: {
          kind: 'presupuesto_propuesto',
          data: { concepto: 'Instalación eléctrica', receptor: { nombre: 'Juan Pérez' }, items: [] },
        },
      },
    ];

    await envolver(mensajes);

    expect(screen.queryByTestId('presupuesto-propuesto')).toBeNull();
    expect(screen.getByText('No entendí los ítems.')).toBeTruthy();
  });

  it('🔴 una `factura_propuesta` se renderiza como CARD de sólo lectura, no como burbuja', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Esto entendí de tu factura.',
        card: {
          kind: 'factura_propuesta',
          data: {
            factura_id: 'presu-12',
            faltantes: [],
            items: [{ descripcion: 'Service de aire', cantidad: 1, precio_unitario: 50000 }],
            cliente: { razon_social: 'Juan Pérez', cuit: '20304050607', condicion_iva: 'CF' },
            total: 50000,
            tipo_comprobante: 'C',
          },
        },
      },
    ];

    await envolver(mensajes);

    expect(screen.getByTestId('factura-propuesta')).toBeTruthy();
    expect(screen.getByTestId('factura-propuesta-emitir')).toBeTruthy();
  });

  it('una `factura_propuesta` SIN `factura_id` no pinta una card sin nada sobre qué actuar — cae en burbuja', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'No pude armar el borrador.',
        card: { kind: 'factura_propuesta', data: { faltantes: [], items: [], total: 0 } },
      },
    ];

    await envolver(mensajes);

    expect(screen.queryByTestId('factura-propuesta')).toBeNull();
    expect(screen.getByText('No pude armar el borrador.')).toBeTruthy();
  });

  it('una card con kind desconocido en un mensaje sin gate no rompe la pantalla', async () => {
    const mensajes: ChatMessage[] = [
      { id: 'assistant-1', role: 'assistant', text: 'todo bien', card: { kind: 'algo_futuro' } },
    ];

    await envolver(mensajes); // si algo rompiera, esto rechazaría la promesa.

    expect(screen.getByText('todo bien')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-confirmacion')).toBeNull();
  });

  it('un choices que NO es el par confirmar/cancelar no tiene UI dedicada -- se ve el texto igual', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: '¿Cuál de estos clientes?',
        choices: [
          { label: 'Ana', value: 'ana' },
          { label: 'Beto', value: 'beto' },
          { label: 'Carla', value: 'carla' },
        ],
      },
    ];

    await envolver(mensajes);

    expect(screen.getByText('¿Cuál de estos clientes?')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-confirmacion')).toBeNull();
  });
});
