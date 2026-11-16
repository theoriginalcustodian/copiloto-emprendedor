import { Alert, Share } from 'react-native';

import { formatearImporteSinCentavosCero, type Presupuesto } from '@copiloto/core';

/**
 * El presupuesto como TEXTO, para mandarlo por WhatsApp cuando no hay documento de Google (Martin 14/11).
 * Sin Google conectado un presupuesto guardado no tenía ninguna forma de salir del teléfono.
 *
 * 🔴 No calcula nada: el total es el del backend y los ítems van como vinieron. Si el presupuesto llegó sin
 * ítems (el listado no los trae), el texto los omite en vez de inventarlos.
 */
export function textoPresupuesto(p: Presupuesto): string {
  const lineas: string[] = [];
  lineas.push(`Presupuesto N° ${p.numero}${p.concepto.trim() !== '' ? ` — ${p.concepto.trim()}` : ''}`);
  if (p.receptor.nombre.trim() !== '') lineas.push(`Para: ${p.receptor.nombre.trim()}`);
  if (p.items.length > 0) {
    lineas.push('');
    for (const it of p.items) {
      lineas.push(`• ${it.descripcion} — ${it.cantidad} × ${formatearImporteSinCentavosCero(it.precioUnitario)}`);
    }
  }
  lineas.push('');
  lineas.push(`Total: ${formatearImporteSinCentavosCero(p.total)}`);
  return lineas.join('\n');
}

/**
 * Abre la hoja de compartir del teléfono (WhatsApp, mail, copiar…). Con documento manda su link; sin él, el
 * texto. Odobi no manda por WhatsApp ni necesita el teléfono del cliente: el contacto lo resuelve el celular
 * — mismo criterio que «Compartilo por WhatsApp» del link de cobro.
 */
export async function compartirPresupuesto(p: Presupuesto): Promise<boolean> {
  const encabezado = `Presupuesto N° ${p.numero}${p.concepto.trim() !== '' ? ` — ${p.concepto.trim()}` : ''}`;
  try {
    await Share.share(p.docLink != null ? { message: `${encabezado}\n${p.docLink}` } : { message: textoPresupuesto(p) });
    return true;
  } catch {
    Alert.alert('No se pudo compartir el presupuesto', 'Probá de nuevo en un momento.');
    return false;
  }
}
