// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';

/**
 * Mock LOCAL que pisa el global de `jest.setup.js` -- mismo patrón que `useVozComando.test.ts`
 * (nombres con prefijo `mock` por `babel-plugin-jest-hoist`, ver su docstring).
 */
const mockRequestCameraPermissionsAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: (...args: unknown[]) => mockRequestCameraPermissionsAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestMediaLibraryPermissionsAsync(...args),
  launchCameraAsync: (...args: unknown[]) => mockLaunchCameraAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

import { useCapturaFoto } from './useCapturaFoto';

/** Simula al usuario tocando el botón `texto` de la última llamada a `Alert.alert`. */
function tocarBoton(texto: string) {
  const llamada = (Alert.alert as jest.Mock).mock.calls.at(-1);
  const botones = llamada?.[2] as { text: string; onPress?: () => void }[] | undefined;
  const boton = botones?.find((b) => b.text === texto);
  boton?.onPress?.();
}

// 🔴 `useCapturaFoto` no tiene `useState` propio -- `elegir()` es una `Promise` que sólo se resuelve
// cuando ALGO externo (acá, `tocarBoton`) dispara el `onPress` que guardó `Alert.alert`. No hay
// actualización de React que envolver: por eso NO se usa `act()`, a diferencia de `useVozComando`
// (que sí muta estado). `renderHook` SÍ se `await`ea -- RNTL14+React19 lo hizo async.
describe('useCapturaFoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    jest.spyOn(Alert, 'alert');
  });

  it('ofrece Cámara/Galería/Cancelar -- las tres opciones del contrato', async () => {
    const { result } = await renderHook(() => useCapturaFoto());
    void result.current.elegir();
    const [, , botones] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(botones.map((b: { text: string }) => b.text)).toEqual(['Cancelar', 'Cámara', 'Galería']);
  });

  it('Cámara: pide permiso de cámara (no de galería) y devuelve el archivo elegido', async () => {
    mockLaunchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/ticket.jpg', mimeType: 'image/jpeg' }],
    });
    const { result } = await renderHook(() => useCapturaFoto());

    const promesa = result.current.elegir();
    tocarBoton('Cámara');
    const archivo = await promesa;

    expect(mockRequestCameraPermissionsAsync).toHaveBeenCalled();
    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(archivo).toEqual({ nombre: 'ticket.jpg', mime: 'image/jpeg', datos: 'file:///cache/ticket.jpg' });
  });

  it('Galería: pide permiso de galería (no de cámara)', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/elegida.png', mimeType: 'image/png' }],
    });
    const { result } = await renderHook(() => useCapturaFoto());

    const promesa = result.current.elegir();
    tocarBoton('Galería');
    const archivo = await promesa;

    expect(mockRequestMediaLibraryPermissionsAsync).toHaveBeenCalled();
    expect(mockRequestCameraPermissionsAsync).not.toHaveBeenCalled();
    // `nombre` es fijo (`ticket.<ext>`), no derivado del archivo original -- el backend sólo lee
    // bytes + content-type (multipart), nunca el nombre. Ver `archivoDeResultado`.
    expect(archivo).toEqual({ nombre: 'ticket.png', mime: 'image/png', datos: 'file:///cache/elegida.png' });
  });

  it('🔴 permiso de cámara denegado: null + aviso legible, no revienta', async () => {
    mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    const { result } = await renderHook(() => useCapturaFoto());

    const promesa = result.current.elegir();
    tocarBoton('Cámara');
    const archivo = await promesa;

    expect(archivo).toBeNull();
    expect(mockLaunchCameraAsync).not.toHaveBeenCalled();
    // Segunda llamada a Alert.alert -- la primera es el picker Cámara/Galería, la segunda el aviso.
    expect((Alert.alert as jest.Mock).mock.calls[1]?.[0]).toMatch(/cámara/i);
  });

  it('Cancelar en el picker Cámara/Galería devuelve null sin pedir ningún permiso', async () => {
    const { result } = await renderHook(() => useCapturaFoto());

    const promesa = result.current.elegir();
    tocarBoton('Cancelar');
    const archivo = await promesa;

    expect(archivo).toBeNull();
    expect(mockRequestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it('el usuario cancela el picker nativo (assets: null) -- null, sin reventar', async () => {
    mockLaunchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
    const { result } = await renderHook(() => useCapturaFoto());

    const promesa = result.current.elegir();
    tocarBoton('Cámara');
    const archivo = await promesa;

    expect(archivo).toBeNull();
  });

  it('🔴 sin mimeType (algunos ContentProvider de Android) cae a image/jpeg, nunca revienta', async () => {
    mockLaunchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/sin-mime.jpg' }],
    });
    const { result } = await renderHook(() => useCapturaFoto());

    const promesa = result.current.elegir();
    tocarBoton('Cámara');
    const archivo = await promesa;

    expect(archivo).toEqual({ nombre: 'ticket.jpg', mime: 'image/jpeg', datos: 'file:///cache/sin-mime.jpg' });
  });
});
