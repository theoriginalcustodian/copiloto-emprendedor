import { useState } from 'react';

import { formatearImporte, type GastoPropuesto } from '@copiloto/core';

import { Recibo, Surface } from '../../design-system';
import { FormularioGasto } from '../gastos/FormularioGasto';
import {
  claveResolucionCard,
  guardarResolucionCard,
  leerResolucionCardCruda,
  PREFIJO_RESOLUCION_GASTO,
} from './resolucionCardPropuesta';
import './chat.css';

/**
 * `TarjetaGastoPropuesto` — lo que el copiloto entendió de un gasto dictado (o leído de una foto de
 * ticket), editable antes de guardar. Puerto 1:1 de `apps/mobile/src/modules/chat/TarjetaGastoPropuesto.tsx`
 * (contrato `cards-propuesto-web`, 2026-08-12 — 1ª de las 3 cards nuevas, la de mayor uso real: dos
 * rutas de entrada, voz y foto).
 *
 * Reusa `FormularioGasto` entero vía `iniciales` (mismo motivo que documenta mobile: dos componentes
 * distintos divergirían, y el de voz/foto se quedaría sin algún campo que el manual sí tiene).
 *
 * Guard cross-reload: mismo mecanismo que `TarjetaPresupuestoPropuesto` (ver `resolucionCardPropuesta.ts`),
 * prefijo propio para no compartir namespace con otra card.
 */
type Estado = 'editando' | 'guardado' | 'descartado';

type Resolucion = { estado: 'guardado'; monto: string | null } | { estado: 'descartado' };

const RESOLUCION_STORAGE_PREFIX = PREFIJO_RESOLUCION_GASTO;

function leerResolucion(mensajeId: string): Resolucion | null {
  const parsed = leerResolucionCardCruda(claveResolucionCard(RESOLUCION_STORAGE_PREFIX, mensajeId));
  if (typeof parsed !== 'object' || parsed === null || !('estado' in parsed)) return null;
  const p = parsed as Record<string, unknown>;
  if (p.estado === 'guardado') return { estado: 'guardado', monto: typeof p.monto === 'string' ? p.monto : null };
  if (p.estado === 'descartado') return { estado: 'descartado' };
  return null;
}

function guardarResolucion(mensajeId: string, resolucion: Resolucion): void {
  guardarResolucionCard(claveResolucionCard(RESOLUCION_STORAGE_PREFIX, mensajeId), resolucion);
}

export interface TarjetaGastoPropuestoProps {
  propuesta: GastoPropuesto;
  /** El `id` del `ChatMessage` que trae esta card — clave del guard cross-reload. */
  mensajeId: string;
}

export function TarjetaGastoPropuesto({ propuesta, mensajeId }: TarjetaGastoPropuestoProps) {
  const [estado, setEstado] = useState<Estado>(() => leerResolucion(mensajeId)?.estado ?? 'editando');
  const [monto, setMonto] = useState<string | null>(() => {
    const previa = leerResolucion(mensajeId);
    return previa?.estado === 'guardado' ? previa.monto : null;
  });

  if (estado === 'guardado') {
    return (
      <Recibo
        testId="gasto-propuesto-guardado"
        tono="exito"
        titulo={`Gasto anotado${monto != null ? `: ${formatearImporte(monto)}` : ''}`}
      />
    );
  }

  if (estado === 'descartado') {
    return (
      <Recibo testId="gasto-propuesto-descartado" titulo="No lo anotamos." />
    );
  }

  const dicho = propuesta.descripcion?.trim();

  return (
    <div className="chat-row chat-row--assistant" data-testid="gasto-propuesto">
      <Surface variant="card" blur className="propuesta-card">
        <p className="propuesta-card__aviso">Esto entendí. Revisalo y tocá Guardar — todavía no lo anoté.</p>
        {dicho != null && dicho !== '' && <p className="propuesta-card__dicho">«{dicho}»</p>}
        <FormularioGasto
          origen={propuesta.origen}
          iniciales={{
            monto: propuesta.monto,
            categoria: propuesta.categoria,
            proveedor: propuesta.proveedor ?? undefined,
            medioPago: propuesta.medioPago ?? undefined,
            descripcion: propuesta.descripcion ?? undefined,
            montoSugerido: propuesta.montoSugerido ?? undefined,
            fecha: propuesta.fecha !== '' ? propuesta.fecha : undefined,
          }}
          onCreado={(g) => {
            guardarResolucion(mensajeId, { estado: 'guardado', monto: g.monto });
            setMonto(g.monto);
            setEstado('guardado');
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
