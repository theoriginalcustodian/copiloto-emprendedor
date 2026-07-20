import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTema } from '../../theme/ThemeProvider';

export type RolBurbuja = 'user' | 'assistant';

export interface BurbujaProps {
  role: RolBurbuja;
  text: string;
}

/**
 * Burbuja de chat — fork del `Burbuja.tsx` de DocuMed
 * (`_staging/documed/apps/mobile/src/modules/chat/Burbuja.tsx`). Vidrio LEVANTADO sobre el vidrio de
 * la conversación, no un bloque plano de color: la burbuja deja ver el fondo a través suyo y se
 * despega del panel por el borde, la línea de luz superior y la sombra proyectada.
 *
 * 🔴 **No porta el renderer de artefacto** (`TarjetaArtefacto` en el origen, específico de DocuMed —
 * fuera del alcance de este sprint: ver `ChatView.tsx`/informe del port). Si más adelante el backend
 * empieza a mandar `card`s propias del copiloto (ej. un resumen de cobro confirmado), ese renderer se
 * agrega acá cuando exista el diseño — hoy `Burbuja` sólo pinta texto.
 *
 * `overflow:'hidden'` recorta el gradiente al radio; la sombra la proyecta el contenedor padre (que
 * no recorta), y `backgroundColor` translúcido (`s2`) le da a Android el outline que necesita para
 * dibujarla sin volver la burbuja opaca. Cero-hex: todo sale de `useTema()`.
 */
export function Burbuja({ role, text }: BurbujaProps) {
  const tema = useTema();
  const g = tema.glass;
  const esUsuario = role === 'user';

  return (
    <View style={[styles.fila, esUsuario ? styles.filaUsuario : styles.filaAsistente]}>
      <View
        style={[
          styles.burbuja,
          {
            borderColor: esUsuario ? g.bd : g.s1,
            backgroundColor: g.s2,
            shadowColor: g.sombra,
            // Cola direccional: la esquina "sin redondear" apunta a quién habla.
            borderTopLeftRadius: tema.radio.lg,
            borderTopRightRadius: tema.radio.lg,
            borderBottomLeftRadius: esUsuario ? tema.radio.lg : tema.radio.sm,
            borderBottomRightRadius: esUsuario ? tema.radio.sm : tema.radio.lg,
            padding: tema.espacio.sm,
          },
        ]}
      >
        <LinearGradient
          colors={esUsuario ? [g.ub1, g.ub2] : [g.s1, g.s2]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Línea de luz superior: el canto iluminado que despega la burbuja. */}
        <View style={[styles.luzSuperior, { backgroundColor: g.hi }]} pointerEvents="none" />
        <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { maxWidth: '85%', gap: 4 },
  filaUsuario: { alignSelf: 'flex-end' },
  filaAsistente: { alignSelf: 'flex-start' },
  burbuja: {
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    shadowOpacity: 0.7,
    elevation: 6,
  },
  luzSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});
