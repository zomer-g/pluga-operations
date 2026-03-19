import { useState, useMemo } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AssignmentTable } from '@/components/assignment/AssignmentTable';
import { GanttChart } from '@/components/gantt/GanttChart';
import type { GanttRow } from '@/components/gantt/GanttChart';
import { TankDiagram } from '@/components/tanks/TankDiagram';
import {
  useAssignments,
  useAssignmentConflicts,
  addAssignment,
} from '@/hooks/useAssignment';
import { useSoldiers } from '@/hooks/useSoldiers';
import { useTanks } from '@/hooks/useTanks';
import { ASSIGNMENT_COLORS, getCrewRoleLabel } from '@/lib/constants';
import { noonToday, noonTomorrow } from '@/lib/utils';
import type { CrewRole } from '@/db/schema';

export function AssignmentPage() {
  const assignments = useAssignments();
  const soldiers = useSoldiers();
  const tanks = useTanks();
  const conflicts = useAssignmentConflicts();
  // Date filter for tank view
  const [viewDateTime, setViewDateTime] = useState(noonToday());

  // Default Gantt date range: -7 days to +30 days
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 7);
  const defaultEnd = new Date(today);
  defaultEnd.setDate(defaultEnd.getDate() + 30);
  const defaultStartStr = defaultStart.toISOString().split('T')[0]!;
  const defaultEndStr = defaultEnd.toISOString().split('T')[0]!;

  // Assign dialog state
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean;
    tankId: string;
    role: CrewRole | 'fifth' | null;
  }>({ open: false, tankId: '', role: null });
  const [assignSoldierId, setAssignSoldierId] = useState('');
  const [assignWarnings, setAssignWarnings] = useState<string[]>([]);

  // Filter assignments active at viewDateTime for tank view
  const activeAssignments = useMemo(() => {
    if (!assignments) return [];
    const dt = new Date(viewDateTime).toISOString();
    return assignments.filter((a) => a.startDateTime <= dt && a.endDateTime >= dt);
  }, [assignments, viewDateTime]);

  // Build Gantt rows
  const ganttRows = useMemo<GanttRow[]>(() => {
    if (!assignments || !soldiers || !conflicts) return [];

    const soldierIds = [...new Set(assignments.map((a) => a.soldierId))];

    return soldierIds
      .map((soldierId) => {
        const soldier = soldiers.find((s) => s.id === soldierId);
        if (!soldier) return null;

        const soldierAssignments = assignments.filter((a) => a.soldierId === soldierId);

        const bars = soldierAssignments.map((a) => {
          const assignmentConflicts = conflicts.get(a.id);
          const color =
            a.type === 'tank_role'
              ? ASSIGNMENT_COLORS.tank_role
              : ASSIGNMENT_COLORS.general_mission;

          const label =
            a.type === 'tank_role'
              ? a.role
                ? getCrewRoleLabel(a.role)
                : 'איש צוות 5'
              : a.missionName ?? 'משימה';

          return {
            id: a.id,
            startDateTime: a.startDateTime,
            endDateTime: a.endDateTime,
            color,
            tooltip: `${label}: ${new Date(a.startDateTime).toLocaleDateString('he-IL')} - ${new Date(a.endDateTime).toLocaleDateString('he-IL')}`,
            isWarning: !!assignmentConflicts && assignmentConflicts.length > 0,
          };
        });

        return {
          id: soldierId,
          label: `${soldier.firstName} ${soldier.lastName[0]}'`,
          bars,
        };
      })
      .filter(Boolean) as GanttRow[];
  }, [assignments, soldiers, conflicts]);

  // Handle assign from TankDiagram
  const openAssignDialog = (tankId: string, role: CrewRole | 'fifth') => {
    setAssignDialog({ open: true, tankId, role });
    setAssignSoldierId('');
    setAssignWarnings([]);
  };

  const handleAssignFromDialog = async () => {
    if (!assignSoldierId || !assignDialog.tankId) return;

    const result = await addAssignment({
      soldierId: assignSoldierId,
      type: 'tank_role',
      tankId: assignDialog.tankId,
      role: assignDialog.role === 'fifth' ? undefined : (assignDialog.role as CrewRole),
      startDateTime: noonToday(),
      endDateTime: noonTomorrow(),
    });

    if (result.warnings.length > 0) {
      setAssignWarnings(result.warnings);
      setTimeout(() => {
        setAssignDialog({ open: false, tankId: '', role: null });
        setAssignWarnings([]);
      }, 3000);
    } else {
      setAssignDialog({ open: false, tankId: '', role: null });
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    const { deleteAssignment } = await import('@/hooks/useAssignment');
    await deleteAssignment(assignmentId);
  };

  const isLoaded = assignments && soldiers && tanks && conflicts;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">שיבוץ חיילים</h2>

      <Tabs defaultValue="table" dir="rtl">
        <TabsList>
          <TabsTrigger value="table">טבלה</TabsTrigger>
          <TabsTrigger value="gantt">גאנט</TabsTrigger>
          <TabsTrigger value="tanks">טנקים</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          {isLoaded ? (
            <AssignmentTable
              assignments={assignments}
              soldiers={soldiers}
              tanks={tanks}
              conflicts={conflicts}
            />
          ) : (
            <LoadingPlaceholder />
          )}
        </TabsContent>

        <TabsContent value="gantt">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded-full ${ASSIGNMENT_COLORS.tank_role}`} />
              <span className="text-xs">שיבוץ לטנק</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded-full ${ASSIGNMENT_COLORS.general_mission}`} />
              <span className="text-xs">משימה כללית</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full border-2 border-dashed border-red-500" />
              <span className="text-xs">התנגשות שמ"פ</span>
            </div>
          </div>

          <GanttChart
            rows={ganttRows}
            startDate={defaultStartStr}
            endDate={defaultEndStr}
            showTodayMarker
          />
        </TabsContent>

        <TabsContent value="tanks">
          {isLoaded ? (
            <div className="space-y-4">
              {/* Date/time selector */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">הצג צוותים בתאריך:</Label>
                  <Input
                    type="datetime-local"
                    value={viewDateTime}
                    onChange={(e) => setViewDateTime(e.target.value)}
                    className="w-52 h-9 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openAssignDialog(tanks[0]?.id ?? '', 'commander')
                  }
                  disabled={!tanks?.length}
                >
                  <Plus className="h-4 w-4 ml-1" />
                  שבץ חייל
                </Button>
              </div>

              {/* Tank cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tanks.map((tank) => {
                  const tankAssignments = activeAssignments.filter(
                    (a) => a.tankId === tank.id
                  );
                  return (
                    <Card key={tank.id}>
                      <CardContent className="p-2">
                        <TankDiagram
                          tankId={tank.id}
                          designation={tank.designation}
                          assignments={tankAssignments}
                          soldiers={soldiers}
                          onAssignSlot={(role) => openAssignDialog(tank.id, role)}
                          onUnassign={handleUnassign}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {tanks.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>אין טנקים להצגה</p>
                  <p className="text-xs mt-1">הוסף טנקים בדף הטנקים</p>
                </div>
              )}
            </div>
          ) : (
            <LoadingPlaceholder />
          )}
        </TabsContent>
      </Tabs>

      {/* Assign soldier dialog */}
      <Dialog
        open={assignDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setAssignDialog({ open: false, tankId: '', role: null });
            setAssignWarnings([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שיבוץ חייל</DialogTitle>
            <DialogDescription>
              {assignDialog.role && assignDialog.role !== 'fifth'
                ? `תפקיד: ${getCrewRoleLabel(assignDialog.role as CrewRole)}`
                : 'איש צוות 5'}
              {' | '}
              טנק:{' '}
              {tanks?.find((t) => t.id === assignDialog.tankId)?.designation ?? '---'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-sm">בחר חייל</Label>
              <select
                value={assignSoldierId}
                onChange={(e) => setAssignSoldierId(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">בחר...</option>
                {soldiers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                    {s.trainedRole ? ` (${getCrewRoleLabel(s.trainedRole)})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {assignWarnings.length > 0 && (
              <div className="text-sm text-amber-500 space-y-0.5 bg-amber-500/10 p-2 rounded">
                {assignWarnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialog({ open: false, tankId: '', role: null })}
            >
              ביטול
            </Button>
            <Button onClick={handleAssignFromDialog} disabled={!assignSoldierId}>
              שבץ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingPlaceholder() {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-40" />
      <p>טוען נתונים...</p>
    </div>
  );
}
