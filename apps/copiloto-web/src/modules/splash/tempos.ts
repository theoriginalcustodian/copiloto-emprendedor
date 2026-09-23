/**
 * BL-X10 — tempo CALMO (cerrado, Martín 29/07, `splash-port-reanimated.md`). No se reabre acá:
 * cualquier ajuste de ritmo es decisión de Martín, no de esta implementación.
 */
export const GROW = 1900;
export const COLLAPSE = 1450;
export const SETTLE = 780;
export const LETTER = 720;
export const LETTER_STAGGER = 150;
export const BLOB_STAGGER = Math.round(GROW * 0.2); // 380

export const N_BLOBS = 4;

/** Arranque del colapso: cuando el último blob (egg) empieza a nacer + su propio `GROW`. */
export const T_COLLAPSE_START = (N_BLOBS - 1) * BLOB_STAGGER + GROW; // 3040
/** La "O" queda visible un poco antes de que el colapso termine del todo. */
export const T_O = T_COLLAPSE_START + COLLAPSE - Math.round(COLLAPSE * 0.3); // 4055
/** El wordmark "dobi" empieza a entrar. */
export const T_WORDMARK = T_COLLAPSE_START + COLLAPSE + 300; // 4790
/** Fin del bounce de la última letra. */
export const T_BOUNCE_END = T_WORDMARK + LETTER_STAGGER * 3 + LETTER + 120; // 6080
/** Duración total de la identidad (splash), primer ingreso / post-logout. */
export const SPLASH_TOTAL_MS = 6840;

/** Entrada diaria (arranques 2..n) — cubre la latencia de carga, NO es el splash acelerado. */
export const ENTRADA_TOTAL_MS = 1500;
export const ENTRADA_FADE_MS = 340;

export const EASE = 'cubic-bezier(.2,0,0,1)';
export const EASE_BLOB = 'cubic-bezier(.5,0,.2,1)';
export const EASE_COLLAPSE = 'cubic-bezier(.32,0,.16,1)';
export const EASE_BOUNCE = 'cubic-bezier(.24,1.62,.4,1)';
/** Entrada diaria: una sola curva sin overshoot (se ve 20+ veces por día). */
export const EASE_ENTRADA = 'cubic-bezier(.2,.8,.2,1)';
