/**
 * `CampoSecreto` — `CampoTexto` + `secureTextEntry` + el ojo para ver lo que se escribe.
 *
 * 🔴 **El valor nunca se loguea ni se guarda en ningún estado de módulo.** Este componente no tiene
 * `useState` propio *para el valor*: recibe `valor` y sólo lo reenvía por `onChange` -- el dueño del
 * dato es quien lo llama, y ese dueño es responsabilidad suya (ver `conectarArca` en el plan de
 * facturación: *"claveFiscal nunca se loguea ni se guarda en estado persistente"*). Que el componente
 * no retenga una copia propia es lo que hace esa garantía verificable: no hay un segundo lugar donde
 * el valor pueda quedar pegado. El único `useState` de acá guarda un booleano de visibilidad, que no
 * es el secreto.
 *
 * 🔴 **El ojo no es una comodidad: sin él la clave fiscal es intipeable.** El operador no pudo
 * completar el alta de ARCA (2026-07-21) — su clave son 15 caracteres con mayúsculas y símbolos, y el
 * campo la ocultaba entera. Como además el fallo del alta no llegaba a la pantalla (el workflow moría
 * y su progreso seguía diciendo "en curso"), un error de tipeo era **indistinguible de una función
 * rota**: se tipea a ciegas, no pasa nada, y no hay ninguna señal de qué salió mal. documed tiene el
 * mismo campo sin ojo y con el mismo problema anotado en su login: *"una password que empieza en
 * minúscula se envía mal y el médico no entiende por qué -- los caracteres van enmascarados"*.
 *
 * `aviso` se renderiza PEGADO al campo, no como un link aparte -- es el único momento en que el usuario
 * decide si tipear su clave, y el plan pide que el texto ("no se guarda, se usa una vez y se descarta")
 * esté ahí, no a un tap de distancia.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../ThemeProvider';
import { PRESS_FADE, pressableStyle } from '../presion';
import { CampoTexto } from './CampoTexto';
import { IconoOjo } from './IconoOjo';

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
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.contenedor} testID={testID}>
      <CampoTexto
        etiqueta={etiqueta}
        valor={valor}
        onChange={onChange}
        error={error}
        placeholder={placeholder}
        // 🔴 Sin `autoCapitalize="none"` el default (`sentences`) MAYUSCULIZA la primera letra: una
        // clave que empieza en minúscula se manda mal y, enmascarada, no hay forma de notarlo.
        // Cazado por documed en device (`login.tsx:127`), no deducido acá.
        autoCapitalize="none"
        secureTextEntry={!visible}
        autoCorrect={false}
        textContentType="password"
        accesorioDerecha={
          <Pressable
            testID={`${testID}-ojo`}
            onPress={() => setVisible((v) => !v)}
            // El ícono es chico y vive pegado al borde del campo: sin `hitSlop` el blanco real es de
            // ~22px y se falla el toque. Es el mismo criterio del "Volver" de `MarcoGlass`.
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar la clave' : 'Mostrar la clave'}
            style={pressableStyle(styles.ojo, PRESS_FADE)}
          >
            <IconoOjo
              visible={visible}
              color={tema.color.textoTenue}
              testID={`${testID}-ojo-icono`}
            />
          </Pressable>
        }
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
  // Mismo `paddingHorizontal` que el input, para que el ojo respete el aire interno del vidrio.
  ojo: { paddingHorizontal: 16, paddingVertical: 12 },
});
