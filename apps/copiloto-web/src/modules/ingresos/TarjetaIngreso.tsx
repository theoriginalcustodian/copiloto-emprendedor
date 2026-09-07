import { formatearImporte, type Ingreso } from '@copiloto/core';

import { Badge, Button, Surface } from '../../design-system';

export interface TarjetaIngresoProps {
  ingreso: Ingreso;
  onBorrar?: (ingreso: Ingreso) => void;
}

/**
 * Fila de la lista de Ingresos, repintada a la gramática "lista" de Tarea 3 (CLAUDE.md §5, calcada
 * de `.fact` en el mockup fuente — `Prototipo frontend/odobi-ui/prototipo/index.html`, `#ingresos`):
 * título = identidad del cobro (cliente o concepto), subtítulo = origen/tipo · fecha, monto a la
 * derecha — mismo molde que `TarjetaGasto` (el monto ya vivía a la derecha ahí; acá antes vivía como
 * título, así que el swap es real, no cosmético).
 *
 * ⚠️ **PR#474 (decisión de producto YA TOMADA, no se reabre acá):** el chip de `origen` por fila
 * (antes `Badge` con "de una factura"/"por MercadoPago"/etc en TODAS las filas) desaparece.
 * Sobrevive un único chip, y sólo cuando falta un dato: **"Falta de quién"** — cuando ni
 * `clienteNombre` ni `concepto` identifican el cobro (mockup: fila "Cobro sin detalle"). El resto
 * de las filas NO llevan chip, aunque tampoco tengan cliente propio — un concepto ("Seña reforma"
 * en el mockup) identifica el cobro tanto como un nombre de cliente.
 */
export function TarjetaIngreso({ ingreso, onBorrar }: TarjetaIngresoProps) {
  const titulo = ingreso.clienteNombre ?? ingreso.concepto ?? 'Cobro sin detalle';
  const sinIdentificar = ingreso.clienteNombre == null && ingreso.concepto == null;

  const subtitulo =
    ingreso.origen === 'factura' && ingreso.comprobanteNro != null
      ? [`Factura ${ingreso.comprobanteNro}`, ingreso.fecha].filter((x): x is string => x != null && x !== '').join(' · ')
      : [ingreso.medio, ingreso.fecha].filter((x): x is string => x != null && x !== '').join(' · ');

  return (
    <Surface variant="tile" className="tarjeta-ingreso" data-testid={`ingreso-${ingreso.id}`}>
      <div className="tarjeta-ingreso__izquierda">
        <p className="tarjeta-ingreso__titulo" data-testid={`ingreso-${ingreso.id}-titulo`}>
          {titulo}
        </p>
        {subtitulo !== '' && (
          <p className="tarjeta-ingreso__sub" data-testid={`ingreso-${ingreso.id}-sub`}>
            {subtitulo}
          </p>
        )}
        {sinIdentificar && (
          <Badge variant="warning" className="tarjeta-ingreso__falta" data-testid={`ingreso-${ingreso.id}-falta`}>
            Falta de quién
          </Badge>
        )}
      </div>

      <div className="tarjeta-ingreso__derecha">
        {/* Nunca "$0" cuando falta el monto — el em-dash dice "no sé", "$0" diría "cobraste cero". */}
        <span className="tarjeta-ingreso__monto" data-testid={`ingreso-${ingreso.id}-monto`}>
          {ingreso.monto != null ? formatearImporte(ingreso.monto) : '—'}
        </span>
        {ingreso.borrable === true && onBorrar != null && (
          <Button
            variant="ghost"
            onClick={() => onBorrar(ingreso)}
            data-testid={`ingreso-${ingreso.id}-borrar`}
          >
            Borrar
          </Button>
        )}
      </div>
    </Surface>
  );
}
