import {
  Bell,
  BookMarked,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Compass,
  Contact,
  Ellipsis,
  FileText,
  GraduationCap,
  House,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessagesSquare,
  MessageSquareHeart,
  Rocket,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

// DIG-14: иконки разделов по href (в таб-баре «Оценки» и «Ещё» используют
// те же иконки, что и боковое меню, — визуальная согласованность каркаса).
const SECTION_ICONS: Record<string, LucideIcon> = {
  '/dashboard': House,
  '/tasks': ListChecks,
  '/schedule': CalendarDays,
  '/grades': GraduationCap,
  '/requests': FileText,
  '/notifications': Bell,
  '/deanery': MessagesSquare,
  // DIG-40 — канал обратной связи руководству.
  '/feedback': MessageSquareHeart,
  '/help': CircleHelp,
  // DIG-70 — «Справка»: детальный гайд «Как пользоваться кабинетом».
  '/guide': Compass,
  // DIG-68 — каталог студенческих стартапов «МСП».
  '/msp': Rocket,
  // DIG-42 — «Дополнительное образование» (GraduationCap занят «Успеваемостью»).
  '/dpo': BookMarked,
  '/people': Contact,
  '/ai-assistant': Sparkles,
  '/profile': UserRound,
  '/more': Ellipsis,
  // DIG-48 — кабинет сотрудника.
  '/staff': LayoutDashboard,
  '/staff/requests': ClipboardList,
  '/staff/appeals': MessagesSquare,
  '/staff/announcements': Megaphone,
};

export function sectionIcon(href: string): LucideIcon {
  return SECTION_ICONS[href] ?? House;
}
