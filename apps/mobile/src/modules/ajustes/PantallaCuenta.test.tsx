import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/**
 * ⚠️ **Se preserva el resto del módulo con `requireActual`.** Antes esto devolvía **sólo** `router`, y
 * eso convierte al mock en una afirmación silenciosa: *«esta pantalla no usa nada más de
 * `expo-router`»*. Era cierto el día que se escribió y dejó de serlo cuando `MarcoGlass` —que esta
 * pantalla monta— pasó a usar `useFocusEffect`; el test murió con
 * `useFocusEffect is not a function`, que no describe ningún problema del producto.
 *
 * Un mock que reemplaza un módulo entero congela una suposición sobre las dependencias FUTURAS de
 * todo lo que la pantalla monta adentro. Se pisa lo que se necesita pisar y nada más.
 */
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn() },
  // Igual que el mock global (`jest.setup.js`): EJECUTA el callback, no lo ignora.
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
}));

// Prefijo `mock` obligatorio: es lo único que jest permite referenciar desde una factory de
// `jest.mock` (hoisting — la factory corre antes de las declaraciones del módulo).
const mockLogout = jest.fn();
const mockSesion = {
  estado: 'autenticado',
  me: { cliente_id: 'c-1', email: 'ana@negocio.test' } as { cliente_id: string; email: string | null },
  login: jest.fn(),
  logout: mockLogout,
};
jest.mock('../auth', () => ({ useSession: () => mockSesion }));

// SM-C4: el POST de aceptar es lo único del core que se pisa; el resto (descripcionLegal,
// ofrecerAceptarLegal, ApiError) es el REAL, así que el test ejercita la decisión de verdad.
const mockAceptarLegal = jest.fn();
jest.mock('@copiloto/core', () => ({
  ...jest.requireActual('@copiloto/core'),
  aceptarLegal: (version: string) => mockAceptarLegal(version),
}));

import { ApiError, LEGAL_VERSION } from '@copiloto/core';
import { router } from 'expo-router';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaCuenta } from './PantallaCuenta';

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaCuenta />
    </ThemeProvider>,
  );
}

describe('PantallaCuenta', () => {
  beforeEach(() => {
    mockLogout.mockClear();
    jest.mocked(router.push).mockClear();
    mockSesion.me = { cliente_id: 'c-1', email: 'ana@negocio.test' };
  });

  /**
   * 🔴 **Decir con qué cuenta estás adentro no es cosmético.** En este mismo proyecto el tenant con
   * el que entra el teléfono resultó ser distinto del que el operador creía (`pruebas-facturacion@`
   * en vez de su cuenta personal), y eso explicaba por qué el archivado en Drive no funcionaba. No
   * había forma de verlo desde la app: hubo que ir a la base de datos.
   */
  it('muestra el email real de la sesión', async () => {
    await montar();
    expect(screen.getByTestId('cuenta-email')).toHaveTextContent('ana@negocio.test');
  });

  /** Sin email se DICE; no se inventa un placeholder que parezca una dirección. */
  it('sin email no inventa uno', async () => {
    mockSesion.me = { cliente_id: 'c-1', email: null };
    await montar();
    expect(screen.getByTestId('cuenta-email')).toHaveTextContent('no tiene un email', { exact: false });
  });

  it('mapeo `cuenta`: «Avisos» + No molestar con chip «Pronto» y el motivo, y la nota bajo Cerrar sesión', async () => {
    await montar();
    expect(screen.getByTestId('cuenta-avisos-rotulo').props.children).toBe('Avisos');
    expect(screen.getByText('Silenciar los avisos de Odobi')).toBeTruthy();
    expect(screen.getByTestId('cuenta-no-molestar-pronto').props.children).toBe('Pronto');
    expect(screen.getByTestId('cuenta-no-molestar-nota')).toHaveTextContent('Lo estamos terminando con cuidado.', { exact: false });
    expect(screen.getByTestId('cuenta-cierre-nota')).toHaveTextContent(
      'Si cerrás sesión, tus datos quedan guardados: al volver a entrar está todo como lo dejaste.',
    );
    // La nota de cierre sólo está con el botón; con el panel de confirmación abierto no se duplica.
    await fireEvent.press(screen.getByTestId('cuenta-cerrar-sesion'));
    expect(screen.queryByTestId('cuenta-cierre-nota')).toBeNull();
  });

  /** Un toque accidental en una grilla de íconos no puede echarte de la sesión. */
  it('cerrar sesión pide confirmación antes de hacerlo', async () => {
    await montar();

    await fireEvent.press(screen.getByTestId('cuenta-cerrar-sesion'));

    expect(screen.getByTestId('cuenta-confirmar-salida')).toBeTruthy();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it.each([
    ['cuenta-legal-tos', '/legal?kind=tos'],
    ['cuenta-legal-privacidad', '/legal?kind=privacidad'],
  ])('%s navega a %s (BL-O6: mobile no tiene alta, el enlace vive en Mi cuenta)', async (testId, ruta) => {
    await montar();
    await fireEvent.press(screen.getByTestId(testId));
    expect(router.push).toHaveBeenCalledWith(ruta);
  });

  /**
   * BL-O6 «Informar» (v2): los CUATRO estados de la versión legal aceptada. El cuarto (campo ausente)
   * es el único que no se detecta mirando la pantalla, y NO puede leerse como «nunca aceptó».
   */
  describe('versión legal aceptada (LEGALVERMICUENTA)', () => {
    const base = { cliente_id: 'c-1', email: 'ana@negocio.test' };
    const estado = () => screen.getByTestId('cuenta-legal-version');

    it('estado 1: aceptó la vigente → muestra su número', async () => {
      mockSesion.me = { ...base, legal_aceptado: true, legal_version_aceptada: '2026-09-22' } as never;
      await montar();
      expect(estado()).toHaveTextContent('Aceptaste la versión vigente (2026-09-22).');
    });

    it('estado 2: aceptó una versión VIEJA → dice CUÁL y que ya no es la vigente', async () => {
      mockSesion.me = { ...base, legal_aceptado: false, legal_version_aceptada: '2026-06-01' } as never;
      await montar();
      expect(estado()).toHaveTextContent('Aceptaste la versión 2026-06-01, que ya no es la vigente.');
    });

    it('estado 3: nunca aceptó (null) → lo dice y NO muestra una versión', async () => {
      mockSesion.me = { ...base, legal_aceptado: false, legal_version_aceptada: null } as never;
      await montar();
      expect(estado()).toHaveTextContent('Todavía no aceptaste ninguna versión.');
      expect(estado()).not.toHaveTextContent('Aceptaste');
    });

    it('🐤 estado 4: campo AUSENTE (backend viejo) NO se confunde con «nunca aceptó»', async () => {
      mockSesion.me = { ...base, legal_aceptado: true } as never;
      await montar();
      expect(estado()).toHaveTextContent('No pudimos verificar qué versión aceptaste.');
      expect(estado()).not.toHaveTextContent('Todavía no aceptaste');
    });
  });

  /**
   * SM-C4 — el botón «Aceptar». Mobile no tiene alta, así que acá es donde una cuenta que entró por
   * Google registra la aceptación. Es una OFERTA: INFORMA, no bloquea (LEGALNOOPERA).
   */
  describe('aceptar la versión vigente (SM-C4)', () => {
    const base = { cliente_id: 'c-1', email: 'ana@negocio.test' };
    const boton = () => screen.queryByTestId('cuenta-legal-aceptar');

    beforeEach(() => mockAceptarLegal.mockReset());

    it('ya aceptó la vigente → NO se ofrece el botón', async () => {
      mockSesion.me = { ...base, legal_aceptado: true, legal_version_aceptada: LEGAL_VERSION } as never;
      await montar();
      expect(boton()).toBeNull();
    });

    it('🐤 campo ausente (backend viejo) → NO se ofrece: no se sabe si hace falta', async () => {
      mockSesion.me = { ...base, legal_aceptado: true } as never;
      await montar();
      expect(boton()).toBeNull();
    });

    it('nunca aceptó → se ofrece, registra LEGAL_VERSION y el estado pasa a «vigente»', async () => {
      mockSesion.me = { ...base, legal_aceptado: false, legal_version_aceptada: null } as never;
      mockAceptarLegal.mockResolvedValue({ aceptado: true, version: LEGAL_VERSION, en: '2026-10-15T12:00:00Z' });
      await montar();
      expect(screen.getByTestId('cuenta-legal-version')).toHaveTextContent('Todavía no aceptaste ninguna versión.');

      fireEvent.press(screen.getByTestId('cuenta-legal-aceptar'));

      await waitFor(() =>
        expect(screen.getByTestId('cuenta-legal-version')).toHaveTextContent(
          `Aceptaste la versión vigente (${LEGAL_VERSION}).`,
        ),
      );
      expect(mockAceptarLegal).toHaveBeenCalledTimes(1);
      expect(mockAceptarLegal).toHaveBeenCalledWith(LEGAL_VERSION);
      expect(boton()).toBeNull();
    });

    it('aceptó una versión VIEJA → también se ofrece', async () => {
      mockSesion.me = { ...base, legal_aceptado: false, legal_version_aceptada: '2026-06-01' } as never;
      await montar();
      expect(boton()).not.toBeNull();
    });

    it('INFORMA, no bloquea: sin aceptar, el resto de la pantalla opera igual', async () => {
      mockSesion.me = { ...base, legal_aceptado: false, legal_version_aceptada: null } as never;
      await montar();
      fireEvent.press(screen.getByTestId('cuenta-legal-tos'));
      expect(router.push).toHaveBeenCalledWith('/legal?kind=tos');
      expect(screen.getByTestId('cuenta-cerrar-sesion')).toBeTruthy();
    });

    it('409 (el texto quedó viejo) → lo dice, NO marca aceptada y deja reintentar', async () => {
      mockSesion.me = { ...base, legal_aceptado: false, legal_version_aceptada: null } as never;
      mockAceptarLegal.mockRejectedValue(new ApiError(409, 'versión desactualizada', 'legal_version_desactualizada', {}));
      await montar();

      fireEvent.press(screen.getByTestId('cuenta-legal-aceptar'));

      await waitFor(() => expect(screen.getByTestId('cuenta-legal-aceptar-error')).toBeTruthy());
      expect(screen.getByTestId('cuenta-legal-aceptar-error')).toHaveTextContent(/Los términos cambiaron/);
      expect(screen.getByTestId('cuenta-legal-version')).toHaveTextContent('Todavía no aceptaste ninguna versión.');
      expect(boton()).not.toBeNull();
    });

    it('falla de red → mensaje genérico, sin marcar aceptada', async () => {
      mockSesion.me = { ...base, legal_aceptado: false, legal_version_aceptada: null } as never;
      mockAceptarLegal.mockRejectedValue(new Error('network'));
      await montar();

      fireEvent.press(screen.getByTestId('cuenta-legal-aceptar'));

      await waitFor(() => expect(screen.getByTestId('cuenta-legal-aceptar-error')).toBeTruthy());
      expect(screen.getByTestId('cuenta-legal-aceptar-error')).toHaveTextContent(/No pudimos registrar/);
      expect(boton()).not.toBeNull();
    });
  });

  it('confirmar cierra la sesión; decir que no, no', async () => {
    await montar();

    await fireEvent.press(screen.getByTestId('cuenta-cerrar-sesion'));
    await fireEvent.press(screen.getByTestId('cuenta-cerrar-sesion-no'));
    expect(mockLogout).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('cuenta-cerrar-sesion'));
    await fireEvent.press(screen.getByTestId('cuenta-cerrar-sesion-si'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
