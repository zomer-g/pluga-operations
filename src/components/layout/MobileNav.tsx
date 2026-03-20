import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  Users,
  ScrollText,
  Target,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  Package,
  Calendar,
  ClipboardList,
  BookOpen,
  Heart,
  FileBarChart,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import { useCanAccessPage } from '@/features/permissions/usePermissions';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

// Primary bottom bar items (always visible)
const primaryItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'בקרה' },
  { to: '/soldiers', icon: Users, label: 'חיילים' },
  { to: '/shampaf', icon: ScrollText, label: 'שמ"פ' },
  { to: '/assignments', icon: Target, label: 'שיבוץ' },
];

// Secondary items shown in "more" menu
const secondaryItems: NavItem[] = [
  { to: '/equipment', icon: Package, label: 'ציוד' },
  { to: '/routine', icon: Calendar, label: 'שגרה' },
  { to: '/officer-tasks', icon: ClipboardList, label: 'משימות קצין' },
  { to: '/training', icon: BookOpen, label: 'הדרכה' },
  { to: '/donations', icon: Heart, label: 'תרומות' },
  { to: '/reports', icon: FileBarChart, label: 'דוחות' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
  { to: '/permissions', icon: Shield, label: 'הרשאות' },
];

function MobileNavItem({ item }: { item: NavItem }) {
  const canAccess = useCanAccessPage(item.to);
  if (canAccess === undefined || canAccess === false) return null;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 px-3 py-1 rounded-md text-xs transition-colors touch-target',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )
      }
    >
      <item.icon className="h-5 w-5" />
      <span>{item.label}</span>
    </NavLink>
  );
}

function MoreMenuItem({ item, onClick }: { item: NavItem; onClick: () => void }) {
  const canAccess = useCanAccessPage(item.to);
  if (canAccess === undefined || canAccess === false) return null;

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors touch-target',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-foreground hover:bg-card'
        )
      }
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {item.label}
    </NavLink>
  );
}

export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* "More" slide-up menu */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-0 inset-x-0 bg-background border-t rounded-t-xl max-h-[60vh] overflow-y-auto safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-medium text-foreground">עוד</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-md hover:bg-card touch-target"
                aria-label="סגור תפריט"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-2 space-y-1">
              {secondaryItems.map((item) => (
                <MoreMenuItem key={item.to} item={item} onClick={() => setMoreOpen(false)} />
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-around py-2">
        {primaryItems.map((item) => (
          <MobileNavItem key={item.to} item={item} />
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-1 px-3 py-1 rounded-md text-xs text-muted-foreground transition-colors touch-target"
        >
          <Menu className="h-5 w-5" />
          <span>עוד</span>
        </button>
      </div>
    </>
  );
}
