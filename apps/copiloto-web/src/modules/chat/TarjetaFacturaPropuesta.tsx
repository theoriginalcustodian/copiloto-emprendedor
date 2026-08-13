import { useState } from 'react';

import { confirmarConTokenFresco, type FacturaPropuesta } from '@copiloto/core';

import { Button, Surface } from '../../design-system';
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

  const lista = propuesta.faltantes.length === 0;

  if (estado === 'emitida') {
    return (
      <div className="chat-row chat-row--assistant" data-testid="factura-propuesta-emitida">
        <Surface variant="tile" className="propuesta-card propuesta-card--terminal propuesta-card--exito">
          Factura emitida.
        </Surface>
      </div>
    );
  }

  async function emitir() {
    if (enviando) return;
    setEnviando(true);
    setMotivo(null);
    try {
      const res = await confirmarConTokenFresco(propuesta.facturaId);
      if (res.emitida) {
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
