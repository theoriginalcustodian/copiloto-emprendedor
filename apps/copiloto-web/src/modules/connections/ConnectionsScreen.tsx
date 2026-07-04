import '../../shell/shell.css';

/**
 * Placeholder del tab Conexiones (grid data-driven de servicios, 3 estados — Task 20, FASE 5).
 * Navegable desde HOY vía AppShell/TabBar; el contenido real llega en su fase. Reusa
 * `.placeholder-screen*` de shell.css (mismo estilo en los 3 placeholders, se reemplaza entero
 * cuando el módulo se implementa).
 */
export function ConnectionsScreen() {
  return (
    <div className="placeholder-screen" data-testid="connections-screen">
      <h1 className="placeholder-screen__title">Conexiones</h1>
      <p className="placeholder-screen__hint">Próximamente</p>
    </div>
  );
}
