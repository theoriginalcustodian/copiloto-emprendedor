import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTema } from '../../theme/ThemeProvider';
import { sombraNivel } from '../../theme/glass/relieve';

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
 *
 * Relieve (ODOBI §2.4): la burbuja del ASISTENTE usa el nivel 1 neutro ("superficie en reposo");
 * la del USUARIO usa la sombra auxiliar del acento (`glass.relieve.burbujaUsuario` — DoD "sombras
 * auxiliares del acento", el mismo tono que UB2 a .4, distinta del nivel 1 neutro) porque es una
 * superficie de acento, no una card neutra. Ver `relieve.ts`.
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
          sombraNivel(esUsuario ? g.relieve.burbujaUsuario : g.relieve.nivel1),
          {
            borderColor: esUsuario ? g.bd : g.s1,
            backgroundColor: g.s2,
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
    // La sombra proyectada la pone `sombraNivel(...)` — ver el docstring del módulo.
  },
  luzSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});
