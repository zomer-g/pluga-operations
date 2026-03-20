import { useEffect, useMemo } from 'react';
import { Moon, Sun, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/useAppStore';
import { useAuth } from '@/components/auth/AuthProvider';
import { useActivations } from '@/hooks/useActivation';
import { formatDate } from '@/lib/utils';

export function Header() {
  const { theme, toggleTheme } = useAppStore();
  const selectedActivationId = useAppStore(s => s.selectedActivationId);
  const setSelectedActivationId = useAppStore(s => s.setSelectedActivationId);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const activations = useActivations();

  // Sort activations by endDate descending (latest first)
  const sortedActivations = useMemo(() => {
    if (!activations) return [];
    return [...activations].sort((a, b) => b.endDate.localeCompare(a.endDate));
  }, [activations]);

  // Auto-select latest activation when none selected
  useEffect(() => {
    if (sortedActivations.length > 0 && !selectedActivationId) {
      setSelectedActivationId(sortedActivations[0]!.id);
    }
  }, [sortedActivations, selectedActivationId, setSelectedActivationId]);

  return (
    <header className="flex items-center justify-between border-b bg-card px-4 py-3 gap-2">
      {/* Left side: mobile title */}
      <div className="md:hidden">
        <h1 className="text-lg font-bold text-primary">ניהול פלוגה</h1>
      </div>

      {/* Left side: user info (desktop) */}
      <div className="hidden md:flex items-center gap-3">
        {user && user.email !== 'local' && (
          <div className="flex items-center gap-2">
            {user.picture && (
              <img src={user.picture} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
            )}
            <span className="text-sm text-muted-foreground">{user.name}</span>
          </div>
        )}
      </div>

      {/* Center: Activation dropdown */}
      {sortedActivations.length > 0 && (
        <div className="flex items-center gap-2 flex-1 justify-center max-w-xs">
          <select
            value={selectedActivationId ?? ''}
            onChange={(e) => setSelectedActivationId(e.target.value || null)}
            className="h-8 rounded-md border bg-card text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring min-w-0 w-full max-w-[240px] text-foreground"
          >
            {sortedActivations.map((act) => (
              <option key={act.id} value={act.id}>
                {act.name} ({formatDate(act.startDate)} - {formatDate(act.endDate)})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Right side: actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
          aria-label="הגדרות"
          className="md:hidden"
        >
          <Settings className="h-5 w-5" />
        </Button>
        {user && user.email !== 'local' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            aria-label="התנתק"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        )}
      </div>
    </header>
  );
}
