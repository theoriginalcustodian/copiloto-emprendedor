import { PantallaAndamiaje } from '../src/modules/ajustes';

/**
 * Ruta del tile "Planes disponibles". Andamiaje: no hay catálogo de planes en el backend todavía.
 * Inventar precios acá sería peor que no mostrar nada — un número de mentira se cita después como
 * si fuera cierto.
 */
export default function AjustesPlanesRoute() {
  return (
    <PantallaAndamiaje
      titulo="Planes disponibles"
      icono="folder"
      testID="pantalla-ajustes-planes"
      mensaje={
        'Acá van a estar los planes y sus precios. Todavía no hay ninguno definido, y preferimos ' +
        'decirlo antes que mostrarte precios inventados.'
      }
    />
  );
}
