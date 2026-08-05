import { useState } from 'react';

import type { EstadoFacturaResp, ReceptorInput } from '@copiloto/core';

import { Button } from '../../design-system';
import { OPCIONES_CONDICION_IVA_RECEPTOR, OPCIONES_TIPO_DOC, TIPO_DOC_CONSUMIDOR_FINAL } from './catalogos';

/**
 * Paso 3 — Cliente (receptor). Port de `apps/mobile/src/modules/facturacion/PasoCliente.tsx`. Se
 * muestra tanto en `items_ok` como en `cliente_ok` -- ver el docstring de `derivarPasoVisible` para el
 * porqué de ese mapeo doble a UNA pantalla. Si `cargar_cliente` dejó un `motivo` sin avanzar el estado
 * (`afip.ts::ReceptorInput`: "el backend valida y, si el valor no matchea el enum, deja `motivo` en el
 * estado, no lanza 4xx"), esta MISMA pantalla lo muestra inline.
 */
export interface PasoClienteProps {
  estado: EstadoFacturaResp;
  onGuardar: (receptor: ReceptorInput) => Promise<void>;
  modoEdicion?: boolean;
  onVolverResumen?: () => void;
  testID?: string;
}

export function PasoCliente({
  estado,
  onGuardar,
  modoEdicion = false,
  onVolverResumen,
  testID = 'facturacion-paso-cliente',
}: PasoClienteProps) {
  const [condicionIva, setCondicionIva] = useState('');
  const [tipoDoc, setTipoDoc] = useState('');
  const [nroDoc, setNroDoc] = useState('');
  const [nombre, setNombre] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [enviando, setEnviando] = useState(false);

  /**
   * 🔴 **Sólo se exige lo que el backend exige. Ni un campo más.**
   *
   * Verificado en device el 2026-07-21 y contra `afip_rules.validar_receptor`: la pantalla de mobile
   * pedía documento **Y** nombre **Y** domicilio siempre, y con eso el flujo quedaba **trabado** para
   * el caso más común de todos —una venta a consumidor final—, que el backend acepta sin ninguno de
   * los tres. El contrato real (`validar_receptor`):
   *   - `tipo_doc = 99` (consumidor final) → **nada** obligatorio, salvo que el total supere el tope
   *     de venta sin identificar (y ESE límite lo decide el backend con el total real, no la app).
   *   - cualquier otro tipo de documento → `nro_doc` obligatorio (y CUIT bien formado si es CUIT).
   *   - `nombre` y `domicilio` → **nunca** obligatorios.
   *
   * Duplicar reglas fiscales en la app es además una trampa a futuro: el día que AFIP cambie un
   * mínimo, esta copia queda vieja y bloquea ventas legítimas sin que nadie sepa por qué. La app
   * anticipa lo evidente; el gate duro sigue siendo el backend, que ya devuelve `faltantes`.
   */
  const requiereDocumento = tipoDoc !== '' && tipoDoc !== String(TIPO_DOC_CONSUMIDOR_FINAL);
  const listoLocal =
    condicionIva !== '' && tipoDoc !== '' && (!requiereDocumento || nroDoc.trim() !== '');

  async function continuar() {
    setEnviando(true);
    try {
      await onGuardar({
        condicionIva: Number(condicionIva),
        tipoDoc: Number(tipoDoc),
        nroDoc,
        nombre,
        domicilio,
      });
    } finally {
      setEnviando(false);
    }
  }

  const hayMotivo = estado.motivo != null && estado.motivo !== '';

  return (
    <div className="paso-cliente" data-testid={testID}>
      <h2 className="paso-cliente__titulo">Cliente</h2>

      {hayMotivo && (
        <p className="paso-cliente__motivo" data-testid={`${testID}-motivo`}>
          {estado.motivo}
        </p>
      )}

      <label className="paso-cliente__campo">
        <span className="paso-cliente__etiqueta">Condición IVA</span>
        <select
          data-testid={`${testID}-condicion-iva`}
          value={condicionIva}
          onChange={(e) => setCondicionIva(e.target.value)}
        >
          <option value="">Elegí una opción</option>
          {OPCIONES_CONDICION_IVA_RECEPTOR.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="paso-cliente__campo">
        <span className="paso-cliente__etiqueta">Tipo de documento</span>
        <select
          data-testid={`${testID}-tipo-doc`}
          value={tipoDoc}
          onChange={(e) => setTipoDoc(e.target.value)}
        >
          <option value="">Elegí una opción</option>
          {OPCIONES_TIPO_DOC.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="paso-cliente__campo">
        {/* La etiqueta dice la verdad según el tipo elegido, en vez de dejar al usuario adivinando
            por qué el botón no se habilita. Es la otra mitad del arreglo: no alcanza con dejar de
            exigir de más, hay que decir qué se exige. */}
        <span className="paso-cliente__etiqueta">
          {requiereDocumento ? 'Número de documento' : 'Número de documento (opcional)'}
        </span>
        <input
          data-testid={`${testID}-nro-doc`}
          type="text"
          inputMode="numeric"
          value={nroDoc}
          onChange={(e) => setNroDoc(e.target.value)}
        />
      </label>

      <label className="paso-cliente__campo">
        <span className="paso-cliente__etiqueta">Nombre / Razón social (opcional)</span>
        <input
          data-testid={`${testID}-nombre`}
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>

      <label className="paso-cliente__campo">
        <span className="paso-cliente__etiqueta">Domicilio (opcional)</span>
        <input
          data-testid={`${testID}-domicilio`}
          type="text"
          value={domicilio}
          onChange={(e) => setDomicilio(e.target.value)}
        />
      </label>

      <div className="paso-cliente__acciones" data-testid={`${testID}-botones`}>
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
