import { PantallaAndamiaje } from '../src/modules/ajustes/PantallaAndamiaje';

/**
 * Ruta de "Mi plan" — **fusión** de las dos rutas que se pisaban, `ajustes-plan` (Plan actual) y
 * `ajustes-planes` (Planes disponibles). Dos tiles para un solo concepto es exactamente lo que
 * confunde a alguien que entró a configurar algo, y las dos renderizaban el mismo andamiaje.
 *
 * 🔴 **Sigue siendo andamiaje a propósito.** El contenido real —qué incluye el plan, cuánto usaste,
 * cómo cambiarlo— necesita backend y va en su propio contrato. Lo que se eliminó acá es la
 * DUPLICACIÓN, no la pantalla pendiente: inventarle contenido sería un dato de mentira sobre algo
 * que se cobra.
 */
export default function PantallaMiPlanRoute() {
  return (
    <PantallaAndamiaje
      titulo="Mi plan"
      icono="chart"
      mensaje="Acá vas a ver tu plan actual, qué incluye y cómo cambiarlo. Todavía no está conectado."
      testID="pantalla-mi-plan"
    />
  );
}
