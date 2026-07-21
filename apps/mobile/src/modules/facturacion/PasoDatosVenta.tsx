import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DatosVentaInput, EstadoFacturaResp } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { CampoFecha, CampoSelect, FilaBotones } from '../../theme/glass/campos';
import { OPCIONES_CONCEPTO, OPCIONES_CONDICION_VENTA } from './catalogos';

/**
 * Paso 1 — Datos de venta. `fecha` + `concepto` (Productos/Servicios/Ambos) + `condicionVenta`, y con
 * concepto 2 (Servicios) o 3 (Ambos) las TRES fechas de servicio (`afip_rules.py`, regla R6 citada en
 * `afip.ts::DatosVentaInput`) — se muestran apenas se elige el concepto, no se esconden hasta que el
 * backend rechace: mismo criterio que el resto del formulario, "si algo es obligatorio la UI lo pide
 * antes, no después de fallar".
 *
 * El botón "Continuar" queda deshabilitado hasta que lo local-obligatorio esté completo -- una
 * verificación de UX, no la validación real (esa es del backend: `cargar_datos_venta` no tira 4xx, dejan
 * un `motivo` en el próximo `estadoFactura()`, que `PantallaFacturacion` ya vuelve a mostrar como este
 * mismo paso porque el `estado` no habrá avanzado).
 */
export interface PasoDatosVentaProps {
  estado: EstadoFacturaResp;
  onGuardar: (datos: DatosVentaInput) => Promise<void>;
  /** `true` cuando se llegó acá desde "Editar y confirmar" del resumen -- suma el botón de volver. */
  modoEdicion?: boolean;
  onVolverResumen?: () => void;
  testID?: string;
}

export function PasoDatosVenta({
  estado,
  onGuardar,
  modoEdicion = false,
  onVolverResumen,
  testID = 'facturacion-paso-datos-venta',
}: PasoDatosVentaProps) {
  const tema = useTema();
  const [fecha, setFecha] = useState('');
  const [concepto, setConcepto] = useState('1');
  const [condicionVenta, setCondicionVenta] = useState('');
  const [fechaServicioDesde, setFechaServicioDesde] = useState('');
  const [fechaServicioHasta, setFechaServicioHasta] = useState('');
  const [fechaVtoPago, setFechaVtoPago] = useState('');
  const [enviando, setEnviando] = useState(false);

  const requiereFechasServicio = concepto === '2' || concepto === '3';
  const listoLocal =
    fecha !== '' &&
    condicionVenta !== '' &&
    (!requiereFechasServicio || (fechaServicioDesde !== '' && fechaServicioHasta !== '' && fechaVtoPago !== ''));

  async function continuar() {
    setEnviando(true);
    try {
      await onGuardar({
        fecha,
        concepto: Number(concepto) as 1 | 2 | 3,
        condicionVenta,
        fechaServicioDesde: requiereFechasServicio ? fechaServicioDesde : null,
        fechaServicioHasta: requiereFechasServicio ? fechaServicioHasta : null,
        fechaVtoPago: requiereFechasServicio ? fechaVtoPago : null,
      });
    } finally {
      setEnviando(false);
    }
  }

  const hayMotivo = estado.motivo != null && estado.motivo !== '';

  return (
    <View testID={testID} style={[styles.contenedor, { gap: tema.espacio.md }]}>
      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
        Datos de venta
      </Text>

      {hayMotivo && (
        <Text
          testID={`${testID}-motivo`}
          style={{ color: tema.color.peligro, fontSize: tema.tipo.chico, fontFamily: tema.fuente.mono }}
        >
          {estado.motivo}
        </Text>
      )}

      <CampoFecha etiqueta="Fecha" valor={fecha} onChange={setFecha} testID={`${testID}-fecha`} />
      <CampoSelect
        etiqueta="Concepto"
        opciones={OPCIONES_CONCEPTO}
        valor={concepto}
        onChange={setConcepto}
        testID={`${testID}-concepto`}
      />
      <CampoSelect
        etiqueta="Condición de venta"
        opciones={OPCIONES_CONDICION_VENTA}
        valor={condicionVenta}
        onChange={setCondicionVenta}
        testID={`${testID}-condicion-venta`}
      />

      {requiereFechasServicio && (
        <View testID={`${testID}-fechas-servicio`} style={{ gap: tema.espacio.md }}>
          <CampoFecha
            etiqueta="Servicio desde"
            valor={fechaServicioDesde}
            onChange={setFechaServicioDesde}
            testID={`${testID}-servicio-desde`}
          />
          <CampoFecha
            etiqueta="Servicio hasta"
            valor={fechaServicioHasta}
            onChange={setFechaServicioHasta}
            testID={`${testID}-servicio-hasta`}
          />
          <CampoFecha
            etiqueta="Vencimiento de pago"
            valor={fechaVtoPago}
            onChange={setFechaVtoPago}
            testID={`${testID}-vto-pago`}
          />
        </View>
      )}

      <FilaBotones
        testID={`${testID}-botones`}
        botones={[
          {
            etiqueta: enviando ? 'Guardando…' : 'Continuar',
            onPress: continuar,
            variante: 'primario',
            deshabilitado: !listoLocal || enviando,
            testID: `${testID}-continuar`,
          },
          ...(modoEdicion && onVolverResumen
            ? [{ etiqueta: 'Volver al resumen', onPress: onVolverResumen, testID: `${testID}-volver` }]
            : []),
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
});
