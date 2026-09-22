import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { avisoArmarFactura, facturarPresupuesto, type SugerenciaArmarFactura } from '@copiloto/core';

import { empujarUnaVez } from '../../navegacion/empujarUnaVez';
import { FilaBotones } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';

/**
 * BL-J9 / K-07-B — «¿Te armo la factura?». Sin pantalla nueva: `facturarPresupuesto` es idempotente y
 * devuelve el borrador; se navega a `/facturacion` (el gate de factura existente) con ese `facturaId`,
 * igual que «Completar a mano» de `TarjetaFacturaPropuesta`. Si no se pudo, se dice — no se navega.
 */
export interface ChipArmarFacturaProps {
  sugerencia: SugerenciaArmarFactura;
  testID?: string;
}

export function ChipArmarFactura({ sugerencia, testID = 'chip-armar-factura' }: ChipArmarFacturaProps) {
  const tema = useTema();
  const [aviso, setAviso] = useState<string | null>(null);
  const enviando = useRef(false);

  async function armar() {
    if (enviando.current) return;
    enviando.current = true;
    setAviso(null);
    try {
      const res = await facturarPresupuesto(sugerencia.presupuestoId);
      if (res.status === 'ok') {
        empujarUnaVez({ pathname: '/facturacion', params: { facturaId: res.facturaId } });
      } else {
        setAviso(avisoArmarFactura(res));
      }
    } catch {
      setAviso('No pudimos armar la factura. Probá de nuevo.');
    } finally {
      enviando.current = false;
    }
  }

  return (
    <View testID={testID} style={{ gap: tema.espacio.sm, alignSelf: 'flex-start' }}>
      <FilaBotones
        testID={`${testID}-botones`}
        botones={[
          {
            etiqueta: sugerencia.texto,
            onPress: () => void armar(),
            variante: 'secundario',
            testID: `${testID}-boton`,
          },
        ]}
      />
      {aviso != null && (
        <Text
          testID={`${testID}-aviso`}
          accessibilityRole="alert"
          style={{ color: tema.color.texto, fontSize: tema.tipo.chico }}
        >
          {aviso}
        </Text>
      )}
    </View>
  );
}
