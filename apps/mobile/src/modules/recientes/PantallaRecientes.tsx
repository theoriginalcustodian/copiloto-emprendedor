import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listarActividad, type ActividadItem } from '@copiloto/core';

import { FilaActividad } from '../actividad/FilaActividad';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';

/**
 * "Recientes" — **toda** la actividad del emprendedor, con scroll infinito.
 *
 * ⚠️ **Reescrita entera el 2026-07-22.** La versión anterior consumía el contrato "entradas firmadas"
 * del proyecto clínico (`entrada_id`, `cliente_nombre`, `tipo_operacion`, `extracto`) y tenía barra de
 * búsqueda con debounce. Ese contrato no existía en este producto; el nuevo cruza las tablas de
 * negocio (facturas, presupuestos, gastos, clientes).
 *
 * 🔴 **La paginación va por CURSOR, y el cursor es un token OPACO**: no se parsea, no se construye, no
 * se recorta — se devuelve tal cual vino. Y no es offset por una razón concreta: entre que el usuario
 * ve la página 1 y pide la 2, **el emprendedor puede haber cargado un gasto**; con offset todo se
 * corre una posición y se **saltea o repite** un ítem sin que nadie lo note. Es una lista que se lee
 * hacia abajo mientras crece por arriba — el caso donde offset siempre falla.
 *
 * 🔴 **Tres disparadores de recarga, y acá el tirón SÍ va** — a diferencia de la pantalla principal,
 * que es la capa de fondo de un panel gestual y no puede tener un gesto vertical propio. El tirón es
 * el único que cubre lo que cambió **afuera**: otro dispositivo, o el copiloto registrando por voz.
 *
 * 🔴 **La barra de búsqueda se sacó.** El contrato acepta `?q=` pero **hoy no filtra nada** (§11), y
 * una barra que no filtra es peor que ninguna: el usuario escribe, ve la misma lista, y concluye que
 * no hay resultados. Vuelve cuando el backend la implemente de verdad.
 */

type Estado = 'cargando' | 'ok' | 'error' | 'no_disponible';

/** Igual al default del backend; explícito para que el número viva en un solo lado visible. */
const LIMITE_PAGINA = 20;

export function PantallaRecientes() {
  const tema = useTema();
  const [items, setItems] = useState<ActividadItem[]>([]);
  const [estado, setEstado] = useState<Estado>('cargando');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  /**
   * Guard de UNMOUNT: una página en vuelo puede resolver **después** de que la pantalla se cerró (el
   * usuario tocó "Volver" a mitad del fetch). Sin esto, RN avisa que se actualizó el estado de un
   * componente desmontado y, en el caso raro, una página vieja escribe sobre una instancia nueva.
   */
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const cargarPrimera = useCallback((silencioso = false): Promise<void> => {
    if (!silencioso) setEstado('cargando');
    return listarActividad({ limit: LIMITE_PAGINA })
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'no_disponible') {
          setEstado('no_disponible');
          setItems([]);
          setCursor(null);
          return;
        }
        setItems(res.items);
        setCursor(res.cursor);
        setEstado('ok');
      })
      .catch(() => {
        if (vivo.current) setEstado('error');
      });
  }, []);

  useEffect(() => {
    void cargarPrimera();
  }, [cargarPrimera]);

  async function tirarParaRefrescar() {
    setRefrescando(true);
    await cargarPrimera(true);
    if (vivo.current) setRefrescando(false);
  }

  /**
   * La página siguiente. **Se corta con `cursor === null`**, que es lo que el backend usa para decir
   * "no hay más" — y viaja siempre. No se deduce del largo de la página: una página corta **no**
   * significa el final.
   */
  function cargarMas() {
    if (cursor == null || cargandoMas || estado !== 'ok') return;
    setCargandoMas(true);
    void listarActividad({ limit: LIMITE_PAGINA, cursor })
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'ok') {
          // Se concatena y se pisa el cursor. Si el backend repitiera un id, se vería duplicado en
          // pantalla — visible y reportable, que es mejor que deduplicar acá y esconder un bug de la
          // paginación de la que depende toda la lista.
          setItems((previos) => [...previos, ...res.items]);
          setCursor(res.cursor);
        }
        setCargandoMas(false);
      })
      .catch(() => {
        if (vivo.current) setCargandoMas(false);
      });
  }

  return (
    <MarcoGlass titulo="Recientes" icono="clock" testID="pantalla-recientes">
      {estado === 'cargando' && (
        <View style={styles.centro}>
          <ActivityIndicator testID="recientes-cargando" color={tema.color.acento} />
        </View>
      )}

      {estado === 'error' && (
        <View style={styles.centro}>
          <Text testID="recientes-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar tu actividad. Tirá hacia abajo para reintentar.
          </Text>
        </View>
      )}

      {estado === 'no_disponible' && (
        <View style={styles.centro}>
          <Text
            testID="recientes-no-disponible"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
          >
            Tu actividad todavía no está disponible en tu copiloto.
          </Text>
        </View>
      )}

      {estado === 'ok' && (
        <FlatList
          testID="recientes-lista"
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FilaActividad item={item} />}
          contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.sm, paddingBottom: 120 }}
          onEndReached={cargarMas}
          // 0.5 y no 0.1: en un teléfono lento, pedir recién al borde deja al usuario mirando el
          // final de la lista mientras llega la página. Media pantalla antes es imperceptible.
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => void tirarParaRefrescar()}
              tintColor={tema.color.acento}
              colors={[tema.color.acento]}
              testID="recientes-refresh"
            />
          }
          ListEmptyComponent={
            <Text
              testID="recientes-vacio"
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}
            >
              Todavía no hay movimientos. Lo que factures, presupuestes o gastes va a aparecer acá.
            </Text>
          }
          ListFooterComponent={
            cargandoMas ? (
              <ActivityIndicator testID="recientes-cargando-mas" color={tema.color.acento} />
            ) : null
          }
        />
      )}
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
