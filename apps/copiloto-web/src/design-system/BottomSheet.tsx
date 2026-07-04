import {
  useEffect,
  useRef,
  useState,
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

/** Umbral de arrastre hacia abajo (px) que, al soltar, dispara el cierre por gesto. */
const DRAG_DISMISS_THRESHOLD_PX = 60;

/** Guard del drag-to-dismiss: si el pointerdown arranca sobre uno de estos, NO se inicia el
 * tracking de arrastre (dejamos que el elemento interactivo maneje su propio gesto/click). */
const INTERACTIVE_SELECTOR = 'button, a, textarea, input, select, [role="button"]';

/**
 * Scrim + sheet (EXTRACT §2.11): radio superior 26px, `--card-bg`, `translateY(0|120%)`,
 * transición `.36s cubic-bezier(.32,.72,0,1)` verbatim. Cierra por click en el scrim, tecla
 * Escape, o **arrastrando el sheet hacia abajo** (el sheet sigue el dedo; si soltás pasado el
 * umbral cierra, si no vuelve a su lugar). `role="dialog"` + foco atrapado (Tab/Shift+Tab cicla
 * dentro del sheet) + devuelve el foco al disparador al cerrar.
 *
 * El drag necesita `touch-action: none` en `.uc-sheet` (primitives.css) — sin eso, en un touch
 * device el navegador se queda con el gesto vertical y los `pointermove` nunca llegan al JS (causa
 * raíz por la que el swipe-down "no respondía" en el celu; los tests jsdom no lo cazaron porque
 * jsdom no modela `touch-action`).
 *
 * Se mantiene SIEMPRE montado (controlado por `open`) para poder animar la salida — no desmonta
 * condicionalmente. Cuando `open=false`, `aria-hidden` + `pointer-events:none` lo sacan del árbol
 * de accesibilidad y de la interacción.
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
  // Desplazamiento actual del arrastre (px hacia abajo). 0 = en reposo → deja que el CSS maneje el
  // transform (translateY(0) abierto, con transición). >0 → sigue el dedo 1:1, sin transición.
  const [dragY, setDragY] = useState(0);

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

  // Resetea el arrastre al cerrar, para que la próxima apertura arranque en reposo.
  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

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

  /** Drag-to-dismiss "follow the finger": enganchado en `.uc-sheet` (todo el cuerpo). El sheet baja
   * con el dedo (`dragY`); al soltar, si pasó el umbral cierra, si no vuelve a su lugar (snap-back
   * animado por el CSS al volver `dragY` a 0). Guard: si arranca sobre un elemento interactivo no
   * inicia el tracking, para no robarle el gesto a un tap/click legítimo dentro del sheet. */
  function handleSheetPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    const startY = event.clientY;
    let dragged = 0;
    function handlePointerMove(moveEvent: PointerEvent) {
      dragged = Math.max(0, moveEvent.clientY - startY);
      setDragY(dragged);
    }
    function handlePointerEnd() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerEnd);
      document.removeEventListener('pointercancel', handlePointerEnd);
      if (dragged > DRAG_DISMISS_THRESHOLD_PX) onClose();
      setDragY(0);
    }
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerEnd);
    document.addEventListener('pointercancel', handlePointerEnd);
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
        onPointerDown={handleSheetPointerDown}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div className="uc-sheet__handle" aria-hidden="true" />
        {title ? <h2 className="uc-sheet__title">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}
