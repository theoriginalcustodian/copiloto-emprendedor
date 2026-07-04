import '../../shell/shell.css';

/**
 * Placeholder del tab Cuenta (perfil, selector de 4 temas, durabilidad, logout — Task 21,
 * FASE 5). Navegable desde HOY vía AppShell/TabBar; el contenido real llega en su fase. Reusa
 * `.placeholder-screen*` de shell.css (mismo estilo en los 3 placeholders, se reemplaza entero
 * cuando el módulo se implementa).
 *
 * Nota para Task 21: hoy "Cerrar sesión" vive TEMPORALMENTE en `ChatHeader` (ver su docstring);
 * cuando este módulo implemente su propio logout, se retira de ahí.
 */
export function AccountScreen() {
  return (
    <div className="placeholder-screen" data-testid="account-screen">
      <h1 className="placeholder-screen__title">Cuenta</h1>
      <p className="placeholder-screen__hint">Próximamente</p>
    </div>
  );
}
