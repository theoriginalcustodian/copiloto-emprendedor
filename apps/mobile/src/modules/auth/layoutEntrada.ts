import { StyleSheet } from 'react-native';

/**
 * Disposición compartida de la portada (`PantallaMetodo`) y las pantallas de mail que salen de ella
 * (Martin 12/11). El nombre ocupa el MISMO lugar y tamaño en todas: al pasar de la portada terracota a
 * «Creá tu cuenta» sólo cambia el color, el logotipo no salta. Lo que se toca queda abajo, al alcance del pulgar.
 */
export const HERO_ENTRADA = 88;
/** Martin 12/11: en el formulario el nombre va más chico y el contenido sube (no se pega al pie). */
export const HERO_FORMULARIO = 64;

export const estilosEntrada = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 36 },
  /** Con el teclado abierto se achica hasta `minHeight`: el nombre sigue a la vista. */
  zonaMarca: { flex: 1, minHeight: 150, justifyContent: 'center', paddingTop: 48 },
  wordmark: { textAlign: 'center', fontSize: HERO_ENTRADA, lineHeight: Math.round(HERO_ENTRADA * 1.1), letterSpacing: -2.5 },
  /** Formulario: nombre + contenido como UN bloque, centrado en la pantalla (Martin 12/11). */
  scrollFormulario: { flexGrow: 1, justifyContent: 'center', paddingVertical: 36 },
  zonaMarcaFormulario: { paddingBottom: 32 },
  wordmarkFormulario: { textAlign: 'center', fontSize: HERO_FORMULARIO, lineHeight: Math.round(HERO_FORMULARIO * 1.1), letterSpacing: -1.8 },
  linea: { textAlign: 'center', fontSize: 15, lineHeight: 21, marginBottom: 16 },
});
