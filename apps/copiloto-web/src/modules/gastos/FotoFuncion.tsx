import { useRef, useState } from 'react';

import {
  avisoErrorLecturaFoto,
  datosGastoPropuesto,
  leerFotoGasto,
  type ArchivoSubida,
} from '@copiloto/core';

import type { ValoresInicialesGasto } from './FormularioGasto';
import './FotoFuncion.css';

export interface FotoFuncionProps {
  /** 200: la propuesta ya traducida a los valores del formulario — `origen` SIEMPRE es `'foto'`. */
  onLectura: (iniciales: ValoresInicialesGasto) => void;
  /** Cualquier error (413/415/422/502/503/401): el caller abre igual el alta en blanco — nunca
   * bloquea la carga manual (contrato §3). */
  onError: (mensaje: string) => void;
  disabled?: boolean;
}

/**
 * `POST /gastos/leer-foto` (BL-J7, 3er ítem del DoD) — hermano de `MicFuncion` en la misma fila del
 * rótulo de Gastos: en vez de un `<input type="file">` sencillo, es un botón que dispara el picker
 * nativo (`capture="environment"` prioriza la cámara trasera en mobile web, sin bloquear elegir de
 * galería) y sube la foto SIN sesión de chat, SIN side effects — el mismo criterio que `/transcribir`.
 *
 * 🔴 **`origen: 'foto'` no lo decide `datosGastoPropuesto`** (lee lo que mande el backend, y hoy
 * siempre manda `'foto'` para este endpoint) — se fuerza acá por las dudas: si el backend alguna vez
 * mandara otra cosa, la UI del ticket ("Del ticket leímos…") seguiría siendo correcta porque es ESTE
 * disparador el que la activa, no el campo `origen` de la respuesta.
 */
export function FotoFuncion({ onLectura, onError, disabled }: FotoFuncionProps) {
  const [leyendo, setLeyendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function alElegirArchivo(archivo: File) {
    setLeyendo(true);
    try {
      const subida: ArchivoSubida = { nombre: archivo.name || 'ticket.jpg', mime: archivo.type, datos: archivo };
      const res = await leerFotoGasto(subida);
      const propuesta = datosGastoPropuesto(res.gasto);
      if (propuesta === null) {
        onError('No pude leer el ticket. Probá con otra foto o cargalo a mano.');
        return;
      }
      onLectura({
        monto: '', // BL-J7 §2/§3: `monto` SIEMPRE vacío — `montoSugerido` es sólo sugerencia tocable.
        montoSugerido: propuesta.montoSugerido ?? undefined,
        categoria: propuesta.categoria,
        proveedor: propuesta.proveedor ?? undefined,
        medioPago: propuesta.medioPago ?? undefined,
        descripcion: propuesta.descripcion ?? undefined,
        fecha: propuesta.fecha !== '' ? propuesta.fecha : undefined,
      });
    } catch (err) {
      onError(avisoErrorLecturaFoto(err));
    } finally {
      setLeyendo(false);
    }
  }

  function alCambiarInput(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    // Se limpia el `value` YA, no en un `finally` async: sin esto, elegir la MISMA foto dos veces
    // seguidas (p. ej. reintentar tras un 422) no dispara un segundo `onChange` — el navegador lo
    // ignora porque el `value` no cambió.
    event.target.value = '';
    if (archivo != null) void alElegirArchivo(archivo);
  }

  return (
    <div className="foto-funcion" data-testid="foto-funcion">
      <button
        type="button"
        className="foto-funcion__boton"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || leyendo}
        data-testid="foto-funcion-boton"
        aria-label="Leer un gasto desde una foto del ticket"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        onChange={alCambiarInput}
        data-testid="foto-funcion-input"
        hidden
      />
    </div>
  );
}
