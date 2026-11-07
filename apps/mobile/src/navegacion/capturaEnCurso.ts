import { useSyncExternalStore } from 'react';

/**
 * `capturaEnCurso` — ¿hay AHORA un audio sin resolver en alguna parte de la app?
 *
 * 🔴 **Por qué existe (orden del operador, 2026-11-06).** Cada dock (el del chat, el de Mi día, los de cada función)
 * tiene SU `useVozComando`, o sea su propio grabador. Se podía empezar a grabar en Mi día, deslizar el panel al chat
 * y el audio seguía corriendo, sin que la pantalla donde estaba el mic estuviera a la vista. La regla pedida:
 * *mientras se graba, se bloquea todo hasta que el usuario cancele o envíe*.
 *
 * "Sin resolver" = `grabando`, `pausado` o `listo` (esperando Enviar/Eliminar): cualquier fase distinta de
 * `inactivo`. Es un registro de MÓDULO (no contexto de React) porque lo leen tanto componentes como funciones sin
 * React (`empujarUnaVez`), y porque las pantallas que lo escriben y las que lo leen no comparten árbol.
 *
 * Qué lo consulta: `useVozComando` lo escribe · `PanelDeslizable` no deja mover el panel · `empujarUnaVez` no abre
 * otra función · `DockEntrada` apaga el mic de las OTRAS pantallas (una captura a la vez).
 */
const vivas = new Set<symbol>();
const oyentes = new Set<() => void>();

const avisar = () => oyentes.forEach((o) => o());

/** Marca una captura sin resolver. Devuelve la función que la libera (idempotente). */
export function registrarCaptura(): () => void {
  const id = Symbol('captura');
  vivas.add(id);
  avisar();
  return () => {
    if (vivas.delete(id)) avisar();
  };
}

/** Lectura síncrona, para código que no es un componente. */
export function hayCapturaEnCurso(): boolean {
  return vivas.size > 0;
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Para componentes: se re-renderiza cuando aparece o desaparece una captura sin resolver. */
export function useHayCapturaEnCurso(): boolean {
  return useSyncExternalStore(suscribir, hayCapturaEnCurso, hayCapturaEnCurso);
}

/** Sólo para tests: deja el registro limpio entre casos. */
export function reiniciarCapturasParaTest(): void {
  vivas.clear();
  avisar();
}
