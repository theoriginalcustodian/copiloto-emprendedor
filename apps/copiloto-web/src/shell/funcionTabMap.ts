import type { FuncionKey } from '../modules/escritorio';

import type { TabKey } from './TabBar';

/**
 * Mapeo `FuncionKey` (tile de `EscritorioScreen`) → `TabKey` del shell. `null` = la función
 * todavía no tiene tab propio en la web (facturación sigue en construcción -- PR2-4 pendientes --
 * y ajustes espera definición de UX, ver `pregunta_frontend-a-planificacion_MWEB-modulo13-...`).
 * Compartido entre `AppShell` y `DesktopShell` para no duplicar la lista.
 */
export const FUNCION_A_TAB: Readonly<Record<FuncionKey, TabKey | null>> = {
  facturacion: null,
  ingresos: 'ingresos',
  gastos: 'gastos',
  presupuestos: 'presupuestos',
  clientes: 'clientes',
  midia: 'midia',
  inteligencia: 'inteligencia',
  contabilidad: 'contabilidad',
  ajustes: null,
};
