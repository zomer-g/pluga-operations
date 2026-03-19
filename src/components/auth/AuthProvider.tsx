import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface AuthUser {
  email: string;
  name: string;
  picture: string;
  sub: string; // Google user ID
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// List of allowed email addresses - add your team's emails here
// Leave empty to allow ALL Google accounts
const ALLOWED_EMAILS: string[] = [
  // 'commander@gmail.com',
  // 'officer@gmail.com',
];

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SESSION_KEY = 'pluga-auth-session';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
  exp: number;
}

function decodeJwt(token: string): GoogleUser {
  const base64 = token.split('.')[1]!;
  const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(json);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    // Reload to show sign-in screen
    window.location.reload();
  }, []);

  // Check existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { user: AuthUser; expiry: number };
        if (parsed.expiry > Date.now()) {
          setUser(parsed.user);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  // If no client ID configured, skip auth entirely
  if (!CLIENT_ID) {
    return (
      <AuthContext.Provider value={{ user: { email: 'local', name: 'משתמש מקומי', picture: '', sub: 'local' }, isLoading: false, signOut }}>
        {children}
      </AuthContext.Provider>
    );
  }

  if (isLoading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-background">
        <p className="text-muted-foreground">טוען...</p>
      </div>
    );
  }

  if (!user) {
    return <GoogleSignIn onSuccess={(authUser) => {
      setUser(authUser);
      // Store session for 7 days
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        user: authUser,
        expiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
      }));
    }} />;
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function GoogleSignIn({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const [error, setError] = useState('');

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = (window as unknown as Record<string, unknown>).google as {
        accounts: {
          id: {
            initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
            renderButton: (element: HTMLElement, config: { theme: string; size: string; text: string; locale: string; width: number }) => void;
          };
        };
      };

      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response: GoogleCredentialResponse) => {
          try {
            const decoded = decodeJwt(response.credential);

            // Check if email is allowed
            if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(decoded.email)) {
              setError(`הגישה נדחתה עבור ${decoded.email}. פנה למפקד הפלוגה.`);
              return;
            }

            onSuccess({
              email: decoded.email,
              name: decoded.name,
              picture: decoded.picture,
              sub: decoded.sub,
            });
          } catch {
            setError('שגיאה באימות. נסה שוב.');
          }
        },
      });

      const buttonEl = document.getElementById('google-signin-button');
      if (buttonEl) {
        google.accounts.id.renderButton(buttonEl, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          locale: 'he',
          width: 300,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [onSuccess]);

  return (
    <div className="h-dvh flex items-center justify-center bg-background" dir="rtl">
      <div className="text-center space-y-6 p-8 max-w-sm">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-primary">ניהול פלוגה</h1>
          <p className="text-muted-foreground">מערכת ניהול פלוגת מילואים</p>
        </div>

        <div className="p-6 rounded-lg border bg-card space-y-4">
          <p className="text-sm font-medium">התחבר כדי להמשיך</p>
          <div id="google-signin-button" className="flex justify-center" />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          הנתונים נשמרים באופן מקומי במכשיר שלך
        </p>
      </div>
    </div>
  );
}
