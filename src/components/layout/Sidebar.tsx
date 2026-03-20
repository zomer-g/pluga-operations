import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  Users,
  Package,
  ScrollText,
  Target,
  FileBarChart,
  Settings,
  Calendar,
  ClipboardList,
  BookOpen,
  Heart,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanAccessPage } from '@/features/permissions/usePermissions';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'לוח בקרה' },
  { to: '/soldiers', icon: Users, label: 'חיילים' },
  { to: '/equipment', icon: Package, label: 'ציוד' },
  { to: '/shampaf', icon: ScrollText, label: 'שמ"פ' },
  { to: '/assignments', icon: Target, label: 'שיבוץ' },
  { to: '/routine', icon: Calendar, label: 'שגרה' },
  { to: '/officer-tasks', icon: ClipboardList, label: 'משימות קצין' },
  { to: '/training', icon: BookOpen, label: 'הדרכה' },
  { to: '/donations', icon: Heart, label: 'תרומות' },
  { to: '/reports', icon: FileBarChart, label: 'דוחות' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
  { to: '/permissions', icon: Shield, label: 'הרשאות' },
];

function NavItemLink({ item }: { item: NavItem }) {
  const canAccess = useCanAccessPage(item.to);

  // Still loading or no access — hide
  if (canAccess === undefined || canAccess === false) return null;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors touch-target',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-card hover:text-foreground'
        )
      }
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {item.label}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold text-primary">ניהול פלוגה</h1>
        <p className="text-xs text-muted-foreground mt-1">מערכת ניהול מילואים</p>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}
      </nav>
    </div>
  );
}
