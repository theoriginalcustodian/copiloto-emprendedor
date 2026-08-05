import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { preguntarInteligencia } from '@copiloto/core';

import { generarId } from '../../util/id';

/**
 * `ChatInteligencia` — port de `apps/mobile/src/modules/inteligencia/ChatInteligencia.tsx`. Preguntarle
 * al copiloto sobre el negocio en lenguaje natural («¿cuánto gasté en nafta este mes?»).
 *
 * NO es el chat durable principal (`modules/chat`, `useChat` con polling + Temporal) — es un Q&A
 * SINCRÓNICO contra `POST /inteligencia/chat`: pregunta → "pensando" → respuesta. Por eso NO reusa
 * `Bubble`/`Composer` de `modules/chat` (esos no están en su barrel público, y arrastrarían la
 * maquinaria del chat permanente a algo que no la necesita) — implementa su propio markup simple,
 * visualmente equivalente.
 */

type Rol = 'user' | 'assistant';

interface Turno {
  id: string;
  rol: Rol;
  texto: string;
}

type Estado = 'idle' | 'pensando' | 'error';

const TEXTO_NO_DISPONIBLE =
  'El resumen de tu negocio todavía no está disponible en tu copiloto. Cuando lo esté, vas a poder preguntarle acá.';
const TEXTO_SIN_DATOS = 'Todavía no tengo datos para responder eso.';

export function ChatInteligencia() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [estado, setEstado] = useState<Estado>('idle');
  const [draft, setDraft] = useState('');
  const listaRef = useRef<HTMLDivElement>(null);
  // Ver el comentario equivalente en GastosScreen/ClientesScreen: `vivo.current = true` va DENTRO
  // del setup del efecto (no sólo en `useRef(true)`) por StrictMode.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: 'smooth' });
  }, [turnos]);

  const agregar = useCallback((t: Turno) => setTurnos((prev) => [...prev, t]), []);

  const preguntar = useCallback(
    (texto: string) => {
      const limpio = texto.trim();
      if (limpio === '' || estado === 'pensando') return;

      agregar({ id: generarId(), rol: 'user', texto: limpio });
      setEstado('pensando');

      void (async () => {
        try {
          const res = await preguntarInteligencia(limpio);
          if (!vivo.current) return;
          if (res.status === 'no_disponible') {
            agregar({ id: generarId(), rol: 'assistant', texto: TEXTO_NO_DISPONIBLE });
            setEstado('idle');
            return;
          }
          // Una respuesta REAL vacía es el grafo sin datos: se dice, no se pinta en blanco.
          const cuerpo = res.respuesta.respuesta.trim() === '' ? TEXTO_SIN_DATOS : res.respuesta.respuesta;
          agregar({ id: generarId(), rol: 'assistant', texto: cuerpo });
          setEstado('idle');
        } catch {
          // Un error de un endpoint desplegado-pero-fallando se muestra como error real, no como
          // "todavía no está". El usuario puede reintentar.
          if (vivo.current) setEstado('error');
        }
      })();
    },
    [estado, agregar],
  );

  function submit() {
    if (draft.trim() === '' || estado === 'pensando') return;
    const texto = draft;
    setDraft('');
    preguntar(texto);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="chat-inteligencia" data-testid="chat-inteligencia">
      <div className="chat-inteligencia__lista" ref={listaRef}>
        {turnos.length === 0 && (
          <p className="chat-inteligencia__vacio" data-testid="chat-inteligencia-vacio">
            Preguntale a tu copiloto sobre tu negocio. Por ejemplo: «¿cuánto gasté este mes?» o «¿quién
            me debe?».
          </p>
        )}

        {turnos.map((t) => (
          <div
            key={t.id}
            className={t.rol === 'user' ? 'chat-inteligencia__fila chat-inteligencia__fila--user' : 'chat-inteligencia__fila chat-inteligencia__fila--assistant'}
          >
            <p className={t.rol === 'user' ? 'chat-inteligencia__burbuja chat-inteligencia__burbuja--user' : 'chat-inteligencia__burbuja chat-inteligencia__burbuja--assistant'}>
              {t.texto}
            </p>
          </div>
        ))}

        {estado === 'pensando' && (
          <div className="chat-inteligencia__fila chat-inteligencia__fila--assistant">
            <p className="chat-inteligencia__burbuja chat-inteligencia__burbuja--assistant" data-testid="chat-inteligencia-pensando">
              Pensando…
            </p>
          </div>
        )}

        {estado === 'error' && (
          <p className="chat-inteligencia__error" role="alert" data-testid="chat-inteligencia-error">
            No pudimos enviar tu pregunta. Probá de nuevo.
          </p>
        )}
      </div>

      <form
        className="chat-inteligencia__composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          className="chat-inteligencia__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Preguntale a tu copiloto…"
          rows={1}
          disabled={estado === 'pensando'}
          data-testid="chat-inteligencia-input"
        />
        <button
          type="submit"
          className="chat-inteligencia__enviar"
          disabled={draft.trim() === '' || estado === 'pensando'}
          aria-label="Enviar pregunta"
          data-testid="chat-inteligencia-enviar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 19V5M5 12l7-7 7 7"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}
