/**
 * Los puertos de la captura de audio. **Cero DOM, cero React, cero plataforma.**
 *
 * Estos contratos son la frontera entre la lógica del panel (que es la misma en todas las
 * plataformas) y lo que cambia entre ellas. Es lo que hace que la decisión de formato de la app
 * (web / Capacitor / React Native) sea **reversible en el margen**: se cambia el adaptador, no el panel.
 *
 * 🔴 **Adaptado del `audio/ports.ts` de origen (D6): de los 5 puertos originales queda SÓLO el
 * grabador.** Este producto no retiene audio en el dispositivo — el dictado va directo a Groq
 * (`api/audio.ts`, endpoint `/chat/audio`) y vuelve como texto ya transcripto, así que:
 *
 * - **`Hasher`** — NO se portó. Existía para verificar integridad de un archivo persistido on-device;
 *   sin persistencia, no hay nada que hashear localmente.
 * - **`AudioStore`** — NO se portó. Guardaba los bytes del audio en el filesystem; este producto no
 *   guarda el audio más allá de la subida.
 * - **`IndiceLocal`** — NO se portó. Indexaba metadata/hash/estado de audios persistidos; sin
 *   persistencia, no hay índice que mantener.
 * - **`Purgador`** — NO se portó. Gestionaba la retención (cuándo es seguro borrar un audio anclado);
 *   sin persistencia, no hay nada que purgar.
 * - **`TransporteCaptura`** — NO se portó. Duplicaba la responsabilidad de `api/audio.ts::sendAudio`
 *   (que SÍ se portó, agnóstico): ambos mandaban el audio a transcribir. Con la retención fuera del
 *   alcance, `sendAudio` es el único camino de transporte que hace falta.
 *
 * Lo que SÍ queda —`AudioRecorder` + el grupo de `GuardiaInterrupciones`— es conocimiento de
 * grabación en mobile puro (interrupciones del SO, foreground services, recuperación de huérfanos),
 * independiente de qué se hace con el audio después de grabarlo.
 *
 * ⚠️ **Ninguna librería del ecosistema RN/Expo cumple hoy `AudioRecorder` de fábrica** (hallazgo del
 * proyecto de origen, verificado empíricamente): `expo-audio` (y `expo-av` antes) **pierde el audio
 * previo cuando entra una llamada** —bug abierto, recurrente, con causa raíz conocida: el handler
 * atiende `interruptionBegan` pero nunca `interruptionEnded`. Este puerto es el contrato que lo
 * reemplaza.
 *
 * 🔴 **"En Android no se graba en background" es FALSO** — esa frase vivió en el proyecto de origen
 * el tiempo suficiente como para inducir la conclusión equivocada dos veces. Android graba con la
 * pantalla bloqueada mediante un *foreground service* tipado `microphone` (el de la notificación
 * persistente, el mismo mecanismo de cualquier grabadora de voz); arrancarlo es responsabilidad del
 * adaptador nativo, no algo que el SO hace solo.
 *
 * Lo que el foreground service NO evita es que otra app **se lleve el micrófono**: al ATENDER una
 * llamada el sistema se lo lleva y no lo devuelve. Ése es el caso que declara `interrumpido` — pero
 * ojo con el mecanismo: el camino "oficial" (el foco de audio) **nunca se dispara** en ese escenario
 * (medido en device por el proyecto de origen, 0 ocurrencias en logcat). Quien lo caza de verdad es
 * un vigilante por síntoma del lado del adaptador nativo, que mira si siguen entrando bytes al
 * archivo.
 */

import type {
  ArchivoAudio,
  AvisoCaptura,
  Canales,
  ErrorCaptura,
  EstadoProteccion,
  FuenteAudio,
  SegmentoAudio,
  SesionCaptura,
  SesionHuerfana,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// 1 · AudioRecorder — lo único que NO se puede resolver con una librería
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que el grabador de esta plataforma **realmente puede hacer**, leído del dispositivo, no asumido.
 *
 * El panel **no asume capacidades: las consulta y se adapta**. Es lo que permite que la diarización por
 * canal sea una *mejora opcional* y no una dependencia que bloquee: con `canales === 1` la consulta se
 * graba igual y se diariza de forma probabilística (como hoy); con `canales === 2` sube a determinística.
 * Colgar el producto de un hardware sin verificar sería codificar la esperanza.
 */
export interface CapacidadesGrabador {
  canales: Canales;
  /** ¿Sigue capturando con la app en background / pantalla bloqueada? En web puro es `false`. */
  grabaEnBackground: boolean;
  soportaPausa: boolean;
  /** ¿Puede recuperar segmentos de una sesión que el SO mató? Sin esto, un kill pierde la consulta. */
  soportaRecuperacion: boolean;
}

export type EventoGrabador =
  /** Un segmento quedó cerrado y **escrito a disco**. Llega durante la grabación, no al final. */
  | { tipo: 'segmento_cerrado'; segmento: SegmentoAudio }
  /**
   * Amplitud de lo que está entrando por el micrófono, 0..1, varias veces por segundo.
   *
   * 🔴 No es decoración. Es la ÚNICA señal de que el micrófono está captando algo: sin esto, una onda
   * animada "porque sí" se ve idéntica esté el micrófono mudo o no, y el usuario se entera de que grabó
   * varios minutos de silencio recién cuando ya no puede repetirlos. Una onda que se mueve sola es peor
   * que ninguna onda — miente.
   */
  | { tipo: 'nivel'; valor: number }
  /**
   * 🔴 El sistema operativo le sacó el micrófono a la captura (llamada entrante, otra app tomando el
   * foco de audio). **El grabador reporta el hecho; NO decide qué fase sigue** — eso lo resuelve
   * `reducir` (pasa a `pausado` y acumula el aviso), igual que con `segmento_cerrado`.
   *
   * No lleva `shouldResume` a propósito, aunque la librería nativa lo entregue: bajo la política
   * vigente (ver `AvisoCaptura.interrumpido`) la reanudación es SIEMPRE del usuario, así que un dato
   * que no cambia ninguna decisión no cruza el puerto. Si algún día la política cambia, entra acá.
   */
  | { tipo: 'interrumpido' }
  /**
   * 🔴 El usuario tocó un control **fuera de la app**: el botón de la notificación persistente del
   * foreground service, con la pantalla bloqueada o la app en segundo plano.
   *
   * Es un evento propio y NO `interrumpido`, aunque ambos terminen en la fase `pausado`: `interrumpido`
   * significa *"el SO nos sacó el micrófono"* y deja un aviso que el usuario tiene que ver antes de
   * confirmar. Reusarlo acá le avisaría de un hueco que no existe — la pausa la pidió él. Y al revés,
   * mandar `pausar` desde el adaptador metería en la capa de plataforma la decisión de fase que la
   * regla dura le prohíbe. Se reporta el HECHO ("usó el control externo"); la traducción a evento del
   * panel la hace el hook, como con todos los demás.
   *
   * ⚠️ El adaptador **no pausa el grabador al recibirlo**: la librería nativa sólo emite el evento, no
   * toca la captura. Quien pausa de verdad es el efecto de fase del panel, que ya llama a
   * `grabador.pausar()`. Si el adaptador pausara por su cuenta, el estado de la app y el del grabador
   * podrían divergir — el usuario vería "Grabando" con el micrófono ya cerrado.
   */
  | { tipo: 'control_externo'; accion: 'pausar' | 'reanudar' }
  | { tipo: 'aviso'; aviso: AvisoCaptura }
  | { tipo: 'error'; error: ErrorCaptura };

export interface AudioRecorder {
  /** Capacidades de la fuente ACTIVA. Se re-consulta al cambiar de fuente: no es un valor fijo. */
  capacidades(): Promise<CapacidadesGrabador>;

  fuentesDisponibles(): Promise<FuenteAudio[]>;
  elegirFuente(fuenteId: string): Promise<void>;

  /**
   * Arranca la captura. Recibe la sesión ENTERA, no sólo su id: el grabador deja su metadata en disco
   * junto a los segmentos, y ese rastro es lo ÚNICO que permite rescatar la consulta con su cliente
   * correcto si el SO mata la app a mitad de grabación (ver `recuperarHuerfanos`).
   */
  iniciar(sesion: SesionCaptura): Promise<void>;
  pausar(): Promise<void>;
  reanudar(): Promise<void>;

  /** Cierra el último segmento y devuelve TODOS los de la sesión, en orden. No los une. */
  detener(): Promise<SegmentoAudio[]>;

  /** Detiene y **descarta** los segmentos. Es la única vía legítima de perder audio: el usuario lo pidió. */
  cancelar(): Promise<void>;

  /**
   * 🔴 Suelta el micrófono dejando la sesión **sin cerrar**. Ni `detener` ni `cancelar`: es lo que hay
   * que hacer cuando la captura se **interrumpe** en vez de concluir -- el usuario tocó "Volver", el
   * sistema desmontó la pantalla, la app se fue a segundo plano.
   *
   * Existe porque las otras dos hacen lo incorrecto en ese caso, cada una a su manera: `cancelar()`
   * **borra** los segmentos (una salida accidental destruiría varios minutos de consulta) y
   * `detener()` marca la sesión como cerrada, con lo cual el rescate de huérfanas **la saltea** y el
   * audio queda varado en el disco sin que nadie lo vuelva a ofrecer jamás. `abandonar()` deja el
   * rastro exactamente como lo dejaría un kill del sistema operativo -- que es el caso que ya sabemos
   * rescatar: al volver a la captura, la sesión aparece con SU cliente y el usuario decide.
   */
  abandonar(): Promise<void>;

  /**
   * Une los segmentos en el archivo final (`AVMutableComposition` / `MediaMuxer`).
   *
   * ⚠️ **Puede cambiar el contenedor** (p.ej. `aac` → `audio/mp4`): por eso `ArchivoAudio` lleva su
   * `mime` explícito y nadie aguas abajo lo asume.
   */
  unir(segmentos: SegmentoAudio[]): Promise<ArchivoAudio>;

  /**
   * 🔴 Sesiones que quedaron en disco porque **el SO mató la app**: sus segmentos y a quién pertenecen.
   *
   * No es un caso de borde: los OEM agresivos (Xiaomi, Huawei, Samsung) matan servicios aun con
   * foreground service, y **no hay API para impedirlo**. No podemos evitar que nos maten; podemos
   * hacer que no sea catastrófico. Se llama al abrir la captura: si hay huérfanas, se le ofrece al
   * usuario recuperarlas. **Se pierde la cola, no la consulta** — verificado en un Android real por
   * el proyecto de origen: tras un SIGKILL sobreviven todos los segmentos rotados, sólo el último
   * queda sin finalizar y `unir()` lo descarta avisando.
   *
   * Devuelve la sesión ENTERA (con su cliente congelado), no segmentos sueltos: recuperar audio sin
   * saber de quién es obligaría a preguntarle al usuario —dos días después— de quién era, y así es
   * como una consulta termina en el registro del cliente equivocado. Una sesión sin ese rastro en
   * disco **no se puede recuperar y no se ofrece**: perder audio es mejor que atribuirlo mal.
   */
  recuperarHuerfanos(): Promise<SesionHuerfana[]>;

  /** El usuario decidió tirar una sesión huérfana. Borra sus segmentos del disco. */
  descartarHuerfana(sesionId: string): Promise<void>;

  /** Devuelve la función para desuscribirse. */
  suscribir(cb: (evento: EventoGrabador) => void): () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.b · GuardiaInterrupciones — "No molestar" antes de una consulta larga
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lee si el dispositivo está protegido contra interrupciones antes de grabar (ver `EstadoProteccion`).
 *
 * Existe como puerto —y no como una llamada suelta desde la vista— por lo mismo que el resto: lo que
 * se puede leer cambia radicalmente por plataforma (Android con permiso concedido lo sabe; iOS no
 * puede saberlo nunca), y esa diferencia **no debe filtrarse al panel**. El panel pregunta y se
 * adapta; no asume.
 *
 * 🔴 **Cualquier fallo degrada a `desconocido`, jamás a `protegido`.** Un error leyendo el estado no
 * puede convertirse en "está todo bien": eso sería exactamente la garantía falsa que este puerto
 * existe para evitar. `desconocido` no bloquea pero se dice en pantalla; `protegido` silenciaría el
 * aviso sin haber verificado nada.
 */
export interface GuardiaInterrupciones {
  /** Estado actual. Se re-consulta al volver al panel: el usuario puede activar No molestar y volver. */
  estado(): Promise<EstadoProteccion>;

  /**
   * ¿Tiene sentido ofrecer el permiso en esta plataforma? `false` en iOS y web, donde pedirlo sería
   * ofrecer un botón que no puede cumplir. La vista usa esto para no mostrar un camino muerto.
   */
  puedePedirPermiso(): Promise<boolean>;

  /** Abre los ajustes del sistema donde se concede el acceso a No molestar. Devuelve el estado tras volver. */
  pedirPermiso(): Promise<EstadoProteccion>;

  /**
   * 🔴 **Enciende No molestar desde la app, devolviendo el rastro para poder deshacerlo.**
   *
   * Devuelve `null` si no se pudo (sin permiso, sin módulo, iOS, web). **Nunca lanza**: no poder
   * proteger no puede impedir grabar — la protección reduce la frecuencia de la interrupción, el que
   * salva la consulta cuando igual ocurre es el pausado automático.
   *
   * ⚠️ **El rastro NO se guarda acá.** Lo persiste el llamador vía `RegistroProteccion` **antes** de
   * que exista nada que restaurar. Ver el porqué del orden en ese puerto.
   */
  activar(): Promise<RastroProteccion | null>;

  /**
   * Deshace lo que hizo `activar`, devolviendo el filtro al valor que tenía antes.
   *
   * Idempotente y best-effort: llamarlo dos veces, o sobre un rastro de una sesión que ya terminó, no
   * puede romper nada. Es la propiedad que permite invocarlo desde **todos** los caminos de salida sin
   * coordinarlos entre sí.
   */
  restaurar(rastro: RastroProteccion): Promise<void>;
}

/**
 * Lo que hay que saber para deshacer una activación de No molestar hecha por la app.
 *
 * 🔴 **`filtroPrevio` es un entero crudo del sistema a propósito**, no un `EstadoProteccion`. El mapeo
 * a protegido/desprotegido es **con pérdida** —`ALL` y `PRIORITY` colapsan los dos a `desprotegido`—
 * y restaurar desde el valor mapeado le devolvería al usuario un ajuste **distinto** del que tenía:
 * quien usaba "sólo prioridad" se quedaría con No molestar apagado del todo. Restaurar exige el valor
 * exacto, no su interpretación.
 */
export interface RastroProteccion {
  /** El valor de `INTERRUPTION_FILTER_*` que el dispositivo tenía ANTES de que la app lo tocara. */
  filtroPrevio: number;
  /** ISO. Sirve para que el restaurador huérfano pueda decir hace cuánto quedó colgado. */
  activadoEn: string;
}

/**
 * Persiste el rastro de una activación de No molestar **a través de la muerte del proceso**.
 *
 * 🔴 **Por qué existe este puerto y no alcanza con una variable en memoria.** Encender No molestar
 * muta un ajuste del teléfono que sobrevive a la app. Si el proceso muere con la protección puesta
 * —crash, `am kill`, el OEM reclamando memoria— **el usuario se queda sin timbre y sin ninguna pista
 * de por qué**: no hay diálogo, no hay error, el teléfono simplemente deja de sonar. Es la peor clase
 * de fallo que puede tener esta función: silencioso, indefinido, y provocado por nosotros. Un daño
 * afuera de la app no lo puede reparar un `finally` adentro de la app.
 *
 * 🔴 **Orden vinculante: PERSISTIR y recién después MUTAR.** Al revés hay una ventana —chica pero
 * real— en la que el filtro ya cambió y nadie sabe cómo volver atrás. Persistir de más es inocuo (el
 * restaurador encuentra un rastro que devuelve el filtro al valor que ya tiene); mutar de más no
 * tiene vuelta.
 */
export interface RegistroProteccion {
  /** Guarda el rastro. Se llama ANTES de tocar el filtro del sistema. */
  guardar(rastro: RastroProteccion): Promise<void>;
  /** El rastro pendiente, si el proceso anterior murió sin restaurar. `null` si no hay nada colgado. */
  pendiente(): Promise<RastroProteccion | null>;
  /** Se llama DESPUÉS de restaurar con éxito. Borrar antes dejaría la protección puesta y sin rastro. */
  limpiar(): Promise<void>;
}
