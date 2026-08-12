import { describe, expect, it } from 'vitest';

import {
  construirEnvioClinico,
  hidratarEstado,
  MAX_MENSAJES_HISTORIAL,
  reducirChat,
  type ChatMessage,
  type EstadoChat,
  type EventoChat,
} from './chatMachine';
import type { ChatContenido } from '../api/types';
import { mapearGate } from './hitl';

/**
 * Estos tests prueban el reducer AISLADO de red/timers/storage: cada evento es la traducción pura de
 * "algo pasó" (el usuario tipeó, la red respondió, el timeout venció) al estado siguiente. Ninguno
 * llama `fetch` ni toca `localStorage`/`AsyncStorage` — esa orquestación queda para el hook de
 * efectos de cada app.
 */

const SESSION = 'sess-1';

function estadoBase(): EstadoChat {
  return hidratarEstado(SESSION);
}

function correr(estado: EstadoChat, ...eventos: EventoChat[]): EstadoChat {
  return eventos.reduce(reducirChat, estado);
}

describe('mensaje de usuario optimista', () => {
  it('se agrega a `messages` de inmediato, antes de que la red responda', () => {
    const mensaje: ChatMessage = { id: 'user-1', role: 'user', text: 'hola' };
    const estado = correr(
      estadoBase(),
      { tipo: 'mensaje_usuario_agregado', mensaje },
      { tipo: 'envio_iniciado' },
    );

    expect(estado.messages).toEqual([mensaje]);
    expect(estado.sendStatus).toBe('sending');
  });

  it('un fallo de red pasa a error SIN perder el mensaje ya agregado', () => {
    const mensaje: ChatMessage = { id: 'user-1', role: 'user', text: 'hola' };
    const estado = correr(
      estadoBase(),
      { tipo: 'mensaje_usuario_agregado', mensaje },
      { tipo: 'envio_iniciado' },
      { tipo: 'envio_fallo' },
    );

    expect(estado.sendStatus).toBe('error');
    expect(estado.messages).toEqual([mensaje]);
  });

  it('sendAudio: el mensaje se agrega DESPUÉS de conocer el transcript, el status ya venía en sending', () => {
    // A diferencia de `send`, `sendAudio` no puede mostrar el mensaje de forma optimista (no se sabe
    // qué dijo hasta que el STT responde) — el caller manda `envio_iniciado` ANTES de la red y
    // `mensaje_usuario_agregado` recién con el transcript ya resuelto.
    const transcript: ChatMessage = { id: 'user-2', role: 'user', text: 'nota dictada' };
    const estado = correr(
      estadoBase(),
      { tipo: 'envio_iniciado' },
      { tipo: 'mensaje_usuario_agregado', mensaje: transcript },
      { tipo: 'envio_ok' },
    );

    expect(estado.messages).toEqual([transcript]);
    expect(estado.sendStatus).toBe('waiting');
  });
});

describe('una respuesta con `card` dispara el gate correcto', () => {
  it('un reply confirmar/cancelar se clasifica y mapea a un Gate con los `value` correctos', () => {
    const estado = correr(estadoBase(), {
      tipo: 'respuestas_recibidas',
      nextId: 5,
      replies: [
        {
          id: 5,
          text: '# Nota\n\nCliente refiere seguimiento pendiente.',
          choices: [
            { label: 'Confirmar', value: 'confirm:0:0' },
            { label: 'Cancelar', value: 'cancel:0:0' },
          ],
          card: { kind: 'confirm', service: '', label: '' },
        },
      ],
    });

    expect(estado.messages).toHaveLength(1);
    const [mensaje] = estado.messages;
    const gate = mapearGate(mensaje!);

    expect(gate).not.toBeNull();
    expect(gate?.markdown).toBe('# Nota\n\nCliente refiere seguimiento pendiente.');
    expect(gate?.confirmLabel).toBe('Confirmar');
    expect(gate?.cancelLabel).toBe('Cancelar');
    expect(gate?.confirmValue).toBe('confirm:0:0');
    expect(gate?.cancelValue).toBe('cancel:0:0');
    expect(estado.sendStatus).toBe('idle');
  });

  it('un reply sin choices no dispara ningún gate', () => {
    const estado = correr(estadoBase(), {
      tipo: 'respuestas_recibidas',
      nextId: 1,
      replies: [{ id: 1, text: 'Listo, quedó guardado.' }],
    });

    const [mensaje] = estado.messages;
    expect(mapearGate(mensaje!)).toBeNull();
  });

  it('choices de desambiguación (no confirmar/cancelar) tampoco son un gate', () => {
    const estado = correr(estadoBase(), {
      tipo: 'respuestas_recibidas',
      nextId: 2,
      replies: [
        {
          id: 2,
          text: '¿Cuál cliente?',
          choices: [
            { label: 'Juan Pérez', value: 'juan_perez' },
            { label: 'Juan Gómez', value: 'juan_gomez' },
          ],
        },
      ],
    });

    const [mensaje] = estado.messages;
    expect(mapearGate(mensaje!)).toBeNull();
  });
});

describe('dedup — un `after_id` viejo no duplica mensajes', () => {
  it('un reply ya visto no se vuelve a agregar, aunque el servidor lo repita', () => {
    const conHistorial = correr(estadoBase(), {
      tipo: 'respuestas_recibidas',
      nextId: 3,
      replies: [{ id: 3, text: 'primera respuesta' }],
    });
    expect(conHistorial.messages).toHaveLength(1);

    // El servidor repite el id=3 (ej. una carrera de polling) junto con uno nuevo real.
    const trasRepeticion = reducirChat(conHistorial, {
      tipo: 'respuestas_recibidas',
      nextId: 4,
      replies: [
        { id: 3, text: 'primera respuesta' },
        { id: 4, text: 'segunda respuesta' },
      ],
    });

    expect(trasRepeticion.messages).toHaveLength(2);
    expect(trasRepeticion.messages.map((m) => m.text)).toEqual(['primera respuesta', 'segunda respuesta']);
  });

  it('un poll vacío avanza el cursor pero no toca `messages` ni `sendStatus`', () => {
    const esperando: EstadoChat = { ...estadoBase(), sendStatus: 'waiting' };
    const estado = reducirChat(esperando, { tipo: 'respuestas_recibidas', nextId: 10, replies: [] });

    expect(estado.messages).toEqual([]);
    expect(estado.nextId).toBe(10);
    expect(estado.sendStatus).toBe('waiting');
  });
});

describe('rehidratación — una sesión existente no pierde los mensajes previos', () => {
  it('`hidratarEstado` siembra `messages` y calcula el cursor desde el historial persistido', () => {
    const persistidos: ChatMessage[] = [
      { id: 'user-1', role: 'user', text: 'hola' },
      { id: 'assistant-7', role: 'assistant', text: 'hola, ¿en qué te ayudo?' },
    ];

    const estado = hidratarEstado(SESSION, persistidos);

    expect(estado.messages).toEqual(persistidos);
    expect(estado.nextId).toBe(7); // el mayor id de assistant visto, NO 0
    expect(estado.sendStatus).toBe('idle');
  });

  it('sin historial, el cursor arranca en 0', () => {
    expect(hidratarEstado(SESSION).nextId).toBe(0);
    expect(hidratarEstado(SESSION).messages).toEqual([]);
  });

  it('el primer poll tras rehidratar (durabilidad real) no duplica el mensaje que ya estaba en pantalla', () => {
    const persistidos: ChatMessage[] = [{ id: 'assistant-7', role: 'assistant', text: 'ya visto' }];
    const rehidratado = hidratarEstado(SESSION, persistidos);

    // El servidor devuelve de nuevo el id=7 (llegó mientras el chat estaba desmontado) + uno nuevo.
    const estado = reducirChat(rehidratado, {
      tipo: 'respuestas_recibidas',
      nextId: 8,
      replies: [
        { id: 7, text: 'ya visto' },
        { id: 8, text: 'nuevo tras reabrir' },
      ],
    });

    expect(estado.messages).toHaveLength(2);
    expect(estado.messages.map((m) => m.text)).toEqual(['ya visto', 'nuevo tras reabrir']);
  });
});

describe('timeout', () => {
  it('sólo degrada `waiting` -> `timeout`, nunca pisa un estado más reciente', () => {
    const esperando: EstadoChat = { ...estadoBase(), sendStatus: 'waiting' };
    expect(reducirChat(esperando, { tipo: 'tiempo_agotado' }).sendStatus).toBe('timeout');

    const yaIdle: EstadoChat = { ...estadoBase(), sendStatus: 'idle' };
    expect(reducirChat(yaIdle, { tipo: 'tiempo_agotado' }).sendStatus).toBe('idle');

    const enviandoDeNuevo: EstadoChat = { ...estadoBase(), sendStatus: 'sending' };
    expect(reducirChat(enviandoDeNuevo, { tipo: 'tiempo_agotado' }).sendStatus).toBe('sending');
  });
});

describe('nueva sesión', () => {
  it('resetea mensajes, cursor y dedupe, y adopta el session_id nuevo', () => {
    const conHistorial = correr(estadoBase(), {
      tipo: 'respuestas_recibidas',
      nextId: 3,
      replies: [{ id: 3, text: 'algo' }],
    });

    const estado = reducirChat(conHistorial, { tipo: 'nueva_sesion', sessionId: 'sess-2' });

    expect(estado.sessionId).toBe('sess-2');
    expect(estado.messages).toEqual([]);
    expect(estado.nextId).toBe(0);
    expect(estado.seenIds).toEqual([]);
    expect(estado.sendStatus).toBe('idle');
  });
});

describe('cota de historial (C6) — messages y seenIds no crecen sin techo', () => {
  it('`messages` queda acotado a MAX_MENSAJES_HISTORIAL tras recibir más respuestas que la cota', () => {
    let estado = estadoBase();
    const total = MAX_MENSAJES_HISTORIAL + 50;
    for (let id = 1; id <= total; id += 1) {
      estado = reducirChat(estado, {
        tipo: 'respuestas_recibidas',
        nextId: id,
        replies: [{ id, text: `reply ${id}` }],
      });
    }

    expect(estado.messages).toHaveLength(MAX_MENSAJES_HISTORIAL);
    expect(estado.seenIds).toHaveLength(MAX_MENSAJES_HISTORIAL);
    // Se conservan los MÁS RECIENTES, no los primeros — un usuario que vuelve ve la cola de la
    // conversación, no un historial congelado en el arranque.
    expect(estado.messages[0]!.text).toBe(`reply ${total - MAX_MENSAJES_HISTORIAL + 1}`);
    expect(estado.messages.at(-1)!.text).toBe(`reply ${total}`);
    expect(estado.nextId).toBe(total);
  });

  it('`messages` también queda acotado por `mensaje_usuario_agregado` (sin pasar por respuestas_recibidas)', () => {
    let estado = estadoBase();
    const total = MAX_MENSAJES_HISTORIAL + 20;
    for (let i = 1; i <= total; i += 1) {
      estado = reducirChat(estado, {
        tipo: 'mensaje_usuario_agregado',
        mensaje: { id: `user-${i}`, role: 'user', text: `msg ${i}` },
      });
    }

    expect(estado.messages).toHaveLength(MAX_MENSAJES_HISTORIAL);
    expect(estado.messages.at(-1)!.id).toBe(`user-${total}`);
  });

  it('podar `seenIds` no reintroduce un duplicado: un reply YA PODADO fuera de la ventana, si el servidor lo reenvía, no se re-agrega mientras siga dentro de la ventana de `seenIds`', () => {
    // Llena exactamente hasta la cota — el primer reply (id=1) todavía está en `seenIds` (última
    // posición no podada) pero podría no estarlo en `messages` si la ventana ya lo desplazó. El punto
    // del test es la dedup, no la visibilidad: mientras `seenIds` lo recuerde, no se duplica.
    let estado = estadoBase();
    for (let id = 1; id <= MAX_MENSAJES_HISTORIAL; id += 1) {
      estado = reducirChat(estado, {
        tipo: 'respuestas_recibidas',
        nextId: id,
        replies: [{ id, text: `reply ${id}` }],
      });
    }
    const largoAntes = estado.messages.length;

    // El servidor reenvía id=1 (carrera de polling) junto con uno genuinamente nuevo.
    const trasRepeticion = reducirChat(estado, {
      tipo: 'respuestas_recibidas',
      nextId: MAX_MENSAJES_HISTORIAL + 1,
      replies: [
        { id: 1, text: 'reply 1' },
        { id: MAX_MENSAJES_HISTORIAL + 1, text: `reply ${MAX_MENSAJES_HISTORIAL + 1}` },
      ],
    });

    // Se acotó (largoAntes ya estaba en la cota) y sólo el reply genuinamente nuevo entró — el
    // repetido fue descartado por `seenIds`, no reintroducido.
    expect(trasRepeticion.messages).toHaveLength(largoAntes);
    expect(trasRepeticion.messages.filter((m) => m.text === 'reply 1')).toHaveLength(0);
    expect(trasRepeticion.messages.at(-1)!.text).toBe(`reply ${MAX_MENSAJES_HISTORIAL + 1}`);
  });

  it('`hidratarEstado` también acota un historial persistido que ya excedía la cota (ej. de antes de este fix)', () => {
    const total = MAX_MENSAJES_HISTORIAL + 30;
    const persistidos: ChatMessage[] = Array.from({ length: total }, (_, i) => ({
      id: `assistant-${i + 1}`,
      role: 'assistant' as const,
      text: `histórico ${i + 1}`,
    }));

    const estado = hidratarEstado(SESSION, persistidos);

    expect(estado.messages).toHaveLength(MAX_MENSAJES_HISTORIAL);
    // El cursor se calcula sobre el historial COMPLETO, no sobre la ventana podada — si no, el
    // próximo poll pediría de nuevo respuestas que el usuario ya tenía.
    expect(estado.nextId).toBe(total);
    expect(estado.messages.at(-1)!.text).toBe(`histórico ${total}`);
  });
});

/**
 * El contrato real del front-door tiene `contenido` y `payload` como campos HERMANOS de primer
 * nivel — el handler lee `msg.contenido` y lo mueve a `context.contenido`, que es lo único que el
 * executor lee. Un `contenido` metido DENTRO de `payload` llega al backend como `None`: el executor
 * no encuentra la entrada firmada y le vuelve a abrir el panel de grabación al usuario, en loop. Por
 * eso estos tests miran los DOS carriles por separado y no un objeto mergeado.
 */
describe('construirEnvioClinico', () => {
  it('sin payload ni contenido, los dos carriles van en null (turno conversacional normal)', () => {
    expect(construirEnvioClinico()).toEqual({ payload: null, contenido: null });
    expect(construirEnvioClinico({})).toEqual({ payload: null, contenido: null });
  });

  it('el contenido firmado del GATE 1 viaja en su PROPIO carril, nunca adentro de payload', () => {
    const contenido: ChatContenido = { tipo: 'dictado', texto: 'texto dictado' };

    const envio = construirEnvioClinico({ contenido });

    expect(envio.contenido).toEqual(contenido);
    expect(envio.payload).toBeNull();
  });

  it('el payload del GATE 2 (markdown editado) viaja en el suyo, sin arrastrar el contenido', () => {
    const envio = construirEnvioClinico({
      payload: { markdown: '# editado' },
      contenido: { tipo: 'dictado', texto: 'texto dictado' },
    });

    expect(envio.payload).toEqual({ markdown: '# editado' });
    // El invariante que el contrato viejo rompía: `contenido` NO se cuela en el payload.
    expect(envio.payload).not.toHaveProperty('contenido');
    expect(envio.contenido).toEqual({ tipo: 'dictado', texto: 'texto dictado' });
  });
});
