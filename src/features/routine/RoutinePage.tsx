import { useState } from 'react';
import { Calendar, Plus, Trash2, Clock, User } from 'lucide-react';
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
  addRoutineTemplate,
  deleteRoutineTemplate,
  assignRoutineSlot,
  unassignRoutineSlot,
} from './useRoutine';
import { useTanks, useDepartments } from '@/hooks/useTanks';
import { useSoldiers } from '@/hooks/useSoldiers';
import { getCrewRoleLabel, ROLE_DISPLAY_ORDER } from '@/lib/constants';
import type { CrewRole, Assignment } from '@/db/schema';

export function RoutinePage() {
  const templates = useRoutineTemplates();
  const tanks = useTanks();
  const soldiers = useSoldiers();
  const departments = useDepartments();
  const changeLogs = useRoutineChangeLogs();

  // Create template dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTankId, setNewTankId] = useState('');

  // Assign dialog
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean;
    templateId: string;
    tankId: string;
    role: CrewRole | 'fifth' | null;
  }>({ open: false, templateId: '', tankId: '', role: null });
  const [assignSoldierId, setAssignSoldierId] = useState('');

  // Change log dialog
  const [showLogDialog, setShowLogDialog] = useState(false);

  if (!templates || !tanks || !soldiers) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Group templates by department (via their tank's departmentId)
  const templatesByDept = (() => {
    const deptOrder = new Map((departments ?? []).map((d, i) => [d.id, i]));
    const deptNameMap = new Map((departments ?? []).map(d => [d.id, d.name]));

    // Sort templates by tank's department order then tank designation
    const sorted = [...templates].sort((a, b) => {
      const tankA = tanks.find(t => t.id === a.tankId);
      const tankB = tanks.find(t => t.id === b.tankId);
      const deptA = tankA?.departmentId ? (deptOrder.get(tankA.departmentId) ?? 999) : 999;
      const deptB = tankB?.departmentId ? (deptOrder.get(tankB.departmentId) ?? 999) : 999;
      if (deptA !== deptB) return deptA - deptB;
      return (tankA?.designation ?? '').localeCompare(tankB?.designation ?? '', 'he');
    });

    const groups: { deptId: string; deptName: string; templates: typeof templates }[] = [];
    const seen = new Set<string>();

    for (const tmpl of sorted) {
      const tank = tanks.find(t => t.id === tmpl.tankId);
      const deptId = tank?.departmentId || '__none__';
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

  // Convert routine template crew slots to Assignment-like objects for TankDiagram
  const templateToAssignments = (tmpl: typeof templates[0]): Assignment[] => {
    return tmpl.crewSlots.map((slot, i) => ({
      id: `routine_${tmpl.id}_${i}`,
      soldierId: slot.soldierId,
      type: 'tank_role' as const,
      tankId: tmpl.tankId,
      role: slot.role,
      startDateTime: '',
      endDateTime: '',
    }));
  };

  const handleCreateTemplate = async () => {
    if (!newName || !newTankId) return;
    await addRoutineTemplate({ name: newName, tankId: newTankId, crewSlots: [] });
    setShowCreateDialog(false);
    setNewName('');
    setNewTankId('');
  };

  const openAssignDialog = (templateId: string, tankId: string, role: CrewRole | 'fifth') => {
    setAssignDialog({ open: true, templateId, tankId, role });
    setAssignSoldierId('');
  };

  const handleAssign = async () => {
    if (!assignSoldierId || !assignDialog.templateId || !assignDialog.role) return;
    const soldier = soldiers.find(s => s.id === assignSoldierId);
    const soldierName = soldier ? `${soldier.firstName} ${soldier.lastName}` : '';
    await assignRoutineSlot(assignDialog.templateId, assignDialog.role, assignSoldierId, soldierName);
    setAssignDialog({ open: false, templateId: '', tankId: '', role: null });
  };

  const handleUnassign = async (templateId: string, role: CrewRole, soldierId: string) => {
    const soldier = soldiers.find(s => s.id === soldierId);
    const soldierName = soldier ? `${soldier.firstName} ${soldier.lastName}` : '';
    await unassignRoutineSlot(templateId, role, soldierId, soldierName);
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
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 ml-1" />
            שגרה חדשה
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        שגרת ברירת מחדל לצוותי הרכבים. שינויים נרשמים ביומן.
      </p>

      {/* Template cards grouped by department — like tanks tab */}
      {templatesByDept.map((group) => (
        <div key={group.deptId} className="space-y-3">
          {group.deptName && (
            <div className="border-b pb-1">
              <h3 className="text-sm font-bold text-muted-foreground">{group.deptName}</h3>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {group.templates.map((tmpl) => {
              const tank = tanks.find(t => t.id === tmpl.tankId);
              const isStandard = tank?.vehicleCategory === 'standard';
              const assignments = templateToAssignments(tmpl);

              // Sort by role display order
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            if (confirm(`למחוק את "${tmpl.name}"?`)) deleteRoutineTemplate(tmpl.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">{tank?.designation ?? ''}</div>
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
                                >
                                  ✕
                                </button>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          if (confirm(`למחוק את "${tmpl.name}"?`)) deleteRoutineTemplate(tmpl.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <TankDiagram
                      tankId={tmpl.tankId}
                      designation={tank?.designation ?? tmpl.name}
                      assignments={sortedAssignments}
                      soldiers={soldiers}
                      onAssignSlot={(role) => openAssignDialog(tmpl.id, tmpl.tankId, role)}
                      onUnassign={(assignmentId) => {
                        // Find which slot this is
                        const idx = parseInt(assignmentId.split('_').pop() ?? '0');
                        const slot = tmpl.crewSlots[idx];
                        if (slot) handleUnassign(tmpl.id, slot.role, slot.soldierId);
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
          <p className="text-xs mt-1">לחץ "שגרה חדשה" להתחלה</p>
        </div>
      )}

      {/* Assign soldier dialog */}
      <Dialog
        open={assignDialog.open}
        onOpenChange={(open) => {
          if (!open) setAssignDialog({ open: false, templateId: '', tankId: '', role: null });
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
              רכב: {tanks.find(t => t.id === assignDialog.tankId)?.designation ?? '---'}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-sm">בחר חייל</Label>
            <select
              value={assignSoldierId}
              onChange={(e) => setAssignSoldierId(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">בחר...</option>
              {soldiers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                  {s.trainedRole ? ` (${getCrewRoleLabel(s.trainedRole)})` : ''}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog({ open: false, templateId: '', tankId: '', role: null })}>
              ביטול
            </Button>
            <Button onClick={handleAssign} disabled={!assignSoldierId}>
              שבץ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create template dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שגרה חדשה</DialogTitle>
            <DialogDescription>צור שגרת ברירת מחדל חדשה עבור רכב</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">שם השגרה</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder='לדוגמה: "ג - 435"'
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">רכב</Label>
              <select
                value={newTankId}
                onChange={(e) => setNewTankId(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">בחר רכב...</option>
                {tanks.map(t => (
                  <option key={t.id} value={t.id}>{t.designation}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>ביטול</Button>
            <Button onClick={handleCreateTemplate} disabled={!newName || !newTankId}>
              <Plus className="h-4 w-4 me-1" />
              צור שגרה
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
