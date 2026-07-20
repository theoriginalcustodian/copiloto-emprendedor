/**
 * El modo de negocio (adaptado del "modo clínico" de origen) — un hilo, dos modelos, cliente
 * obligatorio.
 *
 * ## Qué NO es
 *
 * 🔴 **No es `Alcance`.** `Alcance` decide **a qué memoria va lo que se escribe** —el registro del
 * cliente o el conocimiento general del usuario— y es un eje de **escritura**. El modo decide **qué
 * modelo razona y con qué permisos**, y el modo negocio **no escribe nunca**. Son ortogonales:
 * confundirlos haría que elegir dónde guardar algo cambiara quién lo piensa.
 *
 * ## Qué es
 *
 * Un **modo del hilo único**, no un segundo chat. Elegir el modo en vez de dos conversaciones
 * separadas es lo que hace que esta decisión sume en vez de revertir la unificación del hilo: lo que
 * se eliminó fue una segunda conversación, no un segundo modelo.
 */

/** `copiloto` = general, puede escribir. `negocio` = razona sobre el registro y **sólo lee**. */
export type ModoCopiloto = 'copiloto' | 'negocio';

/** Por qué un modo no se puede activar. `null` = se puede. */
export type ImpedimentoDeModo = 'sin-cliente';

/**
 * 🔴 **El modo negocio EXIGE cliente, y el chequeo vive acá y no en la vista.**
 *
 * No hay estado intermedio "modo negocio sin cliente": el modo y el cliente entran y salen juntos. Si
 * la vista fuera la única que lo controla, cualquier otro punto de entrada —una card del copiloto, un
 * deep link, un test— podría dejar el modo activo sin sujeto, y entonces "el registro de quién" lo
 * decidiría el LLM. Eso es exactamente lo que este puerto prohíbe.
 *
 * El `clienteId` sale del contexto autenticado, **nunca de los `arguments` del LLM**.
 */
export function impedimentoParaModo(
  modo: ModoCopiloto,
  clienteId: string | null
): ImpedimentoDeModo | null {
  if (modo === 'negocio' && clienteId === null) return 'sin-cliente';
  return null;
}

export function modoPermitido(modo: ModoCopiloto, clienteId: string | null): boolean {
  return impedimentoParaModo(modo, clienteId) === null;
}

/**
 * El modo que corresponde de verdad, dado lo que el usuario eligió y si hay cliente.
 *
 * 🔴 **Degrada a `copiloto`, nunca al revés.** Si el cliente desaparece —se deselecciona, expira, la
 * app se reabre sin él— el modo negocio **cae solo**. La degradación insegura sería quedarse en
 * negocio sin sujeto: el modelo seguiría respondiendo *como si* hubiera un registro detrás, y el
 * usuario no tendría cómo notarlo. Un modo que se apaga se ve; uno que miente, no.
 */
export function modoEfectivo(elegido: ModoCopiloto, clienteId: string | null): ModoCopiloto {
  return modoPermitido(elegido, clienteId) ? elegido : 'copiloto';
}

/** Texto del impedimento, para que el botón diga por qué no se puede en vez de sólo estar apagado. */
export function motivoDelImpedimento(impedimento: ImpedimentoDeModo): string {
  return impedimento === 'sin-cliente'
    ? 'Elegí un cliente para entrar en modo negocio.'
    : 'No se puede activar el modo negocio.';
}
