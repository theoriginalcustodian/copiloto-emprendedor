import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { textoDeMotivo, type MotivoFallo, type SendStatus } from '@copiloto/core';

import { conAlfa } from '../../theme/glass/conAlfa';
import { pressableStyle } from '../../theme/glass/presion';
import { useMovimientoReducido } from '../../theme/movimientoReducido';
import { useTema } from '../../theme/ThemeProvider';
import { tonoBotonEntrada, tonoBotonFoto } from './tonoBotonEntrada';

/** Fork del composer de DocuMed (`_staging/documed/apps/mobile/src/modules/chat/Composer.tsx`): el
 *  avión de papel como botón de envío = ícono, no la palabra "Enviar". */
function IconoAvion({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12l16-8-6 16-2.5-6L4 12z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

/** Cámara — Gastos Fase 2 (foto de ticket). Trazo simple, mismo grosor que `IconoAvion` para que
 *  los dos íconos del composer pesen igual visualmente. */
function IconoCamara({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

/** Punto que parpadea del indicador de estado del copiloto. Módulo-level: no se recrea en cada
 *  render del composer. El loop queda inerte bajo Jest (mock de `Animated.loop` en `jest.setup.js`),
 *  se ve en el device. */
function PuntoEstado({ color }: { color: string }) {
  const parpadeo = useRef(new Animated.Value(1)).current;
  const movimientoReducido = useMovimientoReducido();
  useEffect(() => {
    // 🔴 Quieto si el usuario pidió menos movimiento. **El estado no se pierde: lo lleva el COLOR**,
    // que es el que distingue «pensando» de «listo». El parpadeo sólo lo hacía notar — y un punto que
    // parpadea sin parar en la pantalla principal es justo lo que ese ajuste existe para apagar.
    if (movimientoReducido) {
      parpadeo.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(parpadeo, { toValue: 0.28, duration: 650, useNativeDriver: true }),
        Animated.timing(parpadeo, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [movimientoReducido, parpadeo]);
  return <Animated.View style={[styles.punto, { backgroundColor: color, opacity: parpadeo }]} />;
}

export interface ComposerProps {
  sendStatus: SendStatus;
  /** Por qué falló el último envío -- decide QUÉ dice el aviso de error (ver `MotivoFallo`). */
  motivoFallo?: MotivoFallo | null;
  onSend: (text: string) => void;
  /** Deshabilita el composer entero -- lo usa `ChatView` mientras el chat todavía no terminó de
   * hidratarse (`estado === null`, ver `useChat.ts`). */
  disabled?: boolean;
  /** Foto adjunta (hoy sólo Soporte). Ausente == sin botón de cámara: el chat no la pasa (SM-N24) --
   * ver el docstring del componente. */
  onFoto?: () => void;
  /**
   * El texto de invitación del campo. Opcional: el chat general conserva el suyo («Escribí, o hablá…», que
   * invita a anotar un movimiento); Soporte pasa el de contar un problema. Un literal único le mentía a
   * quien venía a pedir ayuda (O1).
   */
  placeholder?: string;
  /**
   * Un texto que otra parte de la app le deja al campo (`hitl a`: el aviso de una tarjeta de Mi día).
   * Se SIEMBRA, no se manda: lo envía quien lo lee. `id` distingue una siembra de la anterior aunque
   * el texto sea el mismo (dos veces el mismo aviso = dos pedidos de volver a verlo).
   *
   * 🔴 **No pisa lo que ya había escrito**: un borrador a medias es trabajo del usuario. La semilla va
   * arriba y lo anterior queda debajo, a la vista.
   */
  semilla?: { texto: string; id: number } | null;
  /**
   * SM-I2 — el mic chico, en el lugar del avión mientras no haya nada escrito (patrón de WhatsApp): escribir o
   * hablar se eligen con el mismo pulgar. Lo arma `DockEntrada`.
   */
  mic?: ReactNode;
  /**
   * SM-I2 — lo que ocupa el lugar del campo durante una captura: la barra de grabación, a ancho completo. El
   * campo queda oculto, no desmontado, y conserva el borrador.
   */
  enLugarDelCampo?: ReactNode;
  /**
   * SM-I2 — el campo no abre el teclado acá: tocarlo lleva a donde se escribe. Mi día lo usa para subir el
   * chat (`index.html:2717`), que es el que tiene dónde mostrar la respuesta.
   */
  onTocarCampo?: () => void;
}

const PLACEHOLDER_CHAT = 'Escribí, o hablá…';

/**
 * `sendStatus` (+ el motivo, si falló) -> el copy del indicador.
 *
 * 🔴 **Los tres estados de espera dicen lo MISMO, y es a propósito** (heredado de DocuMed, donde
 * costó un incidente real). El polling nunca se rinde (sólo baja el ritmo), así que la distinción
 * entre "pensando" y "tardando" no le cambia nada al usuario: en los tres casos el sistema está
 * trabajando y él no tiene que hacer nada.
 *
 * 🔴 **El error SÍ es específico, y ahí la distinción es todo** — ver `MotivoFallo` en
 * `@copiloto/core`.
 */
function textoEstado(sendStatus: SendStatus, motivoFallo: MotivoFallo | null): string | null {
  switch (sendStatus) {
    case 'sending':
    case 'waiting':
    case 'timeout':
      return 'Trabajando…';
    case 'error':
      return motivoFallo ? textoDeMotivo(motivoFallo) : 'No pudimos procesar tu mensaje. Probá de nuevo.';
    default:
      return null;
  }
}

/**
 * Composer de texto — fork mobile del `Composer.tsx` de DocuMed, sólo la parte texto: sin botones de
 * acción propios (esas se piden por lenguaje natural en el mensaje). El dictado por voz (F6) llega por
 * `mic`, pero su máquina no vive acá adentro: el ciclo de vida de una grabación no tiene nada que ver con
 * el de un mensaje de texto -- ver `DockEntrada.tsx`.
 * Vacío/sólo-espacios no envía; `sendStatus==='sending'` bloquea un segundo envío mientras el primero
 * está en vuelo.
 *
 * 🔴 **`onFoto` rompe la regla de "sin botones de acción propios", y es la única excepción a
 * propósito** — pero ya NO la usa el chat (SM-N24): la foto del comprobante es sólo de Gastos
 * (`gastos/FotoFuncion`), y el chat no pasa `onFoto`. Hoy lo pasa Soporte, para adjuntar a un ticket.
 * Abrir la cámara es una capacidad del DISPOSITIVO, no del agente ("sacame una foto" no se puede pedir
 * hablando), por eso es un botón y no lenguaje natural. Vive DENTRO del composer porque no tiene ciclo
 * de vida propio que animar: `useCapturaFoto().elegir()` es una sola llamada que se resuelve o cancela.
 */
export function Composer({
  sendStatus,
  motivoFallo = null,
  onSend,
  disabled = false,
  onFoto,
  placeholder = PLACEHOLDER_CHAT,
  semilla = null,
  mic = null,
  enLugarDelCampo = null,
  onTocarCampo,
}: ComposerProps) {
  const tema = useTema();
  const [borrador, setBorrador] = useState('');
  // Sembrar es una función del `id`, no del objeto ni del texto: un re-render que rearma `{texto, id}` con
  // el mismo `id` no re-siembra (volvería a escribir el aviso sobre lo que el usuario ya editó), y el mismo
  // texto con otro `id` sí.
  const ultimaSemilla = useRef<number | null>(null);
  useEffect(() => {
    if (semilla == null || semilla.id === ultimaSemilla.current) return;
    ultimaSemilla.current = semilla.id;
    setBorrador((previo) => (previo.trim() === '' ? semilla.texto : `${semilla.texto}\n\n${previo}`));
  }, [semilla]);
  const puedeEnviar = !disabled && borrador.trim() !== '' && sendStatus !== 'sending';
  const hint = textoEstado(sendStatus, motivoFallo);
  const capturando = enLugarDelCampo != null;
  // Con una captura en curso el mic se queda aunque haya borrador: es el botón que el dedo está apretando.
  const mostrarMic = mic != null && (borrador.trim() === '' || capturando);

  function enviar() {
    if (!puedeEnviar) return;
    const texto = borrador;
    setBorrador('');
    onSend(texto);
  }

  return (
    <View style={[styles.contenedor, { paddingTop: 10, paddingHorizontal: 18, paddingBottom: 18, gap: tema.espacio.sm }]}>
      {hint && (
        <View testID="composer-status" style={styles.filaEstado}>
          {/* `timeout` no se pinta de rojo: con el polling que no abandona, seguir esperando es el
              curso NORMAL, no una anomalía. Rojo queda sólo para `error`. */}
          <PuntoEstado color={sendStatus === 'error' ? tema.color.peligro : tema.color.acento} />
          <Text
            style={{
              color: sendStatus === 'error' ? tema.color.peligro : tema.color.texto,
              fontSize: tema.tipo.chico,
              fontFamily: tema.fuente.mono,
            }}
          >
            {hint}
          </Text>
        </View>
      )}
      <View style={styles.fila}>
        {onFoto && !capturando && (
          <Pressable
            testID="chat-foto"
            accessibilityRole="button"
            accessibilityLabel="Foto del ticket"
            disabled={disabled}
            onPress={onFoto}
            style={pressableStyle([
              styles.boton,
              {
                backgroundColor: tonoBotonFoto(tema, !disabled).fondo,
                borderColor: tema.color.borde,
                borderWidth: 1,
                borderRadius: RADIO_FOTO,
              },
            ])}
          >
            <IconoCamara color={tonoBotonFoto(tema, !disabled).glifo} />
          </Pressable>
        )}
        {/* El campo es una píldora de vidrio (gradiente s1→s2, borde, radio, luz superior) — un
            `TextInput` no puede llevar hijos, así que el vidrio se arma alrededor y el input va
            adentro, transparente. */}
        {enLugarDelCampo}
        <View
          testID="chat-composer-campo"
          style={[styles.campo, { borderColor: tema.color.borde, borderRadius: RADIO_CAMPO }, capturando && styles.oculto]}
        >
          {/* SM-N25 — base translúcida BAJO el vidrio: el campo flota sobre el chat, y con el vidrio solo (alfa .04-.14 en oscuro)
              el texto de una card que pasa por detrás se pisa con el placeholder (medido en device 2026-11-02). Tomada del
              token `fondo` de la piel; `ALFA_BASE_CAMPO` es el piso de contraste, no un adorno. */}
          <View
            testID="chat-composer-campo-base"
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: conAlfa(tema.color.fondo, ALFA_BASE_CAMPO) }]}
          />
          <LinearGradient
            colors={[tema.glass.s1, tema.glass.s2]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.luzSuperior, { backgroundColor: tema.glass.hi }]} pointerEvents="none" />
          <TextInput
            testID="chat-composer"
            style={[styles.input, { color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.ui }]}
            placeholder={placeholder}
            placeholderTextColor={tema.color.textoTenue}
            value={borrador}
            onChangeText={setBorrador}
            editable={!disabled && onTocarCampo == null}
            multiline
          />
          {onTocarCampo != null && (
            <Pressable
              testID="chat-composer-abrir"
              accessibilityRole="button"
              accessibilityLabel={placeholder}
              onPress={onTocarCampo}
              style={StyleSheet.absoluteFill}
            />
          )}
        </View>
        {mostrarMic ? (
          mic
        ) : (
          <Pressable
            testID="chat-enviar"
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            disabled={!puedeEnviar}
            onPress={enviar}
            style={pressableStyle([
              styles.enviar,
              { backgroundColor: tonoBotonEntrada(tema, puedeEnviar).fondo },
            ])}
          >
            <IconoAvion color={tonoBotonEntrada(tema, puedeEnviar).glifo} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Proporciones del diseño de vidrio (heredadas del port de DocuMed) — no salen de los tokens de
 *  espaciado: los tokens gobiernan el COLOR (regla cero-hex), estas son proporciones de un diseño
 *  concreto. */
const RADIO_FOTO = 16;
/** El campo del mapa: píldora de 52, el mismo lado que el mic (`.campo`/`.mic`, `index.html:166-171`). */
const ALTO_BARRA = 52;
/** Alto del composer en reposo (sin renglón de estado): `paddingTop` 10 + barra + `paddingBottom` 18. Lo usa el panel para
 *  reservar el lugar del campo de Mi día bajo el asa (SM-N22). */
export const ALTO_COMPOSER_REPOSO = 10 + ALTO_BARRA + 18;
const RADIO_CAMPO = ALTO_BARRA / 2;
/** Opacidad de la base bajo el vidrio del campo (SM-N25 / SM-N41): que lo que pasa detrás NO se lea. Con .85 todavía se alcanzaba
 *  a leer «Editar/Cancelar» a través del campo (medido en device, 2026-11-03); el operador decidió LEGIBLE: se sube ACÁ, nunca en el JSX.
 *  .96 tampoco alcanzó: en device (release, 2026-11-04) el texto de la burbuja se leía en la franja inferior del campo, en las dos pieles. Se filtra (1-alfa) del contraste
 *  de atrás: a .96 es ~4 %, a .99 ~1 %. 1.0 mata la translucidez por completo: eso lo decide el operador, no este valor. */
const ALFA_BASE_CAMPO = 0.99;

const styles = StyleSheet.create({
  contenedor: {},
  filaEstado: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  punto: { width: 8, height: 8, borderRadius: 4 },
  // `flex-end`: si el texto crece a varias líneas, el mic y el avión se quedan abajo, bajo el pulgar.
  fila: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  campo: {
    flex: 1,
    borderWidth: 1,
    minHeight: ALTO_BARRA,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  luzSuperior: { position: 'absolute', top: 0, left: 16, right: 16, height: 1 },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  boton: { width: 46, height: ALTO_BARRA, alignItems: 'center', justifyContent: 'center' },
  enviar: {
    width: ALTO_BARRA,
    height: ALTO_BARRA,
    borderRadius: ALTO_BARRA / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oculto: { display: 'none' },
});
