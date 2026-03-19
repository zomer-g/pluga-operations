import { Moon, Sun, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/useAppStore';
import { useAuth } from '@/components/auth/AuthProvider';

export function Header() {
  const { theme, toggleTheme } = useAppStore();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between border-b bg-card px-4 py-3">
      <div className="md:hidden">
        <h1 className="text-lg font-bold text-primary">ניהול פלוגה</h1>
      </div>
      <div className="hidden md:flex items-center gap-2">
        {user && user.email !== 'local' && (
          <div className="flex items-center gap-2">
            {user.picture && (
              <img src={user.picture} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
            )}
            <span className="text-sm text-muted-foreground">{user.name}</span>
          </div>
        )}
      </div>
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
