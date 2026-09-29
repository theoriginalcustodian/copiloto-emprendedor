import type { EstadoConexion } from '@copiloto/core';

/**
 * `AvisoConexionCalendario` (BL-V23) — aviso de "calendario no disponible" compartido entre
 * `MidiaScreen` (origen, BL-W11 fila 4b) y `AgendaScreen`: los dos endpoints (`/mi-dia/calendario`,
 * `/mi-dia/agenda`) sólo traen `conectado: boolean` y agrupan bajo `false` DOS casos que no
 * distinguen — "nunca conectada" y "caída". `Agenda` no leía esa distinción y le decía «Conectá» a
 * quien ya había conectado y sólo se le cayó la conexión, mandándolo a repetir un paso que ya hizo.
 *
 * `estadoConexion` viene de `estadoDeServicio` sobre el catálogo (K-09), leído aparte de cada panel
 * y fail-soft: `null` (sin catálogo, catálogo caído, backend viejo) degrada a "nunca conectada" — la
 * lectura menos alarmante ante la duda, igual que el comportamiento antes de que existiera esta señal.
 *
 * El texto y el testid de cada rama los define el llamador (no se hardcodean acá): las dos pantallas
 * hablan de cosas distintas ("tus eventos de hoy" / "tu agenda") y ya tenían testids propios antes de
 * este componente — extraer la rama no debía forzarlos a cambiar.
 */
export function AvisoConexionCalendario({
  estadoConexion,
  testIdCaida,
  testIdNoConectado,
  mensajeCaida,
  mensajeNoConectado,
}: {
  estadoConexion: EstadoConexion | null;
  testIdCaida: string;
  testIdNoConectado: string;
  mensajeCaida: string;
  mensajeNoConectado: string;
}) {
  if (estadoConexion === 'caido') {
    return (
      <p className="midia-screen__calendario-invitacion" data-testid={testIdCaida}>
        {mensajeCaida}
      </p>
    );
  }
  return (
    <p className="midia-screen__calendario-invitacion" data-testid={testIdNoConectado}>
      {mensajeNoConectado}
    </p>
  );
}
