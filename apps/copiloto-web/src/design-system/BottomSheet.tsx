import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import './primitives.css';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Título visible: renderiza un `<h2 className="uc-sheet__title">` propio Y lo usa como
   * accessible name del dialog. Omitir cuando el contenido (`children`) YA aporta su propio
   * encabezado visible (ej. `AppsScreen`, que renderiza "Tus apps"+subtítulo) — en ese caso usar
   * `ariaLabel` en su lugar para no duplicar el heading. */
  title?: string;
  /** Accessible name del dialog cuando NO se pasa `title` (contenido con header propio). Se
   * ignora si `title` está presente. */
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Umbral de arrastre hacia abajo (px) sobre el handle que dispara el cierre por gesto. */
const DRAG_DISMISS_THRESHOLD_PX = 60;

/**
 * Scrim + sheet (EXTRACT §2.11): radio superior 26px, `--card-bg`, `translateY(0|120%)`,
 * transición `.36s cubic-bezier(.32,.72,0,1)` verbatim. Cierra por click en el scrim, tecla
 * Escape, o arrastrando el handle hacia abajo ("gesto"). `role="dialog"` + foco atrapado
 * (Tab/Shift+Tab cicla dentro del sheet) + devuelve el foco al disparador al cerrar.
 *
 * Se mantiene SIEMPRE montado (controlado por `open`) para poder animar la salida — no
 * desmonta condicionalmente. Cuando `open=false`, `aria-hidden` + `pointer-events:none` lo
 * sacan del árbol de accesibilidad y de la interacción.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Foco: al abrir, guarda el elemento activo y mueve el foco al primer foco-able del sheet
  // (o al sheet mismo si no hay ninguno); al cerrar, restaura el foco original.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    const focusable = sheet?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? sheet)?.focus();

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
    if (event.key !== 'Tab' || !sheetRef.current) return;
    const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
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

  function handleHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const startY = event.clientY;
    function handlePointerMove(moveEvent: PointerEvent) {
      if (moveEvent.clientY - startY > DRAG_DISMISS_THRESHOLD_PX) {
        onClose();
        cleanup();
      }
    }
    function cleanup() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', cleanup);
    }
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', cleanup);
  }

  return (
    <div className={`uc-sheet-root${open ? ' uc-sheet-root--open' : ''}`} aria-hidden={!open}>
      <div className="uc-sheet-scrim" onClick={onClose} data-testid="bottom-sheet-scrim" />
      <div
        ref={sheetRef}
        className={['uc-sheet', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? ariaLabel}
        tabIndex={-1}
        onKeyDown={handleTabTrap}
      >
        <div
          className="uc-sheet__handle"
          aria-hidden="true"
          onPointerDown={handleHandlePointerDown}
        />
        {title ? <h2 className="uc-sheet__title">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}
