import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: {
      login: vi.fn(),
      me: vi.fn(),
      catalog: vi.fn(),
      sendChat: vi.fn(),
      sendAudio: vi.fn(),
      getReply: vi.fn(),
      warm: vi.fn(),
    },
  };
});

import { MAX_MENSAJES_HISTORIAL } from '@copiloto/core';
import { api } from '../../lib/api';
import { useChat } from './useChat';

const POLL_INTERVAL_MS = 1500;
const WARM_THROTTLE_MS = 5 * 60_000;

describe('useChat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.mocked(api.sendChat).mockReset();
    vi.mocked(api.sendAudio).mockReset();
    vi.mocked(api.getReply).mockReset();
    vi.mocked(api.warm).mockReset();
    vi.mocked(api.warm).mockResolvedValue({ warmed: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('send agrega el msg del usuario ya mismo y la respuesta del assistant llega por polling', async () => {
    vi.mocked(api.sendChat).mockResolvedValueOnce({ wf_id: 'wf-1', accepted: true });
    vi.mocked(api.getReply)
      // poll de rehidratación al montar (Task 19/review): sesión nueva, sin historial -> after_id=0.
      .mockResolvedValueOnce({ replies: [], next_id: 0 })
      // 1er poll (inmediato, disparado por send): todavía nada — el agente durable sigue procesando.
      .mockResolvedValueOnce({ replies: [], next_id: 0 })
      // 2do poll (disparado por el intervalo): llega la respuesta.
      .mockResolvedValueOnce({ replies: [{ id: 1, text: 'Hola, en qué te ayudo?' }], next_id: 1 });

    const { result } = renderHook(() => useChat());

    // Deja resolver el poll de rehidratación disparado al montar antes de enviar (aísla el flujo).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.getReply).toHaveBeenCalledTimes(1);
    expect(api.getReply).toHaveBeenNthCalledWith(1, expect.any(String), 0);
    expect(result.current.messages).toHaveLength(0);

    await act(async () => {
      await result.current.send('Hola');
    });

    // El mensaje del usuario aparece de inmediato, sin esperar al agente.
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({ role: 'user', text: 'Hola' });
    expect(result.current.sendStatus).toBe('waiting');

    // Deja resolver el 1er poll inmediato (sin timers de por medio).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.messages).toHaveLength(1); // todavía sin respuesta
    expect(api.getReply).toHaveBeenCalledTimes(2);

    // Avanza el intervalo de polling -> dispara el 3er getReply, que sí trae la respuesta.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(api.getReply).toHaveBeenCalledTimes(3);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant', text: 'Hola, en qué te ayudo?' });
    expect(result.current.sendStatus).toBe('idle');

    // El polling se detuvo (llegó la respuesta) — avanzar más no debería generar más llamadas.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });
    expect(api.getReply).toHaveBeenCalledTimes(3);
  });

  // BL-D4 — control negativo: un HITL/desambiguación manda al backend el token técnico
  // (`cancel:2:0`) pero la burbuja del usuario tiene que pintar el LABEL que vio y tocó
  // ('Cancelar'), nunca el token. Si `send()` no soporta `displayText` (el estado previo al fix,
  // donde la burbuja usaba directamente `trimmed`), este test falla mostrando el token crudo.
  it('BL-D4: con displayText, la burbuja pinta el label — NUNCA el token técnico enviado al backend', async () => {
    vi.mocked(api.sendChat).mockResolvedValueOnce({ wf_id: 'wf-hitl-1', accepted: true });
    vi.mocked(api.getReply)
      .mockResolvedValueOnce({ replies: [], next_id: 0 }) // poll de rehidratación al montar
      .mockResolvedValueOnce({ replies: [], next_id: 0 }); // 1er poll tras el callback

    const { result } = renderHook(() => useChat());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.send('cancel:2:0', { kind: 'callback', displayText: 'Cancelar' });
    });

    // La burbuja optimista muestra el label...
    expect(result.current.messages[0]).toMatchObject({ role: 'user', text: 'Cancelar' });
    expect(result.current.messages[0].text).not.toContain('cancel:');
    // ...pero el backend igual recibe el token técnico que espera el protocolo HITL.
    expect(api.sendChat).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'cancel:2:0', kind: 'callback' }),
    );
  });

  it('ignora texto vacío/solo-espacios sin llamar a la API', async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send('   ');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(api.sendChat).not.toHaveBeenCalled();
  });

  it('si sendChat falla, marca sendStatus=error y no arranca el polling (más allá del poll de rehidratación al montar)', async () => {
    vi.mocked(api.getReply).mockResolvedValueOnce({ replies: [], next_id: 0 }); // poll de rehidratación al montar
    vi.mocked(api.sendChat).mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useChat());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // deja resolver el poll de montaje antes de enviar
    });
    expect(api.getReply).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.send('Hola');
    });

    expect(result.current.sendStatus).toBe('error');
    expect(api.getReply).toHaveBeenCalledTimes(1); // el fallo de sendChat no agrega llamadas nuevas
  });

  describe('sendAudio (Task 19)', () => {
    it('sube el blob, agrega el transcript como msg de usuario (recién con la respuesta) y pollea /reply', async () => {
      vi.mocked(api.sendAudio).mockResolvedValueOnce({
        wf_id: 'wf-audio-1',
        accepted: true,
        transcript: 'Mandale un mail a Juan',
      });
      vi.mocked(api.getReply)
        .mockResolvedValueOnce({ replies: [], next_id: 0 }) // poll de rehidratación al montar
        .mockResolvedValueOnce({ replies: [], next_id: 0 }) // 1er poll (inmediato, disparado por sendAudio)
        .mockResolvedValueOnce({ replies: [{ id: 1, text: 'Dale, se lo mando.' }], next_id: 1 }); // por el intervalo

      const { result } = renderHook(() => useChat());
      const blob = new Blob(['fake-audio-bytes'], { type: 'audio/webm' });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0); // deja resolver el poll de montaje
      });
      expect(api.getReply).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.sendAudio(blob, 6);
      });

      expect(api.sendAudio).toHaveBeenCalledWith(expect.any(String), blob);
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toMatchObject({
        role: 'user',
        text: 'Mandale un mail a Juan',
        porVoz: { duracionSeg: 6 },
      });
      expect(result.current.sendStatus).toBe('waiting');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(api.getReply).toHaveBeenCalledTimes(2);
      expect(result.current.messages).toHaveLength(1); // todavía sin respuesta del agente

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      });
      expect(api.getReply).toHaveBeenCalledTimes(3);
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1]).toMatchObject({ role: 'assistant', text: 'Dale, se lo mando.' });
      expect(result.current.sendStatus).toBe('idle');
    });

    it('si sendAudio falla (ej. STT/red), marca sendStatus=error y no arranca el polling ni agrega mensaje', async () => {
      vi.mocked(api.getReply).mockResolvedValueOnce({ replies: [], next_id: 0 }); // poll de rehidratación al montar
      vi.mocked(api.sendAudio).mockRejectedValueOnce(new Error('network down'));

      const { result } = renderHook(() => useChat());
      const blob = new Blob(['x'], { type: 'audio/webm' });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0); // deja resolver el poll de montaje
      });
      expect(api.getReply).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.sendAudio(blob, 3);
      });

      expect(result.current.sendStatus).toBe('error');
      expect(result.current.messages).toHaveLength(0);
      expect(api.getReply).toHaveBeenCalledTimes(1); // el fallo de sendAudio no agrega llamadas nuevas
    });
  });

  describe('rehidratación + poll-on-mount (durabilidad — fix de review adversarial)', () => {
    const SESSION_ID = 'sess-rehidratacion-test';
    const MESSAGES_KEY = `copiloto-chat-msgs:${SESSION_ID}`;

    beforeEach(() => {
      window.localStorage.setItem('copiloto-chat-session-id', SESSION_ID);
    });

    it('al montar, rehidrata los messages persistidos en localStorage', async () => {
      const persisted = [
        { id: 'user-1', role: 'user', text: 'Mandale un mail a Juan' },
        { id: 'assistant-3', role: 'assistant', text: 'Dale, ya lo hice.' },
      ];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));
      vi.mocked(api.getReply).mockResolvedValueOnce({ replies: [], next_id: 3 });

      const { result } = renderHook(() => useChat());

      // Rehidratado YA en el primer render — no hace falta esperar ningún poll para verlo.
      expect(result.current.messages).toEqual(persisted);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    });

    it('al montar, dispara un poll con after_id = mayor id de assistant ya visto, y agrega replies que llegaron mientras estaba desmontado', async () => {
      const persisted = [
        { id: 'user-1', role: 'user', text: 'Mandale un mail a Juan' },
        { id: 'assistant-3', role: 'assistant', text: 'Dale, ya lo hice.' },
      ];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));
      vi.mocked(api.getReply).mockResolvedValueOnce({
        replies: [{ id: 4, text: 'Además, le mandé el recordatorio (esto llegó mientras no mirabas).' }],
        next_id: 4,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.getReply).toHaveBeenCalledWith(SESSION_ID, 3); // after_id derivado del rehidratado, NO 0
      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[2]).toMatchObject({
        role: 'assistant',
        text: 'Además, le mandé el recordatorio (esto llegó mientras no mirabas).',
      });
    });

    it('sin messages persistidos, el poll de montaje usa after_id=0', async () => {
      vi.mocked(api.getReply).mockResolvedValueOnce({ replies: [], next_id: 0 });

      renderHook(() => useChat());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.getReply).toHaveBeenCalledWith(SESSION_ID, 0);
    });

    it('persiste messages en localStorage tras un send', async () => {
      vi.mocked(api.getReply).mockResolvedValueOnce({ replies: [], next_id: 0 }); // poll de montaje
      vi.mocked(api.sendChat).mockResolvedValueOnce({ wf_id: 'wf-2', accepted: true });

      const { result } = renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        await result.current.send('Hola de nuevo');
      });

      const stored: unknown = JSON.parse(window.localStorage.getItem(MESSAGES_KEY) ?? '[]');
      expect(stored).toHaveLength(1);
      expect(stored).toMatchObject([{ role: 'user', text: 'Hola de nuevo' }]);
    });
  });

  // H-A4-9 — una card HITL ya respondida no debe seguir siendo clickeable, NI SIQUIERA tras un
  // reload: el estado de "ya respondida" tiene que vivir en el MENSAJE persistido, no en un estado
  // efímero de React que se pierde al remontar.
  describe('HITL ya respondida sobrevive a un reload (H-A4-9)', () => {
    const SESSION_ID = 'sess-hitl-respondida-test';
    const MESSAGES_KEY = `copiloto-chat-msgs:${SESSION_ID}`;

    beforeEach(() => {
      window.localStorage.setItem('copiloto-chat-session-id', SESSION_ID);
      vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    });

    it('rehidrata un HITL YA marcado hitlRespondido tal cual — sigue deshabilitado', async () => {
      const persisted = [
        {
          id: 'assistant-1',
          role: 'assistant',
          text: 'Cobro a **Juan** por $1.000.',
          choices: [
            { label: 'Sí, cobrar', value: 'confirm_1' },
            { label: 'Cancelar', value: 'cancel_1' },
          ],
          card: { service: 'mercadopago', label: 'Mercado Pago' },
          hitlRespondido: { value: 'cancel_1', label: 'Cancelar' },
        },
        { id: 'user-1', role: 'user', text: 'Cancelar' },
      ];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));

      const { result } = renderHook(() => useChat());

      // Control negativo implícito: si el código viejo no soportara `hitlRespondido`, este campo se
      // perdería al pasar por `acotarMensajes`/`JSON.parse` — no es el caso, viaja tal cual.
      expect(result.current.messages[0]).toMatchObject({
        hitlRespondido: { value: 'cancel_1', label: 'Cancelar' },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    });

    it('sanitiza un HITL viejo con el token LEGACY (pre-#624, "cancel:2:0") al rehidratar', async () => {
      // Formato de ANTES de BL-D4/#624: la burbuja de respuesta pintaba el `value` técnico crudo
      // (`cancel:<turn>:<step>`), no el label — y `hitlRespondido` ni existía todavía.
      const persisted = [
        {
          id: 'assistant-1',
          role: 'assistant',
          text: 'Voy a publicar el posteo. ¿Confirmás?',
          choices: [
            { label: 'Sí, publicar', value: 'confirm:2:0' },
            { label: 'Cancelar', value: 'cancel:2:0' },
          ],
          card: { service: 'instagram', label: 'Instagram' },
        },
        { id: 'user-1', role: 'user', text: 'cancel:2:0' }, // token crudo LEGACY, no un label
      ];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));

      const { result } = renderHook(() => useChat());

      expect(result.current.messages[0]).toMatchObject({
        hitlRespondido: { value: 'cancel:2:0', label: 'Cancelar' },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    });

    it('un HITL sin respuesta después (sigue activo) NO se marca hitlRespondido', async () => {
      const persisted = [
        {
          id: 'assistant-1',
          role: 'assistant',
          text: 'Voy a publicar el posteo. ¿Confirmás?',
          choices: [
            { label: 'Sí, publicar', value: 'confirm:2:0' },
            { label: 'Cancelar', value: 'cancel:2:0' },
          ],
          card: { service: 'instagram', label: 'Instagram' },
        },
      ];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));

      const { result } = renderHook(() => useChat());

      expect(result.current.messages[0].hitlRespondido).toBeUndefined();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    });

    it('send con hitlMessageId marca ESA card hitlRespondido, atómico con la burbuja nueva, y persiste', async () => {
      vi.mocked(api.sendChat).mockResolvedValueOnce({ wf_id: 'wf-hitl-2', accepted: true });
      const persisted = [
        {
          id: 'assistant-1',
          role: 'assistant',
          text: 'Voy a publicar el posteo. ¿Confirmás?',
          choices: [
            { label: 'Sí, publicar', value: 'confirm:2:0' },
            { label: 'Cancelar', value: 'cancel:2:0' },
          ],
          card: { service: 'instagram', label: 'Instagram' },
        },
      ];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));

      const { result } = renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.messages[0].hitlRespondido).toBeUndefined(); // todavía activa

      await act(async () => {
        await result.current.send('cancel:2:0', {
          kind: 'callback',
          displayText: 'Cancelar',
          hitlMessageId: 'assistant-1',
        });
      });

      expect(result.current.messages[0]).toMatchObject({
        id: 'assistant-1',
        hitlRespondido: { value: 'cancel:2:0', label: 'Cancelar' },
      });

      const stored: unknown = JSON.parse(window.localStorage.getItem(MESSAGES_KEY) ?? '[]');
      expect(stored).toMatchObject([
        { id: 'assistant-1', hitlRespondido: { value: 'cancel:2:0', label: 'Cancelar' } },
        { role: 'user', text: 'Cancelar' },
      ]);
    });
  });

  // HOJA — «Ahora no» (sheet «conectá X») tiene que sobrevivir a un reload igual que `hitlRespondido`
  // arriba: la marca vive en el MENSAJE persistido, no en el `useState<Set>` que tenía
  // `useConexionRequerida.ts` antes del fix (memoria, se perdía al recargar y la hoja reaparecía
  // tapando el composer — BIS2 paso (c)).
  describe('«Ahora no» sobrevive a un reload (HOJA)', () => {
    const SESSION_ID = 'sess-hoja-ahora-no-test';
    const MESSAGES_KEY = `copiloto-chat-msgs:${SESSION_ID}`;

    beforeEach(() => {
      window.localStorage.setItem('copiloto-chat-session-id', SESSION_ID);
      vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    });

    it('marcarConexionDescartada marca el mensaje y lo persiste en localStorage', async () => {
      const persisted = [
        { id: 'user-1', role: 'user', text: 'mandale un mail a Juan' },
        {
          id: 'assistant-1',
          role: 'assistant',
          text: 'Para eso necesito que conectes Gmail primero.',
          card: { kind: 'requiere_conexion', service: 'gmail', label: 'Gmail', connect_path: '/x' },
        },
      ];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));

      const { result } = renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.messages[1].conexionDescartada).toBeUndefined(); // todavía vigente

      act(() => result.current.marcarConexionDescartada('assistant-1'));

      expect(result.current.messages[1]).toMatchObject({ id: 'assistant-1', conexionDescartada: true });
      const stored: unknown = JSON.parse(window.localStorage.getItem(MESSAGES_KEY) ?? '[]');
      expect(stored).toMatchObject([{ id: 'user-1' }, { id: 'assistant-1', conexionDescartada: true }]);
    });

    it('rehidrata un mensaje YA marcado conexionDescartada tal cual', async () => {
      const persisted = [
        {
          id: 'assistant-1',
          role: 'assistant',
          text: 'Para eso necesito que conectes Gmail primero.',
          card: { kind: 'requiere_conexion', service: 'gmail', label: 'Gmail', connect_path: '/x' },
          conexionDescartada: true,
        },
      ];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));

      const { result } = renderHook(() => useChat());

      expect(result.current.messages[0]).toMatchObject({ conexionDescartada: true });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    });
  });

  // PODA (BL-V32) — el guard A (`resolucionCardPropuesta.ts`) nunca borraba: `startNewSession`
  // borraba los MENSAJES de la sesión previa pero dejaba huérfana la marca de resolución de cada
  // card `*_propuesto` de esos mensajes (medido en prod: ~20 claves acumuladas en un tenant de
  // prueba). Control negativo obligatorio (pedido del peer antes de cerrar): sin el `podarResolucionesCard`
  // dentro de `startNewSession`, este test tiene que dar ROJO — lo verifiqué comentando esa línea
  // antes de escribir el fix.
  describe('poda de marcas huérfanas del guard A al arrancar sesión nueva (PODA / BL-V32)', () => {
    const SESSION_ID = 'sess-poda-test';
    const MESSAGES_KEY = `copiloto-chat-msgs:${SESSION_ID}`;

    beforeEach(() => {
      window.localStorage.setItem('copiloto-chat-session-id', SESSION_ID);
      vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    });

    it('startNewSession borra las marcas de resolución (guard A) de los mensajes de la sesión descartada', async () => {
      const persisted = [
        { id: 'user-1', role: 'user', text: 'gasté 5000 en nafta' },
        { id: 'assistant-1', role: 'assistant', text: 'Anoté el gasto.', card: { kind: 'gasto_propuesto' } },
      ];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));
      // Simula lo que `TarjetaGastoPropuesto` ya habría guardado (guard A, prefijo real).
      window.localStorage.setItem(
        'copiloto-gasto-propuesto-resuelto:assistant-1',
        JSON.stringify({ estado: 'guardado', monto: '5000' }),
      );

      const { result } = renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.messages).toHaveLength(2);

      act(() => result.current.startNewSession());

      expect(window.localStorage.getItem('copiloto-gasto-propuesto-resuelto:assistant-1')).toBeNull();
    });

    it('control negativo — una marca de OTRO mensaje (no de la sesión descartada) sobrevive', async () => {
      const persisted = [{ id: 'assistant-1', role: 'assistant', text: 'x', card: { kind: 'gasto_propuesto' } }];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));
      window.localStorage.setItem(
        'copiloto-gasto-propuesto-resuelto:assistant-999',
        JSON.stringify({ estado: 'guardado', monto: '1' }),
      );

      const { result } = renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      act(() => result.current.startNewSession());

      // Si la poda fuera un `clear()` general en vez de por `id` de mensaje, esto también
      // desaparecería — el control demuestra que borra lo que corresponde, no todo.
      expect(window.localStorage.getItem('copiloto-gasto-propuesto-resuelto:assistant-999')).not.toBeNull();
    });
  });

  describe('cota de historial (C6) — messages no crece sin techo', () => {
    const SESSION_ID = 'sess-cota-test';
    const MESSAGES_KEY = `copiloto-chat-msgs:${SESSION_ID}`;

    beforeEach(() => {
      window.localStorage.setItem('copiloto-chat-session-id', SESSION_ID);
    });

    it('un historial persistido más largo que la cota se rehidrata YA acotado', async () => {
      const total = MAX_MENSAJES_HISTORIAL + 40;
      const persisted = Array.from({ length: total }, (_, i) => ({
        id: `assistant-${i + 1}`,
        role: 'assistant',
        text: `histórico ${i + 1}`,
      }));
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));
      vi.mocked(api.getReply).mockResolvedValueOnce({ replies: [], next_id: total });

      const { result } = renderHook(() => useChat());

      expect(result.current.messages).toHaveLength(MAX_MENSAJES_HISTORIAL);
      expect(result.current.messages.at(-1)).toMatchObject({ text: `histórico ${total}` });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      // El cursor del poll de montaje usa el mayor id del historial COMPLETO, no de la ventana
      // podada — si no, re-pediría (y re-descartaría) respuestas que ya se tenían.
      expect(api.getReply).toHaveBeenCalledWith(SESSION_ID, total);
    });

    it('`send` repetido más allá de la cota mantiene `messages` acotado a MAX_MENSAJES_HISTORIAL', async () => {
      vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
      vi.mocked(api.sendChat).mockResolvedValue({ wf_id: 'wf-cota', accepted: true });

      const { result } = renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const total = MAX_MENSAJES_HISTORIAL + 25;
      for (let i = 1; i <= total; i += 1) {
        // eslint-disable-next-line no-await-in-loop -- secuencial a propósito: cada send espera su
        // propio poll inmediato antes del siguiente, igual que lo haría un usuario tipeando.
        await act(async () => {
          await result.current.send(`mensaje ${i}`);
        });
      }

      expect(result.current.messages).toHaveLength(MAX_MENSAJES_HISTORIAL);
      expect(result.current.messages.at(-1)).toMatchObject({ text: `mensaje ${total}` });
      const stored: unknown = JSON.parse(window.localStorage.getItem(MESSAGES_KEY) ?? '[]');
      expect(Array.isArray(stored) ? stored.length : -1).toBe(MAX_MENSAJES_HISTORIAL);
    });
  });

  describe('warm de memoria (perceived latency)', () => {
    // Session id único por test → el throttle a nivel de módulo (lastWarmAtBySession) no filtra entre
    // tests: cada uno arranca sin entrada previa y el 1er warm siempre dispara.
    let warmSeq = 0;
    function freshSession(): string {
      const sid = `warm-sess-${++warmSeq}`;
      window.localStorage.setItem('copiloto-chat-session-id', sid);
      return sid;
    }

    beforeEach(() => {
      vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 }); // poll-on-mount inocuo
    });

    it('al montar (entrar al chat / abrir la app) precalienta la memoria una vez', async () => {
      freshSession();
      renderHook(() => useChat());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.warm).toHaveBeenCalledTimes(1);
    });

    it('re-warmea al volver la pestaña a visible una vez pasado el throttle', async () => {
      freshSession();
      renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(api.warm).toHaveBeenCalledTimes(1); // warm del montaje

      // Pasa el throttle y la pestaña vuelve a visible (jsdom: visibilityState='visible' por default).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(WARM_THROTTLE_MS + 1);
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.warm).toHaveBeenCalledTimes(2);
    });

    it('no re-warmea en un remonte inmediato (throttle absorbe cruzar el breakpoint mobile/desktop)', async () => {
      freshSession();
      const { unmount } = renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(api.warm).toHaveBeenCalledTimes(1);

      // Remonte inmediato con la MISMA sesión, sin avanzar el reloj → throttle bloquea el 2do warm.
      unmount();
      renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.warm).toHaveBeenCalledTimes(1);
    });

    it('un fallo del warm no rompe el chat (best-effort, fire-and-forget)', async () => {
      freshSession();
      vi.mocked(api.warm).mockRejectedValueOnce(new Error('graphity down'));

      const { result } = renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // El warm falló pero el hook sigue operativo: el estado inicial es sano y se puede seguir.
      expect(api.warm).toHaveBeenCalledTimes(1);
      expect(result.current.sendStatus).toBe('idle');
      expect(result.current.messages).toHaveLength(0);
    });
  });
});
