import { useState } from 'react';

import { avisoArmarFactura, facturarPresupuesto, type SugerenciaArmarFactura } from '@copiloto/core';

import { Chip } from '../../design-system';
import './chat.css';

export interface ChipArmarFacturaProps {
  sugerencia: SugerenciaArmarFactura;
  /** Navega al gate de factura existente sobre el borrador que se armó (mismo `irAFacturar` del shell). */
  onFacturar?: (facturaId: string) => void;
}

/**
 * BL-J9 / K-07-B — el chip «¿Te armo la factura?». Sin pantalla nueva: `facturarPresupuesto` es
 * idempotente y devuelve el borrador; el gate de factura (`PantallaFacturacion`) hace el resto.
 * Sin `onFacturar` no hay adónde ir, así que no se ofrece.
 */
export function ChipArmarFactura({ sugerencia, onFacturar }: ChipArmarFacturaProps) {
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  if (!onFacturar) return null;

  async function armar() {
    if (enviando || !onFacturar) return;
    setEnviando(true);
    setAviso(null);
    try {
      const res = await facturarPresupuesto(sugerencia.presupuestoId);
      const texto = avisoArmarFactura(res);
      if (res.status === 'ok') onFacturar(res.facturaId);
      else setAviso(texto);
    } catch {
      setAviso('No pudimos armar la factura. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="disambiguation-chips" data-testid="chip-armar-factura">
      <Chip onClick={() => void armar()} disabled={enviando}>
        {sugerencia.texto}
      </Chip>
      {aviso && (
        <p role="alert" data-testid="chip-armar-factura-aviso" className="propuesta-card__aviso propuesta-card__aviso--error">
          {aviso}
        </p>
      )}
    </div>
  );
}
