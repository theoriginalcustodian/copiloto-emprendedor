import { ApiError } from '../api/errors';
import type { MotivoFallo } from './chatMachine';

/**
 * Traduce lo que reventó al envío a **qué se le dice al usuario** (`MotivoFallo`).
 *
 * 🔴 **Vive en `core` y no en el `catch` de cada hook, y esa es la decisión.** Antes cada camino de
 * envío (texto, audio, mobile, PWA) decidía por su cuenta qué mostrar — y todos decidían lo mismo:
 * *"No pudimos enviar tu mensaje"*, para cualquier causa. Con la traducción acá, agregar un caso lo
 * corrige en los cuatro caminos a la vez, y un test puede fijar el mapeo sin montar React.
 *
 * ## La regla que ordena la tabla
 *
 * No se clasifica por "qué salió mal técnicamente" sino por **qué debería hacer el usuario ahora**.
 * Dos errores con causas técnicas distintas que se resuelven igual comparten motivo; un solo status
 * HTTP que se resuelve de dos formas distintas necesitaría dos.
 *
 * | Qué llegó | Motivo | Qué haría el usuario |
 * |---|---|---|
 * | 401 | `sesion_vencida` | Volver a entrar. Reintentar no sirve. |
 * | 413 | `audio_muy_grande` | Grabar más corto. Reintentar lo mismo tampoco sirve. |
 * | 422 | `audio_no_entendido` | Repetir el AUDIO — el mensaje sí se envió. |
 * | 5xx / otro `ApiError` | `servidor` | Reintentar más tarde. |
 * | No es `ApiError` | `red` | Revisar la conexión y reintentar. |
 *
 * 🔴 **El default es `servidor`, NO `red`**, y no es un detalle. `red` le dice al usuario "revisá tu
 * conexión": mandarlo ahí cuando el problema era del servidor le hace perder el tiempo en el lugar
 * equivocado — que es exactamente el fallo que este módulo existe para no repetir. Sólo se afirma
 * `red` cuando hay evidencia de que la request **nunca llegó a tener respuesta HTTP**.
 */
export function motivoDeError(e: unknown): MotivoFallo {
  if (!(e instanceof ApiError)) {
    // Sin status HTTP no hubo respuesta del servidor: el fallo es de transporte. Es el único caso en
    // el que afirmar "problema de conexión" está respaldado por algo.
    return 'red';
  }
  if (e.status === 401) return 'sesion_vencida';
  if (e.status === 413) return 'audio_muy_grande';
  if (e.status === 422) return 'audio_no_entendido';
  return 'servidor';
}

/**
 * El texto que ve el usuario para cada motivo.
 *
 * 🔴 **Ninguno de estos textos dice "no se pudo enviar" salvo cuando es cierto.** En
 * `audio_no_entendido` y `audio_muy_grande` el mensaje **llegó al servidor**; decir lo contrario lo
 * mandaría a revisar la conexión mientras el problema está en el micrófono. Cada texto nombra la
 * acción concreta que destraba el caso, porque un aviso que sólo describe el fallo deja al usuario
 * adivinando qué hacer.
 */
export function textoDeMotivo(motivo: MotivoFallo): string {
  switch (motivo) {
    case 'red':
      return 'No pudimos enviar tu mensaje. Revisá la conexión y probá de nuevo.';
    case 'audio_no_entendido':
      return 'No se entendió el audio. Probá de nuevo hablando más cerca del micrófono.';
    case 'audio_muy_grande':
      return 'El audio es demasiado largo para enviarlo. Grabá uno más corto.';
    case 'sesion_vencida':
      return 'Tu sesión venció. Volvé a entrar para seguir.';
    case 'servidor':
      return 'El servidor no pudo procesar tu mensaje. Probá de nuevo en un momento.';
  }
}
