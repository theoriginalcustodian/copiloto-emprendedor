import { useState } from 'react';

import type { PresupuestoPropuesto } from '@copiloto/core';

import { Surface } from '../../design-system';
import { FormularioPresupuesto } from '../presupuestos/FormularioPresupuesto';
import { claveResolucionCard, guardarResolucionCard, leerResolucionCardCruda } from './resolucionCardPropuesta';
import './chat.css';

/**
 * `TarjetaPresupuestoPropuesto` — lo que el copiloto entendió de un presupuesto dictado, con sus
 * ítems editables fila por fila antes de guardar. Puerto 1:1 de
 * `apps/mobile/src/modules/chat/TarjetaPresupuestoPropuesto.tsx` (hito 8) — la web no tenía dispatch
 * para ningún `card.kind` de tipo "propuesta editable" (sólo el gate confirmar/cancelar y los
 * artefactos terminales de `ArtifactView`); esta card lo agrega para `presupuesto_propuesto`,
 * confirmado vivo contra el backend en el e2e del ciclo de auditorías (§G6, 2026-08-12).
 *
 * Reusa `FormularioPresupuesto` entero vía su prop `iniciales` (NO `corrige`): `corrige` es la
 * corrección de un presupuesto YA EMITIDO — un concepto distinto de "esto es lo que entendí de tu
 * dictado, todavía sin guardar".
 *
 * **Guard cross-reload (contrato `planificacion-a-frontend_guard-cross-reload-de-cards-propuesto`,
 * 2026-08-12):** `estado`/`numero` vivían sólo en memoria de React — un reload de página remonta la
 * MISMA card histórica ya guardada de vuelta en `'editando'`, y un click en "Guardar" ahí generaba un
 * presupuesto duplicado en prod. Inventario primero (mobile, misma fecha): `TarjetaPresupuestoPropuesto`
 * de `apps/mobile` tiene el MISMO gap (mismo `useState` sin persistencia) — no es exclusivo de web, es
 * deuda compartida; queda anotada para mobile, no se toca acá (fuera del dueño de este contrato).
 *
 * Opción elegida de las 3 que planteó el contrato: **marca local** (no depende de un contrato nuevo
 * con backend = MAYOR; no depende de heurística contra `/presupuestos` = frágil). Se persiste en
 * `localStorage`, con la MISMA clave que ya identifica a este mensaje en el chat: `mensajeId`
 * (`assistant-<reply.id>`, estable entre reload y rehidratación — ver `useChat.ts`). Limitación
 * conocida y aceptada: no cruza dispositivos (si el emprendedor guarda en el celu y abre la PWA en la
 * PC, ve la card editable de nuevo ahí) — el propio contrato la da por buena para este alcance.
 */
type Estado = 'editando' | 'guardado' | 'descartado';

type Resolucion = { estado: 'guardado'; numero: number | null } | { estado: 'descartado' };

const RESOLUCION_STORAGE_PREFIX = 'copiloto-presupuesto-propuesto-resuelto';

/** Valida lo que vino de `localStorage` — la parte genérica (lectura/escritura best-effort) vive en
 * `resolucionCardPropuesta.ts`, compartida con las demás cards `*_propuesto`. */
function leerResolucion(mensajeId: string): Resolucion | null {
  const parsed = leerResolucionCardCruda(claveResolucionCard(RESOLUCION_STORAGE_PREFIX, mensajeId));
  if (typeof parsed !== 'object' || parsed === null || !('estado' in parsed)) return null;
  const p = parsed as Record<string, unknown>;
  if (p.estado === 'guardado') return { estado: 'guardado', numero: typeof p.numero === 'number' ? p.numero : null };
  if (p.estado === 'descartado') return { estado: 'descartado' };
  return null;
}

function guardarResolucion(mensajeId: string, resolucion: Resolucion): void {
  guardarResolucionCard(claveResolucionCard(RESOLUCION_STORAGE_PREFIX, mensajeId), resolucion);
}

export interface TarjetaPresupuestoPropuestoProps {
  propuesta: PresupuestoPropuesto;
  /** El `id` del `ChatMessage` que trae esta card (`assistant-<reply.id>`, ver `useChat.ts`) — clave
   *  del guard cross-reload de arriba. Estable entre reload/rehidratación; distinto por cada dictado. */
  mensajeId: string;
}

export function TarjetaPresupuestoPropuesto({ propuesta, mensajeId }: TarjetaPresupuestoPropuestoProps) {
  const [estado, setEstado] = useState<Estado>(() => leerResolucion(mensajeId)?.estado ?? 'editando');
  const [numero, setNumero] = useState<number | null>(() => {
    const previa = leerResolucion(mensajeId);
    return previa?.estado === 'guardado' ? previa.numero : null;
  });

  if (estado === 'guardado') {
    return (
      <div className="chat-row chat-row--assistant" data-testid="presupuesto-propuesto-guardado">
        <Surface variant="tile" className="propuesta-card propuesta-card--terminal propuesta-card--exito">
          Presupuesto anotado{numero != null ? ` — N° ${numero}` : ''}
        </Surface>
      </div>
    );
  }

  if (estado === 'descartado') {
    return (
      <div className="chat-row chat-row--assistant" data-testid="presupuesto-propuesto-descartado">
        <Surface variant="tile" className="propuesta-card propuesta-card--terminal">
          No lo guardamos.
        </Surface>
      </div>
    );
  }

  return (
    <div className="chat-row chat-row--assistant" data-testid="presupuesto-propuesto">
      <Surface variant="card" blur className="propuesta-card">
        <p className="propuesta-card__aviso">
          Esto entendí. Revisalo, corregí lo que haga falta y tocá Guardar — todavía no lo anoté.
        </p>
        <FormularioPresupuesto
          iniciales={{
            concepto: propuesta.concepto,
            receptor: {
              nombre: propuesta.receptor.nombre,
              docTipo: propuesta.receptor.docTipo,
              docNro: propuesta.receptor.docNro,
              contacto: propuesta.receptor.contacto,
            },
            items: propuesta.items,
          }}
          onCreado={(p) => {
            guardarResolucion(mensajeId, { estado: 'guardado', numero: p.numero });
            setNumero(p.numero);
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
