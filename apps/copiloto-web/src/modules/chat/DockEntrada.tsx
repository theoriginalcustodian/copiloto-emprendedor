import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { avisoErrorTranscripcion, transcribir, type ArchivoSubida } from '@copiloto/core';

import { MicButton } from './MicButton';
import './chat.css';

/** Mensaje de estado sobre el campo. `alerta` lo vuelve `role="alert"` y color de error. */
export interface AvisoDock {
  texto: string;
  alerta: boolean;
}

export interface DockEntradaProps {
  /** `data-testid` del contenedor (cada pantalla conserva el suyo). */
  testId: string;
  placeholder: string;
  /** Hay un envío en curso: campo, mic y enviar quedan deshabilitados. */
  ocupado: boolean;
  aviso?: AvisoDock | null;
  onEnviar: (texto: string) => void;
}

/** La extensión del archivo tiene que ser la real del mime grabado (ver `MicFuncion`). */
function nombreParaMime(mime: string): string {
  if (mime.includes('mp4')) return 'voz.mp4';
  if (mime.includes('ogg')) return 'voz.ogg';
  if (mime.includes('wav')) return 'voz.wav';
  return 'voz.webm';
}

/**
 * SM-P7 / SM-P8(b) — el dock de entrada de texto + mic + enviar, **un solo componente** para todo
 * chat de la web (negocio y soporte). Antes `Composer` y `ComposerSoporte` duplicaban este JSX y
 * sólo compartían nombres de clase: cualquier cambio de apariencia había que hacerlo dos veces.
 * Quien lo usa aporta únicamente lo que cambia (placeholder, ocupado, aviso, a dónde va el texto).
 *
 * **El dictado PEGA el texto en el campo, no envía** (orden del operador 2026-11-04: sin esto no hay
 * forma de anular un audio que no se quiere mandar). Va por `POST /transcribir` (transcribe SIN
 * despachar al agente; `contexto` es opcional). Hay dos salidas de descarte: cancelar la grabación
 * (`MicButton` no llega a llamar a `onSendAudio`, no sale nada al backend) y, ya transcripto, borrar
 * el texto del campo.
 *
 * Flotante: el envoltorio `.composer` es transparente y sobrepone el hilo; el blur lo pone
 * `.composer__row` (ver `chat.css`). Publica su alto en `--dock-alto` del padre para que el hilo
 * reserve espacio y el último mensaje no quede tapado.
 */
export function DockEntrada({ testId, placeholder, ocupado, aviso, onEnviar }: DockEntradaProps) {
  const [borrador, setBorrador] = useState('');
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [errorDictado, setErrorDictado] = useState<string | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const enViajeRef = useRef(false);

  const bloqueado = ocupado || transcribiendo;
  const puedeEnviar = borrador.trim() !== '' && !ocupado && !transcribiendo;

  useEffect(() => {
    const raiz = raizRef.current;
    const padre = raiz?.parentElement;
    if (!raiz || !padre || typeof ResizeObserver === 'undefined') return;
    const medir = () => padre.style.setProperty('--dock-alto', `${raiz.offsetHeight}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(raiz);
    return () => {
      obs.disconnect();
      padre.style.removeProperty('--dock-alto');
    };
  }, []);

  // `disabled={ocupado}` le quita el foco al campo (medido en navegador real, SM-P13: tras enviar, el
  // activeElement quedaba en BODY). Se recuerda si lo tenía al enviar y se devuelve al terminar.
  const teniaFocoRef = useRef(false);
  useEffect(() => {
    if (!ocupado && teniaFocoRef.current) {
      teniaFocoRef.current = false;
      campoRef.current?.focus();
    }
  }, [ocupado]);

  function enviar() {
    if (!puedeEnviar) return;
    teniaFocoRef.current = document.activeElement === campoRef.current;
    const texto = borrador;
    setBorrador('');
    onEnviar(texto);
  }

  function alTeclear(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  async function alDictar(blob: Blob) {
    if (enViajeRef.current) return;
    enViajeRef.current = true;
    setTranscribiendo(true);
    setErrorDictado(null);
    try {
      const archivo: ArchivoSubida = { nombre: nombreParaMime(blob.type), mime: blob.type, datos: blob };
      const { transcript } = await transcribir(archivo);
      const texto = transcript.trim();
      if (texto === '') {
        setErrorDictado('No se entendió el audio. Probá de nuevo.');
        return;
      }
      setBorrador((previo) => (previo.trim() === '' ? texto : `${previo.trimEnd()} ${texto}`));
      campoRef.current?.focus();
    } catch (err) {
      setErrorDictado(avisoErrorTranscripcion(err));
    } finally {
      enViajeRef.current = false;
      setTranscribiendo(false);
    }
  }

  const avisoVisible: AvisoDock | null = errorDictado
    ? { texto: errorDictado, alerta: true }
    : transcribiendo
      ? { texto: 'Transcribiendo…', alerta: false }
      : (aviso ?? null);

  return (
    <div className="composer" data-testid={testId} ref={raizRef}>
      {avisoVisible && (
        <p
          className={avisoVisible.alerta ? 'composer__status composer__status--alert' : 'composer__status'}
          role={avisoVisible.alerta ? 'alert' : 'status'}
        >
          {avisoVisible.texto}
        </p>
      )}
      <form
        className="composer__row"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <textarea
          ref={campoRef}
          className="composer__input"
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={alTeclear}
          placeholder={placeholder}
          rows={1}
          disabled={ocupado}
        />
        <MicButton onSendAudio={(blob) => void alDictar(blob)} disabled={bloqueado} />
        <button type="submit" className="composer__send" disabled={!puedeEnviar} aria-label="Enviar mensaje">
          {/* Flecha "enviar" — SVG verbatim del diseño (Copiloto App.dc.html:190); currentColor hereda
              `--send-fg` del botón (EXTRACT §2.10). */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}
