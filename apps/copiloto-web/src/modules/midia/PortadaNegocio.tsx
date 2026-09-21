import { formatearImporte, type Portada } from '@copiloto/core';

import { Surface } from '../../design-system';

export interface PortadaNegocioProps {
  portada: Portada;
}

/** Un importe de la portada: «—» si no vino, NUNCA «$0». Mostrar cero cuando falta un dato es
 *  mentirle al usuario sobre su negocio — regla dura del repo (la misma que usa Inteligencia). */
const importe = (v: string | null): string => (v != null ? formatearImporte(v) : '—');

/**
 * `PortadaNegocio` — el bloque de arriba de Mi día: cómo viene el negocio, en un vistazo (BL-W8;
 * port de `apps/mobile/src/modules/midia/PortadaNegocio.tsx`, «el bloque negro es EL golpe de color
 * de la pantalla»).
 *
 * **Autocontenido:** recibe el dato por prop y no sabe dónde está montado (BL-X1 puede mover Mi día
 * de lugar sin tocarlo); quién lo lee de la red es el contenedor.
 *
 * El trío Entró / Salió / Por cobrar va ADENTRO del bloque: son la lectura del saldo, no tres KPIs
 * sueltos.
 *
 * ⚠️ Lo que el prototipo tiene y acá NO se fabrica: el delta «vs julio» y la línea «faltan los cobros
 * de hoy» esperan `BL-J2`/`BL-J3` y `BL-J4` (K-03 / K-09) — un porcentaje o un aviso inventados sobre
 * el dinero de alguien son justo la mentira que este sistema prohíbe.
 */
export function PortadaNegocio({ portada }: PortadaNegocioProps) {
  const trio: readonly [string, string, string | null][] = [
    ['Entró', 'entro', portada.mes.ingresos],
    ['Salió', 'salio', portada.mes.gastos],
    ['Por cobrar', 'por-cobrar', portada.porCobrar.total],
  ];

  return (
    <Surface variant="bloque" className="midia-portada" data-testid="midia-portada">
      <p className="midia-portada__rotulo">En caja</p>
      <p className="midia-portada__cifra" data-testid="midia-portada-caja">
        {importe(portada.caja.saldo)}
      </p>
      <div className="midia-portada__trio">
        {trio.map(([etiqueta, id, valor]) => (
          <div key={id} className="midia-portada__celda" data-testid={`midia-portada-${id}`}>
            <span>{etiqueta}</span>
            <b>{importe(valor)}</b>
          </div>
        ))}
      </div>
    </Surface>
  );
}
