import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { formatearFechaCorta, formatearImporte, type Presupuesto } from '@copiloto/core';

import { conAlfa } from '../../theme/glass/conAlfa';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import { etiquetaEstado } from './resumenEspera';

/**
 * `TarjetaPresupuesto` — una fila del listado. Rediseño (Martin 15/11): las filas van juntas en UNA tarjeta
 * blanca que pone la pantalla, separadas por un divisor; el total, a la derecha y en tinta (la terracota es de lo
 * que se toca).
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
  /** Línea arriba: todas las filas menos la primera. */
  conDivisor?: boolean;
  testID?: string;
}

export function TarjetaPresupuesto({ presupuesto: p, onPress, conDivisor = false, testID }: TarjetaPresupuestoProps) {
  const tema = useTema();
  const id = testID ?? `presupuesto-card-${p.id}`;
  const fecha = formatearFechaCorta(p.fecha);
  const estado = etiquetaEstado(p);
  const itemsTexto = p.cantidadItems === 1 ? '1 ítem' : `${p.cantidadItems} ítems`;

  const tenue = { color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 };

  return (
    <View
      testID={id}
      style={[styles.fila, conDivisor && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }]}
    >
      <Pressable
        testID={`${id}-abrir`}
        onPress={() => onPress(p)}
        accessibilityRole="button"
        accessibilityLabel={`Ver el presupuesto N° ${p.numero} de ${p.receptor.nombre}`}
        style={pressableStyle(styles.cuerpo)}
      >
        <View style={styles.textos}>
          <Text
            testID={`${id}-encabezado`}
            numberOfLines={2}
            style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, lineHeight: 21 }}
          >
            {/* El nombre primero: es por lo que el emprendedor busca al barrer la lista. */}
            {p.receptor.nombre !== '' ? p.receptor.nombre : `Presupuesto N° ${p.numero}`}
          </Text>
          {/* Qué se presupuestó en su propio renglón; el número, los ítems y la fecha, debajo. */}
          <View testID={`${id}-detalle`}>
            <Text numberOfLines={1} style={tenue}>
              {p.concepto}
            </Text>
            <Text numberOfLines={1} style={tenue}>
              N° {p.numero} · {itemsTexto}
              {fecha !== '' ? ` · ${fecha}` : ''}
            </Text>
          </View>
          {(estado != null || p.facturado || p.reemplazadoPor != null) && (
            <View style={styles.filaEstado}>
              {estado != null && (
                <Text
                  testID={`${id}-estado`}
                  style={{
                    // Martin 15/11: «Aceptado» en tinta, no en verde. El tono lo da el peso, no el color.
                    // «Se enfría» en negro y negrita (Martin 16/11): es el presupuesto que conviene mirar, y se
                    // distingue de «Esperando respuesta» sin sumar un color.
                    color: estado.tono === 'tenue' ? tema.color.textoTenue : tema.color.texto,
                    fontFamily: estado.tono === 'aviso' ? tema.fuente.uiBold : tema.fuente.uiMedium,
                    fontSize: tema.tipo.chico,
                    lineHeight: 18,
                  }}
                >
                  {estado.texto}
                </Text>
              )}
              {p.facturado && (
                <Text
                  testID={`${id}-badge-facturado`}
                  style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.chico, lineHeight: 18 }}
                >
                  Facturado
                </Text>
              )}
              {/* Sólo se ve si alguien llegó acá desde el historial: el listado por default ya no trae
                  los reemplazados. Sin esto, un presupuesto viejo se vería idéntico a uno vigente. */}
              {p.reemplazadoPor != null && (
                <Text testID={`${id}-badge-reemplazado`} style={tenue}>
                  Reemplazado
                </Text>
              )}
            </View>
          )}
        </View>
        <Text
          testID={`${id}-total`}
          style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.base, lineHeight: 21 }}
        >
          {formatearImporte(p.total)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { paddingVertical: 16 },
  cuerpo: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  textos: { flex: 1, gap: 2 },
  filaEstado: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, marginTop: 4 },
});
