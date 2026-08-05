import type { EstadoFacturaResp } from '@copiloto/core';

import { Button } from '../../design-system';
import { SeccionCobro } from './SeccionCobro';

/** Tipo 13 = nota de crédito. No es una deuda de nadie: no se ofrece cobrarla. Mismo criterio que
 *  mobile y que el backend, que la deja afuera de «me deben». */
const TIPO_NOTA_CREDITO = 13;

const AVISO_24H =
  'El PDF está disponible por 24 horas. Después vas a poder descargarlo desde el portal de AFIP con el CAE.';
const AVISO_EN_DRIVE = 'Guardada en tu Drive. Ese link no vence.';

/**
 * Comprobante emitido -- `estado === 'emitida' | 'entregada'`. Tipo · PV · número · CAE · vencimiento
 * del CAE · total, más la sección de cobro embebida, `[Guardar]`/`[Compartir]` del PDF o Drive, aviso
 * si el PDF todavía no está listo, botón "Nueva factura".
 *
 * Port de `apps/mobile/src/modules/facturacion/TarjetaComprobante.tsx`. Misma lógica de negocio;
 * `Guardar`/`Compartir` cambian de sustrato: web no tiene `Linking.openURL`/`Share` de RN, así que
 * "Guardar" es un `<a href download>` directo al link (abre/descarga vía el navegador) y "Compartir"
 * reusa el patrón YA establecido en `ArtifactView.tsx` (Web Share API con fallback a portapapeles).
 *
 * 🔴 **`emitida pero sin PDF` (`pdf === null`) es un ÉXITO, nunca un error.** `afip_factura_workflow.py`
 * puede dejar `motivo = "la factura se emitió (CAE …) pero falló el PDF: …"` -- ese texto NUNCA se
 * renderiza literal acá (contiene la palabra "falló", que haría creer al usuario que la factura no
 * salió y lo empujaría a facturar de nuevo, **duplicando un comprobante fiscal real**). El CAE, que SÍ
 * es válido, queda como el dato principal de la card con una advertencia propia y redactada acá, no
 * heredada del backend.
 */
export interface TarjetaComprobanteProps {
  estado: EstadoFacturaResp;
  onNuevaFactura: () => void;
  /**
   * Se registró (o deshizo) un cobro desde la card de éxito. La pantalla lo usa para refrescar «Te
   * deben» y «Mis comprobantes», que viven en otras secciones y no tienen forma de enterarse solas.
   */
  onCobroRegistrado?: () => void;
  testID?: string;
}

export function TarjetaComprobante({
  estado,
  onNuevaFactura,
  onCobroRegistrado,
  testID = 'facturacion-comprobante',
}: TarjetaComprobanteProps) {
  const resultado = estado.resultado;

  /**
   * 🔴 **`guardado` es el HECHO; el ajuste "guardar en Drive" es la INTENCIÓN.** El aviso de las 24 h
   * cuelga del hecho: con el ajuste prendido y el archivado fallado (Drive sin conectar, por ejemplo)
   * la factura sale igual y su ÚNICO link es el de AFIP, que vence. Colgar el aviso del ajuste le
   * haría creer al usuario que tiene una copia a salvo cuando no la tiene — peor que no avisar nunca.
   */
  const enDrive = estado.drive?.guardado === true && estado.drive.link != null;
  // Drive primero: no vence. El de AfipSDK muere a las 24 h — ofrecerlo teniendo uno permanente sería
  // darle al usuario el peor de los dos sin decírselo.
  const link = enDrive ? (estado.drive?.link ?? null) : (estado.pdf?.url ?? null);
  const sinLink = link == null;

  function compartir() {
    if (!link) return;
    // Web Share API primero (mismo patrón que ArtifactView); sin soporte degrada a portapapeles.
    if (navigator.share) void navigator.share({ title: 'Tu factura', url: link });
    else void navigator.clipboard?.writeText(link);
  }

  return (
    <div className="facturacion-comprobante" data-testid={testID}>
      <h2 className="facturacion-comprobante__titulo" data-testid={`${testID}-titulo`}>
        Factura emitida
      </h2>

      {resultado && (
        <div className="facturacion-comprobante__datos">
          <p className="facturacion-comprobante__linea">
            Tipo de comprobante {resultado.tipoCbte} · Punto de venta {resultado.puntoVenta} · N°{' '}
            {resultado.nro}
          </p>
          <p className="facturacion-comprobante__cae" data-testid={`${testID}-cae`}>
            CAE: {resultado.cae}
          </p>
          {resultado.caeVto != null && (
            <p className="facturacion-comprobante__vencimiento">Vence el {resultado.caeVto}</p>
          )}
          <p className="facturacion-comprobante__linea">Total: {estado.total}</p>
        </div>
      )}

      {/* 🔴 «¿Ya la cobraste?» EN EL MOMENTO de emitir — mismo contrato de Contabilidad que mobile.
          Reusa `SeccionCobro` tal cual, o sea la MISMA vía viva (`/afip/comprobantes/{id}/cobros`).

          🔴 **[CONNECT] Cuelga de `resultado.id`, que hoy puede venir `null`.** Hasta que backend
          agregue el id de fila al payload, la sección simplemente NO se dibuja (degradación honesta,
          nunca un botón que apunta a `/undefined/cobros`). El día que `resultado.id` llegue con
          número, el toque aparece solo. */}
      {resultado?.id != null && (
        <SeccionCobro
          comprobanteId={resultado.id}
          cobrable={resultado.tipoCbte !== TIPO_NOTA_CREDITO}
          onCambio={onCobroRegistrado}
          testID={`${testID}-cobro`}
        />
      )}

      {sinLink ? (
        /**
         * 🔴 **Color tenue, NO de peligro. El color es parte del mensaje.** Un párrafo rojo arriba de
         * un CAE válido se lee como error aunque las palabras digan lo contrario. El costo de esa
         * contradicción es el más caro de esta pantalla: el usuario concluye que no se emitió, vuelve
         * a facturar, y **duplica un comprobante fiscal real**. Rojo queda reservado para lo que de
         * verdad falló.
         */
        <p className="facturacion-comprobante__sin-pdf" data-testid={`${testID}-sin-pdf`}>
          Tu factura se emitió correctamente y el CAE de arriba es válido. El PDF no está disponible en
          este momento -- podés descargarlo más tarde desde el portal de AFIP con ese CAE.
        </p>
      ) : (
        <>
          <p
            className="facturacion-comprobante__aviso"
            data-testid={enDrive ? `${testID}-aviso-drive` : `${testID}-aviso-24h`}
          >
            {enDrive ? AVISO_EN_DRIVE : AVISO_24H}
          </p>
          <div className="facturacion-comprobante__acciones" data-testid={`${testID}-botones`}>
            <a
              className="uc-btn uc-btn--primary"
              href={link}
              download
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`${testID}-guardar`}
            >
              Guardar
            </a>
            <Button variant="cancel" onClick={compartir} data-testid={`${testID}-compartir`}>
              Compartir
            </Button>
          </div>
        </>
      )}

      <div className="facturacion-comprobante__acciones" data-testid={`${testID}-nueva-factura-botones`}>
        <Button onClick={onNuevaFactura} data-testid={`${testID}-nueva-factura`}>
          Nueva factura
        </Button>
      </div>
    </div>
  );
}
