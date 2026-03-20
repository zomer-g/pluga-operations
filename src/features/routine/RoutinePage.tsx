import { Calendar } from 'lucide-react';

export function RoutinePage() {
  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">שגרה</h1>
      </div>
      <p className="text-muted-foreground">בקרוב...</p>
    </div>
  );
}
