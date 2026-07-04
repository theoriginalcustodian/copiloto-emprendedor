import '../../shell/shell.css';

/**
 * Placeholder del tab Apps (sheet "Tus apps"/modos — Task 17, FASE 3). Navegable desde HOY vía
 * AppShell/TabBar; el contenido real (filas de servicios `connected`, `activeMode`, bottom-sheet)
 * llega en su fase. Reusa `.placeholder-screen*` de shell.css (mismo estilo en los 3 placeholders,
 * se reemplaza entero cuando el módulo se implementa).
 */
export function AppsScreen() {
  return (
    <div className="placeholder-screen" data-testid="apps-screen">
      <h1 className="placeholder-screen__title">Apps</h1>
      <p className="placeholder-screen__hint">Próximamente</p>
    </div>
  );
}
