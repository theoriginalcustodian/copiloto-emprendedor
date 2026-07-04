import { ThemeProvider } from './design-system/ThemeProvider';
import { AppShell } from './shell/AppShell';

export function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
