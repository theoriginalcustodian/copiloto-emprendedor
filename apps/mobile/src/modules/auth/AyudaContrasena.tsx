import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

export interface AyudaContrasenaProps {
  /** Lleva a la portada, donde está «Continuar con Google». */
  onOtrasFormas: () => void;
  testID?: string;
}

/**
 * «¿Olvidaste tu contraseña?» (Martin 12/11). Hoy el backend NO puede restablecerla: GoTrue corre sin
 * correo saliente (`MAILER_AUTOCONFIRM`), así que no hay mail ni código que mandar. Mientras tanto, el
 * link no promete un reseteo que no existe: explica eso y ofrece la salida real más común — muchas
 * cuentas son de Google y no tienen contraseña. Cuando exista el reseteo (pedido a David, punto 3), este
 * bloque se reemplaza por el paso «código + contraseña nueva» del flujo.
 */
export function AyudaContrasena({ onOtrasFormas, testID = 'ayuda-contrasena' }: AyudaContrasenaProps) {
  const tema = useTema();
  const [abierta, setAbierta] = useState(false);
  const link = { color: tema.color.acentoTinta, fontSize: 15, fontFamily: tema.fuente.uiMedium };

  if (!abierta) {
    return (
      <Pressable testID={`${testID}-abrir`} onPress={() => setAbierta(true)} hitSlop={8} style={pressableStyle([styles.abrir])}>
        <Text style={[styles.centro, link]}>¿Olvidaste tu contraseña?</Text>
      </Pressable>
    );
  }
  return (
    <View
      testID={testID}
      style={[styles.caja, { backgroundColor: tema.color.superficieAlta, borderColor: tema.color.borde, borderRadius: tema.radio.sm }]}
    >
      <Text style={{ color: tema.color.texto, fontSize: 15, lineHeight: 21 }}>
        Todavía no podemos mandarte un mail para cambiarla. Si tu cuenta es de Google, entrá con Google: no necesita contraseña.
      </Text>
      <Pressable testID={`${testID}-google`} onPress={onOtrasFormas} hitSlop={8} style={pressableStyle([])}>
        <Text style={link}>Entrar con Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { textAlign: 'center' },
  abrir: { paddingVertical: 4 },
  caja: { borderWidth: 1, padding: 14, gap: 10 },
});
