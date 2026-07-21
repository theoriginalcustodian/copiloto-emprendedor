/**
 * `CampoTexto` — el primitivo base de formulario: etiqueta + `EnvolturaCampo` + `TextInput` + error.
 *
 * La etiqueta usa el mismo tratamiento que el `hint` del handle de `PanelDeslizable` (mono 10px,
 * mayúsculas, `letterSpacing:1.2`, `color.textoTenue`) -- es el patrón que la app ya usa para toda
 * meta-información chica sobre un control, no un estilo inventado para facturación.
 *
 * `secureTextEntry`/`autoCorrect`/`textContentType` existen acá (y no en un componente aparte) porque
 * `CampoSecreto` es literalmente "este mismo campo con esas tres props fijas" -- separar el dibujo del
 * vidrio en dos componentes hubiera sido la duplicación que `EnvolturaCampo` existe para evitar.
 */
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';

import { useTema } from '../../ThemeProvider';
import { EnvolturaCampo } from './EnvolturaCampo';
import { useRevelarCampo } from './ScrollFormulario';

export interface CampoTextoProps {
  etiqueta: string;
  valor: string;
  onChange: (texto: string) => void;
  /** Mensaje de error a mostrar. El campo se pinta de `color.peligro` con o sin texto -- alcanza con
   *  que `error` sea una string no vacía. */
  error?: string;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** Sólo lo fija `CampoSecreto` -- oculta el valor tipiado. */
  secureTextEntry?: boolean;
  autoCorrect?: boolean;
  textContentType?: TextInputProps['textContentType'];
  /** Control pegado al borde derecho, DENTRO del vidrio del campo. Hoy: el ojo de `CampoSecreto`. */
  accesorioDerecha?: ReactNode;
  testID?: string;
}

export function CampoTexto({
  etiqueta,
  valor,
  onChange,
  error,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  maxLength,
  autoCapitalize = 'sentences',
  secureTextEntry,
  autoCorrect,
  textContentType,
  accesorioDerecha,
  testID = 'campo-texto',
}: CampoTextoProps) {
  const tema = useTema();
  const hayError = error != null && error !== '';
  /**
   * El nodo que se le pide revelar al scroll: el contenedor ENTERO (etiqueta + vidrio + error), no
   * sólo el `TextInput`. Revelar únicamente el input dejaría su etiqueta tapada por el teclado, y en
   * un formulario fiscal la etiqueta es la que dice qué se está escribiendo.
   */
  const refContenedor = useRef<View>(null);
  const revelarCampo = useRevelarCampo();

  return (
    // `collapsable={false}`: sin esto Android colapsa esta `View` fuera del árbol nativo y el ref no
    // tiene nada que medir — el revelado se volvería un no-op silencioso. Ver `ScrollFormulario`.
    <View ref={refContenedor} collapsable={false} style={styles.contenedor} testID={testID}>
      <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}>
        {etiqueta}
      </Text>
      <EnvolturaCampo error={hayError} testID={`${testID}-vidrio`} style={styles.vidrio}>
        <TextInput
          testID={`${testID}-input`}
          style={[
            styles.input,
            { color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.ui },
          ]}
          value={valor}
          onChangeText={onChange}
          onFocus={() => revelarCampo(refContenedor.current)}
          placeholder={placeholder}
          placeholderTextColor={tema.color.textoTenue}
          multiline={multiline}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          autoCorrect={autoCorrect}
          textContentType={textContentType}
        />
        {accesorioDerecha}
      </EnvolturaCampo>
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
  // Fila para que el accesorio (el ojo) se apoye a la derecha DENTRO del vidrio. Sin `accesorioDerecha`
  // el input es el único hijo y ocupa todo, así que la fila no cambia nada en los campos comunes.
  vidrio: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'transparent' },
  error: { fontSize: 11, letterSpacing: 0.2 },
});
