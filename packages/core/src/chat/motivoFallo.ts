import { ApiError, esDiferido } from '../api/errors';
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
 * | 413 (`origen:'audio'`) | `audio_muy_grande` | Grabar más corto. Reintentar lo mismo tampoco sirve. |
 * | 413 (`origen:'foto'`) | `foto_muy_grande` | Elegir/sacar una foto más liviana. |
 * | 422 (`origen:'audio'`) | `audio_no_entendido` | Repetir el AUDIO — el mensaje sí se envió. |
 * | 422 (`origen:'foto'`) | `foto_no_legible` | Repetir la FOTO — el mensaje sí se envió. |
 * | 500 con `diferido:true` | `servidor_diferido` | Nada — el sistema ya lo va a reintentar solo. |
 * | 5xx / otro `ApiError` | `servidor` | Reintentar más tarde. |
 * | No es `ApiError` | `red` | Revisar la conexión y reintentar. |
 *
 * 🔴 **El default es `servidor`, NO `red`**, y no es un detalle. `red` le dice al usuario "revisá tu
 * conexión": mandarlo ahí cuando el problema era del servidor le hace perder el tiempo en el lugar
 * equivocado — que es exactamente el fallo que este módulo existe para no repetir. Sólo se afirma
 * `red` cuando hay evidencia de que la request **nunca llegó a tener respuesta HTTP**.
 *
 * 🔴 **`origen` existe porque 413/422 SOLOS son ambiguos.** `/chat/audio` y `/chat/foto` comparten
 * esos dos códigos con significados distintos (audio muy largo vs. imagen muy pesada; STT que no
 * entendió vs. OCR que no vio ticket) — sin el parámetro, un 422 de una foto se leería como
 * `audio_no_entendido` y el aviso mandaría al usuario a hablarle más cerca al micrófono. Default
 * `'audio'` para no romper los call-sites existentes (texto/audio), que preceden a `/chat/foto`.
 */
export function motivoDeError(e: unknown, origen: 'audio' | 'foto' = 'audio'): MotivoFallo {
  if (!(e instanceof ApiError)) {
    // Sin status HTTP no hubo respuesta del servidor: el fallo es de transporte. Es el único caso en
    // el que afirmar "problema de conexión" está respaldado por algo.
    return 'red';
  }
  if (e.status === 401) return 'sesion_vencida';
  if (e.status === 413) return origen === 'foto' ? 'foto_muy_grande' : 'audio_muy_grande';
  if (e.status === 422) return origen === 'foto' ? 'foto_no_legible' : 'audio_no_entendido';
  // ítem 2.5 del DLQ: sólo el 500 de la costura C2 marca `diferido` — un 400/404/409 nunca lo trae,
  // así que no hace falta acotar por status además de leer el body.
  if (e.status === 500 && esDiferido(e.body)) return 'servidor_diferido';
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
    case 'servidor_diferido':
      // Texto pedido literal por el contrato (§4 del ítem 2.5) — lo vinculante es que NO invite a
      // reintentar, porque reintentar acá duplica un efecto que el sistema ya va a reintentar solo.
      return 'Se cortó algo de nuestro lado. Lo estamos reintentando solo — no hace falta que lo repitas.';
    case 'foto_no_legible':
      return 'No pudimos leer el ticket en la foto. Probá con más luz o más cerca del papel.';
    case 'foto_muy_grande':
      return 'La foto pesa demasiado para enviarla. Elegí otra o sacala de nuevo con menos resolución.';
  }
}
