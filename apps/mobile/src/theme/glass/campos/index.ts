/**
 * Barril de `theme/glass/campos/` -- primitivos de formulario extraídos del `Composer` del chat.
 * Ver el docstring de cada archivo para el porqué de cada pieza; `EnvolturaCampo` es el vidrio común.
 */
export { EnvolturaCampo } from './EnvolturaCampo';
export type { EnvolturaCampoProps } from './EnvolturaCampo';

export { CampoTexto } from './CampoTexto';
export type { CampoTextoProps } from './CampoTexto';

export { CampoNumero } from './CampoNumero';
export type { CampoNumeroProps } from './CampoNumero';

export { CampoSecreto } from './CampoSecreto';
export type { CampoSecretoProps } from './CampoSecreto';

export { CampoSelect } from './CampoSelect';
export type { CampoSelectProps, OpcionSelect } from './CampoSelect';

export { CampoFecha } from './CampoFecha';
export type { CampoFechaProps } from './CampoFecha';

export { FilaBotones } from './FilaBotones';
export type { FilaBotonesProps, BotonFila, VarianteBoton } from './FilaBotones';

export { IconoOjo } from './IconoOjo';
export type { IconoOjoProps } from './IconoOjo';

// El área de scroll de toda pantalla CON campos: revela el campo enfocado por encima del teclado.
// La otra mitad del arreglo vive en `MarcoGlass` (`KeyboardAvoidingView`) -- ver su docstring.
export { ScrollFormulario, useRevelarCampo } from './ScrollFormulario';
export type { ScrollFormularioProps, NodoMedible } from './ScrollFormulario';

export { calcularDesplazamiento, MARGEN_REVELADO } from './revelarCampo';
export type { MedidasRevelado } from './revelarCampo';
