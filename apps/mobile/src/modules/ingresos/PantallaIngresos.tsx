import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';

/**
 * `PantallaIngresos` — cascarón de Ingresos.
 *
 * 🔴 **La función existe como tile desde ya, y eso NO es adelantarse: es el punto entero del
 * addendum.** *«Si el emprendedor ve Gastos y no ve Ingresos, asume que la plata que entra no se
 * registra»* — y no la va a ir a buscar adentro de Contabilidad. La simetría es lo que hace que se
 * entienda sin que nadie la explique.
 *
 * El problema que viene a resolver, dicho sin vueltas: **hoy un cobro sólo existe si pasó por
 * MercadoPago.** El efectivo y las transferencias no dejan rastro, así que la caja da números
 * **coherentes y falsos** — el tipo de error que no duele hasta que alguien compara con el banco.
 *
 * Se construye como la simétrica de Gastos, **portando el molde y no reinventándolo**: tool de voz,
 * card editable, pantalla y alta manual ya existen del otro lado. Y la regla dura que la gobierna es
 * que **lo único obligatorio es el monto**: un formulario que exige medio de pago y cliente para
 * anotar que te pagaron es exactamente lo que hace que el emprendedor deje de anotar.
 */
export function PantallaIngresos() {
  const tema = useTema();

  return (
    <MarcoGlass titulo="Ingresos" icono="ingreso" testID="pantalla-ingresos">
      <View
        testID="ingresos-contenido"
        style={[styles.contenedor, { padding: tema.espacio.lg, gap: tema.espacio.sm }]}
      >
        <Text
          testID="ingresos-descripcion"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 }}
        >
          La plata que entra: lo que cobrás en efectivo, por transferencia o con MercadoPago. Vas a
          poder dictarlo — «me pagaron 85 mil de la panadería» — y listo.
        </Text>
        <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.mono, fontSize: 11, letterSpacing: 1.2 }}>
          PRÓXIMAMENTE
        </Text>
      </View>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
});
