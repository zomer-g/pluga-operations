import { useState, useRef } from 'react';
import { Check, RefreshCw, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTimeShort } from '@/lib/utils';
import { getCrewRoleLabel } from '@/lib/constants';
import type { Assignment, Soldier, Tank, CrewRole } from '@/db/schema';

interface TaskCardProps {
  assignment: Assignment;
  soldier: Soldier | undefined;
  tank: Tank | undefined;
  onComplete: (id: string) => void;
  onReassign: (assignment: Assignment) => void;
}

export function TaskCard({ assignment, soldier, tank, onComplete, onReassign }: TaskCardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const isDragging = useRef(false);

  const soldierName = soldier
    ? `${soldier.firstName} ${soldier.lastName}`
    : 'חייל לא ידוע';

  const vehicleName = tank?.designation ?? assignment.missionName ?? '-';
  const roleName = assignment.role ? getCrewRoleLabel(assignment.role as CrewRole) : '';

  const now = new Date();
  const start = new Date(assignment.startDateTime);
  const hoursUntil = Math.round((start.getTime() - now.getTime()) / (1000 * 60 * 60));

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startX.current = touch.clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const diff = touch.clientX - startX.current;
    // Limit swipe distance
    setSwipeX(Math.max(-120, Math.min(120, diff)));
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (swipeX > 80) {
      onComplete(assignment.id);
    } else if (swipeX < -80) {
      onReassign(assignment);
    }
    setSwipeX(0);
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Swipe backgrounds */}
      <div className="absolute inset-0 flex items-center justify-between px-6">
        <div className="flex items-center gap-2 text-green-400">
          <Check className="h-6 w-6" />
          <span className="text-sm font-medium">סיים</span>
        </div>
        <div className="flex items-center gap-2 text-blue-400">
          <span className="text-sm font-medium">שבץ מחדש</span>
          <RefreshCw className="h-6 w-6" />
        </div>
      </div>

      <Card
        className="relative bg-card border transition-transform touch-none"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="p-4 space-y-3">
          {/* Top row: soldier name + time badge */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold text-foreground">{soldierName}</h3>
            <Badge variant="outline" className="shrink-0 gap-1">
              <Clock className="h-3 w-3" />
              {hoursUntil > 0 ? `בעוד ${hoursUntil} שעות` : 'עכשיו'}
            </Badge>
          </div>

          {/* Middle: vehicle + role */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-foreground font-medium">{vehicleName}</span>
            {roleName && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{roleName}</span>
              </>
            )}
          </div>

          {/* Bottom: time range */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDateTimeShort(assignment.startDateTime)}</span>
            <span>←</span>
            <span>{formatDateTimeShort(assignment.endDateTime)}</span>
          </div>

          {/* Action buttons (for non-touch) */}
          <div className="flex items-center gap-2 pt-1 md:hidden-none">
            <button
              onClick={() => onComplete(assignment.id)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-green-900/30 text-green-300 border border-green-700/50 text-sm font-medium touch-target active:bg-green-900/50 transition-colors"
            >
              <Check className="h-4 w-4" />
              סיום משימה
            </button>
            <button
              onClick={() => onReassign(assignment)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-900/30 text-blue-300 border border-blue-700/50 text-sm font-medium touch-target active:bg-blue-900/50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              שבץ מחדש
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
