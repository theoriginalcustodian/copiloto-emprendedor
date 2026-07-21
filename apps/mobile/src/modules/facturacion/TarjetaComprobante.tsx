import { Linking, Share, StyleSheet, Text, View } from 'react-native';

import type { EstadoFacturaResp } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { FilaBotones } from '../../theme/glass/campos';

const AVISO_24H =
  'El PDF está disponible por 24 horas. Después vas a poder descargarlo desde el portal de AFIP con el CAE.';

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
  testID?: string;
}

export function TarjetaComprobante({ estado, onNuevaFactura, testID = 'facturacion-comprobante' }: TarjetaComprobanteProps) {
  const tema = useTema();
  const resultado = estado.resultado;
  const sinPdf = estado.pdf == null;

  async function guardar() {
    if (estado.pdf) await Linking.openURL(estado.pdf.url);
  }

  async function compartir() {
    if (estado.pdf) await Share.share({ message: estado.pdf.url, url: estado.pdf.url });
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

      {sinPdf ? (
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
          <Text testID={`${testID}-aviso-24h`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            {AVISO_24H}
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
