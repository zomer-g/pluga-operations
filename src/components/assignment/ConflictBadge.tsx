import { CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConflictType } from '@/hooks/useAssignment';

interface ConflictBadgeProps {
  conflicts?: ConflictType[];
  className?: string;
}

const CONFLICT_INFO: Record<ConflictType, { color: string; tooltip: string }> = {
  no_shampaf: {
    color: 'text-red-500',
    tooltip: 'לחייל אין שמ"פ פעיל',
  },
  on_vacation: {
    color: 'text-amber-500',
    tooltip: 'החייל בחופשה',
  },
};

export function ConflictBadge({ conflicts, className }: ConflictBadgeProps) {
  if (!conflicts || conflicts.length === 0) {
    return (
      <span className={cn('inline-flex items-center', className)} title="תקין">
        <CheckCircle className="h-4 w-4 text-emerald-500" />
      </span>
    );
  }

  // Show the highest severity conflict (no_shampaf > on_vacation)
  const primary = conflicts.includes('no_shampaf') ? 'no_shampaf' : conflicts[0]!;
  const info = CONFLICT_INFO[primary];

  return (
    <span className={cn('inline-flex items-center', className)} title={info.tooltip}>
      <AlertTriangle className={cn('h-4 w-4', info.color)} />
    </span>
  );
}
