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
 * eso la Tarjeta tiene su propio estado 'guardado'. Pero **no lo fuerza al guardar en sí** — eso
 * perdería el completar-después-de-guardar, que es la razón de ser de `FormularioIngreso`. La marca
 * de `localStorage` se escribe en cuanto el POST entra (best-effort, no bloquea, vía `onGuardado`),
 * y en la sesión en curso `FormularioIngreso` sigue mostrando su propio `ingreso-falta`/
 * `ingreso-completo` como siempre — hasta que el emprendedor da una señal explícita de "terminé":
 * `onListo` ("Así está bien", cuando quedó incompleto) SÍ transiciona la Tarjeta al Tile terminal en
 * la sesión viva, porque en ese punto el ingreso YA está guardado y el usuario acaba de decir que no
 * va a completar más — mostrar el form otra vez sería mentirle. (Bug real encontrado en vivo contra
 * prod, 2026-08-12: antes ese botón reusaba `onCancelar` —igual que mobile hoy— y marcaba la card
 * como 'descartado' sobre un ingreso que sí se había guardado. `onListo` es un prop nuevo de
 * `FormularioIngreso`, separado de `onCancelar`, con el mismo default de antes si no se lo pasa.)
 * Un MOUNT futuro (reload) sin pasar por `onListo` también resuelve bien: lee la marca ya escrita por
 * `onGuardado` y salta directo al Tile terminal con el monto/faltan correctos.
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
  // A diferencia de `estado`, este SÍ se mantiene al día en la sesión viva (`onGuardado` lo
  // actualiza) — así, cuando `onListo` fuerza la transición a 'guardado', el Tile terminal muestra
  // el monto/faltan reales y no el `null`/`[]` que tendría de haberse leído sólo al montar.
  const [resuelto, setResuelto] = useState<Resolucion | null>(() => leerResolucion(mensajeId));

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
            const r: Resolucion = { estado: 'guardado', monto: ingreso.monto, faltan: ingreso.falta ?? [] };
            guardarResolucion(mensajeId, r);
            setResuelto(r);
          }}
          onListo={() => setEstado('guardado')}
          onCancelar={() => {
            guardarResolucion(mensajeId, { estado: 'descartado' });
            setEstado('descartado');
          }}
        />
      </Surface>
    </div>
  );
}
