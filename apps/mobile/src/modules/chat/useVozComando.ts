import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

import type { ArchivoSubida } from '@copiloto/core';

/** Fase de la grabación del copiloto. `listo` = ya se detuvo y espera Enviar o Descartar. */
export type FaseVoz = 'inactivo' | 'grabando' | 'pausado' | 'listo';

/**
 * ¿Hay micrófono ABIERTO ahora mismo? Puerto directo del `capturaViva` de documed (mismo nombre,
 * misma pregunta): decide si algo que dependa de "¿se puede interrumpir esta pantalla?" lo puede
 * hacer sin arriesgarse a dejar el micrófono grabando sin que el usuario se dé cuenta.
 *
 * 🔴 `pausado` y `listo` NO son vivas. En pausa el micrófono está cerrado y el audio guardado; en
 * `listo` ya se cortó. Sólo `grabando` tiene el micrófono realmente abierto.
 */
export function capturaViva(fase: FaseVoz): boolean {
  return fase === 'grabando';
}

export interface UseVozComandoResult {
  fase: FaseVoz;
  /** Segundos capturados. Sale del reloj del propio grabador, así que la pausa NO cuenta. */
  segundos: number;
  /** Ventana de niveles del micrófono (0..1) para la onda del HUD. */
  niveles: number[];
  /** Arranca la grabación. Devuelve `false` si el usuario no dio permiso de micrófono. */
  iniciar: () => Promise<boolean>;
  pausar: () => void;
  reanudar: () => void;
  /** Corta y pasa a `listo`, guardando el archivo para que el usuario decida. */
  detener: () => Promise<void>;
  /** Tira lo grabado y vuelve a `inactivo`. Única vía de perder el audio. */
  descartar: () => Promise<void>;
  /** El archivo de la fase `listo`, o `null`. Consumirlo devuelve la máquina a `inactivo`. */
  tomar: () => ArchivoSubida | null;
}

/** Ventana de la onda: cuántas muestras se dibujan a la vez. */
const MUESTRAS_ONDA = 32;
/** Cada cuánto se lee el estado del grabador (nivel + cronómetro). ~10 Hz, igual que el HUD de documed. */
const MS_MUESTREO = 100;
/** Piso en dBFS que se considera silencio. Por debajo, la barra queda en 0. */
const PISO_DBFS = -60;

/** El preset de siempre, pero con el nivel de micrófono activado — sin esto la onda queda plana. */
const PRESET = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/**
 * VOZ-COMANDO: el audio con el que el usuario le habla al copiloto.
 *
 * 🔴 Usa `expo-audio` — decisión F6, con el porqué completo en el docstring de
 * `adapters/audio/index.ts` (que sigue vacío a propósito: el hook es el punto de integración, no
 * hay puerto agnóstico que implementar). Resumen: este producto no retiene audio en el
 * dispositivo (D6) — el dictado va directo a `/chat/audio` (`api/audio.ts::sendAudio`, Groq
 * Whisper) y vuelve como texto ya transcripto. Sin retención ni reanudación que garantizar, la
 * segmentación a disco de `react-native-audio-api` sería música sobre un problema que no existe.
 *
 * 🔴 **CERO retención**: el archivo que produce el grabador vive en la carpeta de caché de
 * `expo-audio` mientras dura la sesión, pero nadie de este módulo lo persiste a propósito ni lo
 * expone más allá de `tomar()`. Quien lo consume (`useChat.enviarAudio`) lo borra del filesystem
 * apenas termina de subirlo — ver el docstring de `enviarAudio` para el porqué de que el borrado
 * viva ahí y no acá (el archivo tiene que seguir existiendo mientras el upload lo está leyendo).
 *
 * Es una máquina de fases (no tres funciones sueltas) porque el gesto de `BotonVoz` (mantener
 * apretado / deslizar para fijar / soltar) necesita fase, cronómetro y niveles para las waves y los
 * controles flotantes — ver `contrato_..._dictado-por-voz-sin-glass...`. Sigue sin segmentar a
 * disco, que es lo que la mantiene simple.
 *
 * 🔴 **Pre-warm — el `onPressIn` NO puede esperar tres `await`s.** `contrato_..._dictado-por-voz-
 * sin-glass...` §2.bis, medido por el operador como el punto de fricción real (Groq transcribe
 * rápido; lo que se siente lento es el arranque). El permiso se pide UNA vez (cacheado en
 * `permisoRef`), el audio mode se configura UNA vez, y `grabador.prepareToRecordAsync()` corre
 * **antes** del press (al montar, y de nuevo en background después de cada `detener()`/`descartar()`)
 * — así el camino caliente de `iniciar()` es sólo `grabador.record()`, sin ningún `await` antes.
 *
 * `precalentar()` deduplica llamadas concurrentes con `prepararPromiseRef`: si `iniciar()` llega
 * mientras el re-prepare de después del último `detener()` sigue en vuelo (la carrera que el
 * contrato pide cuidar), espera esa MISMA promesa en vez de disparar un `prepareToRecordAsync()`
 * paralelo — dos preparos concurrentes sobre el mismo grabador nativo son terreno no verificado.
 */
export function useVozComando(): UseVozComandoResult {
  const grabador = useAudioRecorder(PRESET);
  const [fase, setFase] = useState<FaseVoz>('inactivo');
  const [segundos, setSegundos] = useState(0);
  const [niveles, setNiveles] = useState<number[]>([]);
  const archivoRef = useRef<ArchivoSubida | null>(null);
  // Espejo síncrono de la fase: `detener()` puede llegar por un toque disparado sin que `iniciar()`
  // haya terminado su cadena de awaits (el usuario apretó y soltó rapidísimo). Sin esta guarda, se
  // llamaría `stop()` sobre un grabador que nunca arrancó.
  const vivoRef = useRef(false);

  // `null` = todavía no se supo (primer chequeo pendiente); `true`/`false` = último resultado
  // conocido. Se re-consulta cada vez que NO es `true` (permiso denegado no queda cacheado para
  // siempre: el usuario puede haberlo concedido después, desde Ajustes, y ese chequeo es gratis
  // frente al costo real que es `prepareToRecordAsync`).
  const permisoRef = useRef<boolean | null>(null);
  const audioModeListoRef = useRef(false);
  const preparadoRef = useRef(false);
  const prepararPromiseRef = useRef<Promise<void> | null>(null);

  const precalentar = useCallback((): Promise<void> => {
    if (prepararPromiseRef.current) return prepararPromiseRef.current;
    if (preparadoRef.current) return Promise.resolve();

    const promesa = (async () => {
      if (permisoRef.current !== true) {
        const permiso = await requestRecordingPermissionsAsync();
        permisoRef.current = permiso.granted;
      }
      if (!permisoRef.current) return;

      // `allowsRecording` hay que pedirlo explícito: sin esto, en Android el grabador arranca
      // "bien" y devuelve un archivo mudo -- un fallo que NO tira error y que sólo se descubre
      // escuchando. Una sola vez: no cambia entre grabaciones de la misma sesión.
      if (!audioModeListoRef.current) {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        audioModeListoRef.current = true;
      }

      await grabador.prepareToRecordAsync();
      preparadoRef.current = true;
    })().finally(() => {
      prepararPromiseRef.current = null;
    });

    prepararPromiseRef.current = promesa;
    return promesa;
  }, [grabador]);

  // Pre-calienta al montar (foco del chat) — para cuando llegue el primer press, el permiso y el
  // `prepare` ya deberían estar resueltos.
  useEffect(() => {
    void precalentar();
  }, [precalentar]);

  // Muestreo del grabador mientras hay captura viva: alimenta la onda y el cronómetro. Se apaga
  // solo al salir de `grabando` — un intervalo corriendo con la app en `listo` gastaría batería sin
  // dibujar nada.
  useEffect(() => {
    if (fase !== 'grabando') return undefined;
    const id = setInterval(() => {
      if (!vivoRef.current) return; // el grabador ya se cortó; no pisar el cronómetro final
      const estado = grabador.getStatus();
      setSegundos(Math.floor(estado.durationMillis / 1000));
      const db = estado.metering;
      // `metering` es opcional en el contrato: si la plataforma no lo entrega, la onda queda quieta
      // en vez de romper. Mapeo dBFS -> 0..1 con piso en PISO_DBFS.
      const nivel = typeof db === 'number' ? Math.max(0, Math.min(1, (db - PISO_DBFS) / -PISO_DBFS)) : 0;
      setNiveles((previos) => [...previos, nivel].slice(-MUESTRAS_ONDA));
    }, MS_MUESTREO);
    return () => clearInterval(id);
  }, [fase, grabador]);

  const iniciar = useCallback(async (): Promise<boolean> => {
    // 🔴 El camino caliente: si ya está pre-calentado (el caso normal — mount o el re-prepare del
    // `detener()`/`descartar()` anterior ya corrieron), esta rama no tiene NINGÚN `await` antes de
    // `record()` — el efecto (mic abierto, `fase` en `grabando`) es sincrónico dentro de esta misma
    // función `async`, aunque su firma siga devolviendo una `Promise` (contrato §2.bis: feedback
    // optimista en `onPressIn`, antes de cualquier async real).
    if (!preparadoRef.current) {
      await precalentar();
    }
    if (permisoRef.current !== true) return false;

    grabador.record();
    vivoRef.current = true;
    // Se consumió el prepare de este ciclo: el próximo `iniciar()` necesita uno nuevo, que arranca
    // en background apenas termine este `detener()`/`descartar()` (nunca acá, en el camino caliente).
    preparadoRef.current = false;
    archivoRef.current = null;
    setSegundos(0);
    setNiveles([]);
    setFase('grabando');
    return true;
  }, [grabador, precalentar]);

  const pausar = useCallback(() => {
    if (!vivoRef.current) return;
    grabador.pause();
    setFase('pausado');
  }, [grabador]);

  const reanudar = useCallback(() => {
    if (!vivoRef.current) return;
    grabador.record();
    setFase('grabando');
  }, [grabador]);

  const detener = useCallback(async (): Promise<void> => {
    if (!vivoRef.current) return;

    // 🔴 La duración se lee ANTES de cortar y se fija después — mismo cuidado que documed: si no,
    // un tick del muestreo puede colarse entre el `stop()` y la limpieza del intervalo, leer un
    // grabador ya detenido (`durationMillis: 0`) y dejar el cronómetro en 00:00 sobre una grabación
    // que sí tiene audio.
    const msFinales = grabador.getStatus().durationMillis;
    vivoRef.current = false;

    await grabador.stop();
    setSegundos(Math.floor(msFinales / 1000));
    const uri = grabador.uri;
    // `datos: uri` -- en nativo el adaptador HTTP adjunta el archivo por su ruta en disco
    // (`http.native.ts`); el core trata `ArchivoSubida.datos` como opaco.
    archivoRef.current = uri === null ? null : { nombre: 'voz.m4a', mime: 'audio/mp4', datos: uri };
    // Sin archivo no hay nada que ofrecer: se vuelve a `inactivo` en vez de mostrar un "Enviar" que
    // no enviaría nada.
    setFase(archivoRef.current === null ? 'inactivo' : 'listo');
    // Re-arma para el PRÓXIMO press, en background — nunca en el camino caliente de `iniciar()`.
    void precalentar();
  }, [grabador, precalentar]);

  const descartar = useCallback(async (): Promise<void> => {
    if (vivoRef.current) {
      vivoRef.current = false;
      await grabador.stop();
    }
    archivoRef.current = null;
    setSegundos(0);
    setNiveles([]);
    setFase('inactivo');
    void precalentar();
  }, [grabador, precalentar]);

  const tomar = useCallback((): ArchivoSubida | null => {
    const archivo = archivoRef.current;
    archivoRef.current = null;
    setSegundos(0);
    setNiveles([]);
    setFase('inactivo');
    return archivo;
  }, []);

  return { fase, segundos, niveles, iniciar, pausar, reanudar, detener, descartar, tomar };
}
