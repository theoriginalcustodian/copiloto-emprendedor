import { useState } from 'react';

import type { AmbienteAfip, ConfirmarResultado, DatosVentaInput, EstadoFacturaResp, ReceptorInput } from '@copiloto/core';

import { Button } from '../../design-system';
import { OPCIONES_CONCEPTO, OPCIONES_CONDICION_VENTA } from './catalogos';

type PasoEditable = 'datos_venta' | 'items' | 'cliente';

function etiquetaDe(opciones: { valor: string; etiqueta: string }[], valor: string): string {
  return opciones.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/**
 * Paso 4 — Resumen + HITL. Port de `apps/mobile/src/modules/facturacion/PasoResumen.tsx`. Todo lo que
 * se va a emitir, con `[Confirmar] [Cancelar] [Editar y confirmar]`.
 *
 * 🔴 **`datosVenta`/`cliente` son un ECO LOCAL, no una relectura del backend.** `FacturaWorkflow.estado()`
 * devuelve 9 claves y NINGUNA de ellas trae de vuelta la fecha/concepto/condición de venta ni los datos
 * del receptor que se cargaron en los pasos 1 y 3. `items`/`total` SÍ son del backend (siempre visibles
 * acá, son la fuente fiscal); `datosVenta`/`cliente` los sostiene `PantallaFacturacion` en memoria desde
 * que el usuario los tipeó -- si son `null`, esta pantalla lo DICE en vez de inventar un resumen a medias.
 *
 * 🔴 **El ambiente se muestra ACÁ, y cambia la etiqueta del botón.** Pedido explícito de la sesión de
 * backend: *"emitir un comprobante fiscal real creyendo que se está probando es el error caro de este
 * flujo, y el único lugar donde se puede evitar es la pantalla donde el usuario aprieta Confirmar"*. Por
 * eso en producción el botón no dice "Confirmar y emitir" sino **"Emitir factura real"** — la etiqueta
 * del botón es lo último que se lee antes de apretarlo, y es lo único que se lee de verdad.
 *
 * 🔴 **Si el ambiente no se pudo confirmar, se DICE — no se asume homologación.** Asumir la opción
 * "segura" es exactamente lo que produce el error caro: alguien mirando un cartel que dice "prueba"
 * mientras emite un comprobante fiscal real.
 */
export interface PasoResumenProps {
  estado: EstadoFacturaResp;
  /** `null` = el backend no informó el ambiente. Ver el docstring de arriba: no se asume ninguno. */
  ambiente: AmbienteAfip | null;
  datosVenta: DatosVentaInput | null;
  cliente: ReceptorInput | null;
  onConfirmar: () => Promise<ConfirmarResultado>;
  onCancelar: () => Promise<void>;
  onEditar: (paso: PasoEditable) => void;
  testID?: string;
}

export function PasoResumen({
  estado,
  ambiente,
  datosVenta,
  cliente,
  onConfirmar,
  onCancelar,
  onEditar,
  testID = 'facturacion-paso-resumen',
}: PasoResumenProps) {
  const [enviando, setEnviando] = useState(false);
  const [avisoNoOp, setAvisoNoOp] = useState<string | null>(null);
  const [eligiendoPaso, setEligiendoPaso] = useState(false);

  async function confirmar() {
    setEnviando(true);
    setAvisoNoOp(null);
    try {
      const resultado = await onConfirmar();
      if (!resultado.emitida) {
        setAvisoNoOp(resultado.motivo ?? 'los datos cambiaron, revisá el resumen antes de confirmar');
      }
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    setEnviando(true);
    try {
      await onCancelar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="paso-resumen" data-testid={testID}>
      <h2 className="paso-resumen__titulo">Resumen</h2>

      <div
        className={`paso-resumen__aviso-ambiente paso-resumen__aviso-ambiente--${ambiente ?? 'desconocido'}`}
        data-testid={`${testID}-aviso-ambiente`}
      >
        <p data-testid={`${testID}-ambiente-${ambiente ?? 'desconocido'}`}>
          {ambiente === 'prod'
            ? 'Producción: esto emite un comprobante fiscal REAL a tu nombre. Anularlo requiere una nota de crédito.'
            : ambiente === 'dev'
              ? 'Homologación: es una factura de prueba, sin efecto fiscal.'
              : 'No pudimos confirmar si tu cuenta está en Homologación (prueba, sin efecto fiscal) o Producción (comprobante fiscal real). Revisá Ajustes antes de confirmar.'}
        </p>
      </div>

      {datosVenta ? (
        <div className="paso-resumen__fila" data-testid={`${testID}-datos-venta`}>
          <span className="paso-resumen__fila-etiqueta">Venta</span>
          <p className="paso-resumen__fila-valor">
            {datosVenta.fecha} · {etiquetaDe(OPCIONES_CONCEPTO, String(datosVenta.concepto))} ·{' '}
            {etiquetaDe(OPCIONES_CONDICION_VENTA, datosVenta.condicionVenta)}
          </p>
        </div>
      ) : (
        <p className="paso-resumen__no-disponible" data-testid={`${testID}-datos-venta-no-disponible`}>
          No tenemos en esta sesión el detalle de la venta -- los datos ya están guardados en el borrador.
        </p>
      )}

      <span className="paso-resumen__subtitulo">Ítems ({estado.items.length})</span>
      <div className="paso-resumen__lista-items">
        {estado.items.map((item, indice) => (
          <div className="paso-resumen__fila" data-testid={`${testID}-item-${indice}`} key={`${item.descripcion}-${indice}`}>
            <p className="paso-resumen__fila-valor">{item.descripcion}</p>
            <p className="paso-resumen__fila-detalle">
              {item.cantidad} × {item.precioUnitario} = {item.subtotal}
            </p>
          </div>
        ))}
      </div>
      <p className="paso-resumen__total" data-testid={`${testID}-total`}>
        Total: {estado.total}
      </p>

      {cliente ? (
        <div className="paso-resumen__fila" data-testid={`${testID}-cliente`}>
          <span className="paso-resumen__fila-etiqueta">Cliente</span>
          {/* 🔴 Nombre y domicilio son OPCIONALES (ver `PasoCliente`: el backend no los exige, y
              para consumidor final es lo normal no cargarlos). Sin este filtro, el resumen de una
              venta a consumidor final mostraba un " · " suelto. Un separador huérfano parece un
              dato que no cargó, cuando en realidad no hacía falta. */}
          <p className="paso-resumen__fila-valor">
            {[cliente.nombre, cliente.domicilio].filter((v) => (v ?? '').trim() !== '').join(' · ') ||
              'Consumidor final sin identificar'}
          </p>
        </div>
      ) : (
        <p className="paso-resumen__no-disponible" data-testid={`${testID}-cliente-no-disponible`}>
          No tenemos en esta sesión el detalle del cliente -- los datos ya están guardados en el borrador.
        </p>
      )}

      {avisoNoOp != null && (
        <p className="paso-resumen__aviso-no-op" data-testid={`${testID}-aviso-no-op`} role="alert">
          {avisoNoOp}
        </p>
      )}

      {eligiendoPaso ? (
        <div className="paso-resumen__acciones" data-testid={`${testID}-selector-edicion`}>
          <Button variant="ghost" onClick={() => onEditar('datos_venta')} data-testid={`${testID}-editar-datos-venta`}>
            Datos de venta
          </Button>
          <Button variant="ghost" onClick={() => onEditar('items')} data-testid={`${testID}-editar-items`}>
            Ítems
          </Button>
          <Button variant="ghost" onClick={() => onEditar('cliente')} data-testid={`${testID}-editar-cliente`}>
            Cliente
          </Button>
        </div>
      ) : (
        <div className="paso-resumen__acciones" data-testid={`${testID}-botones`}>
          <Button
            onClick={() => void confirmar()}
            disabled={enviando}
            data-testid={`${testID}-confirmar`}
          >
            {/* 🔴 La etiqueta cambia con el ambiente. Ver el docstring del módulo: es el último
                texto que el usuario lee antes de emitir, y en producción tiene que nombrar lo que
                realmente va a pasar. */}
            {enviando ? 'Emitiendo…' : ambiente === 'prod' ? 'Emitir factura real' : 'Confirmar y emitir'}
          </Button>
          <Button variant="danger" onClick={() => void cancelar()} disabled={enviando} data-testid={`${testID}-cancelar`}>
            Cancelar
          </Button>
          <Button variant="cancel" onClick={() => setEligiendoPaso(true)} disabled={enviando} data-testid={`${testID}-editar`}>
            Editar y confirmar
          </Button>
        </div>
      )}
    </div>
  );
}
