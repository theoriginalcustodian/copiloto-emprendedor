import { useState } from 'react';

import type { EstadoFacturaResp, NuevoItem } from '@copiloto/core';

import { Button } from '../../design-system';

/**
 * Paso 2 — Ítems. Port de `apps/mobile/src/modules/facturacion/PasoItems.tsx` — lista + alta + borrado.
 * 🔴 **`subtotal`/`total` los muestra tal cual los manda el backend (`estado.items[].subtotal`,
 * `estado.total`) -- ninguna suma ni multiplicación vive acá.** Es la regla central del plan de
 * facturación: dos calculadoras de importes (la app y AFIP) divergen, y sólo el backend es la fiscal.
 * `cantidad`/`precioUnitario` viajan y se muestran como STRING de punta a punta.
 */
export interface PasoItemsProps {
  estado: EstadoFacturaResp;
  onAgregar: (item: NuevoItem) => Promise<void>;
  onQuitar: (indice: number) => Promise<void>;
  modoEdicion?: boolean;
  onVolverResumen?: () => void;
  testID?: string;
}

export function PasoItems({
  estado,
  onAgregar,
  onQuitar,
  modoEdicion = false,
  onVolverResumen,
  testID = 'facturacion-paso-items',
}: PasoItemsProps) {
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [quitando, setQuitando] = useState<number | null>(null);

  const listoLocal = descripcion.trim() !== '' && cantidad !== '' && precioUnitario !== '';

  async function agregar() {
    setEnviando(true);
    try {
      await onAgregar({ descripcion, cantidad, precioUnitario });
      setDescripcion('');
      setCantidad('');
      setPrecioUnitario('');
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(indice: number) {
    setQuitando(indice);
    try {
      await onQuitar(indice);
    } finally {
      setQuitando(null);
    }
  }

  return (
    <div className="paso-items" data-testid={testID}>
      <h2 className="paso-items__titulo">Ítems</h2>

      {estado.items.length === 0 && (
        <p className="paso-items__vacio" data-testid={`${testID}-vacio`}>
          Todavía no agregaste ningún ítem.
        </p>
      )}

      <div className="paso-items__lista">
        {estado.items.map((item, indice) => (
          <div className="paso-items__fila" data-testid={`${testID}-fila-${indice}`} key={`${item.descripcion}-${indice}`}>
            <div className="paso-items__fila-textos">
              <p className="paso-items__fila-descripcion">{item.descripcion}</p>
              <p className="paso-items__fila-detalle">
                {item.cantidad} × {item.precioUnitario} = {item.subtotal}
              </p>
            </div>
            <Button
              variant="danger"
              onClick={() => void quitar(indice)}
              disabled={quitando === indice}
              data-testid={`${testID}-eliminar-${indice}`}
            >
              {quitando === indice ? 'Quitando…' : 'Eliminar'}
            </Button>
          </div>
        ))}
      </div>

      <div className="paso-items__alta">
        <label className="paso-items__campo">
          <span className="paso-items__etiqueta">Descripción</span>
          <input
            data-testid={`${testID}-descripcion`}
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </label>
        <label className="paso-items__campo">
          <span className="paso-items__etiqueta">Cantidad</span>
          <input
            data-testid={`${testID}-cantidad`}
            type="text"
            inputMode="decimal"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </label>
        <label className="paso-items__campo">
          <span className="paso-items__etiqueta">Precio unitario</span>
          <input
            data-testid={`${testID}-precio-unitario`}
            type="text"
            inputMode="decimal"
            value={precioUnitario}
            onChange={(e) => setPrecioUnitario(e.target.value)}
          />
        </label>
        <Button
          variant="ghost"
          onClick={() => void agregar()}
          disabled={!listoLocal || enviando}
          data-testid={`${testID}-agregar`}
        >
          {enviando ? 'Agregando…' : 'Agregar ítem'}
        </Button>
      </div>

      <p className="paso-items__total" data-testid={`${testID}-total`}>
        Total: {estado.total}
      </p>

      {modoEdicion && onVolverResumen && (
        <div className="paso-items__acciones" data-testid={`${testID}-volver-botones`}>
          <Button variant="cancel" onClick={onVolverResumen} data-testid={`${testID}-volver`}>
            Volver al resumen
          </Button>
        </div>
      )}
    </div>
  );
}
