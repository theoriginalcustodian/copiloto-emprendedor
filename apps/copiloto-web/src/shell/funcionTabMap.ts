import type { FuncionKey } from '../modules/escritorio';

import type { TabKey } from './TabBar';

/**
 * Mapeo `FuncionKey` (tile de `EscritorioScreen`) → `TabKey` del shell. `null` = la función
 * todavía no tiene tab propio en la web (facturación sigue en construcción -- PR4 de integración
 * final + su propio wiring de shell, pendiente en paralelo). Compartido entre `AppShell` y
 * `DesktopShell` para no duplicar la lista.
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
  ajustes: 'ajustes',
};
