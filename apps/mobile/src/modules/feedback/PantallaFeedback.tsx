import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ApiError, enviarFeedback, enviarFeedbackAudio } from '@copiloto/core';

import { useVozComando } from '../chat/useVozComando';
import { LoPedisteVos } from './LoPedisteVos';
import { Row } from '../../theme/glass/Row';
import { CampoTexto, FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaFeedback` — BETA-1a, entrada desde "Mi cuenta" (`ajustes-cuenta`).
 * Contrato: `coordinacion/abierto/2026-08-04_contrato_planificacion-a-todos_BETA1a-feedback-
 * endpoint.md`.
 *
 * Voz Y texto — dos caminos independientes, no un toggle: el textarea sigue disponible mientras se
 * puede grabar, porque nada en el contrato dice que son excluyentes.
 *
 * 🔴 **Reusa la LÓGICA de `useVozComando` (`modules/chat`), no el widget `BotonVoz`.** `BotonVoz` es
 * el gesto compuesto (mantener + deslizar-para-fijar) que necesita un `scrollRef` de RNGH para
 * convivir con el scroll de `ListaMensajes` — resuelve un problema del chat (mensajes rápidos,
 * frecuentes) que este formulario no tiene: acá el feedback es una acción deliberada y poco
 * frecuente, y un tap-para-grabar/tap-para-detener alcanza. La máquina de fases (cero retención,
 * pre-warm, manejo del bug de `AudioRecorder.stop()`) es exactamente la misma; sólo cambia el gesto
 * de arriba.
 */
type EnvioTexto = 'idle' | 'enviando' | 'confirmado' | 'error';
type EnvioAudio = 'idle' | 'enviando' | 'confirmado' | 'error';

export interface PantallaFeedbackProps {
  /** Pantalla/sesión de origen — viaja como `contexto`, puramente informativo del lado del backend. */
  contexto?: string;
}

const LIMITE_TEXTO = 2000;

export function PantallaFeedback({ contexto }: PantallaFeedbackProps = {}) {
  const tema = useTema();
  const voz = useVozComando();

  const [texto, setTexto] = useState('');
  const [envioTexto, setEnvioTexto] = useState<EnvioTexto>('idle');
  const [errorTexto, setErrorTexto] = useState<string | null>(null);

  const [envioAudio, setEnvioAudio] = useState<EnvioAudio>('idle');
  const [errorAudio, setErrorAudio] = useState<string | null>(null);
  const [transcripcion, setTranscripcion] = useState<string | null>(null);
  // Sube en cada envío confirmado para que «Lo pediste vos» refresque sin recargar.
  const [versionLista, setVersionLista] = useState(0);

  const puedeEnviarTexto = texto.trim() !== '' && envioTexto !== 'enviando';

  async function enviarTexto() {
    setEnvioTexto('enviando');
    setErrorTexto(null);
    try {
      await enviarFeedback(texto.trim(), contexto);
      setEnvioTexto('confirmado');
      setVersionLista((v) => v + 1);
      setTexto('');
    } catch (err) {
      // Mismo criterio que `FormularioGasto`: el `detail` del backend ya viene explicado
      // ("feedback demasiado largo (máx 2000 caracteres)"), no se reinterpreta acá.
      const detalle = err instanceof ApiError ? err.detail : null;
      setErrorTexto(detalle != null && detalle !== '' ? detalle : 'No pudimos enviar tu feedback.');
      setEnvioTexto('error');
    }
  }

  async function alTocarMic() {
    if (voz.fase === 'inactivo') {
      await voz.iniciar();
      return;
    }
    if (voz.fase === 'grabando') {
      await voz.detener();
      const archivo = voz.tomar();
      if (archivo === null) return; // grabación descartada por el propio hook (sin audio útil)
      setEnvioAudio('enviando');
      setErrorAudio(null);
      setTranscripcion(null);
      try {
        const res = await enviarFeedbackAudio(archivo, contexto);
        setEnvioAudio('confirmado');
        setVersionLista((v) => v + 1);
        setTranscripcion(res.transcripcion);
      } catch (err) {
        const detalle = err instanceof ApiError ? err.detail : null;
        setErrorAudio(detalle != null && detalle !== '' ? detalle : 'No pudimos enviar tu feedback por voz.');
        setEnvioAudio('error');
      }
    }
  }

  const grabando = voz.fase === 'grabando';

  return (
    <MarcoGlass titulo="Feedback" icono="feedback" testID="pantalla-feedback">
      <ScrollFormulario
        testID="feedback-scroll"
        contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.lg, paddingBottom: 120 }}
      >
        {/* «¿Qué le cambiarías?» — la pregunta del prototipo, y no es cosmética: una caja vacía con
            la etiqueta «Tu feedback» pide una evaluación general, que es lo más difícil de contestar
            y lo menos accionable de recibir. Una pregunta concreta devuelve respuestas concretas. */}
        <Text
          testID="feedback-pregunta"
          style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.titulo }}
        >
          ¿Qué le cambiarías?
        </Text>
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          Contanos qué te gustaría que mejoremos, o grabá un audio si preferís hablarlo.
        </Text>

        <View style={{ gap: tema.espacio.sm }}>
          <CampoTexto
            etiqueta="Tu feedback"
            valor={texto}
            onChange={setTexto}
            placeholder="Qué funcionó, qué no, qué te gustaría que exista…"
            multiline
            maxLength={LIMITE_TEXTO}
            testID="feedback-texto"
          />

          {envioTexto === 'error' && errorTexto != null && (
            <Text testID="feedback-texto-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
              {errorTexto}
            </Text>
          )}

          {envioTexto === 'confirmado' && (
            <Text testID="feedback-texto-confirmado" style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.base }}>
              ¡Gracias! Guardamos tu feedback.
            </Text>
          )}

          <FilaBotones
            testID="feedback-texto-acciones"
            botones={[
              {
                etiqueta: envioTexto === 'enviando' ? 'Enviando…' : 'Enviar',
                onPress: () => void enviarTexto(),
                variante: 'primario',
                deshabilitado: !puedeEnviarTexto,
                testID: 'feedback-texto-enviar',
              },
            ]}
          />
        </View>

        {/* 🔴 **La derivación a Soporte, que es lo importante de esta pantalla** (Ola 5). Sin ella,
            un problema real —algo que no anda— cae en la caja de sugerencias, que por diseño nadie
            contesta: el emprendedor queda esperando una respuesta que no va a llegar y concluye que
            avisar no sirve. Acá se dice de frente cuál es cada camino y se ofrece el otro. */}
        <Row
          testID="feedback-a-soporte"
          accessibilityLabel="Ir a Soporte técnico"
          onPress={() => router.push({ pathname: '/ajustes-soporte', params: { funcion: 'soporte_tecnico' } })}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
              ¿Algo no funciona?
            </Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Contalo en Soporte técnico: ahí te contestamos y, si hace falta, abrimos un ticket. Esto
              de acá lo leemos, pero no lo respondemos.
            </Text>
          </View>
        </Row>

        <View style={{ gap: tema.espacio.sm, alignItems: 'center' }}>
          <Pressable
            testID="feedback-mic"
            accessibilityRole="button"
            accessibilityLabel={
              grabando ? 'Detener grabación y enviar' : 'Grabar feedback por voz'
            }
            onPress={() => void alTocarMic()}
            disabled={envioAudio === 'enviando'}
            style={pressableStyle(undefined, PRESS_FADE)}
            hitSlop={8}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: tema.radio.completo,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: grabando ? tema.color.peligro : tema.color.acento,
              }}
            >
              <GlassIcon name="grabar" size={30} />
            </View>
          </Pressable>

          <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            {grabando
              ? `Grabando… ${voz.segundos}s — tocá de nuevo para enviar`
              : envioAudio === 'enviando'
                ? 'Enviando…'
                : 'Tocá para grabar'}
          </Text>

          {envioAudio === 'error' && errorAudio != null && (
            <Text testID="feedback-audio-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
              {errorAudio}
            </Text>
          )}

          {envioAudio === 'confirmado' && transcripcion != null && (
            <Text
              testID="feedback-audio-confirmado"
              style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.base, textAlign: 'center' }}
            >
              Guardamos: "{transcripcion}"
            </Text>
          )}
        </View>
        <LoPedisteVos version={versionLista} />
      </ScrollFormulario>
    </MarcoGlass>
  );
}
