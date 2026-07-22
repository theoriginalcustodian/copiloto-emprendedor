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
 *
 * 🔴 **`comprobanteId` es OTRA cosa y por eso es otro parámetro.** Lo pone la lista de actividad y es
 * el id de FILA de `afip_comprobantes` — abre el detalle de un comprobante ya emitido. `facturaId` es
 * el id del **workflow de emisión** y sirve mientras se emite. Dos espacios de ids, los dos legítimos:
 * mezclarlos en un solo parámetro obligaría a adivinar cuál vino.
 */
export default function PantallaFacturacionRoute() {
  const { facturaId, comprobanteId } = useLocalSearchParams<{
    facturaId?: string;
    comprobanteId?: string;
  }>();

  // String de la URL a número, con guarda: un valor no numérico significa un link armado a mano, y
  // pasarlo igual haría pedir un id inválido y mostrar un error donde no pasó nada.
  const idComprobante =
    comprobanteId != null && /^\d+$/.test(comprobanteId) ? Number(comprobanteId) : undefined;
  // `''` no es un id: un parámetro presente pero vacío tiene que caer en el camino normal (crear un
  // borrador), no adoptar un borrador que no existe.
  return (
    <PantallaFacturacion
      facturaIdInicial={facturaId !== '' ? facturaId : undefined}
      comprobanteIdInicial={idComprobante}
    />
  );
}
