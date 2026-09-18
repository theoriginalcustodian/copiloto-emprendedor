/**
 * `ResumenIngresos` — **«Cobraste este mes»**, LA cifra de la pantalla de Ingresos.
 *
 * 🔴 **El total sale de `GET /ingresos/resumen`, NO de sumar la lista.** No es una preferencia de
 * implementación: el `total` que devuelve `listarIngresos()` suma **hasta `limite` filas recientes,
 * sin recortar por fecha**. Pintar ese número bajo el label «Cobraste este mes» le miente al usuario
 * sobre su propio negocio — lo dice el docstring del contrato en `packages/core`, y hasta ahora
 * mobile mostraba justamente ese número, aunque sin label (un importe grande y suelto arriba de la
 * lista, que el usuario lee como «lo del mes» igual).
 *
 * `mesAnterior` es `null`, no `'0.00'`: «no hay datos de ese mes» y «ese mes entró cero» son cosas
 * distintas. Cuando es `null` el chip no se dibuja.
 *
 * ⚠️ **El aviso de Mercado Pago va con el resumen, no en el pie.** Es la advertencia de que este
 * número puede estar incompleto, así que tiene que leerse junto al número. El texto es el mismo del
 * prototipo y de la app web, palabra por palabra.
 */
import { formatearImporte, type ResumenIngresos as ResumenIngresosDato } from '@copiloto/core';
import { StyleSheet, Text, View } from 'react-native';

import { BloqueCifra } from '../../theme/BloqueCifra';
import { useTema } from '../../theme/ThemeProvider';

export interface ResumenIngresosProps {
  resumen: ResumenIngresosDato;
}

export function ResumenIngresos({ resumen }: ResumenIngresosProps) {
  const tema = useTema();

  return (
    <View style={styles.raiz}>
      <BloqueCifra
        testID="ingresos-resumen"
        rotulo="Cobraste este mes"
        cifra={formatearImporte(resumen.total)}
        chip={resumen.mesAnterior != null ? `Mes anterior: ${formatearImporte(resumen.mesAnterior)}` : undefined}
      />
      <Text
        testID="ingresos-aviso-mercadopago"
        style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}
      >
        Los cobros por MercadoPago todavía no entran solos. Si cobrás por ahí, anotalo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: 10 },
});
