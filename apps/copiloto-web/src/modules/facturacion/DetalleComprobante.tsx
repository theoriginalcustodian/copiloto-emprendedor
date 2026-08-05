/**
 * `DetalleComprobante` — port de `apps/mobile/src/modules/facturacion/DetalleComprobante.tsx`. El
 * panel que se abre al tocar una fila de "Mis comprobantes".
 *
 * 🔴 **Es un overlay LOCAL, no una ruta.** En mobile esto importa porque un `transparentModal` podía
 * apilarse con otro y dejar la app muerta al toque (`empujarUnaVez.ts`). **En web eso no aplica** — no
 * hay stack de navegación nativo que apilar — así que se porta simplemente como un `<div>`
 * `position: fixed` sobre el resto del contenido, sin el mecanismo de "una sola hoja" del original.
 *
 * 🔴 **No pide datos FISCALES.** Todo lo del comprobante —número, CAE, total, receptor, estado— sale
 * de la fila que `listarComprobantes` ya trajo: sin spinner, sin error de red en el medio.
 *
 * ⚠️ **`SeccionCobro` todavía no existe en este worktree** (la trae PR2, en paralelo). Se deja un
 * placeholder simple documentado — NO se bloquea este PR esperando a PR2. Cuando `SeccionCobro` exista,
 * PR4 la cablea acá.
 */
import type { Comprobante } from '@copiloto/core';

import { nombreTipoComprobante } from './etiquetasComprobante';

/**
 * Tipo 13 = nota de crédito. **No es una deuda de nadie**: es el papel que anula otra factura, así que
 * la sección de cobro no se ofrece sobre ella.
 */
const TIPO_NOTA_CREDITO = 13;

const ETIQUETA_DOC: Record<number, string> = {
  80: 'CUIT',
  86: 'CUIL',
  96: 'DNI',
  99: 'Consumidor final',
};

const ETIQUETA_ESTADO: Record<string, string> = {
  emitida: 'Emitida',
  anulada: 'Anulada',
  nota_credito: 'Nota de crédito',
};

/** `0006-00000015` — el formato con el que AFIP identifica un comprobante. */
export function numeroFormateado(puntoVenta: number, nro: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(nro).padStart(8, '0')}`;
}

export interface DetalleComprobanteProps {
  comprobante: Comprobante;
  onCerrar: () => void;
  /** Se registró o se deshizo un cobro acá adentro. La pantalla lo usa para refrescar «Te deben». */
  onCobroCambiado?: () => void;
  testID?: string;
}

function Dato({
  etiqueta,
  valor,
  testID,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  testID?: string;
  destacado?: boolean;
}) {
  return (
    <div className="detalle-comprobante__dato">
      <span className="detalle-comprobante__dato-etiqueta">{etiqueta}</span>
      <p
        className={
          destacado ? 'detalle-comprobante__dato-valor detalle-comprobante__dato-valor--destacado' : 'detalle-comprobante__dato-valor'
        }
        data-testid={testID}
      >
        {valor}
      </p>
    </div>
  );
}

// El módulo real de descarga/compartir es el mismo que usa PR1/PR2 en este repo — importarlo con
// nombres nuevos acá haría un puerto que dependería de un archivo fuera del alcance de este PR. Se
// mantiene con `window.open`, equivalente funcional del `abrirLink` de mobile para web (una pestaña
// nueva navega o descarga según los headers que responda el link, sin bloquear la app actual).
function abrir(link: string) {
  window.open(link, '_blank', 'noopener,noreferrer');
}

async function compartirONavegar(link: string) {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await (navigator as Navigator & { share: (data: { url: string }) => Promise<void> }).share({ url: link });
      return;
    } catch {
      // El usuario canceló el share nativo, o el navegador lo rechazó -- cae al fallback de abajo.
    }
  }
  abrir(link);
}

export function DetalleComprobante({
  comprobante: c,
  onCerrar,
  testID = 'detalle-comprobante',
}: DetalleComprobanteProps) {
  /**
   * 🔴 **El orden importa y no es estético.** `driveLink` primero porque NO vence; `pdfUrl` es de
   * AfipSDK y muere a las 24 h.
   */
  const link = c.driveLink ?? c.pdfUrl;
  const enDrive = c.driveLink != null;

  const cobrable = c.estado === 'emitida' && c.tipoCbte !== TIPO_NOTA_CREDITO;

  return (
    <div
      className="detalle-comprobante__scrim"
      data-testid={`${testID}-scrim`}
      onClick={onCerrar}
      role="presentation"
    >
      {/* `stopPropagation`: sin esto, un click DENTRO del panel burbujea al scrim y cierra la hoja
          justo cuando el usuario está leyéndola. */}
      <div
        className="detalle-comprobante__panel"
        data-testid={testID}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detalle-comprobante__encabezado">
          <h2 className="detalle-comprobante__titulo" data-testid={`${testID}-titulo`}>
            {nombreTipoComprobante(c.tipoCbte)}
          </h2>
          <button
            type="button"
            className="detalle-comprobante__cerrar"
            data-testid={`${testID}-cerrar`}
            onClick={onCerrar}
          >
            Cerrar
          </button>
        </div>

        <Dato etiqueta="Número" valor={numeroFormateado(c.puntoVenta, c.nro)} testID={`${testID}-numero`} />
        <Dato etiqueta="CAE" valor={c.cae} destacado testID={`${testID}-cae`} />
        {c.caeVto != null && <Dato etiqueta="Vence el" valor={c.caeVto} />}
        {c.fechaEmision != null && <Dato etiqueta="Emitida el" valor={c.fechaEmision} />}
        <Dato etiqueta="Total" valor={c.total} testID={`${testID}-total`} />

        {/* Los comprobantes anteriores al 2026-07-21 no tienen receptor: el dato no existía todavía.
            No es un vacío que haya que explicar -- simplemente no se dibuja la fila. */}
        {c.receptorNombre != null && c.receptorNombre !== '' && (
          <Dato etiqueta="Cliente" valor={c.receptorNombre} testID={`${testID}-receptor`} />
        )}
        {c.docTipo != null && (
          <Dato
            etiqueta="Documento"
            valor={
              c.docNro != null && c.docNro !== ''
                ? `${ETIQUETA_DOC[c.docTipo] ?? `Tipo ${c.docTipo}`} ${c.docNro}`
                : (ETIQUETA_DOC[c.docTipo] ?? `Tipo ${c.docTipo}`)
            }
            testID={`${testID}-documento`}
          />
        )}

        <Dato etiqueta="Estado" valor={ETIQUETA_ESTADO[c.estado] ?? c.estado} testID={`${testID}-estado`} />

        {/* TODO(PR4): cablear `SeccionCobro` (la trae PR2, en paralelo en otro worktree) cuando esté
            disponible en este módulo. Sólo se ofrece sobre una factura EMITIDA que no sea nota de
            crédito -- una anulada o una NC no son plata que alguien deba. */}
        {c.id != null && cobrable && (
          <p className="detalle-comprobante__placeholder-cobro" data-testid={`${testID}-cobro-placeholder`}>
            Registro de cobro: próximamente.
          </p>
        )}

        {c.cbteAsocNro != null && (
          <p className="detalle-comprobante__anulada-por" data-testid={`${testID}-anulada-por`}>
            Anulada por la nota de crédito N° {c.cbteAsocNro}.
          </p>
        )}

        <p className="detalle-comprobante__aviso-copia" data-testid={`${testID}-aviso-copia`}>
          {enDrive
            ? 'Guardada en tu Drive. Ese link no vence.'
            : 'El PDF de AFIP está disponible por 24 horas desde la emisión. Después vas a poder descargarlo desde el portal de AFIP con el CAE.'}
        </p>

        {link != null && (
          <div className="detalle-comprobante__acciones">
            <button type="button" className="uc-btn uc-btn--primary" data-testid={`${testID}-guardar`} onClick={() => abrir(link)}>
              Guardar
            </button>
            <button
              type="button"
              className="uc-btn uc-btn--cancel"
              data-testid={`${testID}-compartir`}
              onClick={() => void compartirONavegar(link)}
            >
              Compartir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
