import { useState } from 'react';

import { Badge } from './Badge';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Chip } from './Chip';
import { MonoLabel } from './MonoLabel';
import { PresenceOrb } from './PresenceOrb';
import { Skeleton } from './Skeleton';
import { StatusBar } from './StatusBar';
import { Surface } from './Surface';
import { useTheme } from './ThemeProvider';
import { Toast } from './Toast';

/**
 * Página de inspección visual del design-system: renderiza TODOS los primitivos y sus
 * variantes en el tema activo, con selector de los 4 temas (`useTheme`). Uso: QA visual
 * manual/Playwright multi-tema — NO se monta en App.tsx (el shell real es Task 9); montarla
 * puntualmente (ruta /kit o import directo) cuando se necesite inspeccionar.
 */
export function Kit() {
  const { theme, setTheme, themes } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [selectedChip, setSelectedChip] = useState<'a' | 'b'>('a');

  return (
    <div className="app-frame" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <StatusBar />

      <section>
        <MonoLabel>Tema</MonoLabel>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {themes.map((t) => (
            <Chip key={t} selected={t === theme} onClick={() => setTheme(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <MonoLabel>Botones</MonoLabel>
        <Button variant="primary">Sí, cobrar $15.000</Button>
        <Button variant="cancel">Cancelar</Button>
        <Button variant="ghost">Conectar</Button>
        <Button variant="danger">Mantené para publicar</Button>
        <Button variant="primary" disabled>
          Deshabilitado
        </Button>
      </section>

      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <MonoLabel>Badges</MonoLabel>
        <Badge variant="warning">REVISAR</Badge>
        <Badge variant="danger">IRREVERSIBLE</Badge>
        <Badge variant="ok">CONECTADO</Badge>
        <Badge variant="neutral">NEUTRAL</Badge>
      </section>

      <section style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <MonoLabel>Chips</MonoLabel>
        <Chip selected={selectedChip === 'a'} onClick={() => setSelectedChip('a')}>
          Juan Pérez
        </Chip>
        <Chip selected={selectedChip === 'b'} onClick={() => setSelectedChip('b')}>
          Juan Gómez
        </Chip>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <MonoLabel>Surfaces</MonoLabel>
        <Surface variant="card">Card — $ 15.000</Surface>
        <Surface variant="tile">Tile — Mercado Pago</Surface>
        <Surface variant="bubble" blur>
          Burbuja del asistente (blur)
        </Surface>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MonoLabel>Skeleton</MonoLabel>
        <Skeleton height={14} width="60%" />
        <Skeleton height={44} />
      </section>

      <section style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <MonoLabel>Presence orb</MonoLabel>
        <PresenceOrb />
        <PresenceOrb size={28} />
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MonoLabel>Bottom sheet</MonoLabel>
        <Button variant="cancel" onClick={() => setSheetOpen(true)}>
          Abrir sheet
        </Button>
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Tus apps">
          <p style={{ color: 'var(--text)' }}>Contenido de ejemplo del sheet.</p>
        </BottomSheet>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MonoLabel>Toast</MonoLabel>
        <Button variant="cancel" onClick={() => setToastOpen(true)}>
          Mostrar toast
        </Button>
        {toastOpen ? (
          <Toast message="Cobro confirmado" variant="ok" onDismiss={() => setToastOpen(false)} />
        ) : null}
      </section>
    </div>
  );
}
