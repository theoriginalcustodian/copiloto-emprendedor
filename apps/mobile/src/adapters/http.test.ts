import { uploadAsync } from 'expo-file-system/legacy';

import { httpNativo } from './http.native';

jest.mock('expo-file-system/legacy', () => ({
  FileSystemUploadType: { MULTIPART: 1, BINARY_CONTENT: 0 },
  uploadAsync: jest.fn(),
}));

/**
 * `describe`/`it`/`expect`/`jest` son globales bajo el preset `jest-expo` (runner Jest, NO Vitest --
 * no importar nada de `vitest` acá).
 *
 * Import explícito a `./http.native` (no `./http`): el preset `jest-expo` por defecto corre bajo
 * plataforma nativa, así que `./http` ya resolvería a `http.native.ts` solo -- pero lo hacemos
 * explícito para que el test no dependa de esa resolución implícita de Metro/Jest.
 */
describe('httpNativo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: 1 }) });
    (uploadAsync as jest.Mock).mockResolvedValue({ status: 200, headers: {}, body: '{"transcript":"S1: hola"}' });
  });

  it('manda JSON con su Content-Type', async () => {
    await httpNativo.enviar({
      metodo: 'POST',
      path: '/chat',
      headers: { 'Content-Type': 'application/json' },
      cuerpoJson: { a: 1 },
    });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.body).toBe('{"a":1}');
  });

  /**
   * 🔴 El multipart NO puede pasar por `fetch`, y este test lo fija. Dos cosas se rompían a la vez, las
   * dos medidas en un Samsung real (2026-07-14):
   *
   * - Con `fetch` + `FormData.append({uri, name, type})` --el recetario de React Native-- la subida
   *   explota con `Unsupported FormDataPart implementation`: el `fetch` de Expo SDK 54 (WinterCG) NO
   *   acepta URIs.
   * - Y la salida obvia (mandarle el `File` de expo-file-system, que sí tiene `.bytes()`) levantaría los
   *   ~46 MB de una consulta de 40 min al heap de JS, y los copiaría otra vez para armar el cuerpo.
   *
   * `uploadAsync` sube desde el disco, en nativo. Si alguien vuelve a `fetch` acá, este test se cae --
   * que es el punto: el audio clínico no vuelve a memoria nunca.
   */
  it('el multipart sube por uploadAsync (nativo, desde disco) y NUNCA por fetch', async () => {
    await httpNativo.enviar({
      metodo: 'POST',
      path: '/nota/audio',
      headers: { Authorization: 'Bearer t' },
      multipart: {
        campos: { session_id: 's1', paciente_id: 'p1', sha256: 'abc' },
        campoArchivo: 'audio',
        archivo: { nombre: 'nota.m4a', mime: 'audio/mp4', datos: 'file:///nota.m4a' },
      },
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(uploadAsync).toHaveBeenCalledWith(
      expect.stringContaining('/nota/audio'),
      'file:///nota.m4a', // la URI, no los bytes
      expect.objectContaining({
        uploadType: 1, // MULTIPART
        fieldName: 'audio',
        mimeType: 'audio/mp4',
        parameters: { session_id: 's1', paciente_id: 'p1', sha256: 'abc' },
        headers: { Authorization: 'Bearer t' },
      }),
    );
  });

  it('la respuesta del multipart se parsea igual que la de fetch (el core no sabe la diferencia)', async () => {
    const res = await httpNativo.enviar({
      metodo: 'POST',
      path: '/consulta/audio',
      headers: {},
      multipart: {
        campos: {},
        campoArchivo: 'audio',
        archivo: { nombre: 'c.m4a', mime: 'audio/mp4', datos: 'file:///c.m4a' },
      },
    });

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ transcript: 'S1: hola' });
  });

  it('un 4xx del multipart NO revienta al parsear un cuerpo vacío -- el caller decide por el status', async () => {
    (uploadAsync as jest.Mock).mockResolvedValue({ status: 422, headers: {}, body: '' });

    const res = await httpNativo.enviar({
      metodo: 'POST',
      path: '/consulta/audio',
      headers: {},
      multipart: {
        campos: {},
        campoArchivo: 'audio',
        archivo: { nombre: 'c.m4a', mime: 'audio/mp4', datos: 'file:///c.m4a' },
      },
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toBeNull();
  });
});
