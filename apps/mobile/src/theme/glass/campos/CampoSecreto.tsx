/**
 * `CampoSecreto` — `CampoTexto` + `secureTextEntry`, para la clave fiscal de ARCA.
 *
 * 🔴 **El valor nunca se loguea ni se guarda en ningún estado de módulo.** Este componente no tiene
 * `useState` propio: recibe `valor` y sólo lo reenvía por `onChange` -- el dueño del dato es quien lo
 * llama, y ese dueño es responsabilidad suya (ver `conectarArca` en el plan de facturación: *"claveFiscal
 * nunca se loguea ni se guarda en estado persistente"*). Que el componente no retenga una copia propia
 * es lo que hace esa garantía verificable: no hay un segundo lugar donde el valor pueda quedar pegado.
 *
 * `aviso` se renderiza PEGADO al campo, no como un link aparte -- es el único momento en que el usuario
 * decide si tipear su clave, y el plan pide que el texto ("no se guarda, se usa una vez y se descarta")
 * esté ahí, no a un tap de distancia.
 */
import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../ThemeProvider';
import { CampoTexto } from './CampoTexto';

export interface CampoSecretoProps {
  etiqueta: string;
  valor: string;
  onChange: (texto: string) => void;
  error?: string;
  placeholder?: string;
  /** Advertencia bajo el campo -- p.ej. "tu clave fiscal no se guarda". */
  aviso?: string;
  testID?: string;
}

export function CampoSecreto({
  etiqueta,
  valor,
  onChange,
  error,
  placeholder,
  aviso,
  testID = 'campo-secreto',
}: CampoSecretoProps) {
  const tema = useTema();
  return (
    <View style={styles.contenedor} testID={testID}>
      <CampoTexto
        etiqueta={etiqueta}
        valor={valor}
        onChange={onChange}
        error={error}
        placeholder={placeholder}
        autoCapitalize="none"
        secureTextEntry
        autoCorrect={false}
        textContentType="password"
        testID={`${testID}-campo`}
      />
      {aviso != null && aviso !== '' && (
        <Text
          testID={`${testID}-aviso`}
          style={[styles.aviso, { color: tema.color.textoTenue, fontFamily: tema.fuente.ui }]}
        >
          {aviso}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 6 },
  aviso: { fontSize: 12, lineHeight: 16 },
});
