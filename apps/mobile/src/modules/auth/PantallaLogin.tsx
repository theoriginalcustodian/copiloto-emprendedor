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

import { TEXTO_CREDENCIALES_INCORRECTAS } from '@copiloto/core';

import { COLOR_PALABRA_MARCA } from '../../theme/identidadPalette';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import { AyudaContrasena } from './AyudaContrasena';
import { estilosEntrada } from './layoutEntrada';
import { useSession } from './useSession';

type FormState = 'idle' | 'enviando' | 'error-credenciales' | 'no-habilitada' | 'error-red';

// Tamaños de la jerarquía del login. Son medidas de layout (no colores → no violan `temaSinHex`), y
// viven acá y no en los tokens porque son propias de ESTE hero, no del sistema compartido (evita
// inflar la escala global `tipo` con un tamaño que sólo usa una pantalla).
/** El wordmark «Odobi» del lockup: `.ig-marca .w{font-size:32px}` (`prototipo/index.html:517`). SM-Z4 parte 1 (era 34). */
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
 * **Sin botón de Google desde el 12/11** (flujo «Entrada a Odobi», Martin): Apple, Google y mail se
 * eligen antes, en `PantallaMetodo`. Esta pantalla es el camino del MAIL: entrar con contraseña o,
 * con `onCrearCuenta`, ir a crear la cuenta.
 *
 * Vive en `modules/auth` (no en `app/login.tsx`) a propósito: el módulo es autocontenido y el parent
 * decide DÓNDE montarlo (la ruta de expo-router) y cómo cablear `<SessionProvider>` + el guard que,
 * tras un login exitoso, saca al usuario de esta pantalla — acá NO se navega a mano.
 */
export interface PantallaLoginProps {
  emailInicial?: string;
  /** «¿Es tu primera vez? Creá tu cuenta» (flujo «Entrada a Odobi»). Sin callback, el enlace no se dibuja. */
  onCrearCuenta?: (email: string) => void;
  /** «Otras formas de entrar»: vuelve a la pantalla de Apple · Google · mail. */
  onOtrasFormas?: () => void;
}

export function PantallaLogin({ emailInicial = '', onCrearCuenta, onOtrasFormas }: PantallaLoginProps = {}) {
  const tema = useTema();
  const { estado, avisoSesion, login } = useSession();
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
        contentContainerStyle={[estilosEntrada.scrollFormulario, { paddingHorizontal: tema.espacio.lg }]}
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
        {/* Martin 12/11: sin el isotipo — el nombre solo, centrado. */}
        {/* Martin 12/11: misma disposición que «Creá tu cuenta» (`layoutEntrada`) — nombre + formulario centrados. */}
        <View style={[styles.marca, estilosEntrada.zonaMarcaFormulario]}>
          {/* El wordmark es la marca en su forma más literal: usa `fuente.display` (Plus Jakarta
              Sans Bold), no `fuente.uiBold` como el resto de la UI. */}
          {/* SM-Z4 parte 2 (DECIDIDO por el operador, 2026-11-03): el wordmark es el LOGOTIPO y va en la terracota de marca del mapa
              (--terracota #DE7250, index.html:517), igual que el reveal (COLOR_PALABRA_MARCA, identidadPalette.ts). Es exención
              WCAG 1.4.3 (logotipo), NO texto de UI: el control de contraste lo reconoce sólo por color de marca + este testID
              (LOGOTIPOS_TEXTO, paresPintadosContraste.test.tsx). No copiar este color a otro <Text>. */}
          <Text
            testID="login-wordmark"
            accessibilityRole="header"
            style={[estilosEntrada.wordmarkFormulario, { color: COLOR_PALABRA_MARCA, fontFamily: tema.fuente.display }]}
          >
            Odobi
          </Text>
        </View>

        <Text
          testID="login-titulo"
          style={[styles.encabezado, { color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 22, letterSpacing: -0.3 }]}
        >
          Entrá a tu cuenta
        </Text>

        <View style={{ gap: 14 }}>
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
              <Text style={{ color: tema.color.acentoTexto, fontSize: 17, fontFamily: tema.fuente.display, letterSpacing: -0.2 }}>
                Entrar
              </Text>
            )}
          </Pressable>

          {/* Martin 12/11: quien no se acuerda la contraseña tiene que tener una salida acá mismo. */}
          {onOtrasFormas != null && <AyudaContrasena testID="login-ayuda-contrasena" onOtrasFormas={onOtrasFormas} />}


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
        </View>

        {/* Google y Apple viven en la portada (`PantallaMetodo`); acá, las dos salidas en una fila, como en «Creá tu cuenta». */}
        {(onCrearCuenta != null || onOtrasFormas != null) && (
          <View style={styles.salidas}>
            {onCrearCuenta != null && (
              <Pressable testID="login-crear-cuenta" onPress={() => onCrearCuenta(email.trim())} hitSlop={10}>
                <Text style={{ color: tema.color.acentoTinta, fontSize: 15, fontFamily: tema.fuente.uiMedium }}>Creá tu cuenta</Text>
              </Pressable>
            )}
            {onCrearCuenta != null && onOtrasFormas != null && <Text style={{ color: tema.color.textoTenue }}>·</Text>}
            {onOtrasFormas != null && (
              <Pressable testID="login-otras-formas" onPress={onOtrasFormas} hitSlop={10}>
                <Text style={{ color: tema.color.textoTenue, fontSize: 15, fontFamily: tema.fuente.uiMedium }}>Otras formas de entrar</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  // El lockup es una LÍNEA: símbolo y nombre al lado, centrados en el ancho.
  marca: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // Martin 12/11: más aire entre título y bajada, y antes de los campos.
  encabezado: { textAlign: 'center', marginBottom: 20 },
  salidas: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 22 },
  tagline: {},
  etiqueta: { fontWeight: '600' },
  input: { borderWidth: 1 },
  boton: { alignItems: 'center', justifyContent: 'center' },
  alerta: { textAlign: 'center' },
  // `.ig-error{font-weight:500}` (index.html:539-540).
  alertaError: { fontWeight: '500' },
});
