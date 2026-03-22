import { useState } from 'react';
import { Calendar, Plus, Clock, User, FolderPlus } from 'lucide-react';
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
import { TankDiagram } from '@/components/tanks/TankDiagram';
import {
  useRoutineTemplates,
  useRoutineChangeLogs,
  useRoutineDepartments,
  useRoutineVehicles,
  addRoutineTemplate,
  deleteRoutineTemplate,
  addRoutineDepartment,
  deleteRoutineDepartment,
  addRoutineVehicle,
  deleteRoutineVehicle,
  assignRoutineSlot,
  unassignRoutineSlot,
} from './useRoutine';
import { useSoldiers } from '@/hooks/useSoldiers';
import { getCrewRoleLabel, ROLE_DISPLAY_ORDER, VEHICLE_CATEGORIES } from '@/lib/constants';
import type { CrewRole, Assignment, VehicleCategory } from '@/db/schema';

export function RoutinePage() {
  const templates = useRoutineTemplates();
  const vehicles = useRoutineVehicles();
  const soldiers = useSoldiers();
  const departments = useRoutineDepartments();
  const changeLogs = useRoutineChangeLogs();

  // Department dialog
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [deptName, setDeptName] = useState('');

  // Vehicle dialog
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('tank');
  const [vehicleDeptId, setVehicleDeptId] = useState('');

  // Assign dialog
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean;
    templateId: string;
    vehicleId: string;
    role: CrewRole | 'fifth' | null;
  }>({ open: false, templateId: '', vehicleId: '', role: null });
  const [assignSoldierId, setAssignSoldierId] = useState('');

  // Change log dialog
  const [showLogDialog, setShowLogDialog] = useState(false);

  if (!templates || !vehicles || !soldiers) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Group templates by department (via their vehicle's departmentId)
  const templatesByDept = (() => {
    const deptNameMap = new Map((departments ?? []).map(d => [d.id, d.name]));
    // Sort departments A-Z for alphabetical ordering
    const sortedDeptNames = new Map(
      [...(departments ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'he')).map((d, i) => [d.id, i])
    );

    const sorted = [...templates].sort((a, b) => {
      const vA = vehicles.find(v => v.id === a.tankId);
      const vB = vehicles.find(v => v.id === b.tankId);
      const dA = vA?.departmentId ? (sortedDeptNames.get(vA.departmentId) ?? 999) : 999;
      const dB = vB?.departmentId ? (sortedDeptNames.get(vB.departmentId) ?? 999) : 999;
      if (dA !== dB) return dA - dB;
      return (vA?.designation ?? '').localeCompare(vB?.designation ?? '', 'he');
    });

    const groups: { deptId: string; deptName: string; templates: typeof templates }[] = [];
    const seen = new Set<string>();

    for (const tmpl of sorted) {
      const vehicle = vehicles.find(v => v.id === tmpl.tankId);
      const deptId = vehicle?.departmentId || '__none__';
      if (!seen.has(deptId)) {
        seen.add(deptId);
        groups.push({
          deptId,
          deptName: deptId === '__none__' ? '' : (deptNameMap.get(deptId) ?? ''),
          templates: [],
        });
      }
      groups.find(g => g.deptId === deptId)!.templates.push(tmpl);
    }

    return groups;
  })();

  const templateToAssignments = (tmpl: typeof templates[0]): Assignment[] => {
    return tmpl.crewSlots.map((slot) => ({
      id: `routine_${tmpl.id}_${slot.role}_${slot.soldierId}`,
      soldierId: slot.soldierId,
      type: 'tank_role' as const,
      tankId: tmpl.tankId,
      role: slot.role,
      startDateTime: '',
      endDateTime: '',
    }));
  };

  const handleCreateDept = async () => {
    if (!deptName) return;
    await addRoutineDepartment(deptName, (departments?.length ?? 0) + 1);
    setShowDeptDialog(false);
    setDeptName('');
  };

  const handleCreateVehicle = async () => {
    if (!vehicleName) return;
    const vehicleId = await addRoutineVehicle({
      designation: vehicleName,
      vehicleCategory,
      departmentId: vehicleDeptId || undefined,
    });
    // Auto-create a routine template for this vehicle
    await addRoutineTemplate({ name: vehicleName, tankId: vehicleId, crewSlots: [] });
    setShowVehicleDialog(false);
    setVehicleName('');
    setVehicleCategory('tank');
    setVehicleDeptId('');
  };

  const openAssignDialog = (templateId: string, vehicleId: string, role: CrewRole | 'fifth') => {
    setAssignDialog({ open: true, templateId, vehicleId, role });
    setAssignSoldierId('');
  };

  const handleAssign = async () => {
    if (!assignSoldierId || !assignDialog.templateId || !assignDialog.role) return;
    const soldier = soldiers.find(s => s.id === assignSoldierId);
    const soldierName = soldier ? `${soldier.firstName} ${soldier.lastName}` : '';
    await assignRoutineSlot(assignDialog.templateId, assignDialog.role, assignSoldierId, soldierName);
    setAssignDialog({ open: false, templateId: '', vehicleId: '', role: null });
  };

  const handleUnassign = async (templateId: string, role: CrewRole, soldierId: string) => {
    const soldier = soldiers.find(s => s.id === soldierId);
    const soldierName = soldier ? `${soldier.firstName} ${soldier.lastName}` : '';
    await unassignRoutineSlot(templateId, role, soldierId, soldierName);
  };

  // Collect all soldier IDs already assigned in any routine template
  const assignedSoldierIds = new Set<string>();
  for (const tmpl of templates) {
    for (const slot of tmpl.crewSlots ?? []) {
      if (slot.soldierId) assignedSoldierIds.add(slot.soldierId);
    }
  }

  const getFilteredSoldiers = () => {
    const role = assignDialog.role;
    // Filter out already-assigned soldiers
    const available = soldiers.filter(s => !assignedSoldierIds.has(s.id));
    if (!role || role === 'fifth') return available;
    if (role === 'commander') {
      return available.filter(s => s.trainedRole === 'commander');
    }
    const matching = available.filter(s => s.trainedRole === role);
    const commanders = available.filter(s => s.trainedRole === 'commander');
    return [...matching, ...commanders];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">שגרת שיבוץ</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowLogDialog(true)}>
            <Clock className="h-4 w-4 ml-1" />
            יומן שינויים
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowDeptDialog(true)}>
            <FolderPlus className="h-4 w-4 ml-1" />
            מחלקה חדשה
          </Button>
          <Button size="sm" onClick={() => setShowVehicleDialog(true)}>
            <Plus className="h-4 w-4 ml-1" />
            רכב חדש
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        שגרת ברירת מחדל לצוותי הרכבים. שינויים נרשמים ביומן.
      </p>

      {/* Template cards grouped by department */}
      {templatesByDept.map((group) => (
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
                    deleteRoutineDepartment(group.deptId);
                  }
                }}
              >
                מחק מחלקה
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {group.templates.map((tmpl) => {
              const vehicle = vehicles.find(v => v.id === tmpl.tankId);
              const isStandard = vehicle?.vehicleCategory === 'standard';
              const assignments = templateToAssignments(tmpl);

              const sortedAssignments = [...assignments].sort((a, b) => {
                const orderA = a.role ? ROLE_DISPLAY_ORDER.indexOf(a.role) : ROLE_DISPLAY_ORDER.length;
                const orderB = b.role ? ROLE_DISPLAY_ORDER.indexOf(b.role) : ROLE_DISPLAY_ORDER.length;
                return orderA - orderB;
              });

              if (isStandard) {
                return (
                  <Card key={tmpl.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{tmpl.name}</span>
                        <button
                          onClick={() => {
                            if (confirm(`למחוק את "${tmpl.name}" והרכב שלו?`)) {
                              deleteRoutineTemplate(tmpl.id);
                              deleteRoutineVehicle(tmpl.tankId);
                            }
                          }}
                          className="text-destructive hover:text-destructive/80 text-xs p-0.5"
                        >✕</button>
                      </div>
                      <div className="space-y-1">
                        {sortedAssignments.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-2">אין צוות מוגדר</p>
                        )}
                        {sortedAssignments.map((a) => {
                          const s = soldiers.find(s => s.id === a.soldierId);
                          return (
                            <div key={a.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                              <span>{s ? `${s.firstName} ${s.lastName}` : '---'}</span>
                              {a.role && (
                                <button
                                  onClick={() => handleUnassign(tmpl.id, a.role!, a.soldierId)}
                                  className="text-destructive hover:text-destructive/80 text-xs"
                                >✕</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-8"
                        onClick={() => openAssignDialog(tmpl.id, tmpl.tankId, 'fifth')}
                      >
                        <Plus className="h-3 w-3 me-1" />
                        הוסף חייל
                      </Button>
                    </CardContent>
                  </Card>
                );
              }

              // Tank: TankDiagram
              return (
                <Card key={tmpl.id}>
                  <CardContent className="p-2">
                    <div className="flex items-center justify-between px-2 pt-1">
                      <span className="text-xs font-medium text-muted-foreground">{tmpl.name}</span>
                      <button
                        onClick={() => {
                          if (confirm(`למחוק את "${tmpl.name}" והרכב שלו?`)) {
                            deleteRoutineTemplate(tmpl.id);
                            deleteRoutineVehicle(tmpl.tankId);
                          }
                        }}
                        className="text-destructive hover:text-destructive/80 text-xs p-0.5"
                      >✕</button>
                    </div>
                    <TankDiagram
                      tankId={tmpl.tankId}
                      designation={vehicle?.designation ?? tmpl.name}
                      assignments={sortedAssignments}
                      soldiers={soldiers}
                      onAssignSlot={(role) => openAssignDialog(tmpl.id, tmpl.tankId, role)}
                      onUnassign={(assignmentId) => {
                        const parts = assignmentId.split('_');
                        const role = parts[2] as CrewRole;
                        const soldierId = parts.slice(3).join('_');
                        if (role && soldierId) handleUnassign(tmpl.id, role, soldierId);
                      }}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {templates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>אין שגרות מוגדרות</p>
          <p className="text-xs mt-1">צור מחלקה, רכב להתחלה</p>
        </div>
      )}

      {/* Assign soldier dialog */}
      <Dialog
        open={assignDialog.open}
        onOpenChange={(open) => {
          if (!open) setAssignDialog({ open: false, templateId: '', vehicleId: '', role: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שיבוץ חייל לשגרה</DialogTitle>
            <DialogDescription>
              {assignDialog.role && assignDialog.role !== 'fifth'
                ? `תפקיד: ${getCrewRoleLabel(assignDialog.role as CrewRole)}`
                : 'איש צוות'}
              {' | '}
              רכב: {vehicles.find(v => v.id === assignDialog.vehicleId)?.designation ?? '---'}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-sm">בחר חייל</Label>
            <select
              value={assignSoldierId}
              onChange={(e) => setAssignSoldierId(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">בחר...</option>
              {getFilteredSoldiers().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                  {s.trainedRole ? ` (${getCrewRoleLabel(s.trainedRole)})` : ''}
                </option>
              ))}
            </select>
            {assignDialog.role && assignDialog.role !== 'fifth' && assignDialog.role !== 'commander' && (
              <p className="text-xs text-muted-foreground mt-1">
                מוצגים חיילים עם תפקיד {getCrewRoleLabel(assignDialog.role as CrewRole)} ומפקדים
              </p>
            )}
            {assignDialog.role === 'commander' && (
              <p className="text-xs text-muted-foreground mt-1">
                מוצגים מפקדים בלבד
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog({ open: false, templateId: '', vehicleId: '', role: null })}>
              ביטול
            </Button>
            <Button onClick={handleAssign} disabled={!assignSoldierId}>
              שבץ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create department dialog */}
      <Dialog open={showDeptDialog} onOpenChange={setShowDeptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>מחלקה חדשה</DialogTitle>
            <DialogDescription>צור מחלקה חדשה לקיבוץ רכבים בשגרה</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">שם המחלקה</Label>
              <Input
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder='לדוגמה: "מחלקה א"'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeptDialog(false)}>ביטול</Button>
            <Button onClick={handleCreateDept} disabled={!deptName}>
              <FolderPlus className="h-4 w-4 me-1" />
              צור מחלקה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create vehicle dialog */}
      <Dialog open={showVehicleDialog} onOpenChange={setShowVehicleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>רכב חדש</DialogTitle>
            <DialogDescription>הוסף רכב חדש לשגרה</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">שם / מספר רכב</Label>
              <Input
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                placeholder='לדוגמה: "ג - 435"'
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">סוג רכב</Label>
              <select
                value={vehicleCategory}
                onChange={(e) => setVehicleCategory(e.target.value as VehicleCategory)}
                className="h-11 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {VEHICLE_CATEGORIES.map((vc) => (
                  <option key={vc.value} value={vc.value}>{vc.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {vehicleCategory === 'tank'
                  ? 'טנק — 4 תפקידים: מפקד, תותחן, נהג, טען'
                  : 'רכב רגיל — ללא הגבלת תפקידים'}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">מחלקה</Label>
              <select
                value={vehicleDeptId}
                onChange={(e) => setVehicleDeptId(e.target.value)}
                className="h-11 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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

      {/* Change log dialog */}
      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>יומן שינויים</DialogTitle>
            <DialogDescription>כל השינויים שבוצעו בשגרות השיבוץ</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(!changeLogs || changeLogs.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">אין שינויים</p>
            ) : (
              changeLogs.slice(0, 50).map((log) => {
                const tmpl = templates.find(t => t.id === log.templateId);
                const tmplName = tmpl?.name ?? '(נמחקה)';
                let desc = '';
                if (log.action === 'create') desc = `נוצרה שגרה "${tmplName}"`;
                else if (log.action === 'delete') desc = `נמחקה שגרה "${tmplName}"`;
                else if (log.action === 'assign') desc = `${log.soldierName ?? ''} שובץ ל${log.role ? getCrewRoleLabel(log.role) : 'צוות'} ב"${tmplName}"`;
                else if (log.action === 'unassign') desc = `${log.soldierName ?? ''} הוסר מ${log.role ? getCrewRoleLabel(log.role) : 'צוות'} ב"${tmplName}"`;

                return (
                  <div key={log.id} className="flex items-start gap-2 text-xs border rounded px-3 py-2">
                    <User className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1">
                      <div>{desc}</div>
                      <div className="text-muted-foreground mt-0.5">
                        {log.changedByName} · {new Date(log.timestamp).toLocaleString('he-IL')}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
