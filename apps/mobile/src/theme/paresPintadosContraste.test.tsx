/**
 * Gate de contraste WCAG 2.1 — pares REALMENTE PINTADOS, medidos sobre el ÁRBOL RENDERIZADO.
 *
 * 🔴 **Por qué reemplaza a `temaContraste.test.ts` (el mapa `SUPERFICIES`).** Ese mapa era una lista
 * curada A MANO de "tinta X sobre superficie Y", mantenida por censo manual (grep + lectura de 66
 * archivos). Mide lo que alguien DECLARÓ que se pinta, no lo que el árbol de React realmente compone —
 * y ese hueco no es teórico: el 2026-09-07 una regresión real (el rebrand Odobi empeoró `acentoTinta`
 * en 2 de 3 pieles) pasó sin que el mapa la cazara, porque nadie había mapeado ESE par todavía.
 *
 * Acá se hace lo mismo que `apps/copiloto-web/src/design-system/paresPintadosContraste.test.ts` hace
 * para la web (parsear el CSS/`style={{}}` REAL), pero para mobile: se **monta** cada pantalla/
 * componente con RNTL, se lee `toJSON()` — el árbol de host-components que React Native realmente
 * compuso — y se camina ese árbol calculando, para cada nodo de texto, contra qué fondo quedó pintado
 * de verdad (heredado del ancestro más cercano que pinta fondo, o del HERMANO anterior si es un overlay
 * de vidrio — ver `esOverlayCompleto` más abajo, necesario porque `EnvolturaCampo`/`Composer`/
 * `HudGrabacion.BotonPrimario` pintan su superficie con una `View` opaca + un `LinearGradient`
 * TRASLÚCIDO como HERMANOS antes del contenido, no como ancestro único).
 *
 * **Los umbrales son BASELINE, no aspiración** (mismo criterio que el archivo que reemplaza): un par
 * por debajo de AA (4.5) que YA estaba así antes de este cambio se registra en `DEUDA_CONOCIDA` como
 * piso anti-regresión, no como objetivo a cumplir hoy.
 */
import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import type { FlatList } from 'react-native-gesture-handler';

// ── Mock de red combinado: la UNIÓN de lo que cada test hermano mockea por separado. Un solo
// `jest.mock('@copiloto/core', ...)` por archivo (hoisting de jest) — no se puede tener uno por
// componente, así que se listan acá todas las funciones que alguno de los 10+7 montajes necesita.
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    obtenerMiTicket: jest.fn(),
    obtenerPresupuesto: jest.fn(),
    facturarPresupuesto: jest.fn(),
    cambiarEstadoPresupuesto: jest.fn(),
    listarCatalogo: jest.fn(),
    pedirLinkDeVinculacion: jest.fn(),
    desconectarServicio: jest.fn(),
    listarComprobantes: jest.fn(),
    anularComprobante: jest.fn(),
    confirmarAnulacion: jest.fn(),
    estadoAnulacion: jest.fn(),
    apiReal: { ...actual.apiReal, login: jest.fn(), me: jest.fn(), ensureOauthTenant: jest.fn() },
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn().mockResolvedValue(true), signIn: jest.fn() },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
}));

const mockSesionCuenta = {
  estado: 'autenticado',
  me: { cliente_id: 'c-1', email: 'ana@negocio.test' } as { cliente_id: string; email: string | null },
  login: jest.fn(),
  logout: jest.fn(),
};
jest.mock('../modules/auth', () => ({ useSession: () => mockSesionCuenta }));

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
}));

import {
  obtenerMiTicket,
  obtenerPresupuesto,
  listarCatalogo,
  listarComprobantes,
  type Comprobante,
  type EstadoFacturaResp,
  type MiTicketResult,
  type MotivoFallo,
  type Presupuesto,
  type SendStatus,
  type ServicioCatalogo,
} from '@copiloto/core';

import { SKINS, type NombreSkin, type Tokens } from './tokens';
import { ThemeProvider, useTema } from './ThemeProvider';
import { PantallaTicket } from '../modules/soporte/PantallaTicket';
import { DetallePresupuesto } from '../modules/presupuestos/DetallePresupuesto';
import { PantallaLogin } from '../modules/auth/PantallaLogin';
import { SessionProvider } from '../modules/auth/SessionProvider';
import { PantallaCuenta } from '../modules/ajustes/PantallaCuenta';
import { PantallaApps } from '../modules/apps/PantallaApps';
import { PasoResumen } from '../modules/facturacion/PasoResumen';
import { DetalleComprobante } from '../modules/facturacion/DetalleComprobante';
import { BotonVoz } from '../modules/chat/BotonVoz';
import { Marca } from './Marca';
import { Composer } from '../modules/chat/Composer';
import { SeccionMisComprobantes } from '../modules/facturacion/SeccionMisComprobantes';
import { BotonDescartar, BotonGhost, BotonPrimario, HudGrabacion } from '../modules/captura/HudGrabacion';
import { FilaBotones } from './glass/campos/FilaBotones';
import { EnvolturaCampo } from './glass/campos/EnvolturaCampo';
import { CampoSelect } from './glass/campos/CampoSelect';
import { CampoTexto } from './glass/campos/CampoTexto';
import { CampoFecha } from './glass/campos/CampoFecha';

const mockObtenerMiTicket = obtenerMiTicket as jest.MockedFunction<typeof obtenerMiTicket>;
const mockObtenerPresupuesto = obtenerPresupuesto as jest.MockedFunction<typeof obtenerPresupuesto>;
const mockListarCatalogo = listarCatalogo as jest.MockedFunction<typeof listarCatalogo>;
const mockListarComprobantes = listarComprobantes as jest.MockedFunction<typeof listarComprobantes>;

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// §1 — Matemática WCAG + composición alpha, MIGRADAS de `temaContraste.test.ts` (verificadas ahí,
// no se reescriben de cero — mismo texto, se exportan para quien las necesite fuera de este archivo).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

function aRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function luminancia(hex: string): number {
  const lineal = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = aRgb(hex);
  return 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
}

export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function hex2(n: number): string {
  const h = Math.max(0, Math.min(255, Math.round(n))).toString(16);
  return h.length === 1 ? `0${h}` : h;
}

/** Compone `rgb(a,g,b)` con alpha `a` (0-1) sobre un fondo hex sólido → hex plano. */
function componer(r: number, g: number, b: number, a: number, hexFondo: string): string {
  const [fr, fg, fb] = aRgb(hexFondo);
  const c = (fg2: number, bg2: number) => fg2 * a + bg2 * (1 - a);
  return `#${hex2(c(r, fr))}${hex2(c(g, fg))}${hex2(c(b, fb))}`;
}

/** Compone un hex + alpha en formato hex de 2 dígitos (`tema.color.X + '1f'`) sobre un fondo sólido. */
function aplanarHexAlpha(hex6: string, alphaHex2: string, hexFondo: string): string {
  const [r, g, b] = aRgb(hex6);
  const a = parseInt(alphaHex2, 16) / 255;
  return componer(r, g, b, a, hexFondo);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// §2 — El caminador del árbol renderizado (el mecanismo nuevo: NO hay mapa manual acá abajo).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

interface ParPintado {
  ruta: string;
  color: string;
  bg: string;
}

/**
 * Resuelve un valor de color CRUDO tal como aparece en `toJSON()` a un hex final, componiendo contra
 * `base` si trae alpha. Cubre las 3 formas que este código base produce:
 *  - `number` (ARGB de 32 bits): así llega `LinearGradient.colors` — `expo-linear-gradient` pasa cada
 *    stop por `processColor()` antes de que React Native lo entregue al host component. Verificado
 *    empíricamente con un spike de `toJSON()` (no asumido): `'#ff0000'` → `4294901760`.
 *  - hex `#RRGGBB` / `#RGB` / `#RRGGBBAA` (8 dígitos, el patrón `tema.color.X + '1f'` de
 *    `PantallaTicket.tsx`).
 *  - `rgba(r,g,b,a)` / `rgb(r,g,b)` (los stops de `glass.*`, cuando NO pasan por un `LinearGradient` —
 *    p.ej. `backgroundColor: tema.glass.chip` en `FilaBotones`/`Composer`/`BotonDescartar`).
 * `null` = transparente (no aporta color) — `'transparent'`, `'none'`, alpha 0.
 */
function colorEfectivo(crudo: unknown, base: string): string | null {
  if (crudo == null) return null;
  if (typeof crudo === 'number') {
    const a = ((crudo >>> 24) & 0xff) / 255;
    const r = (crudo >>> 16) & 0xff;
    const g = (crudo >>> 8) & 0xff;
    const b = crudo & 0xff;
    if (a === 0) return null;
    if (a >= 1) return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
    return componer(r, g, b, a, base);
  }
  if (typeof crudo !== 'string') return null;
  const s = crudo.trim();
  if (s === '' || s === 'transparent' || s === 'none') return null;
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const [r, g, b] = s.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const m8 = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/.exec(s);
  if (m8) return aplanarHexAlpha(`#${m8[1]}`, m8[2], base).toLowerCase();
  const mrgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
  if (mrgba) {
    const [, rs, gs, bs, as] = mrgba;
    const a = as != null ? Number(as) : 1;
    if (a >= 1) return `#${hex2(Number(rs))}${hex2(Number(gs))}${hex2(Number(bs))}`.toLowerCase();
    return componer(Number(rs), Number(gs), Number(bs), a, base).toLowerCase();
  }
  return null; // color con nombre (p.ej. 'red') -- no usado en este código base (regla cero-hex).
}

function dedup(valores: string[]): string[] {
  return Array.from(new Set(valores));
}

/** Pre-escaneo: `id` de un `<Defs><RadialGradient id="x">…<Stop stopColor=.../></RadialGradient></Defs>`
 *  → sus `stopColor` crudos, para resolver `fill="url(#x)"` (patrón de `BotonVoz.tsx`, esfera del isotipo).
 *  Necesario porque `react-native-svg` está mockeado a `View`s pass-through (`jest.setup.js`): no hay
 *  render de gradiente real, así que el `id`→stops hay que leerlo del árbol a mano. */
function recolectarGradientesPorId(nodo: unknown, mapa: Map<string, string[]>): void {
  if (nodo == null || typeof nodo !== 'object') return;
  const n = nodo as { props?: Record<string, unknown>; children?: unknown[] };
  const id = n.props?.id;
  const hijos = Array.isArray(n.children) ? n.children : [];
  if (typeof id === 'string') {
    const stops: string[] = [];
    for (const h of hijos) {
      if (h != null && typeof h === 'object') {
        const stopColor = (h as { props?: Record<string, unknown> }).props?.stopColor;
        if (typeof stopColor === 'string') stops.push(stopColor);
      }
    }
    if (stops.length > 0) mapa.set(id, stops);
  }
  for (const h of hijos) recolectarGradientesPorId(h, mapa);
}

function esGradienteLineal(nodo: { type?: unknown }): boolean {
  return typeof nodo.type === 'string' && nodo.type.includes('ExpoLinearGradient');
}

/** Los valores CRUDOS (sin resolver) que este nodo aporta como fondo: `colors` de un `LinearGradient`,
 *  `style.backgroundColor`, o `fill` de una forma SVG (directo o `url(#id)`). */
function valoresDeFondoCrudos(
  nodo: { type?: unknown; props?: Record<string, unknown> },
  gradientesPorId: Map<string, string[]>,
): unknown[] {
  const props = nodo.props ?? {};
  if (esGradienteLineal(nodo) && Array.isArray(props.colors)) return props.colors as unknown[];
  const style = StyleSheet.flatten((props.style as never) ?? {}) as Record<string, unknown>;
  if (style && style.backgroundColor != null) return [style.backgroundColor];
  const fill = props.fill;
  if (typeof fill === 'string' && fill !== 'none') {
    if (fill.startsWith('url(#')) {
      const id = fill.slice(5, -1);
      return gradientesPorId.get(id) ?? [];
    }
    return [fill];
  }
  return [];
}

/** Un nodo es un "overlay de vidrio completo" cuando pinta TODA la superficie de su padre y por lo
 *  tanto lo que venga DESPUÉS de él (hermanos y descendientes) se ve pintado ENCIMA suyo, no del fondo
 *  heredado de más arriba. `LinearGradient` siempre califica (así se usa en este código base: vidrio de
 *  campo/burbuja). Una `View` con `backgroundColor` sólo califica si además es `position:absolute` con
 *  `top:0`+`bottom:0` (el patrón `StyleSheet.absoluteFill` de la base opaca de `EnvolturaCampo`) — eso
 *  excluye tiras decorativas como `luzSuperior` (1px, sin `bottom`), que NO tapan nada.
 *
 *  Una forma SVG (`Circle`/`Path`/`Rect`/…) con `fill` resuelto también califica: `react-native-svg`
 *  está mockeado a `View`s pass-through (ver `jest.setup.js`), así que NO hay forma de mirar el
 *  `type` para reconocerla -- se detecta por props geométricas (`cx`/`cy`/`r`/`d`/`points`/`rx`/`ry`),
 *  el mismo criterio prop-based que ya usa `valoresDeFondoCrudos` para su `fill`. Sin esto, el isotipo
 *  de `BotonVoz` (un `<Circle fill="url(#esferaVoz)">` con el trazo del ícono como HERMANO siguiente,
 *  no descendiente) medía el trazo contra el fondo de PANTALLA en vez de contra la esfera real -- se
 *  detectó al correr el barrido por primera vez (ratio contra `#F7F3EC` en vez de contra el último
 *  stop del degradado, ~3,17:1, que es el que ya constaba como deuda conocida). */
function esOverlayCompleto(nodo: { type?: unknown; props?: Record<string, unknown> }): boolean {
  if (esGradienteLineal(nodo)) return true;
  const props = nodo.props ?? {};
  const style = StyleSheet.flatten((props.style as never) ?? {}) as Record<string, unknown>;
  if (style?.backgroundColor != null && style.position === 'absolute' && style.top === 0 && style.bottom === 0) {
    return true;
  }
  const fill = props.fill;
  const pareceFormaSvg = ['cx', 'cy', 'r', 'd', 'points', 'rx', 'ry'].some((k) => props[k] != null);
  return pareceFormaSvg && typeof fill === 'string' && fill !== 'none';
}

/**
 * DFS sobre `toJSON()`. `fondoHeredado` es una LISTA de candidatos (no un solo color): un gradiente de
 * 2 stops deja 2 candidatos vivos, y cada uno genera su propio `ParPintado` — es la forma de capturar
 * el "peor stop" sin promediar ni elegir uno a mano (mismo criterio que el mapa viejo medía "contra el
 * stop más transparente", pero automático).
 *
 * El threading de hermanos (no sólo ancestro→descendiente) es lo que el diseño original del contrato
 * NO contemplaba y este archivo sí: `EnvolturaCampo`/`Composer`/`HudGrabacion.BotonPrimario` pintan su
 * vidrio con una `View` opaca + `LinearGradient` como HERMANOS antes del contenido, no como un único
 * ancestro — un caminador que sólo mirara ancestros mediría el texto contra el fondo de la PANTALLA,
 * no contra el vidrio que en verdad tiene detrás.
 */
function recorrer(
  nodo: unknown,
  fondoHeredado: string[],
  gradientesPorId: Map<string, string[]>,
  pares: ParPintado[],
  ruta: string,
): void {
  if (nodo == null || typeof nodo !== 'object') return;
  const n = nodo as { type?: unknown; props?: Record<string, unknown>; children?: unknown[] };
  const props = n.props ?? {};
  const base = fondoHeredado[0] ?? '#000000';

  const crudosPropios = valoresDeFondoCrudos(n, gradientesPorId);
  const resueltosPropios = dedup(
    crudosPropios.map((c) => colorEfectivo(c, base)).filter((c): c is string => c != null),
  );
  const candidatosTexto = resueltosPropios.length > 0 ? resueltosPropios : fondoHeredado;

  const style = StyleSheet.flatten((props.style as never) ?? {}) as Record<string, unknown>;
  if (typeof style.color === 'string') {
    const c = colorEfectivo(style.color, base);
    if (c) for (const bg of candidatosTexto) pares.push({ ruta, color: c, bg });
  }
  if (typeof props.placeholderTextColor === 'string') {
    const c = colorEfectivo(props.placeholderTextColor, base);
    if (c) for (const bg of candidatosTexto) pares.push({ ruta: `${ruta} · placeholder`, color: c, bg });
  }
  if (typeof props.stroke === 'string' && props.stroke !== 'none') {
    const c = colorEfectivo(props.stroke, base);
    if (c) for (const bg of candidatosTexto) pares.push({ ruta: `${ruta} · stroke`, color: c, bg });
  }

  const hijos = Array.isArray(n.children) ? n.children : [];
  let fondoCorriente = resueltosPropios.length > 0 ? resueltosPropios : fondoHeredado;
  hijos.forEach((hijo, i) => {
    const esObjeto = hijo != null && typeof hijo === 'object';
    const hijoTipado = hijo as { type?: unknown; props?: Record<string, unknown> };
    const etiqueta = esObjeto ? (hijoTipado.props?.testID ?? hijoTipado.type ?? `#${i}`) : `#${i}`;
    recorrer(hijo, fondoCorriente, gradientesPorId, pares, `${ruta} > ${String(etiqueta)}`);
    if (esObjeto && esOverlayCompleto(hijoTipado)) {
      const crudosHijo = valoresDeFondoCrudos(hijoTipado, gradientesPorId);
      const base2 = fondoCorriente[0] ?? base;
      const resueltosHijo = dedup(
        crudosHijo.map((c) => colorEfectivo(c, base2)).filter((c): c is string => c != null),
      );
      if (resueltosHijo.length > 0) fondoCorriente = resueltosHijo;
    }
  });
}

function caminarArbol(json: unknown, fondoBase: string): ParPintado[] {
  const gradientesPorId = new Map<string, string[]>();
  const raices = Array.isArray(json) ? json : [json];
  for (const r of raices) recolectarGradientesPorId(r, gradientesPorId);
  const pares: ParPintado[] = [];
  for (const r of raices) recorrer(r, [fondoBase], gradientesPorId, pares, 'raiz');
  return pares;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// §3 — Fixtures reusadas de los tests hermano (mismos datos, no se reinventan).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const TICKET_FIXTURE: MiTicketResult = {
  status: 'ok',
  ticket: {
    id: 7,
    codigo: 'SOP-0007',
    canal: 'soporte_tecnico',
    estado: 'respondido',
    asunto: 'No puedo emitir una factura',
    created_at: '2026-08-07T10:00:00Z',
    updated_at: '2026-08-10T09:00:00Z',
  },
  mensajes: [
    { id: 1, autor: 'usuario', texto: 'No me deja emitir', created_at: '2026-08-07T10:00:00Z' },
    { id: 2, autor: 'operador', texto: 'Ya lo revisamos, probá de nuevo', created_at: '2026-08-10T09:00:00Z' },
  ],
};

function presupuestoFixture(over: Partial<Presupuesto> = {}): Presupuesto {
  return {
    id: 3,
    numero: 12,
    concepto: 'Pintura del local',
    fecha: '2026-07-20',
    total: '50000.00',
    items: [{ orden: 1, descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '50000.00' } as never],
    receptor: { nombre: 'Panadería', docTipo: null, docNro: '', condicionIva: null, domicilio: '', contacto: 'p@x.com' },
    docLink: 'https://docs.google.com/d/1',
    facturado: true,
    facturaId: null,
    reemplazaA: null,
    reemplazadoPor: null,
    estado: 'pendiente',
    estadoActualizadoEn: null,
    sinRespuesta: true,
    ...over,
  } as Presupuesto;
}

function comprobanteFixture(over: Partial<Comprobante> = {}): Comprobante {
  return {
    cuit: '20111111112',
    tipoCbte: 11,
    puntoVenta: 6,
    nro: 15,
    cae: '86290621776176',
    caeVto: '2026-08-01',
    fechaEmision: '2026-07-21',
    total: '1000.00',
    estado: 'emitida',
    pdfUrl: 'https://afipsdk/f.pdf',
    cbteAsocNro: null,
    driveFileId: null,
    driveLink: null,
    receptorNombre: null,
    docTipo: null,
    docNro: null,
    ...over,
  } as Comprobante;
}

function servicioFixture(over: Partial<ServicioCatalogo> = {}): ServicioCatalogo {
  return {
    key: 'googledrive',
    nombre: 'Google Drive',
    etiquetaTrabajo: 'Archivos',
    categoria: 'Archivos',
    kind: 'composio',
    descripcion: 'Creá y buscá archivos en tu Google Drive.',
    capacidades: ['Crear archivo'],
    conectado: false,
    estado: 'nunca_conectado',
    connectPath: '/composio/connect?service=googledrive',
    ...over,
  };
}

const ESTADO_FACTURA_LISTO: EstadoFacturaResp = {
  estado: 'esperando_confirmacion',
  faltantes: [],
  items: [{ descripcion: 'Consultoría', cantidad: '1', precioUnitario: '1000.00', subtotal: '1000.00' }],
  total: '1000.00',
  tokenConfirmacion: '1:1000.00:99:0',
  resultado: null,
  pdf: null,
  drive: null,
  receptor: null,
  datosVenta: null,
  motivo: null,
  motivoCodigo: null,
  terminado: false,
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// §4 — Montadores: uno por componente, calcando el mock/harness de su test hermano cuando existe.
// Todos devuelven `toJSON()` YA asentado (esperan lo mismo que su hermano espera antes de assertar).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

async function montarPantallaTicket(piel: NombreSkin) {
  mockObtenerMiTicket.mockResolvedValue(TICKET_FIXTURE);
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <PantallaTicket ticketId={7} />
    </ThemeProvider>,
  );
  await waitFor(() => inst.getByTestId('ticket-msj-1'));
  return inst.toJSON();
}

async function montarDetallePresupuesto(piel: NombreSkin) {
  mockObtenerPresupuesto.mockResolvedValue({ status: 'no_disponible' });
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <DetallePresupuesto
        presupuesto={presupuestoFixture()}
        onCerrar={() => {}}
        onFacturar={() => {}}
        onCorregir={() => {}}
        sugerenciaMandarPorMail={{ docLink: 'https://docs.google.com/d/1' }}
      />
    </ThemeProvider>,
  );
  await waitFor(() => inst.getByTestId('detalle-presupuesto-estado'));
  return inst.toJSON();
}

async function montarPantallaLogin(piel: NombreSkin) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <SessionProvider>
        <PantallaLogin />
      </SessionProvider>
    </ThemeProvider>,
  );
  await waitFor(() => inst.getByTestId('login-google'));
  return inst.toJSON();
}

async function montarPantallaCuenta(piel: NombreSkin) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <PantallaCuenta />
    </ThemeProvider>,
  );
  await waitFor(() => inst.getByTestId('cuenta-email'));
  return inst.toJSON();
}

async function montarPantallaApps(piel: NombreSkin) {
  mockListarCatalogo.mockResolvedValue({
    status: 'ok',
    servicios: [servicioFixture({ conectado: true }), servicioFixture({ key: 'mercadopago', nombre: 'Mercado Pago', kind: 'payments', conectado: false })],
  });
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <PantallaApps />
    </ThemeProvider>,
  );
  await waitFor(() => inst.getByTestId('app-googledrive-conectada'));
  return inst.toJSON();
}

async function montarPasoResumen(piel: NombreSkin, ambiente: 'dev' | 'prod' | null) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <PasoResumen
        estado={ESTADO_FACTURA_LISTO}
        ambiente={ambiente}
        datosVenta={null}
        cliente={null}
        onConfirmar={async () => ({ emitida: true, estado: ESTADO_FACTURA_LISTO })}
        onCancelar={async () => {}}
        onEditar={() => {}}
      />
    </ThemeProvider>,
  );
  return inst.toJSON();
}

async function montarDetalleComprobante(piel: NombreSkin) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <DetalleComprobante
        comprobante={comprobanteFixture({ receptorNombre: 'Juan Pérez SRL', docTipo: 80, docNro: '20111111112', driveLink: 'https://drive/uc?id=1', cbteAsocNro: 16 })}
        onCerrar={() => {}}
      />
    </ThemeProvider>,
  );
  await waitFor(() => inst.getByTestId('detalle-comprobante-numero'));
  return inst.toJSON();
}

function ArnesBotonVoz({ piel }: { piel: NombreSkin }) {
  const scrollRef = useRef<FlatList>(null);
  return (
    <ThemeProvider skinForzado={piel}>
      <BotonVoz onIniciar={() => {}} onSoltarSinFijar={() => {}} onFijar={() => {}} onCancelar={() => {}} scrollRef={scrollRef} />
    </ThemeProvider>
  );
}
async function montarBotonVoz(piel: NombreSkin) {
  const inst = await render(<ArnesBotonVoz piel={piel} />);
  await waitFor(() => inst.getByTestId('boton-voz'));
  return inst.toJSON();
}

async function montarMarca(piel: NombreSkin) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <Marca />
    </ThemeProvider>,
  );
  return inst.toJSON();
}

async function montarComposer(piel: NombreSkin, sendStatus: SendStatus, motivoFallo: MotivoFallo | null = null) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <Composer sendStatus={sendStatus} motivoFallo={motivoFallo} onSend={() => {}} />
    </ThemeProvider>,
  );
  await waitFor(() => inst.getByTestId('chat-composer'));
  return inst.toJSON();
}

async function montarSeccionMisComprobantes(piel: NombreSkin) {
  mockListarComprobantes.mockResolvedValue({ status: 'ok', comprobantes: [comprobanteFixture({ receptorNombre: 'Cliente X' })] });
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <SeccionMisComprobantes cuit="20111111112" onVerDetalle={() => {}} />
    </ThemeProvider>,
  );
  await waitFor(() => expect(inst.queryByTestId('facturacion-mis-comprobantes-cargando')).toBeNull());
  return inst.toJSON();
}

async function montarHudGrabacion(piel: NombreSkin) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <HudGrabacion etiqueta="Grabando…" activo segundos={12} contexto="Consulta — Juan Pérez">
        <BotonPrimario id="hud-enviar" texto="Enviar" onPress={() => {}} icono />
        <BotonGhost id="hud-pausar" texto="Pausar" onPress={() => {}} />
        <BotonDescartar id="hud-descartar" onPress={() => {}} />
      </HudGrabacion>
    </ThemeProvider>,
  );
  return inst.toJSON();
}

async function montarFilaBotones(piel: NombreSkin) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <FilaBotones
        testID="spike-filabotones"
        botones={[
          { etiqueta: 'Confirmar', onPress: () => {}, variante: 'primario' },
          { etiqueta: 'Cancelar', onPress: () => {}, variante: 'secundario' },
          { etiqueta: 'Eliminar', onPress: () => {}, variante: 'peligro' },
        ]}
      />
    </ThemeProvider>,
  );
  return inst.toJSON();
}

/** `EnvolturaCampo` no pinta texto propio (es el vidrio puro) -- el consumo real (con texto adentro)
 *  ya está cubierto por `CampoTexto`/`CampoSelect`/`CampoFecha`. Este montaje agrega la superficie
 *  MISMA con un `<Text>` mínimo, para tener un caso explícito del primitivo y no sólo transitivo. */
function EjemploEnvolturaCampo() {
  const tema = useTema();
  return (
    <EnvolturaCampo testID="spike-envoltura">
      <Text style={{ color: tema.color.texto }}>ejemplo</Text>
    </EnvolturaCampo>
  );
}
async function montarEnvolturaCampo(piel: NombreSkin) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <EjemploEnvolturaCampo />
    </ThemeProvider>,
  );
  return inst.toJSON();
}

async function montarCampoSelect(piel: NombreSkin) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <CampoSelect
        etiqueta="Condición"
        opciones={[{ valor: 'a', etiqueta: 'Opción A', descripcion: 'descripción' }, { valor: 'b', etiqueta: 'Opción B' }]}
        valor="a"
        onChange={() => {}}
        error="Elegí una opción"
      />
    </ThemeProvider>,
  );
  return inst.toJSON();
}

async function montarCampoTexto(piel: NombreSkin) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <CampoTexto etiqueta="Concepto" valor="" onChange={() => {}} placeholder="Escribí…" error="Campo requerido" />
    </ThemeProvider>,
  );
  return inst.toJSON();
}

async function montarCampoFecha(piel: NombreSkin) {
  const inst = await render(
    <ThemeProvider skinForzado={piel}>
      <CampoFecha etiqueta="Fecha" valor="" onChange={() => {}} error="Fecha inválida" />
    </ThemeProvider>,
  );
  return inst.toJSON();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// §5 — El barrido: monta TODO lo de §4 bajo las 2 pieles y camina cada árbol. Corre una vez
// (`beforeAll`), los `describe`/`it` de más abajo sólo leen `PARES_POR_PIEL`.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

interface Productor {
  nombre: string;
  montar: (piel: NombreSkin) => Promise<unknown>;
}

const PRODUCTORES: Productor[] = [
  { nombre: 'PantallaTicket', montar: montarPantallaTicket },
  { nombre: 'DetallePresupuesto', montar: montarDetallePresupuesto },
  { nombre: 'PantallaLogin', montar: montarPantallaLogin },
  { nombre: 'PantallaCuenta', montar: montarPantallaCuenta },
  { nombre: 'PantallaApps', montar: montarPantallaApps },
  { nombre: 'PasoResumen(dev)', montar: (p) => montarPasoResumen(p, 'dev') },
  { nombre: 'PasoResumen(prod)', montar: (p) => montarPasoResumen(p, 'prod') },
  { nombre: 'PasoResumen(sin-ambiente)', montar: (p) => montarPasoResumen(p, null) },
  { nombre: 'DetalleComprobante', montar: montarDetalleComprobante },
  { nombre: 'BotonVoz', montar: montarBotonVoz },
  { nombre: 'Marca', montar: montarMarca },
  { nombre: 'Composer(idle)', montar: (p) => montarComposer(p, 'idle') },
  { nombre: 'Composer(error)', montar: (p) => montarComposer(p, 'error', 'red') },
  { nombre: 'SeccionMisComprobantes', montar: montarSeccionMisComprobantes },
  { nombre: 'HudGrabacion', montar: montarHudGrabacion },
  { nombre: 'FilaBotones', montar: montarFilaBotones },
  { nombre: 'EnvolturaCampo', montar: montarEnvolturaCampo },
  { nombre: 'CampoSelect', montar: montarCampoSelect },
  { nombre: 'CampoTexto', montar: montarCampoTexto },
  { nombre: 'CampoFecha', montar: montarCampoFecha },
];

const PIELES = Object.keys(SKINS) as NombreSkin[];

const PARES_POR_PIEL: Record<NombreSkin, ParPintado[]> = { claro: [], oscuro: [] };

beforeAll(async () => {
  for (const piel of PIELES) {
    const tema: Tokens = SKINS[piel];
    for (const productor of PRODUCTORES) {
      jest.clearAllMocks();
      const json = await productor.montar(piel);
      const pares = caminarArbol(json, tema.color.fondo).map((p) => ({ ...p, ruta: `${productor.nombre} ${p.ruta}` }));
      PARES_POR_PIEL[piel].push(...pares);
    }
  }
}, 60000);

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// §6 — Deuda conocida: pisos anti-regresión para pares que YA estaban sub-AA antes de este cambio de
// mecanismo (ningún componente se tocó -- lo único que cambió es CÓMO se mide). Clave = el par de hex
// resuelto (no la ruta, que varía con el testID/estructura): estable mientras el color no cambie.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

interface Excepcion {
  min: number;
  motivo: string;
}

function clavePar(p: ParPintado): string {
  return `${p.color}→${p.bg}`;
}

// Valores tomados de una corrida REAL del barrido (no inventados): cada `min` es el piso observado
// redondeado HACIA ABAJO a 2 decimales (`floor(ratio*100)/100`) -- así el propio valor medido nunca
// puede "empeorar" el piso por un redondeo de punto flotante entre corridas/entornos; sólo una caída
// real de más de 0,01 dispara el gate. Se agrupan por token de color para que se lea el patrón, no
// una lista plana: son ~4 familias de deuda pre-existente (ningún componente se tocó en esta tarea),
// que el mapa manual `SUPERFICIES` no cubría entrada por entrada.
const DEUDA_CONOCIDA: Record<NombreSkin, Record<string, Excepcion>> = {
  claro: {
    // `tema.color.acento` (#de7250) como texto/link directo sobre superficies claras neutras --
    // patrón "texto acento sobre tarjeta clara" repetido en detalle de presupuesto/comprobante,
    // botón "confirmar" de PasoResumen, chip seleccionado de CampoSelect.
    '#de7250→#faf7ec': { min: 2.95, motivo: 'acento como texto (total/CAE) sobre superficie clara -- DetallePresupuesto/DetalleComprobante.' },
    '#de7250→#eeebe0': { min: 2.65, motivo: 'acento como texto de acción (mandar por mail / guardar) sobre superficie clara.' },
    '#de7250→#ebe7e0': { min: 2.57, motivo: 'acento como texto del botón "confirmar" (PasoResumen) y variante primario de FilaBotones, piel clara.' },
    '#de7250→#fffefe': { min: 3.14, motivo: 'acento como texto de chip seleccionado en CampoSelect, fondo de opción no seleccionada.' },
    '#de7250→#fdfcf7': { min: 3.08, motivo: 'acento como texto de chip seleccionado en CampoSelect, variante de superficie.' },
    // `tema.color.peligro` (#c7455a) como texto/ícono de acción destructiva sobre superficies rosadas
    // claras (`peligroFondo`) -- cancelar, cerrar sesión, desconectar, anular, descartar.
    '#c7455a→#f2e2dd': { min: 3.77, motivo: 'peligro como texto (cancelar/cerrar sesión/descartar) sobre peligroFondo, piel clara.' },
    '#c7455a→#f9ecee': { min: 4.12, motivo: 'peligro como texto (desconectar/anular) sobre variante de peligroFondo, piel clara.' },
    '#c7455a→#F7F3EC': { min: 4.28, motivo: 'peligro como texto de error de campo (CampoSelect/CampoTexto/CampoFecha) sobre el fondo de pantalla (montaje standalone), y status de error de Composer.' },
    // `tema.color.exito`-ish (#3c8069) como texto de estado sobre superficies casi blancas.
    '#3c8069→#faf7ec': { min: 4.36, motivo: '"facturado" (DetallePresupuesto) sobre superficie clara -- borde de AA, no se sube en esta tarea.' },
    '#3c8069→#fcfaf7': { min: 4.49, motivo: '"conectada" (PantallaApps) sobre superficie casi blanca -- a milésimas de AA.' },
    // Isotipo (trazo blanco de Marca/BotonVoz) sobre los stops de su propio relleno -- degradado
    // `[glass.accent2, tema.color.acento, tema.color.acento]` en BotonVoz, `tema.color.acento` sólido
    // en Marca. `#ffffff sobre #de7250` (3,17:1, el ÚLTIMO stop / relleno sólido de Marca) YA era
    // deuda conocida en el mapa `SUPERFICIES` viejo ("isotipo de Marca / BotonVoz, offset final").
    '#ffffff→#de7250': { min: 3.16, motivo: 'isotipo (trazo blanco) sobre acento sólido -- Marca y último stop del degradado de BotonVoz. Deuda ya conocida en el mapa SUPERFICIES viejo.' },
    // 🆕 HALLAZGO NUEVO de este mecanismo (el mapa manual NO lo tenía): el walker mide el trazo TAMBIÉN
    // contra el PRIMER stop del degradado de BotonVoz (`glass.accent2`, resuelto a `#f8e0d9`) -- mucho
    // peor que el 3,17:1 ya conocido. El mapa a mano sólo registraba "el offset final"; nunca contra el
    // borde del degradado radial. Se registra como piso, pero VER REPORTE -- corresponde un `pedido_`
    // a planificación, no se arregla acá.
    '#ffffff→#f8e0d9': { min: 1.26, motivo: 'NUEVO (no estaba en SUPERFICIES): isotipo de BotonVoz contra el PRIMER stop (glass.accent2) del degradado radial -- casi invisible. Candidato a pedido_ a planificación.' },
    '#f8e0d9→#ebe7e0': { min: 1.02, motivo: 'ícono de enviar (Composer, chat-enviar) casi invisible contra su propio fondo -- parece estado inactivo/vacío (sin texto en el composer al montar). Pre-existente, no se arregla acá.' },
  },
  oscuro: {
    // 🔴 EL PAR QUE EL DoD DE ESTA TAREA PIDE EXPLÍCITAMENTE COMO EXCEPCIÓN NOMBRADA, NO ARREGLADA ACÁ:
    // `textoTenue` sobre la burbuja del OPERADOR en `PantallaTicket` (piel oscura). El mapa viejo
    // `SUPERFICIES` lo tenía redondeado a "4,381:1"; el walker mide 4,3873:1 sobre el MISMO par real
    // (textoTenue / burbuja `acento+1f` del operador) -- la diferencia de milésimas es el método de
    // redondeo del mapa manual, no una piel distinta. Mismo hallazgo, mecanismo más preciso.
    '#928777→#32201a': { min: 4.38, motivo: 'PantallaTicket: textoTenue sobre la burbuja del operador (oscuro) -- ~4,39:1 (el mapa viejo lo redondeaba a 4,381:1). Deuda ya conocida, NO se arregla en esta tarea (BL-Q4 fila 5).' },
    '#de7250→#322a23': { min: 4.44, motivo: 'acento como texto de acción (mandar por mail / guardar) sobre superficie oscura -- a milésimas de AA.' },
    '#de7250→#312c2a': { min: 4.34, motivo: 'acento como texto del botón "confirmar" (PasoResumen) y variante primario de FilaBotones, piel oscura -- a milésimas de AA.' },
    '#de7250→#3b332d': { min: 3.90, motivo: 'acento como texto de chip seleccionado en CampoSelect, piel oscura.' },
    '#ffffff→#de7250': { min: 3.16, motivo: 'isotipo (trazo blanco) sobre acento sólido -- Marca y último stop del degradado de BotonVoz. Deuda ya conocida en el mapa SUPERFICIES viejo (misma piel que en claro: el acento no cambia entre pieles).' },
    '#ffffff→#f8e0d9': { min: 1.26, motivo: 'NUEVO (no estaba en SUPERFICIES): isotipo de BotonVoz contra el PRIMER stop (glass.accent2) del degradado radial -- casi invisible. Candidato a pedido_ a planificación.' },
    // `tema.color.textoTenue` (#928777) sobre superficies oscuras -- patrón SISTÉMICO en la piel
    // oscura: etiquetas secundarias, placeholders, descripciones de chip, texto de "detalle" en listas.
    // Repetido en 8+ componentes distintos con el MISMO par exacto -- indica que `textoTenue` en piel
    // oscura está, como familia, corriendo cerca del piso AA (no es un caso aislado).
    '#928777→#3a3633': { min: 3.39, motivo: 'textoTenue sobre superficieAlta oscura -- patrón sistémico: PantallaCuenta, PantallaApps, PasoResumen, Composer(placeholder), SeccionMisComprobantes. Pre-existente, no se arregla acá.' },
    '#928777→#3b332d': { min: 3.50, motivo: 'textoTenue sobre el vidrio de campo (EnvolturaCampo/CampoSelect/CampoTexto/CampoFecha), piel oscura -- mismo patrón sistémico que #928777→#3a3633, superficie levemente distinta (vidrio vs. superficieAlta).' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// §7 — El gate en sí: control positivo + un `it` por piel que falla ante cualquier par sub-AA no
// registrado, calcando la ESTRUCTURA de `paresPintadosContraste.test.ts` (web).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('BL-Q4 — pares color/fondo PINTADOS de verdad en mobile (árbol renderizado, no un mapa a mano)', () => {
  it('control del instrumento: existen exactamente 2 pieles vigentes (claro, oscuro)', () => {
    // Sin esto, un `SKINS` vacío o con una tercera piel fantasma haría que todo lo de abajo pasara
    // por no ejecutarse, o dejaría una piel entera sin gate.
    expect(PIELES.sort()).toEqual(['claro', 'oscuro']);
  });

  it('control positivo: el barrido efectivamente encontró pares (el mecanismo no está devolviendo vacío)', () => {
    for (const piel of PIELES) {
      expect(PARES_POR_PIEL[piel].length).toBeGreaterThan(40);
    }
  });

  it('la fórmula de contraste discrimina -- control positivo y negativo', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contraste('#ffffff', '#ffffff')).toBeCloseTo(1, 1);
  });

  for (const piel of PIELES) {
    it(`piel ${piel}: todo par sub-AA (< 4.5:1) está registrado en DEUDA_CONOCIDA, ninguno es nuevo`, () => {
      const fallas: string[] = [];
      for (const par of PARES_POR_PIEL[piel]) {
        const ratio = contraste(par.color, par.bg);
        if (ratio >= 4.5) continue;
        const excepcion = DEUDA_CONOCIDA[piel][clavePar(par)];
        if (!excepcion) {
          fallas.push(`${par.ruta}: ${par.color} sobre ${par.bg} = ${ratio.toFixed(2)}:1 (SIN registrar)`);
          continue;
        }
        if (ratio < excepcion.min - 0.01) {
          fallas.push(`${par.ruta}: ${par.color} sobre ${par.bg} = ${ratio.toFixed(2)}:1 EMPEORÓ el piso registrado (${excepcion.min}:1) -- ${excepcion.motivo}`);
        }
      }
      expect(fallas).toEqual([]);
    });
  }

  it('BL-Q4: el botón de grabar no vuelve al degradado que terminaba en accent2 (1,26:1)', () => {
    // Migrado tal cual de `temaContraste.test.ts` ("auditoría del mapa SUPERFICIES contra el código
    // real") -- regresión concreta ya cazada una vez, se conserva la MISMA aserción sobre el fuente.
    const fs = require('fs');
    const path = require('path');
    const hud = fs.readFileSync(path.join(__dirname, '..', 'modules', 'captura', 'HudGrabacion.tsx'), 'utf8');
    const gradiente = hud.match(/colors=\{\[([^\]]+)\]\}/);
    expect(gradiente).not.toBeNull();
    expect(gradiente[1]).not.toMatch(/accent2/);
    expect(gradiente[1]).toMatch(/glass\.ub1/);
  });
});

/**
 * Migrado de `temaContraste.test.ts` ("auditoría del mapa SUPERFICIES contra el código real"),
 * adaptado per el DoD de esta tarea: antes iteraba `Object.keys(SUPERFICIES)` (el mapa manual que
 * este archivo reemplaza); acá itera los mismos 6 ROLES de color que ese mapa cubría -- siguen
 * existiendo como conceptos del sistema de diseño en `tokens.ts` aunque el mapa manual que los
 * enumeraba ya no exista. Sin esto, un rol que deje de pintarse en ningún componente real (porque
 * alguien lo reemplazó a mano) queda HUÉRFANO en silencio: el walker simplemente no lo encontraría
 * porque ya no está en el árbol de NINGÚN componente montado -- este grep contra el código fuente es
 * la única red que lo cazaría explícitamente.
 */
const ROLES_DE_COLOR_AUDITADOS = ['texto', 'textoTenue', 'acentoTinta', 'peligro', 'exito', 'acentoTexto'] as const;

describe('auditoría de roles de color contra el código real', () => {
  const fs = require('fs');
  const path = require('path');
  const SRC = path.join(__dirname, '..');

  function archivosFuente(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e: { name: string; isDirectory: () => boolean }) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return archivosFuente(p);
      return /\.tsx?$/.test(e.name) ? [p] : [];
    });
  }

  const TODO_EL_SRC = archivosFuente(SRC)
    .filter((p: string) => !p.endsWith('.test.ts') && !p.endsWith('.test.tsx'))
    .map((p: string) => fs.readFileSync(p, 'utf8'))
    .join('\n');

  for (const rol of ROLES_DE_COLOR_AUDITADOS) {
    it(`el rol "${rol}" sigue pintándose en algún componente real`, () => {
      const usado = new RegExp(`(tema|theme|t)\\.color\\.${rol}\\b`).test(TODO_EL_SRC);
      expect(usado).toBe(true);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// §8 — Control negativo CORRIDO (no razonado): un componente con un par realmente sub-AA, NO
// registrado en ningún mapa de excepción, construido con el walker real (render → toJSON →
// `caminarArbol`) para probar que el mecanismo lo detecta -- no un cálculo a mano de `contraste()`.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

function ComponenteIlegibleAPropósito() {
  // Gris casi negro sobre fondo casi negro -- deliberadamente ilegible, y deliberadamente NO tomado de
  // `tema.color.*` (no es un token real: si lo fuera, alguien podría "arreglarlo" sin que este test se
  // entere de que dejó de servir como control).
  return (
    <View style={{ backgroundColor: '#141414' }}>
      <Text testID="control-negativo-texto" style={{ color: '#242424' }}>
        ilegible a propósito -- no debe aparecer en DEUDA_CONOCIDA
      </Text>
    </View>
  );
}

describe('control negativo -- corrido, no razonado', () => {
  it('un par realmente sub-AA, ajeno a cualquier mapa de excepción, es detectado por el mismo caminador', async () => {
    const inst = await render(<ComponenteIlegibleAPropósito />);
    const pares = caminarArbol(inst.toJSON(), SKINS.claro.color.fondo);
    const parMalo = pares.find((p) => p.color === '#242424');
    expect(parMalo).toBeDefined();
    const ratio = contraste(parMalo!.color, parMalo!.bg);
    // eslint-disable-next-line no-console -- el DoD pide la salida REAL, no una afirmación ciega.
    console.log(`[control negativo] ${parMalo!.color} sobre ${parMalo!.bg} = ${ratio.toFixed(4)}:1`);
    expect(ratio).toBeLessThan(4.5);
    // Y NO está en ningún mapa de excepción -- si alguien lo agregara por accidente, este assert lo dice.
    expect(DEUDA_CONOCIDA.claro[clavePar(parMalo!)]).toBeUndefined();
    expect(DEUDA_CONOCIDA.oscuro[clavePar(parMalo!)]).toBeUndefined();
  });
});
