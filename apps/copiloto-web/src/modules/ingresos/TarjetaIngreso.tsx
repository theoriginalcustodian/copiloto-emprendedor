import { formatearImporte, type Ingreso, type OrigenIngreso } from '@copiloto/core';

import { Badge, Button, Surface } from '../../design-system';

/** Cómo se nombra cada procedencia **desde la vereda del emprendedor** — mismo texto que
 *  `apps/mobile/src/modules/ingresos/PantallaIngresos.tsx` (`ETIQUETA_ORIGEN`). */
const ETIQUETA_ORIGEN: Record<OrigenIngreso, string> = {
  factura: 'de una factura',
  mercadopago: 'por MercadoPago',
  manual: 'lo anotaste vos',
  voz: 'lo dictaste por voz',
};

export interface TarjetaIngresoProps {
  ingreso: Ingreso;
  onBorrar?: (ingreso: Ingreso) => void;
}

/**
 * Port de la fila de `PantallaIngresos.tsx` (RN `Row`) a `Surface` de web — misma composición que
 * `TarjetaGasto`. `origen` se muestra SIEMPRE (Badge), y "Borrar" sólo si `borrable === true`: `null`
 * es "no sé" y ahí no se ofrece (ver docstring de `Ingreso.borrable` en `@copiloto/core`).
 */
export function TarjetaIngreso({ ingreso, onBorrar }: TarjetaIngresoProps) {
  const subtitulo = [
    ingreso.clienteNombre,
    ingreso.concepto,
    ingreso.comprobanteNro != null ? `Factura N° ${ingreso.comprobanteNro}` : null,
    ingreso.medio,
    ingreso.fecha,
  ]
    .filter((x): x is string => x != null && x !== '')
    .join(' · ');

  return (
    <Surface variant="tile" className="tarjeta-ingreso" data-testid={`ingreso-${ingreso.id}`}>
      <div className="tarjeta-ingreso__izquierda">
        <p className="tarjeta-ingreso__titulo" data-testid={`ingreso-${ingreso.id}-monto`}>
          {ingreso.monto != null ? formatearImporte(ingreso.monto) : 'Sin monto'}
        </p>
        {subtitulo !== '' && (
          <p className="tarjeta-ingreso__sub" data-testid={`ingreso-${ingreso.id}-sub`}>
            {subtitulo}
          </p>
        )}
        <Badge variant="neutral" className="tarjeta-ingreso__origen">
          {ETIQUETA_ORIGEN[ingreso.origen]}
        </Badge>
      </div>

      {ingreso.borrable === true && onBorrar != null && (
        <Button
          variant="ghost"
          onClick={() => onBorrar(ingreso)}
          data-testid={`ingreso-${ingreso.id}-borrar`}
        >
          Borrar
        </Button>
      )}
    </Surface>
  );
}
