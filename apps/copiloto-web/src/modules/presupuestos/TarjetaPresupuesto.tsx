import { formatearFechaCorta, formatearImporte, type Presupuesto } from '@copiloto/core';

import { Badge, Surface } from '../../design-system';

/**
 * El ícono de fila — mismo trazo en las tres filas del mockup fuente (`#presu .fact .tile svg`,
 * `Prototipo frontend/odobi-ui/prototipo/index.html`), portado literal (no es un ícono por tipo de
 * presupuesto: el mockup usa el mismo glifo siempre). Decorativo — el título ya dice de qué se trata.
 */
function IconoPresupuesto() {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M168,152a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,152Zm-8-40H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm56-64V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V48A16,16,0,0,1,56,32H92.26a47.92,47.92,0,0,1,71.48,0H200A16,16,0,0,1,216,48ZM96,64h64a32,32,0,0,0-64,0ZM200,48H173.25A47.93,47.93,0,0,1,176,64v8a8,8,0,0,1-8,8H88a8,8,0,0,1-8-8V64a47.93,47.93,0,0,1,2.75-16H56V216H200Z" />
    </svg>
  );
}

/** `null` de vuelta = fecha vacía o ilegible — no se inventa un "0 días". */
function diasDesde(fechaIso: string): number | null {
  if (fechaIso === '') return null;
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return null;
  const dias = Math.floor((Date.now() - fecha.getTime()) / 86_400_000);
  return dias >= 0 ? dias : null;
}

function textoDias(dias: number): string {
  return dias === 1 ? '1 día' : `${dias} días`;
}

interface ChipEstado {
  texto: string;
  /** `true` = tono que llama la atención (mockup: `.estado.pend`, sin fondo, `--core`). */
  atencion: boolean;
}

/**
 * El chip de estado de la fila — gramática del mockup fuente (`#presu .estado` / `.estado.pend`):
 * UNA sola clase visual neutral cubre "Enviado" y "Aceptado" (y acá también "Rechazado", que el
 * mockup no ilustra pero el contrato sí declara — `EstadoPresupuesto`); sólo el matiz "se enfría"
 * (`sinRespuesta === true`, más de 30 días sin respuesta según el backend) cambia de tono.
 *
 * `estado === null` → "el backend todavía no manda este campo", NO "pendiente" (docstring de
 * `Presupuesto.estado` en core). No se inventa un chip para un dato que no se tiene: la fila no
 * muestra ninguno.
 */
function chipDe(p: Presupuesto): ChipEstado | null {
  if (p.estado === 'aprobado') return { texto: 'Aceptado', atencion: false };
  if (p.estado === 'desestimado') return { texto: 'Rechazado', atencion: false };
  if (p.estado === 'pendiente') {
    const dias = diasDesde(p.fecha);
    const sufijo = dias != null ? ` · ${textoDias(dias)}` : '';
    return p.sinRespuesta === true
      ? { texto: `Se enfría${sufijo}`, atencion: true }
      : { texto: `Enviado${sufijo}`, atencion: false };
  }
  return null;
}

/**
 * Port de `apps/mobile/src/modules/presupuestos/TarjetaPresupuesto.tsx`, repintado a la anatomía de
 * fila del mockup fuente (Tarea 3, CLAUDE.md §5, `#presu .fact`): tile-ícono + título (receptor) +
 * subtítulo (concepto · fecha) + monto + chip de estado. El resumen sigue siendo DERIVADO (nunca un
 * texto guardado); `cantidadItems`/N° ya no se muestran en la fila compacta (viven en el detalle,
 * `DetallePresupuesto.tsx`, fuera de este repintado). `cantidadItems`, nunca `items.length` — el
 * listado omite `items`. El badge de FACTURADO sale de `facturado`, nunca de `facturaId != null` —
 * ver el docstring de `Presupuesto.facturado` en core.
 */
export interface TarjetaPresupuestoProps {
  presupuesto: Presupuesto;
  onSelect?: (presupuesto: Presupuesto) => void;
}

export function TarjetaPresupuesto({ presupuesto: p, onSelect }: TarjetaPresupuestoProps) {
  const fecha = formatearFechaCorta(p.fecha);
  const subtitulo = fecha !== '' ? `${p.concepto} · ${fecha}` : p.concepto;
  const chip = chipDe(p);

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
      <span className="tarjeta-presupuesto__icono">
        <IconoPresupuesto />
      </span>

      <div className="tarjeta-presupuesto__cuerpo">
        <p className="tarjeta-presupuesto__nombre" data-testid={`presupuesto-${p.id}-nombre`}>
          {p.receptor.nombre !== '' ? p.receptor.nombre : `Presupuesto N° ${p.numero}`}
        </p>
        <p className="tarjeta-presupuesto__detalle" data-testid={`presupuesto-${p.id}-detalle`}>
          {subtitulo}
        </p>
      </div>

      <div className="tarjeta-presupuesto__derecha">
        <span className="tarjeta-presupuesto__total" data-testid={`presupuesto-${p.id}-total`}>
          {formatearImporte(p.total)}
        </span>
        {chip != null && (
          <span
            className={`tarjeta-presupuesto__chip${chip.atencion ? ' tarjeta-presupuesto__chip--atencion' : ''}`}
            data-testid={`presupuesto-${p.id}-chip`}
          >
            {chip.texto}
          </span>
        )}
      </div>

      {(p.facturado || p.reemplazadoPor != null) && (
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
      )}
    </Surface>
  );
}
