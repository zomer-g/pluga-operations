import { X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCrewRoleLabel } from '@/lib/constants';
import type { Assignment, Soldier, CrewRole } from '@/db/schema';

interface TankDiagramProps {
  tankId: string;
  designation: string;
  assignments: Assignment[];
  soldiers: Soldier[];
  onAssignSlot?: (role: CrewRole | 'fifth') => void;
  onUnassign?: (assignmentId: string) => void;
  onDesignationClick?: () => void;
}

const GRID_POSITIONS: { role: CrewRole; row: number; col: number }[] = [
  { role: 'driver', row: 0, col: 0 },
  { role: 'gunner', row: 0, col: 1 },
  { role: 'loader', row: 1, col: 0 },
  { role: 'commander', row: 1, col: 1 },
];

function getSoldierName(soldierId: string, soldiers: Soldier[]): string {
  const s = soldiers.find((s) => s.id === soldierId);
  return s ? `${s.firstName} ${s.lastName[0]}'` : '---';
}

export function TankDiagram({
  tankId,
  designation,
  assignments,
  soldiers,
  onAssignSlot,
  onUnassign,
  onDesignationClick,
}: TankDiagramProps) {
  const getAssignmentForRole = (role: CrewRole) =>
    assignments.find((a) => a.role === role && a.tankId === tankId);

  // 5th crew member: assignment with tankId set but no role
  const fifthMember = assignments.find(
    (a) => a.tankId === tankId && !a.role && a.type === 'tank_role'
  );

  return (
    <div dir="ltr" className="flex flex-col items-center gap-1 p-3">
      {/* Tank designation */}
      <div
        className={cn('text-sm font-bold mb-1', onDesignationClick && 'cursor-pointer hover:text-primary')}
        onClick={onDesignationClick}
      >
        {designation}
        {onDesignationClick && <span className="text-[10px] opacity-40 ml-1">✎</span>}
      </div>

      {/* Front label */}
      <div className="text-[10px] text-muted-foreground tracking-wider">
        חזית
      </div>

      {/* 2x2 grid */}
      <div className="grid grid-cols-2 gap-1.5 w-full max-w-[200px]">
        {GRID_POSITIONS.map(({ role, row, col }) => {
          const assignment = getAssignmentForRole(role);
          const filled = !!assignment;
          return (
            <div
              key={role}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-md p-2 min-h-[56px] text-center transition-colors',
                filled
                  ? 'bg-primary/5 border border-primary/30'
                  : 'border border-dashed border-muted-foreground/40'
              )}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
            >
              <span className="text-[10px] text-muted-foreground mb-0.5">
                {getCrewRoleLabel(role)}
              </span>
              {filled ? (
                <>
                  <span className="text-xs font-medium truncate max-w-full">
                    {getSoldierName(assignment.soldierId, soldiers)}
                  </span>
                  {onUnassign && (
                    <button
                      onClick={() => onUnassign(assignment.id)}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full hover:bg-destructive/20 transition-colors"
                      title="הסר שיבוץ"
                    >
                      <X className="h-3 w-3 text-destructive" />
                    </button>
                  )}
                </>
              ) : (
                onAssignSlot && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-1.5"
                    onClick={() => onAssignSlot(role)}
                  >
                    <UserPlus className="h-3 w-3 ml-1" />
                    שבץ
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Rear label */}
      <div className="text-[10px] text-muted-foreground tracking-wider">
        אחור
      </div>

      {/* 5th crew member slot */}
      <div
        className={cn(
          'w-full max-w-[200px] flex items-center justify-center rounded-md p-2 min-h-[44px] text-center transition-colors mt-1',
          fifthMember
            ? 'bg-primary/5 border border-primary/30'
            : 'border border-dashed border-muted-foreground/40'
        )}
      >
        <span className="text-[10px] text-muted-foreground ml-1">
          איש צוות 5:
        </span>
        {fifthMember ? (
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium">
              {getSoldierName(fifthMember.soldierId, soldiers)}
            </span>
            {onUnassign && (
              <button
                onClick={() => onUnassign(fifthMember.id)}
                className="p-0.5 rounded-full hover:bg-destructive/20 transition-colors"
                title="הסר שיבוץ"
              >
                <X className="h-3 w-3 text-destructive" />
              </button>
            )}
          </div>
        ) : (
          onAssignSlot && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-1.5"
              onClick={() => onAssignSlot('fifth')}
            >
              <UserPlus className="h-3 w-3 ml-1" />
              שבץ
            </Button>
          )
        )}
      </div>
    </div>
  );
}
