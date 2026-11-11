// DIG-13 — базовые компоненты дизайн-системы «Цифрового деканата».
export { Icon, type IconProps } from './icon';
export {
  Button,
  buttonVariants,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './button';
export { Chip, type ChipProps } from './chip';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';
export { StatTile, type StatTileProps } from './stat-tile';
export { Badge, BADGE_STYLES, type BadgeProps, type BadgeStatus, type BadgeVariant } from './badge';
export { Stepper, type StepperProps, type StepState } from './stepper';
export { ProgressRing, type ProgressRingProps } from './progress-ring';
export { Toggle, type ToggleProps } from './toggle';
export { Segmented, type SegmentedOption, type SegmentedProps } from './segmented';
export { Sheet, type SheetProps } from './sheet';
export { Dialog, type DialogProps } from './dialog';
export { ToastProvider, useToast, type ToastTone } from './toast';
export { Skeleton } from './skeleton';
export { EmptyState, type EmptyStateProps } from './empty-state';
export { ErrorState, type ErrorStateProps } from './error-state';
export { Tooltip, type TooltipProps } from './tooltip';
export { Avatar, getInitials, type AvatarProps } from './avatar';
