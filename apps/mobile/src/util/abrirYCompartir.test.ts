/**
 * `Linking.openURL` y `Share.share` RECHAZAN, y nadie los estaba escuchando.
 *
 * Los botones «Guardar»/«Compartir» hacían `await Linking.openURL(link)` sin `catch`. Si el link vino
 * roto, o el teléfono no tiene con qué abrirlo, la promesa rechaza y queda como unhandled rejection:
 * caja roja en desarrollo y **nada** en producción. Para el emprendedor es un botón que no hace nada
 * — lo toca tres veces y concluye que su factura no está.
 */
import { Alert, Linking, Share } from 'react-native';

import { abrirLink, compartirLink } from './abrirYCompartir';

// `spyOn` y NO `jest.mock('react-native', ...)`: reemplazar el módulo entero rompe el preset de
// jest-expo, que necesita el `Platform` real para inicializarse (`Platform.select` de
// `expo-modules-core`). Sólo se interceptan las tres funciones que este helper usa.
const alertMock = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const openURLMock = jest.spyOn(Linking, 'openURL');
const shareMock = jest.spyOn(Share, 'share');

beforeEach(() => {
  alertMock.mockClear();
  openURLMock.mockReset();
  shareMock.mockReset();
});

describe('abrirLink', () => {
  it('EL QUE IMPORTA: si no se puede abrir, el usuario se entera', async () => {
    openURLMock.mockRejectedValueOnce(new Error('No Activity found to handle Intent'));

    await expect(abrirLink('https://roto', 'tu factura')).resolves.toBe(false);

    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(alertMock.mock.calls[0][0]).toContain('tu factura');
  });

  it('control: cuando abre bien no molesta con ningún cartel', async () => {
    openURLMock.mockResolvedValueOnce(undefined);

    await expect(abrirLink('https://ok')).resolves.toBe(true);

    expect(alertMock).not.toHaveBeenCalled();
  });

  it('no re-lanza: un botón que no puede cumplir avisa, no tumba la pantalla', async () => {
    openURLMock.mockRejectedValueOnce(new Error('x'));

    // Si esto lanzara, el `await` del handler del botón quedaría sin catch otra vez — el bug entero.
    await expect(abrirLink('https://roto')).resolves.toBe(false);
  });
});

describe('compartirLink', () => {
  it('si compartir falla, avisa', async () => {
    shareMock.mockRejectedValueOnce(new Error('share failed'));

    await expect(compartirLink('https://x', 'el presupuesto')).resolves.toBe(false);

    expect(alertMock.mock.calls[0][0]).toContain('el presupuesto');
  });

  it('CANCELAR no es un error: cerrar la hoja no puede acusar de fallo al usuario', async () => {
    // En iOS cerrar la hoja RESUELVE con `dismissedAction` — no rechaza. Si tratáramos ese caso como
    // fallo, cada vez que alguien se arrepiente de compartir vería un cartel de error.
    shareMock.mockResolvedValueOnce({ action: 'dismissedAction' });

    await expect(compartirLink('https://x')).resolves.toBe(true);

    expect(alertMock).not.toHaveBeenCalled();
  });
});
