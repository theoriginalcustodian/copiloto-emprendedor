import { almacenClave } from '../../adapters/almacen';

/**
 * `cuitCache` — el CUIT del emprendedor, cacheado localmente.
 *
 * 🔴 **Es una CACHÉ, nunca la fuente de verdad.** La fuente es `estadoAfip()` del core, que desde el
 * 2026-07-21 devuelve `cuit` resuelto por el backend con `primer_cuit()`. El pedido que originó ese
 * endpoint (`coordinacion/2026-07-21_pedido_frontend-a-backend-afip.md` §2) explica por qué el front no
 * puede ser dueño de este dato: *"el emprendedor cambia de teléfono, la app no encuentra el CUIT local,
 * y le muestra 'cargá tus datos fiscales' sobre un perfil que existe en la base"* — el peor error
 * posible en esta pantalla, porque lo empuja a rehacer el alta.
 *
 * Entonces, ¿para qué sirve? Para la **primera pintura**: evita que la pantalla arranque sin CUIT y
 * parpadee al CTA de configuración mientras `estadoAfip()` viaja. Si la caché y el backend difieren,
 * **gana el backend**.
 *
 * 🔴 **Vive acá, en `modules/afip/`, y no dentro de una de las dos pantallas, porque las DOS lo usan**
 * — `ajustes/afip/PantallaAfipSetup` lo escribe al guardar el perfil o completar el alta, y
 * `facturacion/PantallaFacturacion` lo lee para su primera pintura. Nació duplicado (dos
 * implementaciones idénticas, escritas en paralelo, que por casualidad coincidieron hasta en el literal
 * de la clave) y se unificó apenas se detectó: dos copias de la misma clave de almacenamiento divergen
 * solas, y el día que una cambie el string la otra deja de encontrar el dato **sin ningún error** —
 * simplemente vuelve a pedir configurar algo que ya estaba configurado.
 *
 * Reusa `almacenClave` (`src/adapters/almacen.ts`), el mismo adaptador que la sesión y el tema, en vez
 * de una segunda envoltura de `AsyncStorage`: ese archivo ya documenta que duplicar el wrapper fue un
 * hallazgo a corregir.
 */
export const CLAVE_CUIT_AFIP = 'copiloto-afip-cuit';

/** `null` si nunca se guardó nada. Best-effort: `almacenClave.leer` ya degrada en silencio. */
export async function leerCuitCacheado(): Promise<string | null> {
  return almacenClave.leer(CLAVE_CUIT_AFIP);
}

export async function guardarCuitCacheado(cuit: string): Promise<void> {
  await almacenClave.guardar(CLAVE_CUIT_AFIP, cuit);
}
