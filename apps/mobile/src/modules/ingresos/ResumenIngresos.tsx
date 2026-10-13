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
 * ℹ️ **Ya no hay aviso «los cobros por MercadoPago todavía no entran solos».** Lo retiró COBROMP
 * (`9e4a70dc`): un pago aprobado se vuelve Ingreso (`origen: 'mercadopago'`), así que el cartel del
 * prototipo (`index.html:2263`) afirmaría algo falso. Lo fija `PantallaIngresos.test.tsx`
 * («ya no hay cartel…»).
 */
import { formatearImporte, type ResumenIngresos as ResumenIngresosDato } from '@copiloto/core';
import { StyleSheet, View } from 'react-native';

import { BloqueCifra } from '../../theme/BloqueCifra';

export interface ResumenIngresosProps {
  resumen: ResumenIngresosDato;
}

export function ResumenIngresos({ resumen }: ResumenIngresosProps) {
  return (
    <View style={styles.raiz}>
      <BloqueCifra
        testID="ingresos-resumen"
        rotulo="Cobraste este mes"
        cifra={formatearImporte(resumen.total)}
        chip={resumen.mesAnterior != null ? `Mes anterior: ${formatearImporte(resumen.mesAnterior)}` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: 10 },
});
