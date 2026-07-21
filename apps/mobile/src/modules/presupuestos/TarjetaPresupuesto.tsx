import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { formatearFechaCorta, formatearImporte, type Presupuesto } from '@copiloto/core';

import { Row } from '../../theme/glass/Row';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `TarjetaPresupuesto` — una card del listado.
 *
 * 🔴 **El resumen es DERIVADO, no un texto guardado.** No existe campo `resumen` y no va a haberlo:
 * un resumen redactado envejece — cambia el total y sigue diciendo el viejo. Se compone en el momento
 * de los campos que sí son la fuente (`receptor.nombre · total · fecha` arriba, `concepto ·
 * cantidadItems` abajo), así que no puede desincronizarse de lo que muestra el detalle.
 *
 * 🔴 **El badge sale de `facturado`, NUNCA de `facturaId != null`.** Un borrador que el usuario
 * canceló deja `facturaId` puesto y `facturado: false`; derivarlo del id marcaría como facturados
 * presupuestos cuya factura nunca se emitió. Es el error que el contrato del backend nombra
 * explícitamente, y la razón de que los dos campos existan por separado.
 *
 * 🔴 **`cantidadItems`, no `items.length`.** El listado omite `items` a propósito (respuestas más
 * chicas), así que leer el largo del array haría que toda card dijera "0 ítems".
 *
 * `Pressable` de Gesture Handler y no de `react-native`: la lista vive dentro del scroll de gestos, y
 * dos sistemas de toque en el mismo árbol se disputan el dedo (ver `EscritorioFunciones`).
 */
export interface TarjetaPresupuestoProps {
  presupuesto: Presupuesto;
  onPress: (presupuesto: Presupuesto) => void;
  testID?: string;
}

export function TarjetaPresupuesto({ presupuesto: p, onPress, testID }: TarjetaPresupuestoProps) {
  const tema = useTema();
  const id = testID ?? `presupuesto-card-${p.id}`;
  const fecha = formatearFechaCorta(p.fecha);
  const itemsTexto = p.cantidadItems === 1 ? '1 ítem' : `${p.cantidadItems} ítems`;

  return (
    <Row testID={id}>
      <Pressable
        testID={`${id}-abrir`}
        onPress={() => onPress(p)}
        accessibilityRole="button"
        accessibilityLabel={`Ver el presupuesto N° ${p.numero} de ${p.receptor.nombre}`}
        style={pressableStyle(styles.cuerpo)}
      >
        <View style={styles.filaSuperior}>
          <Text
            testID={`${id}-encabezado`}
            numberOfLines={1}
            style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base, flexShrink: 1 }}
          >
            {/* El nombre primero: es por lo que el emprendedor busca al barrer la lista. */}
            {p.receptor.nombre !== '' ? p.receptor.nombre : `Presupuesto N° ${p.numero}`}
          </Text>
          <Text
            testID={`${id}-total`}
            style={{ color: tema.color.acento, fontFamily: tema.fuente.uiBold, fontSize: tema.tipo.base }}
          >
            {formatearImporte(p.total)}
          </Text>
        </View>

        <Text
          testID={`${id}-detalle`}
          numberOfLines={1}
          style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono, fontSize: tema.tipo.chico }}
        >
          N° {p.numero} · {p.concepto} · {itemsTexto}
          {fecha !== '' ? ` · ${fecha}` : ''}
        </Text>

        <View style={styles.filaBadges}>
          {p.facturado && (
            <Text
              testID={`${id}-badge-facturado`}
              style={[styles.badge, { color: tema.color.exito, fontFamily: tema.fuente.mono }]}
            >
              FACTURADO
            </Text>
          )}
          {/* Sólo se ve si alguien llegó acá desde el historial: el listado por default ya no trae
              los reemplazados. Sin esto, un presupuesto viejo se vería idéntico a uno vigente. */}
          {p.reemplazadoPor != null && (
            <Text
              testID={`${id}-badge-reemplazado`}
              style={[styles.badge, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}
            >
              REEMPLAZADO
            </Text>
          )}
        </View>
      </Pressable>
    </Row>
  );
}

const styles = StyleSheet.create({
  cuerpo: { flex: 1, gap: 4 },
  filaSuperior: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  filaBadges: { flexDirection: 'row', gap: 8 },
  badge: { fontSize: 9, letterSpacing: 1.2 },
});
