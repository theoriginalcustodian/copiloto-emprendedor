import type { HttpPort, PeticionHttp, RespuestaHttp } from '@copiloto/core';

const BASE = process.env.EXPO_PUBLIC_API_BASE ?? '';

/**
 * `HttpPort` para cuando esta misma app Expo corre en navegador (`expo start --web`). La ÚNICA
 * diferencia con `http.native.ts` está en el multipart: acá el archivo llega como un `Blob` real
 * (igual que en `apps/copiloto-web`), y allá como `{uri, name, type}`. El resto -- JSON, headers, el
 * refresh-on-401 con single-flight -- vive en `@copiloto/core` y no se duplica acá.
 */
export const httpWeb: HttpPort = {
  async enviar(p: PeticionHttp): Promise<RespuestaHttp> {
    let body: string | FormData | undefined;

    if (p.multipart) {
      const form = new FormData();
      for (const [k, v] of Object.entries(p.multipart.campos)) form.append(k, v);
      const { nombre, datos } = p.multipart.archivo;
      // `archivo.datos` es OPACO para el core (`unknown`) A PROPÓSITO (para que `@copiloto/core` no
      // conozca la plataforma) -- eso significa que el compilador NO puede validar acá que quien
      // armó `ArchivoSubida` en la plataforma web realmente puso un Blob/File real en `datos`. El
      // precio del payload opaco se paga con esta verificación en runtime: sin ella, un `datos`
      // string (ej. la URI `blob:...` que `expo-document-picker` deja en `asset.uri` en vez del
      // `File` real de `asset.file` -- HIGH-1) hace que `FormData.append` tire un TypeError críptico
      // ("parameter 2 is not of type 'Blob'") y la request ni sale del navegador.
      if (!(datos instanceof Blob)) {
        throw new Error(
          `httpWeb.enviar: se esperaba un Blob/File real en archivo.datos para el multipart, se ` +
            `recibió ${typeof datos === 'string' ? `un string ("${datos}")` : typeof datos} en su lugar. ` +
            `¿El adaptador que arma ArchivoSubida en web está pasando un uri/id en vez del archivo real?`,
        );
      }
      form.append(p.multipart.campoArchivo, datos, nombre);
      body = form;
      // OJO: NO seteamos Content-Type a mano. El browser pone el boundary del multipart él mismo --
      // pisarlo rompe el parseo en el backend (ver `http.test.ts`).
    } else if (p.cuerpoJson !== undefined) {
      body = JSON.stringify(p.cuerpoJson);
    }

    const res = await fetch(`${BASE}${p.path}`, { method: p.metodo, headers: p.headers, body });
    return { ok: res.ok, status: res.status, json: () => res.json() };
  },
};

// 🔴 BUG REAL encontrado al verificar Task 10 en el navegador (no en los tests): `plataforma.ts`
// importaba `httpNativo` (nombrado) de `./http`. Metro resuelve `./http` a ESTE archivo en web, que
// nunca exportó `httpNativo` -- el import daba `undefined` y `configurarApi({ http: undefined, ... })`
// rompía cualquier llamada real (login, chat, etc.) en silencio hasta el primer click. El `export
// default` da un nombre IGUAL en `http.native.ts` y acá, así el import de `plataforma.ts` no depende
// de qué exports tiene cada lado -- sólo de que los dos exporten un default con el mismo `HttpPort`.
export default httpWeb;
