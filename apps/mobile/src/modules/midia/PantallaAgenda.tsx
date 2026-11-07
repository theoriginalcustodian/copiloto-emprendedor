import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import {
  TEXTO_NUEVO_EVENTO,
  estadoDeServicio,
  franjaDeEvento,
  horaDeEvento,
  KEY_GOOGLE_CALENDAR,
  leerAgenda,
  listarCatalogo,
  rangoAgenda,
  type AgendaMiDia,
  type EstadoConexion,
  type EventoAgenda,
} from '@copiloto/core';

import { dejarPendiente } from '../chat/mensajePendiente';
import { FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import type { Tokens } from '../../theme/tokens';
import { armarRejilla, PX_POR_HORA, rotuloHora } from './rejillaAgenda';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** `martes 18` (prototipo: `Hoy martes 18`, `Mañana miércoles 19`). */
const fechaCorta = (d: Date): string => `${DIAS[d.getDay()]} ${d.getDate()}`;

/** La columna izquierda de la fila: hora en Mañana, día del mes en Esta semana, «—» en Sin hora. */
function columnaHora(grupo: string, ev: EventoAgenda): string {
  if (grupo === 'sin_hora') return '—';
  if (grupo === 'semana') {
    const t = ev.diaCompleto || typeof ev.inicioCrudo !== 'string' ? null : new Date(ev.inicioCrudo);
    if (t != null && !Number.isNaN(t.getTime())) return String(t.getDate());
    if (typeof ev.inicioCrudo === 'string' && /^\d{4}-\d{2}-(\d{2})/.test(ev.inicioCrudo)) return String(Number(ev.inicioCrudo.slice(8, 10)));
    return '—';
  }
  return horaDeEvento(ev.inicioCrudo) ?? '—';
}

/** `.lista`: la tarjeta blanca de filas (prototipo 1273). */
const estiloLista = (tema: Tokens) => ({
  backgroundColor: tema.color.superficieAlta,
  borderRadius: 16,
  paddingHorizontal: tema.espacio.md,
});

/** `.ev`: hora | título + origen. */
function FilaEvento({ hora, titulo, detalle }: { hora: string; titulo: string; detalle: string }) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start', paddingVertical: 13 }}>
      <Text style={{ width: 42, color: tema.color.textoTenue, fontSize: tema.tipo.chico, paddingTop: 2 }}>{hora}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}>{titulo}</Text>
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, marginTop: 1 }}>{detalle}</Text>
      </View>
    </View>
  );
}

/**
 * `PantallaAgenda` (BL-J13, K-13, ADR-004) — la agenda de los próximos días, sólo lectura: Hoy ·
 * Mañana · Esta semana · Sin hora, con los `titulo` EXACTOS que manda el backend. Paridad con
 * `AgendaScreen` de la web; la lógica (cliente, rango ≤ 14 días, franja horaria) vive en
 * `@copiloto/core`.
 *
 * 🔴 **Con Calendar sin conectar NUNCA se dice «no tenés eventos»**: es falso, no sabemos nada. Se
 * ofrece conectar. Un endpoint caído (incluido un 400) degrada a un aviso con «Reintentar».
 *
 * 🔴 **BL-V23 (mobile):** `agenda.conectado === false` agrupa "nunca conectada" con "caída" —
 * `leerAgenda` no las distingue. Igual que `PanelCalendario` en `PantallaMiDia.tsx`, se desempata
 * leyendo `estadoConexion` del catálogo (`listarCatalogo` + `estadoDeServicio`, fail-soft): si dice
 * `caido` se ofrece "Reconectar", si no (incluido sin catálogo) se degrada al texto de "nunca
 * conectada", el menos alarmante ante la duda.
 *
 * 🔴 **«Nuevo evento» no escribe en Calendar**: deja «Quiero agendar un evento» en el buzón del chat
 * principal (`dejarPendiente`, el puente de BL-W9) y cierra el glass — mismo mecanismo que «Cómo usar
 * la app». El alta la hace el agente con `calendar_book` y confirm-gate HITL (ADR-004 §3).
 *
 * Pantalla HOJA: no lanza otro glass, así que no participa de `empujarUnaVez`.
 */
type Estado = 'cargando' | 'ok' | 'no_disponible';

export function PantallaAgenda() {
  const tema = useTema();
  const [estado, setEstado] = useState<Estado>('cargando');
  const [agenda, setAgenda] = useState<AgendaMiDia | null>(null);
  // BL-V23 (mobile): la salud DE Google Calendar puntual — desempata "nunca conectada" de "caída"
  // más abajo, algo que `leerAgenda` no distingue (mismo patrón que `PantallaMiDia`/`PanelCalendario`).
  const [estadoGoogleCalendar, setEstadoGoogleCalendar] = useState<EstadoConexion | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    setEstado('cargando');
    const res = await leerAgenda(rangoAgenda());
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setAgenda(res.agenda);
      setEstado('ok');
      return;
    }
    setEstado('no_disponible');
  }, []);

  const cargarSaludConexiones = useCallback(async () => {
    try {
      const res = await listarCatalogo();
      if (!vivo.current) return;
      if (res.status === 'ok') {
        setEstadoGoogleCalendar(estadoDeServicio(res.servicios, KEY_GOOGLE_CALENDAR));
      }
    } catch {
      /* fail-soft: sin catálogo el punto queda como estaba. */
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    void cargarSaludConexiones();
    return () => {
      vivo.current = false;
    };
  }, [cargar, cargarSaludConexiones]);

  function nuevoEvento() {
    dejarPendiente(TEXTO_NUEVO_EVENTO);
    router.back();
  }

  const tenue = { color: tema.color.textoTenue, fontSize: tema.tipo.base } as const;
  // La hora se lee al renderizar: la pantalla se recarga al entrar, no necesita reloj propio.
  const ahora = new Date();

  return (
    <MarcoGlass titulo="Agenda" icono="miDia" testID="pantalla-agenda">
      <ScrollFormulario
        testID="agenda-contenido"
        contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.lg, paddingBottom: 120 }}
      >
        {/* Mapeo `agenda` (prototipo index.html?ver=agenda): subtítulo, estado de la conexión, Hoy como
            rejilla horaria (`rejillaAgenda.ts`) y el resto como listas. */}
        <Text testID="agenda-intro" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          Tus eventos y lo que vence, en la misma línea.
        </Text>
        {estado === 'ok' && agenda != null && agenda.conectado && (
          // SM-N34: punto + texto (igual que el mapa y que el punto de conexión del avatar). El punto es
          // decorativo (el estado lo dice el texto: no depende sólo del color, WCAG 1.4.1).
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              testID="agenda-estado-punto"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tema.color.acento }}
            />
            <Text
              testID="agenda-estado"
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiSemibold }}
            >
              Google Calendar conectada
            </Text>
          </View>
        )}

        {estado === 'cargando' && <ActivityIndicator testID="agenda-cargando" color={tema.color.acento} />}

        {estado === 'no_disponible' && (
          <View style={{ gap: tema.espacio.sm }} testID="agenda-no-disponible">
            <Text style={tenue}>No pudimos cargar tu agenda. Probá de nuevo en un momento.</Text>
            <FilaBotones
              testID="agenda-reintentar-fila"
              botones={[{ etiqueta: 'Reintentar', onPress: () => void cargar(), variante: 'secundario', testID: 'agenda-reintentar' }]}
            />
          </View>
        )}

        {estado === 'ok' && agenda != null && !agenda.conectado && estadoGoogleCalendar === 'caido' && (
          <Text testID="agenda-calendario-caida" style={tenue}>
            Se cayó la conexión con Google Calendar. Reconectala en Ajustes → Apps para volver a ver
            tu agenda.
          </Text>
        )}

        {estado === 'ok' && agenda != null && !agenda.conectado && estadoGoogleCalendar !== 'caido' && (
          <Text testID="agenda-no-conectado" style={tenue}>
            Conectá Google Calendar en Ajustes → Apps para ver acá tu agenda.
          </Text>
        )}

        {estado === 'ok' && agenda != null && agenda.conectado &&
          agenda.grupos.map((g) => {
            const esHoy = g.id === 'hoy';
            const rejilla = esHoy ? armarRejilla(g.eventos, ahora) : null;
            // `Hoy martes 18` / `Mañana miércoles 19` (prototipo 2512, 2527); los otros grupos llevan su cuenta.
            const complemento =
              g.id === 'hoy' ? fechaCorta(ahora) : g.id === 'manana' ? fechaCorta(new Date(ahora.getTime() + 86_400_000)) : g.eventos.length > 0 ? String(g.eventos.length) : null;
            return (
              <View key={g.id} testID={`agenda-grupo-${g.id}`} style={{ gap: tema.espacio.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 }}>
                    <Text
                      accessibilityRole="header"
                      style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}
                    >
                      {g.titulo}
                    </Text>
                    {complemento != null && (
                      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{complemento}</Text>
                    )}
                  </View>
                  {esHoy && (
                    <Pressable
                      testID="agenda-nuevo-evento"
                      accessibilityRole="button"
                      accessibilityLabel="Nuevo evento"
                      onPress={nuevoEvento}
                      hitSlop={8}
                      style={pressableStyle([
                        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: tema.radio.completo, backgroundColor: tema.color.superficieAlta },
                      ])}
                    >
                      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={tema.color.acentoTinta} strokeWidth={2} strokeLinecap="round">
                        <Path d="M12 5v14M5 12h14" />
                      </Svg>
                      <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                        Nuevo evento
                      </Text>
                    </Pressable>
                  )}
                </View>
                {g.eventos.length === 0 ? (
                  <Text testID={`agenda-grupo-${g.id}-vacio`} style={tenue}>
                    Nada por acá.
                  </Text>
                ) : esHoy && rejilla != null ? (
                  <>
                    {rejilla.sinHora.map((ev) => (
                      <View key={ev.id} testID={`agenda-evento-${ev.id}`} style={estiloLista(tema)}>
                        <FilaEvento hora="—" titulo={ev.titulo} detalle={`${franjaDeEvento(ev) ?? 'Sin hora'} · Google Calendar`} />
                      </View>
                    ))}
                    {rejilla.bloques.length > 0 && (
                      // `.cal`: tarjeta con las horas a la izquierda (44 px + 8) y los bloques a todo el ancho restante.
                      <View style={{ backgroundColor: tema.color.superficieAlta, borderRadius: 16, paddingTop: 26, paddingBottom: 18, paddingRight: tema.espacio.md, paddingLeft: 52 }}>
                        <View style={{ height: rejilla.alto }}>
                          {rejilla.horas.map((h, i) => (
                            <View key={h} pointerEvents="none" style={{ position: 'absolute', left: -52, right: 0, top: i * PX_POR_HORA }}>
                              <Text style={{ position: 'absolute', left: 0, width: 44, textAlign: 'right', top: -7, color: tema.color.textoTenue, fontSize: 11 }}>
                                {rotuloHora(h)}
                              </Text>
                              <View style={{ marginLeft: 52, height: 1, backgroundColor: tema.color.textoTenue, opacity: 0.22 }} />
                            </View>
                          ))}
                          {rejilla.bloques.map((b) => {
                            const ev = g.eventos.find((e) => e.id === b.id);
                            return (
                              <View
                                key={b.id}
                                testID={`agenda-evento-${b.id}`}
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  right: 0,
                                  top: b.top,
                                  height: b.alto - 2,
                                  borderRadius: 10,
                                  borderLeftWidth: 3,
                                  borderLeftColor: tema.color.acento,
                                  backgroundColor: tema.color.superficie,
                                  paddingHorizontal: 12,
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                }}
                              >
                                <Text numberOfLines={1} style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.chico }}>
                                  {b.titulo}
                                </Text>
                                {!b.corto && ev != null && (
                                  <Text numberOfLines={1} style={{ color: tema.color.textoTenue, fontSize: 11, marginTop: 2 }}>
                                    {`${franjaDeEvento(ev) ?? ''} · Google Calendar`}
                                  </Text>
                                )}
                              </View>
                            );
                          })}
                          {rejilla.ahoraTop != null && (
                            <View
                              testID="agenda-linea-ahora"
                              accessibilityLabel={`Ahora, ${ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
                              pointerEvents="none"
                              style={{ position: 'absolute', left: -14, right: 0, top: rejilla.ahoraTop - 1, height: 2, backgroundColor: tema.color.acento }}
                            >
                              <View style={{ position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: tema.color.acento }} />
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  // Mañana · Esta semana · Sin hora: `.lista` de filas hora | título + origen (prototipo 2528-2542).
                  <View style={estiloLista(tema)}>
                    {g.eventos.map((ev, i) => (
                      <View
                        key={ev.id}
                        testID={`agenda-evento-${ev.id}`}
                        style={i > 0 ? { borderTopWidth: 1, borderTopColor: tema.color.fondo } : undefined}
                      >
                        <FilaEvento
                          hora={columnaHora(g.id, ev)}
                          titulo={ev.titulo}
                          detalle={`${ev.diaCompleto ? 'Todo el día' : g.id === 'semana' ? (horaDeEvento(ev.inicioCrudo) ?? '') : ''}${ev.diaCompleto || (g.id === 'semana' && horaDeEvento(ev.inicioCrudo) != null) ? ' · ' : ''}Google Calendar`}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
      </ScrollFormulario>
    </MarcoGlass>
  );
}
