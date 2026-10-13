import type { PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

export interface ReciboProps extends PropsWithChildren {
  testID: string;
  /** `exito`: confirmación de algo hecho. `tenue`: «no lo anotamos», «ya está». */
  tono: 'exito' | 'tenue';
  /** Una línea: qué pasó. Es lo que anuncia el lector de pantalla. */
  titulo: string;
  /** Líneas de datos bajo el título (`t2` del `REC` del prototipo): «N° 12 · $ 145.000 · Fernández». */
  detalle?: string[];
  /** Enlace a la derecha (`.link` del `REC`): lleva a donde está el detalle, p. ej. «Doc». */
  enlace?: { texto: string; onPress: () => void; testID?: string };
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
export function Recibo({ testID, tono, titulo, detalle, enlace, nota, children }: ReciboProps) {
  const tema = useTema();
  const color = tono === 'exito' ? tema.color.exito : tema.color.textoTenue;
  return (
    <Tile testID={testID}>
      <View style={{ gap: tema.espacio.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: tema.espacio.sm }}>
          {/* El `.ok` del `REC` del prototipo: el check que marca el estado terminal. Sólo en éxito —
              «no lo anotamos» no es una confirmación. Decorativo: el título ya lo dice. */}
          {tono === 'exito' && (
            // SVG y no un glifo `✓` en un <Text>: un carácter suelto entraría en el texto de la Tile
            // (lector de pantalla y `toHaveTextContent`) y el título ya dice lo que pasó.
            <Svg
              testID={`${testID}-icono`}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              width={16}
              height={16}
              viewBox="0 0 16 16"
              fill="none"
              style={{ marginTop: 2 }}
            >
              <Path d="M3 8.5 6.5 12 13 4.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              testID={`${testID}-titulo`}
              accessibilityLiveRegion="polite"
              style={{ color, fontSize: tema.tipo.base, fontWeight: tono === 'exito' ? '600' : '400' }}
            >
              {titulo}
            </Text>
            {detalle?.map((linea, i) => (
              <Text
                key={`${i}-${linea}`}
                testID={`${testID}-detalle-${i}`}
                style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
              >
                {linea}
              </Text>
            ))}
          </View>
          {enlace != null && (
            <Pressable
              testID={enlace.testID ?? `${testID}-enlace`}
              accessibilityRole="link"
              onPress={enlace.onPress}
              hitSlop={8}
            >
              <Text style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.chico, fontWeight: '600' }}>
                {enlace.texto}
              </Text>
            </Pressable>
          )}
        </View>
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
