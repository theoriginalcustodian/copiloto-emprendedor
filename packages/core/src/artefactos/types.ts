/**
 * Artefactos on-device — adaptado del `artefactos/` de origen (persistencia local de lo que el
 * sistema genera o ingesta: el markdown firmado y el PDF entregable; el audio tiene su propio ciclo
 * de vida en `../audio/types.ts`).
 *
 * ## La dirección de la dependencia importa
 *
 * Acá vive lo **general** (`ArtefactoBase`) y en `../audio/types.ts` lo **específico**
 * (`AudioIndexado extends ArtefactoBase`). Nunca al revés. Si lo general importara del audio, cada
 * tipo nuevo empujaría campos de audio —`duracionMs`, `canales`— a artefactos que no tienen ni
 * duración ni canales, y el modelo se volvería un saco de columnas opcionales.
 *
 * 🔴 **El bloqueo por "borrador pendiente" del proyecto de origen (`bloqueo.ts`) NO se portó.** Ese
 * módulo bloqueaba el copiloto entero hasta que el usuario confirmara o descartara un borrador de
 * NOTA CLÍNICA sin resolver — una invariante específica del flujo de captura de audio clínica que el
 * manifest de puertos móviles marcó `descartar` junto con el resto de esa captura (ver
 * `../audio/ports.ts`). El tipo `'borrador'` de `TipoArtefacto` se preserva porque el modelo general
 * es reusable (trabajo sin confirmar que vive on-device), pero SIN el mutex de "uno a la vez" — si
 * el producto necesita esa invariante de vuelta, hay que reconstruirla contra el flujo real de este
 * producto, no reflotar el módulo original.
 */

/** Los tipos de artefacto que el sistema persiste on-device. */
export type TipoArtefacto =
  /** El markdown firmado. Sólo lectura, inmutable: si existe, es porque se ingestó. */
  | 'markdown'
  /** El entregable. **Nunca se purga y nunca se descarta.** */
  | 'pdf'
  /** Trabajo sin resolver. El único NO firmado. */
  | 'borrador';

/**
 * Lo que TODO artefacto tiene, sin importar su tipo. Es el contrato que no se quiere duplicar:
 * binario al filesystem, metadata + hash + puntero en la DB, indexado por cliente.
 *
 * 🔴 **El binario NUNCA va acá dentro.** En web SQLite corre en WASM y carga la base entera en RAM:
 * un archivo grande adentro la revienta. `uri` es un puntero, no contenido.
 */
export interface ArtefactoBase {
  id: string;
  tipo: TipoArtefacto;
  /** Puntero al archivo en el filesystem. Nunca los bytes. */
  uri: string;
  /** SHA-256 de los bytes, calculado **en este dispositivo**. */
  sha256: string;
  bytes: number;
  /**
   * El cliente al que pertenece. Congelado al crearse: **nunca se recalcula**.
   *
   * Es lo que hace que el árbol por cliente sea una consulta y no carpetas físicas — y lo que hace
   * que reorganizar la vista no mueva un solo byte en disco.
   */
  clienteId: string;
  /** ISO-8601. Orden natural del registro. */
  creadoEn: string;
  /**
   * `entrada_id` de la entrada de negocio firmada a la que pertenece este artefacto, cuando la hay.
   *
   * `null` en un borrador (no está firmado, no existe del lado del servidor) y en un audio que
   * todavía no ancló. Es la costura que ata los distintos almacenes entre sí.
   */
  entradaId: string | null;
}

/**
 * El markdown firmado, cacheado on-device.
 *
 * **Inmutable y de sola lectura** (decisión heredada del origen: *"no se puede modificar una vez
 * generado porque si se generó quiere decir que se ingestó"*). Una corrección **no lo modifica: crea
 * otro** (append-only). La carpeta de una consulta acumula varios; el último es el vigente y ninguno
 * se borra.
 *
 * 🔴 A diferencia del PDF, este **sí** se puede verificar y descartar: si el hash no cierra contra el
 * ancla, se tira la copia local y se vuelve a bajar de Postgres, que es la fuente de verdad. Sale
 * gratis porque el original existe en otro lado.
 */
export interface MarkdownIndexado extends ArtefactoBase {
  tipo: 'markdown';
  /**
   * Si este `.md` enmienda a otro, el `id` del anterior. Es lo que permite mostrar la cadena de
   * correcciones como una cadena y no como duplicados — y si la UI no lo hace, el usuario va a
   * intentar "limpiar" lo que es justamente el rastro de auditoría.
   */
  enmiendaA: string | null;
}

/**
 * El PDF generado. **El único artefacto que SALE del sistema** — al cliente, a un tercero. Por eso es
 * donde el hash rinde de verdad.
 *
 * 🔴 **No se puede regenerar ni descartar.** Un PDF embebe su fecha de creación: el mismo markdown
 * produce bytes distintos en cada corrida, así que un PDF regenerado **nunca** vuelve a coincidir con
 * el hash anclado. Descartar uno que no verifica destruye la única copia del entregable — no hay
 * original que re-bajar, como sí lo hay para el `.md`.
 *
 * La resolución (heredada del origen): marcar no-verificable, avisar al usuario, ofrecer generar uno
 * **nuevo** — que es otro artefacto, con su hash y su anclaje, no una reparación.
 */
export interface PdfIndexado extends ArtefactoBase {
  tipo: 'pdf';
  /** El `.md` del que se renderizó. Ata el entregable a lo que el usuario firmó. */
  markdownId: string | null;
  /**
   * `true` cuando el hash local dejó de coincidir con el ancla.
   *
   * No se borra: se marca. Un PDF corrupto sigue siendo la única copia de lo que se entregó, y el
   * usuario tiene derecho a saber que existe y que no verifica — en vez de descubrir que desapareció.
   */
  noVerificable: boolean;
}

/**
 * Trabajo sin resolver: lo que el usuario dictó o transcribió y todavía no confirmó ni descartó.
 *
 * 🔴 **Su hash NO prueba nada.** Es el único artefacto no firmado: nada sin confirmación humana sale
 * del dispositivo, así que no hay ancla en Postgres contra la cual verificarlo. Se guarda por
 * **durabilidad**, no por integridad. Al confirmarse deja de ser borrador y nace el `.md` firmado; al
 * descartarse se borra y no deja rastro.
 */
export interface BorradorIndexado extends ArtefactoBase {
  tipo: 'borrador';
  entradaId: null;
  /** Qué acción lo generó. Determina qué se reanuda cuando el usuario vuelve a la app. */
  origen: 'nota' | 'consulta' | 'documento' | 'informe';
  /**
   * La sesión de audio de la que salió, si salió de una. Permite volver a escuchar lo grabado
   * mientras se corrige el texto, y que descartar el borrador no se lleve el audio por delante.
   */
  sesionId: string | null;
}

/**
 * Unión discriminada por `tipo`. Que sea una unión y no una interfaz con todo opcional es lo que hace
 * que el compilador exija tratar cada caso: agregar un tipo nuevo rompe los `switch` que lo ignoren,
 * en vez de dejarlos pasar en silencio.
 *
 * `AudioIndexado` vive en `../audio/types.ts` y extiende `ArtefactoBase`: lo específico depende de lo
 * general, nunca al revés.
 */
export type Artefacto = MarkdownIndexado | PdfIndexado | BorradorIndexado;

/** Los tipos de artefacto que este módulo maneja (el audio tiene su propio puerto). */
export const TIPOS_DE_ARTEFACTO: readonly Artefacto['tipo'][] = ['markdown', 'pdf', 'borrador'];
