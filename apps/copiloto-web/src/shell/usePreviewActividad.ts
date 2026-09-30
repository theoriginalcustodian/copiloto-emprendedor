import { useEffect, useRef, useState } from 'react';

import { listarActividad, type ActividadItem } from '@copiloto/core';

/** Preview, no la pantalla completa (`ActividadScreen`/`RecientesScreen` sí pagan por todo el feed). */
const LIMITE_PREVIEW = 5;

/**
 * ESCRACT — el fetch que el docstring de `EscritorioScreen` reserva para "quien lo monte". Vive
 * ACÁ, no en `EscritorioScreen` (que se mantiene puro, sin red), y lo comparten `AppShell` y
 * `DesktopShell` para no duplicar el mismo fetch en los dos shells (el defecto de la implementación
 * gemela que este repo ya pagó una vez).
 *
 * Lazy por `activo`: no pide nada hasta que el llamador entra por primera vez a Escritorio — una
 * sesión que nunca visita esa pantalla no gasta el request. Una vez traído, el resultado queda
 * cacheado en este hook (vive en el shell, que no desmonta al cambiar de tab) y no se vuelve a
 * pedir en visitas siguientes: es un preview, no necesita "Actualizar".
 *
 * Un fetch fallido o `no_disponible` deja `actividad` en `[]` — el mismo estado que "todavía no hay
 * movimientos" — nunca tumba el Escritorio ni bloquea su primer paint (el fetch corre en un efecto,
 * después del render inicial de la pantalla).
 */
export function usePreviewActividad(activo: boolean) {
  const [actividad, setActividad] = useState<readonly ActividadItem[]>([]);
  const [cargandoActividad, setCargandoActividad] = useState(false);
  const pedido = useRef(false);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  useEffect(() => {
    if (!activo || pedido.current) return;
    pedido.current = true;
    setCargandoActividad(true);
    listarActividad({ limit: LIMITE_PREVIEW })
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'ok') setActividad(res.items);
      })
      .catch(() => {
        // Degradación silenciosa, igual que `ActividadScreen`/`RecientesScreen`: el preview se queda
        // vacío en vez de tumbar el Escritorio.
      })
      .finally(() => {
        if (vivo.current) setCargandoActividad(false);
      });
  }, [activo]);

  return { actividad, cargandoActividad };
}
