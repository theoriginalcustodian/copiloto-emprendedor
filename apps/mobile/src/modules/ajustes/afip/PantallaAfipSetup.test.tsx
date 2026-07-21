import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/** Almacén en memoria -- mismo patrón que `useChat.test.ts` (`jest.mock('../../adapters/almacen')`):
 *  aísla la caché del CUIT de `AsyncStorage` real y deja controlar por test qué "ya conocía" la
 *  pantalla al montar. */
jest.mock('../../../adapters/almacen', () => ({
  almacenClave: {
    leer: jest.fn().mockResolvedValue(null),
    guardar: jest.fn().mockResolvedValue(undefined),
    borrar: jest.fn().mockResolvedValue(undefined),
  },
}));

/** Partial mock de `@copiloto/core`: sólo se reemplazan las 4 funciones de red de `afip.ts`.
 *  `ErrorValidacionFiscal` se conserva REAL (`...actual`) -- el componente hace
 *  `e instanceof ErrorValidacionFiscal`, así que un mock de la clase rompería ese chequeo. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    leerPerfil: jest.fn(),
    guardarPerfil: jest.fn(),
    conectarArca: jest.fn(),
    estadoAfip: jest.fn(),
    cambiarAmbiente: jest.fn(),
    guardarAjustesAfip: jest.fn(),
  };
});

import {
  ErrorValidacionFiscal,
  cambiarAmbiente,
  conectarArca,
  estadoAfip,
  guardarAjustesAfip,
  guardarPerfil,
  leerPerfil,
  type EstadoAfip,
  type OnboardingProgreso,
  type PerfilFiscal,
} from '@copiloto/core';

import { almacenClave } from '../../../adapters/almacen';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { PantallaAfipSetup } from './PantallaAfipSetup';

const CUIT = '20123456786';
const CUIT_FORMATEADO = '20-12345678-6';

function perfilMock(over: Partial<PerfilFiscal> = {}): PerfilFiscal {
  return {
    cuit: CUIT,
    razonSocial: 'Panadería Ana',
    domicilioComercial: 'Av. Siempre Viva 742',
    condicionIva: 'monotributo',
    ingresosBrutos: '123456',
    inicioActividades: '2020-01-15',
    puntoVenta: 3,
    guardarEnDrive: false,
    ...over,
  };
}

function onboardingMock(over: Partial<OnboardingProgreso> = {}): OnboardingProgreso {
  return { paso: 'iniciado', motivo: null, wsAutorizados: [], terminado: false, ok: false, ...over };
}

function estadoOk(over: Partial<EstadoAfip> = {}): { status: 'ok' } & EstadoAfip {
  return {
    status: 'ok',
    conectado: false,
    wsAutorizados: [],
    perfilCompleto: false,
    puedeFacturar: false,
    onboarding: null,
    ...over,
  };
}

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaAfipSetup />
    </ThemeProvider>,
  );
}

/** Lleva el bloque "Conectar con ARCA" hasta el paso 3 (usuario + clave) -- pasa por el CUIT (paso 1)
 *  y la confirmación de identidad (paso 2). Deja al `screen` posicionado en paso 3. */
async function avanzarAPaso3() {
  await fireEvent.changeText(screen.getByTestId('afip-arca-cuit-input'), CUIT);
  await fireEvent.press(screen.getByTestId('afip-arca-paso-1-continuar'));
  await fireEvent.press(screen.getByTestId('afip-arca-paso-2-confirmar'));
}

describe('PantallaAfipSetup', () => {
  beforeEach(() => {
    jest.mocked(almacenClave.leer).mockReset().mockResolvedValue(null);
    jest.mocked(almacenClave.guardar).mockReset().mockResolvedValue(undefined);
    jest.mocked(leerPerfil).mockReset();
    jest.mocked(guardarPerfil).mockReset();
    jest.mocked(conectarArca).mockReset();
    jest.mocked(estadoAfip).mockReset().mockResolvedValue(estadoOk());
    jest.mocked(cambiarAmbiente).mockReset().mockResolvedValue({ ok: true });
    jest.mocked(guardarAjustesAfip).mockReset().mockResolvedValue({ ok: true, guardarEnDrive: true });
  });

  // -----------------------------------------------------------------------------------------
  // Bloque 4 — copia en Drive. El estado se toma del backend, nunca del toque del usuario.
  // -----------------------------------------------------------------------------------------
  describe('copia en Drive', () => {
    async function montarConPerfil(guardarEnDrive: boolean) {
      jest.mocked(almacenClave.leer).mockResolvedValue(CUIT);
      jest.mocked(leerPerfil).mockResolvedValue({ status: 'ok', perfil: perfilMock({ guardarEnDrive }) });
      await montar();
      await waitFor(() => expect(leerPerfil).toHaveBeenCalledWith(CUIT));
    }

    it('refleja el valor que vino en el perfil', async () => {
      await montarConPerfil(true);
      expect(screen.getByTestId('afip-drive-toggle')).toBeTruthy();
      // Con el ajuste prendido se advierte que hace falta Drive conectado en Apps.
      expect(screen.getByTestId('afip-drive-requiere-conexion')).toBeTruthy();
    });

    it('prenderlo manda el ajuste con el CUIT del perfil', async () => {
      await montarConPerfil(false);

      await fireEvent.press(screen.getByTestId('afip-drive-toggle-opcion-si'));

      await waitFor(() => expect(guardarAjustesAfip).toHaveBeenCalledWith(CUIT, true));
    });

    /**
     * 🔴 El caso que justifica que no haya actualización optimista. Un `UPDATE` sobre cero filas
     * "funciona" en SQL: si se pintara el toggle con lo que tocó el usuario, quedaría prendido en
     * pantalla sobre una base que no guardó nada, y el emprendedor creería tener sus facturas
     * archivándose. El 409 vuelve como VALOR justamente para poder distinguirlo.
     */
    it('el 409 no prende el toggle: explica que falta el perfil', async () => {
      await montarConPerfil(false);
      jest.mocked(guardarAjustesAfip).mockResolvedValueOnce({
        ok: false, sinPerfil: true, mensaje: 'todavía no cargaste tus datos fiscales para ese CUIT',
      });

      await fireEvent.press(screen.getByTestId('afip-drive-toggle-opcion-si'));

      await waitFor(() => expect(screen.getByTestId('afip-drive-sin-perfil')).toBeTruthy());
      // Y el aviso de "necesitás Drive conectado" NO aparece: el ajuste sigue apagado.
      expect(screen.queryByTestId('afip-drive-requiere-conexion')).toBeNull();
    });

    it('un error de red se dice, no se traga', async () => {
      await montarConPerfil(false);
      jest.mocked(guardarAjustesAfip).mockRejectedValueOnce(new Error('red'));

      await fireEvent.press(screen.getByTestId('afip-drive-toggle-opcion-si'));

      await waitFor(() => expect(screen.getByTestId('afip-drive-error')).toBeTruthy());
    });
  });

  // -----------------------------------------------------------------------------------------
  // Precarga del perfil.
  // -----------------------------------------------------------------------------------------
  it('precarga el perfil desde el CUIT cacheado al montar, y bloquea el CUIT', async () => {
    jest.mocked(almacenClave.leer).mockResolvedValue(CUIT);
    jest.mocked(leerPerfil).mockResolvedValue({ status: 'ok', perfil: perfilMock() });

    await montar();

    await waitFor(() => expect(leerPerfil).toHaveBeenCalledWith(CUIT));
    await waitFor(() => expect(screen.getByTestId('afip-perfil-cuit-fijo')).toHaveTextContent(CUIT_FORMATEADO));
    expect(screen.getByTestId('afip-perfil-razon-social-input').props.value).toBe('Panadería Ana');
    expect(screen.getByTestId('afip-perfil-domicilio-input').props.value).toBe('Av. Siempre Viva 742');
    expect(screen.getByTestId('afip-perfil-ingresos-brutos-input').props.value).toBe('123456');
    expect(screen.getByTestId('afip-perfil-punto-venta-input').props.value).toBe('3');
    // Bloqueado -- el CampoTexto editable del CUIT ya no está en el árbol.
    expect(screen.queryByTestId('afip-perfil-cuit-input')).toBeNull();
  });

  it('sin CUIT cacheado, el CUIT del perfil arranca editable y sin datos precargados', async () => {
    await montar();

    expect(screen.getByTestId('afip-perfil-cuit-input').props.value).toBe('');
    expect(screen.queryByTestId('afip-perfil-cuit-fijo')).toBeNull();
    expect(leerPerfil).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------------------------
  // 422 de guardarPerfil -- pinta el campo correcto.
  // -----------------------------------------------------------------------------------------
  it('un 422 de guardarPerfil pinta CADA campo con SU mensaje, código del backend sin traducir', async () => {
    jest.mocked(guardarPerfil).mockRejectedValueOnce(
      new ErrorValidacionFiscal([
        { codigo: 'razon_social_vacia', campo: 'razon_social', mensaje: 'La razón social es obligatoria' },
        { codigo: 'domicilio_vacio', campo: 'domicilio_comercial', mensaje: 'Falta el domicilio comercial' },
      ]),
    );

    await montar();
    await fireEvent.changeText(screen.getByTestId('afip-perfil-cuit-input'), CUIT);
    await fireEvent.press(screen.getByTestId('afip-perfil-guardar'));

    await waitFor(() =>
      expect(screen.getByTestId('afip-perfil-razon-social-error')).toHaveTextContent(
        'La razón social es obligatoria',
      ),
    );
    expect(screen.getByTestId('afip-perfil-domicilio-error')).toHaveTextContent('Falta el domicilio comercial');
    // Ningún otro campo se pinta -- el error es del CAMPO que lo trajo, no un banner genérico.
    expect(screen.queryByTestId('afip-perfil-ingresos-brutos-error')).toBeNull();
  });

  // -----------------------------------------------------------------------------------------
  // Flujo de 3 pasos de ARCA.
  // -----------------------------------------------------------------------------------------
  it('el flujo de ARCA NO muestra el campo de clave antes del paso 3', async () => {
    await montar();

    // Paso 1 -- sólo CUIT, sin clave.
    expect(screen.getByTestId('afip-arca-paso-1')).toBeTruthy();
    expect(screen.queryByTestId('afip-arca-clave-campo-input')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('afip-arca-cuit-input'), CUIT);
    await fireEvent.press(screen.getByTestId('afip-arca-paso-1-continuar'));

    // Paso 2 -- confirmación de identidad, todavía sin clave.
    expect(screen.getByTestId('afip-arca-paso-2')).toHaveTextContent(CUIT_FORMATEADO, { exact: false });
    expect(screen.queryByTestId('afip-arca-clave-campo-input')).toBeNull();

    await fireEvent.press(screen.getByTestId('afip-arca-paso-2-confirmar'));

    // Paso 3 -- recién ahí aparece la clave.
    expect(screen.getByTestId('afip-arca-clave-campo-input')).toBeTruthy();
    expect(screen.getByTestId('afip-arca-clave-aviso')).toHaveTextContent(
      'Tu clave fiscal no se guarda. Se usa una sola vez para vincular tu cuenta con ARCA y se descarta.',
    );
  });

  // -----------------------------------------------------------------------------------------
  // La clave fiscal NO sobrevive al submit.
  // -----------------------------------------------------------------------------------------
  it('la clave fiscal se limpia del estado apenas se envía -- no sobrevive al submit', async () => {
    jest.mocked(conectarArca).mockReturnValueOnce(new Promise(() => {})); // nunca resuelve en este test

    await montar();
    await avanzarAPaso3();

    await fireEvent.changeText(screen.getByTestId('afip-arca-usuario-input'), 'ana.emprendedora');
    await fireEvent.changeText(screen.getByTestId('afip-arca-clave-campo-input'), 'miClaveFiscalSecreta');
    await fireEvent.press(screen.getByTestId('afip-arca-vincular'));

    // Se mandó CON la clave real...
    expect(conectarArca).toHaveBeenCalledWith(
      expect.objectContaining({ cuit: CUIT, usuario: 'ana.emprendedora', claveFiscal: 'miClaveFiscalSecreta' }),
    );
    // ...pero el campo en pantalla (espejo del estado del componente) ya no la tiene.
    expect(screen.getByTestId('afip-arca-clave-campo-input').props.value).toBe('');
  });

  // -----------------------------------------------------------------------------------------
  // Polling: muestra el paso y PARA al terminar.
  // -----------------------------------------------------------------------------------------
  it('el polling muestra el paso real y se DETIENE cuando el onboarding termina', async () => {
    jest.useFakeTimers();
    try {
      jest.mocked(conectarArca).mockResolvedValueOnce({ status: 'ok', ok: true, workflowId: 'w1', mensaje: 'ok' });
      jest
        .mocked(estadoAfip)
        .mockResolvedValueOnce(estadoOk({ onboarding: onboardingMock({ paso: 'dando_de_alta' }) }))
        .mockResolvedValueOnce(
          estadoOk({ conectado: true, onboarding: onboardingMock({ paso: 'habilitado', terminado: true, ok: true }) }),
        );

      await montar();
      await avanzarAPaso3();
      await fireEvent.changeText(screen.getByTestId('afip-arca-usuario-input'), 'ana.emprendedora');
      await fireEvent.changeText(screen.getByTestId('afip-arca-clave-campo-input'), 'clave123');

      await act(async () => {
        await fireEvent.press(screen.getByTestId('afip-arca-vincular'));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByTestId('afip-arca-progreso-paso')).toHaveTextContent(
        'Dando de alta tu cuenta en el portal de ARCA',
        { exact: false },
      );

      await act(async () => {
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Terminó: ya no hay vista de progreso, y el bloque muestra el resumen "conectado".
      expect(screen.queryByTestId('afip-arca-progreso')).toBeNull();
      expect(screen.getByTestId('afip-arca-conectado')).toBeTruthy();
      expect(estadoAfip).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  // -----------------------------------------------------------------------------------------
  // El HECHO (hay credencial) gana sobre el RASTRO (cómo terminó el último intento).
  // -----------------------------------------------------------------------------------------
  it('un alta fallida NO tapa una vinculación que ya existe', async () => {
    // El caso real (2026-07-21): el operador estaba vinculado desde hacía horas, intentó un re-alta,
    // ARCA le rechazó la clave, y la pantalla pasó a mostrar SÓLO el error. Lo reportó como "me
    // figura como si estuviera desconectado de ARCA" -- y encima lo empujaba a reintentar un alta
    // que no necesitaba, gastando intentos contra el bloqueo de clave de ARCA.
    jest.mocked(almacenClave.leer).mockResolvedValue(CUIT);
    jest.mocked(leerPerfil).mockResolvedValue({ status: 'ok', perfil: perfilMock() });
    jest.mocked(estadoAfip).mockResolvedValue(
      estadoOk({
        conectado: true,
        ambiente: 'dev',
        perfilCompleto: true,
        puedeFacturar: true,
        onboarding: onboardingMock({ paso: 'fallido', terminado: true, motivo: 'se interrumpió' }),
      }),
    );

    await montar();

    // Manda el estado real...
    expect(await screen.findByTestId('afip-arca-conectado')).toBeTruthy();
    // ...y el fallo sigue estando, como nota secundaria: quien tipeó su clave merece saber que no
    // prendió. Esconderlo sería el error espejo del que se está arreglando.
    expect(screen.getByTestId('afip-arca-conectado-aviso-fallo')).toBeTruthy();
    // Lo que NO puede pasar: que el bloque quede tomado por la vista de error.
    expect(screen.queryByTestId('afip-arca-progreso-fallido')).toBeNull();
  });

  it('sin credencial, un alta fallida SÍ es el estado del bloque', async () => {
    // El control del test anterior: si el `!conectado` estuviera de más, este caso -- el usuario que
    // nunca se vinculó y cuyo primer intento falló -- se quedaría sin ver el error en ningún lado.
    jest.mocked(almacenClave.leer).mockResolvedValue(CUIT);
    jest.mocked(leerPerfil).mockResolvedValue({ status: 'ok', perfil: perfilMock() });
    jest.mocked(estadoAfip).mockResolvedValue(
      estadoOk({
        conectado: false,
        onboarding: onboardingMock({ paso: 'fallido', terminado: true, motivo: 'se interrumpió' }),
      }),
    );

    await montar();

    expect(await screen.findByTestId('afip-arca-progreso-fallido')).toBeTruthy();
    expect(screen.queryByTestId('afip-arca-conectado')).toBeNull();
  });

  // -----------------------------------------------------------------------------------------
  // Corte honesto a los 10 minutos.
  // -----------------------------------------------------------------------------------------
  it('corta el polling a los 10 minutos y ofrece reintentar -- nunca un spinner infinito', async () => {
    jest.useFakeTimers();
    try {
      jest.mocked(conectarArca).mockResolvedValueOnce({ status: 'ok', ok: true, workflowId: 'w1', mensaje: 'ok' });
      jest.mocked(estadoAfip).mockResolvedValue(estadoOk({ onboarding: onboardingMock({ paso: 'dando_de_alta' }) }));

      await montar();
      await avanzarAPaso3();
      await fireEvent.changeText(screen.getByTestId('afip-arca-usuario-input'), 'ana.emprendedora');
      await fireEvent.changeText(screen.getByTestId('afip-arca-clave-campo-input'), 'clave123');

      await act(async () => {
        await fireEvent.press(screen.getByTestId('afip-arca-vincular'));
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(10 * 60 * 1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByTestId('afip-arca-progreso-tardando')).toBeTruthy();
      expect(screen.getByTestId('afip-arca-reintentar')).toBeTruthy();
      // Nunca "terminado": el estado real seguía en `dando_de_alta` -- esto es un CORTE, no un éxito.
      expect(screen.queryByTestId('afip-arca-conectado')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  // -----------------------------------------------------------------------------------------
  // Bloque de ambiente -- modo degradado.
  // -----------------------------------------------------------------------------------------
  /**
   * 🔴 `ambientesVinculados` ausente significa **"no sé"**, no "no hay ninguno". La diferencia decide
   * si se muestra un selector o si la pantalla admite que no sabe — y mostrar un selector con
   * ambientes inventados llevaría al usuario a tocar un switch que después falla.
   */
  it('sin `ambientesVinculados` NO inventa un selector: dice que no sabe', async () => {
    // El mock por defecto (`estadoOk()`) no trae el campo.
    await montar();

    expect(screen.getByTestId('afip-ambiente-no-disponible')).toHaveTextContent(
      'Todavía no sabemos qué ambientes tenés vinculados',
      { exact: false },
    );
    expect(screen.queryByTestId('afip-ambiente-lista')).toBeNull();
  });

  it('con dos ambientes vinculados, el activo dice "Activo" y el otro se puede USAR', async () => {
    jest.mocked(almacenClave.leer).mockResolvedValue(CUIT);
    jest.mocked(leerPerfil).mockResolvedValue({ status: 'ok', perfil: perfilMock() });
    jest.mocked(estadoAfip).mockResolvedValue({
      ...estadoOk(),
      ambiente: 'dev',
      ambientesVinculados: ['dev', 'prod'],
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('afip-ambiente-lista')).toBeTruthy());
    expect(screen.getByTestId('afip-ambiente-dev')).toHaveTextContent('Activo', { exact: false });
    // 🔴 El no-activo tiene que ser TOCABLE. Una etiqueta muerta que diga "Vinculado" es
    // indistinguible de una función rota: el usuario ve que su otro ambiente existe y no encuentra
    // cómo pasarse a él.
    expect(screen.getByTestId('afip-ambiente-prod-usar')).toBeTruthy();
  });

  it('un ambiente NO vinculado ofrece vincularlo, no "usarlo"', async () => {
    jest.mocked(almacenClave.leer).mockResolvedValue(CUIT);
    jest.mocked(leerPerfil).mockResolvedValue({ status: 'ok', perfil: perfilMock() });
    jest.mocked(estadoAfip).mockResolvedValue({
      ...estadoOk(),
      ambiente: 'dev',
      ambientesVinculados: ['dev'],
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('afip-ambiente-lista')).toBeTruthy());
    expect(screen.getByTestId('afip-ambiente-prod-vincular')).toBeTruthy();
    expect(screen.queryByTestId('afip-ambiente-prod-usar')).toBeNull();
  });

  it('tocar "Usar este" llama a cambiarAmbiente con el ambiente elegido', async () => {
    jest.mocked(almacenClave.leer).mockResolvedValue(CUIT);
    jest.mocked(leerPerfil).mockResolvedValue({ status: 'ok', perfil: perfilMock() });
    jest.mocked(estadoAfip).mockResolvedValue({
      ...estadoOk(),
      ambiente: 'dev',
      ambientesVinculados: ['dev', 'prod'],
    });
    jest.mocked(cambiarAmbiente).mockResolvedValue({ ok: true });

    await montar();
    await waitFor(() => expect(screen.getByTestId('afip-ambiente-prod-usar')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('afip-ambiente-prod-usar'));

    await waitFor(() => expect(cambiarAmbiente).toHaveBeenCalledWith(CUIT, 'prod'));
  });
});
