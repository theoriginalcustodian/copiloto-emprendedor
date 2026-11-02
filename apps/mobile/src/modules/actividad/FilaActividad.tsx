import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { formatearImporte, type ActividadItem } from '@copiloto/core';

import { GlassIcon } from '../../theme/glass/GlassIcon';
import { pressableStyle } from '../../theme/glass/presion';
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

/** Ícono por tipo. `actividadReciente` es el default: un tipo nuevo del backend se ve genérico, no
 *  roto. `ingreso` usa el ícono de `contabilidad` -- no el de `ingresos` -- porque hoy ese tipo
 *  navega a Contabilidad (ver el docstring del módulo), y el glifo tiene que decir A DÓNDE VA la
 *  fila, no de qué signo es el monto. */
const ICONO_POR_TIPO: Record<string, NombreIconoGlass> = {
  factura: 'facturacion',
  nota_credito: 'facturacion',
  presupuesto: 'presupuestos',
  gasto: 'gastos',
  ingreso: 'contabilidad',
  cliente: 'clientes',
  ticket_respuesta: 'conversacion',
};

export interface FilaActividadProps {
  item: ActividadItem;
  /** Ausente = la fila no es tocable. Ver el docstring. */
  onPress?: (item: ActividadItem) => void;
  testID?: string;
  /**
   * Adentro del bloque negro del escritorio (`.r-fila`, `index.html`): una línea de texto con su separador, sin
   * vidrio ni ícono. Los datos, los testIDs y el nombre accesible son los mismos que en `/recientes`.
   */
  enBloque?: boolean;
  /** Dentro del bloque, la última fila no lleva separador. */
  ultima?: boolean;
}

export function FilaActividad({ item, onPress, testID, enBloque = false, ultima = false }: FilaActividadProps) {
  const tema = useTema();
  const icono = ICONO_POR_TIPO[item.tipo] ?? 'actividadReciente';
  // En el bloque el monto va en el color del texto: el verde y el rojo no están pensados para el negro, y el
  // signo sigue diciendo si entra o sale.
  const colorMonto = enBloque
    ? tema.color.bloqueTexto
    : item.signo === 'entra'
      ? tema.color.exito
      : item.signo === 'sale'
        ? tema.color.peligro
        : tema.color.textoTenue;
  const colorTitulo = enBloque ? tema.color.bloqueTexto : tema.color.texto;
  const colorDetalle = enBloque ? tema.color.bloqueApoyo : tema.color.textoTenue;

  const contenido = (
    <>
      <View style={styles.texto}>
        <Text
          numberOfLines={1}
          style={[styles.titulo, { color: colorTitulo, fontFamily: tema.fuente.uiMedium }]}
          testID={`actividad-${item.id}-titulo`}
        >
          {item.titulo}
        </Text>
        {item.detalle !== '' && (
          <Text
            numberOfLines={1}
            style={[styles.detalle, { color: colorDetalle, fontFamily: tema.fuente.mono }]}
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
    </>
  );

  if (enBloque) {
    return (
      <Pressable
        testID={testID ?? `actividad-${item.id}`}
        accessibilityRole={onPress != null ? 'button' : undefined}
        accessibilityLabel={item.detalle !== '' ? `${item.titulo} · ${item.detalle}` : item.titulo}
        onPress={onPress != null ? () => onPress(item) : undefined}
        style={pressableStyle([
          styles.filaBloque,
          !ultima && { borderBottomWidth: 1, borderBottomColor: tema.color.bloqueChip },
        ])}
      >
        {contenido}
      </Pressable>
    );
  }

  return (
    <Row
      testID={testID ?? `actividad-${item.id}`}
      onPress={onPress != null ? () => onPress(item) : undefined}
      /**
       * 🔴 **El nombre de la fila lo arma el BACKEND, igual que su texto visible.** `titulo` y
       * `detalle` vienen compuestos de allá a propósito (ver el docstring del módulo); reusarlos acá
       * mantiene esa regla — si la app inventara un nombre distinto del que se ve, el lector de
       * pantalla y la pantalla dirían cosas distintas sobre la misma operación.
       *
       * `detalle` se suma sólo si existe: un separador colgando (« · ») al final de un nombre es
       * ruido que se lee en voz alta.
       */
      accessibilityLabel={item.detalle !== '' ? `${item.titulo} · ${item.detalle}` : item.titulo}
      style={styles.fila}
    >
      <GlassIcon name={icono} size={34} />
      {contenido}
    </Row>
  );
}

const styles = StyleSheet.create({
  fila: { gap: 12, alignItems: 'center' },
  filaBloque: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12 },
  texto: { flex: 1 },
  titulo: { fontSize: 13 },
  detalle: { fontSize: 11, marginTop: 2 },
  monto: { fontSize: 12, fontWeight: '600' },
});
