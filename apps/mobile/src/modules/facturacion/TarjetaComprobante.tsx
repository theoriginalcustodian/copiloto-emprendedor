import { StyleSheet, Text, View } from 'react-native';

import type { EstadoFacturaResp } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { FilaBotones } from '../../theme/glass/campos';
import { AccionesComprobante, DatosComprobante } from './comprobante';
import { SeccionCobro } from './SeccionCobro';

/** Tipo 13 = nota de crédito. No es una deuda de nadie: no se ofrece cobrarla. Mismo criterio que
 *  `DetalleComprobante` y que el backend, que la deja afuera de «me deben». */
const TIPO_NOTA_CREDITO = 13;

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

  return (
    <View testID={testID} style={[styles.contenedor, { gap: tema.espacio.md }]}>
      <Text
        testID={`${testID}-titulo`}
        style={{ color: tema.color.exito, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}
      >
        Factura emitida
      </Text>

      <DatosComprobante estado={estado} testID={testID} />

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

      <AccionesComprobante estado={estado} testID={testID} />

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
