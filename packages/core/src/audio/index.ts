// 🔴 `panelMachine.ts`, `purgador.ts` y `proteccionDurable.ts` NO se portaron (descartar, D6) — ver
// la nota en `ports.ts` sobre por qué sólo el grabador sobrevive. La máquina de estados del panel de
// captura (`panelMachine.ts`) es trabajo de UI a reconstruir contra el flujo real de este producto, no
// algo que sobreviva un port mecánico.
export * from './types';
export * from './ports';
export * from './nivel';
