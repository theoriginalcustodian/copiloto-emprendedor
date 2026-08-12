import { useState } from 'react';

import { formatearImporte, type FaltanteIngreso, type IngresoPropuesto } from '@copiloto/core';

import { Surface } from '../../design-system';
import { FormularioIngreso } from '../ingresos/FormularioIngreso';
import { claveResolucionCard, guardarResolucionCard, leerResolucionCardCruda } from './resolucionCardPropuesta';
import './chat.css';

/**
 * `TarjetaIngresoPropuesto` — lo que el copiloto entendió de un ingreso dictado, editable antes de
 * anotarlo. Puerto de `apps/mobile/src/modules/chat/TarjetaIngresoPropuesto.tsx` (contrato
 * `cards-propuesto-web`, 2026-08-12 — 3ª de las 3 cards nuevas).
 *
 * 🔴 **Se aparta de mobile a propósito: acá SÍ hay un estado terminal propio, mobile no tiene.**
 * Mobile deja el post-guardado (`falta`/completar) DENTRO de `FormularioIngreso` — no hay Tile
 * terminal, sólo `'editando' | 'descartado'`. Eso funciona porque mobile no tiene guard cross-reload
 * TODAVÍA (deuda anotada, ver `TarjetaPresupuestoPropuesto`): sin guard, "quién decide qué se ve" es
 * sólo el `useState` de React, y no importa que viva en el form o en la Tarjeta.
 *
 * Acá SÍ hay guard, y el guard necesita algo que leer ANTES de que exista una propuesta de UI: por
 * eso la Tarjeta tiene su propio estado 'guardado'. Pero **no lo usa para desmontar el formulario en
 * la sesión viva** — eso perdería el completar-después-de-guardar, que es la razón de ser de
 * `FormularioIngreso`. La marca de `localStorage` se escribe en cuanto el POST entra (best-effort,
 * no bloquea), y sólo un MOUNT FUTURO (reload) la lee y salta directo al Tile terminal. En la sesión
 * en curso, `FormularioIngreso` sigue mostrando su propio `ingreso-falta`/`ingreso-completo` como
 * siempre. Costo aceptado: si el emprendedor recarga ANTES de completar los datos opcionales, pierde
 * esa chance en particular (no se re-implementa el sub-flujo de completar a nivel Tarjeta) — pero el
 * ingreso YA quedó anotado, que es lo único que el guard tiene que garantizar que no se duplique.
 */
type Estado = 'editando' | 'guardado' | 'descartado';

type Resolucion =
  | { estado: 'guardado'; monto: string | null; faltan: FaltanteIngreso[] }
  | { estado: 'descartado' };

const RESOLUCION_STORAGE_PREFIX = 'copiloto-ingreso-propuesto-resuelto';

function leerResolucion(mensajeId: string): Resolucion | null {
  const parsed = leerResolucionCardCruda(claveResolucionCard(RESOLUCION_STORAGE_PREFIX, mensajeId));
  if (typeof parsed !== 'object' || parsed === null || !('estado' in parsed)) return null;
  const p = parsed as Record<string, unknown>;
  if (p.estado === 'guardado') {
    return {
      estado: 'guardado',
      monto: typeof p.monto === 'string' ? p.monto : null,
      faltan: Array.isArray(p.faltan) ? (p.faltan as FaltanteIngreso[]) : [],
    };
  }
  if (p.estado === 'descartado') return { estado: 'descartado' };
  return null;
}

function guardarResolucion(mensajeId: string, resolucion: Resolucion): void {
  guardarResolucionCard(claveResolucionCard(RESOLUCION_STORAGE_PREFIX, mensajeId), resolucion);
}

export interface TarjetaIngresoPropuestoProps {
  propuesta: IngresoPropuesto;
  /** El `id` del `ChatMessage` que trae esta card — clave del guard cross-reload. */
  mensajeId: string;
}

export function TarjetaIngresoPropuesto({ propuesta, mensajeId }: TarjetaIngresoPropuestoProps) {
  // Sólo lee al MONTAR — un guardado que ocurre en esta misma sesión no fuerza este `estado` (ver
  // docstring de arriba). Un mount posterior (reload) sí lo va a encontrar ya escrito.
  const [estado, setEstado] = useState<Estado>(() => leerResolucion(mensajeId)?.estado ?? 'editando');
  const [resuelto] = useState<Resolucion | null>(() => leerResolucion(mensajeId));

  if (estado === 'guardado') {
    const monto = resuelto?.estado === 'guardado' ? resuelto.monto : null;
    const faltan = resuelto?.estado === 'guardado' ? resuelto.faltan : [];
    return (
      <div className="chat-row chat-row--assistant" data-testid="ingreso-propuesto-guardado">
        <Surface variant="tile" className="propuesta-card propuesta-card--terminal propuesta-card--exito">
          Ingreso anotado{monto != null ? `: ${formatearImporte(monto)}` : ''}
          {faltan.length === 0 ? ', con todos los datos.' : '.'}
        </Surface>
      </div>
    );
  }

  if (estado === 'descartado') {
    return (
      <div className="chat-row chat-row--assistant" data-testid="ingreso-propuesto-descartado">
        <Surface variant="tile" className="propuesta-card propuesta-card--terminal">
          No lo anotamos.
        </Surface>
      </div>
    );
  }

  return (
    <div className="chat-row chat-row--assistant" data-testid="ingreso-propuesto">
      <Surface variant="card" blur className="propuesta-card">
        <p className="propuesta-card__aviso">Esto entendí. Revisalo y tocá Anotar — todavía no lo guardé.</p>
        <FormularioIngreso
          origen="voz"
          iniciales={{
            monto: propuesta.monto,
            cliente: propuesta.clienteNombre ?? undefined,
            medio: propuesta.medio ?? undefined,
            concepto: propuesta.concepto ?? undefined,
            fecha: propuesta.fecha !== '' ? propuesta.fecha : undefined,
          }}
          onGuardado={(ingreso) => {
            guardarResolucion(mensajeId, { estado: 'guardado', monto: ingreso.monto, faltan: ingreso.falta ?? [] });
          }}
          onCancelar={() => {
            guardarResolucion(mensajeId, { estado: 'descartado' });
            setEstado('descartado');
          }}
        />
      </Surface>
    </div>
  );
}
