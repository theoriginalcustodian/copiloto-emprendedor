import type { FuncionKey } from '../modules/escritorio';

import type { TabKey } from './TabBar';

/**
 * Mapeo `FuncionKey` (tile de `EscritorioScreen`) → `TabKey` del shell. Con `facturacion` y
 * `ajustes` wireados, los 9 tiles del escritorio ya tienen tab propio -- no queda ningún `null` en
 * este mapa (se conserva el tipo `TabKey | null` por si un futuro tile llega sin tab todavía).
 * Compartido entre `AppShell` y `DesktopShell` para no duplicar la lista.
 */
export const FUNCION_A_TAB: Readonly<Record<FuncionKey, TabKey | null>> = {
  facturacion: 'facturacion',
  ingresos: 'ingresos',
  gastos: 'gastos',
  presupuestos: 'presupuestos',
  clientes: 'clientes',
  midia: 'midia',
  inteligencia: 'inteligencia',
  contabilidad: 'contabilidad',
  ajustes: 'ajustes',
};
