import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-amber-600 text-white text-center py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2">
      <WifiOff className="h-3.5 w-3.5" />
      אין חיבור לאינטרנט — מצב צפייה בלבד
    </div>
  );
}
