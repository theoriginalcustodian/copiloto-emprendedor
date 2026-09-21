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

import { TEXTO_CREDENCIALES_INCORRECTAS, TEXTO_PIE_INGRESAR } from '@copiloto/core';

import { pressableStyle } from '../../theme/glass/presion';
import { Marca } from '../../theme/Marca';
import { useTema } from '../../theme/ThemeProvider';
import { useSession } from './useSession';

type FormState = 'idle' | 'enviando' | 'error-credenciales' | 'no-habilitada' | 'error-red';

// Tamaños de la jerarquía del login. Son medidas de layout (no colores → no violan `temaSinHex`), y
// viven acá y no en los tokens porque son propias de ESTE hero, no del sistema compartido (evita
// inflar la escala global `tipo` con un tamaño que sólo usa una pantalla).
const HERO = 34;
/** El símbolo del lockup. El wordmark va al lado, no debajo — ver el bloque de marca del render. */
const LOCKUP_SIMBOLO = 44;
const ALTO_CAMPO = 52;
const ALTO_BOTON = 54;

/**
 * `PantallaLogin` — port de `_staging/documed/apps/mobile/app/login.tsx` (misma lógica de 5 estados
 * vía `useSession().login`, mismos `testID`) sobre primitivos RN, rebrandeada al Copiloto del
 * Emprendedor (sin lenguaje clínico).
 *
 * **Botón de Google** (BETA-4b, portado tras el signup email/password): usa
 * `useSession().loginConGoogle`, que abre el selector NATIVO de cuenta de Android (Credential
 * Manager vía `@react-native-google-signin/google-signin`, sin browser) y después intercambia el
 * `idToken` por un token propio en el backend (`modules/auth/oauth.ts`). Camino independiente del
 * de abajo -- no comparte estado con el formulario de email/password salvo el `FormState` de la
 * alerta.
 *
 * Vive en `modules/auth` (no en `app/login.tsx`) a propósito: el módulo es autocontenido y el parent
 * decide DÓNDE montarlo (la ruta de expo-router) y cómo cablear `<SessionProvider>` + el guard que,
 * tras un login exitoso, saca al usuario de esta pantalla — acá NO se navega a mano.
 */
export function PantallaLogin({ emailInicial = '' }: { emailInicial?: string } = {}) {
  const tema = useTema();
  const { estado, avisoSesion, login, loginConGoogle } = useSession();
  const [email, setEmail] = useState(emailInicial);
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
        {/**
          * 🔴 **El LOCKUP —símbolo y nombre en una línea—, no el badge apilado con tagline**
          * (2026-09-18, contra el prototipo). Esta pantalla venía portada de documed: badge grande,
          * «Odobi» debajo y «tu copiloto de negocio» abajo de todo. Tres bloques de marca antes del
          * primer campo, en la pantalla donde lo único que hay que hacer es entrar.
          *
          * El nombre SÍ va —acá es información: quien mira esto está por entrar a una cuenta y tiene
          * que ver a cuál—, pero presentado una vez y en horizontal. La tagline se cae: el producto
          * ya se explicó antes de llegar acá, y repetirlo empuja los campos fuera del alcance del
          * pulgar.
          *
          * La separación símbolo↔wordmark es **0,3 × el ancho del símbolo** (spec del isotipo), no
          * un número elegido a ojo.
          */}
        <View style={[styles.marca, { gap: Math.round(LOCKUP_SIMBOLO * 0.3), marginBottom: tema.espacio.xl }]}>
          <Marca size={LOCKUP_SIMBOLO} />
          {/* El wordmark es la marca en su forma más literal: usa `fuente.display` (Plus Jakarta
              Sans Bold), no `fuente.uiBold` como el resto de la UI. */}
          <Text
            testID="login-wordmark"
            style={[
              styles.titulo,
              { color: tema.color.acentoTinta, fontSize: HERO, fontFamily: tema.fuente.display },
            ]}
          >
            Odobi
          </Text>
        </View>

        <Text
          testID="login-titulo"
          style={[styles.encabezado, { color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.titulo }]}
        >
          Entrá a tu cuenta
        </Text>
        <Text style={[styles.bajada, { color: tema.color.textoTenue, fontSize: tema.tipo.base }]}>
          Con el mail y la contraseña que ya usás.
        </Text>

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
              // Error de credenciales: el borde del campo de contraseña pasa a terracota (`.ig-campo.err`).
              style={[styles.input, estiloCampo, estadoEfectivo === 'error-credenciales' && { borderColor: tema.color.acento }]}
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
                backgroundColor: tema.color.acentoSuperficie,
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
                // Sin borde (`.btn2` del prototipo, BL-X12m): la jerarquía la da el relleno, no un marco.
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

          {/* CTA5 — la sesión se cayó sola. Sólo mientras el formulario no tenga nada propio que
              decir: en cuanto el usuario reintenta, lo que importa es el resultado de ESE intento.
              `textoTenue` y no `peligro`: expirar es lo normal, no una falla del emprendedor. */}
          {avisoSesion !== undefined && estadoEfectivo === 'idle' && (
            <Text
              testID="login-aviso-sesion"
              style={[styles.alerta, { color: tema.color.textoTenue, fontSize: tema.tipo.chico }]}
            >
              {avisoSesion}
            </Text>
          )}
          {estadoEfectivo === 'error-credenciales' && (
            <Text testID="login-alert" style={[styles.alerta, { color: tema.color.peligro, fontSize: tema.tipo.chico }]}>
              {TEXTO_CREDENCIALES_INCORRECTAS}
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
          <Text testID="login-pie" style={[styles.alerta, { color: tema.color.textoTenue, fontSize: tema.tipo.chico }]}>
            {TEXTO_PIE_INGRESAR}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  // Centra el formulario cuando no hay teclado; con teclado el ScrollView deja subir el contenido.
  scroll: { flexGrow: 1, justifyContent: 'center' },
  // El lockup es una LÍNEA: símbolo y nombre al lado, centrados en el ancho.
  marca: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  encabezado: { textAlign: 'center' },
  bajada: { textAlign: 'center', marginBottom: 20 },
  titulo: { fontWeight: '800', letterSpacing: -0.5 },
  tagline: {},
  etiqueta: { fontWeight: '600' },
  input: { borderWidth: 1 },
  boton: { alignItems: 'center', justifyContent: 'center' },
  divisor: { flexDirection: 'row', alignItems: 'center' },
  divisorLinea: { flex: 1, height: 1 },
  alerta: { textAlign: 'center' },
});
