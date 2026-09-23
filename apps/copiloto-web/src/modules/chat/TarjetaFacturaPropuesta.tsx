import { useEffect, useState } from 'react';

import {
  AVISO_FACTURA_ANULACION,
  confirmarConTokenFresco,
  estadoFactura,
  type EstadoFacturaResp,
  type FacturaPropuesta,
} from '@copiloto/core';

import { Button, Recibo, Surface } from '../../design-system';
import './chat.css';

/**
 * `TarjetaFacturaPropuesta` — lo que el copiloto entendió de una factura dictada (hito 9), de sólo
 * LECTURA + acción. Puerto de `apps/mobile/src/modules/chat/TarjetaFacturaPropuesta.tsx` (contrato
 * `contrato_planificacion-a-todos_hito9-facturar-por-voz-los-mismos-signals-que-la-pantalla` §2.2 +
 * §5), 5ª y última de las cards `*_propuesto` que le faltaban a la web (fila D12 del registro de
 * deuda).
 *
 * 🔴 **No es una card editable como gasto/ingreso/presupuesto — es un gate + un handoff**, igual que
 * mobile: emitir es un acto fiscal irreversible, así que acá no hay formulario para completar a mano
 * — completar A MANO significa navegar a `PantallaFacturacion`, que ya hace eso con sus 4 pasos
 * durables sobre el MISMO borrador (`facturaId`). Reimplementar esos pasos dentro del chat sería la
 * segunda copia del único lugar donde se firma una emisión.
 *
 * 🔴 **`completa` se deriva de `faltantes.length === 0`**, nunca viaja como bandera aparte — misma
 * doctrina que `derivarPasoVisible` de `PantallaFacturacion`: el backend recalcula, el front deriva.
 *
 * 🔴 **`Emitir` confía en `confirmarConTokenFresco`** (platform-agnóstico, sin cambios desde
 * `packages/core`), que releva el token FRESCO y VERIFICA releyendo el estado — esta card no
 * reimplementa esa verificación, sólo confía en `ConfirmarResultado.emitida`.
 *
 * 🔴 **`Completar a mano` NO navega con `router.push` (eso es mobile) — llama `onCompletarAMano`**,
 * que el caller cablea al mecanismo YA EXISTENTE `facturaIdDesdePresupuesto`/`changeTab('facturacion')`
 * de ambos shells (creado originalmente para el handoff presupuesto→factura, D12 lo reusa tal cual:
 * cero estado nuevo, así que no dispara el gatillo de deuda de D16 sobre un 3er `*IdAbierto`). Sin el
 * prop (caller no lo pasa) el botón no se muestra — mismo criterio que el resto de los callbacks
 * opcionales de este módulo (`onAbrirCliente` en `TarjetaClientePropuesto`).
 *
 * Sin guard cross-reload propio: a diferencia de gasto/cliente/ingreso/presupuesto (editables, un
 * reload podía re-mostrar un formulario ya resuelto y duplicar), acá el único estado local es
 * `emitida` — un reload simplemente vuelve a mostrar el gate contra el borrador real (`faltantes`
 * fresco del backend), nunca duplica nada.
 */
type Estado = 'mostrando' | 'emitida';

/** Sondeo del PDF tras emitir (BL-C2): el CAE llega antes que el PDF, así que se relee el estado hasta
 *  `terminado` — el flag EXPLÍCITO del workflow (`EstadoFacturaResp.terminado`), no una lista de
 *  estados. Mismo criterio que mobile (`facturacion/comprobante.tsx`). Tope: ~60 s. */
const SONDEO_MS = 1500;
const SONDEO_MAX_INTENTOS = 40;

/** «0001-00000042» — punto de venta y número con el relleno habitual del comprobante. */
function numeroComprobante(puntoVenta: number, nro: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(nro).padStart(8, '0')}`;
}

/** Drive primero (no vence); el link de AfipSDK muere a las 24 h. */
function linkPdf(estado: EstadoFacturaResp | null): string | null {
  if (estado == null) return null;
  if (estado.drive?.guardado === true && estado.drive.link != null) return estado.drive.link;
  return estado.pdf?.url ?? null;
}

export interface TarjetaFacturaPropuestaProps {
  propuesta: FacturaPropuesta;
  /** El `id` del `ChatMessage` que trae esta card — sólo para `data-testid` estable, no hay guard
   *  cross-reload que la necesite (ver docstring del archivo). */
  mensajeId: string;
  /** Navega a `PantallaFacturacion` sobre `propuesta.facturaId` — el caller decide CÓMO (shell
   *  mobile-web vs desktop). Sin este prop, `Completar a mano` no se ofrece. */
  onCompletarAMano?: (facturaId: string) => void;
}

export function TarjetaFacturaPropuesta({ propuesta, mensajeId, onCompletarAMano }: TarjetaFacturaPropuestaProps) {
  const [estado, setEstado] = useState<Estado>('mostrando');
  const [enviando, setEnviando] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  /** El estado releído de la factura ya emitida (CAE, número, vencimiento, PDF). */
  const [comprobante, setComprobante] = useState<EstadoFacturaResp | null>(null);
  const [sondeoAgotado, setSondeoAgotado] = useState(false);

  useEffect(() => {
    if (estado !== 'emitida' || comprobante == null || comprobante.terminado) return;
    let cancelado = false;
    let intentos = 0;
    const timer = setInterval(() => {
      intentos += 1;
      void estadoFactura(propuesta.facturaId)
        .then((nuevo) => {
          if (cancelado) return;
          setComprobante(nuevo);
          if (nuevo.terminado) clearInterval(timer);
        })
        .catch(() => undefined); // un tropiezo de red no tira el CAE ya mostrado: se reintenta
      if (intentos >= SONDEO_MAX_INTENTOS) {
        clearInterval(timer);
        if (!cancelado) setSondeoAgotado(true);
      }
    }, SONDEO_MS);
    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, [estado, comprobante, propuesta.facturaId]);

  const lista = propuesta.faltantes.length === 0;

  if (estado === 'emitida') {
    const resultado = comprobante?.resultado ?? null;
    const link = linkPdf(comprobante);
    const preparando = link == null && comprobante?.terminado !== true && !sondeoAgotado;
    return (
      <Recibo
        testId="factura-propuesta-emitida"
        tono="exito"
        titulo="Factura emitida."
        lineas={
          resultado != null
            ? [
                { etiqueta: 'N°', valor: numeroComprobante(resultado.puntoVenta, resultado.nro), testId: 'factura-emitida-numero' },
                { etiqueta: 'CAE', valor: resultado.cae, testId: 'factura-emitida-cae' },
                ...(resultado.caeVto != null
                  ? [{ etiqueta: 'Vence', valor: resultado.caeVto, testId: 'factura-emitida-vto' }]
                  : []),
              ]
            : undefined
        }
        accion={link != null ? { etiqueta: 'Ver PDF', href: link, testId: 'factura-emitida-pdf' } : undefined}
        nota={
          link != null
            ? undefined
            : preparando
              ? { texto: 'Preparando el PDF…', testId: 'factura-emitida-preparando' }
              : {
                  texto: 'La factura se emitió y el CAE es válido. El PDF no está disponible por ahora.',
                  testId: 'factura-emitida-sin-pdf',
                }
        }
      />
    );
  }

  async function emitir() {
    if (enviando) return;
    setEnviando(true);
    setMotivo(null);
    try {
      const res = await confirmarConTokenFresco(propuesta.facturaId);
      if (res.emitida) {
        setComprobante(res.estado ?? null);
        setEstado('emitida');
      } else {
        setMotivo(res.motivo ?? 'No pudimos emitirla. Revisá el resumen antes de reintentar.');
      }
    } catch {
      setMotivo('No pudimos emitirla. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const nombreCliente =
    propuesta.cliente != null
      ? [propuesta.cliente.razonSocial, propuesta.cliente.cuit].filter((v) => (v ?? '').trim() !== '').join(' · ')
      : '';

  return (
    <div className="chat-row chat-row--assistant" data-testid="factura-propuesta">
      <Surface variant="card" blur className="propuesta-card">
        <p className="propuesta-card__aviso">
          {lista
            ? 'Esto entendí. Revisalo y tocá Emitir — todavía no la mandé.'
            : 'Esto entendí, pero falta completar algo antes de emitirla.'}
        </p>

        {nombreCliente !== '' && (
          <div className="propuesta-card__factura-row" data-testid={`factura-propuesta-cliente-${mensajeId}`}>
            <span className="propuesta-card__factura-label">Cliente</span>
            <span className="propuesta-card__factura-valor">{nombreCliente}</span>
          </div>
        )}

        {propuesta.items.map((item, indice) => (
          <div key={`${item.descripcion}-${indice}`} className="propuesta-card__factura-row">
            <span className="propuesta-card__factura-valor">{item.descripcion}</span>
            <span className="propuesta-card__factura-label">
              {item.cantidad} × {item.precioUnitario}
            </span>
          </div>
        ))}

        <p className="propuesta-card__factura-total" data-testid="factura-propuesta-total">
          Total: {propuesta.total}
        </p>

        {motivo != null && (
          <p className="propuesta-card__aviso propuesta-card__aviso--error" data-testid="factura-propuesta-error">
            {motivo}
          </p>
        )}

        {lista && (
          <p className="propuesta-card__aviso" data-testid="factura-propuesta-aviso-anulacion">
            {AVISO_FACTURA_ANULACION}
          </p>
        )}

        {lista ? (
          <Button
            variant="primary"
            onClick={() => void emitir()}
            disabled={enviando}
            data-testid="factura-propuesta-emitir"
          >
            {enviando ? 'Emitiendo…' : 'Emitir'}
          </Button>
        ) : (
          onCompletarAMano != null && (
            <Button
              variant="primary"
              onClick={() => onCompletarAMano(propuesta.facturaId)}
              data-testid="factura-propuesta-completar"
            >
              Completar a mano
            </Button>
          )
        )}
      </Surface>
    </div>
  );
}
