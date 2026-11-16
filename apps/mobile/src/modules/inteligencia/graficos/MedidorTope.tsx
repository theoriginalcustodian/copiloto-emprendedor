import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { conAlfa } from '../../../theme/glass/conAlfa';
import { useTema } from '../../../theme/ThemeProvider';

/**
 * El medidor del tope de monotributo (Martin 15/11): un arco de izquierda a derecha en vez de la barrita. El
 * porcentaje va grande en el centro —es lo que se viene a mirar— y el color del arco es el del semáforo que
 * manda el backend. Acá no se inventan umbrales ni zonas: el arco sólo dibuja el porcentaje que llega.
 *
 * Pasado el 100 el arco queda lleno; el número de adentro sigue diciendo la verdad.
 */
const ANCHO = 220;
const GROSOR = 16;
const RADIO = (ANCHO - GROSOR) / 2;
const ALTO = RADIO + GROSOR;
const CX = ANCHO / 2;
const CY = RADIO + GROSOR / 2;

/** `t` de 0 (extremo izquierdo) a 1 (extremo derecho), pasando por arriba. */
function punto(t: number) {
  const angulo = Math.PI * (1 - t);
  return { x: CX + RADIO * Math.cos(angulo), y: CY - RADIO * Math.sin(angulo) };
}

function arco(hasta: number, desde = 0): string {
  const a = punto(desde);
  const b = punto(hasta);
  return `M ${a.x} ${a.y} A ${RADIO} ${RADIO} 0 0 1 ${b.x} ${b.y}`;
}

export interface MedidorTopeProps {
  porcentaje: number;
  semaforo: string;
  /** A dónde se llega en 12 meses a este ritmo (porcentaje del tope). Se dibuja punteado, a continuación del avance. */
  proyectado?: number | null;
  testID: string;
}

export function MedidorTope({ porcentaje, semaforo, proyectado, testID }: MedidorTopeProps) {
  const tema = useTema();
  // `verde` va en tinta: es el estado normal y no necesita color. Los otros dos sí avisan.
  const color = semaforo === 'rojo' ? tema.color.peligro : semaforo === 'amarillo' ? tema.color.acento : tema.color.texto;
  const avance = Math.max(0, Math.min(porcentaje, 100)) / 100;
  const hasta = proyectado != null ? Math.max(0, Math.min(proyectado, 100)) / 100 : 0;

  return (
    <View testID={testID} style={styles.raiz} accessible accessibilityLabel={`${porcentaje}% del tope de monotributo`}>
      <Svg width={ANCHO} height={ALTO}>
        <Path d={arco(1)} fill="none" stroke={conAlfa(tema.color.texto, 0.1)} strokeWidth={GROSOR} strokeLinecap="round" />
        {/* Lo que falta recorrer a este ritmo: punteado, del avance de hoy a donde se llegaría en un año. */}
        {hasta > avance + 0.02 && (
          <Path
            testID={`${testID}-proyeccion`}
            d={arco(hasta, avance)}
            fill="none"
            stroke={conAlfa(tema.color.texto, 0.5)}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="1 9"
          />
        )}
        {avance > 0 && <Path testID={`${testID}-avance`} d={arco(avance)} fill="none" stroke={color} strokeWidth={GROSOR} strokeLinecap="round" />}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centro]} pointerEvents="none">
        <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 34, lineHeight: 38 }}>{porcentaje}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { alignSelf: 'center', width: ANCHO, height: ALTO },
  centro: { alignItems: 'center', justifyContent: 'flex-end' },
});
