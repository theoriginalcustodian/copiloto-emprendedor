import { Alert, Linking, Share } from 'react-native';

/**
 * Abrir un link y compartirlo, sin que un fallo se pierda en el aire.
 *
 * 🔴 **`Linking.openURL` y `Share.share` RECHAZAN, y nadie los estaba escuchando.** Los cinco lugares
 * que los usaban hacían `await Linking.openURL(link)` sin `catch`: si el teléfono no tiene con qué
 * abrir la URL, si el link vino roto, o si el usuario cierra la hoja de compartir de una forma que la
 * plataforma reporta como error, la promesa rechaza y queda como unhandled rejection — caja roja en
 * desarrollo y **nada** en producción. Para el emprendedor eso es un botón que no hace nada: toca
 * "Guardar" tres veces y concluye que su factura no está.
 *
 * Un botón que no puede cumplir tiene que decirlo. `Alert.alert` es el mecanismo que la app ya usa
 * para esto (`PantallaMiDia`), no uno nuevo.
 *
 * Vive acá y no repetido en cada card por la razón de siempre: cinco `try/catch` copiados son cinco
 * lugares donde el próximo botón se olvida del suyo.
 */
export async function abrirLink(url: string, queEs = 'el archivo'): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert(
      `No se pudo abrir ${queEs}`,
      'Puede que el link haya vencido o que no haya una app para abrirlo. Probá compartirlo.',
    );
    return false;
  }
}

/**
 * Comparte un link. **Cancelar NO es un error** — y distinguirlo importa: en iOS, cerrar la hoja de
 * compartir resuelve con `action: 'dismissedAction'`, así que avisar ahí sería acusar de fallo a un
 * usuario que simplemente cambió de idea. Sólo el rechazo real de la promesa se reporta.
 */
export async function compartirLink(url: string, queEs = 'el archivo'): Promise<boolean> {
  try {
    await Share.share({ message: url, url });
    return true;
  } catch {
    Alert.alert(`No se pudo compartir ${queEs}`, 'Probá de nuevo en un momento.');
    return false;
  }
}
