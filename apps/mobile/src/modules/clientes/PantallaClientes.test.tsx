import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

/** Partial mock: sólo la red. `formatearImporte` y las clases de error, REALES. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    listarClientes: jest.fn(),
    obtenerCliente: jest.fn(),
    crearCliente: jest.fn(),
    editarCliente: jest.fn(),
  };
});

import { crearCliente, editarCliente, listarClientes, obtenerCliente } from '@copiloto/core';
import type { Cliente, FichaCliente } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaClientes } from './PantallaClientes';

const mockListar = listarClientes as jest.MockedFunction<typeof listarClientes>;
const mockFicha = obtenerCliente as jest.MockedFunction<typeof obtenerCliente>;
const mockCrear = crearCliente as jest.MockedFunction<typeof crearCliente>;
const mockEditar = editarCliente as jest.MockedFunction<typeof editarCliente>;

function cliente(over: Partial<Cliente> = {}): Cliente {
  return {
    id: 12,
    nombre: 'Panadería Los Tilos',
    docTipo: 80,
    docNro: '30712345678',
    condicionIva: 1,
    domicilio: null,
    email: null,
    telefono: null,
    notas: null,
    origen: 'derivado',
    creadoEn: '2026-07-22T10:00:00+00:00',
    ...over,
  };
}

function ficha(over: Partial<FichaCliente> = {}): FichaCliente {
  return { cliente: cliente(), presupuestos: [], facturas: [], ...over };
}

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaClientes />
    </ThemeProvider>,
  );
}

describe('PantallaClientes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListar.mockResolvedValue({ status: 'ok', clientes: [cliente()], total: 1 });
    mockFicha.mockResolvedValue({ status: 'ok', ficha: ficha() });
    mockCrear.mockResolvedValue({ status: 'ok', cliente: cliente({ id: 30, nombre: 'Kiosco' }) });
    mockEditar.mockResolvedValue({ status: 'ok', cliente: cliente() });
  });

  it('pinta la cartera', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('cliente-12-nombre')).toBeTruthy());
    expect(screen.getByTestId('cliente-12-nombre')).toHaveTextContent('Panadería Los Tilos');
    expect(screen.getByTestId('cliente-12-sub')).toHaveTextContent('CUIT 30712345678');
  });

  it('un cliente sin documento NO muestra ninguna etiqueta de que le falta', async () => {
    // Es el caso NORMAL de esta cartera (se deriva de presupuestos, donde el documento es opcional).
    // Un "sin CUIT" marcaría como incompleta a media cartera.
    mockListar.mockResolvedValue({
      status: 'ok',
      clientes: [cliente({ docNro: null, docTipo: null, telefono: null })],
      total: 1,
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('cliente-12-nombre')).toBeTruthy());
    expect(screen.queryByTestId('cliente-12-sub')).toBeNull();
  });

  it('no marca los derivados y sí los cargados a mano', async () => {
    mockListar.mockResolvedValue({ status: 'ok', clientes: [cliente({ origen: 'voz' })], total: 1 });

    await montar();

    await waitFor(() => expect(screen.getByTestId('cliente-12-origen')).toBeTruthy());
  });

  it('la cartera vacía explica que se arma sola, sin parecer un error', async () => {
    mockListar.mockResolvedValue({ status: 'ok', clientes: [], total: 0 });

    await montar();

    await waitFor(() => expect(screen.getByTestId('clientes-vacio')).toBeTruthy());
    expect(screen.getByTestId('clientes-vacio')).toHaveTextContent(
      // El texto ahora ofrece el alta a mano: la cartera vacia del dia 1 no puede ser solo un aviso.
      'Tu cartera se va a armar sola con lo que factures y presupuestes — y mientras tanto podés cargar el primero a mano.',
    );
  });

  it('el endpoint no desplegado avisa, no explota', async () => {
    mockListar.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('clientes-no-disponible')).toBeTruthy());
  });

  describe('búsqueda', () => {
    it('🔴 la resuelve el BACKEND — manda `q`, no filtra la página local', async () => {
      // Con paginación, un filter local sólo miraría la página cargada: buscar "panaderia"
      // devolvería vacío mientras el cliente existe en la página 2.
      jest.useFakeTimers();
      await montar();
      await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(1));

      await act(async () => {
        fireEvent.changeText(screen.getByTestId('clientes-buscar-input'), 'panaderia');
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith({ q: 'panaderia' }));
      jest.useRealTimers();
    });

    it('espera a que se deje de tipear — no una petición por tecla', async () => {
      // Sin el debounce, "pan" son tres peticiones y las respuestas pueden llegar desordenadas:
      // la de "p" llegando después de la de "pan" pisaría el resultado bueno con uno viejo.
      jest.useFakeTimers();
      await montar();
      await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(1));

      await act(async () => {
        fireEvent.changeText(screen.getByTestId('clientes-buscar-input'), 'p');
        fireEvent.changeText(screen.getByTestId('clientes-buscar-input'), 'pa');
        fireEvent.changeText(screen.getByTestId('clientes-buscar-input'), 'pan');
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      // 1 la inicial + 1 la búsqueda. No 4.
      await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(2));
      jest.useRealTimers();
    });
  });

  describe('ficha', () => {
    it('se pide SIEMPRE al abrir, aunque el listado ya tenga el cliente', async () => {
      // El listado no trae el historial: reusar su objeto dejaría una ficha sin operaciones que se
      // ve idéntica a una con cero.
      await montar();
      await waitFor(() => expect(screen.getByTestId('cliente-12')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('cliente-12'));
      });

      await waitFor(() => expect(mockFicha).toHaveBeenCalledWith(12));
    });

    it('las secciones vacías se DICEN, no se esconden', async () => {
      // Ocultarlas haría que la ficha se vea completa y que el emprendedor concluya que nunca le
      // compró nada. Llegan vacías hasta el hito 3 del backend.
      await montar();
      await waitFor(() => expect(screen.getByTestId('cliente-12')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('cliente-12'));
      });

      await waitFor(() => expect(screen.getByTestId('ficha-presupuestos-vacio')).toBeTruthy());
      expect(screen.getByTestId('ficha-facturas-vacio')).toBeTruthy();
    });

    it('un 404 dice "no encontramos", no "no disponible"', async () => {
      mockFicha.mockResolvedValue({ status: 'no_encontrado' });
      await montar();
      await waitFor(() => expect(screen.getByTestId('cliente-12')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('cliente-12'));
      });

      await waitFor(() => expect(screen.getByTestId('ficha-cliente-no-encontrado')).toBeTruthy());
    });
  });

  describe('alta a mano y edicion (hito 7)', () => {
    /** Abre el formulario de alta y deja el nombre puesto. */
    async function abrirAltaCon(nombre: string) {
      await waitFor(() => expect(screen.getByTestId('clientes-nuevo')).toBeTruthy());
      fireEvent.press(screen.getByTestId('clientes-nuevo'));
      // El formulario aparece un tick despues del press (el Pressable es de gesture-handler).
      await waitFor(() => expect(screen.getByTestId('formulario-cliente')).toBeTruthy());
      await act(async () => {
        fireEvent.changeText(screen.getByTestId('formulario-cliente-nombre-input'), nombre);
      });
    }

    it('la cartera VACIA ofrece el alta - no solo informa que no hay nada', async () => {
      // El dia 1 no hay facturas de las que derivar. Un vacio que solo informa deja la funcion
      // nacida muerta: es el mecanismo por el que se abandono el Sheet de presupuestos.
      mockListar.mockResolvedValue({ status: 'ok', clientes: [], total: 0 });

      await montar();

      await waitFor(() => expect(screen.getByTestId('clientes-vacio')).toBeTruthy());
      expect(screen.getByTestId('clientes-nuevo')).toBeTruthy();
    });

    it('el formulario vive DENTRO del scroll — si no, el teclado le tapa los campos', async () => {
      // 🔴 Guard estructural, no cosmetico. `CampoTexto` se revela por encima del teclado pidiendoselo
      // al `ScrollFormulario` via contexto, y el default de ese contexto es **noop**: un campo fuera
      // del scroll no falla ni avisa, simplemente deja de revelarse. En el glass eso no se degrada a
      // "un poco peor" — el teclado se dibuja ENCIMA y ademas mata el scroll, asi que el campo queda
      // inalcanzable. Es un bug que este repo ya pago y que el gate de jsdom no puede ver.
      await montar();
      await abrirAltaCon('Kiosco');

      const scroll = screen.getByTestId('clientes-lista');
      expect(within(scroll).getByTestId('formulario-cliente-nombre-input')).toBeTruthy();

      // 🔴 El control, horneado: `glass-titulo` existe en la pantalla pero VIVE FUERA del scroll (lo
      // pone `MarcoGlass`). Si `within` lo encontrara, no estaria acotando nada y la asercion de
      // arriba pasaria con el formulario en cualquier lado — verde y sin significado.
      expect(within(scroll).queryByTestId('glass-titulo')).toBeNull();
      expect(screen.getByTestId('glass-titulo')).toBeTruthy();
    });

    it('con SOLO el nombre se puede guardar, y no viaja ningun documento', async () => {
      // Regla dura: la UI no puede exigir mas que el backend. Pedir el CUIT trabaria al cliente de
      // mostrador Y taparia desacuerdos entre las dos capas.
      await montar();
      await abrirAltaCon('Kiosco');
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      // El segundo argumento es `undefined`: `forzar` es una confirmacion del humano, nunca un
      // default. Se asierta explicito para que agregarlo por comodidad rompa el test.
      expect(mockCrear).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: 'Kiosco', docTipo: null, docNro: null }),
        undefined,
      );
    });

    it('sin nombre no se guarda - es lo UNICO que el backend exige', async () => {
      await montar();
      await waitFor(() => expect(screen.getByTestId('clientes-nuevo')).toBeTruthy());
      fireEvent.press(screen.getByTestId('clientes-nuevo'));
      await waitFor(() => expect(screen.getByTestId('formulario-cliente')).toBeTruthy());
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      expect(mockCrear).not.toHaveBeenCalled();
    });

    it('despues de guardar, la cartera VUELVE A PREGUNTAR', async () => {
      // Un listado que solo carga al montar muestra dato viejo identico al fresco: el cliente recien
      // creado no apareceria y el emprendedor lo daria de alta otra vez.
      await montar();
      await abrirAltaCon('Kiosco');
      const antes = mockListar.mock.calls.length;
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      expect(mockListar.mock.calls.length).toBeGreaterThan(antes);
    });

    it('el 409 NOMBRA al dueno y ofrece abrirlo - NO es un error rojo', async () => {
      // El backend manda la ficha entera, no un id, justamente para poder escribir el nombre. Con el
      // id pelado haria falta un GET extra solo para redactar la frase.
      mockCrear.mockResolvedValue({
        status: 'duplicado',
        duplicado: { por: 'documento', dueno: cliente({ id: 7, nombre: 'Ferretería El Tornillo' }) },
      });

      await montar();
      await abrirAltaCon('Repetido');
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      expect(screen.getByTestId('clientes-duplicado-texto')).toHaveTextContent(
        'Ese documento ya es de Ferretería El Tornillo.',
      );
      expect(screen.queryByTestId('formulario-cliente-error')).toBeNull();
      expect(screen.getByTestId('clientes-duplicado-abrir')).toBeTruthy();
    });

    it('🔴 el choque por NOMBRE se queda EN el formulario y ofrece las dos salidas', async () => {
      // Dos clientes pueden llamarse igual de verdad. Cerrar el formulario le borraria lo tipeado y lo
      // dejaria sin maniobra: le pediriamos un CUIT que no tiene, justo lo que §6.bis prohibe exigir.
      mockCrear.mockResolvedValue({
        status: 'duplicado',
        duplicado: { por: 'nombre', dueno: cliente({ id: 9, nombre: 'Juan Pérez' }) },
      });

      await montar();
      await abrirAltaCon('Juan Pérez');
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      // El formulario NO se cerro, y lo tipeado sigue ahi.
      expect(screen.getByTestId('formulario-cliente')).toBeTruthy();
      expect(screen.getByTestId('formulario-cliente-nombre-input').props.value).toBe('Juan Pérez');
      expect(screen.getByTestId('formulario-cliente-homonimo-texto')).toHaveTextContent(
        'Ya tenés un cliente que se llama Juan Pérez.',
      );
      // Las DOS salidas. Si solo estuviera "abrir el otro", entro a cargar un cliente y se va sin
      // haber cargado nada.
      expect(screen.getByTestId('formulario-cliente-homonimo-forzar')).toBeTruthy();
      expect(screen.getByTestId('formulario-cliente-homonimo-abrir')).toBeTruthy();
    });

    it('🔴 avisa que van a quedar DOS iguales, y NO bloquea', async () => {
      // Es la consecuencia de `forzar` que no vimos al implementarlo: forzar ocurre justo despues del
      // 409, cuando lo normal es tener solo el nombre, y quedan dos filas identicas en la cartera.
      // Este es el unico momento en que alguien sabe en que se diferencian.
      mockCrear.mockResolvedValue({
        status: 'duplicado',
        duplicado: { por: 'nombre', dueno: cliente({ id: 9, nombre: 'Juan Pérez' }) },
      });

      await montar();
      await abrirAltaCon('Juan Pérez');
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      expect(screen.getByTestId('formulario-cliente-homonimo-sin-datos')).toBeTruthy();
      // Avisa, no bloquea: exigir un dato seria el tapon que este formulario existe para no tener.
      expect(screen.getByTestId('formulario-cliente-homonimo-forzar')).toBeTruthy();
    });

    it('con un dato que los distinga, el aviso NO aparece', async () => {
      // El control del test de arriba: si el aviso saliera siempre, no estaria midiendo nada.
      mockCrear.mockResolvedValue({
        status: 'duplicado',
        duplicado: { por: 'nombre', dueno: cliente({ id: 9, nombre: 'Juan Pérez' }) },
      });

      await montar();
      await abrirAltaCon('Juan Pérez');
      await act(async () => {
        fireEvent.changeText(screen.getByTestId('formulario-cliente-telefono-input'), '11-5555-4444');
      });
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      expect(screen.queryByTestId('formulario-cliente-homonimo-sin-datos')).toBeNull();
    });

    it('🔴 la cartera distingue dos homonimos por su primer dato identificatorio', async () => {
      mockListar.mockResolvedValue({
        status: 'ok',
        total: 2,
        clientes: [
          cliente({ id: 20, nombre: 'Juan Pérez', docNro: null, docTipo: null, telefono: '11-1111-1111' }),
          cliente({ id: 23, nombre: 'Juan Pérez', docNro: null, docTipo: null, telefono: null, domicilio: 'Mitre 500' }),
        ],
      });

      await montar();

      await waitFor(() => expect(screen.getByTestId('cliente-20-sub')).toBeTruthy());
      expect(screen.getByTestId('cliente-20-sub')).toHaveTextContent('11-1111-1111');
      expect(screen.getByTestId('cliente-23-sub')).toHaveTextContent('Mitre 500');
    });

    it('🔴 "Es otro, crearlo igual" reenvia lo MISMO con forzar - nada se re-tipea', async () => {
      mockCrear.mockResolvedValueOnce({
        status: 'duplicado',
        duplicado: { por: 'nombre', dueno: cliente({ id: 9, nombre: 'Juan Pérez' }) },
      });
      mockCrear.mockResolvedValueOnce({
        status: 'ok',
        cliente: cliente({ id: 41, nombre: 'Juan Pérez' }),
      });

      await montar();
      await abrirAltaCon('Juan Pérez');
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });
      await act(async () => {
        fireEvent.press(screen.getByTestId('formulario-cliente-homonimo-forzar'));
      });

      expect(mockCrear).toHaveBeenLastCalledWith(
        expect.objectContaining({ nombre: 'Juan Pérez' }),
        { forzar: true },
      );
      // Y el primer intento NO llevaba forzar: la confirmacion es del humano, no un default.
      expect(mockCrear.mock.calls[0]?.[1]).toBeUndefined();
    });

    it('🔴 un choque por DOCUMENTO no ofrece "crearlo igual" - dos CUIT iguales son un tipeo', async () => {
      // Es la distincion entera: mismo status, dos preguntas distintas. Ofrecer "crearlo igual" aca
      // seria empujar a forzar algo que el backend ignora, y el alta nunca entraria.
      mockCrear.mockResolvedValue({
        status: 'duplicado',
        duplicado: { por: 'documento', dueno: cliente({ id: 7, nombre: 'Ferretería El Tornillo' }) },
      });

      await montar();
      await abrirAltaCon('Otro nombre');
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      expect(screen.queryByTestId('formulario-cliente-homonimo')).toBeNull();
      expect(screen.getByTestId('clientes-duplicado-texto')).toHaveTextContent(
        'Ese documento ya es de Ferretería El Tornillo.',
      );
    });

    it('🔴 un `por` que no reconozco cae en el camino de la PREGUNTA, no en el de documento', async () => {
      // Decision declarada: ante un `por` ilegible las dos lecturas son posibles, y las consecuencias
      // de errar NO son simetricas.
      //   - Tratarlo como documento: cierro el formulario, le borro lo tipeado y lo mando a una ficha
      //     ajena. Si era un choque de nombre, "parece que funciono" y se va creyendo que cargo a su
      //     cliente mientras mira a otro.
      //   - Tratarlo como nombre: conserva lo tipeado y ofrece las dos salidas. Si en realidad era un
      //     documento repetido, "crearlo igual" vuelve a dar 409 (el backend ignora `forzar` ahi) y se
      //     ve el aviso otra vez. Molesto, nunca enganoso.
      // Ante la duda, el camino que no destruye datos ni afirma de mas.
      mockCrear.mockResolvedValue({
        status: 'duplicado',
        duplicado: { por: 'desconocido', dueno: null },
      });

      await montar();
      await abrirAltaCon('Repetido');
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      expect(screen.getByTestId('formulario-cliente-homonimo')).toBeTruthy();
      // Y no afirma el motivo que no midio: "parecido", no "con ese nombre".
      expect(screen.getByTestId('formulario-cliente-homonimo-texto')).toHaveTextContent(
        'Ya tenés un cliente parecido en la cartera.',
      );
      // Sin dueno no hay a donde abrir: se degrada el atajo, no el aviso.
      expect(screen.queryByTestId('formulario-cliente-homonimo-abrir')).toBeNull();
      expect(screen.getByTestId('formulario-cliente-homonimo-forzar')).toBeTruthy();
    });

    it('el alta no desplegada se dice, no explota', async () => {
      mockCrear.mockResolvedValue({ status: 'no_disponible' });

      await montar();
      await abrirAltaCon('Kiosco');
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      expect(screen.getByTestId('formulario-cliente-error')).toBeTruthy();
    });

    it('editar SOLO el telefono no manda el domicilio ni el mail', async () => {
      // El bug mas caro de esta pantalla: el objeto entero borra el domicilio que vino de las
      // facturas de AFIP - un dato que el emprendedor nunca tipeo y no sabe que puede perder.
      const conDomicilio = cliente({ domicilio: 'Av. Mitre 1234', telefono: null });
      mockListar.mockResolvedValue({ status: 'ok', clientes: [conDomicilio], total: 1 });
      mockFicha.mockResolvedValue({ status: 'ok', ficha: ficha({ cliente: conDomicilio }) });

      await montar();
      await waitFor(() => expect(screen.getByTestId('cliente-12-nombre')).toBeTruthy());
      await act(async () => { fireEvent.press(screen.getByTestId('cliente-12')); });
      await waitFor(() => expect(screen.getByTestId('ficha-cliente-editar')).toBeTruthy());
      fireEvent.press(screen.getByTestId('ficha-cliente-editar'));
      await waitFor(() => expect(screen.getByTestId('formulario-cliente')).toBeTruthy());

      await act(async () => {
        fireEvent.changeText(screen.getByTestId('formulario-cliente-telefono-input'), '11-5555-4444');
      });
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      expect(mockEditar).toHaveBeenCalledWith(12, { telefono: '11-5555-4444' }, undefined);
    });

    it('🔴 editar SOLO el mail no manda el telefono — el mismo bug con otra cara', async () => {
      // El test del domicilio ya existia y NO cubre este: son dos claves nuevas que se llenan en el
      // mismo formulario, y el telefono que se borraria es el que el backfill saco de un presupuesto
      // viejo — nadie lo tipeo y nadie sabe que puede perderlo.
      const conTelefono = cliente({ telefono: '11-5555-4444', email: null });
      mockListar.mockResolvedValue({ status: 'ok', clientes: [conTelefono], total: 1 });
      mockFicha.mockResolvedValue({ status: 'ok', ficha: ficha({ cliente: conTelefono }) });

      await montar();
      await waitFor(() => expect(screen.getByTestId('cliente-12-nombre')).toBeTruthy());
      await act(async () => { fireEvent.press(screen.getByTestId('cliente-12')); });
      await waitFor(() => expect(screen.getByTestId('ficha-cliente-editar')).toBeTruthy());
      fireEvent.press(screen.getByTestId('ficha-cliente-editar'));
      await waitFor(() => expect(screen.getByTestId('formulario-cliente')).toBeTruthy());

      await act(async () => {
        fireEvent.changeText(screen.getByTestId('formulario-cliente-email-input'), 'pan@mail.com');
      });
      await act(async () => { fireEvent.press(screen.getByTestId('formulario-cliente-guardar')); });

      expect(mockEditar).toHaveBeenCalledWith(12, { email: 'pan@mail.com' }, undefined);
    });

    it('la ficha que NO cargo no ofrece editar - el diff seria contra datos incompletos', async () => {
      mockFicha.mockResolvedValue({ status: 'no_disponible' });

      await montar();
      await waitFor(() => expect(screen.getByTestId('cliente-12-nombre')).toBeTruthy());
      await act(async () => { fireEvent.press(screen.getByTestId('cliente-12')); });

      await waitFor(() => expect(screen.getByTestId('ficha-cliente-no-disponible')).toBeTruthy());
      expect(screen.queryByTestId('ficha-cliente-editar')).toBeNull();
    });
  });
});
