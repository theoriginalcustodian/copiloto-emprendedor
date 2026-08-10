import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { obtenerMiTicket, type MensajeTicketPropio, type TicketPropio } from '@copiloto/core';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';

const ETIQUETA_ESTADO: Record<TicketPropio['estado'], string> = {
  abierto: 'Abierto',
  respondido: 'Respondido',
  cerrado: 'Cerrado',
};

/** Igual criterio que `fechaCorta` de `AdminScreen.tsx` (web) — dato ilegible es información, un
 *  cartel de error no. No se comparte el helper entre plataformas. */
function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

type Estado = 'cargando' | 'ok' | 'no_encontrado' | 'no_disponible' | 'error';

export interface PantallaTicketProps {
  ticketId: number;
}

/**
 * `PantallaTicket` — S6-11: a dónde lleva tocar una fila `ticket_respuesta` de Actividad. Hilo
 * COMPLETO de sólo lectura (responder de nuevo es por el chat de soporte de SOP5, no desde acá).
 *
 * 🔴 **[ASSUMED_PENDING_VERIFY]** — mismo aviso que `MiTicketScreen` (web): consume
 * `obtenerMiTicket` (`@copiloto/core`) contra `GET /soporte/tickets/{id}`, endpoint que TODAVÍA no
 * existe en `main` (ver `coordinacion/abierto/2026-08-10_pedido_frontend-a-todos_S6-11-...md`).
 * Mientras no esté desplegado, `estado` cae en `no_disponible` — estado honesto, no un error de
 * esta pantalla.
 */
export function PantallaTicket({ ticketId }: PantallaTicketProps) {
  const tema = useTema();
  const [estado, setEstado] = useState<Estado>('cargando');
  const [ticket, setTicket] = useState<TicketPropio | null>(null);
  const [mensajes, setMensajes] = useState<MensajeTicketPropio[]>([]);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback(() => {
    setEstado('cargando');
    obtenerMiTicket(ticketId)
      .then((r) => {
        if (!vivo.current) return;
        if (r.status === 'ok') {
          setTicket(r.ticket);
          setMensajes(r.mensajes);
          setEstado('ok');
          return;
        }
        setTicket(null);
        setMensajes([]);
        setEstado(r.status);
      })
      .catch(() => {
        if (vivo.current) setEstado('error');
      });
  }, [ticketId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const titulo = ticket != null ? `${ticket.codigo} · ${ETIQUETA_ESTADO[ticket.estado]}` : 'Tu ticket';

  return (
    <MarcoGlass titulo={titulo} icono="conversacion" testID="pantalla-ticket">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.sm }}
        testID="ticket-scroll"
      >
        {estado === 'cargando' && (
          <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono }}>
            Cargando…
          </Text>
        )}

        {estado === 'error' && (
          <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono }}>
            No pudimos cargar tu ticket.
          </Text>
        )}

        {estado === 'no_disponible' && (
          <Text
            testID="ticket-no-disponible"
            style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono }}
          >
            Tu ticket todavía no está disponible acá.
          </Text>
        )}

        {estado === 'no_encontrado' && (
          <Text
            testID="ticket-no-encontrado"
            style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono }}
          >
            No encontramos ese ticket.
          </Text>
        )}

        {estado === 'ok' && ticket != null && (
          <>
            <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono, fontSize: 13 }}>
              {ticket.asunto}
            </Text>
            {mensajes.map((m) => (
              <View
                key={m.id}
                testID={`ticket-msj-${m.id}`}
                style={[
                  styles.burbuja,
                  {
                    backgroundColor: m.autor === 'operador'
                      ? tema.color.acento + '1f' // ~12% alpha, mismo criterio que la web (color-mix 12%)
                      : tema.color.superficie,
                    borderColor: m.autor === 'operador' ? tema.color.acento : tema.color.borde,
                    alignSelf: m.autor === 'operador' ? 'flex-end' : 'flex-start',
                  },
                ]}
              >
                <Text
                  testID={`ticket-msj-${m.id}-autor`}
                  style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono, fontSize: 11 }}
                >
                  {m.autor === 'operador' ? 'Operador' : 'Vos'} · {fechaCorta(m.created_at)}
                </Text>
                <Text
                  testID={`ticket-msj-${m.id}-texto`}
                  style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: 13 }}
                >
                  {m.texto}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  burbuja: {
    maxWidth: '80%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 2,
  },
});
