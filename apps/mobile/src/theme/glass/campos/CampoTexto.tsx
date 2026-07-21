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
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';

import { useTema } from '../../ThemeProvider';
import { EnvolturaCampo } from './EnvolturaCampo';

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
  testID = 'campo-texto',
}: CampoTextoProps) {
  const tema = useTema();
  const hayError = error != null && error !== '';
  return (
    <View style={styles.contenedor} testID={testID}>
      <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}>
        {etiqueta}
      </Text>
      <EnvolturaCampo error={hayError} testID={`${testID}-vidrio`}>
        <TextInput
          testID={`${testID}-input`}
          style={[
            styles.input,
            { color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.ui },
          ]}
          value={valor}
          onChangeText={onChange}
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
  input: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'transparent' },
  error: { fontSize: 11, letterSpacing: 0.2 },
});
