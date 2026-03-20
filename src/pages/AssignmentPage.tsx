import { useState, useMemo } from 'react';
import { CalendarClock, Plus, Truck } from 'lucide-react';
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
import { useTanks, addTank } from '@/hooks/useTanks';
import { useActivations } from '@/hooks/useActivation';
import { useAppStore } from '@/stores/useAppStore';
import { ASSIGNMENT_COLORS, getCrewRoleLabel, VEHICLE_CATEGORIES } from '@/lib/constants';
import { noonToday, noonTomorrow, dateRangesOverlap } from '@/lib/utils';
import type { CrewRole, VehicleCategory } from '@/db/schema';

export function AssignmentPage() {
  const allAssignments = useAssignments();
  const soldiers = useSoldiers();
  const tanks = useTanks();
  const conflicts = useAssignmentConflicts();
  const activations = useActivations();

  // Global activation from store
  const selectedActivationId = useAppStore(s => s.selectedActivationId);
  const activeActivation = activations?.find(a => a.id === selectedActivationId) ?? null;

  // Filter assignments by activation date range
  const assignments = useMemo(() => {
    if (!allAssignments) return undefined;
    if (!activeActivation) return allAssignments;
    return allAssignments.filter(a =>
      dateRangesOverlap(
        a.startDateTime.split('T')[0]!,
        a.endDateTime.split('T')[0]!,
        activeActivation.startDate,
        activeActivation.endDate
      )
    );
  }, [allAssignments, activeActivation]);

  // Date filter for tank view
  const [viewDateTime, setViewDateTime] = useState(noonToday());

  // Default Gantt date range from activation or default +-30 days
  const today = new Date();
  const ganttStart = activeActivation?.startDate ?? (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0]!;
  })();
  const ganttEnd = activeActivation?.endDate ?? (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0]!;
  })();

  // Assign dialog state
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean;
    tankId: string;
    role: CrewRole | 'fifth' | null;
  }>({ open: false, tankId: '', role: null });
  const [assignSoldierId, setAssignSoldierId] = useState('');
  const [assignWarnings, setAssignWarnings] = useState<string[]>([]);

  // Vehicle creation dialog
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('standard');

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

  const handleCreateVehicle = async () => {
    if (!vehicleName) return;
    await addTank({
      designation: vehicleName,
      type: vehicleCategory === 'tank' ? 'מרכבה סימן 4' : 'רכב רגיל',
      vehicleCategory,
      status: 'operational',
    });
    setShowVehicleDialog(false);
    setVehicleName('');
    setVehicleCategory('standard');
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
            startDate={ganttStart}
            endDate={ganttEnd}
            showTodayMarker
          />
        </TabsContent>

        <TabsContent value="tanks">
          {isLoaded ? (
            <div className="space-y-4">
              {/* Controls */}
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
                  onClick={() => setShowVehicleDialog(true)}
                >
                  <Truck className="h-4 w-4 ml-1" />
                  צור רכב חדש
                </Button>
              </div>

              {/* Vehicle cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tanks.map((tank) => {
                  const tankAssignments = activeAssignments.filter(
                    (a) => a.tankId === tank.id
                  );
                  const isStandard = tank.vehicleCategory === 'standard';

                  if (isStandard) {
                    // Standard vehicle: simple member list
                    return (
                      <Card key={tank.id}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">{tank.designation}</span>
                            <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">רכב רגיל</span>
                          </div>
                          <div className="space-y-1">
                            {tankAssignments.length === 0 && (
                              <p className="text-xs text-muted-foreground text-center py-2">אין חיילים משובצים</p>
                            )}
                            {tankAssignments.map((a) => {
                              const s = soldiers.find(s => s.id === a.soldierId);
                              return (
                                <div key={a.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                                  <span>{s ? `${s.firstName} ${s.lastName}` : '---'}</span>
                                  <button
                                    onClick={() => handleUnassign(a.id)}
                                    className="text-destructive hover:text-destructive/80 text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs h-8"
                            onClick={() => openAssignDialog(tank.id, 'fifth')}
                          >
                            <Plus className="h-3 w-3 me-1" />
                            הוסף חייל
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  }

                  // Tank: standard 4-slot diagram
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
                  <p>אין רכבים להצגה</p>
                  <p className="text-xs mt-1">לחץ "צור רכב חדש" להתחלה</p>
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
                : 'איש צוות'}
              {' | '}
              רכב:{' '}
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

      {/* Create vehicle dialog */}
      <Dialog open={showVehicleDialog} onOpenChange={setShowVehicleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>צור רכב חדש</DialogTitle>
            <DialogDescription>הוסף רכב חדש למערכת השיבוצים</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">שם / מספר רכב</Label>
              <Input
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                placeholder='לדוגמה: "413 - נ4" או "רכב פיקוד"'
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">סוג רכב</Label>
              <select
                value={vehicleCategory}
                onChange={(e) => setVehicleCategory(e.target.value as VehicleCategory)}
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {VEHICLE_CATEGORIES.map((vc) => (
                  <option key={vc.value} value={vc.value}>
                    {vc.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {vehicleCategory === 'tank'
                  ? 'טנק — 4 תפקידים קבועים (מפקד, תותחן, נהג, טען)'
                  : 'רכב רגיל — ללא הגבלת תפקידים או מספר אנשים'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVehicleDialog(false)}>ביטול</Button>
            <Button onClick={handleCreateVehicle} disabled={!vehicleName}>
              <Plus className="h-4 w-4 me-1" />
              צור רכב
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
