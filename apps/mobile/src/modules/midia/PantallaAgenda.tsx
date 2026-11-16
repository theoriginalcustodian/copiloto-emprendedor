import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  TEXTO_NUEVO_EVENTO,
  estadoDeServicio,
  instanteDeEvento,
  KEY_GOOGLE_CALENDAR,
  leerAgenda,
  leerVencimientos,
  listarCatalogo,
  plazoVencimiento,
  rangoAgenda,
  type AgendaMiDia,
  type EstadoConexion,
  type EventoAgenda,
  type Vencimiento,
} from '@copiloto/core';

import { dejarPendiente } from '../chat/mensajePendiente';
import { elevacion } from '../../theme/BloqueCifra';
import { BotonAcceso } from '../../theme/BotonAcceso';
import { FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';
import { FilaAgenda } from './FilaAgenda';
import { cuandoEs, horaCorta, yaPaso } from './tiempoEvento';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** `martes 18` (prototipo: `Hoy martes 18`, `Mañana miércoles 19`). */
const fechaCorta = (d: Date): string => `${DIAS[d.getDay()]} ${d.getDate()}`;

const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

/** «mar» + «17»: el día de un evento de «Esta semana». `null` si no se puede leer la fecha (no se inventa). */
function diaCorto(ev: EventoAgenda): { dia: string; numero: string } | null {
  if (typeof ev.inicioCrudo !== 'string') return null;
  // Un evento de todo el día llega como `YYYY-MM-DD`: leído como fecha local, no UTC, para no correrlo un día.
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ev.inicioCrudo);
  const d = soloFecha != null ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3])) : new Date(ev.inicioCrudo);
  return Number.isNaN(d.getTime()) ? null : { dia: DIAS_CORTOS[d.getDay()] ?? '', numero: String(d.getDate()) };
}

/** Junta lo que haya con « · »: sin ubicación (o sin hora) no queda un separador colgando. */
const unir = (...partes: (string | null | undefined)[]): string | null => {
  const hay = partes.filter((p): p is string => p != null && p !== '');
  return hay.length > 0 ? hay.join(' · ') : null;
};

/** Marca y detalle de una fila según su grupo. La fuente («Google Calendar») ya la dice la línea de estado. */
function filaDe(
  grupo: string,
  ev: EventoAgenda,
  ahora: number,
): { marca: string | null; marcaSobre?: string; detalle: string | null; apagada: boolean } {
  const hora = ev.diaCompleto ? null : horaCorta(ev.inicioCrudo);
  if (grupo === 'hoy') {
    const instante = ev.diaCompleto ? null : instanteDeEvento(ev.inicioCrudo);
    return {
      marca: hora ?? 'Hoy',
      detalle: unir(instante != null ? cuandoEs(instante, ahora) : 'Todo el día', ev.ubicacion),
      apagada: !ev.diaCompleto && yaPaso(ev.inicioCrudo, ahora),
    };
  }
  if (grupo === 'semana') {
    const dia = diaCorto(ev);
    return { marca: dia?.numero ?? '—', marcaSobre: dia?.dia, detalle: unir(hora ?? (ev.diaCompleto ? 'Todo el día' : null), ev.ubicacion), apagada: false };
  }
  if (grupo === 'sin_hora') return { marca: null, detalle: unir(ev.diaCompleto ? 'Todo el día' : null, ev.ubicacion), apagada: false };
  return { marca: hora ?? '—', detalle: unir(ev.diaCompleto ? 'Todo el día' : null, ev.ubicacion), apagada: false };
}

/** El rótulo de un grupo, como las secciones de Mi día: nombre en la tipografía de marca y su dato al lado. */
function Encabezado({ titulo, dato, diaDeHoy }: { titulo: string; dato?: string | null; diaDeHoy?: number }) {
  const tema = useTema();
  return (
    <View style={estilos.encabezado}>
      <Text accessibilityRole="header" style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}>
        {titulo}
      </Text>
      {dato != null && <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{dato}</Text>}
      {/* El día de hoy en su círculo lleno, la marca de «hoy» de Google Calendar; acá en la tinta de Odobi. */}
      {diaDeHoy != null && (
        <View testID="agenda-dia-hoy" style={[estilos.diaHoy, { backgroundColor: tema.color.texto }]}>
          <Text style={{ color: tema.color.fondo, fontFamily: tema.fuente.display, fontSize: tema.tipo.chico }}>{diaDeHoy}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * La línea del ahora de Google Calendar: un punto y una raya que cruzan la lista de hoy justo donde va la hora
 * actual, entre lo que ya pasó y lo que viene. Ocupa el lugar del divisor de esa fila.
 */
function LineaAhora({ hora }: { hora: string }) {
  const tema = useTema();
  return (
    <View testID="agenda-linea-ahora" accessibilityLabel={`Ahora, ${hora}`} style={estilos.lineaAhora}>
      <View style={[estilos.puntoAhora, { backgroundColor: tema.color.acento }]} />
      <View style={[estilos.rayaAhora, { backgroundColor: tema.color.acento }]} />
    </View>
  );
}

/**
 * Antes de qué evento de hoy cae la línea del ahora: el primero con hora que todavía no pasó. Si ya pasaron
 * todos, va al final (`eventos.length`). Sin ningún evento con hora no hay dónde ubicarla: `null`.
 */
export function posicionAhora(eventos: readonly EventoAgenda[], ahora: number): number | null {
  const conHora = eventos.map((ev, i) => ({ i, ev })).filter(({ ev }) => !ev.diaCompleto && instanteDeEvento(ev.inicioCrudo) != null);
  if (conHora.length === 0) return null;
  const proximo = conHora.find(({ ev }) => !yaPaso(ev.inicioCrudo, ahora));
  return proximo != null ? proximo.i : eventos.length;
}

/** La tarjeta blanca que agrupa las filas de un grupo. */
function Tarjeta({ children }: { children: ReactNode }) {
  const tema = useTema();
  return <View style={[estilos.tarjeta, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>{children}</View>;
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
  // SM-P20 punto 2: «Vencen esta semana» (CAE, certificado de ARCA). Carga propia: si cae, la Agenda sigue.
  const [vencimientos, setVencimientos] = useState<readonly Vencimiento[] | null>(null);
  const vivo = useRef(true);

  const cargarVencimientos = useCallback(async () => {
    try {
      const res = await leerVencimientos();
      if (!vivo.current) return;
      setVencimientos(res.status === 'ok' ? res.vencimientos : null);
    } catch {
      /* fail-soft: sin vencimientos la sección no se muestra. */
    }
  }, []);

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
    void cargarVencimientos();
    return () => {
      vivo.current = false;
    };
  }, [cargar, cargarSaludConexiones, cargarVencimientos]);

  function nuevoEvento() {
    dejarPendiente(TEXTO_NUEVO_EVENTO);
    router.back();
  }

  const tenue = { color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 } as const;
  // La hora se lee al renderizar: la pantalla se recarga al entrar, no necesita reloj propio.
  const ahora = new Date();
  const conectada = estado === 'ok' && agenda != null && agenda.conectado;
  const horaAhora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

  return (
    <MarcoGlass titulo="Agenda" icono="miDia" sinIcono testID="pantalla-agenda">
      <ScrollFormulario testID="agenda-contenido" contentContainerStyle={estilos.contenido}>
        {/* Rediseño (Martin 15/11): el mismo lenguaje de Mi día. Cada grupo es un rótulo y UNA tarjeta blanca de
            filas —marca en negrita, título, detalle—, con 32 entre grupos. «Hoy» dejó de ser una rejilla por
            horas: en el celular la lista se lee de un vistazo y dice lo que importa, cuánto falta. */}
        <View style={estilos.cabeza}>
          <Text testID="agenda-intro" style={tenue}>
            Tus eventos y lo que vence, en la misma línea.
          </Text>
          {conectada && (
            // SM-N34: punto + texto. El punto es decorativo (el estado lo dice el texto, WCAG 1.4.1).
            <View style={estilos.estado}>
              <View
                testID="agenda-estado-punto"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[estilos.punto, { backgroundColor: tema.color.acento }]}
              />
              <Text testID="agenda-estado" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiSemibold }}>
                Google Calendar conectada
              </Text>
            </View>
          )}
        </View>

        {/* Agendar va arriba y parejo con las otras vías de alta que no son la voz (ver `BotonAcceso`). */}
        {conectada && (
          <BotonAcceso
            testID="agenda-nuevo-evento"
            accessibilityLabel="Nuevo evento"
            icono={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tema.color.acentoTinta} strokeWidth={2} strokeLinecap="round">
                <Path d="M12 5v14M5 12h14" />
              </Svg>
            }
            etiqueta="Nuevo evento"
            onPress={nuevoEvento}
          />
        )}

        {estado === 'cargando' && <ActivityIndicator testID="agenda-cargando" color={tema.color.acento} />}

        {estado === 'no_disponible' && (
          <View style={{ gap: tema.espacio.md }} testID="agenda-no-disponible">
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

        {conectada &&
          agenda.grupos.map((g) => {
            // `Hoy domingo 15` / `Mañana lunes 16`; los otros grupos llevan su cuenta.
            const dato =
              g.id === 'hoy' ? (DIAS[ahora.getDay()] ?? null) : g.id === 'manana' ? fechaCorta(new Date(ahora.getTime() + 86_400_000)) : g.eventos.length > 0 ? String(g.eventos.length) : null;
            const lineaEn = g.id === 'hoy' ? posicionAhora(g.eventos, ahora.getTime()) : null;
            return (
              <View key={g.id} testID={`agenda-grupo-${g.id}`} style={estilos.grupo}>
                <Encabezado titulo={g.titulo} dato={dato} diaDeHoy={g.id === 'hoy' ? ahora.getDate() : undefined} />
                {g.eventos.length === 0 ? (
                  <Text testID={`agenda-grupo-${g.id}-vacio`} style={[tenue, estilos.vacio]}>
                    {g.id === 'hoy' ? 'Nada agendado para hoy.' : 'Nada por acá.'}
                  </Text>
                ) : (
                  <Tarjeta>
                    {g.eventos.map((ev, i) => {
                      const f = filaDe(g.id, ev, ahora.getTime());
                      const ahoraAca = lineaEn === i;
                      return (
                        <View key={ev.id}>
                          {ahoraAca && <LineaAhora hora={horaAhora} />}
                          <FilaAgenda
                            testID={`agenda-evento-${ev.id}`}
                            marca={f.marca}
                            marcaSobre={f.marcaSobre}
                            titulo={ev.titulo}
                            detalle={f.detalle}
                            apagada={f.apagada}
                            // La línea del ahora ya separa: esa fila no lleva además su divisor.
                            conDivisor={i > 0 && !ahoraAca}
                          />
                        </View>
                      );
                    })}
                    {lineaEn === g.eventos.length && <LineaAhora hora={horaAhora} />}
                  </Tarjeta>
                )}
              </View>
            );
          })}

        {/* SM-P20 punto 2: obligaciones del NEGOCIO que vencen (CAE, certificado de ARCA), no eventos de
            Calendar: va aparte y NO depende de que Calendar esté conectada. Lo vencido sale primero (el
            backend ya ordena) y se marca; un certificado ilegible se dice, no se esconde. Sin vencimientos
            o con el endpoint caído la sección no se muestra (ausente ≠ «todo en orden» inventado). */}
        {vencimientos != null && vencimientos.length > 0 && (
          <View testID="agenda-vencimientos" style={estilos.grupo}>
            <Encabezado titulo="Vencen esta semana" dato={String(vencimientos.length)} />
            <Tarjeta>
              {vencimientos.map((v, i) => (
                <FilaAgenda
                  key={`${v.tipo}-${v.id}`}
                  testID={`agenda-vencimiento-${v.tipo}-${v.id}`}
                  marca={v.tipo === 'cae' ? 'CAE' : 'ARCA'}
                  titulo={v.titulo}
                  detalle={v.fecha != null ? `${plazoVencimiento(v)} · ${v.fecha}` : plazoVencimiento(v)}
                  // Lo vencido o que vence hoy/mañana se dice en el color de la urgencia, como en «Para hoy».
                  colorDetalle={v.vencido || (v.dias != null && v.dias <= 1) ? tema.color.peligro : undefined}
                  conDivisor={i > 0}
                />
              ))}
            </Tarjeta>
          </View>
        )}
      </ScrollFormulario>
    </MarcoGlass>
  );
}

const estilos = StyleSheet.create({
  // 32 entre grupos: cada uno se lee como un bloque propio; 120 abajo para que el final pase el borde.
  contenido: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120, gap: 32 },
  cabeza: { gap: 10, paddingHorizontal: 4 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  grupo: { gap: 12 },
  encabezado: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
  // Las filas traen su aire vertical (16); la tarjeta sólo suma los lados.
  tarjeta: { borderRadius: 22, paddingHorizontal: 20 },
  vacio: { paddingHorizontal: 4 },
  diaHoy: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  // Sale 6 hacia la izquierda de la tarjeta para que el punto quede sobre el borde, como en Google Calendar.
  lineaAhora: { flexDirection: 'row', alignItems: 'center', marginLeft: -6, height: 10 },
  puntoAhora: { width: 10, height: 10, borderRadius: 5 },
  rayaAhora: { flex: 1, height: 2, marginLeft: -1 },
});
