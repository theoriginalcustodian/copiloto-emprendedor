import { useState } from 'react';

import type { DatosCliente, DuplicadoCliente } from '@copiloto/core';

import { Button, Surface } from '../../design-system';
import { FormularioCliente } from '../clientes/FormularioCliente';
import { claveResolucionCard, guardarResolucionCard, leerResolucionCardCruda } from './resolucionCardPropuesta';
import './chat.css';

/**
 * `TarjetaClientePropuesto` — lo que el copiloto entendió de un cliente dictado, editable antes del
 * alta. Puerto de `apps/mobile/src/modules/chat/TarjetaClientePropuesto.tsx` (contrato
 * `cards-propuesto-web`, 2026-08-12 — 2ª de las 3 cards nuevas).
 *
 * `ya_existe` (409 por documento) ofrece un botón **"Ver cliente"** cuando el caller pasa
 * `onAbrirCliente` — D14 (2026-08-13) cerró el `hallazgo_` que esta card misma dejó anotado
 * (`cards-propuesto-web`, 2026-08-12): cableó `clienteIdInicial` en `ClientesScreen` + el estado
 * `clienteIdAbierto` en ambos shells, y acá sólo consume ese mecanismo ya existente. Sin el prop
 * (caller no lo pasa) la card sigue mostrando el texto solo, sin botón — mismo criterio que el resto
 * de los callbacks opcionales de este archivo.
 *
 * ⚠️ **Ojo con el nombre.** El `onAbrirCliente` de ESTE componente es `(id: number) => void` —
 * navegación por id, misma familia que `ActividadScreen`/`EscritorioScreen`/los shells. Es un prop
 * DISTINTO del `onAbrirCliente={(c) => …}` que unas líneas más abajo se le pasa a
 * `FormularioCliente` (`(cliente: Cliente) => void`, resuelve el 409-por-nombre localmente, no
 * navega) — comparten nombre por historia, no por contrato; TypeScript los mantiene separados por la
 * firma.
 *
 * Guard cross-reload: mismo mecanismo que `TarjetaGastoPropuesto`/`TarjetaPresupuestoPropuesto`
 * (`resolucionCardPropuesta.ts`), prefijo propio. Cubre los 3 estados terminales (`guardado`,
 * `ya_existe`, `descartado`) — no sólo el que escribe, porque el objetivo es que un reload no vuelva
 * a mostrar el formulario editable de una card ya resuelta, sea cual sea la resolución.
 */
type Estado =
  | { fase: 'editando' }
  | { fase: 'guardado'; nombre: string }
  | { fase: 'ya_existe'; duenoNombre: string | null; duenoId: number | null }
  | { fase: 'descartado' };

type Resolucion =
  | { estado: 'guardado'; nombre: string }
  | { estado: 'ya_existe'; duenoNombre: string | null; duenoId: number | null }
  | { estado: 'descartado' };

const RESOLUCION_STORAGE_PREFIX = 'copiloto-cliente-propuesto-resuelto';

function leerResolucion(mensajeId: string): Resolucion | null {
  const parsed = leerResolucionCardCruda(claveResolucionCard(RESOLUCION_STORAGE_PREFIX, mensajeId));
  if (typeof parsed !== 'object' || parsed === null || !('estado' in parsed)) return null;
  const p = parsed as Record<string, unknown>;
  if (p.estado === 'guardado' && typeof p.nombre === 'string') return { estado: 'guardado', nombre: p.nombre };
  if (p.estado === 'ya_existe') {
    return {
      estado: 'ya_existe',
      duenoNombre: typeof p.duenoNombre === 'string' ? p.duenoNombre : null,
      duenoId: typeof p.duenoId === 'number' ? p.duenoId : null,
    };
  }
  if (p.estado === 'descartado') return { estado: 'descartado' };
  return null;
}

function guardarResolucion(mensajeId: string, resolucion: Resolucion): void {
  guardarResolucionCard(claveResolucionCard(RESOLUCION_STORAGE_PREFIX, mensajeId), resolucion);
}

function estadoInicial(mensajeId: string): Estado {
  const previa = leerResolucion(mensajeId);
  if (previa == null) return { fase: 'editando' };
  if (previa.estado === 'guardado') return { fase: 'guardado', nombre: previa.nombre };
  if (previa.estado === 'ya_existe') {
    return { fase: 'ya_existe', duenoNombre: previa.duenoNombre, duenoId: previa.duenoId };
  }
  return { fase: 'descartado' };
}

export interface TarjetaClientePropuestoProps {
  propuesta: DatosCliente;
  /**
   * Lo que el copiloto dijo junto a la propuesta — p.ej. la explicación de por qué `docTipo` quedó
   * `null` con un `docNro` lleno. NO es una cita literal (no va entre «comillas»): es la explicación
   * del copiloto, ver el docstring de mobile.
   */
  texto?: string;
  /** El `id` del `ChatMessage` que trae esta card — clave del guard cross-reload. */
  mensajeId: string;
  /** D14 — navega a la ficha del dueño en `ya_existe` (409 por documento). Ver el docstring del
   * archivo: es `(id: number) => void`, DISTINTO del `onAbrirCliente` que este componente le pasa a
   * `FormularioCliente` más abajo. Sin este prop, `ya_existe` no ofrece el botón. */
  onAbrirCliente?: (id: number) => void;
}

export function TarjetaClientePropuesto({
  propuesta,
  texto,
  mensajeId,
  onAbrirCliente,
}: TarjetaClientePropuestoProps) {
  const [estado, setEstado] = useState<Estado>(() => estadoInicial(mensajeId));

  if (estado.fase === 'guardado') {
    return (
      <div className="chat-row chat-row--assistant" data-testid="cliente-propuesto-guardado">
        <Surface variant="tile" className="propuesta-card propuesta-card--terminal propuesta-card--exito">
          Cliente agregado: {estado.nombre}
        </Surface>
      </div>
    );
  }

  if (estado.fase === 'ya_existe') {
    const { duenoNombre, duenoId } = estado;
    return (
      <div className="chat-row chat-row--assistant" data-testid="cliente-propuesto-ya-existe">
        <Surface variant="tile" className="propuesta-card propuesta-card--terminal">
          <p>
            {duenoNombre != null
              ? `Ese cliente ya está en tu cartera: ${duenoNombre}.`
              : 'Ese cliente ya está en tu cartera.'}
          </p>
          {duenoId != null && onAbrirCliente != null && (
            <Button
              variant="cancel"
              onClick={() => onAbrirCliente(duenoId)}
              data-testid="cliente-propuesto-ver-cliente"
            >
              Ver cliente
            </Button>
          )}
        </Surface>
      </div>
    );
  }

  if (estado.fase === 'descartado') {
    return (
      <div className="chat-row chat-row--assistant" data-testid="cliente-propuesto-descartado">
        <Surface variant="tile" className="propuesta-card propuesta-card--terminal">
          No lo agregamos.
        </Surface>
      </div>
    );
  }

  const dicho = texto?.trim();

  function onDuplicado(duplicado: DuplicadoCliente) {
    const duenoNombre = duplicado.dueno?.nombre ?? null;
    const duenoId = duplicado.dueno?.id ?? null;
    guardarResolucion(mensajeId, { estado: 'ya_existe', duenoNombre, duenoId });
    setEstado({ fase: 'ya_existe', duenoNombre, duenoId });
  }

  return (
    <div className="chat-row chat-row--assistant" data-testid="cliente-propuesto">
      <Surface variant="card" blur className="propuesta-card">
        <p className="propuesta-card__aviso">Esto entendí. Revisalo y tocá Dar de alta — todavía no lo agregué.</p>
        {dicho != null && dicho !== '' && <p className="propuesta-card__aviso">{dicho}</p>}
        <FormularioCliente
          iniciales={propuesta}
          onGuardado={(cliente) => {
            guardarResolucion(mensajeId, { estado: 'guardado', nombre: cliente.nombre });
            setEstado({ fase: 'guardado', nombre: cliente.nombre });
          }}
          onDuplicado={onDuplicado}
          // El homónimo (por NOMBRE) se resuelve DENTRO del propio `FormularioCliente` (`forzar` /
          // abrir): acá sólo llega el 409 por DOCUMENTO, que es el que sí cierra la card entera —
          // ver el docstring de `onDuplicado` en `FormularioCliente`.
          onAbrirCliente={(c) => onDuplicado({ por: 'documento', dueno: c })}
          onCancelar={() => {
            guardarResolucion(mensajeId, { estado: 'descartado' });
            setEstado({ fase: 'descartado' });
          }}
        />
      </Surface>
    </div>
  );
}
