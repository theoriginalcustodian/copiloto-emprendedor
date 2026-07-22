import { apiClient } from './client';
import type { FormatosNota } from './types';

/**
 * GET /nota/formatos — Bearer requerido. El catálogo de formatos de entrada (heredado del proyecto de
 * origen, donde catalogaba tipos de nota clínica) lo DERIVA el backend de sus plantillas de redacción
 * — a diferencia de los géneros, un formato NO es un dato puro sino dato + plantilla; su fuente de
 * verdad es la plantilla, no una tabla, para que no drifteen. Desde el cliente da igual el origen:
 * consumir SIEMPRE esta función, nunca hardcodear la lista.
 *
 * 🔴 NO HARDCODEAR LA LISTA. El tipo de nota es una decisión DEL USUARIO — viaja por el mismo carril
 * que `cliente_id`/`alcance`/`enmienda`, nunca lo decide el LLM. Consumir SIEMPRE esta función;
 * hardcodear los `codigo` actuales congelaría la lista y anularía la decisión del operador.
 *
 * ⚠️ El endpoint puede no estar desplegado todavía en algún ambiente — el caller degrada a catálogo
 * vacío ante cualquier falla (fail-closed: sin catálogo, el usuario no puede elegir formato y por lo
 * tanto no puede grabar una entrada), nunca inventa un default.
 */
export function obtenerFormatosNota(): Promise<FormatosNota> {
  return apiClient.get<FormatosNota>('/nota/formatos');
}
