import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { textoDeMotivo, type MotivoFallo, type SendStatus } from '@copiloto/core';

import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

/** Fork del composer de DocuMed (`_staging/documed/apps/mobile/src/modules/chat/Composer.tsx`): el
 *  avión de papel como botón de envío = ícono, no la palabra "Enviar". */
function IconoAvion({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12l16-8-6 16-2.5-6L4 12z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

/** Punto que parpadea del indicador de estado del copiloto. Módulo-level: no se recrea en cada
 *  render del composer. El loop queda inerte bajo Jest (mock de `Animated.loop` en `jest.setup.js`),
 *  se ve en el device. */
function PuntoEstado({ color }: { color: string }) {
  const parpadeo = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(parpadeo, { toValue: 0.28, duration: 650, useNativeDriver: true }),
        Animated.timing(parpadeo, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [parpadeo]);
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
}

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
 * Composer de texto — fork mobile del `Composer.tsx` de DocuMed, sólo la parte texto: sin mic ni
 * botones de acción (esas se piden por lenguaje natural en el mensaje, o llegan por voz cuando F6
 * porte el grabador). Vacío/sólo-espacios no envía; `sendStatus==='sending'` bloquea un segundo
 * envío mientras el primero está en vuelo.
 */
export function Composer({ sendStatus, motivoFallo = null, onSend, disabled = false }: ComposerProps) {
  const tema = useTema();
  const [borrador, setBorrador] = useState('');
  const puedeEnviar = !disabled && borrador.trim() !== '' && sendStatus !== 'sending';
  const hint = textoEstado(sendStatus, motivoFallo);

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
        {/* El campo es una píldora de vidrio (gradiente s1→s2, borde, radio, luz superior) — un
            `TextInput` no puede llevar hijos, así que el vidrio se arma alrededor y el input va
            adentro, transparente. */}
        <View style={[styles.campo, { borderColor: tema.color.borde, borderRadius: RADIO_CAMPO }]}>
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
            placeholder="Escribile a tu copiloto…"
            placeholderTextColor={tema.color.textoTenue}
            value={borrador}
            onChangeText={setBorrador}
            editable={!disabled}
            multiline
          />
        </View>
        <Pressable
          testID="chat-enviar"
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          disabled={!puedeEnviar}
          onPress={enviar}
          style={pressableStyle([
            styles.boton,
            {
              backgroundColor: tema.glass.chip,
              borderColor: tema.color.borde,
              borderWidth: 1,
              borderRadius: RADIO_BOTON,
              opacity: puedeEnviar ? 1 : 0.5,
            },
          ])}
        >
          <IconoAvion color={tema.glass.accent2} />
        </Pressable>
      </View>
    </View>
  );
}

/** Proporciones del diseño de vidrio (heredadas del port de DocuMed) — no salen de los tokens de
 *  espaciado: los tokens gobiernan el COLOR (regla cero-hex), estas son proporciones de un diseño
 *  concreto. */
const RADIO_CAMPO = 20;
const RADIO_BOTON = 16;
/** Alto mínimo del campo: da la proporción de píldora en vez de una franja delgada. */
const ALTO_MINIMO_CAMPO = 48;

const styles = StyleSheet.create({
  contenedor: {},
  filaEstado: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  punto: { width: 8, height: 8, borderRadius: 4 },
  // `stretch` (no `flex-end`): el botón tiene la MISMA altura que el campo.
  fila: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  campo: {
    flex: 1,
    borderWidth: 1,
    minHeight: ALTO_MINIMO_CAMPO,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  luzSuperior: { position: 'absolute', top: 0, left: 16, right: 16, height: 1 },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  boton: { width: 46, alignItems: 'center', justifyContent: 'center' },
});
