import { useState, useMemo } from 'react';
import { CalendarClock, Plus, Truck, FolderPlus, Users, Car, FileText } from 'lucide-react';
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
import { useTanks, addTank, useDepartments, addDepartment, deleteDepartment, setTankDepartment } from '@/hooks/useTanks';
import { useActivations } from '@/hooks/useActivation';
import { useAppStore } from '@/stores/useAppStore';
import { ASSIGNMENT_COLORS, getCrewRoleLabel, VEHICLE_CATEGORIES, ROLE_DISPLAY_ORDER } from '@/lib/constants';
import { noonToday, noonTomorrow, dateRangesOverlap } from '@/lib/utils';
import type { CrewRole, VehicleCategory } from '@/db/schema';
import { ReportSection } from '@/components/reports/ReportSection';
import { generateAssignmentDailyReport, generateAssignmentChangesReport } from '@/lib/report-generators';

type GroupBy = 'vehicle' | 'soldier';

export function AssignmentPage() {
  const allAssignments = useAssignments();
  const soldiers = useSoldiers();
  const tanks = useTanks();
  const conflicts = useAssignmentConflicts();
  const activations = useActivations();
  const departments = useDepartments();

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

  // Grouping state
  const [groupBy, setGroupBy] = useState<GroupBy>('vehicle');

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
  const [vehicleDepartmentId, setVehicleDepartmentId] = useState('');

  // Department dialog
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [deptName, setDeptName] = useState('');

  // Filter assignments active at viewDateTime for tank view
  const activeAssignments = useMemo(() => {
    if (!assignments) return [];
    const dt = new Date(viewDateTime).toISOString();
    return assignments.filter((a) => a.startDateTime <= dt && a.endDateTime >= dt);
  }, [assignments, viewDateTime]);

  // Build Gantt rows — grouped by vehicle or soldier
  const ganttRows = useMemo<GanttRow[]>(() => {
    if (!assignments || !soldiers || !tanks || !conflicts) return [];

    if (groupBy === 'soldier') {
      const soldierIds = [...new Set(assignments.map((a) => a.soldierId))];
      return soldierIds
        .map((soldierId) => {
          const soldier = soldiers.find((s) => s.id === soldierId);
          if (!soldier) return null;
          const soldierAssignments = assignments.filter((a) => a.soldierId === soldierId);
          const bars = soldierAssignments.map((a) => {
            const assignmentConflicts = conflicts.get(a.id);
            const color = a.type === 'tank_role' ? ASSIGNMENT_COLORS.tank_role : ASSIGNMENT_COLORS.general_mission;
            const roleLabel = a.type === 'tank_role'
              ? a.role ? getCrewRoleLabel(a.role) : 'איש צוות 5'
              : a.missionName ?? 'משימה';
            // Include vehicle name in tooltip
            const vehicleName = a.tankId ? (tanks.find(t => t.id === a.tankId)?.designation ?? '') : '';
            const tooltipParts = [roleLabel];
            if (vehicleName) tooltipParts.push(vehicleName);
            tooltipParts.push(`${new Date(a.startDateTime).toLocaleDateString('he-IL')} - ${new Date(a.endDateTime).toLocaleDateString('he-IL')}`);
            return {
              id: a.id,
              startDateTime: a.startDateTime,
              endDateTime: a.endDateTime,
              color,
              tooltip: tooltipParts.join(' | '),
              isWarning: !!assignmentConflicts && assignmentConflicts.length > 0,
            };
          });
          return { id: soldierId, label: `${soldier.firstName} ${soldier.lastName[0]}'`, bars };
        })
        .filter(Boolean) as GanttRow[];
    }

    // Group by vehicle (under departments)
    const rows: GanttRow[] = [];
    const deptList = departments ?? [];
    const deptMap = new Map(deptList.map(d => [d.id, d.name]));

    // Group tanks by department
    const tanksByDept = new Map<string, typeof tanks>();
    for (const tank of tanks) {
      const key = tank.departmentId || '__none__';
      if (!tanksByDept.has(key)) tanksByDept.set(key, []);
      tanksByDept.get(key)!.push(tank);
    }

    // Build sections: departments first (in order), then uncategorized
    const orderedKeys: string[] = [];
    for (const dept of deptList) {
      if (tanksByDept.has(dept.id)) orderedKeys.push(dept.id);
    }
    if (tanksByDept.has('__none__')) orderedKeys.push('__none__');

    for (const key of orderedKeys) {
      const deptTanks = tanksByDept.get(key) ?? [];
      // Add department header row
      if (key !== '__none__' && deptMap.has(key)) {
        rows.push({ id: `dept_${key}`, label: `📁 ${deptMap.get(key)!}`, bars: [], isGroupHeader: true });
      } else if (key === '__none__' && orderedKeys.length > 1) {
        rows.push({ id: 'dept_none', label: '📁 ללא מחלקה', bars: [], isGroupHeader: true });
      }

      for (const tank of deptTanks) {
        const tankAssignments = assignments.filter(a => a.tankId === tank.id);
        if (tankAssignments.length === 0) continue;

        // Add vehicle header row
        rows.push({ id: `vehicle_${tank.id}`, label: tank.designation, bars: [], isVehicleHeader: true });

        // Group assignments by role in display order
        const roleAssignments = new Map<string, typeof assignments>();
        for (const a of tankAssignments) {
          if (a.type === 'general_mission') continue;
          const roleKey = a.role ?? 'fifth';
          if (!roleAssignments.has(roleKey)) roleAssignments.set(roleKey, []);
          roleAssignments.get(roleKey)!.push(a);
        }

        // Sort roles in display order
        const roleOrder = [...ROLE_DISPLAY_ORDER, 'fifth' as const];
        for (const role of roleOrder) {
          const roleAs = roleAssignments.get(role);
          if (!roleAs || roleAs.length === 0) continue;
          const roleLabel = role === 'fifth' ? 'איש צוות 5' : getCrewRoleLabel(role as CrewRole);
          const bars = roleAs.map(a => {
            const assignmentConflicts = conflicts.get(a.id);
            const soldier = soldiers.find(s => s.id === a.soldierId);
            const soldierName = soldier ? `${soldier.firstName} ${soldier.lastName[0]}'` : '';
            return {
              id: a.id,
              startDateTime: a.startDateTime,
              endDateTime: a.endDateTime,
              color: ASSIGNMENT_COLORS.tank_role,
              tooltip: `${soldierName} - ${roleLabel}: ${new Date(a.startDateTime).toLocaleDateString('he-IL')} - ${new Date(a.endDateTime).toLocaleDateString('he-IL')}`,
              isWarning: !!assignmentConflicts && assignmentConflicts.length > 0,
            };
          });
          rows.push({
            id: `${tank.id}_${role}`,
            label: '',
            sublabel: roleLabel,
            bars,
          });
        }

        // General missions assigned to this tank
        const generalMissions = tankAssignments.filter(a => a.type === 'general_mission');
        if (generalMissions.length > 0) {
          const bars = generalMissions.map(a => {
            const assignmentConflicts = conflicts.get(a.id);
            return {
              id: a.id,
              startDateTime: a.startDateTime,
              endDateTime: a.endDateTime,
              color: ASSIGNMENT_COLORS.general_mission,
              tooltip: `${a.missionName ?? 'משימה'}: ${new Date(a.startDateTime).toLocaleDateString('he-IL')} - ${new Date(a.endDateTime).toLocaleDateString('he-IL')}`,
              isWarning: !!assignmentConflicts && assignmentConflicts.length > 0,
            };
          });
          rows.push({ id: `${tank.id}_missions`, label: '', sublabel: 'משימות', bars });
        }
      }
    }

    // Assignments without a tank (general missions)
    const noTankAssignments = assignments.filter(a => !a.tankId);
    if (noTankAssignments.length > 0) {
      // Group by soldier
      const soldierIds = [...new Set(noTankAssignments.map(a => a.soldierId))];
      if (soldierIds.length > 0) {
        rows.push({ id: 'general_header', label: '📁 משימות כלליות', bars: [], isGroupHeader: true });
        for (const sid of soldierIds) {
          const soldier = soldiers.find(s => s.id === sid);
          if (!soldier) continue;
          const soldierAs = noTankAssignments.filter(a => a.soldierId === sid);
          const bars = soldierAs.map(a => {
            const assignmentConflicts = conflicts.get(a.id);
            return {
              id: a.id,
              startDateTime: a.startDateTime,
              endDateTime: a.endDateTime,
              color: ASSIGNMENT_COLORS.general_mission,
              tooltip: `${a.missionName ?? 'משימה'}: ${new Date(a.startDateTime).toLocaleDateString('he-IL')} - ${new Date(a.endDateTime).toLocaleDateString('he-IL')}`,
              isWarning: !!assignmentConflicts && assignmentConflicts.length > 0,
            };
          });
          rows.push({ id: `general_${sid}`, label: `${soldier.firstName} ${soldier.lastName[0]}'`, bars });
        }
      }
    }

    return rows;
  }, [assignments, soldiers, tanks, conflicts, departments, groupBy]);

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
      departmentId: vehicleDepartmentId || undefined,
      status: 'operational',
    });
    setShowVehicleDialog(false);
    setVehicleName('');
    setVehicleCategory('standard');
    setVehicleDepartmentId('');
  };

  const handleCreateDepartment = async () => {
    if (!deptName) return;
    await addDepartment(deptName, (departments?.length ?? 0) + 1);
    setShowDeptDialog(false);
    setDeptName('');
  };

  const isLoaded = assignments && soldiers && tanks && conflicts;

  // Sort tanks by department then by designation, with role order enforcement
  const sortedTanks = useMemo(() => {
    if (!tanks) return [];
    const deptOrder = new Map((departments ?? []).map((d, i) => [d.id, i]));
    return [...tanks].sort((a, b) => {
      const deptA = a.departmentId ? (deptOrder.get(a.departmentId) ?? 999) : 999;
      const deptB = b.departmentId ? (deptOrder.get(b.departmentId) ?? 999) : 999;
      if (deptA !== deptB) return deptA - deptB;
      return a.designation.localeCompare(b.designation, 'he');
    });
  }, [tanks, departments]);

  // Group sorted tanks by department for display
  const tanksByDepartment = useMemo(() => {
    const groups: { deptId: string; deptName: string; tanks: typeof sortedTanks }[] = [];
    const deptMap = new Map((departments ?? []).map(d => [d.id, d.name]));
    const seen = new Set<string>();

    for (const tank of sortedTanks) {
      const deptId = tank.departmentId || '__none__';
      if (!seen.has(deptId)) {
        seen.add(deptId);
        groups.push({
          deptId,
          deptName: deptId === '__none__' ? '' : (deptMap.get(deptId) ?? ''),
          tanks: [],
        });
      }
      groups.find(g => g.deptId === deptId)!.tanks.push(tank);
    }

    return groups;
  }, [sortedTanks, departments]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">שיבוץ חיילים</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowDeptDialog(true)}>
            <FolderPlus className="h-4 w-4 ml-1" />
            מחלקה חדשה
          </Button>
        </div>
      </div>

      <Tabs defaultValue="table" dir="rtl">
        <TabsList>
          <TabsTrigger value="table">טבלה</TabsTrigger>
          <TabsTrigger value="gantt">גאנט</TabsTrigger>
          <TabsTrigger value="tanks">טנקים</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          {isLoaded ? (
            <div className="space-y-3">
              {/* Grouping toggle */}
              <div className="flex items-center gap-2">
                <Label className="text-xs">קיבוץ לפי:</Label>
                <div className="flex rounded-md border border-input overflow-hidden">
                  <button
                    onClick={() => setGroupBy('vehicle')}
                    className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${groupBy === 'vehicle' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
                  >
                    <Car className="h-3 w-3" />
                    רכב
                  </button>
                  <button
                    onClick={() => setGroupBy('soldier')}
                    className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${groupBy === 'soldier' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
                  >
                    <Users className="h-3 w-3" />
                    חייל
                  </button>
                </div>
              </div>

              <AssignmentTable
                assignments={assignments}
                soldiers={soldiers}
                tanks={tanks}
                conflicts={conflicts}
                groupBy={groupBy}
                departments={departments ?? []}
              />
            </div>
          ) : (
            <LoadingPlaceholder />
          )}
        </TabsContent>

        <TabsContent value="gantt">
          {/* Grouping toggle + Legend */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">קיבוץ לפי:</Label>
              <div className="flex rounded-md border border-input overflow-hidden">
                <button
                  onClick={() => setGroupBy('vehicle')}
                  className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${groupBy === 'vehicle' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
                >
                  <Car className="h-3 w-3" />
                  רכב
                </button>
                <button
                  onClick={() => setGroupBy('soldier')}
                  className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${groupBy === 'soldier' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
                >
                  <Users className="h-3 w-3" />
                  חייל
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
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

              {/* Vehicle cards grouped by department */}
              {tanksByDepartment.map((group) => (
                <div key={group.deptId} className="space-y-3">
                  {group.deptName && (
                    <div className="flex items-center justify-between border-b pb-1">
                      <h3 className="text-sm font-bold text-muted-foreground">{group.deptName}</h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-destructive h-6"
                        onClick={() => {
                          if (confirm(`למחוק את המחלקה "${group.deptName}"?`)) {
                            deleteDepartment(group.deptId);
                          }
                        }}
                      >
                        מחק מחלקה
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group.tanks.map((tank) => {
                      const tankAssignments = activeAssignments.filter(
                        (a) => a.tankId === tank.id
                      );
                      const isStandard = tank.vehicleCategory === 'standard';

                      // Sort assignments by role display order
                      const sortedAssignments = [...tankAssignments].sort((a, b) => {
                        const orderA = a.role ? ROLE_DISPLAY_ORDER.indexOf(a.role) : ROLE_DISPLAY_ORDER.length;
                        const orderB = b.role ? ROLE_DISPLAY_ORDER.indexOf(b.role) : ROLE_DISPLAY_ORDER.length;
                        return orderA - orderB;
                      });

                      if (isStandard) {
                        return (
                          <Card key={tank.id}>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold">{tank.designation}</span>
                                <div className="flex items-center gap-1">
                                  {/* Department selector */}
                                  <select
                                    value={tank.departmentId ?? ''}
                                    onChange={(e) => setTankDepartment(tank.id, e.target.value || undefined)}
                                    className="h-6 text-[10px] rounded border border-input bg-transparent px-1"
                                    title="מחלקה"
                                  >
                                    <option value="">ללא מחלקה</option>
                                    {(departments ?? []).map(d => (
                                      <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                  </select>
                                  <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">רכב רגיל</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                {sortedAssignments.length === 0 && (
                                  <p className="text-xs text-muted-foreground text-center py-2">אין חיילים משובצים</p>
                                )}
                                {sortedAssignments.map((a) => {
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
                            <div className="flex items-center justify-between mb-1">
                              <select
                                value={tank.departmentId ?? ''}
                                onChange={(e) => setTankDepartment(tank.id, e.target.value || undefined)}
                                className="h-6 text-[10px] rounded border border-input bg-transparent px-1"
                                title="מחלקה"
                              >
                                <option value="">ללא מחלקה</option>
                                {(departments ?? []).map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            </div>
                            <TankDiagram
                              tankId={tank.id}
                              designation={tank.designation}
                              assignments={sortedAssignments}
                              soldiers={soldiers}
                              onAssignSlot={(role) => openAssignDialog(tank.id, role)}
                              onUnassign={handleUnassign}
                            />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}

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

      {/* Reports section */}
      {isLoaded && (
        <div className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <FileText className="h-4 w-4" />
            דוחות
          </div>
          <ReportSection
            title="דוח שיבוצים"
            reportType="assignment-daily"
            fields={[
              { key: 'militaryId', label: 'מספר אישי (מ"א)' },
              { key: 'role', label: 'תפקיד' },
              { key: 'departmentHeaders', label: 'כותרות מחלקה' },
            ]}
            onGenerate={(date, prefs) =>
              generateAssignmentDailyReport(date, assignments, soldiers, tanks, departments ?? [], prefs)
            }
          />
          <ReportSection
            title="דוח חילופים"
            reportType="assignment-changes"
            fields={[
              { key: 'militaryId', label: 'מספר אישי (מ"א)' },
            ]}
            onGenerate={(date, prefs) =>
              generateAssignmentChangesReport(date, assignments, soldiers, prefs)
            }
          />
        </div>
      )}

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
            <div className="space-y-1">
              <Label className="text-sm">מחלקה</Label>
              <select
                value={vehicleDepartmentId}
                onChange={(e) => setVehicleDepartmentId(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">ללא מחלקה</option>
                {(departments ?? []).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
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

      {/* Create department dialog */}
      <Dialog open={showDeptDialog} onOpenChange={setShowDeptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>מחלקה חדשה</DialogTitle>
            <DialogDescription>צור מחלקה חדשה לקיבוץ רכבים</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">שם המחלקה</Label>
              <Input
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder='לדוגמה: "מחלקה א" או "פלוגת חילוץ"'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeptDialog(false)}>ביטול</Button>
            <Button onClick={handleCreateDepartment} disabled={!deptName}>
              <FolderPlus className="h-4 w-4 me-1" />
              צור מחלקה
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
