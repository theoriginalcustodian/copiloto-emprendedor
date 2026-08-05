import { useCallback, useEffect, useRef, useState } from 'react';

import { leerCapacidades, type GuiaCapacidades } from '@copiloto/core';

import { Skeleton } from '../../design-system';
import './ajustes.css';

/**
 * `PantallaComoHablarle` — port de `apps/mobile/src/modules/ajustes/PantallaComoHablarle.tsx`. La
 * guía de uso: qué se le puede pedir al copiloto, con frases que funcionan.
 *
 * Los ejemplos NO están escritos acá: vienen de `GET /capacidades`, que publica una capacidad SÓLO
 * si su tool está viva. Si la guía no está disponible, se dice — no se inventa una lista (mismo
 * criterio que la versión mobile, ver su docstring para el porqué completo).
 */
type Estado = 'cargando' | 'ok' | 'no_disponible';

export function PantallaComoHablarle() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [guia, setGuia] = useState<GuiaCapacidades | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    const res = await leerCapacidades();
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setGuia(res.guia);
      setEstado('ok');
      return;
    }
    setEstado('no_disponible');
  }, []);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar]);

  // `capacidades` vacío NO es lo mismo que `no_disponible`: el endpoint contestó y dice que hoy no
  // hay ninguna tool viva.
  const sinCapacidades = estado === 'ok' && (guia?.capacidades.length ?? 0) === 0;

  return (
    <div className="como-hablarle-screen" data-testid="pantalla-como-hablarle">
      <h1 className="como-hablarle-screen__title">Cómo hablarle</h1>

      {estado === 'cargando' && (
        <div className="como-hablarle-screen__loading" data-testid="como-hablarle-cargando">
          <Skeleton height={56} radius={12} />
          <Skeleton height={56} radius={12} />
          <Skeleton height={56} radius={12} />
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="como-hablarle-screen__no-disponible" data-testid="como-hablarle-no-disponible">
          No pudimos traer la guía ahora. Igual podés escribirle a tu copiloto como le hablarías a
          alguien que te ayuda.
        </p>
      )}

      {estado === 'ok' && guia != null && (
        <div className="como-hablarle-screen__lista" data-testid="como-hablarle-lista">
          <p className="como-hablarle-screen__intro">
            Hablale como le hablarías a alguien que te ayuda. Estos son ejemplos, no fórmulas: si te
            falta un dato, te lo pide; si entendió mal, lo corregís en la tarjeta.
          </p>

          {sinCapacidades && (
            <p className="como-hablarle-screen__vacio" data-testid="como-hablarle-vacio">
              Tu copiloto todavía no tiene funciones habilitadas.
            </p>
          )}

          {guia.capacidades.map((c) => (
            <div key={c.tool} className="como-hablarle-bloque" data-testid={`como-hablarle-${c.tool}`}>
              <span className="como-hablarle-bloque__rotulo">{c.rotulo}</span>
              {c.ejemplos.map((e) => (
                <p key={e} className="como-hablarle-bloque__ejemplo">«{e}»</p>
              ))}
            </div>
          ))}

          {guia.fechas.entiendo.length > 0 && (
            <div className="como-hablarle-bloque" data-testid="como-hablarle-fechas">
              <span className="como-hablarle-bloque__rotulo">Fechas</span>
              <p className="como-hablarle-bloque__ejemplo">
                {guia.fechas.entiendo.map((f) => `«${f}»`).join(' · ')}
              </p>
              {guia.fechas.siNoEsta != null && (
                <p className="como-hablarle-bloque__aviso" data-testid="como-hablarle-fechas-si-no-esta">
                  {guia.fechas.siNoEsta}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
