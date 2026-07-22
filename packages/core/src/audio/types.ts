/**
 * Tipos del dominio de captura de audio. **Cero DOM, cero React, cero plataforma.**
 *
 * Vive en `core/` (no en `modules/`) a propósito: es la capa que **sobrevive a la decisión de
 * formato de la app** (web / Capacitor / React Native). Cuando esa decisión se tome, este directorio
 * se mueve a un paquete compartido sin tocar una línea. Si algo de acá importa `react`, un componente,
 * o una API del navegador, está mal ubicado.
 *
 * 🔴 **Adaptado del `audio/` de origen (D6 del plan de puertos móviles): de los 5 puertos originales
 * (grabador, almacén, índice, hasher, purgador) queda SÓLO el grabador.** Este producto no retiene
 * audio en el dispositivo — el dictado va directo a Groq (`api/audio.ts`) y vuelve como texto, así
 * que no hace falta almacén local, índice de hashes, ni política de purga. Los tipos que sólo servían
 * a esos 4 puertos descartados (`AudioIndexado`, `EstadoAudio`) se podaron con ellos — ver
 * `ports.ts` para el detalle de qué puerto sobrevive y por qué.
 *
 * Las invariantes que los tipos que SÍ quedan codifican vienen de la investigación de captura de
 * audio en mobile del proyecto de origen (interrupciones del SO, foreground services, OEMs que matan
 * procesos). No son preferencias: cada una evita una pérdida de audio concreta y documentada — esa
 * parte del conocimiento es independiente del dominio de negocio y se preserva íntegra.
 */

/** Qué se está capturando. Determina el endpoint de STT y el `tipo` del contenido firmado. */
export type TipoCaptura = 'nota' | 'consulta';

/**
 * El cliente **congelado al iniciar la grabación** — nunca el "activo actual" al confirmar.
 *
 * Una consulta puede durar bastante. Si el usuario cambia el selector a mitad de grabación y el envío
 * usa el cliente vivo, **la grabación de A se archiva en el registro de B**. Es exactamente el bug
 * (CRITICAL-1) que el proyecto de origen documentó para el caso clínico — el mismo patrón aplica acá
 * uno-a-uno: un dictado mal atribuido es tan grave para un negocio como para una consulta médica. Por
 * eso el cliente entra al estado de la sesión como un valor, no como una lectura diferida.
 */
export interface ClienteCongelado {
  id: string;
  nombre: string;
}

/** Canales discretos que la fuente entrega. 2 habilita diarización determinística por canal. */
export type Canales = 1 | 2;

/**
 * ¿El dispositivo está protegido contra interrupciones mientras se graba? (No molestar / zen mode).
 *
 * 🔴 **La condición NO es "está en silencio", es "No molestar"**, y la diferencia importa. Silenciar
 * el timbre **no evita el corte**: una llamada entrante se lleva el foco de audio igual esté en
 * silencio, en vibrador o con sonido — el timbre no es lo que roba el micrófono, la llamada sí.
 * Silenciar sólo evita que el *ringtone se escuche dentro* de la grabación. Gatear por "silencio"
 * daría una garantía que el sistema no puede cumplir: friccionaría antes de grabar y la consulta se
 * cortaría igual, y el usuario aprendería a desconfiar del aviso.
 *
 * ⚠️ **Ni siquiera No molestar es garantía absoluta**: en modo "sólo prioridad" deja pasar contactos
 * destacados y alarmas, y eso vuelve a robar el micrófono. Esto **reduce la frecuencia** de la
 * interrupción; el que salva la consulta cuando igual ocurre es el pausado automático
 * (`AvisoCaptura.interrumpido`). Uno no reemplaza al otro.
 */
export type EstadoProteccion =
  /** No molestar está activo: la interrupción es improbable (no imposible). */
  | 'protegido'
  /** Se leyó el estado y NO está protegido. Es el único valor que habilita bloquear. */
  | 'desprotegido'
  /**
   * 🔴 **No se pudo leer.** iOS (Apple no expone el switch de silencio por API pública), permiso de
   * acceso a No molestar no concedido, o web.
   *
   * **No bloquea, avisa.** Bloquear sobre algo que no se pudo verificar sería teatro: friccionaría al
   * usuario sin ninguna garantía detrás. La regla es la misma de siempre — no se puede leer, no se
   * finge que sí.
   */
  | 'desconocido';

/**
 * Una fuente de entrada de audio (micrófono del dispositivo, o receptor externo).
 *
 * `canales` es el dato que decide si la consulta puede diarizarse por canal (determinístico) o hay
 * que caer a diarización probabilística. **Ojo con la trampa:** los receptores inalámbricos (DJI Mic
 * Mini, Rode Wireless GO 3) entregan 2 canales **solo en modo Stereo/Split**; en modo Merge mezclan
 * **en el hardware**, antes de que el software vea nada. El usuario puede creer que graba 2 canales y
 * grabar 1 — y la diarización se degrada sin que nadie se entere. De ahí que esto se lea del
 * dispositivo real y no se asuma por el nombre del modelo.
 */
export interface FuenteAudio {
  id: string;
  nombre: string;
  canales: Canales;
  esExterna: boolean;
}

/**
 * Un segmento de grabación **ya escrito a disco**.
 *
 * El grabador NO produce un archivo continuo: produce segmentos. Dos razones, las dos documentadas
 * en el proyecto de origen:
 *
 * 1. **Las interrupciones del SO destruyen las grabaciones continuas.** Ante una llamada entrante, la
 *    evidencia (issues abiertos de expo-audio/expo-av) muestra pérdida del audio previo. El patrón de
 *    la industria es segmentar y unir al final (`AVMutableComposition` en iOS, `MediaMuxer` en Android).
 * 2. 🔴 **Porque el SO nos puede matar y no lo podemos impedir.** Los OEM agresivos (Xiaomi, Huawei,
 *    Samsung) matan servicios aun con foreground service, y no hay API para evitarlo. Si los segmentos
 *    se van escribiendo a disco a medida que se graban, un kill deja de ser catastrófico: al abrir de
 *    nuevo, los segmentos huérfanos siguen ahí. **Se pierde la cola, no la consulta.**
 */
export interface SegmentoAudio {
  id: string;
  sesionId: string;
  /** Orden dentro de la sesión. El merge respeta este orden. */
  indice: number;
  /** Ruta/URI en el filesystem. **Nunca** los bytes: varios minutos en memoria revientan la app. */
  uri: string;
  bytes: number;
  duracionMs: number;
  canales: Canales;
}

/**
 * El archivo final de la sesión, ya unido y listo para subir.
 *
 * `mime` viaja explícito porque **el merge puede cambiar el contenedor**: si hubo una interrupción, la
 * unión de segmentos produce un contenedor distinto al de la grabación directa (p.ej. `aac` → `audio/mp4`).
 * Asumir un mime fijo rompe la subida justo en el caso que más importa (la consulta que sobrevivió a
 * una llamada).
 */
export interface ArchivoAudio {
  uri: string;
  bytes: number;
  mime: string;
  duracionMs: number;
  canales: Canales;
}

/**
 * Datos de la sesión, fijados al iniciar la grabación y nunca re-leídos.
 *
 * 🔴 Vive acá, en los tipos, y NO en la máquina de estados, porque el **grabador** la necesita: sin
 * saber a qué cliente pertenece lo que está grabando, no puede dejar en disco un rastro que permita
 * rescatarlo si el SO lo mata (ver `SesionHuerfana`). El puerto no puede depender de la máquina.
 */
export interface SesionCaptura {
  id: string;
  tipo: TipoCaptura;
  /** Congelado. Ver invariante en `ClienteCongelado`. */
  cliente: ClienteCongelado;
  fuente: FuenteAudio;
  canales: Canales;
  /**
   * 🔴 El `codigo` de `GET /nota/formatos`, **congelado al iniciar la grabación** igual que el
   * cliente. Vive acá —y no sólo suelto en la máquina de estados— porque el grabador deja la sesión
   * en disco para rescatarla si el SO lo mata (`SesionHuerfana`): si el formato no viajara con ella,
   * una NOTA rescatada llegaría al envío sin `tipo_nota`, el backend caería en su default silencioso,
   * y una plantilla se guardaría equivocada sin que nadie lo note. `null` cuando `tipo === 'consulta'`.
   */
  formato: string | null;
}

/**
 * Avisos que el grabador levanta y que **el usuario tiene que ver**. Son los fallos silenciosos:
 * ninguno lanza una excepción, ninguno rompe el flujo, y todos degradan la consulta sin síntoma.
 */
export type AvisoCaptura =
  /** La fuente entrega 1 canal donde se esperaban 2 (¿receptor en modo Merge?). La diarización cae a
   *  probabilística. No es un error — es una degradación que hay que declarar. */
  | { tipo: 'un_solo_canal'; fuente: FuenteAudio }
  /** El micrófono externo se desconectó o cambió de ruta **a mitad de la grabación**. */
  | { tipo: 'ruta_cambiada'; antes: FuenteAudio | null; ahora: FuenteAudio | null }
  /**
   * Una llamada (u otra app) le sacó el micrófono a la captura, y **la captura quedó en pausa**.
   *
   * 🔴 **Nunca se reanuda sola** (decisión heredada del origen). El sistema avisa que hubo una
   * interrupción y espera: reanudar es un acto del usuario. El campo `reanudadoAutomaticamente` que
   * este aviso llevaba en el origen se eliminó porque bajo esta política era estructuralmente `false`
   * para siempre — un booleano que no puede ser `true` no informa, engaña al que lo lee después.
   *
   * Reanudar automáticamente parece un favor y es una trampa: el usuario cuelga, sigue hablando, y
   * cree que grabó. Si la reanudación falla —o el sistema nunca manda el `ended`, que la propia
   * librería documenta como posible— ese tramo de la consulta no existe y nadie se entera hasta que
   * ya no se puede repetir. En pausa explícita, el peor caso es que el usuario vea "Pausado" y toque
   * Reanudar.
   */
  | { tipo: 'interrumpido' }
  /** El grabador declara que NO captura en background: si el usuario bloquea la pantalla, se corta. */
  | { tipo: 'sin_background' }
  /**
   * 🔴 El SO mató la app mientras grababa y el ÚLTIMO tramo quedó sin finalizar: sus bytes están en
   * disco pero el contenedor nunca se cerró, así que no hay forma de leerlos. **El resto de la
   * consulta está entero.**
   *
   * Medido en un dispositivo Android real en el proyecto de origen: tras un SIGKILL sobrevivieron los
   * segmentos rotados; el que estaba abierto quedó ilegible. Es decir: **la cola es irrecuperable, y
   * sólo la cola**.
   *
   * Se declara como aviso y no como error a propósito: el flujo NO se corta (la consulta sigue siendo
   * utilizable), pero el usuario tiene que enterarse ANTES de confirmar que a esta grabación le faltan
   * los últimos segundos.
   */
  | { tipo: 'cola_perdida'; segmentos: number; msPerdidosAprox: number };

/**
 * 🔴 Una sesión que el SO mató, rescatada del disco: sus segmentos **y a quién pertenecen**.
 *
 * El cliente NO se adivina ni se le pregunta al usuario "¿de quién era esto?" — se lee del rastro que
 * el grabador dejó al iniciar, con el cliente que estaba congelado en ese momento. Pedirle al usuario
 * que lo reconstruya de memoria, dos días después, es exactamente cómo una grabación termina archivada
 * en el registro del cliente equivocado.
 *
 * Corolario duro: una sesión en disco **sin** ese rastro no se puede recuperar, y no se ofrece. Es
 * preferible perder audio a atribuirlo mal.
 */
export interface SesionHuerfana {
  sesion: SesionCaptura;
  segmentos: SegmentoAudio[];
}

/** Errores del grabador que sí cortan el flujo. `recuperable` decide si se ofrece reintentar. */
export interface ErrorCaptura {
  codigo: 'permiso_denegado' | 'sin_fuente' | 'fallo_grabador' | 'fallo_merge' | 'sin_espacio' | 'fallo_envio';
  mensaje: string;
  recuperable: boolean;
}
