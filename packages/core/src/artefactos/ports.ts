import type { Artefacto, BorradorIndexado, PdfIndexado } from './types';

/**
 * Puertos del almacén de artefactos. Dos: los **bytes** y el **índice**.
 *
 * Es la misma separación que ya usa el audio: el binario va al filesystem y la DB liviana guarda
 * metadata + hash + puntero. Que el índice sea **reconstruible** —la fuente de verdad es Postgres— es
 * lo que permite migrarlo sin miedo: se puede tirar y rehacer desde los archivos, mientras los
 * archivos no se toquen.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1 · AlmacenArtefactos — los bytes, en el filesystem
// ─────────────────────────────────────────────────────────────────────────────

export interface AlmacenArtefactos {
  /** Escribe el contenido y devuelve la URI durable. Idempotente por `id`. */
  guardar(id: string, contenido: string, codificacion: 'utf8' | 'base64'): Promise<string>;
  /**
   * El contenido **de texto**, para mostrarlo. `null` si el archivo ya no está en disco.
   *
   * 🔴 **Lanza para un PDF, a propósito.** Un PDF se abre y se comparte por su `uri` (que el índice
   * ya guarda); cargarlo entero a un string de JavaScript sería un OOM sin ninguna ganancia: nadie
   * necesita sus bytes del lado de JS.
   */
  leer(id: string): Promise<string | null>;
  /** Abre el share sheet del SO. Es lo que hace honesta a la purga: siempre se puede exportar. */
  exportar(id: string): Promise<void>;
  borrar(id: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · IndiceArtefactos — metadata, hashes y el mutex del borrador
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 **Dos invariantes viven acá adentro, no en la buena voluntad del que llame** — un control que
 * depende de que todos los callers se acuerden es un control que ya falló, sólo que todavía no se
 * enteró.
 *
 * 1. **Un borrador a la vez** (heredado del origen). `registrar` de un segundo borrador **lanza**.
 *    El bloqueo del copiloto (si el producto lo reconstruye) existe para que no se apilen
 *    pendientes; si el índice acepta dos, el bloqueo sería decorativo.
 * 2. **Un PDF no se borra por no verificar.** `eliminar` de un `pdf` **lanza**. No hay original que
 *    re-bajar: borrarlo destruye la única copia del entregable. Se marca con `marcarNoVerificable`,
 *    que es visible y reversible; borrar no lo es.
 */
export interface IndiceArtefactos {
  /**
   * Alta idempotente: registrar el mismo `id` dos veces no falla (retry tras un crash a mitad de
   * camino). **Lanza** si se intenta un segundo borrador con otro ya pendiente (invariante 1).
   */
  registrar(artefacto: Artefacto): Promise<void>;

  obtener(id: string): Promise<Artefacto | null>;

  /**
   * El árbol por cliente — **una consulta, no carpetas en el disco**.
   *
   * Las "carpetas" (audios / `.md` / PDF) salen de filtrar por `tipo`. Con carpetas físicas habría
   * dos verdades —filesystem e índice— que divergen apenas algo falla a mitad de camino. Acá hay una
   * sola, y renombrar a un cliente no mueve un byte.
   */
  porCliente(clienteId: string, tipo?: Artefacto['tipo']): Promise<Artefacto[]>;

  /** Todos los artefactos de una misma entrada firmada: la "carpeta" de una consulta. */
  porEntrada(entradaId: string): Promise<Artefacto[]>;

  /**
   * El borrador pendiente, si lo hay. `null` = vía libre.
   *
   * Se consulta al abrir la app: si devuelve algo, el usuario retoma donde estaba. Sin esta
   * pregunta, cerrar la app sería la forma de perder el trabajo sin resolver.
   */
  borradorPendiente(): Promise<BorradorIndexado | null>;

  /**
   * El usuario **descartó** el borrador. Lo borra del índice.
   *
   * Es una de las dos únicas salidas, y las dos son explícitas: no hay timeout ni auto-descarte. Un
   * descarte automático destruiría trabajo sin que nadie lo decida.
   */
  descartarBorrador(id: string): Promise<void>;

  /**
   * El hash de un PDF dejó de cerrar contra el ancla. **Marca, no borra.**
   *
   * El usuario tiene derecho a saber que el entregable existe y que no verifica, en vez de descubrir
   * que desapareció solo.
   */
  marcarNoVerificable(id: string): Promise<void>;

  /** Ata el artefacto a la entrada firmada que el servidor devolvió al confirmar. */
  marcarAnclado(id: string, entradaId: string): Promise<void>;

  /** **Lanza** si el artefacto es un `pdf` (invariante 2). Para el resto, borra. */
  eliminar(id: string): Promise<void>;
}

/** Los PDF que hoy no verifican. Para mostrárselos al usuario, no para borrarlos. */
export type PdfsNoVerificables = readonly PdfIndexado[];
