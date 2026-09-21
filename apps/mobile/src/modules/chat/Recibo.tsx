import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';

import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

export interface ReciboProps extends PropsWithChildren {
  testID: string;
  /** `exito`: confirmación de algo hecho. `tenue`: «no lo anotamos», «ya está». */
  tono: 'exito' | 'tenue';
  /** Una línea: qué pasó. Es lo que anuncia el lector de pantalla. */
  titulo: string;
  /** Texto secundario (aviso, «preparando el PDF…»). */
  nota?: { texto: string; testID?: string };
}

/**
 * `Recibo` (BL-F1) — el estado terminal de una card del chat: qué pasó, sus datos (`children`) y, si
 * hay, la acción que sigue. Un solo componente para factura, gasto, ingreso, presupuesto y cliente;
 * antes cada card mantenía su propio texto terminal (`TarjetaPropuestaTerminal` ahora delega acá).
 *
 * 🔴 `accessibilityLiveRegion="polite"` sobre el título: el resultado de una acción se ANUNCIA. Sin
 * eso, quien usa TalkBack confirma «Guardar» y no oye qué pasó (WCAG 4.1.3). En iOS el equivalente es
 * la notificación de accesibilidad que dispara el cambio de contenido de la región.
 */
export function Recibo({ testID, tono, titulo, nota, children }: ReciboProps) {
  const tema = useTema();
  return (
    <Tile testID={testID}>
      <View style={{ gap: tema.espacio.sm }}>
        <Text
          testID={`${testID}-titulo`}
          accessibilityLiveRegion="polite"
          style={{
            color: tono === 'exito' ? tema.color.exito : tema.color.textoTenue,
            fontSize: tema.tipo.base,
            fontWeight: tono === 'exito' ? '600' : '400',
          }}
        >
          {titulo}
        </Text>
        {children}
        {nota != null && (
          <Text
            testID={nota.testID}
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
          >
            {nota.texto}
          </Text>
        )}
      </View>
    </Tile>
  );
}
