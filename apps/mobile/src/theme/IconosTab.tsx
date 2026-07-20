import { View, type ColorValue } from 'react-native';

/**
 * Iconos del tab bar dibujados con `View`s — **cero dependencias, cero assets nativos**.
 *
 * Por qué no `@expo/vector-icons` ni `react-native-svg`: ninguno está instalado (npm, no pnpm), y
 * sumarlos obliga a `npm install` + —en el caso de svg— rebuild del dev client, que no se puede
 * verificar sin el teléfono a mano. El glifo ⌧ que se veía antes era el *placeholder de icono
 * faltante* de react-navigation cuando `tabBarIcon` no se define; estas formas geométricas simples lo
 * reemplazan y renderizan idénticas en todo Android (no dependen de una fuente de glifos que pueda
 * faltar → nunca vuelven a caer en "tofu").
 *
 * Cada icono recibe `color` y `size` tal como los entrega `Tabs.screenOptions.tabBarIcon`
 * (`{ focused, color, size }`): el color YA es el `activeTintColor`/`inactiveTintColor` resuelto por
 * el tema, así que estos componentes no leen tokens directamente — pintan con lo que reciben.
 */
interface PropsIcono {
  /** `ColorValue`, no `string`: es exactamente lo que entrega `tabBarIcon({ color })` (el tint ya
   *  resuelto por el tema, que puede ser un `OpaqueColorValue`), y los `View` lo aceptan tal cual. */
  color: ColorValue;
  size: number;
}

/** Chat — burbuja de mensaje (rect redondeado en contorno) con dos puntos de conversación. */
export function IconoChat({ color, size }: PropsIcono) {
  const w = size;
  const h = size * 0.82;
  const punto = Math.max(2, Math.round(size * 0.09));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 2,
          borderColor: color,
          borderRadius: Math.round(size * 0.28),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Math.round(size * 0.13),
        }}
      >
        <View style={{ width: punto, height: punto, borderRadius: punto, backgroundColor: color }} />
        <View style={{ width: punto, height: punto, borderRadius: punto, backgroundColor: color }} />
      </View>
    </View>
  );
}

/** Apps — grilla 2×2 de cuadrados redondeados llenos. */
export function IconoApps({ color, size }: PropsIcono) {
  const celda = Math.round(size * 0.38);
  const gap = size - celda * 2;
  const radio = Math.max(2, Math.round(celda * 0.28));
  const cuadro = { width: celda, height: celda, borderRadius: radio, backgroundColor: color };
  return (
    <View style={{ width: size, height: size, flexWrap: 'wrap', flexDirection: 'row', gap }}>
      <View style={cuadro} />
      <View style={cuadro} />
      <View style={cuadro} />
      <View style={cuadro} />
    </View>
  );
}

/** Ajustes — dos "sliders": líneas horizontales con una perilla a distinta posición. */
export function IconoAjustes({ color, size }: PropsIcono) {
  const linea = 2;
  const knob = Math.max(4, Math.round(size * 0.24));
  const fila = (alinear: 'flex-start' | 'flex-end') => (
    <View style={{ width: size, height: knob, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, height: linea, backgroundColor: color, borderRadius: linea }} />
      <View
        style={{
          width: knob,
          height: knob,
          borderRadius: knob,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: 'transparent',
          alignSelf: alinear,
        }}
      />
    </View>
  );
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', gap: Math.round(size * 0.18) }}>
      {fila('flex-end')}
      {fila('flex-start')}
    </View>
  );
}
