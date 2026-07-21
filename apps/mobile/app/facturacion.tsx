import { useLocalSearchParams } from 'expo-router';

import { PantallaFacturacion } from '../src/modules/facturacion/PantallaFacturacion';

/**
 * Ruta de "Facturación" — mismo patrón que `app/apps.tsx`. `PantallaFacturacion` trae su propio
 * `MarcoGlass`; ver ese archivo para el porqué del ícono/título compartidos con el tile de entrada.
 *
 * 🔴 **`facturaId` opcional en la URL.** Lo pone el botón "Facturar" del detalle de un presupuesto:
 * el backend ya armó el borrador con sus ítems y esta pantalla tiene que adoptarlo en vez de crear
 * uno vacío. Entrar por el tile del escritorio no lleva parámetro y el comportamiento es el de
 * siempre. Ver `PantallaFacturacionProps.facturaIdInicial`.
 */
export default function PantallaFacturacionRoute() {
  const { facturaId } = useLocalSearchParams<{ facturaId?: string }>();
  // `''` no es un id: un parámetro presente pero vacío tiene que caer en el camino normal (crear un
  // borrador), no adoptar un borrador que no existe.
  return <PantallaFacturacion facturaIdInicial={facturaId !== '' ? facturaId : undefined} />;
}
