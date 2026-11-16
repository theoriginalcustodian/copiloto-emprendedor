import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { COLOR_PALABRA_MARCA } from '../../theme/identidadPalette';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import { ALTO_BOTON_ENTRADA } from './BotonProveedor';
import { AyudaContrasena } from './AyudaContrasena';
import { estilosEntrada } from './layoutEntrada';
import { useSession } from './useSession';

const ALTO_CAMPO = 52;
/** Mínimo de la contraseña. GoTrue acepta desde 6; pedimos 8 (lo que dice el diseño del flujo). */
export const MINIMO_CONTRASENA = 8;

type Estado = 'idle' | 'enviando' | 'ya-existe' | 'rechazada' | 'error-red';

export interface PantallaRegistroProps {
  emailInicial?: string;
  /** «Ya tengo cuenta» o «Entrá con tu contraseña»: al formulario de ingreso con el mail escrito. */
  onIrAIngreso: (email: string) => void;
  /** Volver a «Elegí cómo seguir». */
  onVolver: () => void;
}

/**
 * «Creá tu cuenta» — alta con mail y contraseña (flujo «Entrada a Odobi», Martin 12/11).
 *
 * Usa `registrar` de la sesión: `POST /auth/signup` + login inmediato. Al quedar autenticado, el
 * guard del layout muestra el onboarding como a cualquier cuenta nueva — acá no se navega a mano.
 *
 * ⚠️ Falta, del diseño: el código de 6 dígitos para verificar el mail. Hoy el backend no tiene correo
 * saliente (GoTrue sin SMTP) y confirma las cuentas solo. Cuando lo tenga, el paso del código va entre
 * el alta y el login, sin cambiar esta pantalla.
 */
export function PantallaRegistro({ emailInicial = '', onIrAIngreso, onVolver }: PantallaRegistroProps) {
  const tema = useTema();
  const { registrar } = useSession();
  const [email, setEmail] = useState(emailInicial);
  const [password, setPassword] = useState('');
  const [estado, setEstado] = useState<Estado>('idle');
  const [mensaje, setMensaje] = useState('');

  const largoOk = password.length >= MINIMO_CONTRASENA;
  const mailOk = /\S+@\S+\.\S+/.test(email.trim());
  const enviando = estado === 'enviando';
  const deshabilitado = enviando || !largoOk || !mailOk;

  async function crearCuenta() {
    if (deshabilitado) return;
    setEstado('enviando');
    const resultado = await registrar(email.trim(), password);
    if (resultado.ok) return;
    if (resultado.error === 'credenciales' && resultado.mensaje == null) {
      // El alta es idempotente: si el mail ya existía y la contraseña no coincide, el login falla acá.
      setEstado('ya-existe');
    } else if (resultado.error === 'credenciales') {
      setMensaje(resultado.mensaje ?? '');
      setEstado('rechazada');
    } else {
      setEstado('error-red');
    }
  }

  const estiloCampo = {
    color: tema.color.texto,
    borderColor: tema.color.borde,
    backgroundColor: tema.color.superficieAlta,
    borderRadius: tema.radio.sm,
    paddingHorizontal: 14,
    height: ALTO_CAMPO,
    fontSize: tema.tipo.base,
    borderWidth: 1,
  } as const;
  const etiqueta = { color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiMedium };
  const link = { color: tema.color.acentoTinta, fontSize: 15, fontFamily: tema.fuente.uiMedium };

  return (
    <KeyboardAvoidingView testID="registro-screen" style={[styles.contenedor, { backgroundColor: tema.color.fondo }]} behavior="padding">
      <ScrollView
        contentContainerStyle={[estilosEntrada.scrollFormulario, { paddingHorizontal: tema.espacio.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Martin 12/11: más chico que en la portada; nombre y formulario van juntos, centrados.
            Wordmark = logotipo (exento WCAG 1.4.3), registrado en LOGOTIPOS_TEXTO del control de contraste. */}
        <View style={estilosEntrada.zonaMarcaFormulario}>
          <Text testID="registro-wordmark" accessibilityRole="header" style={[estilosEntrada.wordmarkFormulario, { color: COLOR_PALABRA_MARCA, fontFamily: tema.fuente.display }]}>
            Odobi
          </Text>
        </View>

        <Text style={[styles.centro, { color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 22, letterSpacing: -0.3, marginBottom: 20 }]}>
          Creá tu cuenta
        </Text>

        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text style={etiqueta}>Mail</Text>
            <TextInput
              testID="registro-email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!enviando}
              value={email}
              onChangeText={setEmail}
              style={estiloCampo}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={etiqueta}>Contraseña</Text>
            <TextInput
              testID="registro-password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!enviando}
              value={password}
              onChangeText={setPassword}
              style={estiloCampo}
            />
            {/* Regla en vivo (patrón de Wise): se marca al cumplirse, no después de un error. */}
            <Text testID="registro-regla" style={{ color: largoOk ? tema.color.texto : tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              {largoOk ? '✓' : '·'} Mínimo {MINIMO_CONTRASENA} caracteres
            </Text>
          </View>

          {estado === 'ya-existe' && (
            <View style={{ gap: tema.espacio.xs }}>
              <Text testID="registro-alerta" style={[styles.centro, { color: tema.color.acentoTinta, fontSize: tema.tipo.chico }]}>
                Ese mail ya tiene una cuenta en Odobi.
              </Text>
              <Pressable testID="registro-ir-ingreso-existente" onPress={() => onIrAIngreso(email.trim())}>
                <Text style={[styles.centro, link]}>Entrá con tu contraseña</Text>
              </Pressable>
              {/* Martin 12/11: si no se acuerda la contraseña, la salida tiene que estar acá mismo. */}
              <AyudaContrasena testID="registro-ayuda-contrasena" onOtrasFormas={onVolver} />
            </View>
          )}
          {estado === 'rechazada' && (
            <Text testID="registro-alerta" style={[styles.centro, { color: tema.color.acentoTinta, fontSize: tema.tipo.chico }]}>
              {mensaje}
            </Text>
          )}
          {estado === 'error-red' && (
            <Text testID="registro-alerta" style={[styles.centro, { color: tema.color.acentoTinta, fontSize: tema.tipo.chico }]}>
              No pudimos conectarnos. Probá de nuevo en un toque.
            </Text>
          )}

          <Pressable
            testID="registro-submit"
            accessibilityRole="button"
            disabled={deshabilitado}
            onPress={crearCuenta}
            style={pressableStyle([
              styles.boton,
              { backgroundColor: tema.color.acentoSuperficie, borderRadius: tema.radio.completo, height: ALTO_BOTON_ENTRADA, opacity: deshabilitado ? 0.6 : 1 },
            ])}
          >
            {enviando ? (
              <ActivityIndicator color={tema.color.acentoTexto} />
            ) : (
              <Text style={{ color: tema.color.acentoTexto, fontSize: 17, fontFamily: tema.fuente.display, letterSpacing: -0.2 }}>Crear cuenta</Text>
            )}
          </Pressable>
        </View>

        {/* Los dos caminos de salida en una fila, como la línea legal de la portada: quietos, abajo. */}
        <View style={styles.salidas}>
          <Pressable testID="registro-ir-ingreso" onPress={() => onIrAIngreso(email.trim())} hitSlop={10}>
            <Text style={link}>Ya tengo cuenta</Text>
          </Pressable>
          <Text style={{ color: tema.color.textoTenue }}>·</Text>
          <Pressable testID="registro-volver" onPress={onVolver} hitSlop={10}>
            <Text style={{ color: tema.color.textoTenue, fontSize: 15, fontFamily: tema.fuente.uiMedium }}>Otras formas de entrar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centro: { textAlign: 'center' },
  boton: { alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  salidas: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 22 },
});
