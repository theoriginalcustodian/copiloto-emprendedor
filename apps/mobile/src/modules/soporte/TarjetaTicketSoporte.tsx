import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  SOPORTE_QUE_VIAJA,
  SOPORTE_TICKET_ROTULO_CONTESTAN,
  SOPORTE_TICKET_ROTULO_SOBRE,
  soporteVerTicketsAnteriores,
  type TicketPropio,
} from '@copiloto/core';

import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import { ETIQUETA_ESTADO_TICKET } from './etiquetasTicket';

export interface TarjetaTicketSoporteProps {
  /** El ticket en curso. `null` = no hay tarjeta (sólo puede quedar el enlace a los anteriores). */
  vigente: TicketPropio | null;
  anteriores: TicketPropio[];
  cantidadAnteriores: number;
  /** `null` ⇒ la fila «Te contestan» NO se pinta (el plazo es decisión del operador, BL-O7). */
  respuestaEstimada: string | null;
  /** Resultado del último adjunto (`null` = ninguno todavía). */
  aviso: string | null;
  onAbrirTicket: (ticketId: number) => void;
}

/**
 * La tarjeta de ticket del hilo de Soporte + «Ver tickets anteriores (N)» (prototipo `index.html:2178-2186`).
 *
 * Los textos fijos salen de `textosSoporte.ts` (compartido con web), NO de los literales del prototipo:
 * «Antes de 4 h hábiles» y «Va con esta conversación» están contradichos a propósito por un acta
 * (BL-O7) y por lo que el backend de verdad guarda. La fila «Te contestan» sólo aparece si el backend
 * manda un plazo; con `null` (hoy) no se pinta.
 *
 * Es un agregado: sin ticket vigente, sin anteriores y sin aviso devuelve `null` y la pantalla queda como
 * estaba.
 */
export function TarjetaTicketSoporte({
  vigente,
  anteriores,
  cantidadAnteriores,
  respuestaEstimada,
  aviso,
  onAbrirTicket,
}: TarjetaTicketSoporteProps) {
  const tema = useTema();
  const [desplegado, setDesplegado] = useState(false);

  if (vigente === null && cantidadAnteriores === 0 && aviso === null) return null;

  return (
    <View testID="soporte-tickets" style={{ gap: tema.espacio.sm, marginTop: tema.espacio.sm }}>
      {vigente !== null && (
        <Pressable
          testID="soporte-ticket-card"
          accessibilityRole="button"
          accessibilityLabel={`Abrir el ticket ${vigente.codigo}`}
          onPress={() => onAbrirTicket(vigente.id)}
          style={pressableStyle(
            [styles.card, { backgroundColor: tema.color.superficie, borderColor: tema.color.borde }],
            PRESS_FADE,
          )}
        >
          <View style={styles.fila}>
            <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
              Ticket {vigente.codigo}
            </Text>
            <Text
              testID="soporte-ticket-estado"
              style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}
            >
              {ETIQUETA_ESTADO_TICKET[vigente.estado]}
            </Text>
          </View>
          <View style={styles.fila}>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{SOPORTE_TICKET_ROTULO_SOBRE}</Text>
            <Text
              testID="soporte-ticket-sobre"
              style={[styles.valor, { color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.chico }]}
            >
              {vigente.asunto}
            </Text>
          </View>
          {respuestaEstimada !== null && (
            <View style={styles.fila}>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                {SOPORTE_TICKET_ROTULO_CONTESTAN}
              </Text>
              <Text
                testID="soporte-ticket-contestan"
                style={[styles.valor, { color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.chico }]}
              >
                {respuestaEstimada}
              </Text>
            </View>
          )}
          <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>
            {SOPORTE_QUE_VIAJA}
          </Text>
        </Pressable>
      )}

      {aviso !== null && (
        <Text
          testID="soporte-adjunto-aviso"
          accessibilityLiveRegion="polite"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}
        >
          {aviso}
        </Text>
      )}

      {cantidadAnteriores > 0 && (
        <Pressable
          testID="soporte-tickets-anteriores"
          accessibilityRole="button"
          accessibilityState={{ expanded: desplegado }}
          onPress={() => setDesplegado((d) => !d)}
          style={pressableStyle(undefined, PRESS_FADE)}
        >
          <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.chico }}>
            {soporteVerTicketsAnteriores(cantidadAnteriores)} {desplegado ? '⌃' : '›'}
          </Text>
        </Pressable>
      )}

      {desplegado &&
        anteriores.map((t) => (
          <Pressable
            key={t.id}
            testID={`soporte-ticket-anterior-${t.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Abrir el ticket ${t.codigo}`}
            onPress={() => onAbrirTicket(t.id)}
            style={pressableStyle([styles.anterior, { borderColor: tema.color.borde }], PRESS_FADE)}
          >
            <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.chico }}>
              {t.codigo} · {ETIQUETA_ESTADO_TICKET[t.estado]}
            </Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }} numberOfLines={1}>
              {t.asunto}
            </Text>
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  valor: { flexShrink: 1, textAlign: 'right' },
  anterior: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, gap: 2 },
});
