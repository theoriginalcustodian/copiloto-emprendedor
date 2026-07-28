import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';

import { TIMEOUT_HTTP_MS } from '@copiloto/core';
import type { HttpPort, PeticionHttp, RespuestaHttp } from '@copiloto/core';

const BASE = process.env.EXPO_PUBLIC_API_BASE ?? '';

/**
 * `HttpPort` de React Native (ADR-010) -- el ÚNICO lugar de esta app que toca la red. El JSON, los
 * headers y el refresh-on-401 con single-flight viven en `@copiloto/core` y no se duplican acá.
 *
 * 🔴 **El multipart NO usa `fetch`, y no es una preferencia: con `fetch` no funciona.** Dos razones,
 * las dos verificadas en el teléfono real (2026-07-14):
 *
 * 1. **El recetario clásico de React Native está muerto.** Adjuntar `{uri, name, type}` al `FormData`
 *    --lo que dice toda la documentación de RN-- revienta con `Unsupported FormDataPart implementation`.
 *    Expo SDK 54 reemplaza el `fetch` global por el suyo (WinterCG), y su `convertFormData` lo declara
 *    textual: *"`uri` is not supported for React Native's FormData"*. Sólo acepta `string`, `Blob`, o un
 *    objeto con `.bytes()`.
 *
 * 2. **Y la salida obvia -- pasarle el `File` de `expo-file-system`, que sí tiene `.bytes()` -- rompería
 *    la invariante de ADR-008.** `bytes()` levanta el archivo ENTERO al heap de JS, y después
 *    `joinUint8Arrays` copia todo de nuevo para armar el cuerpo: **dos copias completas en memoria**.
 *    Una consulta de 40 minutos pesa ~46 MB (medido en el spike), así que serían ~92 MB de pico en un
 *    teléfono de 3 GB. El audio clínico **no entra a memoria**: por eso se graba en segmentos a disco.
 *    Subirlo por memoria sería reintroducir, en el último metro, justo el fallo que todo el diseño evita.
 *
 * `uploadAsync` sube el archivo **en nativo, streameando desde el disco**: cero bytes de audio en el
 * heap de JS, sin importar cuánto dure la consulta.
 */
export const httpNativo: HttpPort = {
  async enviar(p: PeticionHttp): Promise<RespuestaHttp> {
    const url = `${BASE}${p.path}`;

    if (p.multipart) {
      const { campos, campoArchivo, archivo } = p.multipart;
      // `datos` es la URI del archivo en disco (el core lo trata como opaco -- ver `ArchivoSubida`).
      const res = await uploadAsync(url, archivo.datos as string, {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: campoArchivo,
        mimeType: archivo.mime,
        parameters: campos,
        headers: p.headers,
      });
      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        // El nativo devuelve el cuerpo como texto. Un cuerpo vacío (204, o un error sin JSON) no puede
        // hacer explotar el parseo: el caller decide qué hacer con el `status`, no con un SyntaxError.
        json: async () => (res.body ? JSON.parse(res.body) : null),
      };
    }

    // 🔴 Un `fetch` sin timeout NO falla: cuelga. En el celular es el caso normal —cambio de wifi a
    // datos, ascensor, subte— y la promesa nunca resuelve ni rechaza: la pantalla queda con el
    // spinner puesto para siempre, sin error y sin nada que tocar salvo matar la app. El corte lo
    // traduce el core a un `ApiError` 408 (`enviarConCorte`), que las pantallas ya saben mostrar.
    const corteMs = p.timeoutMs ?? TIMEOUT_HTTP_MS;
    const controlador = new AbortController();
    const alarma = corteMs > 0 ? setTimeout(() => controlador.abort(), corteMs) : undefined;
    try {
      const res = await fetch(url, {
        method: p.metodo,
        headers: p.headers,
        body: p.cuerpoJson !== undefined ? JSON.stringify(p.cuerpoJson) : undefined,
        signal: controlador.signal,
      });
      return { ok: res.ok, status: res.status, json: () => res.json() };
    } finally {
      // Siempre: si la respuesta llegó a tiempo, el timer pendiente mantendría vivo el proceso (o
      // abortaría una request ya terminada) — y en RN un timer huérfano por request es una fuga.
      if (alarma !== undefined) clearTimeout(alarma);
    }
  },
};

// `export default` para que `plataforma.ts` importe UN SOLO nombre (`http`) que Metro resuelve por
// plataforma -- ver el bug real que esto corrige documentado en `http.web.ts`.
export default httpNativo;
