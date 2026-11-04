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

import { COLOR_PALABRA_MARCA } from '../../theme/identidadPalette';
import { pressableStyle } from '../../theme/glass/presion';
import { Marca } from '../../theme/Marca';
import { useTema } from '../../theme/ThemeProvider';
import { useSession } from './useSession';

type FormState = 'idle' | 'enviando' | 'error-credenciales' | 'no-habilitada' | 'error-red';

// Tamaños de la jerarquía del login. Son medidas de layout (no colores → no violan `temaSinHex`), y
// viven acá y no en los tokens porque son propias de ESTE hero, no del sistema compartido (evita
// inflar la escala global `tipo` con un tamaño que sólo usa una pantalla).
/** El wordmark «Odobi» del lockup: `.ig-marca .w{font-size:32px}` (`prototipo/index.html:517`). SM-Z4 parte 1 (era 34). */
const HERO = 32;
/** El símbolo del lockup. El wordmark va al lado, no debajo — ver el bloque de marca del render. */
const LOCKUP_SIMBOLO = 38;
const ALTO_CAMPO = 52;
// SM-L4 entrada 03: el campo del mapa es radio 14 (--r-s) y padding 14 (.ig-campo, index.html:526-527), con borde
// terracota profunda + halo de 3px al 16% en foco (.ig-campo.foco, :529). Antes: radio 22 y padding 16, sin foco.
const PADDING_CAMPO = 14;
const HALO = 3;
const COLOR_HALO = 'rgba(222,114,80,.16)';
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

  const [campoEnfocado, setCampoEnfocado] = useState<'email' | 'password' | null>(null);
  // El halo es un anillo propio (RN no tiene box-shadow con spread en Android): un View de 3px alrededor del campo,
  // con margen negativo para no mover el layout.
  const halo = (campo: 'email' | 'password') =>
    ({
      borderRadius: tema.radio.sm + HALO,
      padding: HALO,
      margin: -HALO,
      backgroundColor: campoEnfocado === campo ? COLOR_HALO : 'transparent',
    }) as const;

  const estiloCampo = {
    color: tema.color.texto,
    borderColor: tema.color.borde,
    backgroundColor: tema.color.superficieAlta,
    borderRadius: tema.radio.sm,
    paddingHorizontal: PADDING_CAMPO,
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
          {/* SM-N30: `desnudo` = el símbolo SIN badge, terracota, como el mapa (`prototipo/index.html:2571`,
              `<svg width="38">` con `stroke: var(--terracota)`). Era `tinta`, que es el avatar redondo de
              Soporte: el login importó el círculo sin su motivo. En `desnudo` el `size` es el del SIGNO
              (38, como el mapa), no el de un tile; el `gap` de abajo sigue siendo 0,3 × ese ancho. */}
          <Marca size={LOCKUP_SIMBOLO} tono="desnudo" />
          {/* El wordmark es la marca en su forma más literal: usa `fuente.display` (Plus Jakarta
              Sans Bold), no `fuente.uiBold` como el resto de la UI. */}
          {/* SM-Z4 parte 2 (DECIDIDO por el operador, 2026-11-03): el wordmark es el LOGOTIPO y va en la terracota de marca del mapa
              (--terracota #DE7250, index.html:517), igual que el reveal (COLOR_PALABRA_MARCA, identidadPalette.ts). Es exención
              WCAG 1.4.3 (logotipo), NO texto de UI: el control de contraste lo reconoce sólo por color de marca + este testID
              (LOGOTIPOS_TEXTO, paresPintadosContraste.test.tsx). No copiar este color a otro <Text>. */}
          <Text
            testID="login-wordmark"
            style={[
              styles.titulo,
              { color: COLOR_PALABRA_MARCA, fontSize: HERO, fontFamily: tema.fuente.display },
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
            <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontSize: tema.tipo.chico }]}>Mail</Text>
            <View style={halo('email')}>
            <TextInput
              testID="login-email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              editable={!enviando}
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={tema.color.textoTenue}
              onFocus={() => setCampoEnfocado('email')}
              onBlur={() => setCampoEnfocado(null)}
              style={[styles.input, estiloCampo, campoEnfocado === 'email' && { borderColor: tema.color.acentoTinta }]}
            />
            </View>
          </View>

          <View style={{ gap: tema.espacio.xs }}>
            <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontSize: tema.tipo.chico }]}>
              Contraseña
            </Text>
            <View style={halo('password')}>
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
              onFocus={() => {
                setCampoEnfocado('password');
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
              }}
              onBlur={() => setCampoEnfocado(null)}
              placeholderTextColor={tema.color.textoTenue}
              // Error de credenciales: el borde del campo de contraseña pasa a terracota PROFUNDA
              // (`.ig-campo.err` → `--terracota-prof`, index.html:542) = `acentoTinta` (#B04A2E en claro).
              style={[styles.input, estiloCampo, (campoEnfocado === 'password' || estadoEfectivo === 'error-credenciales') && { borderColor: tema.color.acentoTinta }]}
            />
            </View>
          </View>

          {/* `ingresar-error` (BL mapeo 2026-10-13): el error va ENTRE los campos y los botones, como
              `.ig-error` (index.html:2590, antes de `.ig-act` :2592) — quien falló mira el campo, no el
              pie. Color = `--terracota-prof` (:539) = `acentoTinta`, no el rojo `peligro`: equivocarse
              de contraseña no es un peligro, y el prototipo lo dice con la terracota de la marca. */}
          {estadoEfectivo === 'error-credenciales' && (
            <Text testID="login-alert" style={[styles.alerta, styles.alertaError, { color: tema.color.acentoTinta, fontSize: tema.tipo.chico }]}>
              {TEXTO_CREDENCIALES_INCORRECTAS}
            </Text>
          )}
          {estadoEfectivo === 'no-habilitada' && (
            <Text testID="login-alert" style={[styles.alerta, styles.alertaError, { color: tema.color.acentoTinta, fontSize: tema.tipo.chico }]}>
              Tu cuenta todavía no está habilitada. Escribinos para activarla.
            </Text>
          )}
          {estadoEfectivo === 'error-red' && (
            <Text testID="login-alert" style={[styles.alerta, styles.alertaError, { color: tema.color.acentoTinta, fontSize: tema.tipo.chico }]}>
              No pudimos conectarnos. Probá de nuevo en un toque.
            </Text>
          )}

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
                borderRadius: tema.radio.completo,
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

          <Pressable
            testID="login-google"
            disabled={procesandoGoogle}
            onPress={manejarGoogle}
            style={pressableStyle([
              styles.boton,
              {
                // Sin borde (`.btn2` del prototipo, BL-X12m): la jerarquía la da el relleno, no un marco.
                backgroundColor: tema.color.superficie,
                borderRadius: tema.radio.completo,
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
              `textoTenue` y no `peligro`: expirar es lo normal, no una falla del emprendedor.

              ENMIENDA FUNDADA (mapeo `ingresar`, 2026-10-13): el prototipo pinta `.ig-aviso` siempre
              (index.html:2597) porque es una HOJA DE ESTADOS que muestra todos a la vez; en la app real
              decir «tu sesión se cerró» a quien abre la app por primera vez es una afirmación falsa.
              Por eso se pinta sólo si hubo cierre por seguridad (`avisoSesion`) y el form está en reposo. */}
          {avisoSesion !== undefined && estadoEfectivo === 'idle' && (
            <Text
              testID="login-aviso-sesion"
              style={[styles.alerta, { color: tema.color.textoTenue, fontSize: tema.tipo.chico }]}
            >
              {avisoSesion}
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
  alerta: { textAlign: 'center' },
  // `.ig-error{font-weight:500}` (index.html:539-540).
  alertaError: { fontWeight: '500' },
});
