import { formatearFechaCorta, formatearImporte, type Presupuesto } from '@copiloto/core';

import { Badge, Surface } from '../../design-system';

/**
 * Port de `apps/mobile/src/modules/presupuestos/TarjetaPresupuesto.tsx` — MISMA regla: el resumen es
 * DERIVADO (receptor · total arriba, N°/concepto/cantidadItems/fecha abajo), nunca un texto guardado.
 * `cantidadItems`, nunca `items.length` (el listado omite `items`). El badge de FACTURADO sale de
 * `facturado`, nunca de `facturaId != null` — ver el docstring de `Presupuesto.facturado` en core.
 */
export interface TarjetaPresupuestoProps {
  presupuesto: Presupuesto;
  onSelect?: (presupuesto: Presupuesto) => void;
}

export function TarjetaPresupuesto({ presupuesto: p, onSelect }: TarjetaPresupuestoProps) {
  const fecha = formatearFechaCorta(p.fecha);
  const itemsTexto = p.cantidadItems === 1 ? '1 ítem' : `${p.cantidadItems} ítems`;

  return (
    <Surface
      variant="tile"
      className="tarjeta-presupuesto"
      data-testid={`presupuesto-${p.id}`}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? () => onSelect(p) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(p);
            }
          : undefined
      }
    >
      <div className="tarjeta-presupuesto__fila-superior">
        <p className="tarjeta-presupuesto__nombre" data-testid={`presupuesto-${p.id}-nombre`}>
          {p.receptor.nombre !== '' ? p.receptor.nombre : `Presupuesto N° ${p.numero}`}
        </p>
        <span className="tarjeta-presupuesto__total" data-testid={`presupuesto-${p.id}-total`}>
          {formatearImporte(p.total)}
        </span>
      </div>

      <p className="tarjeta-presupuesto__detalle" data-testid={`presupuesto-${p.id}-detalle`}>
        N° {p.numero} · {p.concepto} · {itemsTexto}
        {fecha !== '' ? ` · ${fecha}` : ''}
      </p>

      <div className="tarjeta-presupuesto__badges" data-testid={`presupuesto-${p.id}-badges`}>
        {p.facturado && (
          <span data-testid={`presupuesto-${p.id}-badge-facturado`}>
            <Badge variant="ok">FACTURADO</Badge>
          </span>
        )}
        {/* Sólo se ve viniendo del historial: el listado por default ya no trae los reemplazados. */}
        {p.reemplazadoPor != null && (
          <span data-testid={`presupuesto-${p.id}-badge-reemplazado`}>
            <Badge variant="neutral">REEMPLAZADO</Badge>
          </span>
        )}
      </div>
    </Surface>
  );
}
