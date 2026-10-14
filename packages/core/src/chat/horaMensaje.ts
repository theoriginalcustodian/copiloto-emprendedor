import type { ChatMessage, SendStatus } from './chatMachine';

/**
 * La hora de un mensaje del chat en una línea corta («9:12», «21:05»), del reloj del dispositivo — el
 * `10:12` de la meta «10:12 ✓✓ recibido» del prototipo (`index.html:2164`, `:3192`).
 *
 * `undefined`/inválido → `null`: el historial persistido antes de BL-C3 no trae `creadoEn`, y ahí la meta
 * dice sólo «✓✓ recibido» en vez de inventar una hora. Sin `Intl`, por la misma razón que `fechaMiDia.ts`
 * (las dos plataformas tienen que mostrar IDÉNTICO).
 */
export function formatearHoraDeMensaje(creadoEnMs: number | undefined | null): string | null {
  if (typeof creadoEnMs !== 'number' || !Number.isFinite(creadoEnMs)) return null;
  const d = new Date(creadoEnMs);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * El id del mensaje PROPIO que todavía no se puede dar por recibido, o `null` si todos lo están
 * (fact-voz d, la meta «✓✓ recibido» del prototipo).
 *
 * «Recibido» es una afirmación sobre el servidor: sólo es verdad cuando `POST /chat` lo aceptó. El mensaje
 * del usuario entra al hilo de forma optimista (antes del POST), así que mientras el envío está en vuelo
 * (`sending`) o falló (`error`, y el mensaje queda con el botón de reintento) escribir «recibido» sería
 * mentirle. Después del `envio_ok` (`waiting`) el mensaje ya llegó aunque la respuesta tarde (`timeout`).
 *
 * Sólo el ÚLTIMO mensaje propio puede estar sin confirmar: `sendStatus` describe UN envío, el más reciente;
 * los anteriores ya pasaron por un `envio_ok` (o no habría un envío posterior).
 */
export function idMensajeSinConfirmar(
  messages: readonly Pick<ChatMessage, 'id' | 'role'>[],
  sendStatus: SendStatus | undefined,
): string | null {
  if (sendStatus !== 'sending' && sendStatus !== 'error') return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') return messages[i]!.id;
  }
  return null;
}
