import { useState } from 'react';

import type { PresupuestoPropuesto } from '@copiloto/core';

import { Surface } from '../../design-system';
import { FormularioPresupuesto } from '../presupuestos/FormularioPresupuesto';
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
 */
type Estado = 'editando' | 'guardado' | 'descartado';

export interface TarjetaPresupuestoPropuestoProps {
  propuesta: PresupuestoPropuesto;
}

export function TarjetaPresupuestoPropuesto({ propuesta }: TarjetaPresupuestoPropuestoProps) {
  const [estado, setEstado] = useState<Estado>('editando');
  const [numero, setNumero] = useState<number | null>(null);

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
            setNumero(p.numero);
            setEstado('guardado');
          }}
          onCancelar={() => setEstado('descartado')}
        />
      </Surface>
    </div>
  );
}
