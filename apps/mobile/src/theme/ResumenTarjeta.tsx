import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type KeyboardTypeOptions } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { CampoTexto } from './glass/campos';
import { conAlfa } from './glass/conAlfa';
import { PRESS_FADE, pressableStyle } from './glass/presion';
import { useTema } from './ThemeProvider';

/**
 * Las piezas del RESUMEN de una card del chat (Martin 14/11).
 *
 * Una card «esto entendí» ya no muestra su formulario abierto: muestra lo que entendió como resumen —el dato
 * principal, una fila por dato que tiene valor con «Cambiar» a la derecha, y los opcionales vacíos detrás de
 * un «Agregar…»—. Todo sigue siendo editable antes de guardar: tocar una fila abre su campo AHÍ MISMO.
 *
 * 🔴 Esto es PRESENTACIÓN. El estado, la validación y el guardado siguen viviendo en cada `Formulario*`, que
 * es quien arma su resumen con estas piezas (`resumido`): no hay un segundo formulario que pueda divergir.
 *
 * La card se lee en franjas separadas por una línea: encabezado | dato principal | datos | agregar | acciones.
 */

/**
 * La línea que separa las franjas. `tema.color.borde` es casi blanco en la piel clara: sobre la card blanca no
 * separaba nada («faltan divisores, se ve todo junto»). Sale de la tinta, al 12 %.
 */
export function useLineaResumen(): string {
  const tema = useTema();
  return conAlfa(tema.color.texto, 0.12);
}

/** Qué campos del resumen están abiertos. */
export function useCamposAbiertos<T extends string>(iniciales: readonly T[] = []) {
  const [abiertos, setAbiertos] = useState<ReadonlySet<T>>(() => new Set(iniciales));
  const abrir = (...campos: T[]) => setAbiertos((a) => new Set([...a, ...campos]));
  const cerrar = (campo: T) =>
    setAbiertos((a) => {
      const n = new Set(a);
      n.delete(campo);
      return n;
    });
  return { abiertos, abrir, cerrar };
}

/** «proveedor», «proveedor o detalle», «proveedor, medio de pago o detalle». */
export function enumerar(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} o ${partes[partes.length - 1]}`;
}

/** El contenedor del resumen: abre con la línea que lo separa del encabezado de la card. */
export function ResumenTarjeta({ children, testID }: { children: ReactNode; testID?: string }) {
  const linea = useLineaResumen();
  return (
    <View style={[estilos.resumen, { borderColor: linea }]} testID={testID}>
      {children}
    </View>
  );
}

/** La franja del dato principal (la cifra, o su campo abierto, y lo que cuelgue de ella). */
export function FranjaPrincipal({ children }: { children: ReactNode }) {
  return <View style={estilos.franjaPrincipal}>{children}</View>;
}

/** La franja de los datos: abre con línea y separa sus filas entre sí. */
export function FranjaDatos({ children }: { children: ReactNode }) {
  const linea = useLineaResumen();
  return <View style={[estilos.franjaDatos, { borderColor: linea }]}>{children}</View>;
}

/** El dato principal cerrado: grande, con «Cambiar». */
export function CifraResumen({
  texto,
  nombre,
  onCambiar,
  testID,
  testIDTexto,
}: {
  texto: string;
  /** Para el lector de pantalla: «Monto». */
  nombre: string;
  /** Ausente = el dato no se cambia tocándolo (un total que se calcula): se muestra sin «Cambiar». */
  onCambiar?: () => void;
  testID: string;
  testIDTexto: string;
}) {
  const tema = useTema();
  if (onCambiar == null) {
    return (
      <View testID={testID} style={estilos.cifra} accessible accessibilityLabel={`${nombre}: ${texto}`}>
        <Text
          testID={testIDTexto}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.titulo, flexShrink: 1 }}
        >
          {texto}
        </Text>
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}: ${texto}. Cambiar`}
      onPress={onCambiar}
      style={pressableStyle(estilos.cifra, PRESS_FADE)}
    >
      <Text
        testID={testIDTexto}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.titulo, flexShrink: 1 }}
      >
        {texto}
      </Text>
      <Text style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiMedium }}>
        Cambiar
      </Text>
    </Pressable>
  );
}

/** Una fila del resumen: rótulo, valor y «Cambiar». Etiqueta de control en infinitivo (`CLAUDE.md` §9). */
export function FilaResumen({
  rotulo,
  valor,
  onCambiar,
  testID,
  separada = false,
  children,
}: {
  rotulo: string;
  valor: string;
  /** Ausente = fila de sólo lectura, sin «Cambiar» (lo que se edita por otro camino). */
  onCambiar?: () => void;
  testID: string;
  /** Con línea arriba: toda fila que no sea la primera de su franja. */
  separada?: boolean;
  /** Renglones chicos debajo del valor («2 × $1.500», «Responsable inscripto»). */
  children?: ReactNode;
}) {
  const tema = useTema();
  const linea = useLineaResumen();
  const contenido = (
    <>
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, width: 84 }}>{rotulo}</Text>
      <View style={estilos.valorFila}>
        <Text numberOfLines={2} style={{ color: tema.color.texto, fontSize: 15 }}>
          {valor}
        </Text>
        {children}
      </View>
      {onCambiar != null && (
        <Text style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiMedium }}>
          Cambiar
        </Text>
      )}
    </>
  );
  const estilo = [estilos.fila, separada && estilos.separada, { borderColor: linea }];
  if (onCambiar == null) {
    return (
      <View testID={testID} style={estilo}>
        {contenido}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${rotulo}: ${valor}. Cambiar`}
      onPress={onCambiar}
      style={pressableStyle(estilo, PRESS_FADE)}
    >
      {contenido}
    </Pressable>
  );
}

/** Un renglón chico de una fila: el detalle que acompaña al valor. */
export function DetalleFila({ children, testID, acento = false }: { children: ReactNode; testID?: string; acento?: boolean }) {
  const tema = useTema();
  return (
    <Text
      testID={testID}
      style={{
        color: acento ? tema.color.acentoTinta : tema.color.textoTenue,
        fontSize: tema.tipo.chico,
        fontFamily: acento ? tema.fuente.uiMedium : tema.fuente.ui,
      }}
    >
      {children}
    </Text>
  );
}

/** Un enlace suelto dentro del resumen («Agregar ítem»), con su línea arriba. */
export function EnlaceResumen({ texto, onPress, testID }: { texto: string; onPress: () => void; testID: string }) {
  const tema = useTema();
  const linea = useLineaResumen();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={pressableStyle([estilos.agregar, { borderColor: linea }], PRESS_FADE)}
    >
      <Text style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiMedium }}>
        {texto}
      </Text>
    </Pressable>
  );
}

/** Un campo abierto dentro de la franja de datos (cualquier control: un select, un par de campos…). */
export function CampoAbierto({ children, separado = false }: { children: ReactNode; separado?: boolean }) {
  const linea = useLineaResumen();
  return <View style={[estilos.campoAbierto, separado && estilos.separada, { borderColor: linea }]}>{children}</View>;
}

/**
 * Un dato de TEXTO del resumen. Con valor y cerrado es una fila; abierto es su campo, que al perder el foco
 * vuelve a fila. Vacío y cerrado no dibuja nada: ése vive detrás del «Agregar…».
 */
export function DatoTexto({
  abierto,
  rotulo,
  etiqueta,
  valor,
  onChange,
  onAbrir,
  onCerrar,
  testID,
  separado = false,
  placeholder,
  maxLength,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  multiline,
}: {
  abierto: boolean;
  /** El rótulo corto de la fila («Pago»). */
  rotulo: string;
  /** La etiqueta del campo abierto («Cómo lo pagaste»). */
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  onAbrir: () => void;
  onCerrar: () => void;
  /** El del CAMPO; la fila cerrada es `${testID}-cambiar`. */
  testID: string;
  separado?: boolean;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  multiline?: boolean;
}) {
  if (abierto) {
    return (
      <CampoAbierto separado={separado}>
        <CampoTexto
          etiqueta={etiqueta}
          valor={valor}
          onChange={onChange}
          onBlur={onCerrar}
          placeholder={placeholder}
          maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          multiline={multiline}
          testID={testID}
        />
      </CampoAbierto>
    );
  }
  if (valor.trim() === '') return null;
  return <FilaResumen testID={`${testID}-cambiar`} rotulo={rotulo} valor={valor} onCambiar={onAbrir} separada={separado} />;
}

/** «Agregar proveedor o medio de pago»: abre los opcionales que hoy están vacíos y escondidos. */
export function EnlaceAgregar({
  nombres,
  onPress,
  testID,
}: {
  /** Los datos escondidos, en minúscula. Con más de tres dice «más datos»: la lista entera no entra en un renglón. */
  nombres: readonly string[];
  onPress: () => void;
  testID: string;
}) {
  const tema = useTema();
  const linea = useLineaResumen();
  if (nombres.length === 0) return null;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={pressableStyle([estilos.agregar, { borderColor: linea }], PRESS_FADE)}
    >
      <Text style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiMedium }}>
        Agregar {nombres.length > 3 ? 'más datos' : enumerar(nombres)}
      </Text>
    </Pressable>
  );
}

/**
 * El botón LLENO de una card: la acción que guarda o emite. Tamaño de botón de tarjeta (`CLAUDE.md` §7): 15 px
 * sobre `acentoSuperficie` (el acento profundo, 5,43:1 con blanco), no el 19 display, que acá pesaba más que
 * el dato.
 */
export function BotonLleno({
  etiqueta,
  onPress,
  deshabilitado = false,
  testID,
}: {
  etiqueta: string;
  onPress: () => void;
  deshabilitado?: boolean;
  testID: string;
}) {
  const tema = useTema();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={() => {
        if (!deshabilitado) onPress();
      }}
      style={pressableStyle([
        estilos.guardar,
        { backgroundColor: tema.color.acentoSuperficie, opacity: deshabilitado ? 0.5 : 1 },
      ])}
    >
      <Text numberOfLines={1} style={{ color: tema.color.acentoTexto, fontFamily: tema.fuente.uiMedium, fontSize: 15 }}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

/** La acción secundaria de una card, como texto: «Cancelar», «Editar». */
export function BotonTexto({
  etiqueta,
  onPress,
  deshabilitado = false,
  testID,
}: {
  etiqueta: string;
  onPress: () => void;
  deshabilitado?: boolean;
  testID: string;
}) {
  const tema = useTema();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={() => {
        if (!deshabilitado) onPress();
      }}
      style={pressableStyle([estilos.cancelar, { opacity: deshabilitado ? 0.5 : 1 }], PRESS_FADE)}
    >
      <Text style={{ color: tema.color.textoTenue, fontSize: 15, fontFamily: tema.fuente.uiMedium }}>{etiqueta}</Text>
    </Pressable>
  );
}

/** La franja de acciones: a la izquierda, alineadas con los datos, y con su línea arriba. */
export function FranjaAcciones({ children, testID }: { children: ReactNode; testID: string }) {
  const linea = useLineaResumen();
  return (
    <View style={[estilos.acciones, { borderColor: linea }]} testID={testID}>
      {children}
    </View>
  );
}

/**
 * Las acciones del resumen: «Guardar» LLENO y «Cancelar» como texto. Antes eran dos píldoras del mismo tamaño
 * y la de guardar, gris con borde, parecía apagada.
 */
export function AccionesResumen({
  etiquetaGuardar,
  onGuardar,
  deshabilitado = false,
  onCancelar,
  etiquetaCancelar = 'Cancelar',
  testID,
  testIDGuardar,
  testIDCancelar,
}: {
  etiquetaGuardar: string;
  onGuardar: () => void;
  deshabilitado?: boolean;
  onCancelar: () => void;
  etiquetaCancelar?: string;
  testID: string;
  testIDGuardar: string;
  testIDCancelar: string;
}) {
  return (
    <FranjaAcciones testID={testID}>
      <BotonLleno testID={testIDGuardar} etiqueta={etiquetaGuardar} deshabilitado={deshabilitado} onPress={onGuardar} />
      <BotonTexto testID={testIDCancelar} etiqueta={etiquetaCancelar} onPress={onCancelar} />
    </FranjaAcciones>
  );
}

const estilos = StyleSheet.create({
  resumen: { borderTopWidth: 1, marginTop: 4 },
  franjaPrincipal: { paddingVertical: 14, gap: 8 },
  cifra: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  franjaDatos: { borderTopWidth: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 12 },
  valorFila: { flex: 1, gap: 2 },
  separada: { borderTopWidth: 1 },
  campoAbierto: { paddingVertical: 14, gap: 10 },
  agregar: { borderTopWidth: 1, minHeight: 46, justifyContent: 'center', alignItems: 'flex-start' },
  // `flexWrap`: «Anotar que me pagaron» + «Cancelar» no entran en un renglón en un teléfono angosto.
  acciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  cancelar: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  guardar: { minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
});
