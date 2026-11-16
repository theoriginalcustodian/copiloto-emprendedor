import type { HttpPort, PeticionHttp, RespuestaHttp } from '@copiloto/core';

import { demoActivo, HAY_MODO_DEMO } from './modoDemo';
import { respuestaDemo } from './respuestasDemo';

/** ⚠️ MODO DEMO — sólo en desarrollo. Ver `modoDemo.ts`. */

function respuesta(status: number, cuerpo: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(cuerpo) };
}

/** Un instante de espera, para que los estados de carga se alcancen a ver como con red de verdad. */
function pausa(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 180);
  });
}

async function responder(p: PeticionHttp): Promise<RespuestaHttp> {
  await pausa();
  const path = p.path.split('?')[0] ?? p.path;

  if (p.metodo !== 'GET') {
    // Nada se guarda: ni en el servidor ni en un doble. Una escritura que «anduviera» mentiría sobre lo que pasó.
    return respuesta(503, { detail: 'Modo demo: acá no se guarda nada. Apagalo en Ajustes para usar tu cuenta.' });
  }
  // El hilo del chat es el sembrado; no hay respuestas nuevas que traer.
  if (path === '/reply') {
    const desde = Number(new URLSearchParams(p.path.split('?')[1] ?? '').get('after_id') ?? 0);
    return respuesta(200, { replies: [], next_id: Number.isFinite(desde) ? desde : 0 });
  }
  const cuerpo = respuestaDemo(p);
  // Sin ejemplo para ese pedido no se cae al servidor: mezclaría datos reales con los de muestra.
  if (cuerpo === undefined) return respuesta(404, { detail: 'Modo demo: sin datos de ejemplo para esto.' });
  return respuesta(200, cuerpo);
}

/**
 * Envuelve el puerto de red real: con el modo demo prendido contesta con datos de ejemplo, apagado deja pasar
 * todo tal cual. La sesión (`/auth/*`) va siempre al servidor: el modo no cierra ni cambia la cuenta.
 */
export function conModoDemo(real: HttpPort): HttpPort {
  if (!HAY_MODO_DEMO) return real;
  return {
    async enviar(p: PeticionHttp): Promise<RespuestaHttp> {
      if (p.path.startsWith('/auth/') || !(await demoActivo())) return real.enviar(p);
      const res = await responder(p);
      // Rastro en la consola de Metro: qué se pidió y si hubo ejemplo para eso.
      if (!res.ok) console.log('[modo demo] sin ejemplo', p.metodo, p.path, res.status);
      return res;
    },
  };
}
