/**
 * `calcularDesplazamiento` — dado dónde quedó un campo y dónde termina el área visible, cuánto hay
 * que scrollear para que se vea entero.
 *
 * Vive separado de `ScrollFormulario` **porque es la única parte con lógica**, y medir en device es
 * lo caro. Acá se testea con números; el pegamento (`measureInWindow` + `scrollTo`) es trivial y se
 * verifica en el teléfono. Partirlo así es lo que evita el gate que confirma en vez de verificar:
 * un test de jsdom sobre el componente entero pasaría en verde sin ejercitar nada, porque
 * `measureInWindow` nunca llama a su callback fuera de un device.
 *
 * Todas las coordenadas son **de ventana** (`measureInWindow`), no relativas al padre: un campo puede
 * estar anidado a cualquier profundidad dentro del scroll y las coordenadas de ventana no dependen de
 * esa jerarquía. Ese es justamente el motivo de no usar `onLayout`, que sí es relativo al padre
 * inmediato y obligaría a acumular offsets a mano por cada nivel.
 */

/** Aire entre el campo y el borde del área visible. Sin esto el campo queda pegado al teclado. */
export const MARGEN_REVELADO = 16;

export interface MedidasRevelado {
  /** Borde superior del área visible del scroll, en coordenadas de ventana. */
  areaY: number;
  /** Alto del área visible del scroll — ya descontado el teclado por el `KeyboardAvoidingView`. */
  areaAlto: number;
  /** Borde superior del campo, en coordenadas de ventana. */
  campoY: number;
  campoAlto: number;
  /** Desplazamiento actual del scroll (`contentOffset.y`). */
  offsetActual: number;
  margen?: number;
}

/**
 * Devuelve el nuevo `offset` al que scrollear, o `null` si el campo ya se ve entero.
 *
 * Devolver `null` en vez de "el mismo offset" no es cosmético: deja que quien llama **no scrollee en
 * absoluto** cuando no hace falta. Un `scrollTo` al mismo lugar igual cancela el gesto de scroll que
 * el usuario podría estar haciendo con el dedo.
 */
export function calcularDesplazamiento({
  areaY,
  areaAlto,
  campoY,
  campoAlto,
  offsetActual,
  margen = MARGEN_REVELADO,
}: MedidasRevelado): number | null {
  const bordeInferiorArea = areaY + areaAlto - margen;
  const bordeSuperiorArea = areaY + margen;
  const bordeInferiorCampo = campoY + campoAlto;

  // Tapado por abajo (el caso del teclado): bajar el contenido lo justo para que entre.
  if (bordeInferiorCampo > bordeInferiorArea) {
    // 🔴 Si el campo es MÁS ALTO que el área visible no se lo puede mostrar entero. Se prioriza su
    // borde SUPERIOR: en un campo de texto es donde está el cursor al empezar a escribir, y dejar
    // visible el final de un campo cuyo comienzo quedó fuera es peor que lo contrario.
    const excedente = Math.min(
      bordeInferiorCampo - bordeInferiorArea,
      Math.max(campoY - bordeSuperiorArea, 0)
    );
    return excedente > 0 ? offsetActual + excedente : null;
  }

  // Tapado por arriba: pasa al volver a un campo ya scrolleado fuera de vista (p. ej. el teclado
  // cambia de alto entre un campo numérico y uno de texto y el layout se reasienta).
  if (campoY < bordeSuperiorArea) {
    return Math.max(offsetActual - (bordeSuperiorArea - campoY), 0);
  }

  return null;
}
