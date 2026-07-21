import { PantallaPerfilNegocio } from '../src/modules/ajustes/negocio/PantallaPerfilNegocio';

/**
 * Ruta de "Mi negocio" (Ajustes → perfil del negocio + personalidad del copiloto) -- mismo patrón que
 * `app/ajustes-afip.tsx`: archivo mínimo que re-exporta la pantalla real. `PantallaPerfilNegocio`
 * trae su propio `MarcoGlass`; el `presentation: 'transparentModal'` vive en `app/_layout.tsx`.
 *
 * Es una pantalla HOJA (no lanza nada) -- no participa de `empujarUnaVez`/`reabrirNavegacion`. Se
 * llega acá desde `app/ajustes.tsx` (tile "Mi negocio") vía `empujarUnaVez('/ajustes-negocio')`.
 */
export default function PantallaAjustesNegocioRoute() {
  return <PantallaPerfilNegocio />;
}
