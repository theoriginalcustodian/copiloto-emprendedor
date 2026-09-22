/**
 * Textos de la ENTRADA a la app (reveal post-logout + credenciales), compartidos por web y mobile
 * (BL-X12m / BL-X12w) para que no diverjan: una sola fuente, el prototipo `?ver=volver|ingresar-error`.
 */

/** Error de credenciales del intento actual. Prototipo `index.html:2593`. */
export const TEXTO_CREDENCIALES_INCORRECTAS = 'Ese mail y esa contraseña no coinciden. Probá de nuevo.';

/** Pie de la pantalla `ingresar`: tranquiliza a quien vuelve. */
export const TEXTO_PIE_INGRESAR = 'Tus datos quedan guardados: al volver a entrar está todo como lo dejaste.';

/**
 * El MISMO reveal en sus dos aterrizajes según la sesión (spec §8): primera vez vs. quien ya tuvo
 * cuenta y salió. No son dos pantallas — sólo cambian las dos puertas.
 */
export const TEXTOS_REVEAL = {
  primeraVez: { primario: 'Empecemos', secundario: 'Crear una nueva cuenta' },
  volver: { primario: 'Entrar', secundario: 'Entrar con otra cuenta' },
} as const;

export const PRONUNCIACION_MARCA = 'se dice o-DO-bi';
