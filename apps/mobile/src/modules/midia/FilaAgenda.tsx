import { StyleSheet, Text, View } from 'react-native';

import { conAlfa } from '../../theme/glass/conAlfa';
import { useTema } from '../../theme/ThemeProvider';

/**
 * Una fila de agenda (Martin 15/11), la misma de «Ahora» en Mi día: a la izquierda la marca —la hora, el día o
 * una sigla— en negrita y siempre en un renglón; a la derecha el título, con lugar para dos renglones, y debajo
 * su detalle en gris. Sin marca, el texto ocupa todo el ancho.
 */
export function FilaAgenda({
  marca,
  marcaSobre,
  titulo,
  detalle,
  apagada = false,
  colorDetalle,
  conDivisor = false,
  testID,
}: {
  marca?: string | null;
  /**
   * Un rótulo chico encima de la marca: el día de la semana sobre el número («mar» / «17»), como la columna de
   * fechas de la vista Agenda de Google Calendar.
   */
  marcaSobre?: string | null;
  titulo: string;
  detalle?: string | null;
  /** Lo que ya pasó: se sigue leyendo, pero en gris. */
  apagada?: boolean;
  /** Para un detalle que avisa algo (un vencimiento ya vencido). Por defecto, gris. */
  colorDetalle?: string;
  conDivisor?: boolean;
  testID?: string;
}) {
  const tema = useTema();
  const tinta = apagada ? tema.color.textoTenue : tema.color.texto;
  return (
    <View
      testID={testID}
      style={[estilos.fila, conDivisor && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }]}
    >
      {marca != null && marca !== '' && marcaSobre == null && (
        <Text numberOfLines={1} style={[estilos.marca, { color: tinta, fontFamily: tema.fuente.display, fontSize: tema.tipo.base }]}>
          {marca}
        </Text>
      )}
      {marca != null && marca !== '' && marcaSobre != null && (
        <View style={estilos.marcaFecha}>
          <Text numberOfLines={1} style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.uiMedium, fontSize: 11, letterSpacing: 0.4 }}>
            {marcaSobre}
          </Text>
          <Text numberOfLines={1} style={{ color: tinta, fontFamily: tema.fuente.display, fontSize: 22, lineHeight: 26 }}>
            {marca}
          </Text>
        </View>
      )}
      <View style={estilos.textos}>
        <Text numberOfLines={2} style={{ color: tinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, lineHeight: 21 }}>
          {titulo}
        </Text>
        {detalle != null && detalle !== '' && (
          <Text style={{ color: colorDetalle ?? tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>{detalle}</Text>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 16 },
  // Ancho fijo: entra «00:00», «Mar 17» y «ARCA» en negrita sin saltar de renglón, y los títulos caen en columna.
  marca: { width: 56, lineHeight: 21 },
  // La fecha apilada ocupa la misma columna que la hora, centrada como en Google Calendar.
  marcaFecha: { width: 56, alignItems: 'center' },
  textos: { flex: 1, gap: 2 },
});
