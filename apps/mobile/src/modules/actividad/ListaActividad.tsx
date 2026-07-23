import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { type ActividadItem, type ActividadResult } from '@copiloto/core';

import { FilaActividad } from './FilaActividad';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `ListaActividad` — el feed de operaciones, con scroll infinito por cursor. **Un solo componente,
 * parametrizado por su FUENTE**: lo consume tanto "Recientes" (toda la actividad) como el listado de
 * cada función (`/actividad?funcion=X`) y el panel del swipe-left del principal. Todos muestran el
 * MISMO card (`FilaActividad`) sobre el MISMO endpoint — cambia sólo el query de la fuente.
 *
 * Nace de extraer la máquina de estados que vivía dentro de `PantallaRecientes`, para no clonar seis
 * copias divergentes (la divergencia entre glasses fue justo la causa del bug del minimizado). El
 * componente NO conoce `funcion`/`q` ni la ruta: recibe `fuente`, que ya sabe qué pedir.
 *
 * 🔴 **La paginación va por CURSOR opaco**, igual que antes: no se parsea, no se construye, no se
 * recorta. Y no es offset porque la lista se lee hacia abajo mientras crece por arriba (el emprendedor
 * carga un gasto entre página y página) — con offset se saltea o repite un ítem sin que nadie lo note.
 *
 * 🔴 **El final lo dice `cursor === null`, no el largo de la página.** Una página corta no es el final.
 */

type Estado = 'cargando' | 'ok' | 'error' | 'no_disponible';

/**
 * La fuente del feed: recibe `{limit, cursor}` y devuelve el resultado. Ya lleva incorporado
 * `funcion`/`q` (o nada, para Recientes). **DEBE ser estable** (referencia identitaria constante entre
 * renders — `useCallback` con las deps correctas, o la función-módulo tal cual): la carga inicial
 * depende de ella, así que una `fuente` inline nueva por render re-dispararía el fetch en loop.
 */
export type FuenteActividad = (
  params: { limit: number; cursor?: string | null },
) => Promise<ActividadResult>;

export interface ListaActividadProps {
  fuente: FuenteActividad;
  /**
   * Prefijo de los `testID` (`${base}-lista`, `-vacio`, `-cargando`, `-error`, `-no-disponible`,
   * `-refresh`, `-cargando-mas`). Cada lugar que monta la lista trae el suyo (`recientes`,
   * `recientes-gastos`, …) para que dos listas en la misma pantalla no colisionen.
   */
  testIDBase: string;
  /** Tocar una fila. Ausente = las filas no son tocables (ver `FilaActividad`). */
  onAbrirItem?: (item: ActividadItem) => void;
  /** El vacío HONESTO — nunca datos de nadie. Cada función pone el suyo ("Todavía no hay gastos"). */
  textoVacio?: string;
  textoNoDisponible?: string;
  textoError?: string;
  /** Igual al default del backend; explícito para que el número viva en un solo lado visible. */
  limitePagina?: number;
}

const LIMITE_PAGINA_DEFAULT = 20;

export function ListaActividad({
  fuente,
  testIDBase,
  onAbrirItem,
  textoVacio = 'Todavía no hay movimientos. Lo que hagas va a aparecer acá.',
  textoNoDisponible = 'Tu actividad todavía no está disponible en tu copiloto.',
  textoError = 'No pudimos cargar tu actividad. Tirá hacia abajo para reintentar.',
  limitePagina = LIMITE_PAGINA_DEFAULT,
}: ListaActividadProps) {
  const tema = useTema();
  const [items, setItems] = useState<ActividadItem[]>([]);
  const [estado, setEstado] = useState<Estado>('cargando');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  /**
   * Guard de UNMOUNT: una página en vuelo puede resolver **después** de que la lista se cerró (el
   * usuario tocó "Volver" a mitad del fetch). Sin esto, RN avisa que se actualizó el estado de un
   * componente desmontado y, en el caso raro, una página vieja escribe sobre una instancia nueva.
   */
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const cargarPrimera = useCallback((silencioso = false): Promise<void> => {
    if (!silencioso) setEstado('cargando');
    return fuente({ limit: limitePagina })
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
  }, [fuente, limitePagina]);

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
   * "no hay más" — y viaja siempre. No se deduce del largo de la página.
   */
  function cargarMas() {
    if (cursor == null || cargandoMas || estado !== 'ok') return;
    setCargandoMas(true);
    void fuente({ limit: limitePagina, cursor })
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'ok') {
          // Se concatena y se pisa el cursor. Un id repetido se vería duplicado en pantalla —visible y
          // reportable, mejor que deduplicar acá y esconder un bug de la paginación de la que depende
          // toda la lista.
          setItems((previos) => [...previos, ...res.items]);
          setCursor(res.cursor);
        }
        setCargandoMas(false);
      })
      .catch(() => {
        if (vivo.current) setCargandoMas(false);
      });
  }

  if (estado === 'cargando') {
    return (
      <View style={styles.centro}>
        <ActivityIndicator testID={`${testIDBase}-cargando`} color={tema.color.acento} />
      </View>
    );
  }

  if (estado === 'error') {
    return (
      <View style={styles.centro}>
        <Text testID={`${testIDBase}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
          {textoError}
        </Text>
      </View>
    );
  }

  if (estado === 'no_disponible') {
    return (
      <View style={styles.centro}>
        <Text
          testID={`${testIDBase}-no-disponible`}
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
        >
          {textoNoDisponible}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      testID={`${testIDBase}-lista`}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <FilaActividad item={item} onPress={onAbrirItem} />}
      contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.sm, paddingBottom: 120 }}
      onEndReached={cargarMas}
      // 0.5 y no 0.1: en un teléfono lento, pedir recién al borde deja al usuario mirando el final de
      // la lista mientras llega la página. Media pantalla antes es imperceptible.
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={() => void tirarParaRefrescar()}
          tintColor={tema.color.acento}
          colors={[tema.color.acento]}
          testID={`${testIDBase}-refresh`}
        />
      }
      ListEmptyComponent={
        <Text testID={`${testIDBase}-vacio`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          {textoVacio}
        </Text>
      }
      ListFooterComponent={
        cargandoMas ? (
          <ActivityIndicator testID={`${testIDBase}-cargando-mas`} color={tema.color.acento} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
