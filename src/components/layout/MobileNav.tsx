import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  Users,
  Package,
  ScrollText,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'בקרה' },
  { to: '/soldiers', icon: Users, label: 'חיילים' },
  { to: '/equipment', icon: Package, label: 'ציוד' },
  { to: '/shampaf', icon: ScrollText, label: 'שמ"פ' },
  { to: '/assignments', icon: Target, label: 'שיבוץ' },
];

export function MobileNav() {
  return (
    <div className="flex items-center justify-around py-2">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 px-3 py-1 rounded-md text-xs transition-colors touch-target',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground'
            )
          }
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}
