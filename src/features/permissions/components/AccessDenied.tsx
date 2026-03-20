import { ShieldOff } from 'lucide-react';

export function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center" dir="rtl">
      <ShieldOff className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-bold text-foreground mb-2">אין הרשאה</h2>
      <p className="text-muted-foreground max-w-sm">
        אין לך הרשאה לצפות בדף זה. פנה למנהל המערכת לקבלת גישה.
      </p>
    </div>
  );
}
