import { useState } from 'react';

import type { DatosVentaInput, EstadoFacturaResp } from '@copiloto/core';

import { Button } from '../../design-system';
import { OPCIONES_CONCEPTO, OPCIONES_CONDICION_VENTA } from './catalogos';

/**
 * Paso 1 — Datos de venta. Port de `apps/mobile/src/modules/facturacion/PasoDatosVenta.tsx` — MISMA
 * lógica (fecha + concepto + condición de venta, y con concepto 2/3 las tres fechas de servicio, regla
 * R6 de `afip_rules.py`). Sólo cambia la capa de presentación: `<input>`/`<select>` nativos de HTML en
 * vez de los primitivos glass de RN.
 *
 * El botón "Continuar" queda deshabilitado hasta que lo local-obligatorio esté completo -- una
 * verificación de UX, no la validación real (esa es del backend: `cargar_datos_venta` no tira 4xx, dejan
 * un `motivo` en el próximo `estadoFactura()`, que `PantallaFacturacion` ya vuelve a mostrar como este
 * mismo paso porque el `estado` no habrá avanzado).
 */
export interface PasoDatosVentaProps {
  estado: EstadoFacturaResp;
  onGuardar: (datos: DatosVentaInput) => Promise<void>;
  /** `true` cuando se llegó acá desde "Editar y confirmar" del resumen -- suma el botón de volver. */
  modoEdicion?: boolean;
  onVolverResumen?: () => void;
  testID?: string;
}

export function PasoDatosVenta({
  estado,
  onGuardar,
  modoEdicion = false,
  onVolverResumen,
  testID = 'facturacion-paso-datos-venta',
}: PasoDatosVentaProps) {
  const [fecha, setFecha] = useState('');
  const [concepto, setConcepto] = useState('1');
  const [condicionVenta, setCondicionVenta] = useState('');
  const [fechaServicioDesde, setFechaServicioDesde] = useState('');
  const [fechaServicioHasta, setFechaServicioHasta] = useState('');
  const [fechaVtoPago, setFechaVtoPago] = useState('');
  const [enviando, setEnviando] = useState(false);

  const requiereFechasServicio = concepto === '2' || concepto === '3';
  const listoLocal =
    fecha !== '' &&
    condicionVenta !== '' &&
    (!requiereFechasServicio || (fechaServicioDesde !== '' && fechaServicioHasta !== '' && fechaVtoPago !== ''));

  async function continuar() {
    setEnviando(true);
    try {
      await onGuardar({
        fecha,
        concepto: Number(concepto) as 1 | 2 | 3,
        condicionVenta,
        fechaServicioDesde: requiereFechasServicio ? fechaServicioDesde : null,
        fechaServicioHasta: requiereFechasServicio ? fechaServicioHasta : null,
        fechaVtoPago: requiereFechasServicio ? fechaVtoPago : null,
      });
    } finally {
      setEnviando(false);
    }
  }

  const hayMotivo = estado.motivo != null && estado.motivo !== '';

  return (
    <div className="paso-datos-venta" data-testid={testID}>
      <h2 className="paso-datos-venta__titulo">Datos de venta</h2>

      {hayMotivo && (
        <p className="paso-datos-venta__motivo" data-testid={`${testID}-motivo`}>
          {estado.motivo}
        </p>
      )}

      <label className="paso-datos-venta__campo">
        <span className="paso-datos-venta__etiqueta">Fecha</span>
        <input
          data-testid={`${testID}-fecha`}
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </label>

      <label className="paso-datos-venta__campo">
        <span className="paso-datos-venta__etiqueta">Concepto</span>
        <select
          data-testid={`${testID}-concepto`}
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
        >
          {OPCIONES_CONCEPTO.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="paso-datos-venta__campo">
        <span className="paso-datos-venta__etiqueta">Condición de venta</span>
        <select
          data-testid={`${testID}-condicion-venta`}
          value={condicionVenta}
          onChange={(e) => setCondicionVenta(e.target.value)}
        >
          <option value="">Elegí una opción</option>
          {OPCIONES_CONDICION_VENTA.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>

      {requiereFechasServicio && (
        <div className="paso-datos-venta__fechas-servicio" data-testid={`${testID}-fechas-servicio`}>
          <label className="paso-datos-venta__campo">
            <span className="paso-datos-venta__etiqueta">Servicio desde</span>
            <input
              data-testid={`${testID}-servicio-desde`}
              type="date"
              value={fechaServicioDesde}
              onChange={(e) => setFechaServicioDesde(e.target.value)}
            />
          </label>
          <label className="paso-datos-venta__campo">
            <span className="paso-datos-venta__etiqueta">Servicio hasta</span>
            <input
              data-testid={`${testID}-servicio-hasta`}
              type="date"
              value={fechaServicioHasta}
              onChange={(e) => setFechaServicioHasta(e.target.value)}
            />
          </label>
          <label className="paso-datos-venta__campo">
            <span className="paso-datos-venta__etiqueta">Vencimiento de pago</span>
            <input
              data-testid={`${testID}-vto-pago`}
              type="date"
              value={fechaVtoPago}
              onChange={(e) => setFechaVtoPago(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="paso-datos-venta__acciones" data-testid={`${testID}-botones`}>
        <Button
          onClick={() => void continuar()}
          disabled={!listoLocal || enviando}
          data-testid={`${testID}-continuar`}
        >
          {enviando ? 'Guardando…' : 'Continuar'}
        </Button>
        {modoEdicion && onVolverResumen && (
          <Button variant="cancel" onClick={onVolverResumen} data-testid={`${testID}-volver`}>
            Volver al resumen
          </Button>
        )}
      </div>
    </div>
  );
}
