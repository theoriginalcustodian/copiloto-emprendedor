/**
 * Los cinco temas del prototipo, con su orden y su texto.
 *
 * `pregunta` es lo que se le dice al copiloto, en primera persona y en voseo — no el título del
 * tema. El título nombra un asunto («Cargar un gasto hablando»); lo que entra al chat tiene que ser
 * una pregunta que alguien haría de verdad, o la conversación arranca torcida.
 */
export interface TemaAyuda {
  titulo: string;
  detalle: string;
  pregunta: string;
}

export const TEMAS_AYUDA: readonly TemaAyuda[] = [
  {
    titulo: 'Cargar un gasto hablando',
    detalle: 'Lo más rápido de todo: apretás el mic y contás qué pagaste',
    pregunta: '¿Cómo cargo un gasto hablando?',
  },
  {
    titulo: 'Emitir tu primera factura',
    detalle: 'Qué te va a pedir y por qué te lo muestra antes de emitir',
    pregunta: '¿Cómo emito mi primera factura?',
  },
  {
    titulo: 'Conectar Mercado Pago',
    detalle: 'Qué ve Odobi de tus cobros, y cómo cortarlo cuando quieras',
    pregunta: '¿Cómo conecto Mercado Pago y qué vas a poder ver?',
  },
  {
    titulo: 'Entender Mi día',
    detalle: 'De dónde salen los avisos y por qué algunos se cierran solos',
    pregunta: '¿De dónde salen los avisos de Mi día?',
  },
  {
    titulo: 'Corregir algo que salió mal',
    detalle: 'Se corrige ANTES de guardar, en la card. Después no se edita',
    pregunta: '¿Cómo corrijo algo que cargué mal?',
  },
];

