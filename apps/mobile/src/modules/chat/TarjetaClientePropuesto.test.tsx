import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/**
 * Mock de `expo-router`: "Abrir ese cliente" navega vía `empujarUnaVez` (que llama `router.push`).
 * Sin el mock, toca el módulo real fuera de un `NavigationContainer`. Mismo criterio que
 * `PantallaFacturacion.test.tsx`.
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

/** Partial mock: sólo la red. `leerClientePropuesto` y el formulario, REALES. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, crearCliente: jest.fn() };
});

import { router } from 'expo-router';

import { crearCliente, leerClientePropuesto, type Cliente } from '@copiloto/core';

import { reabrirNavegacion } from '../../navegacion/empujarUnaVez';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaClientePropuesto } from './TarjetaClientePropuesto';

const mockCrear = crearCliente as jest.MockedFunction<typeof crearCliente>;
const mockPush = router.push as jest.MockedFunction<typeof router.push>;

/** La card TAL COMO SALE DEL VIVO — medida por backend contra el `/reply` real. */
function propuesta(over: Record<string, unknown> = {}) {
  const p = leerClientePropuesto({
    kind: 'cliente_propuesto',
    data: {
      nombre: 'Ferretería El Tornillo',
      doc_tipo: 80,
      doc_nro: '30712345678',
      condicion_iva: null,
      domicilio: null,
      email: null,
      telefono: null,
      notas: null,
      origen: 'voz',
      ...over,
    },
  });
  if (p == null) throw new Error('la propuesta de prueba no debería ser null');
  return p;
}

function clienteGuardado(nombre: string, id = 7): Cliente {
  return {
    id,
    nombre,
    docTipo: 80,
    docNro: '30712345678',
    condicionIva: null,
    domicilio: null,
    email: null,
    telefono: null,
    notas: null,
    origen: 'voz',
    creadoEn: '2026-07-22T02:00:00+00:00',
  };
}

async function montar(p = propuesta(), texto?: string) {
  return render(
    <ThemeProvider>
      <TarjetaClientePropuesto propuesta={p} texto={texto} />
    </ThemeProvider>,
  );
}

describe('TarjetaClientePropuesto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 🔴 `empujarUnaVez` guarda un flag de MÓDULO que se cierra al primer push y sólo lo reabre el
    // foco de la pantalla lanzadora. Sin esto, el primer test que navegue dejaría mudos a los
    // siguientes y el verde no significaría nada.
    reabrirNavegacion();
  });

  it('dice explícitamente que TODAVÍA no se agregó', async () => {
    // El backend verificó con un control (contar filas: 0) que la card no guarda. Sin el cartel, el
    // emprendedor lee el "listo" del copiloto, no toca nada, y el cliente no existe.
    await montar();

    expect(screen.getByTestId('cliente-propuesto-aviso')).toHaveTextContent(
      'Esto entendí. Revisalo y tocá Dar de alta — todavía no lo agregué.',
    );
  });

  it('llega con lo dictado ya cargado — no hay que re-tipear nada', async () => {
    await montar();

    expect(screen.getByTestId('cliente-propuesto-formulario-nombre-input').props.value).toBe(
      'Ferretería El Tornillo',
    );
    expect(screen.getByTestId('cliente-propuesto-formulario-doc-nro-input').props.value).toBe(
      '30712345678',
    );
  });

  it('🔴 permite CORREGIR el nombre que el LLM entendió mal, y manda `origen: voz`', async () => {
    // Es lo que justifica que sea un formulario y no un sí/no: con un sí/no sólo se podría aceptar
    // el nombre mal transcripto o repetir el dictado entero.
    mockCrear.mockResolvedValue({ status: 'ok', cliente: clienteGuardado('Ferretería El Tornillo') });
    await montar();

    await act(async () => {
      fireEvent.changeText(
        screen.getByTestId('cliente-propuesto-formulario-nombre-input'),
        'Ferretería El Tornillo SRL',
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('cliente-propuesto-formulario-guardar'));
    });

    expect(mockCrear).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Ferretería El Tornillo SRL', origen: 'voz' }),
      { idemKey: expect.any(String) },
    );
  });

  it('🔴 el texto del copiloto se MUESTRA — es donde vive la explicación del documento que no cierra', async () => {
    // La card reemplaza a la burbuja, así que lo que no se pase acá no se ve nunca. Cuando el
    // dictado dice «CUIT» y el número tiene 7 dígitos, el backend manda `doc_tipo: null` y explica
    // la contradicción SÓLO en este texto: el formulario únicamente puede mostrar un campo vacío.
    await montar(
      propuesta({ doc_tipo: null, doc_nro: '3071234' }),
      'Dijiste CUIT pero un CUIT tiene 11 dígitos y ese número tiene 7.',
    );

    expect(screen.getByTestId('cliente-propuesto-texto')).toHaveTextContent(
      'Dijiste CUIT pero un CUIT tiene 11 dígitos y ese número tiene 7.',
    );
  });

  it('sin texto no se pinta un hueco', async () => {
    await montar(propuesta(), '   ');

    expect(screen.queryByTestId('cliente-propuesto-texto')).toBeNull();
  });

  it('🔴 un número dictado SIN tipo se ve y se puede completar — no desaparece', async () => {
    // El backend manda `doc_nro` con `doc_tipo: null` A PROPÓSITO cuando el dictado no da 11 ni 7-8
    // dígitos, para que el emprendedor corrija. El formulario mostraba el número sólo si había tipo:
    // el dato se caía de la pantalla Y del body en silencio, que es exactamente lo que la card
    // existe para impedir.
    mockCrear.mockResolvedValue({ status: 'ok', cliente: clienteGuardado('Ferretería El Tornillo') });
    await montar(propuesta({ doc_tipo: null, doc_nro: '3071234' }));

    expect(screen.getByTestId('cliente-propuesto-formulario-doc-nro-input').props.value).toBe('3071234');
    // Y se avisa que falta elegir el tipo, en vez de tirarlo callado.
    expect(screen.getByTestId('cliente-propuesto-formulario-doc-sin-tipo')).toBeTruthy();
  });

  it('al guardar se convierte en confirmación y ya no se puede volver a mandar', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', cliente: clienteGuardado('Ferretería El Tornillo') });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('cliente-propuesto-formulario-guardar'));
    });

    await waitFor(() => expect(screen.getByTestId('cliente-propuesto-guardado')).toBeTruthy());
    expect(screen.getByTestId('cliente-propuesto-guardado')).toHaveTextContent(
      'Cliente agregado: Ferretería El Tornillo',
    );
    // El botón desaparece: una card que sigue posteable después de guardar es un cliente duplicado.
    expect(screen.queryByTestId('cliente-propuesto-formulario-guardar')).toBeNull();
  });

  it('🔴 el 409 por DOCUMENTO cierra el formulario y ofrece abrir al que ya existe', async () => {
    // Es el mismo cliente: no hay nada que editar. Dejar el formulario abierto invitaría a insistir.
    mockCrear.mockResolvedValue({
      status: 'duplicado',
      duplicado: { por: 'documento', dueno: clienteGuardado('Ferretería El Tornillo SA', 42) },
    });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('cliente-propuesto-formulario-guardar'));
    });

    await waitFor(() => expect(screen.getByTestId('cliente-propuesto-ya-existe')).toBeTruthy());
    expect(screen.getByTestId('cliente-propuesto-ya-existe-texto')).toHaveTextContent(
      'Ese cliente ya está en tu cartera: Ferretería El Tornillo SA.',
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('cliente-propuesto-ya-existe-abrir'));
    });

    // 🔴 El botón NAVEGA de verdad. Uno que no lleva a ningún lado es el defecto que este repo ya
    // pagó: cada lado verifica su mitad y la junta no es de nadie.
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/clientes', params: { clienteId: '42' } });
  });

  it('🔴 sin dueño reconocible se avisa igual, PERO sin botón', async () => {
    // Inventar un id llevaría a la ficha equivocada, que es peor que un atajo de menos.
    mockCrear.mockResolvedValue({ status: 'duplicado', duplicado: { por: 'documento', dueno: null } });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('cliente-propuesto-formulario-guardar'));
    });

    await waitFor(() => expect(screen.getByTestId('cliente-propuesto-ya-existe')).toBeTruthy());
    expect(screen.getByTestId('cliente-propuesto-ya-existe-texto')).toHaveTextContent(
      'Ese cliente ya está en tu cartera.',
    );
    expect(screen.queryByTestId('cliente-propuesto-ya-existe-abrir')).toBeNull();
  });

  it('🔴 el 409 por NOMBRE se queda en el formulario, con lo dictado intacto', async () => {
    // Dos «Kiosco» pueden ser dos kioscos: es una pregunta que sólo el emprendedor responde. Cerrar
    // acá le borraría lo dictado sin darle ninguna salida.
    mockCrear.mockResolvedValue({
      status: 'duplicado',
      duplicado: { por: 'nombre', dueno: clienteGuardado('Ferretería El Tornillo', 42) },
    });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('cliente-propuesto-formulario-guardar'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('cliente-propuesto-formulario-homonimo')).toBeTruthy(),
    );
    expect(screen.queryByTestId('cliente-propuesto-ya-existe')).toBeNull();
    expect(screen.getByTestId('cliente-propuesto-formulario-nombre-input').props.value).toBe(
      'Ferretería El Tornillo',
    );
  });

  it('🔴 forzar el homónimo reenvía lo MISMO, con `forzar`', async () => {
    mockCrear.mockResolvedValueOnce({
      status: 'duplicado',
      duplicado: { por: 'nombre', dueno: clienteGuardado('Ferretería El Tornillo', 42) },
    });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('cliente-propuesto-formulario-guardar'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('cliente-propuesto-formulario-homonimo-forzar')).toBeTruthy(),
    );

    mockCrear.mockResolvedValueOnce({ status: 'ok', cliente: clienteGuardado('Ferretería El Tornillo', 43) });
    await act(async () => {
      fireEvent.press(screen.getByTestId('cliente-propuesto-formulario-homonimo-forzar'));
    });

    expect(mockCrear).toHaveBeenLastCalledWith(
      expect.objectContaining({ nombre: 'Ferretería El Tornillo', origen: 'voz' }),
      { forzar: true, idemKey: expect.any(String) },
    );
  });

  it('descartar no guarda nada', async () => {
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('cliente-propuesto-formulario-cancelar'));
    });

    expect(screen.getByTestId('cliente-propuesto-descartado')).toBeTruthy();
    expect(mockCrear).not.toHaveBeenCalled();
  });
});
