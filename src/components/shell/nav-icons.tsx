import {
  Bell,
  CalendarDays,
  Ellipsis,
  FileText,
  GraduationCap,
  House,
  MessagesSquare,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

// DIG-14: иконки разделов по href (в таб-баре «Оценки» и «Ещё» используют
// те же иконки, что и боковое меню, — визуальная согласованность каркаса).
const SECTION_ICONS: Record<string, LucideIcon> = {
  '/dashboard': House,
  '/schedule': CalendarDays,
  '/grades': GraduationCap,
  '/requests': FileText,
  '/notifications': Bell,
  '/deanery': MessagesSquare,
  '/ai-assistant': Sparkles,
  '/profile': UserRound,
  '/more': Ellipsis,
};

export function sectionIcon(href: string): LucideIcon {
  return SECTION_ICONS[href] ?? House;
}
