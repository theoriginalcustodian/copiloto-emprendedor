import { useState } from 'react';

import type { DatosCliente, DuplicadoCliente } from '@copiloto/core';

import { Surface } from '../../design-system';
import { FormularioCliente } from '../clientes/FormularioCliente';
import { claveResolucionCard, guardarResolucionCard, leerResolucionCardCruda } from './resolucionCardPropuesta';
import './chat.css';

/**
 * `TarjetaClientePropuesto` — lo que el copiloto entendió de un cliente dictado, editable antes del
 * alta. Puerto de `apps/mobile/src/modules/chat/TarjetaClientePropuesto.tsx` (contrato
 * `cards-propuesto-web`, 2026-08-12 — 2ª de las 3 cards nuevas).
 *
 * 🔴 **`ya_existe` (409 por documento) NO ofrece "Abrir ese cliente" acá — a propósito, y es deuda
 * anotada, no un olvido.** Mobile navega con `empujarUnaVez`; web no tiene, HOY, ningún callback de
 * navegación que llegue hasta `MessageList` (ni `ChatScreen`, ni `AppShell`/`DesktopShell`, exponen
 * uno — a diferencia de `ActividadScreen`, que sí lo recibe de la cáscara). Cablear eso es tocar 2
 * shells + `ClientesScreen` para soportar abrir una ficha puntual por id, que HOY tampoco existe:
 * es una expansión de infraestructura ortogonal a portar 3 cards, no una más de las tres. Se prioriza
 * cerrar gasto/cliente/ingreso primero (DoD §5 del contrato, vía de escape explícita) y se deja
 * anotado en un `hallazgo_` al buzón. El emprendedor igual ve el resultado correcto —"ya lo tenés"—,
 * sólo sin el atajo de un toque.
 *
 * Guard cross-reload: mismo mecanismo que `TarjetaGastoPropuesto`/`TarjetaPresupuestoPropuesto`
 * (`resolucionCardPropuesta.ts`), prefijo propio. Cubre los 3 estados terminales (`guardado`,
 * `ya_existe`, `descartado`) — no sólo el que escribe, porque el objetivo es que un reload no vuelva
 * a mostrar el formulario editable de una card ya resuelta, sea cual sea la resolución.
 */
type Estado =
  | { fase: 'editando' }
  | { fase: 'guardado'; nombre: string }
  | { fase: 'ya_existe'; duenoNombre: string | null }
  | { fase: 'descartado' };

type Resolucion =
  | { estado: 'guardado'; nombre: string }
  | { estado: 'ya_existe'; duenoNombre: string | null }
  | { estado: 'descartado' };

const RESOLUCION_STORAGE_PREFIX = 'copiloto-cliente-propuesto-resuelto';

function leerResolucion(mensajeId: string): Resolucion | null {
  const parsed = leerResolucionCardCruda(claveResolucionCard(RESOLUCION_STORAGE_PREFIX, mensajeId));
  if (typeof parsed !== 'object' || parsed === null || !('estado' in parsed)) return null;
  const p = parsed as Record<string, unknown>;
  if (p.estado === 'guardado' && typeof p.nombre === 'string') return { estado: 'guardado', nombre: p.nombre };
  if (p.estado === 'ya_existe') {
    return { estado: 'ya_existe', duenoNombre: typeof p.duenoNombre === 'string' ? p.duenoNombre : null };
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
  if (previa.estado === 'ya_existe') return { fase: 'ya_existe', duenoNombre: previa.duenoNombre };
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
}

export function TarjetaClientePropuesto({ propuesta, texto, mensajeId }: TarjetaClientePropuestoProps) {
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
    return (
      <div className="chat-row chat-row--assistant" data-testid="cliente-propuesto-ya-existe">
        <Surface variant="tile" className="propuesta-card propuesta-card--terminal">
          {estado.duenoNombre != null
            ? `Ese cliente ya está en tu cartera: ${estado.duenoNombre}.`
            : 'Ese cliente ya está en tu cartera.'}
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
    guardarResolucion(mensajeId, { estado: 'ya_existe', duenoNombre });
    setEstado({ fase: 'ya_existe', duenoNombre });
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
