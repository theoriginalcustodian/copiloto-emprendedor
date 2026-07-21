import { apiClient } from './client';
import { ApiError } from './errors';
import type { ConDisponibilidad } from './afip';

/** Un 404/501 es "esta capacidad no está en este deploy" — mismo criterio que `afip.ts`, y aplica
 *  por la misma razón: ninguna de estas dos rutas tiene segmento dinámico, así que un 404 sólo puede
 *  significar "la ruta no existe", nunca "el recurso que pediste no existe". */
function noDesplegado(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.status === 501);
}

/**
 * `/catalog` y `/composio/connect` — las integraciones del emprendedor y cómo vincularlas.
 *
 * 🔴 **El catálogo lo decide el BACKEND, no una lista en el cliente.** `build_catalog` lo arma desde
 * la policy real de toolkits (`_composio_valid_toolkits()`, la MISMA fuente que valida
 * `/composio/connect`), así que agregar un servicio del lado del servidor lo hace aparecer acá sin
 * tocar una línea de app. La pantalla de Apps tenía la lista de los ocho servicios **hardcodeada** —
 * se veía idéntica mientras coincidiera, y habría mentido en silencio el día que divergiera.
 *
 * 🔴 **`connectPath` viene del backend y se usa TAL CUAL.** No se reconstruye acá (`/composio/connect?
 * service=` para los toolkits, `/mp/connect` para MercadoPago, que no es Composio): duplicar esa regla
 * en el cliente es crear una segunda fuente de verdad que puede driftear de la única que importa.
 *
 * 🔴 `cliente_id` sale del JWT del lado del servidor. Nada acá lo acepta ni lo manda: no hay forma de
 * pedir el catálogo —ni un link de vinculación— de otro tenant.
 */

/** Una integración del catálogo (`catalog._entry`), normalizada a camelCase. */
export interface ServicioCatalogo {
  /** El slug real del toolkit (`googledrive`, `gmail`…) o `mercadopago`. */
  key: string;
  nombre: string;
  /** Etiqueta corta orientada al trabajo ("Archivos", "Mail"), no al producto. */
  etiquetaTrabajo: string;
  categoria: string;
  /** `composio` para los toolkits; `payments` para MercadoPago, que tiene su propio flujo. */
  kind: string;
  descripcion: string;
  capacidades: string[];
  /**
   * ¿Está vinculado y ACTIVE para este tenant? Lo calcula el backend con el mismo criterio que
   * `drive_conectado` de `/afip/estado`: una conexión EXPIRED cuenta como NO conectada, porque
   * existe pero no sirve para trabajar.
   */
  conectado: boolean;
  /** El path que hay que pedir para obtener el link de vinculación. Del backend, sin reconstruir. */
  connectPath: string;
}

interface ServicioCrudo {
  key: string;
  display_name: string;
  work_label: string;
  category: string;
  kind: string;
  description: string;
  capabilities: string[];
  connected: boolean;
  connect_path: string;
}

function normalizar(s: ServicioCrudo): ServicioCatalogo {
  return {
    key: s.key,
    nombre: s.display_name,
    etiquetaTrabajo: s.work_label,
    categoria: s.category,
    kind: s.kind,
    descripcion: s.description,
    capacidades: s.capabilities ?? [],
    conectado: s.connected,
    connectPath: s.connect_path,
  };
}

/**
 * El catálogo de ESTE tenant, con el estado de conexión de cada servicio.
 *
 * Verificado contra el servicio vivo el 2026-07-21: 8 servicios (mercadopago + 7 toolkits Composio),
 * `connected` y `connect_path` presentes en todos.
 */
export async function listarCatalogo(): Promise<ConDisponibilidad<{ servicios: ServicioCatalogo[] }>> {
  try {
    const raw = await apiClient.get<{ services: ServicioCrudo[] }>('/catalog');
    return { status: 'ok', servicios: (raw.services ?? []).map(normalizar) };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * Pide el link de vinculación de un servicio. Devuelve la URL que hay que ABRIR en un navegador —
 * el flujo se completa afuera de la app, autorizando con la cuenta del proveedor.
 *
 * 🔴 **Recibe el `connectPath` del catálogo, no una `key`.** Construir el path acá repetiría la regla
 * "Composio va por un lado y MercadoPago por otro", que ya vive del lado del backend.
 *
 * ⚠️ **Lo que devolver una URL NO prueba.** Que el backend entregue un link válido no significa que
 * la vinculación se complete: eso depende de que el usuario autorice en el navegador. Quien llame a
 * esto no puede pintar "conectado" al volver — tiene que RE-CONSULTAR el catálogo y creerle a
 * `conectado`. Es el mismo error que ya pagamos dos veces esta semana: afirmar un hecho a partir de
 * haber iniciado la acción que lo produciría.
 */
export async function pedirLinkDeVinculacion(connectPath: string): Promise<{ status: 'ok'; url: string } | { status: 'no_disponible' }> {
  try {
    const raw = await apiClient.get<{ url: string }>(connectPath);
    return { status: 'ok', url: raw.url };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    throw err;
  }
}
