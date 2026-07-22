import { PantallaAndamiaje } from '../src/modules/ajustes';

/** Ruta del tile "Plan actual". Andamiaje: sin catálogo de planes no hay plan que informar. */
export default function AjustesPlanRoute() {
  return (
    <PantallaAndamiaje
      titulo="Plan actual"
      icono="chart"
      testID="pantalla-ajustes-plan"
      mensaje={
        'Acá vas a ver tu plan, qué incluye y cuándo se renueva. Todavía no hay planes definidos, ' +
        'así que no hay nada que informar — y decirte "plan gratuito" sin que eso exista sería ' +
        'inventarte una condición comercial.'
      }
    />
  );
}
