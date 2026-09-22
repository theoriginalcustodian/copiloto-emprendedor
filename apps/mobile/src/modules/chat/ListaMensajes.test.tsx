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
    expect(screen.queryByTestId('chat-bubble-voz')).toBeNull();
  });

  it('BL-J7 (H-A3-7): un mensaje llegado por dictado muestra el chip «Por voz · Ns»', async () => {
    const mensajes: ChatMessage[] = [
      { id: 'user-2', role: 'user', text: 'anotá un gasto de 500', porVoz: { duracionSeg: 7 } },
    ];

    await envolver(mensajes);

    expect(screen.getByTestId('chat-bubble-voz')).toBeTruthy();
    expect(screen.getByText('Por voz · 7s')).toBeTruthy();
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

    // BL-D4 — el label ('Cobrar') viaja en `opts.displayText`: es lo que la burbuja optimista del
    // usuario tiene que pintar, nunca el `value` técnico ('confirm') que espera el backend.
    // H-A4-9 — `opts.hitlMessageId` (`message.id`) es lo que permite a `useChat().send` marcar ESTA
    // card `hitlRespondido` para que quede deshabilitada aun después de un reload.
    expect(onChoice).toHaveBeenCalledWith('confirm', { displayText: 'Cobrar', hitlMessageId: 'assistant-1' });
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

    expect(onChoice).toHaveBeenCalledWith('cancel', { displayText: 'Cancelar', hitlMessageId: 'assistant-1' });
  });

  // H-A4-9 — control positivo + negativo: una card HITL YA respondida (`hitlRespondido` en el
  // mensaje) queda deshabilitada — `disabled` nativo de `Pressable` bloquea el toque, y
  // `fireEvent.press` no dispara ningún callback. Sin el fix, la card seguiría activa y el press
  // reenviaría confirm/cancel aunque el turno ya esté resuelto.
  it('H-A4-9: card HITL con hitlRespondido queda deshabilitada — press no dispara onChoice', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Vas a cobrar $500 por MercadoPago. ¿Confirmás?',
        choices: [
          { label: 'Cobrar', value: 'confirm' },
          { label: 'Cancelar', value: 'cancel' },
        ],
        hitlRespondido: { value: 'cancel', label: 'Cancelar' },
      },
    ];
    const { onChoice } = await envolver(mensajes);

    const botonConfirmar = screen.getByTestId('tarjeta-confirmacion-confirmar');
    const botonCancelar = screen.getByTestId('tarjeta-confirmacion-cancelar');

    // `Pressable` NO reenvía `disabled`/`onPress` tal cual al host node: los consume y los traduce a
    // `accessibilityState.disabled` (ver `Pressable.js` de RN) — por eso se lee ahí, no en `.props.disabled`.
    // Y el control funcional (abajo) es la prueba real: aunque algo leyera mal el accessibilityState,
    // el press no debe disparar `onChoice`.
    expect(botonConfirmar.props.accessibilityState?.disabled).toBe(true);
    expect(botonCancelar.props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(botonConfirmar);
    await fireEvent.press(botonCancelar);

    expect(onChoice).not.toHaveBeenCalled();
  });

  it('sin hitlRespondido (control negativo): la card sigue activa, press dispara onChoice', async () => {
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

    // control negativo del test H-A4-9 de arriba — misma lectura via `accessibilityState`.
    expect(screen.getByTestId('tarjeta-confirmacion-confirmar').props.accessibilityState?.disabled).toBeFalsy();

    await fireEvent.press(screen.getByTestId('tarjeta-confirmacion-confirmar'));
    expect(onChoice).toHaveBeenCalledTimes(1);
  });

  it('BL-D3: gate irreversible (Instagram) EXIGE la advertencia, el badge y el servicio', async () => {
    await envolver([
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Vas a publicar en Instagram. ¿Confirmás?',
        card: { kind: 'confirm', service: 'instagram', label: 'Instagram' },
        choices: [
          { label: 'Publicar', value: 'confirm' },
          { label: 'Cancelar', value: 'cancel' },
        ],
      },
    ]);
    expect(screen.getByTestId('tarjeta-confirmacion-irreversible')).toBeTruthy();
    expect(screen.getByText('IRREVERSIBLE')).toBeTruthy();
    expect(screen.getByText('Instagram')).toBeTruthy();
  });

  it('BL-D3: gate reversible NO muestra la advertencia; Mercado Pago muestra PARA y MONTO', async () => {
    await envolver([
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Vas a cobrarle **Juan Pérez** $15.000, confirmá',
        card: { kind: 'confirm', service: 'mercadopago', label: 'Mercado Pago' },
        choices: [
          { label: 'Cobrar', value: 'confirm' },
          { label: 'Cancelar', value: 'cancel' },
        ],
      },
    ]);
    expect(screen.queryByTestId('tarjeta-confirmacion-irreversible')).toBeNull();
    expect(screen.getByText('REVISAR')).toBeTruthy();
    expect(screen.getByTestId('tarjeta-confirmacion-para')).toBeTruthy();
    expect(screen.getByText('$15.000')).toBeTruthy();
  });

  it('BL-D3: el gate pinta el LOGO real del servicio (por serviceKey)', async () => {
    await envolver([
      {
        id: 'assistant-mercadopago',
        role: 'assistant',
        text: 'Confirmá',
        card: { kind: 'confirm', service: 'mercadopago', label: 'Mercado Pago' },
        choices: [
          { label: 'Ok', value: 'confirm' },
          { label: 'No', value: 'cancel' },
        ],
      },
    ]);
    expect(screen.getByTestId('tarjeta-confirmacion-logo')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-confirmacion-punto')).toBeNull();
  });

  it('BL-D3: un servicio sin logo (Instagram) cae al punto genérico', async () => {
    await envolver([
      {
        id: 'assistant-instagram',
        role: 'assistant',
        text: 'Confirmá',
        card: { kind: 'confirm', service: 'instagram', label: 'Instagram' },
        choices: [
          { label: 'Ok', value: 'confirm' },
          { label: 'No', value: 'cancel' },
        ],
      },
    ]);
    expect(screen.getByTestId('tarjeta-confirmacion-punto')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-confirmacion-logo')).toBeNull();
  });

  it('BL-C3: el separador de día cambia en la medianoche de Buenos Aires, no en la del runtime', async () => {
    // 21/09 23:59 BA = 22/09 02:59Z; 22/09 00:01 BA = 22/09 03:01Z. En UTC ambos serían «22»: acá son dos días.
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 8, 22, 15, 0, 0));
    try {
      await envolver([
        { id: 'u1', role: 'user', text: 'antes', creadoEn: Date.UTC(2026, 8, 22, 2, 59, 0) },
        { id: 'u2', role: 'user', text: 'después', creadoEn: Date.UTC(2026, 8, 22, 3, 1, 0) },
      ]);
      const etiquetas = screen.getAllByTestId('separador-dia').map((n) => n.props.children);
      expect(etiquetas).toEqual(['Ayer', 'Hoy']);
    } finally {
      spy.mockRestore();
    }
  });

  it('BL-D3: sin card, tarjeta neutra sin badge ni advertencia', async () => {
    await envolver([
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Vas a mandar un mail. ¿Confirmás?',
        choices: [
          { label: 'Enviar', value: 'confirm' },
          { label: 'Cancelar', value: 'cancel' },
        ],
      },
    ]);
    expect(screen.queryByTestId('tarjeta-confirmacion-riesgo')).toBeNull();
    expect(screen.queryByTestId('tarjeta-confirmacion-irreversible')).toBeNull();
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

  it('BL-F2: una card payment_link se renderiza como tarjeta de cobro, no como burbuja', async () => {
    await envolver([
      {
        id: 'assistant-9',
        role: 'assistant',
        text: 'Listo, ahí tenés el link.',
        card: { kind: 'payment_link', data: { url: 'https://mpago.la/x', amount: 2500, concept: 'Clase' } },
      },
    ]);

    expect(screen.getByTestId('tarjeta-link-cobro')).toBeTruthy();
    expect(screen.getByTestId('tarjeta-link-cobro-monto')).toHaveTextContent('$2.500');
  });

  it('BL-F2: un payment_link sin url cae a la burbuja de texto', async () => {
    await envolver([
      { id: 'assistant-10', role: 'assistant', text: 'No pude armar el link.', card: { kind: 'payment_link', data: {} } },
    ]);

    expect(screen.queryByTestId('tarjeta-link-cobro')).toBeNull();
    expect(screen.getByText('No pude armar el link.')).toBeTruthy();
  });
});
