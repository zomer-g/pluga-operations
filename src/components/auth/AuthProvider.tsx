import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, ApiError, UNAUTHORIZED_EVENT } from '@/lib/api';
import { startLiveUpdates, stopLiveUpdates, clearDataCache } from '@/lib/datastore';
import { setCurrentUserId } from '@/lib/check-permission';

interface AuthUser {
  email: string;
  name: string;
  picture: string;
  /** The user's id in the app (users.id) — also the key of their userPermissions row. */
  sub: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// Remembered so the PWA can open in read-only mode without a connection.
const USER_CACHE_KEY = 'pluga:user';

function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // ignore
  }
}

interface MeResponse {
  user: { id: string; email: string; name: string; picture: string };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback((next: AuthUser | null) => {
    setCurrentUserId(next?.sub ?? null);
    writeCachedUser(next);
    setUser(next);
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const { user: me } = await api<MeResponse>('/api/me');
      const cached = readCachedUser();
      // A different account on this device must never see the previous account's cached data.
      if (cached && cached.sub !== me.id) clearDataCache();
      applyUser({ email: me.email, name: me.name, picture: me.picture, sub: me.id });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearDataCache();
        applyUser(null);
      } else {
        // Offline or server unavailable (e.g. mid-deploy): fall back to the
        // last signed-in user and cached data, read-only.
        applyUser(readCachedUser());
      }
    } finally {
      setLoading(false);
    }
  }, [applyUser]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!user) return;
    startLiveUpdates();
    return () => stopLiveUpdates();
  }, [user]);

  // Session expired or revoked while the app was open.
  useEffect(() => {
    const onUnauthorized = () => {
      clearDataCache();
      applyUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [applyUser]);

  const signIn = async () => {
    window.location.href = '/auth/google/start';
  };

  const signOut = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Still clear local state below.
    }
    stopLiveUpdates();
    clearDataCache();
    applyUser(null);
  };

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-dvh flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center space-y-6 p-8">
          <h1 className="text-3xl font-bold text-primary">ניהול פלוגה</h1>
          <p className="text-muted-foreground">מערכת ניהול מילואים</p>
          <button
            onClick={signIn}
            className="inline-flex items-center gap-3 rounded-lg bg-card border px-6 py-3 text-sm font-medium hover:bg-muted transition-colors touch-target"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            התחבר עם Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
