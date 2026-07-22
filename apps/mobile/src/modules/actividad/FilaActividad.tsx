import { StyleSheet, Text, View } from 'react-native';

import { formatearImporte, type ActividadItem } from '@copiloto/core';

import { GlassIcon } from '../../theme/glass/GlassIcon';
import type { NombreIconoGlass } from '../../theme/glass/icons';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `FilaActividad` — una operación en la lista de actividad. **La misma fila en las dos pantallas**
 * (los 20 de la principal y la función Recientes completa), a propósito: si cada una compusiera lo
 * suyo, el mismo ítem se vería distinto según dónde lo mirás.
 *
 * 🔴 **No compone texto de negocio.** `titulo` y `detalle` vienen armados del backend y se muestran
 * tal cual. Y **el color sale de `signo`, no del `tipo`**: si la app dedujera "factura ⇒ verde", el
 * día que entre un tipo nuevo pintaría el color equivocado **en silencio**. Un `signo` que no
 * reconozco cae en `neutro`, que es el que no pinta nada — no mostrar color es honesto; inventar
 * "entra" teñiría de verde algo que quizá salió.
 *
 * 🔴 **Es tappable SÓLO si tiene dónde aterrizar.** `onPress` llega `undefined` para los tipos sin
 * destino (hoy `ingreso`, que viene con Contabilidad) y entonces la fila no se pinta como botón: un
 * ítem que se toca y no hace nada se lee como *«la app está rota»*, no como *«esa función todavía no
 * está»*. Quién tiene destino lo decide `destinoActividad.ts`, no esta fila.
 */

/** Ícono por tipo. `clock` es el default: un tipo nuevo del backend se ve genérico, no roto. */
const ICONO_POR_TIPO: Record<string, NombreIconoGlass> = {
  factura: 'doc_search',
  nota_credito: 'doc_search',
  presupuesto: 'note',
  gasto: 'wallet',
  ingreso: 'chart',
  cliente: 'user',
};

export interface FilaActividadProps {
  item: ActividadItem;
  /** Ausente = la fila no es tocable. Ver el docstring. */
  onPress?: (item: ActividadItem) => void;
  testID?: string;
}

export function FilaActividad({ item, onPress, testID }: FilaActividadProps) {
  const tema = useTema();
  const icono = ICONO_POR_TIPO[item.tipo] ?? 'clock';
  const colorMonto =
    item.signo === 'entra'
      ? tema.color.exito
      : item.signo === 'sale'
        ? tema.color.peligro
        : tema.color.textoTenue;

  return (
    <Row
      testID={testID ?? `actividad-${item.id}`}
      onPress={onPress != null ? () => onPress(item) : undefined}
      style={styles.fila}
    >
      <GlassIcon name={icono} size={34} />
      <View style={styles.texto}>
        <Text
          numberOfLines={1}
          style={[styles.titulo, { color: tema.color.texto, fontFamily: tema.fuente.uiMedium }]}
          testID={`actividad-${item.id}-titulo`}
        >
          {item.titulo}
        </Text>
        {item.detalle !== '' && (
          <Text
            numberOfLines={1}
            style={[styles.detalle, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}
            testID={`actividad-${item.id}-detalle`}
          >
            {item.detalle}
          </Text>
        )}
      </View>
      {/* `monto` es `null` en los tipos que no mueven plata (un cliente nuevo). No se dibuja un
          `$0,00` ahí: sería afirmar que la operación valió cero. */}
      {item.monto != null && (
        <Text style={[styles.monto, { color: colorMonto }]} testID={`actividad-${item.id}-monto`}>
          {item.signo === 'sale' ? '−' : ''}
          {formatearImporte(item.monto)}
        </Text>
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  fila: { gap: 12, alignItems: 'center' },
  texto: { flex: 1 },
  titulo: { fontSize: 13 },
  detalle: { fontSize: 11, marginTop: 2 },
  monto: { fontSize: 12, fontWeight: '600' },
});
