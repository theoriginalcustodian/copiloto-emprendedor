import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * **¿El usuario pidió menos movimiento?** — el ajuste de accesibilidad del sistema, leído en vivo.
 *
 * 🔴 **Para lo que DECORA, no para lo que INFORMA.** Ésa es la línea, y hay que aplicarla a mano
 * porque ninguna librería la sabe: apagar el latido del micrófono no le quita información a nadie
 * —el botón sigue ahí, del mismo color—, pero apagar la onda de audio sí, porque ese movimiento **es**
 * la respuesta a *«¿me está escuchando?»*. Un punto que parpadea para decir «grabando» está en el
 * medio: se apaga, y la información no se pierde **porque además está escrita al lado**. Cuando el
 * único portador de un dato es el movimiento, el movimiento se queda.
 *
 * 🔴 **Por qué importa de verdad, más allá de una casilla de accesibilidad.** Esta app tiene dos
 * animaciones que laten **permanentemente** en la pantalla principal —el micrófono y el punto de
 * estado—. Para alguien con trastorno vestibular o sensibilidad al movimiento, eso no es un detalle
 * estético: es una pantalla en la que no se puede estar. El ajuste existe para eso y no lo estábamos
 * escuchando.
 *
 * 🔵 **Y tiene un segundo efecto que descubrimos al revés.** Backend midió que `uiautomator` no puede
 * volcar la jerarquía de la app —*«could not get idle state»*— porque espera a que la UI quede quieta,
 * y estos dos loops **nunca la dejan quieta**. O sea que el E2E por ADB estaba bloqueado por una
 * animación decorativa. Respetar el ajuste del sistema lo destraba **sin agregar ninguna flag de
 * test**: en Android, `isReduceMotionEnabled()` lee `Settings.Global.TRANSITION_ANIMATION_SCALE`
 * (verificado en `AccessibilityInfoModule.kt` de React Native, no deducido), que es exactamente lo
 * que ya se apaga con `settings put global transition_animation_scale 0`.
 *
 * Preferimos esto a una flag de test por una razón que va más allá de la comodidad: **una flag crea un
 * segundo modo de la app que nadie usa y que sólo se ejercita en el laboratorio**, así que el E2E
 * termina midiendo una app que ningún emprendedor tiene. Acá el E2E mide **la app real**, con un
 * ajuste que un usuario real también puede tener.
 *
 * ⚠️ **Se suscribe a los cambios, no lo lee una sola vez.** Reanimated resuelve esto en tiempo de
 * carga del módulo (`const IS_REDUCED_MOTION_ENABLED_IN_SYSTEM = …`), así que cambiar el ajuste con la
 * app abierta no le hace efecto hasta reiniciarla. Acá no: si alguien lo activa desde Ajustes de
 * Android, la app deja de latir en el momento.
 */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(false);

  useEffect(() => {
    let vivo = true;
    // El valor inicial llega por promesa. Si falla —plataforma sin soporte, mock incompleto— se
    // queda en `false`: el default es la app COMO ES HOY. Un fallo de lectura no puede apagarle las
    // animaciones a alguien que no las pidió apagar.
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (vivo) setReducido(v === true);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      if (vivo) setReducido(v === true);
    });

    return () => {
      vivo = false;
      sub?.remove();
    };
  }, []);

  return reducido;
}
