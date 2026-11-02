/**
 * `useInicialCuenta` — qué letra lleva el avatar (SM-I5): la del nombre comercial del tenant, y si todavía no
 * cargó uno, la del mail con el que entró. Sin ninguno de los dos devuelve vacío y `AvatarCuenta` dibuja su
 * glifo: una letra inventada diría que la app conoce un nombre que no tiene.
 *
 * Se re-pide al recuperar el foco, porque el nombre se edita adentro de Ajustes y el avatar es lo primero que
 * se ve al volver. Es fail-soft: si el perfil no responde queda lo último que se supo de ESTE tenant.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { leerPerfilNegocio } from '@copiloto/core';

import { useSession } from '../auth/useSession';

export function inicialDeCuenta(nombreComercial: string, email: string | null | undefined): string {
  return (nombreComercial.trim() || (email ?? '').trim()).slice(0, 1).toUpperCase();
}

export function useInicialCuenta(): string {
  const { me } = useSession();
  const clienteId = me?.cliente_id;
  // 🔴 El nombre se guarda junto con su dueño: si cambia la sesión en el mismo proceso, el del tenant anterior
  // deja de valer en el acto, aunque la lectura del nuevo falle (regla 7).
  const [leido, setLeido] = useState<{ clienteId: string; nombre: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (clienteId == null) return undefined;
      let vigente = true;
      leerPerfilNegocio()
        .then((res) => {
          if (vigente && res.status === 'ok') setLeido({ clienteId, nombre: res.perfil?.nombreComercial ?? '' });
        })
        .catch(() => undefined);
      return () => {
        vigente = false;
      };
    }, [clienteId]),
  );

  return inicialDeCuenta(leido != null && leido.clienteId === clienteId ? leido.nombre : '', me?.email);
}
