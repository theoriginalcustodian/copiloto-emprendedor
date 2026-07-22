/**
 * `CampoSelect` — opciones como chips de vidrio presionables. Deliberadamente NO un `Picker` nativo.
 *
 * 🔴 **Por qué no `Picker`.** En Android abre un diálogo/hoja del SISTEMA -- ni el fondo, ni la
 * tipografía, ni el radio son el vidrio de la app: el usuario ve un control genérico encima de la
 * pantalla de facturación y el lenguaje visual se corta en seco. Mismo criterio que `CampoFecha`
 * (tampoco usa date-picker nativo, misma razón). El plan de UI (`docs/copiloto-emprendedor/
 * 2026-07-21-plan-ui-facturacion-afip.md` §4) lo pide explícito: "Sin Picker nativo: rompe el lenguaje
 * del vidrio y en Android abre un diálogo del sistema".
 *
 * Cada chip es la misma superficie de `EnvolturaCampo` en una caja más chica -- no un color plano
 * nuevo -- envuelta en el `Pressable` de gesture-handler (ver docstring de `Tile.tsx`: dos árbitros de
 * gesto sobre el mismo dedo es el bug ya cazado en este repo).
 */
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { useTema } from '../../ThemeProvider';
import { pressableStyle } from '../presion';
import { EnvolturaCampo } from './EnvolturaCampo';

export interface OpcionSelect {
  valor: string;
  etiqueta: string;
  descripcion?: string;
}

export interface CampoSelectProps {
  etiqueta: string;
  opciones: OpcionSelect[];
  valor: string;
  onChange: (valor: string) => void;
  error?: string;
  testID?: string;
}

export function CampoSelect({ etiqueta, opciones, valor, onChange, error, testID = 'campo-select' }: CampoSelectProps) {
  const tema = useTema();
  const hayError = error != null && error !== '';
  return (
    <View style={styles.contenedor} testID={testID}>
      <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}>
        {etiqueta}
      </Text>
      <View style={styles.chips}>
        {opciones.map((opcion) => {
          const seleccionado = opcion.valor === valor;
          const idOpcion = `${testID}-opcion-${opcion.valor}`;
          return (
            <Pressable
              key={opcion.valor}
              testID={idOpcion}
              accessibilityRole="button"
              accessibilityState={{ selected: seleccionado }}
              onPress={() => onChange(opcion.valor)}
              style={pressableStyle(styles.chipPresionable)}
            >
              {/* `hayError` no tiñe el chip individual -- el error de un select es "no elegiste
                  ninguna", no "esta opción está mal"; el aviso de abajo ya lo comunica. El borde del
                  chip sólo distingue seleccionado/no-seleccionado. */}
              <EnvolturaCampo
                style={[styles.chip, { borderColor: seleccionado ? tema.color.acento : tema.color.borde }]}
              >
                <Text
                  style={{
                    color: seleccionado ? tema.color.acento : tema.color.texto,
                    fontFamily: tema.fuente.uiMedium,
                    fontSize: tema.tipo.base,
                  }}
                >
                  {opcion.etiqueta}
                </Text>
                {opcion.descripcion != null && opcion.descripcion !== '' && (
                  <Text
                    style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.ui, fontSize: tema.tipo.chico }}
                  >
                    {opcion.descripcion}
                  </Text>
                )}
              </EnvolturaCampo>
            </Pressable>
          );
        })}
      </View>
      {hayError && (
        <Text
          testID={`${testID}-error`}
          style={[styles.error, { color: tema.color.peligro, fontFamily: tema.fuente.mono }]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 6 },
  etiqueta: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipPresionable: { flexGrow: 0 },
  chip: { minHeight: 0, paddingVertical: 10, paddingHorizontal: 14, justifyContent: 'center', gap: 2 },
  error: { fontSize: 11, letterSpacing: 0.2 },
});
