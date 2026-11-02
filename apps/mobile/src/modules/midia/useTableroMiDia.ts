import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { borrarTarjetaMiDia, leerTablero, type TableroMiDia } from '@copiloto/core';

export type EstadoLista = 'cargando' | 'ok' | 'no_disponible';

/**
 * El tablero del detector, para Mi día y Tu día. Se relee al recuperar el foco, no sólo al montar: una
 * tarjeta puede morir por una acción hecha en otra pantalla. Si algo falla degrada a `no_disponible`, que
 * cada pantalla DICE: nunca simula tarjetas.
 */
export function useTableroMiDia() {
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [tablero, setTablero] = useState<TableroMiDia | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const res = await leerTablero();
      if (!vivo.current) return;
      if (res.status === 'ok') {
        setTablero(res.tablero);
        setEstado('ok');
        return;
      }
      setEstado('no_disponible');
    } catch {
      if (vivo.current) setEstado('no_disponible');
    }
  }, []);

  // Las dos pantallas borran: la tarjeta anotada lleva «Borrar» a la vista en Mi día y en Tu día, y en Tu día
  // además por swipe. Se relee el tablero: la tarjeta se va porque el backend confirmó, no porque se asumió.
  const borrar = useCallback(
    async (id: string) => {
      const res = await borrarTarjetaMiDia(id);
      if (res.status === 'ok') {
        void cargar();
        return;
      }
      Alert.alert('No se pudo borrar la tarjeta', 'Probá de nuevo en un momento.');
    },
    [cargar],
  );

  useFocusEffect(
    useCallback(() => {
      vivo.current = true;
      void cargar();
      return () => {
        vivo.current = false;
      };
    }, [cargar]),
  );

  return { estado, tablero, cargar, borrar };
}
