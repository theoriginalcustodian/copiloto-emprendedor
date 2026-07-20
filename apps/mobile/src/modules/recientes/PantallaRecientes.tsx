import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { listarActividad, type ActividadItem } from '@copiloto/core';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';

/** Debounce de búsqueda (ms) -- evita 1 request por tecla. */
const SEARCH_DEBOUNCE_MS = 300;

/** Tamaño de página -- mismo default que el cliente (`listarActividad`, `packages/core`). */
const LIMITE_PAGINA = 20;

/**
 * Estado de la ÚLTIMA búsqueda/carga resuelta. Es DISTINTO de "cuántos items hay": una búsqueda puede
 * resolver en `'ok'` con 0 resultados (sin-resultados-para-esa-búsqueda), y eso no es lo mismo que el
 * endpoint todavía no exista (`'no_disponible'`) ni que algo se haya roto de verdad (`'error'`). Son
 * los 4 estados operativos (sumando vacío-de-verdad, que sale de `'ok'` + 0 items + sin query) y el
 * render de abajo los mantiene mutuamente excluyentes -- ninguno se disfraza de otro.
 */
type Estado = 'cargando' | 'ok' | 'error' | 'no_disponible';

/**
 * Fecha + hora en formato local -- puede haber varias entradas de CLIENTES distintos el mismo día: sin
 * la hora, dos filas seguidas son indistinguibles. `created_at` ya viene con timezone del backend;
 * `Date` se usa sólo para FORMATEAR, nunca para decidir orden (eso lo garantiza el backend).
 */
function formatFecha(iso: string): string {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} ${hora}`;
}

/**
 * "Recientes" — la actividad de negocio que el emprendedor ya CONFIRMÓ, cross-cliente: exactamente
 * las entradas firmadas, en el orden que manda el backend (`created_at DESC` — esta pantalla NUNCA
 * reordena lo que recibe: reordenar acá sería duplicar una regla que sólo tiene que vivir en un lado).
 * Con barra de búsqueda por nombre de cliente / tipo de operación (con debounce) y paginación por
 * cursor. Ejemplos de lo que puede aparecer acá: "Presupuesto Acme SA · Documento", "Resumen de
 * ventas julio · Reporte", "Factura #1042 · Emitida".
 *
 * 🔴 El endpoint puede no estar desplegado todavía -- `listarActividad` normaliza ese caso (404/501) a
 * `{status:'no_disponible'}`, y ACÁ se muestra como un estado propio, nunca como una lista vacía: una
 * lista vacía en un registro de actividad dice "no hiciste nada", y esa sería una mentira por ausencia
 * del feature, no por ausencia real de actividad. La pantalla tiene que renderizar bien SIN backend
 * (dev-client sin sesión todavía): estado de carga, estado vacío con mensaje útil, y estado de error
 * que no sea una pantalla en blanco -- son justamente los 4 estados de `Estado`, arriba.
 *
 * Es de SÓLO LECTURA -- no hay ninguna acción que "termine" la pantalla: se cierra con el
 * gesto/"Volver" que ya trae `MarcoGlass`, nunca sola.
 */
export function PantallaRecientes() {
  const tema = useTema();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ActividadItem[]>([]);
  const [estado, setEstado] = useState<Estado>('cargando');
  const [truncado, setTruncado] = useState(false);
  const [cursorSiguiente, setCursorSiguiente] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  // Identifica la búsqueda VIGENTE -- una respuesta (de la primera página o de "cargar más") que
  // llega tarde, después de que el usuario ya tipeó otra cosa, NO puede pisar el estado de la búsqueda
  // nueva. Hace falta también dentro de `cargarMas`, que no vive en el `useEffect` del debounce.
  const consultaId = useRef(0);
  // 🔴 Guard de UNMOUNT, separado de `consultaId`: un `cargarMas` en vuelo cuyo `miId` sigue
  // coincidiendo (nadie tipeó nada nuevo) puede de todas formas resolver DESPUÉS de que la pantalla ya
  // se cerró (el usuario tocó "Volver" a mitad del fetch) -- `consultaId.current` no cambia solo al
  // desmontar, así que por sí solo no alcanza para detectar ese caso. Sin este guard, RN tira "no se
  // puede actualizar el estado de un componente desmontado" y, en un escenario más raro, una página
  // vieja podría terminar escribiendo sobre el estado de una instancia nueva de esta misma pantalla.
  const vivo = useRef(true);
  useEffect(
    () => () => {
      vivo.current = false;
    },
    [],
  );

  // Cada cambio de `query` dispara una búsqueda DESDE CERO (cursor null) tras el debounce -- una
  // búsqueda nueva nunca es "página 2 de la anterior".
  useEffect(() => {
    const miId = ++consultaId.current;
    setEstado('cargando');
    const timer = setTimeout(() => {
      listarActividad({ q: query, cursor: null, limit: LIMITE_PAGINA })
        .then((res) => {
          if (!vivo.current || miId !== consultaId.current) return;
          if (res.status === 'no_disponible') {
            setEstado('no_disponible');
            setItems([]);
            setCursorSiguiente(null);
            setTruncado(false);
            return;
          }
          setItems(res.items);
          setCursorSiguiente(res.cursorSiguiente);
          setTruncado(res.truncado);
          setEstado('ok');
        })
        .catch(() => {
          if (!vivo.current || miId !== consultaId.current) return;
          setEstado('error');
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const cargarMas = useCallback(() => {
    // Sólo pedir más si la última página resolvió bien Y dijo que hay una siguiente -- sin esto, un
    // `onEndReached` durante `'cargando'`/`'error'`/`'no_disponible'` pediría una página de un cursor
    // que no corresponde a la búsqueda vigente.
    if (estado !== 'ok' || cargandoMas || !cursorSiguiente) return;
    const miId = consultaId.current;
    setCargandoMas(true);
    listarActividad({ q: query, cursor: cursorSiguiente, limit: LIMITE_PAGINA })
      .then((res) => {
        if (!vivo.current || miId !== consultaId.current) return; // desmontada, o la búsqueda cambió mientras esta página viajaba
        if (res.status === 'no_disponible') {
          // Degradación conservadora: si el endpoint deja de responder a mitad de scroll, se deja de
          // pedir más -- el usuario se queda con lo que ya cargó, nunca con un error a mitad de lista.
          setCursorSiguiente(null);
          return;
        }
        setItems((prev) => [...prev, ...res.items]);
        setCursorSiguiente(res.cursorSiguiente);
        setTruncado((prev) => prev || res.truncado);
      })
      .catch(() => {
        // No rompe la pantalla -- el usuario conserva lo ya cargado; volver a bajar reintenta.
      })
      .finally(() => {
        if (vivo.current && miId === consultaId.current) setCargandoMas(false);
      });
  }, [estado, cargandoMas, cursorSiguiente, query]);

  const hayQuery = query.trim().length > 0;

  return (
    <MarcoGlass titulo="Recientes" icono="clock" testID="pantalla-recientes">
      <View style={[styles.contenedor, { padding: tema.espacio.md, gap: tema.espacio.md }]}>
        <TextInput
          testID="pantalla-recientes-buscar"
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por cliente u operación…"
          placeholderTextColor={tema.color.textoTenue}
          style={[
            styles.buscador,
            {
              color: tema.color.texto,
              borderColor: tema.color.borde,
              backgroundColor: tema.color.superficie,
              borderRadius: tema.radio.md,
              padding: tema.espacio.sm,
              fontSize: tema.tipo.base,
            },
          ]}
        />

        {/* "sin límite implícito que oculte resultados; si se corta, la respuesta dice que se
            cortó". Se ata a `estado==='ok'` para no mostrar un aviso de una búsqueda vieja mientras
            la nueva todavía está `'cargando'`. */}
        {estado === 'ok' && truncado && (
          <View
            testID="pantalla-recientes-truncado"
            style={[
              styles.aviso,
              {
                backgroundColor: tema.color.superficieAlta,
                borderRadius: tema.radio.sm,
                borderLeftColor: tema.color.peligro,
                padding: tema.espacio.sm,
              },
            ]}
          >
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.chico }}>
              Esta lista se cortó antes de llegar al final. Puede haber más actividad que todavía no se
              muestra.
            </Text>
          </View>
        )}

        {estado === 'cargando' && (
          <ActivityIndicator testID="pantalla-recientes-cargando" color={tema.color.acento} />
        )}

        {estado === 'error' && (
          <Text testID="pantalla-recientes-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar la actividad. Probá de nuevo.
          </Text>
        )}

        {estado === 'no_disponible' && (
          <Text
            testID="pantalla-recientes-no-disponible"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}
          >
            La actividad todavía no está disponible.
          </Text>
        )}

        {estado === 'ok' && items.length === 0 && !hayQuery && (
          <Text testID="pantalla-recientes-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
            Todavía no hay actividad -- acá vas a ver los documentos, notas y acciones que confirmes.
          </Text>
        )}

        {estado === 'ok' && items.length === 0 && hayQuery && (
          <Text
            testID="pantalla-recientes-sin-resultados"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}
          >
            No encontramos actividad para esa búsqueda.
          </Text>
        )}

        {estado === 'ok' && items.length > 0 && (
          <FlatList
            testID="pantalla-recientes-lista"
            data={items}
            keyExtractor={(item) => item.entrada_id}
            onEndReachedThreshold={0.4}
            onEndReached={cargarMas}
            ListFooterComponent={
              cargandoMas ? (
                <ActivityIndicator testID="pantalla-recientes-cargando-mas" color={tema.color.acento} />
              ) : null
            }
            renderItem={({ item }) => (
              <View
                testID={`reciente-row-${item.entrada_id}`}
                style={[
                  styles.fila,
                  {
                    borderColor: tema.color.borde,
                    borderRadius: tema.radio.md,
                    padding: tema.espacio.sm,
                    marginBottom: tema.espacio.xs,
                  },
                ]}
              >
                <View style={styles.filaEncabezado}>
                  <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontWeight: '600' }}>
                    {item.cliente_nombre}
                  </Text>
                  <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                    {formatFecha(item.created_at)}
                  </Text>
                </View>
                <Text style={{ color: tema.color.acento, fontSize: tema.tipo.chico, fontWeight: '600' }}>
                  {item.tipo_operacion}
                </Text>
                <Text numberOfLines={2} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                  {item.extracto}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  buscador: { borderWidth: 1 },
  aviso: { borderLeftWidth: 3 },
  fila: { borderWidth: 1, gap: 2 },
  filaEncabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
