import { formatearImporte, type ActividadItem } from '@copiloto/core';

import { Surface } from '../../design-system';
import { destinoDe } from './destinoActividad';

const ICONO_POR_TIPO: Record<string, string> = {
  factura: '🧾',
  nota_credito: '🧾',
  presupuesto: '📝',
  gasto: '💸',
  ingreso: '📈',
  cliente: '👤',
};

/**
 * Port de `apps/mobile/src/modules/actividad/FilaActividad.tsx`. MISMA regla: no compone texto de
 * negocio (`titulo`/`detalle` vienen del backend tal cual) y el color sale de `signo`, no del `tipo`
 * — un `signo` no reconocido cae en `neutro` (sin color), nunca se inventa un color.
 *
 * Tappable SÓLO si `destinoDe(item)` resuelve un destino real (ver `destinoActividad.ts`): un ítem
 * que se toca y no hace nada se lee como "la app está rota", no como "esa función todavía no está".
 */
export interface FilaActividadProps {
  item: ActividadItem;
  onAbrirGasto?: (id: number) => void;
  onAbrirCliente?: (id: number) => void;
}

export function FilaActividad({ item, onAbrirGasto, onAbrirCliente }: FilaActividadProps) {
  const icono = ICONO_POR_TIPO[item.tipo] ?? '🕐';
  const destino = destinoDe(item);

  const onSelect = (() => {
    if (destino == null) return undefined;
    if (destino.pathname === '/gastos' && onAbrirGasto != null) {
      return () => onAbrirGasto(Number(destino.params.gastoId));
    }
    if (destino.pathname === '/clientes' && onAbrirCliente != null) {
      return () => onAbrirCliente(Number(destino.params.clienteId));
    }
    return undefined;
  })();

  return (
    <Surface
      variant="tile"
      className="fila-actividad"
      data-testid={`actividad-${item.id}`}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect();
            }
          : undefined
      }
    >
      <span className="fila-actividad__icono" aria-hidden="true">{icono}</span>
      <div className="fila-actividad__texto">
        <p className="fila-actividad__titulo" data-testid={`actividad-${item.id}-titulo`}>
          {item.titulo}
        </p>
        {item.detalle !== '' && (
          <p className="fila-actividad__detalle" data-testid={`actividad-${item.id}-detalle`}>
            {item.detalle}
          </p>
        )}
      </div>
      {item.monto != null && (
        <span
          className={`fila-actividad__monto fila-actividad__monto--${item.signo}`}
          data-testid={`actividad-${item.id}-monto`}
        >
          {item.signo === 'sale' ? '−' : ''}
          {formatearImporte(item.monto)}
        </span>
      )}
    </Surface>
  );
}
