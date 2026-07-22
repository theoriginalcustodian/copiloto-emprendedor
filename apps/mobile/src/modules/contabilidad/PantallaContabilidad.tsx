import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';

/**
 * `PantallaContabilidad` — cascarón de Contabilidad.
 *
 * 🔴 **Cascarón A PROPÓSITO, y lo dice en pantalla** — mismo criterio que `PantallaMiDia`. Su contrato
 * ya está escrito (`contrato_planificacion-a-todos_contabilidad`) y espera que backend cierre Clientes;
 * el tile existe desde ahora para que el lugar esté decidido y no se agregue "al final" cuando llegue.
 *
 * El texto describe lo que va a ser **sin inventar un número**: la decisión que sostiene ese contrato
 * es que caja y facturación son **dos preguntas distintas** —sumar factura emitida + cobro cuenta la
 * misma plata dos veces y da un total que parece razonable y está inflado—, así que ni siquiera el
 * cascarón habla de "ingresos" a secas.
 */
export function PantallaContabilidad() {
  const tema = useTema();

  return (
    <MarcoGlass titulo="Contabilidad" icono="folder" testID="pantalla-contabilidad">
      <View
        testID="contabilidad-contenido"
        style={[styles.contenedor, { padding: tema.espacio.lg, gap: tema.espacio.sm }]}
      >
        <Text
          testID="contabilidad-descripcion"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 }}
        >
          Cuánta plata tenés y cuánto facturaste — que son dos preguntas distintas, y por eso van a
          verse por separado.
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
