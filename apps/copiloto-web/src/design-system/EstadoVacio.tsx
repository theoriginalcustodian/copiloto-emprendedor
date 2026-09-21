import { useEffect, useState } from 'react';

import {
  CLAVE_DIAS_CALMA,
  TAZA,
  VIEWBOX_TAZA,
  fechaLocalISO,
  mostrarExplicacion,
  parsearDiasVistos,
  registrarDiaVisto,
  type RolTaza,
} from '@copiloto/core';

import './EstadoVacio.css';

export interface EstadoVacioProps {
  titulo: string;
  /** La explicación. Se retira sola con el uso (Calma: N días DISTINTOS, ver `@copiloto/core`). */
  cuerpo?: string;
  /** `true` sólo en el vacío bueno de una pantalla entera («nada urgente»). Es opt-in. */
  ilustracion?: boolean;
  testId?: string;
}

/** El rol de cada trazo de la taza se resuelve contra el tema: la ilustración se adapta sola a la
 *  piel oscura en vez de quedar con un crema fijo sobre fondo negro. Cero hex. */
const COLOR_POR_ROL: Record<RolTaza, string> = {
  estructura: 'var(--text)',
  acento: 'var(--core)',
  lienzo: 'var(--bg)',
};

/**
 * `EstadoVacio` — el vacío con estructura: ilustración + título + cuerpo (BL-W5; port de
 * `apps/mobile/src/theme/EstadoVacio.tsx`, misma regla y misma N vía `@copiloto/core`).
 *
 * 🔴 La taza va SÓLO en el vacío bueno de una pantalla entera. En el vacío de una sección
 * («todavía no vendiste») celebrar sería raro — por eso `ilustracion` es opt-in.
 *
 * ⚠️ Retiro progresivo: tras N días distintos con la pantalla vacía el cuerpo deja de mostrarse;
 * título, ilustración y salida no se tocan nunca. Sin `localStorage` (modo privado, bloqueado) la
 * explicación se muestra: el default menos malo es explicar de más.
 */
export function EstadoVacio({ titulo, cuerpo, ilustracion = false, testId }: EstadoVacioProps) {
  const [mostrarCuerpo, setMostrarCuerpo] = useState(true);

  useEffect(() => {
    if (cuerpo == null) return;
    try {
      const dias = parsearDiasVistos(window.localStorage.getItem(CLAVE_DIAS_CALMA));
      const conHoy = registrarDiaVisto(dias, fechaLocalISO(new Date()));
      if (conHoy !== dias) window.localStorage.setItem(CLAVE_DIAS_CALMA, JSON.stringify(conHoy));
      setMostrarCuerpo(mostrarExplicacion(conHoy));
    } catch {
      // Sin almacenamiento: se explica.
    }
  }, [cuerpo]);

  return (
    <div className="estado-vacio" data-testid={testId}>
      {ilustracion && (
        <svg
          className="estado-vacio__taza"
          width={168}
          height={168}
          viewBox={VIEWBOX_TAZA}
          aria-hidden="true"
          focusable="false"
          data-testid={testId ? `${testId}-taza` : undefined}
        >
          {TAZA.map((el, i) =>
            el.tipo === 'path' ? (
              <path key={i} d={el.d} fill={COLOR_POR_ROL[el.rol]} />
            ) : (
              <ellipse key={i} cx={el.cx} cy={el.cy} rx={el.rx} ry={el.ry} fill={COLOR_POR_ROL[el.rol]} />
            ),
          )}
        </svg>
      )}

      <p className="estado-vacio__titulo" data-testid={testId ? `${testId}-titulo` : undefined}>
        {titulo}
      </p>

      {cuerpo != null && mostrarCuerpo && (
        <p className="estado-vacio__cuerpo" data-testid={testId ? `${testId}-cuerpo` : undefined}>
          {cuerpo}
        </p>
      )}
    </div>
  );
}
