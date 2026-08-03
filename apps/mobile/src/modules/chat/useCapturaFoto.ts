import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
} from 'expo-image-picker';

import type { ArchivoSubida } from '@copiloto/core';

export interface UseCapturaFotoResult {
  /**
   * Ofrece Cámara/Galería, pide el permiso correspondiente y devuelve el archivo elegido.
   * `null` si el usuario canceló o no dio el permiso -- en ese caso NO hay nada más que hacer,
   * ver el docstring de más abajo sobre por qué el aviso vive en `ChatView`, no acá.
   */
  elegir: () => Promise<ArchivoSubida | null>;
}

/**
 * FOTO DE TICKET (Gastos Fase 2, OCR) -- puerto de captura, hermano de `useVozComando.ts` pero sin
 * máquina de fases: a diferencia de grabar audio (que tiene un ciclo grabando/pausado/listo que
 * `BotonVoz` necesita animar), elegir una foto es una sola llamada nativa que se resuelve o se
 * cancela. No hace falta estado propio.
 *
 * 🔴 **Por qué `Alert.alert` y no un menú propio.** Dos orígenes posibles (cámara / galería) con un
 * costo de UI nuevo (un action sheet a medida) que no compra nada sobre el picker nativo del
 * sistema -- mismo criterio que el permiso de micrófono denegado en `ChatView.tsx` (`Alert` nativo,
 * no un modal de vidrio). Se resuelve con el picker que el usuario ya conoce de cualquier app.
 *
 * 🔴 **CERO retención del lado de ESTE hook.** El archivo que devuelve `launchCameraAsync`/
 * `launchImageLibraryAsync` vive en la caché del sistema (cámara) o es la URI original del archivo
 * (galería, no se copia) -- este hook no lo persiste ni lo toca más allá de leer `uri`/`mimeType`.
 * El borrado post-upload lo hace `useChat.enviarFoto` (`borrarArchivoLocal`), mismo lugar y mismo
 * motivo que el audio: el archivo tiene que seguir existiendo mientras el upload lo está leyendo.
 *
 * 🔴 **`mimeType` puede faltar** (Android con algunos `ContentProvider`, ver el tipo de
 * `ImagePickerAsset`) -- se cae a `image/jpeg` porque es el default real de `launchCameraAsync` con
 * `quality` explícito (nunca produce PNG salvo que la fuente ya lo fuera, y ese caso sí trae su
 * propio `mimeType`).
 */
export function useCapturaFoto(): UseCapturaFotoResult {
  const elegir = useCallback((): Promise<ArchivoSubida | null> => {
    return new Promise((resolver) => {
      Alert.alert('Foto del ticket', '¿De dónde sacamos la foto?', [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolver(null) },
        {
          text: 'Cámara',
          onPress: () => void capturarDeCamara().then(resolver),
        },
        {
          text: 'Galería',
          onPress: () => void capturarDeGaleria().then(resolver),
        },
      ]);
    });
  }, []);

  return { elegir };
}

async function capturarDeCamara(): Promise<ArchivoSubida | null> {
  const permiso = await requestCameraPermissionsAsync();
  if (!permiso.granted) {
    Alert.alert('Sin acceso a la cámara', 'Activá el permiso de cámara en Ajustes para sacarle una foto al ticket.');
    return null;
  }
  const resultado = await launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  return archivoDeResultado(resultado);
}

async function capturarDeGaleria(): Promise<ArchivoSubida | null> {
  const permiso = await requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    Alert.alert('Sin acceso a las fotos', 'Activá el permiso de fotos en Ajustes para elegir la del ticket.');
    return null;
  }
  const resultado = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  return archivoDeResultado(resultado);
}

function archivoDeResultado(resultado: { canceled: boolean; assets: { uri: string; mimeType?: string | null }[] | null }): ArchivoSubida | null {
  if (resultado.canceled || resultado.assets === null || resultado.assets.length === 0) return null;
  const asset = resultado.assets[0]!;
  const mime = asset.mimeType ?? 'image/jpeg';
  const extension = mime === 'image/png' ? 'png' : 'jpg';
  // `datos: uri` -- mismo criterio que `useVozComando.detener()`: opaco al core, el adaptador HTTP
  // nativo adjunta el archivo por su ruta en disco.
  return { nombre: `ticket.${extension}`, mime, datos: asset.uri };
}
