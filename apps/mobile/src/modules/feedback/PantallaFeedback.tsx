import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ApiError, enviarFeedback, enviarFeedbackAudio, type ArchivoSubida } from '@copiloto/core';

import { DockFuncion } from '../voz';
import { LoPedisteVos } from './LoPedisteVos';
import { Row } from '../../theme/glass/Row';
import { ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaFeedback` — BETA-1a, entrada desde "Mi cuenta" (`ajustes-cuenta`).
 * Contrato: `coordinacion/abierto/2026-08-04_contrato_planificacion-a-todos_BETA1a-feedback-
 * endpoint.md`.
 *
 * 🔴 **El campo y el mic son los del dock (`DockFuncion`), y mandan a `/feedback` — NO al chat.**
 * (contrato 2026-11-05 campo-y-mic-en-contanos-que-tal). Reemplazan al textarea + «Dictarlo» +
 * «Mandar» que había acá: era la misma función dos veces. Es el INVERSO de «Cómo usar la app», donde el
 * campo deriva al chat con `dejarPendiente` + `dismissAll`: acá la pantalla se queda, y lo escrito o
 * dictado es feedback, no un mensaje al copiloto. Por eso esta pantalla NO usa `dejarPendiente` ni
 * `router.dismissAll` (hay un test que lo afirma).
 *
 * Un solo grabador: el de `DockEntrada`. Esta pantalla ya no monta `useVozComando` propio — dos grabadores
 * sobre el mismo micrófono no dan error, dan audio mudo o cortado. El audio se entrega CRUDO
 * (`onAudioCrudo`): el backend de feedback lo transcribe (`enviarFeedbackAudio`), no `/transcribir`.
 *
 * 🔴 `contexto` (prop de esta pantalla) viaja en las DOS llamadas (`enviarFeedback` y `enviarFeedbackAudio`):
 * es lo que dice de dónde salió el feedback. El `contexto="bi"` que se le pasa al dock es OTRA cosa —el
 * tipo que `/transcribir` exige— y acá no se usa, porque el audio no pasa por ahí.
 */
type Envio = 'idle' | 'enviando' | 'confirmado' | 'error';

export interface PantallaFeedbackProps {
  /** Pantalla/sesión de origen — viaja como `contexto`, puramente informativo del lado del backend. */
  contexto?: string;
}

const PLACEHOLDER_DOCK = 'Contanos qué tal, o hablá…';

export function PantallaFeedback({ contexto }: PantallaFeedbackProps = {}) {
  const tema = useTema();

  const [envioTexto, setEnvioTexto] = useState<Envio>('idle');
  const [errorTexto, setErrorTexto] = useState<string | null>(null);

  const [envioAudio, setEnvioAudio] = useState<Envio>('idle');
  const [errorAudio, setErrorAudio] = useState<string | null>(null);
  const [transcripcion, setTranscripcion] = useState<string | null>(null);
  // Sube en cada envío confirmado para que «Lo pediste vos» refresque sin recargar.
  const [versionLista, setVersionLista] = useState(0);

  const enviando = envioTexto === 'enviando' || envioAudio === 'enviando';

  async function enviarTexto(texto: string) {
    const limpio = texto.trim();
    if (limpio === '' || enviando) return;
    setEnvioTexto('enviando');
    setErrorTexto(null);
    try {
      await enviarFeedback(limpio, contexto);
      setEnvioTexto('confirmado');
      setVersionLista((v) => v + 1);
    } catch (err) {
      // Mismo criterio que `FormularioGasto`: el `detail` del backend ya viene explicado
      // ("feedback demasiado largo (máx 2000 caracteres)"), no se reinterpreta acá.
      const detalle = err instanceof ApiError ? err.detail : null;
      setErrorTexto(detalle != null && detalle !== '' ? detalle : 'No pudimos enviar tu feedback.');
      setEnvioTexto('error');
    }
  }

  async function enviarAudio(archivo: ArchivoSubida) {
    if (enviando) return;
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

  return (
    // «Contanos qué tal»: el título del prototipo (`index.html:2192`) y el rótulo de la fila en Ajustes
    // (`PantallaAjustes.tsx:86`) y de la pantalla web — antes la pantalla se titulaba «Feedback».
    <MarcoGlass titulo="Contanos qué tal" icono="feedback" testID="pantalla-feedback">
      <ScrollFormulario
        testID="feedback-scroll"
        contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.lg, paddingBottom: 120 }}
      >
        {/* La bajada del título (`.titulo-pag p` del prototipo): dice a quién le llega y que NO se contesta. */}
        <Text testID="feedback-bajada" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          Lo lee el equipo que construye Odobi. No lleva respuesta: sirve para saber qué mejorar.
        </Text>

        {/* «¿Qué le cambiarías?» — la pregunta del prototipo, y no es cosmética: una caja vacía pide una
            evaluación general, que es lo más difícil de contestar y lo menos accionable de recibir. Una
            pregunta concreta devuelve respuestas concretas. El campo vive en el dock, al pie. */}
        <Text
          testID="feedback-pregunta"
          style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.titulo }}
        >
          ¿Qué le cambiarías?
        </Text>

        <View style={{ gap: tema.espacio.sm }}>
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

          {enviando && (
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Enviando…
            </Text>
          )}

          {envioAudio === 'error' && errorAudio != null && (
            <Text testID="feedback-audio-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
              {errorAudio}
            </Text>
          )}

          {envioAudio === 'confirmado' && transcripcion != null && (
            <Text
              testID="feedback-audio-confirmado"
              style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.base }}
            >
              Guardamos: "{transcripcion}"
            </Text>
          )}
        </View>

        <LoPedisteVos version={versionLista} />

        {/* 🔴 **La derivación a Soporte, que es lo importante de esta pantalla** (Ola 5). Sin ella,
            un problema real —algo que no anda— cae en la caja de sugerencias, que por diseño nadie
            contesta: el emprendedor queda esperando una respuesta que no va a llegar y concluye que
            avisar no sirve. Va DESPUÉS de «Lo pediste vos», como la `.nota-sub` del prototipo
            (`index.html:2210`), y no como card antes del formulario; sigue siendo tocable. */}
        <Row
          testID="feedback-a-soporte"
          accessibilityLabel="Ir a Soporte técnico"
          onPress={() => router.push({ pathname: '/ajustes-soporte', params: { funcion: 'soporte_tecnico' } })}
        >
          <Text style={{ flex: 1, color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold }}>
              Si algo no funciona, mandalo por Soporte técnico
            </Text>
            {' — eso sí se contesta, y queda con número de ticket.'}
          </Text>
        </Row>
      </ScrollFormulario>

      <DockFuncion
        contexto="bi"
        placeholder={PLACEHOLDER_DOCK}
        disabled={enviando}
        onTexto={(t) => void enviarTexto(t)}
        onAudioCrudo={(audio) => void enviarAudio(audio)}
      />
    </MarcoGlass>
  );
}
