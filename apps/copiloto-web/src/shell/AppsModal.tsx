import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

import './desktop.css';

export interface AppsModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Ícono X del botón de cierre (diseño `Copiloto Web.dc.html:371`, verbatim). */
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Modal centrado de "Tus apps" (DESKTOP-ONLY, gap estructural #1 del audit desktop —
 * `Copiloto Web.dc.html:363-402` verbatim): overlay clickeable + panel 440px con scrim, transform
 * `scale(.96→1)` + fade, y botón X. Reemplaza el statu-quo de "Apps como pantalla de tab" en
 * `DesktopShell` — acá Apps es un OVERLAY transitorio sobre lo que sea que esté activo detrás
 * (Chat/Conexiones/Cuenta), igual que en el mock (el modal es hermano de `<main>`, no lo reemplaza).
 *
 * Envuelve `AppsScreen` (pasado como `children`) SIN duplicar su header: el título "Tus apps" +
 * subtítulo ya los renderiza `AppsScreen` (verbatim, ver `modules/apps/AppsScreen.tsx`) — este
 * componente solo aporta el chrome que le falta para vivir en un modal (scrim + panel + X). Se
 * monta FUERA de `.desktop-shell__content` (ver `DesktopShell.tsx`) para que `AppsScreen` use su
 * CSS base (~440px, `apps.css`), no el override de columna (900/640px) de las demás pantallas.
 *
 * Mismo criterio de accesibilidad que `design-system/BottomSheet.tsx` (foco atrapado, Escape,
 * scrim-click, restaura el foco al cerrar) pero NO se reusa ese componente directo: la animación es
 * estructuralmente distinta (`scale`+`translate(-50%,-50%)` centrado vs. `translateY` desde abajo)
 * y la regla del proyecto es valores BASE=mobile con overrides de escritorio — mobile ya tiene su
 * propio `BottomSheet`, este es el equivalente desktop-only, no una variante del mismo componente.
 */
export function AppsModal({ open, onClose, children }: AppsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? panel)?.focus();

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  function handleTabTrap(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className={['apps-modal-root', open ? 'apps-modal-root--open' : '']
        .filter(Boolean)
        .join(' ')}
      aria-hidden={!open}
      data-testid="apps-modal-root"
    >
      <div
        className="apps-modal-scrim"
        onClick={onClose}
        data-testid="apps-modal-scrim"
      />
      <div
        ref={panelRef}
        className="apps-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Tus apps"
        tabIndex={-1}
        onKeyDown={handleTabTrap}
        data-testid="apps-modal-panel"
      >
        <button
          type="button"
          className="apps-modal-close"
          onClick={onClose}
          aria-label="Cerrar"
          data-testid="apps-modal-close"
        >
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>
  );
}
