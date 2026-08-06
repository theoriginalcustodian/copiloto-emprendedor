import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { pressableStyle } from '../../theme/glass/presion';
import { Marca } from '../../theme/Marca';
import { useTema } from '../../theme/ThemeProvider';
import { useSession } from './useSession';

type FormState = 'idle' | 'enviando' | 'error-credenciales' | 'no-habilitada' | 'error-red';

// Tamaños de la jerarquía del login. Son medidas de layout (no colores → no violan `temaSinHex`), y
// viven acá y no en los tokens porque son propias de ESTE hero, no del sistema compartido (evita
// inflar la escala global `tipo` con un tamaño que sólo usa una pantalla).
const HERO = 40;
const ALTO_CAMPO = 52;
const ALTO_BOTON = 54;

/**
 * `PantallaLogin` — port de `_staging/documed/apps/mobile/app/login.tsx` (misma lógica de 5 estados
 * vía `useSession().login`, mismos `testID`) sobre primitivos RN, rebrandeada al Copiloto del
 * Emprendedor (sin lenguaje clínico).
 *
 * **Botón de Google** (BETA-4b, portado tras el signup email/password): usa
 * `useSession().loginConGoogle`, que abre `expo-web-browser`/`expo-auth-session` contra el mismo
 * GoTrue dedicado que la PWA (`modules/auth/oauth.ts`). Camino independiente del de abajo -- no
 * comparte estado con el formulario de email/password salvo el `FormState` de la alerta.
 *
 * Vive en `modules/auth` (no en `app/login.tsx`) a propósito: el módulo es autocontenido y el parent
 * decide DÓNDE montarlo (la ruta de expo-router) y cómo cablear `<SessionProvider>` + el guard que,
 * tras un login exitoso, saca al usuario de esta pantalla — acá NO se navega a mano.
 */
export function PantallaLogin() {
  const tema = useTema();
  const { estado, login, loginConGoogle } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const scrollRef = useRef<ScrollView>(null);

  // El aviso de "no habilitada" puede venir de un submit propio o de detectarlo al montar (token
  // viejo + /me 403 durante 'verificando') — lo que haya pasado más recientemente gana.
  const estadoEfectivo: FormState =
    formState !== 'idle' ? formState : estado === 'no-habilitada' ? 'no-habilitada' : 'idle';

  const enviando = formState === 'enviando';
  // Campos vacíos (o sólo espacios) no disparan request: evita gastar un round-trip contra el
  // backend -- y de paso un intento de "credenciales incorrectas" confuso -- por un typo de UX, no
  // de negocio. El backend igual validaría, pero acá se corta antes de salir del dispositivo.
  const camposVacios = email.trim() === '' || password.trim() === '';
  const deshabilitado = enviando || camposVacios;

  async function manejarSubmit() {
    if (email.trim() === '' || password.trim() === '') return;
    setFormState('enviando');
    const resultado = await login(email, password);
    if (resultado.ok) return;
    if (resultado.error === 'credenciales') setFormState('error-credenciales');
    else if (resultado.error === 'no-habilitada') setFormState('no-habilitada');
    else setFormState('error-red');
  }

  // Spinner propio (no reusa `enviando`, que deshabilita los campos de email/password): los dos
  // caminos son independientes y no deben bloquearse entre sí.
  const [procesandoGoogle, setProcesandoGoogle] = useState(false);

  async function manejarGoogle() {
    setProcesandoGoogle(true);
    const resultado = await loginConGoogle();
    setProcesandoGoogle(false);
    if (resultado.ok || resultado.error === 'cancelado') return; // cancelar no es error, es silencio
    if (resultado.error === 'no-habilitada') setFormState('no-habilitada');
    else setFormState('error-red');
  }

  const estiloCampo = {
    color: tema.color.texto,
    borderColor: tema.color.borde,
    backgroundColor: tema.color.superficie,
    borderRadius: tema.radio.md,
    paddingHorizontal: tema.espacio.md,
    height: ALTO_CAMPO,
    fontSize: tema.tipo.base,
  } as const;

  // KeyboardAvoidingView + ScrollView (contenido centrado cuando no hay teclado vía `flexGrow:1` +
  // `justifyContent:'center'`, y scrolleable/desplazado hacia arriba cuando el teclado aparece).
  // `keyboardShouldPersistTaps="handled"` deja tocar "Entrar" con el teclado abierto sin que el
  // primer tap sólo lo cierre. `behavior="padding"` en AMBAS plataformas -- port 1:1 de la fuente,
  // que lo verificó contra el device real (Fase 6 de DocuMed): con `undefined`/auto en Android el
  // teclado overlayaba el contenido en vez de redimensionar la ventana.
  return (
    <KeyboardAvoidingView
      testID="login-screen"
      style={[styles.contenedor, { backgroundColor: tema.color.fondo }]}
      behavior="padding"
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { padding: tema.espacio.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.marca, { gap: tema.espacio.sm, marginBottom: tema.espacio.xl }]}>
          <Marca size={76} />
          {/* ODOBI hito 3 (DoD §2.6) — el wordmark es la marca en su forma más literal: usa
              `fuente.display` (NeueEinstellung Bold), no `fuente.uiBold` como el resto de la UI. */}
          <Text
            style={[
              styles.titulo,
              { color: tema.color.texto, fontSize: HERO, fontFamily: tema.fuente.display },
            ]}
          >
            Odobi
          </Text>
          <Text style={[styles.tagline, { color: tema.color.textoTenue, fontSize: tema.tipo.grande }]}>
            tu copiloto de negocio
          </Text>
        </View>

        <View style={{ gap: tema.espacio.md }}>
          <View style={{ gap: tema.espacio.xs }}>
            <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontSize: tema.tipo.chico }]}>Email</Text>
            <TextInput
              testID="login-email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              editable={!enviando}
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={tema.color.textoTenue}
              style={[styles.input, estiloCampo]}
            />
          </View>

          <View style={{ gap: tema.espacio.xs }}>
            <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontSize: tema.tipo.chico }]}>
              Contraseña
            </Text>
            <TextInput
              testID="login-password"
              secureTextEntry
              // Sin esto, el default `autoCapitalize="sentences"` mayusculiza la primera letra de la
              // contraseña -- una password que empieza en minúscula se envía mal y el login falla sin
              // que el usuario entienda por qué (los caracteres van enmascarados).
              autoCapitalize="none"
              autoComplete="current-password"
              editable={!enviando}
              value={password}
              onChangeText={setPassword}
              // El campo queda tapado por el teclado en Android: el ScrollView no auto-revela el
              // input enfocado por sí solo. Al enfocar, scrolleamos al fondo para dejar contraseña +
              // "Entrar" por encima del teclado. El `setTimeout(120)` espera a que el teclado termine
              // de abrir y el layout se reasiente.
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
              placeholderTextColor={tema.color.textoTenue}
              style={[styles.input, estiloCampo]}
            />
          </View>

          <Pressable
            testID="login-submit"
            disabled={deshabilitado}
            onPress={manejarSubmit}
            // Acuse por ESCALA y no por opacidad: acá el canal de la opacidad ya está tomado por el
            // estado `deshabilitado` (0.7), y superponerle el 0.85 de la presión volvería ambiguos los
            // dos estados. La escala es un canal libre. El `disabled` además apaga la pressability, así
            // que mientras envía (o con campos vacíos) no se hunde.
            style={pressableStyle([
              styles.boton,
              {
                backgroundColor: tema.color.acento,
                borderRadius: tema.radio.md,
                height: ALTO_BOTON,
                marginTop: tema.espacio.xs,
                opacity: deshabilitado ? 0.7 : 1,
              },
            ])}
          >
            {enviando ? (
              <ActivityIndicator color={tema.color.acentoTexto} />
            ) : (
              <Text style={{ color: tema.color.acentoTexto, fontSize: tema.tipo.grande, fontWeight: '700' }}>
                Entrar
              </Text>
            )}
          </Pressable>

          <View style={[styles.divisor, { gap: tema.espacio.sm }]}>
            <View style={[styles.divisorLinea, { backgroundColor: tema.color.borde }]} />
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>o</Text>
            <View style={[styles.divisorLinea, { backgroundColor: tema.color.borde }]} />
          </View>

          <Pressable
            testID="login-google"
            disabled={procesandoGoogle}
            onPress={manejarGoogle}
            style={pressableStyle([
              styles.boton,
              {
                borderWidth: 1,
                borderColor: tema.color.borde,
                backgroundColor: tema.color.superficie,
                borderRadius: tema.radio.md,
                height: ALTO_BOTON,
                opacity: procesandoGoogle ? 0.7 : 1,
              },
            ])}
          >
            {procesandoGoogle ? (
              <ActivityIndicator color={tema.color.texto} />
            ) : (
              <Text style={{ color: tema.color.texto, fontSize: tema.tipo.grande, fontWeight: '700' }}>
                Entrar con Google
              </Text>
            )}
          </Pressable>

          {estadoEfectivo === 'error-credenciales' && (
            <Text testID="login-alert" style={[styles.alerta, { color: tema.color.peligro, fontSize: tema.tipo.chico }]}>
              Email o contraseña incorrectos. Probá de nuevo.
            </Text>
          )}
          {estadoEfectivo === 'no-habilitada' && (
            <Text testID="login-alert" style={[styles.alerta, { color: tema.color.peligro, fontSize: tema.tipo.chico }]}>
              Tu cuenta todavía no está habilitada. Escribinos para activarla.
            </Text>
          )}
          {estadoEfectivo === 'error-red' && (
            <Text testID="login-alert" style={[styles.alerta, { color: tema.color.peligro, fontSize: tema.tipo.chico }]}>
              No pudimos conectarnos. Probá de nuevo en un toque.
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  // Centra el formulario cuando no hay teclado; con teclado el ScrollView deja subir el contenido.
  scroll: { flexGrow: 1, justifyContent: 'center' },
  marca: { alignItems: 'center' },
  titulo: { fontWeight: '800', letterSpacing: -0.5 },
  tagline: {},
  etiqueta: { fontWeight: '600' },
  input: { borderWidth: 1 },
  boton: { alignItems: 'center', justifyContent: 'center' },
  divisor: { flexDirection: 'row', alignItems: 'center' },
  divisorLinea: { flex: 1, height: 1 },
  alerta: { textAlign: 'center' },
});
