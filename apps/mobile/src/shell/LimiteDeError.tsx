/**
 * `LimiteDeError` — el único lugar donde un throw en render deja de ser una pantalla negra.
 *
 * Item 0.5b del frente de manejo de errores. Antes de esto había **0** boundaries en los 215 archivos
 * de `apps/mobile` y 0 en la PWA: cualquier excepción en render desmontaba el árbol entero y el
 * emprendedor se quedaba mirando el fondo, sin mensaje y sin nada que reportar.
 *
 * **Dos responsabilidades, y la segunda es la que suele olvidarse:**
 *   1. Mostrar algo. Un fallback sobrio, sin stack trace: el usuario no debe leer nombres de módulos.
 *   2. **Dejar rastro.** Un fallback bonito que no registra nada sólo le cambia el color al silencio —
 *      y este repo ya midió que sus 61 `catch` de mobile dejan **cero** rastro. `alFallar` es el
 *      gancho para que, cuando exista la captura estructurada (Fase 1), esto ya esté cableado.
 *
 * `alFallar` se inyecta en vez de importar un logger acá a propósito: mantiene al componente sin
 * dependencias de infraestructura y hace verificable "registró el error" en un test, que es la mitad
 * que de otro modo no se puede probar.
 *
 * NO captura: errores en handlers de eventos, en código asíncrono, ni en el nivel nativo — eso es una
 * limitación de React, no una decisión. Para lo global del runtime hace falta `ErrorUtils`
 * (RN) / `window.onerror` (web), que van por separado.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  children: React.ReactNode;
  /** Se llama UNA vez por fallo, con el error real. Punto de enganche de la captura estructurada. */
  alFallar?: (error: Error, info: React.ErrorInfo) => void;
};

type State = { fallo: boolean };

export class LimiteDeError extends React.Component<Props, State> {
  state: State = { fallo: false };

  static getDerivedStateFromError(): State {
    return { fallo: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Nunca dejar que el registro del error genere otro error: si `alFallar` explota, el usuario
    // igual tiene que ver el fallback. Es el mismo principio que ARCA dejó escrito para su
    // `handleGlobalError` ("un error al loguear un error no debe generar un error nuevo").
    try {
      this.props.alFallar?.(error, info);
    } catch {
      /* el fallback manda: registrar es best-effort, mostrar no */
    }
  }

  render(): React.ReactNode {
    if (!this.state.fallo) return this.props.children;
    return (
      <View style={estilos.caja}>
        <Text style={estilos.titulo}>Algo se rompió de este lado</Text>
        <Text style={estilos.detalle}>
          No es culpa tuya. Cerrá y volvé a abrir la app; si sigue pasando, avisanos.
        </Text>
      </View>
    );
  }
}

const estilos = StyleSheet.create({
  caja: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  titulo: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  detalle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
});
