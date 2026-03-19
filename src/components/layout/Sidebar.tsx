import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  Users,
  Package,
  ShieldCheck,
  CalendarClock,
  FileBarChart,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'לוח בקרה' },
  { to: '/soldiers', icon: Users, label: 'חיילים' },
  { to: '/equipment', icon: Package, label: 'ציוד' },
  { to: '/tanks', icon: ShieldCheck, label: 'טנקים' },
  { to: '/status-board', icon: CalendarClock, label: 'לוח סטטוסים' },
  { to: '/reports', icon: FileBarChart, label: 'דוחות' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
];

export function Sidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold text-primary">ניהול פלוגה</h1>
        <p className="text-xs text-muted-foreground mt-1">מערכת ניהול מילואים</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
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
        ))}
      </nav>
    </div>
  );
}
