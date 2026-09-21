import type { FuncionKey } from '../modules/escritorio';

import type { TabKey } from './TabBar';

/**
 * Mapeo `FuncionKey` (tile de `EscritorioScreen`) → `TabKey` del shell. Ajustes y Mi día NO son tiles (BL-X1, como mobile): Mi día es la portada y Ajustes se entra por el avatar. Los tiles del escritorio ya tienen tab propio -- no queda ningún `null` en
 * este mapa (se conserva el tipo `TabKey | null` por si un futuro tile llega sin tab todavía).
 * Compartido entre `AppShell` y `DesktopShell` para no duplicar la lista.
 */
export const FUNCION_A_TAB: Readonly<Record<FuncionKey, TabKey | null>> = {
  facturacion: 'facturacion',
  ingresos: 'ingresos',
  gastos: 'gastos',
  presupuestos: 'presupuestos',
  clientes: 'clientes',
  inteligencia: 'inteligencia',
  contabilidad: 'contabilidad',
};
