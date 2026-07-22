import { apiClient } from './client';
import { ApiError } from './errors';
import type { ConDisponibilidad } from './afip';

/**
 * "Esta capacidad no está en este deploy" — mismo criterio que `afip.ts`, y aplica por la misma
 * razón: ninguna de estas rutas tiene segmento dinámico, así que un 404 sólo puede significar "la
 * ruta no existe", nunca "el recurso que pediste no existe".
 *
 * 🔴 **El 405 también, y no es teoría.** El front-door monta un catch-all `@app.get("/{full_path}")`
 * para servir el SPA (`web.py:141`), así que una ruta no desplegada **matchea** ese handler y
 * FastAPI responde `405 Method Not Allowed` a cualquier verbo que no sea GET — nunca 404. Medido
 * contra el servicio vivo el 2026-07-21: `DELETE /composio/connection` y `DELETE /mp/connection`
 * devuelven 405, con un `GET /catalog` → 200 en la misma corrida como control de que el cliente
 * funcionaba. Sin esto, "el endpoint todavía no existe" le llegaría al usuario como *"no pudimos
 * desconectar, probá de nuevo"* — invitándolo a reintentar algo que no puede funcionar.
 */
function noDesplegado(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501);
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
  /**
   * El path al que mandar el `DELETE` para desconectar. **Pedido al backend el 2026-07-21, todavía
   * NO confirmado** — mientras no venga, `desconectarServicio` usa `PATH_DESCONEXION_ASUMIDO`.
   *
   * 🔴 Se pide como campo del catálogo por la MISMA razón que `connect_path` demostró servir: la
   * regla "Composio va por un lado, MercadoPago por otro" tiene un solo dueño, y no es el cliente.
   */
  disconnectPath?: string;
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
  disconnect_path?: string;
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
    disconnectPath: s.disconnect_path,
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

/**
 * Fallback del path de desconexión para un backend viejo que todavía no manda `disconnect_path` en
 * el catálogo. **Ya NO es un supuesto:** el backend confirmó y desplegó exactamente esta forma el
 * 2026-07-21 (`coordinacion/2026-07-21_listo_backend-desconexion-endpoints-vivos.md`), y el catálogo
 * ya trae `disconnect_path`, que gana sobre esto. Se conserva sólo para el caso degradado
 * —despliegue viejo del backend, campo ausente—, igual que el resto de la app tolera campos que un
 * deploy anterior no manda.
 *
 * 🔴 Toma el SLUG, nunca un `connection_id`. Mandar el id desde el cliente permitiría revocar la
 * conexión de otro tenant probando ids (BOLA / OWASP API1:2023); resolver "qué conexión es" a partir
 * del JWT es responsabilidad del backend y no puede delegarse a un parámetro del cliente. El backend
 * lo confirmó con un test adversarial (tenant A no puede tocar el toolkit de B).
 */
function PATH_DESCONEXION_ASUMIDO(servicio: ServicioCatalogo): string {
  return servicio.kind === 'payments'
    ? '/mp/connection'
    : `/composio/connection?service=${encodeURIComponent(servicio.key)}`;
}

/**
 * Desconecta un servicio ya vinculado. **Destructivo**: el copiloto pierde el acceso hasta que el
 * usuario vuelva a autorizar.
 *
 * ⚠️ Devolver `ok` NO autoriza a pintar "desconectado". Quien llame tiene que RE-CONSULTAR el
 * catálogo — la fuente de verdad es `conectado`, no el resultado de haber pedido la baja. Mismo
 * criterio que `pedirLinkDeVinculacion`, y por el mismo motivo: la acción y el hecho son dos cosas.
 *
 * 🔴 **El 404 es ÉXITO acá, no "no desplegado".** Verificado contra el servicio vivo el 2026-07-21:
 * el backend devuelve `404 "el tenant no tiene X conectado"` cuando no había nada que revocar —el
 * estado deseado (desconectado) ya se cumple—, y reserva el `400` para un slug inválido. La baja es
 * idempotente. Distinto del `405` del catch-all del SPA, que sí es "el endpoint no existe en este
 * deploy": por eso `no_disponible` mira 405/501, no 404. Sin esta distinción, desconectar algo que
 * otro dispositivo ya desconectó le diría al usuario "todavía no está disponible" sobre una baja que
 * de hecho está hecha.
 */
export async function desconectarServicio(
  servicio: ServicioCatalogo,
): Promise<{ status: 'ok' } | { status: 'no_disponible' }> {
  const path = servicio.disconnectPath ?? PATH_DESCONEXION_ASUMIDO(servicio);
  try {
    await apiClient.del<unknown>(path);
    return { status: 'ok' };
  } catch (err) {
    // 404 = "no había nada conectado": la baja es idempotente, el estado deseado ya se cumple.
    if (err instanceof ApiError && err.status === 404) return { status: 'ok' };
    // 405/501 = el endpoint no existe en este deploy (catch-all del SPA). Ahí sí, no disponible.
    if (err instanceof ApiError && (err.status === 405 || err.status === 501)) return { status: 'no_disponible' };
    throw err;
  }
}
