import { useEffect, useRef, useState } from 'react';

/** `123` s → `"02:03"`. Pura y exportada: es lo único acá que un test afirma de verdad (el resto es
 *  un timer que se verifica mirándolo, no leyendo el árbol de React). */
export function formatoMMSS(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * El cronómetro del HUD de grabación (el `00:04` del template `DocuMed App.dc.html`). Tickea mientras
 * `corriendo` (fase `grabando`), se CONGELA cuando no (fase `pausado`), y se reinicia al cambiar de
 * sesión (`clave`). Es un afford de DISPLAY, no estado clínico: vive en la vista, igual que el `recSec`
 * del prototipo -- la máquina (`panelMachine.ts`) no trackea tiempo, y no debe.
 *
 * Cuenta por reloj de pared (`Date.now`), no por conteo de intervalos: en una consulta de 40 minutos
 * el hilo de JS está ocupado guardando segmentos y un contador de ticks driftearía justo en la sesión
 * más larga. `semillaMs` (suma de `segmentos.duracionMs`) lo arranca donde corresponde al RETOMAR una
 * grabación huérfana recuperada, en vez de en cero.
 */
export function useCronometroGrabacion(corriendo: boolean, semillaMs: number, clave: string): number {
  const [segundos, setSegundos] = useState(Math.floor(semillaMs / 1000));
  // Tiempo acumulado hasta el último pause/seed (ms). El tramo en curso se suma por reloj de pared.
  const acumuladoRef = useRef(semillaMs);
  // La semilla más reciente, leída SÓLO al reiniciar por sesión nueva (no re-seedear a mitad de
  // grabación: ahí manda el reloj de pared, no la suma de segmentos que aún está flusheándose).
  const semillaRef = useRef(semillaMs);
  semillaRef.current = semillaMs;

  // Reinicio al cambiar de sesión: una segunda grabación no puede heredar el tiempo de la anterior.
  useEffect(() => {
    acumuladoRef.current = semillaRef.current;
    setSegundos(Math.floor(semillaRef.current / 1000));
  }, [clave]);

  useEffect(() => {
    if (!corriendo) return;
    const inicio = Date.now();
    const id = setInterval(() => {
      setSegundos(Math.floor((acumuladoRef.current + (Date.now() - inicio)) / 1000));
    }, 250);
    // Al pausar/desmontar: pliega el tramo en curso al acumulado, así reanudar sigue desde donde iba.
    return () => {
      clearInterval(id);
      acumuladoRef.current += Date.now() - inicio;
      setSegundos(Math.floor(acumuladoRef.current / 1000));
    };
  }, [corriendo]);

  return segundos;
}
