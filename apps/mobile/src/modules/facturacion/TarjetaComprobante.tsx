import { Linking, Share, StyleSheet, Text, View } from 'react-native';

import type { EstadoFacturaResp } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { FilaBotones } from '../../theme/glass/campos';
import { SeccionCobro } from './SeccionCobro';

/** Tipo 13 = nota de crédito. No es una deuda de nadie: no se ofrece cobrarla. Mismo criterio que
 *  `DetalleComprobante` y que el backend, que la deja afuera de «me deben». */
const TIPO_NOTA_CREDITO = 13;

const AVISO_24H =
  'El PDF está disponible por 24 horas. Después vas a poder descargarlo desde el portal de AFIP con el CAE.';
const AVISO_EN_DRIVE = 'Guardada en tu Drive. Ese link no vence.';

/**
 * Comprobante emitido -- `estado === 'emitida' | 'entregada'`. Tipo · punto de venta · número · CAE ·
 * vencimiento del CAE · total, más `[Guardar]`/`[Compartir]` y el aviso de las 24 h.
 *
 * 🔴 **`emitida pero sin PDF` (`pdf === null`) es un ÉXITO, nunca un error.** `afip_factura_workflow.py`
 * puede dejar `motivo = "la factura se emitió (CAE …) pero falló el PDF: …"` -- ese texto NUNCA se
 * renderiza literal acá (contiene la palabra "falló", que haría creer al usuario que la factura no
 * salió y lo empujaría a facturar de nuevo, **duplicando un comprobante fiscal real** -- ver
 * `coordinacion/2026-07-21_hallazgo_frontend-estado-rechazada-sin-certificado.md` punto 2). El CAE, que
 * SÍ es válido, queda como el dato principal de la card con una advertencia propia y redactada acá, no
 * heredada del backend.
 *
 * `[Guardar]`/`[Compartir]` usan `Linking.openURL`/`Share` de `react-native` -- sin `expo-file-system`/
 * `expo-sharing` aunque estén en `package.json`: son más pesados que lo que este botón necesita
 * (`pdf.url` ya es una URL pública, abrirla resuelve "guardar" vía el visor del sistema) y evitan cablear
 * una segunda ruta de permisos de almacenamiento que este sprint no pidió.
 */
export interface TarjetaComprobanteProps {
  estado: EstadoFacturaResp;
  onNuevaFactura: () => void;
  /**
   * Se registró (o deshizo) un cobro desde la card de éxito. La pantalla lo usa para refrescar «Te
   * deben» y «Mis comprobantes», que viven en otras secciones y no tienen forma de enterarse solas —
   * igual que `onCobroCambiado` en `DetalleComprobante`.
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
  const tema = useTema();
  const resultado = estado.resultado;

  /**
   * 🔴 **`guardado` es el HECHO; el ajuste "guardar en Drive" es la INTENCIÓN.** El aviso de las 24 h
   * cuelga del hecho: con el ajuste prendido y el archivado fallado (Drive sin conectar, por ejemplo)
   * la factura sale igual y su ÚNICO link es el de AFIP, que vence. Colgar el aviso del ajuste le
   * haría creer al usuario que tiene una copia a salvo cuando no la tiene — peor que no avisar nunca.
   * Es la misma forma del bug de `estado === 'emitida'` que costó una tarde: la intención no es el hecho.
   */
  const enDrive = estado.drive?.guardado === true && estado.drive.link != null;
  // Drive primero: no vence. El de AfipSDK muere a las 24 h — ofrecerlo teniendo uno permanente sería
  // darle al usuario el peor de los dos sin decírselo.
  const link = enDrive ? (estado.drive?.link ?? null) : (estado.pdf?.url ?? null);
  const sinLink = link == null;

  async function guardar() {
    if (link) await Linking.openURL(link);
  }

  async function compartir() {
    if (link) await Share.share({ message: link, url: link });
  }

  return (
    <View testID={testID} style={[styles.contenedor, { gap: tema.espacio.md }]}>
      <Text
        testID={`${testID}-titulo`}
        style={{ color: tema.color.exito, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}
      >
        Factura emitida
      </Text>

      {resultado && (
        <View style={{ gap: tema.espacio.xs }}>
          <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
            Tipo de comprobante {resultado.tipoCbte} · Punto de venta {resultado.puntoVenta} · N° {resultado.nro}
          </Text>
          <Text
            testID={`${testID}-cae`}
            style={{ color: tema.color.acento, fontFamily: tema.fuente.uiBold, fontSize: tema.tipo.grande }}
          >
            CAE: {resultado.cae}
          </Text>
          {resultado.caeVto != null && (
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Vence el {resultado.caeVto}
            </Text>
          )}
          <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>Total: {estado.total}</Text>
        </View>
      )}

      {/* 🔴 «¿Ya la cobraste?» EN EL MOMENTO de emitir — contrato de Contabilidad §2.1: es lo que hace
          que el camino de menor esfuerzo (cargar el cobro apenas se factura, cuando el emprendedor se
          acuerda) sea el correcto. Reusa `SeccionCobro` tal cual la usa `DetalleComprobante`, o sea la
          MISMA vía viva (`/afip/comprobantes/{id}/cobros`) — no inventa un mecanismo nuevo.

          🔴 **[CONNECT] Cuelga de `resultado.id`, que hoy puede venir `null`.** El payload del workflow
          todavía no trae el id de fila; hasta que backend lo agregue, la sección simplemente NO se
          dibuja (degradación honesta, nunca un botón que apunta a `/undefined/cobros`). Sobre una nota
          de crédito tampoco: no es una deuda. El día que `resultado.id` llegue con número, el toque
          aparece solo. */}
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
         * 🔴 **`textoTenue`, NO `peligro`. El color es parte del mensaje.**
         *
         * Este aviso salió en la PRIMERA emisión real desde el device (2026-07-21, factura N° 5, CAE
         * 86290619793525): el texto decía "se emitió correctamente" y el color decía falla. Un párrafo
         * rojo arriba de un CAE válido se lee como error aunque las palabras digan lo contrario —
         * nadie lee un cartel rojo hasta el final.
         *
         * Y el costo de esa contradicción es el más caro de esta pantalla: el usuario concluye que no
         * se emitió, vuelve a facturar, y **duplica un comprobante fiscal real**. Es exactamente lo
         * que la sesión de backend confirmó haber vivido en producción y lo que este copy existe para
         * evitar. Rojo queda reservado para lo que de verdad falló.
         */
        <Text
          testID={`${testID}-sin-pdf`}
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
        >
          Tu factura se emitió correctamente y el CAE de arriba es válido. El PDF no está disponible en
          este momento -- podés descargarlo más tarde desde el portal de AFIP con ese CAE.
        </Text>
      ) : (
        <>
          <Text
            testID={enDrive ? `${testID}-aviso-drive` : `${testID}-aviso-24h`}
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
          >
            {enDrive ? AVISO_EN_DRIVE : AVISO_24H}
          </Text>
          <FilaBotones
            testID={`${testID}-botones`}
            botones={[
              { etiqueta: 'Guardar', onPress: guardar, variante: 'primario', testID: `${testID}-guardar` },
              { etiqueta: 'Compartir', onPress: compartir, variante: 'secundario', testID: `${testID}-compartir` },
            ]}
          />
        </>
      )}

      <FilaBotones
        testID={`${testID}-nueva-factura-botones`}
        botones={[{ etiqueta: 'Nueva factura', onPress: onNuevaFactura, testID: `${testID}-nueva-factura` }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
});
