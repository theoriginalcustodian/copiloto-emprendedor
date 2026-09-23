import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import {
  TEXTO_NUEVO_EVENTO,
  estadoDeServicio,
  franjaDeEvento,
  KEY_GOOGLE_CALENDAR,
  leerAgenda,
  listarCatalogo,
  rangoAgenda,
  type AgendaMiDia,
  type EstadoConexion,
} from '@copiloto/core';

import { dejarPendiente } from '../chat/mensajePendiente';
import { FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';

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

  return (
    <MarcoGlass titulo="Agenda" icono="miDia" testID="pantalla-agenda">
      <ScrollFormulario
        testID="agenda-contenido"
        contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.lg, paddingBottom: 120 }}
      >
        <FilaBotones
          testID="agenda-acciones"
          botones={[{ etiqueta: 'Nuevo evento', onPress: nuevoEvento, variante: 'primario', testID: 'agenda-nuevo-evento' }]}
        />

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
          agenda.grupos.map((g) => (
            <View key={g.id} testID={`agenda-grupo-${g.id}`} style={{ gap: tema.espacio.sm }}>
              <Text
                accessibilityRole="header"
                style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}
              >
                {g.titulo}
              </Text>
              {g.eventos.length === 0 ? (
                <Text testID={`agenda-grupo-${g.id}-vacio`} style={tenue}>
                  Nada por acá.
                </Text>
              ) : (
                g.eventos.map((ev) => {
                  const franja = franjaDeEvento(ev);
                  return (
                    <View
                      key={ev.id}
                      testID={`agenda-evento-${ev.id}`}
                      style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline' }}
                    >
                      {franja != null && (
                        <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                          {franja}
                        </Text>
                      )}
                      <Text style={{ color: tema.color.texto, fontSize: tema.tipo.chico, flexShrink: 1 }}>{ev.titulo}</Text>
                    </View>
                  );
                })
              )}
            </View>
          ))}
      </ScrollFormulario>
    </MarcoGlass>
  );
}
