import { useCallback, useRef } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';
import type { FlatList } from 'react-native-gesture-handler';

import {
  SOPORTE_PLACEHOLDER,
  SOPORTE_PRESENTACION,
  SOPORTE_QUE_VIAJA,
  SOPORTE_QUIEN,
  SOPORTE_TIEMPO_RESPUESTA,
  type FuncionSoporte,
} from '@copiloto/core';

import { useSession } from '../auth/useSession';
import { DockEntrada } from '../chat/DockEntrada';
import { ListaMensajes } from '../chat/ListaMensajes';
import { empujarUnaVez, reabrirNavegacion } from '../../navegacion/empujarUnaVez';
import { Marca } from '../../theme/Marca';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';
import { TarjetaTicketSoporte } from './TarjetaTicketSoporte';
import { useChatSoporte } from './useChatSoporte';
import { useTicketsSoporte } from './useTicketsSoporte';

/** Soporte no tiene ejemplos propios (el prototipo arranca el hilo con mensajes y sólo invita con el campo
 *  «Contame qué pasó…»): `[]` = el vacío no monta el rodillo, en vez de heredar los de gasto/cobro. */
const SIN_EJEMPLOS: readonly string[] = [];

const TITULO: Record<FuncionSoporte, string> = {
  soporte_tecnico: 'Soporte técnico',
  como_uso_la_app: 'Cómo uso la app',
};

export interface PantallaSoporteProps {
  /** Fija para toda la vida de la pantalla — dos entradas separadas en `PantallaCuenta` la fijan de
   * antemano (ver el docstring de `useChatSoporte` sobre por qué no cambia a mitad de conversación). */
  funcion: FuncionSoporte;
}

/**
 * `PantallaSoporte` — SOP5, el chat de soporte embebido en la app.
 *
 * Reusa `ListaMensajes`/`DockEntrada` de `modules/chat/` **tal cual** — son genéricos de
 * presentación (no saben de negocio ni de soporte, sólo de `ChatMessage`/`SendStatus`), mismo
 * criterio que el propio contrato SOP5 pide para el backend del lado del cliente: no reinventar lo
 * que ya funciona. Lo que SÍ es propio: `useChatSoporte`, que apunta a `/soporte/chat` en vez de
 * `/chat` — ver su docstring.
 *
 * **Voz (ODOBI8 §C2, SM-I2)** — el MISMO `DockEntrada` que `modules/chat/ChatView.tsx`
 * (hold-graba/soltar-envía/deslizar-fija, `scrollRef` compuesto contra el scroll de `ListaMensajes`). Es
 * genérico del gesto, no sabe de negocio ni de soporte; lo único propio es `useChatSoporte().enviarAudio`, que namespacea por `funcion` (ver su docstring).
 *
 * ⚠️ **Deuda declarada (DoD §F4, dueño frontend):** el DoD pide una ventana DISCRETA ("al estilo de
 * las apps del rubro", no una pantalla completa) — esta pantalla hoy es una ruta dedicada de
 * `expo-router`, no un widget flotante. Funciona end-to-end contra el shape real del backend; la
 * forma de presentación queda pendiente de un rediseño a sheet/modal, no de este fix.
 */
export function PantallaSoporte({ funcion }: PantallaSoporteProps) {
  const tema = useTema();
  const { me } = useSession();
  const { estado, send, enviarAudio } = useChatSoporte(me?.cliente_id ?? '', funcion);
  const tickets = useTicketsSoporte(estado?.sendStatus ?? 'idle');
  const scrollRef = useRef<FlatList>(null);

  const manejarEnvio = useCallback((text: string) => void send(text, { kind: 'text' }), [send]);

  // El chat de soporte no tiene gates de negocio (confirm/cancel) hoy — `ListaMensajes` exige el
  // callback igual porque es genérico; si el agente alguna vez devuelve un `choice`, esto ya lo
  // enruta como un turno más en vez de perderlo en silencio.
  const manejarEleccion = useCallback(
    (value: string) => void send(value, { kind: 'callback' }),
    [send],
  );

  // Sin cámara en el composer de Soporte (decisión del operador, 2026-11-04): el chat general ya no
  // pasa `onFoto` desde SM-N24 y Soporte queda igual. Con el botón se fue la única vía de adjuntar una
  // foto a un ticket (`POST /soporte/tickets/{id}/adjuntos`): es decisión tomada, no un bug a re-descubrir.

  // Esta pantalla ya fue abierta con `empujarUnaVez` (la puerta quedó cerrada hasta que el lanzador
  // recupere el foco), así que abrir el ticket desde acá la reabre primero: es un toque deliberado
  // dentro de la pantalla, y `empujarUnaVez` la vuelve a cerrar de forma síncrona contra el doble toque.
  const abrirTicket = useCallback((ticketId: number) => {
    reabrirNavegacion();
    empujarUnaVez({ pathname: '/soporte-ticket', params: { ticketId: String(ticketId) } });
  }, []);

  return (
    <MarcoGlass
      titulo={TITULO[funcion]}
      icono="soporte"
      testID="pantalla-soporte"
      /**
       * 🔴 **La presentación de quién contesta, con el isotipo como avatar** (2026-09-18, Martin).
       * El prototipo traía un escudo genérico y no representaba a nadie: ni marca ni persona, y a 38
       * px se leía como un ícono de seguridad. El avatar dice **de qué producto es este chat**; que
       * del otro lado conteste el equipo se dice con PALABRAS —«Soporte de Odobi», «si no lo puedo
       * resolver, abro un ticket y lo sigue una persona»—, que es donde ese matiz se entiende.
       *
       * Va en `encabezadoExtra` (fijo, fuera del scroll) y no como primer mensaje del hilo: no es un
       * mensaje, es quién es el interlocutor — y si scrolleara, desaparecería justo cuando la
       * conversación se hace larga y uno duda de con quién está hablando.
       */
      encabezadoExtra={
        <View style={styles.presentacion}>
          <Marca size={38} tono="tinta" />
          <View style={styles.presentacionTextos}>
            <Text
              testID="soporte-quien"
              style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}
            >
              {SOPORTE_QUIEN}
            </Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>
              {SOPORTE_PRESENTACION}
            </Text>
            <Text
              testID="soporte-detalle"
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}
            >
              {SOPORTE_TIEMPO_RESPUESTA} {SOPORTE_QUE_VIAJA}
            </Text>
          </View>
        </View>
      }
    >
      <KeyboardAvoidingView testID="soporte-view" behavior="padding" style={styles.contenedor}>
        <ListaMensajes
          ref={scrollRef}
          messages={estado?.messages ?? []}
          sendStatus={estado?.sendStatus}
          onChoice={manejarEleccion}
          ejemplos={SIN_EJEMPLOS}
          vacio="ninguno"
          pie={
            <TarjetaTicketSoporte
              vigente={tickets.vigente}
              anteriores={tickets.anteriores}
              cantidadAnteriores={tickets.cantidadAnteriores}
              respuestaEstimada={tickets.respuestaEstimada}
              onAbrirTicket={abrirTicket}
            />
          }
        />

        <DockEntrada
          motivoFallo={estado?.motivoFallo ?? null}
          sendStatus={estado?.sendStatus ?? 'idle'}
          onEnviarTexto={manejarEnvio}
          onAudio={(audio) => void enviarAudio(audio)}
          disabled={estado === null}
          placeholder={SOPORTE_PLACEHOLDER}
          scrollRef={scrollRef}
        />
      </KeyboardAvoidingView>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  presentacion: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  presentacionTextos: { flex: 1, gap: 2 },
});
