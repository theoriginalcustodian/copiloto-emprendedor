import type { Cliente } from '@copiloto/core';

import { Surface } from '../../design-system';

const ETIQUETA_DOC: Record<number, string> = { 80: 'CUIT', 96: 'DNI' };

/** Port directo de `apps/mobile/src/modules/clientes/TarjetaCliente.tsx` — MISMA regla de
 * subtítulo (primer dato que identifique, para no dejar homónimos indistinguibles en la lista;
 * ver el docstring de ese archivo). Sólo cambia la capa de presentación. */
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
    [doc, cliente.telefono, cliente.email, cliente.domicilio, cliente.notas]
      .map((x) => (x != null && x.trim() !== '' ? x.trim() : null))
      .find((x) => x != null) ?? null;

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
      {cliente.origen !== 'derivado' && (
        <span className="tarjeta-cliente__origen" data-testid={`cliente-${cliente.id}-origen`}>
          {cliente.origen === 'voz' ? '🎙' : '✎'}
        </span>
      )}
    </Surface>
  );
}
