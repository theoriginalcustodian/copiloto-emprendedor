/**
 * Barrel de los primitivos del design-system (Task 4). No re-exporta ThemeProvider/themes.css
 * (fundación, Task 3, fuera de este ownership) — importar esos directo desde su archivo.
 */
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { Badge, type BadgeProps, type BadgeVariant } from './Badge';
export { Chip, type ChipProps } from './Chip';
export { MonoLabel, type MonoLabelProps } from './MonoLabel';
export { Surface, type SurfaceProps, type SurfaceVariant } from './Surface';
export { Skeleton, type SkeletonProps } from './Skeleton';
export { Toast, type ToastProps, type ToastVariant } from './Toast';
export { BottomSheet, type BottomSheetProps } from './BottomSheet';
export { StatusBar, type StatusBarProps } from './StatusBar';
export { PresenceOrb, type PresenceOrbProps } from './PresenceOrb';
export { Kit } from './Kit';
