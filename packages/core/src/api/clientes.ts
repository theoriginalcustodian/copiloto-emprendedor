import { apiClient, mapearError, safeJson } from './client';
import { config } from './config';
import { DuplicadoProbableError, GeneroInvalidoError } from './errors';
import type { MotivoDuplicado } from './errors';
import type { PeticionHttp } from './http';
import type {
  ActualizarClienteRequest,
  CrearClienteRequest,
  OpcionesCliente,
  Cliente,
  ClienteDetalle,
} from './types';

/**
 * Adaptado del `/pacientes` de origen (decisión D7 del plan de puertos móviles: "pacientes pasa a
 * Clientes, el CRM va adentro después"). El shape se preservó estructuralmente (`genero`/`notas`
 * incluidos) porque el diseño real del CRM del emprendedor es trabajo FUTURO, no de este port — acá
 * sólo se renombró la entidad para que el paquete no quede hablando en vocabulario clínico.
 */

/**
 * GET /clientes?q=&limit= — Bearer requerido. Lista/busca clientes ACTIVOS del tenant (tolerante
 * a acentos/typos server-side vía `unaccent`+`pg_trgm` en el backend de origen). `dni_parcial` viene
 * YA enmascarado — esta ruta nunca expone el DNI completo.
 */
export function listarClientes(q = '', limit = 20): Promise<Cliente[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return apiClient.get<Cliente[]>(`/clientes?${params.toString()}`);
}

/**
 * GET /clientes/{id} — Bearer requerido. 404 si no existe O es de otro tenant (los dos casos son
 * indistinguibles a propósito, para no filtrar por canal lateral si un cliente ajeno existe).
 * Devuelve `ClienteDetalle` (trae `genero` + `notas`) — a diferencia de `listarClientes`, que
 * devuelve `Cliente` a secas porque el backend omite `notas` del listado.
 */
export function obtenerCliente(id: string): Promise<ClienteDetalle> {
  return apiClient.get<ClienteDetalle>(`/clientes/${encodeURIComponent(id)}`);
}

/**
 * GET /clientes/opciones — Bearer requerido. El catálogo de género vive en una TABLA, no en el
 * schema/enum — agregar una opción es un `INSERT`, no un release de la app. 🔴 Consumir SIEMPRE esta
 * función: hardcodear los `codigo` actuales vuelve a congelar la lista y anula la decisión del
 * operador (ver docstring de `OpcionesCliente`).
 */
export function obtenerOpcionesCliente(): Promise<OpcionesCliente> {
  return apiClient.get<OpcionesCliente>('/clientes/opciones');
}

/**
 * Detecta el 400 `genero_invalido` compartido por `POST /clientes` y `PATCH /clientes/{id}`
 * (mismo shape de `detail` en los dos) — un solo lugar para no duplicar el parseo del detail envuelto.
 */
function generoInvalidoDeDetail(detail: unknown): { genero: string | null; generos: OpcionesCliente['generos'] } | null {
  if (
    detail &&
    typeof detail === 'object' &&
    (detail as { motivo?: unknown }).motivo === 'genero_invalido' &&
    Array.isArray((detail as { generos: unknown }).generos)
  ) {
    const d = detail as { genero: string | null; generos: OpcionesCliente['generos'] };
    return { genero: d.genero ?? null, generos: d.generos };
  }
  return null;
}

/**
 * PATCH /clientes/{id} — Bearer requerido. **PARCIAL DE VERDAD** (ver `ActualizarClienteRequest`):
 * sólo se serializan las claves que el caller mandó en `datos` — un campo AUSENTE del objeto no
 * aparece en el JSON (`JSON.stringify` omite `undefined`), un campo en `null` SÍ viaja y borra. El
 * caller es responsable de armar `datos` con SÓLO lo que el usuario editó (ver test central en
 * `clientes.test.ts`: un PATCH de sólo `genero` no debe llevar la clave `notas`).
 *
 * NO usa `apiClient` (que sólo expone `get`/`post`) — llama al `HttpPort` directo, mismo criterio que
 * `crearCliente`. 400 → `GeneroInvalidoError` con el catálogo adjunto. 404 → `ApiError` genérico
 * (cliente ajeno o inexistente, indistinguibles a propósito).
 */
export async function actualizarCliente(id: string, datos: ActualizarClienteRequest): Promise<ClienteDetalle> {
  const { http, tokens } = config();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await tokens.leerToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const peticion: PeticionHttp = {
    metodo: 'PATCH',
    path: `/clientes/${encodeURIComponent(id)}`,
    headers,
    cuerpoJson: datos,
  };
  const res = await http.enviar(peticion);

  if (res.ok) return (await res.json()) as ClienteDetalle;

  const body = await safeJson(res);
  const detailValue = body && typeof body === 'object' && 'detail' in body ? (body as { detail: unknown }).detail : undefined;

  if (res.status === 400) {
    const invalido = generoInvalidoDeDetail(detailValue);
    if (invalido) throw new GeneroInvalidoError(invalido.genero, invalido.generos);
  }
  return mapearError(res.status, body);
}

function duplicadoDeDetail(detail: unknown): { candidatos: Cliente[]; motivo: MotivoDuplicado } | null {
  if (
    detail &&
    typeof detail === 'object' &&
    'duplicado_probable' in detail &&
    Array.isArray((detail as { duplicado_probable: unknown }).duplicado_probable)
  ) {
    const d = detail as { duplicado_probable: Cliente[]; motivo?: unknown };
    // El backend siempre manda `motivo`; ante un contrato viejo/inesperado, el default seguro es
    // `dni_duplicado` (NO forzable) — nunca ofrecer "crear igual" por un dato que falta.
    const motivo: MotivoDuplicado = d.motivo === 'similitud' ? 'similitud' : 'dni_duplicado';
    return { candidatos: d.duplicado_probable, motivo };
  }
  return null;
}

/**
 * POST /clientes — Bearer requerido. 201 → el cliente creado. 409 → `DuplicadoProbableError` con
 * los candidatos (NUNCA se relanza como `ApiError` genérico: el caller necesita los candidatos para
 * poder preguntar "¿es alguno de estos?").
 *
 * NO usa `apiClient.post` — llama al `HttpPort` directo: `client.ts` sólo preserva `detail` cuando es
 * un STRING vía `mapearError`, y el 409 de este endpoint manda un `detail` OBJETO
 * (`{duplicado_probable: [...]}`) que se perdería silenciosamente si pasara por el camino genérico.
 * Para el resto de los status (401/403/genérico) SÍ reusa `mapearError`.
 */
export async function crearCliente(datos: CrearClienteRequest): Promise<Cliente> {
  const { http, tokens } = config();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await tokens.leerToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await http.enviar({ metodo: 'POST', path: '/clientes', headers, cuerpoJson: datos });

  if (res.ok) return (await res.json()) as Cliente;

  const body = await safeJson(res);
  // FastAPI envuelve SIEMPRE el `detail` de `HTTPException` bajo `{"detail": ...}` -- para este
  // endpoint ese `detail` es un OBJETO (`{duplicado_probable: [...]}`), no un string (a diferencia
  // del resto de errores del backend) -- hay que desenvolverlo antes de buscar `duplicado_probable`.
  const detailValue = body && typeof body === 'object' && 'detail' in body ? (body as { detail: unknown }).detail : undefined;

  if (res.status === 409) {
    const dup = duplicadoDeDetail(detailValue);
    if (dup) throw new DuplicadoProbableError(dup.candidatos, dup.motivo);
  }
  // Mismo 400 `genero_invalido` que el PATCH (reusa el mismo parseo, ver `generoInvalidoDeDetail`).
  if (res.status === 400) {
    const invalido = generoInvalidoDeDetail(detailValue);
    if (invalido) throw new GeneroInvalidoError(invalido.genero, invalido.generos);
  }
  return mapearError(res.status, body);
}
