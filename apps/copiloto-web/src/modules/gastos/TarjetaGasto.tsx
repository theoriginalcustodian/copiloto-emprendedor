import { ETIQUETA_CATEGORIA, formatearImporte, type Gasto } from '@copiloto/core';

import { Surface } from '../../design-system';

/** Port directo de `apps/mobile/src/modules/gastos/TarjetaGasto.tsx` — ver ese archivo para el
 * porqué de `formatearImporte` (nunca `Number().toLocaleString()`) y el ícono sólo en no-manual. */
const ICONO_ORIGEN: Record<string, string> = { voz: '🎙', foto: '📷' };

export interface TarjetaGastoProps {
  gasto: Gasto;
  onSelect?: (gasto: Gasto) => void;
}

export function TarjetaGasto({ gasto, onSelect }: TarjetaGastoProps) {
  const icono = ICONO_ORIGEN[gasto.origen];
  const titulo = gasto.proveedor ?? ETIQUETA_CATEGORIA[gasto.categoria];

  return (
    <Surface
      variant="tile"
      className="tarjeta-gasto"
      data-testid={`gasto-${gasto.id}`}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? () => onSelect(gasto) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(gasto);
            }
          : undefined
      }
    >
      <div className="tarjeta-gasto__izquierda">
        <p className="tarjeta-gasto__titulo" data-testid={`gasto-${gasto.id}-titulo`}>
          {icono != null ? `${icono} ` : ''}
          {titulo}
        </p>
        <p className="tarjeta-gasto__sub" data-testid={`gasto-${gasto.id}-sub`}>
          {ETIQUETA_CATEGORIA[gasto.categoria]} · {gasto.fecha}
        </p>
      </div>
      <span className="tarjeta-gasto__monto" data-testid={`gasto-${gasto.id}-monto`}>
        {formatearImporte(gasto.monto)}
      </span>
    </Surface>
  );
}
