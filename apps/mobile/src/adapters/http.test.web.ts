import { httpWeb } from './http.web';

/**
 * `describe`/`it`/`expect`/`jest` son globales bajo el preset `jest-expo/web` (proyecto
 * `web-storage-spike` en `package.json`) -- jsdom REAL (`Blob`/`File`/`FormData` reales, no
 * mocks propios). Mismo criterio que `almacen.test.web.ts`: el bug de HIGH-1 sólo aparece contra
 * el `FormData`/`Blob` de un navegador de verdad, no contra un doble en memoria.
 *
 * `http.test.ts` (proyecto `native`) ya cubre el multipart de `http.native.ts` -- este archivo
 * cubre la ÚNICA diferencia real: acá `archivo.datos` tiene que ser un `Blob`/`File` real, no
 * un `{uri, name, type}`.
 */
describe('httpWeb (jest-expo/web, jsdom real) -- regresión HIGH-1', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: 1 }) });
  });

  it('adjunta un File/Blob real al FormData multipart', async () => {
    const archivoReal = new File(['contenido de prueba'], 'informe.pdf', { type: 'application/pdf' });

    await httpWeb.enviar({
      metodo: 'POST',
      path: '/documentos',
      headers: {},
      multipart: {
        campos: { session_id: 's1', paciente_id: 'p1' },
        campoArchivo: 'archivo',
        archivo: { nombre: 'informe.pdf', mime: 'application/pdf', datos: archivoReal },
      },
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    const enviado = (init.body as FormData).get('archivo');
    expect(enviado).toBeInstanceOf(File);
    expect((enviado as File).name).toBe('informe.pdf');
  });

  it('el guard lanza con un mensaje claro si `datos` NO es un Blob/File (el bug real: la uri `blob:` de expo-document-picker.web)', async () => {
    await expect(
      httpWeb.enviar({
        metodo: 'POST',
        path: '/documentos',
        headers: {},
        multipart: {
          campos: {},
          campoArchivo: 'archivo',
          // Esto es exactamente lo que HIGH-1 mandaba antes del fix: `asset.uri`, un string
          // `blob:...`, en vez del `File` real de `asset.file`.
          archivo: { nombre: 'informe.pdf', mime: 'application/pdf', datos: 'blob:http://localhost/fake-uri' },
        },
      }),
    ).rejects.toThrow(/Blob\/File real/);

    // El guard corta ANTES de tocar la red -- ni siquiera llega a armar el fetch.
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
