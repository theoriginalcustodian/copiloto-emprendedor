/**
 * Las tres piezas del comprobante emitido, compartidas por **las dos** superficies que lo muestran:
 * `TarjetaComprobante` (pantalla de Facturación) y `TarjetaFacturaPropuesta` (la card del chat).
 *
 * 🔴 **Existen porque el CAE y el PDF se muestran en DOS lugares, y uno de los dos ya pagó el precio
 * de cada matiz.** La card del chat decía sólo *"Factura emitida."* — el CAE, el número y el PDF
 * volvían en `ConfirmarResultado.estado` y se descartaban. Reimplementar la presentación allá habría
 * duplicado tres decisiones que costaron un device cada una: la precedencia Drive→AFIP, el aviso de
 * las 24 h colgado del HECHO y no de la intención, y `emitida sin PDF` como ÉXITO con advertencia
 * propia. Duplicadas, la segunda copia las pierde de a una.
 *
 * ⚠️ **Esto NO es el componente `Recibo` que falta.** Es la extracción mínima de lo que ya estaba
 * escrito y verificado en `TarjetaComprobante`: los mismos textos, los mismos `testID`, el mismo
 * orden. Cuando se defina el `Recibo` compartido con el backend, esto se absorbe adentro — no se
 * amplía acá por las dudas.
 */
import { Text, View } from 'react-native';

import type { EstadoFacturaResp } from '@copiloto/core';

import { FilaBotones } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';
import { abrirLink, compartirLink } from '../../util/abrirYCompartir';

export const AVISO_24H =
  'El PDF está disponible por 24 horas. Después vas a poder descargarlo desde el portal de ARCA con el CAE.';
export const AVISO_EN_DRIVE = 'Guardada en tu Drive. Ese link no vence.';

/**
 * 🔴 **`guardado` es el HECHO; el ajuste "guardar en Drive" es la INTENCIÓN.** El aviso de las 24 h
 * cuelga del hecho: con el ajuste prendido y el archivado fallado (Drive sin conectar, por ejemplo)
 * la factura sale igual y su ÚNICO link es el de ARCA, que vence. Colgar el aviso del ajuste le
 * haría creer al usuario que tiene una copia a salvo cuando no la tiene — peor que no avisar nunca.
 *
 * Drive primero: no vence. El de AfipSDK muere a las 24 h — ofrecerlo teniendo uno permanente sería
 * darle al usuario el peor de los dos sin decírselo.
 */
export function linkDelComprobante(estado: EstadoFacturaResp): { link: string | null; enDrive: boolean } {
  const enDrive = estado.drive?.guardado === true && estado.drive.link != null;
  return { enDrive, link: enDrive ? (estado.drive?.link ?? null) : (estado.pdf?.url ?? null) };
}

export interface DatosComprobanteProps {
  estado: EstadoFacturaResp;
  testID: string;
}

/** Tipo · punto de venta · número · CAE · vencimiento del CAE · total. El CAE es el dato principal:
 *  es lo único que sigue sirviendo cuando el link del PDF ya venció. */
export function DatosComprobante({ estado, testID }: DatosComprobanteProps) {
  const tema = useTema();
  const resultado = estado.resultado;
  if (resultado == null) return null;

  return (
    <View style={{ gap: tema.espacio.xs }}>
      <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
        Tipo de comprobante {resultado.tipoCbte} · Punto de venta {resultado.puntoVenta} · N° {resultado.nro}
      </Text>
      <Text
        testID={`${testID}-cae`}
        style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiBold, fontSize: tema.tipo.grande }}
      >
        CAE: {resultado.cae}
      </Text>
      {resultado.caeVto != null && (
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Vence el {resultado.caeVto}</Text>
      )}
      <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>Total: {estado.total}</Text>
    </View>
  );
}

export interface AccionesComprobanteProps {
  estado: EstadoFacturaResp;
  testID: string;
}

/** El aviso del link + `[Guardar]`/`[Compartir]`, o la advertencia de «emitida sin PDF». */
export function AccionesComprobante({ estado, testID }: AccionesComprobanteProps) {
  const tema = useTema();
  const { link, enDrive } = linkDelComprobante(estado);

  if (link == null) {
    return (
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
      <Text testID={`${testID}-sin-pdf`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
        Tu factura se emitió correctamente y el CAE de arriba es válido. El PDF no está disponible en este
        momento -- podés descargarlo más tarde desde el portal de ARCA con ese CAE.
      </Text>
    );
  }

  return (
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
          {
            etiqueta: 'Guardar',
            onPress: () => void abrirLink(link, 'tu factura'),
            variante: 'primario',
            testID: `${testID}-guardar`,
          },
          {
            etiqueta: 'Compartir',
            onPress: () => void compartirLink(link, 'tu factura'),
            variante: 'secundario',
            testID: `${testID}-compartir`,
          },
        ]}
      />
    </>
  );
}
