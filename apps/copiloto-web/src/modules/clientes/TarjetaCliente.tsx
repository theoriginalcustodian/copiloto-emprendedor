import type { Cliente } from '@copiloto/core';

import { Surface } from '../../design-system';

const ETIQUETA_DOC: Record<number, string> = { 80: 'CUIT', 96: 'DNI' };

/**
 * Etiquetas abreviadas para el subtítulo de una fila angosta — mismo criterio que `ETIQUETA_DOC`
 * de acá arriba: un mapa LOCAL de presentación, no el catálogo completo de
 * `modules/facturacion/catalogos.ts` (`OPCIONES_CONDICION_IVA_RECEPTOR`, con etiquetas largas
 * para un `<select>`). Los códigos son los mismos (`CondicionIVA` de AFIP) — acá sólo se lee un
 * dato que ya llegó, no se valida ni se envía nada.
 */
const ETIQUETA_CONDICION_IVA: Record<number, string> = {
  1: 'Resp. Inscripto',
  4: 'Exento',
  5: 'Consumidor Final',
  6: 'Monotributo',
};

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
 * El slot del monto muestra la cantidad de comprobantes del cliente (BL-V18, A12) cuando el listado
 * la trae (`comprobantesCantidad`, sólo en `GET /clientes`). Si no viene, cae a "—": nunca un "$0" ni
 * un cero inventado. El monto facturado en pesos sigue sin existir en la API. El chip de estado usa el
 * único dato real disponible (`origen`) — `derivado` es "Se agregó solo" (mockup: `.estado.auto`); el
 * resto, "Todavía sin comprar".
 */
/**
 * BL-V18 (A12): cantidad de comprobantes en el slot del monto. `undefined` (el listado no lo trajo)
 * cae a «—»: un cero que el backend no declaró sería mentira. El backend declara `0` cuando el cliente
 * no tiene comprobantes, y ahí sí se muestra.
 */
export function textoComprobantes(n: number | undefined): string {
  if (n == null) return '—';
  return n === 1 ? '1 comprobante' : `${n} comprobantes`;
}

export interface TarjetaClienteProps {
  cliente: Cliente;
  onSelect?: (cliente: Cliente) => void;
}

export function TarjetaCliente({ cliente, onSelect }: TarjetaClienteProps) {
  const doc =
    cliente.docNro != null && cliente.docNro !== ''
      ? `${ETIQUETA_DOC[cliente.docTipo ?? 0] ?? 'Doc'} ${cliente.docNro}`
      : null;

  const subtitulo =
    doc != null
      ? `${doc} · ${
          cliente.condicionIva != null
            ? (ETIQUETA_CONDICION_IVA[cliente.condicionIva] ?? 'Condición no identificada')
            : 'sin condición cargada'
        }`
      : ([cliente.telefono, cliente.email, cliente.domicilio, cliente.notas]
          .map((x) => (x != null && x.trim() !== '' ? x.trim() : null))
          .find((x) => x != null) ?? null);

  const esAuto = cliente.origen === 'derivado';

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
          {textoComprobantes(cliente.comprobantesCantidad)}
        </span>
        <span
          className={`tarjeta-cliente__estado${esAuto ? ' tarjeta-cliente__estado--auto' : ''}`}
          data-testid={`cliente-${cliente.id}-estado`}
        >
          {esAuto ? 'Se agregó solo' : 'Todavía sin comprar'}
        </span>
      </div>
    </Surface>
  );
}
