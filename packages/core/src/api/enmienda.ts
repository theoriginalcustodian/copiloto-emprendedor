import { apiClient } from './client';
import type { EntradaCorregible, Enmienda, PreviewEnmienda } from './types';

/**
 * Las entradas del cliente que **se pueden corregir**.
 *
 * 🔴 `corregibles=true` lo filtra el BACKEND, no nosotros, y eso es deliberado: es **la punta de cada
 * cadena de correcciones**. Si la UI calculara esa regla por su cuenta y se desincronizara del
 * servidor, el día que pase le ofreceríamos al usuario corregir una **versión vieja** — y quedarían
 * **dos versiones vigentes en el grafo**. La regla vive en un solo lado (el que rechaza con 4xx) o no
 * vive.
 */
export function listarEntradasCorregibles(clienteId: string, limite = 20): Promise<{ entradas: EntradaCorregible[] }> {
  return apiClient.get<{ entradas: EntradaCorregible[] }>(
    `/clientes/${encodeURIComponent(clienteId)}/entradas?corregibles=true&limit=${limite}`,
  );
}

/**
 * Qué se va a **invalidar** en la memoria de negocio si el usuario firma esta corrección. **No
 * escribe nada.**
 *
 * 🔴 Retirar un hecho tiene que ser un acto **deliberado**. Sin este preview la UI miente por
 * omisión — una corrección menor puede retirar algo importante como efecto colateral, y nadie lo
 * nombra. Sólo el backend sabe qué hechos nacieron de qué entrada; por eso lo pregunta, no lo deduce.
 *
 * El flag `critico` también sale del backend, a propósito: inferir la gravedad desde el `tipo` sería
 * **decidir negocio en la UI**, y la UI no es el lugar donde se decide negocio.
 *
 * Con `tipo_referencia: 'ampliacion'` devuelve `{invalida: []}` — una ampliación no retira nada. Mismo
 * endpoint para los dos casos: la UI no adivina la diferencia.
 */
export function previewEnmienda(enmienda: Enmienda): Promise<PreviewEnmienda> {
  return apiClient.post<PreviewEnmienda>('/enmienda/preview', enmienda);
}
