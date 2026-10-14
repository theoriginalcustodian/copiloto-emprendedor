import {
  estadoFacturacionCliente,
  facturacionDeCliente,
  subtituloDeCliente,
  textoComprobantes,
  textoMontoCliente,
  type Cliente,
} from '@copiloto/core';

import { Surface } from '../../design-system';

// Las tres reglas de TEXTO del slot de facturación viven en el core (`textoMontoCliente`,
// `estadoFacturacionCliente`, `textoComprobantes`) para que web y mobile digan lo mismo. Se re-exporta
// `textoComprobantes` porque el test de esta tarjeta y otros consumidores la importan desde acá.
export { textoComprobantes };

/**
 * Port directo de `apps/mobile/src/modules/clientes/TarjetaCliente.tsx` — MISMA regla de
 * subtítulo (primer dato que identifique, para no dejar homónimos indistinguibles en la lista;
 * ver el docstring de ese archivo) como *fallback* cuando no hay documento cargado.
 *
 * Repintado Tarea 3 (anatomía de función, CLAUDE.md §5): fila calcada de `.fact` del mockup
 * fuente (`Prototipo frontend/odobi-ui/prototipo/index.html`, bloque `#clientes`) — tile-ícono
 * (persona) + nombre/subtítulo + monto/chip de estado a la derecha. Con documento cargado el
 * subtítulo pasa a ser "CUIT/DNI · condición fiscal" (el formato del mockup); sin documento cae
 * al primer dato de contacto disponible, para no perder info del "cliente de mostrador" que sólo
 * tiene nombre y teléfono.
 *
 * El slot del monto sigue la regla única de C-D1 (`facturacionDeCliente`, en el core): con el par
 * `monto_facturado` + `facturas_atribuibles` del listado pinta «$importe · N comprobantes»; con
 * `facturas_atribuibles: false` pinta «—» (NUNCA un número: el "0.00" ahí es «no se puede saber»). Si
 * el backend no declaró el par (versión anterior), cae a la cantidad de comprobantes (BL-V18) y, sin
 * ella, a «—»: nunca un cero inventado. El chip de estado dice lo MEDIDO — «Sin CUIT cargado» /
 * «Todavía sin comprar» — y sólo sin esa señal cae a `origen` (`derivado` → «Se agregó solo»,
 * mockup `.estado.auto`).
 */
export interface TarjetaClienteProps {
  cliente: Cliente;
  onSelect?: (cliente: Cliente) => void;
}

export function TarjetaCliente({ cliente, onSelect }: TarjetaClienteProps) {
  const subtitulo = subtituloDeCliente(cliente);

  const estado = estadoFacturacionCliente(facturacionDeCliente(cliente), cliente.origen === 'derivado');

  return (
    <Surface
      variant="tile"
      className="tarjeta-cliente"
      data-testid={`cliente-${cliente.id}`}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? () => onSelect(cliente) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(cliente);
            }
          : undefined
      }
    >
      <span className="tarjeta-cliente__icono" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor">
          <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z" />
        </svg>
      </span>
      <div className="tarjeta-cliente__izquierda">
        <p className="tarjeta-cliente__nombre" data-testid={`cliente-${cliente.id}-nombre`}>
          {cliente.nombre}
        </p>
        {subtitulo != null && (
          <p className="tarjeta-cliente__sub" data-testid={`cliente-${cliente.id}-sub`}>
            {subtitulo}
          </p>
        )}
      </div>
      <div className="tarjeta-cliente__derecha">
        <span className="tarjeta-cliente__monto" data-testid={`cliente-${cliente.id}-monto`}>
          {textoMontoCliente(cliente)}
        </span>
        {estado != null && (
          <span
            className={`tarjeta-cliente__estado${estado.auto ? ' tarjeta-cliente__estado--auto' : ''}`}
            data-testid={`cliente-${cliente.id}-estado`}
          >
            {estado.texto}
          </span>
        )}
      </div>
    </Surface>
  );
}
