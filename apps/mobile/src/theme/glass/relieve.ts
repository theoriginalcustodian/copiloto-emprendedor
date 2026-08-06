/**
 * `relieve` — los 5 niveles de sombra/relieve de ODOBI (DoD §2.4), fuente ÚNICA consumida por
 * nombre. Antes cada superficie (`CristalVidrio`, `Tile`, `Row`) repetía su propio
 * `{shadowOffset, shadowRadius, shadowOpacity, elevation}` a mano — si vuelven a copiarse, vuelven
 * a divergir (mismo error que ya se corrigió una vez en el marco del vidrio, ver `canonGlass.ts`).
 *
 * Este módulo es un mapeador PURO: no declara ni un color ni un número de geometría propio. Cada
 * nivel (color, opacidad, offset, radio, elevation) vive declarado por piel en `tokens.ts`
 * (`Tokens.glass.relieve`, único archivo con hex fuera de acá — ver `temaSinHex.test.ts`) porque el
 * DoD §2.4 declara geometría DISTINTA por piel en el nivel 1 (claro `10px/26px`, oscuro/nocturno
 * `12px/28px`) — no es sólo el color el que cambia.
 *
 * 🔴 **Por qué `{shadowColor,...}` clásico y no `boxShadow`** (reemplaza el mecanismo que usaban
 * `sombraTile`/`sombraFila` acá mismo hasta el hito 1). Es EXACTAMENTE el shape que el spike del
 * hito 0 verificó en device real (PIL sobre captura, `spikes/odobi-relieve/`): con `shadowColor`
 * cálido sobre una View de fondo TRANSPARENTE, Android respeta el tinte marrón — no hace falta el
 * fondo opaco que exigía la vieja `elevation` (este proyecto corre New Architecture, que aplica
 * `shadowColor/shadowRadius/shadowOpacity` en Android igual que en iOS, no sólo `elevation` con su
 * outline clásico). `boxShadow` (con `spreadDistance`) nunca se probó en device para tinte cálido —
 * no se asume que se comporta igual sin esa evidencia; unificar todo al shape validado es más seguro
 * que mantener dos mecanismos de sombra en paralelo, uno probado y otro no.
 *
 * RN no tiene `spread`: el DoD ya lo absorbe en cada nivel aproximando `shadowRadius`/`elevation`
 * contra la magnitud del spread negativo del diseño (mismo criterio que usó el spike, documentado
 * en sus propios comentarios).
 */
import type { ViewStyle } from 'react-native';

/** Un nivel de relieve declarado en `tokens.ts`: color+opacidad+geometría, ya resueltos por piel. */
export interface NivelRelieve {
  color: string;
  opacity: number;
  offsetY: number;
  radius: number;
  elevation: number;
}

type Sombra = Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowRadius' | 'shadowOpacity' | 'elevation'>;

/** Traduce un `NivelRelieve` al shape de sombra de RN. `haciaArriba` invierte el signo del offset
 *  para paneles anclados abajo que se levantan hacia arriba (conversación/grabación/takeover) — es
 *  geometría de anclaje, no un valor de diseño distinto: color/radio/opacidad/elevation son los
 *  mismos que hacia abajo, sólo cambia hacia qué lado cae la sombra. */
export function sombraNivel(n: NivelRelieve, haciaArriba = false): Sombra {
  return {
    shadowColor: n.color,
    shadowOffset: { width: 0, height: haciaArriba ? -n.offsetY : n.offsetY },
    shadowRadius: n.radius,
    shadowOpacity: n.opacity,
    elevation: n.elevation,
  };
}

/** Nivel 5 · Foco / grabando (ring del mic activo) — no es sombra proyectada: es un anillo. */
export function anilloFoco(colorConAlpha: string, ancho = 6): Pick<ViewStyle, 'borderWidth' | 'borderColor'> {
  return { borderWidth: ancho, borderColor: colorConAlpha };
}
