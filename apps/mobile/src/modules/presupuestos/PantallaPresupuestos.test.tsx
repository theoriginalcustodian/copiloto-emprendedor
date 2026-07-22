import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/**
 * Partial mock de `@copiloto/core`: sólo las funciones de red. `ApiError` y los formateadores se
 * conservan REALES — el componente hace `e instanceof ApiError`, y una clase falsa declarada acá
 * rompe ese chequeo (la factory corre antes de que la `class` salga de su zona muerta temporal).
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    listarPresupuestos: jest.fn(),
    obtenerPresupuesto: jest.fn(),
    crearPresupuesto: jest.fn(),
    facturarPresupuesto: jest.fn(),
  };
});

import {
  crearPresupuesto,
  facturarPresupuesto,
  listarPresupuestos,
  obtenerPresupuesto,
  type Presupuesto,
} from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaPresupuestos } from './PantallaPresupuestos';

const mockListar = listarPresupuestos as jest.MockedFunction<typeof listarPresupuestos>;
const mockObtener = obtenerPresupuesto as jest.MockedFunction<typeof obtenerPresupuesto>;
const mockCrear = crearPresupuesto as jest.MockedFunction<typeof crearPresupuesto>;
const mockFacturar = facturarPresupuesto as jest.MockedFunction<typeof facturarPresupuesto>;

function presupuesto(over: Partial<Presupuesto> = {}): Presupuesto {
  return {
    id: 12,
    numero: 8,
    fecha: '2026-07-21T22:14:03.120Z',
    concepto: 'Instalación eléctrica',
    receptor: {
      nombre: 'Juan Pérez',
      docTipo: 96,
      docNro: '20123456',
      condicionIva: 5,
      domicilio: '',
      contacto: 'juan@mail.com',
    },
    items: [],
    cantidadItems: 2,
    total: '45000.00',
    moneda: 'ARS',
    docLink: 'https://docs.google.com/document/d/1HsL/edit',
    docId: '1HsL',
    sheetFila: null,
    reemplazaA: null,
    reemplazadoPor: null,
    facturaId: null,
    facturado: false,
    ...over,
  };
}

const onFacturar = jest.fn();

/**
 * 🔴 **`async` + `await`, y no es opcional.** Con RNTL 14 + React 19 `render()` devuelve una
 * **promesa** (está documentado en `jest.config.js`). Sin el await, el árbol queda a medio construir
 * y los `fireEvent.changeText` se pierden en silencio: el campo sigue vacío, el botón sigue
 * deshabilitado, y el fallo se lee como "el formulario no valida" en vez de "el render no terminó".
 * Costó una sonda descubrirlo — el error que jest tira (`render function has not been called`) no
 * menciona el await por ningún lado.
 */
async function montar() {
  return render(
    <ThemeProvider>
      <PantallaPresupuestos onFacturar={onFacturar} />
    </ThemeProvider>,
  );
}

/**
 * 🔴 **El `changeText` va envuelto en `act`, y sin eso NO llega.**
 *
 * El formulario se monta *después* del render inicial (al tocar "Nuevo presupuesto"), y ahí el
 * `fireEvent` suelto no alcanza a flushear el re-render: el campo queda vacío, el botón deshabilitado
 * y el fallo se lee como "el formulario no valida" en vez de "el evento no se aplicó". Medido con una
 * sonda: mismo evento sin `act` deja `value: ""`, con `act` deja `"Instalación"`.
 */
async function escribir(campo: string, texto: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(`formulario-presupuesto-${campo}-input`), texto);
  });
}

/** Los tres campos que el backend exige, y nada más. */
async function completarMinimo() {
  await escribir('concepto', 'Instalación');
  await escribir('nombre', 'Juan Pérez');
  await escribir('item-0-descripcion', 'Mano de obra');
}

async function abrirFormularioNuevo() {
  await waitFor(() => expect(screen.getByTestId('presupuestos-nuevo')).toBeTruthy());
  fireEvent.press(screen.getByTestId('presupuestos-nuevo'));
  await waitFor(() => expect(screen.getByTestId('formulario-presupuesto')).toBeTruthy());
}

describe('PantallaPresupuestos', () => {
  beforeEach(() => {
    onFacturar.mockReset();
    mockListar.mockReset();
    mockObtener.mockReset();
    mockCrear.mockReset();
    mockFacturar.mockReset();
    mockListar.mockResolvedValue({ status: 'ok', presupuestos: [presupuesto()] });
    mockObtener.mockResolvedValue({ status: 'ok', presupuesto: presupuesto({ items: [] }) });
  });

  it('lista los presupuestos con su resumen derivado', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('presupuesto-card-12')).toBeTruthy());
    expect(screen.getByTestId('presupuesto-card-12-encabezado')).toHaveTextContent('Juan Pérez');
    // El total se formatea desde el STRING, sin pasar por `Number`.
    expect(screen.getByTestId('presupuesto-card-12-total')).toHaveTextContent('$45.000,00');
    expect(screen.getByTestId('presupuesto-card-12-detalle')).toHaveTextContent('2 ítems', { exact: false });
  });

  it('una lista vacía no es un error: invita a crear uno', async () => {
    mockListar.mockResolvedValue({ status: 'ok', presupuestos: [] });

    await montar();

    await waitFor(() => expect(screen.getByTestId('presupuestos-vacio')).toBeTruthy());
    expect(screen.queryByTestId('presupuestos-error')).toBeNull();
  });

  it('cuando el endpoint no está desplegado lo dice, sin ofrecer reintentar', async () => {
    mockListar.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('presupuestos-no-disponible')).toBeTruthy());
  });

  /**
   * 🔴 El badge sale de `facturado`, NUNCA de `facturaId != null`. Un borrador cancelado deja
   * `facturaId` puesto y `facturado: false`; derivarlo del id marcaría como facturado un presupuesto
   * cuya factura nunca se emitió. Este test es rojo si alguien "simplifica" a `facturaId != null`.
   */
  it('un borrador CANCELADO (facturaId puesto, facturado false) NO muestra el badge', async () => {
    mockListar.mockResolvedValue({
      status: 'ok',
      presupuestos: [presupuesto({ facturaId: 'afip-factura-cancelada', facturado: false })],
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('presupuesto-card-12')).toBeTruthy());
    expect(screen.queryByTestId('presupuesto-card-12-badge-facturado')).toBeNull();
  });

  it('con facturado:true sí muestra el badge', async () => {
    mockListar.mockResolvedValue({
      status: 'ok',
      presupuestos: [presupuesto({ facturaId: 'afip-factura-abc', facturado: true })],
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('presupuesto-card-12-badge-facturado')).toBeTruthy());
  });

  /**
   * 🔴 La lección de "Mis comprobantes": la lista cargaba al montar y nada más, y el operador vio
   * hasta la N° 15 mientras la 18 ya existía. El tirón es el ÚNICO disparador que cubre lo que
   * cambió AFUERA de esta pantalla (el copiloto creando un presupuesto por chat, otro dispositivo).
   */
  it('el tirón vuelve a preguntar', async () => {
    await montar();
    await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(1));

    // ⚠️ Lo que este test NO prueba: que el gesto llegue. Dispara el `onRefresh` por la prop porque
    // el `RefreshControl` no renderiza un nodo tocable en jsdom — el tirón real es de device.
    // Mismo patrón (y misma limitación declarada) que el de "Mis comprobantes".
    const refresco = screen.getByTestId('presupuestos-lista').props.refreshControl;
    expect(refresco.props.refreshing).toBe(false);
    await act(async () => {
      await refresco.props.onRefresh();
    });

    await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(2));
  });

  it('el historial se pide al backend, no se filtra en el cliente', async () => {
    // Filtrar acá con `reemplazadoPor` sería correcto sólo si toda la cadena entrara en la página
    // pedida: una respuesta que a veces acierta.
    await montar();
    await waitFor(() => expect(screen.getByTestId('presupuestos-toggle-historial')).toBeTruthy());

    fireEvent.press(screen.getByTestId('presupuestos-toggle-historial'));

    await waitFor(() => expect(mockListar).toHaveBeenCalledWith({ incluirReemplazados: true }));
  });

  describe('el detalle', () => {
    it('se abre al tocar la card y pide los ítems, que el listado no trae', async () => {
      mockObtener.mockResolvedValue({
        status: 'ok',
        presupuesto: presupuesto({
          items: [
            { orden: 0, descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '30000.00', codigo: '' },
            { orden: 1, descripcion: 'Materiales', cantidad: '1', precioUnitario: '15000.00', codigo: '' },
          ],
        }),
      });

      await montar();
      await waitFor(() => expect(screen.getByTestId('presupuesto-card-12-abrir')).toBeTruthy());
      fireEvent.press(screen.getByTestId('presupuesto-card-12-abrir'));

      await waitFor(() => expect(screen.getByTestId('detalle-presupuesto')).toBeTruthy());
      await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-item-0')).toBeTruthy());
      expect(mockObtener).toHaveBeenCalledWith(12);
      expect(screen.getByTestId('detalle-presupuesto-total')).toHaveTextContent('$45.000,00');
    });

    it('sin doc_link no muestra el botón de Google Docs y lo explica', async () => {
      // `docLink: null` NO es un error: el presupuesto se crea igual sin Google Docs conectado.
      mockListar.mockResolvedValue({ status: 'ok', presupuestos: [presupuesto({ docLink: null })] });
      mockObtener.mockResolvedValue({ status: 'ok', presupuesto: presupuesto({ docLink: null }) });

      await montar();
      await waitFor(() => expect(screen.getByTestId('presupuesto-card-12-abrir')).toBeTruthy());
      fireEvent.press(screen.getByTestId('presupuesto-card-12-abrir'));

      await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-sin-doc')).toBeTruthy());
      expect(screen.queryByTestId('detalle-presupuesto-ver-doc')).toBeNull();
    });

    it('Facturar deposita en el gate con el id del BORRADOR, no emite', async () => {
      mockFacturar.mockResolvedValue({ status: 'ok', facturaId: 'presu-12', borradorNuevo: true });

      await montar();
      await waitFor(() => expect(screen.getByTestId('presupuesto-card-12-abrir')).toBeTruthy());
      fireEvent.press(screen.getByTestId('presupuesto-card-12-abrir'));
      await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-facturar')).toBeTruthy());

      fireEvent.press(screen.getByTestId('detalle-presupuesto-facturar'));

      await waitFor(() => expect(onFacturar).toHaveBeenCalledWith('presu-12'));
    });

    /**
     * 🔴 Medido contra el servicio vivo el 2026-07-21: un segundo `POST .../facturar` devuelve 200
     * con un `factura_id` NUEVO, no el 409 del contrato. Sin esta defensa, cada toque acumula
     * borradores y el emprendedor puede emitir dos facturas del mismo trabajo. Este test es rojo si
     * alguien vuelve a colgar el botón sólo de `facturado`.
     */
    it('con un borrador pendiente CONTINÚA ese, en vez de pedir otro', async () => {
      const conBorrador = presupuesto({ facturaId: 'afip-factura-borrador', facturado: false });
      mockListar.mockResolvedValue({ status: 'ok', presupuestos: [conBorrador] });
      mockObtener.mockResolvedValue({ status: 'ok', presupuesto: conBorrador });

      await montar();
      await waitFor(() => expect(screen.getByTestId('presupuesto-card-12-abrir')).toBeTruthy());
      fireEvent.press(screen.getByTestId('presupuesto-card-12-abrir'));
      await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-continuar-factura')).toBeTruthy());

      fireEvent.press(screen.getByTestId('detalle-presupuesto-continuar-factura'));

      expect(onFacturar).toHaveBeenCalledWith('afip-factura-borrador');
      // Y lo que importa: NO se pidió un borrador nuevo.
      expect(mockFacturar).not.toHaveBeenCalled();
      expect(screen.queryByTestId('detalle-presupuesto-facturar')).toBeNull();
    });

    it('sin perfil fiscal manda a Ajustes, no a reintentar', async () => {
      mockFacturar.mockResolvedValue({ status: 'falta_perfil_fiscal' });

      await montar();
      await waitFor(() => expect(screen.getByTestId('presupuesto-card-12-abrir')).toBeTruthy());
      fireEvent.press(screen.getByTestId('presupuesto-card-12-abrir'));
      await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-facturar')).toBeTruthy());

      fireEvent.press(screen.getByTestId('detalle-presupuesto-facturar'));

      await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-falta-perfil')).toBeTruthy());
      expect(onFacturar).not.toHaveBeenCalled();
    });

    it('un presupuesto ya facturado no ofrece Facturar de nuevo', async () => {
      mockListar.mockResolvedValue({ status: 'ok', presupuestos: [presupuesto({ facturado: true })] });
      mockObtener.mockResolvedValue({ status: 'ok', presupuesto: presupuesto({ facturado: true }) });

      await montar();
      await waitFor(() => expect(screen.getByTestId('presupuesto-card-12-abrir')).toBeTruthy());
      fireEvent.press(screen.getByTestId('presupuesto-card-12-abrir'));

      await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-facturado')).toBeTruthy());
      expect(screen.queryByTestId('detalle-presupuesto-facturar')).toBeNull();
    });

    it('un presupuesto reemplazado lo dice — si no, se ve idéntico a uno vigente', async () => {
      mockListar.mockResolvedValue({ status: 'ok', presupuestos: [presupuesto({ reemplazadoPor: 15 })] });
      mockObtener.mockResolvedValue({ status: 'ok', presupuesto: presupuesto({ reemplazadoPor: 15 }) });

      await montar();
      await waitFor(() => expect(screen.getByTestId('presupuesto-card-12-abrir')).toBeTruthy());
      fireEvent.press(screen.getByTestId('presupuesto-card-12-abrir'));

      await waitFor(() =>
        expect(screen.getByTestId('detalle-presupuesto-reemplazado-por')).toHaveTextContent('N° 15', {
          exact: false,
        }),
      );
    });
  });

  describe('el alta', () => {
    it('crea con lo mínimo que el backend exige, y nada más', async () => {
      mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuesto({ id: 13, numero: 9 }) });

      await montar();
      await abrirFormularioNuevo();
      await completarMinimo();
      await escribir('item-0-precio', '30000');

      fireEvent.press(screen.getByTestId('formulario-presupuesto-guardar'));

      await waitFor(() => expect(mockCrear).toHaveBeenCalled());
      const enviado = mockCrear.mock.calls[0][0];
      // 🔴 El total NO viaja: lo calcula el backend. Mandarlo sería una segunda aritmética del dinero.
      expect(enviado).not.toHaveProperty('total');
      expect(enviado.items).toEqual([
        { descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '30000' },
      ]);
    });

    it('acepta la coma decimal del teclado argentino sin pasar por float', async () => {
      mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuesto() });

      await montar();
      await abrirFormularioNuevo();
      await completarMinimo();
      await escribir('item-0-precio', '30000,50');

      fireEvent.press(screen.getByTestId('formulario-presupuesto-guardar'));

      await waitFor(() => expect(mockCrear).toHaveBeenCalled());
      // `"30000,50"` no es un decimal válido para el backend; el string sale string, no `Number`.
      expect(mockCrear.mock.calls[0][0].items[0].precioUnitario).toBe('30000.50');
    });

    /**
     * 🔴 No exigir MÁS que el backend. Un `puedeGuardar` que pide de más traba el caso legítimo Y
     * esconde desacuerdos entre las dos capas: el formulario nunca llega a mandar el body que el
     * backend rechazaría, así que la divergencia no da síntoma hasta que alguien pega por HTTP.
     */
    it('no exige contacto ni documento: el contrato pide concepto, nombre y ≥1 ítem', async () => {
      mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuesto() });

      await montar();
      await abrirFormularioNuevo();
      await completarMinimo();

      fireEvent.press(screen.getByTestId('formulario-presupuesto-guardar'));

      await waitFor(() => expect(mockCrear).toHaveBeenCalled());
    });

    it('relee la lista tras crear — el alta puede haber sacado a otro del listado vigente', async () => {
      mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuesto({ id: 13 }) });

      await montar();
      await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(1));
      await abrirFormularioNuevo();
      await completarMinimo();
      fireEvent.press(screen.getByTestId('formulario-presupuesto-guardar'));

      // Insertar el objeto devuelto en la lista local dejaría visibles a los DOS: al nuevo y al que
      // reemplazó. La relectura es lo que hace valer el filtro del backend.
      await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(2));
    });

    it('corregir manda reemplazaA y avisa que el número va a cambiar', async () => {
      mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuesto({ id: 13, numero: 9 }) });

      await montar();
      await waitFor(() => expect(screen.getByTestId('presupuesto-card-12-abrir')).toBeTruthy());
      fireEvent.press(screen.getByTestId('presupuesto-card-12-abrir'));
      await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-corregir')).toBeTruthy());
      fireEvent.press(screen.getByTestId('detalle-presupuesto-corregir'));

      // Que el número cambie sin aviso sería la clase de sorpresa que hace desconfiar justo donde
      // hay plata: el presupuesto viejo ya puede estar en manos del cliente.
      await waitFor(() => expect(screen.getByTestId('formulario-presupuesto-aviso-correccion')).toBeTruthy());
      await escribir('item-0-descripcion', 'Mano de obra');
      await escribir('item-0-precio', '32000');
      fireEvent.press(screen.getByTestId('formulario-presupuesto-guardar'));

      await waitFor(() => expect(mockCrear).toHaveBeenCalled());
      expect(mockCrear.mock.calls[0][0].reemplazaA).toBe(12);
    });
  });
});
