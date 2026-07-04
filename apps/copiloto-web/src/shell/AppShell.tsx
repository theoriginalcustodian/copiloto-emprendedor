/**
 * AppShell — placeholder de la Fase 0 (scaffold). El shell real (tab-bar Chat·Apps·Conexiones·
 * Cuenta, routing, hide-on-scroll) es el Task 9 (FASE 2); acá solo se establece el frame
 * mobile-first + el punto de montaje para que el resto de las tareas tenga dónde apoyarse.
 */
export function AppShell() {
  return (
    <div className="app-frame" data-testid="app-shell">
      <main>
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--mono)', padding: 16 }}>
          Copiloto del Emprendedor — cargando tu copiloto…
        </p>
      </main>
    </div>
  );
}
