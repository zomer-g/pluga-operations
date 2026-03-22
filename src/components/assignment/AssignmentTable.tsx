import { useState, useMemo, Fragment } from 'react';
import { Pencil, Trash2, Plus, Save, XCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConflictBadge } from '@/components/assignment/ConflictBadge';
import {
  formatDateTimeShort,
  generateId,
  noonToday,
  noonTomorrow,
} from '@/lib/utils';
import {
  addAssignment,
  updateAssignment,
  deleteAssignment,
} from '@/hooks/useAssignment';
import type { ConflictType } from '@/hooks/useAssignment';
import { CREW_ROLES, getCrewRoleLabel, ROLE_DISPLAY_ORDER } from '@/lib/constants';
import type { Assignment, Soldier, Tank, CrewRole, AssignmentType, Department } from '@/db/schema';
import { MultiAssignDialog } from '@/components/assignment/MultiAssignDialog';

interface AssignmentTableProps {
  assignments: Assignment[];
  soldiers: Soldier[];
  tanks: Tank[];
  conflicts: Map<string, ConflictType[]>;
  groupBy: 'vehicle' | 'soldier';
  departments: Department[];
}

interface EditingData {
  soldierId: string;
  type: AssignmentType;
  tankId: string;
  role: string;
  missionName: string;
  startDateTime: string;
  endDateTime: string;
  notes: string;
}

function getSoldierName(soldierId: string, soldiers: Soldier[]): string {
  const s = soldiers.find((s) => s.id === soldierId);
  return s ? `${s.firstName} ${s.lastName}` : '---';
}

function getTankDesignation(tankId: string | undefined, tanks: Tank[]): string {
  if (!tankId) return '-';
  const t = tanks.find((t) => t.id === tankId);
  return t ? t.designation : '---';
}

function getRolesForSoldier(
  soldierId: string,
  soldiers: Soldier[]
): { value: string; label: string }[] {
  const soldier = soldiers.find((s) => s.id === soldierId);
  if (!soldier?.trainedRole || soldier.trainedRole === 'commander') {
    return CREW_ROLES.map((r) => ({ value: r.value, label: r.label }));
  }
  return CREW_ROLES.filter((r) => r.value === soldier.trainedRole).map((r) => ({
    value: r.value,
    label: r.label,
  }));
}

interface GroupedSection {
  id: string;
  label: string;
  isHeader?: boolean;
  assignments: Assignment[];
}

function groupAssignments(
  assignments: Assignment[],
  groupBy: 'vehicle' | 'soldier',
  tanks: Tank[],
  soldiers: Soldier[],
  departments: Department[]
): GroupedSection[] {
  const sections: GroupedSection[] = [];

  if (groupBy === 'soldier') {
    const soldierIds = [...new Set(assignments.map(a => a.soldierId))];
    for (const sid of soldierIds) {
      const soldier = soldiers.find(s => s.id === sid);
      if (!soldier) continue;
      sections.push({
        id: sid,
        label: `${soldier.firstName} ${soldier.lastName}`,
        assignments: assignments.filter(a => a.soldierId === sid),
      });
    }
    return sections;
  }

  // Group by vehicle under department (both sorted A-Z)
  const deptMap = new Map(departments.map(d => [d.id, d.name]));
  const tanksByDept = new Map<string, Tank[]>();

  for (const tank of tanks) {
    const key = tank.departmentId || '__none__';
    if (!tanksByDept.has(key)) tanksByDept.set(key, []);
    tanksByDept.get(key)!.push(tank);
  }

  // Sort tanks within each department A-Z
  for (const [, deptTanks] of tanksByDept) {
    deptTanks.sort((a, b) => a.designation.localeCompare(b.designation, 'he'));
  }

  // Sort departments A-Z, "no department" last
  const sortedDepts = [...departments].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  const orderedKeys: string[] = [];
  for (const dept of sortedDepts) {
    if (tanksByDept.has(dept.id)) orderedKeys.push(dept.id);
  }
  if (tanksByDept.has('__none__')) orderedKeys.push('__none__');

  for (const key of orderedKeys) {
    const deptTanks = tanksByDept.get(key) ?? [];
    if (key !== '__none__' && deptMap.has(key)) {
      sections.push({ id: `dept_${key}`, label: deptMap.get(key)!, isHeader: true, assignments: [] });
    } else if (key === '__none__' && orderedKeys.length > 1) {
      sections.push({ id: 'dept_none', label: 'ללא מחלקה', isHeader: true, assignments: [] });
    }

    for (const tank of deptTanks) {
      const tankAs = assignments.filter(a => a.tankId === tank.id);
      // Sort by role display order
      const sorted = [...tankAs].sort((a, b) => {
        const orderA = a.role ? ROLE_DISPLAY_ORDER.indexOf(a.role) : ROLE_DISPLAY_ORDER.length;
        const orderB = b.role ? ROLE_DISPLAY_ORDER.indexOf(b.role) : ROLE_DISPLAY_ORDER.length;
        return orderA - orderB;
      });
      if (sorted.length > 0) {
        sections.push({ id: tank.id, label: tank.designation, assignments: sorted });
      }
    }
  }

  // General missions without tank
  const noTank = assignments.filter(a => !a.tankId);
  if (noTank.length > 0) {
    sections.push({ id: 'general', label: 'משימות כלליות', isHeader: true, assignments: [] });
    sections.push({ id: 'general_items', label: '', assignments: noTank });
  }

  return sections;
}

export function AssignmentTable({
  assignments,
  soldiers,
  tanks,
  conflicts,
  groupBy,
  departments,
}: AssignmentTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<EditingData | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [multiAssignOpen, setMultiAssignOpen] = useState(false);

  const sections = useMemo(
    () => groupAssignments(assignments, groupBy, tanks, soldiers, departments),
    [assignments, groupBy, tanks, soldiers, departments]
  );

  const startAdd = () => {
    const tempId = `__new_${generateId()}`;
    setEditingId(tempId);
    setIsNew(true);
    setWarnings([]);
    setEditingData({
      soldierId: '',
      type: 'tank_role',
      tankId: '',
      role: '',
      missionName: '',
      startDateTime: noonToday(),
      endDateTime: noonTomorrow(),
      notes: '',
    });
  };

  const startEdit = (a: Assignment) => {
    setEditingId(a.id);
    setIsNew(false);
    setWarnings([]);
    setEditingData({
      soldierId: a.soldierId,
      type: a.type,
      tankId: a.tankId ?? '',
      role: a.role ?? '',
      missionName: a.missionName ?? '',
      startDateTime: a.startDateTime,
      endDateTime: a.endDateTime,
      notes: a.notes ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingData(null);
    setIsNew(false);
    setWarnings([]);
  };

  const saveAssignment = async () => {
    if (!editingData || !editingData.soldierId) return;

    if (isNew) {
      const result = await addAssignment({
        soldierId: editingData.soldierId,
        type: editingData.type,
        tankId: editingData.type === 'tank_role' ? editingData.tankId || undefined : undefined,
        role:
          editingData.type === 'tank_role' && editingData.role
            ? (editingData.role as CrewRole)
            : undefined,
        missionName:
          editingData.type === 'general_mission'
            ? editingData.missionName || undefined
            : undefined,
        startDateTime: editingData.startDateTime,
        endDateTime: editingData.endDateTime,
        notes: editingData.notes || undefined,
      });
      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
        setTimeout(() => setWarnings([]), 5000);
      }
    } else if (editingId) {
      await updateAssignment(editingId, {
        type: editingData.type,
        tankId: editingData.type === 'tank_role' ? editingData.tankId || undefined : undefined,
        role:
          editingData.type === 'tank_role' && editingData.role
            ? (editingData.role as CrewRole)
            : undefined,
        missionName:
          editingData.type === 'general_mission'
            ? editingData.missionName || undefined
            : undefined,
        startDateTime: editingData.startDateTime,
        endDateTime: editingData.endDateTime,
        notes: editingData.notes || undefined,
      });
    }
    cancelEdit();
  };

  const handleDelete = async (id: string) => {
    await deleteAssignment(id);
  };

  const availableRoles = editingData?.soldierId
    ? getRolesForSoldier(editingData.soldierId, soldiers)
    : CREW_ROLES.map((r) => ({ value: r.value, label: r.label }));

  const renderEditRow = (key: string) => {
    if (!editingData) return null;
    return (
      <tr key={key} className="border-b bg-muted/30">
        <td className="py-1 px-2">
          {isNew ? (
            <select
              value={editingData.soldierId}
              onChange={(e) =>
                setEditingData({ ...editingData, soldierId: e.target.value, role: '' })
              }
              className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">בחר חייל...</option>
              {soldiers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
            </select>
          ) : (
            <span className="leading-[44px]">
              {getSoldierName(editingData.soldierId, soldiers)}
            </span>
          )}
        </td>
        <td className="py-1 px-2">
          <select
            value={editingData.type}
            onChange={(e) =>
              setEditingData({
                ...editingData,
                type: e.target.value as AssignmentType,
                tankId: '',
                role: '',
                missionName: '',
              })
            }
            className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="tank_role">שיבוץ לטנק</option>
            <option value="general_mission">משימה כללית</option>
          </select>
        </td>
        <td className="py-1 px-2">
          {editingData.type === 'tank_role' ? (
            <select
              value={editingData.tankId}
              onChange={(e) =>
                setEditingData({ ...editingData, tankId: e.target.value })
              }
              className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">בחר טנק...</option>
              {tanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.designation}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={editingData.missionName}
              onChange={(e) =>
                setEditingData({ ...editingData, missionName: e.target.value })
              }
              placeholder="שם המשימה"
              className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
        </td>
        <td className="py-1 px-2">
          {editingData.type === 'tank_role' ? (
            <select
              value={editingData.role}
              onChange={(e) =>
                setEditingData({ ...editingData, role: e.target.value })
              }
              className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">איש צוות 5</option>
              {availableRoles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-muted-foreground leading-[44px]">-</span>
          )}
        </td>
        <td className="py-1 px-2">
          <input
            type="datetime-local"
            value={editingData.startDateTime}
            onChange={(e) =>
              setEditingData({ ...editingData, startDateTime: e.target.value })
            }
            className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </td>
        <td className="py-1 px-2">
          <input
            type="datetime-local"
            value={editingData.endDateTime}
            onChange={(e) =>
              setEditingData({ ...editingData, endDateTime: e.target.value })
            }
            className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </td>
        <td className="py-1 px-2 text-center">-</td>
        <td className="py-1 px-2">
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={saveAssignment} title="שמור" aria-label="שמור">
              <Save className="h-4 w-4 text-emerald-500" />
            </Button>
            <Button variant="ghost" size="icon" onClick={cancelEdit} title="בטל" aria-label="ביטול">
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  const renderAssignmentRow = (a: Assignment) => {
    const isEditing = editingId === a.id && !isNew;
    if (isEditing) return renderEditRow(a.id);

    const assignmentConflicts = conflicts.get(a.id);

    return (
      <tr key={a.id} className="border-b">
        <td className="py-1 px-2 min-h-[44px]">
          <span className="leading-[44px]">
            {getSoldierName(a.soldierId, soldiers)}
          </span>
        </td>
        <td className="py-1 px-2">
          <span className="leading-[44px] text-xs">
            {a.type === 'tank_role' ? 'שיבוץ לטנק' : 'משימה כללית'}
          </span>
        </td>
        <td className="py-1 px-2">
          <span className="leading-[44px]">
            {a.type === 'tank_role'
              ? getTankDesignation(a.tankId, tanks)
              : a.missionName || '-'}
          </span>
        </td>
        <td className="py-1 px-2">
          <span className="leading-[44px]">
            {a.type === 'tank_role'
              ? a.role
                ? getCrewRoleLabel(a.role)
                : 'איש צוות 5'
              : '-'}
          </span>
        </td>
        <td className="py-1 px-2">
          <span className="leading-[44px] text-xs">
            {formatDateTimeShort(a.startDateTime)}
          </span>
        </td>
        <td className="py-1 px-2">
          <span className="leading-[44px] text-xs">
            {formatDateTimeShort(a.endDateTime)}
          </span>
        </td>
        <td className="py-1 px-2 text-center">
          <ConflictBadge conflicts={assignmentConflicts} />
        </td>
        <td className="py-1 px-2">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => startEdit(a)}
              title="ערוך"
              aria-label="ערוך"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(a.id)}
              title="מחק"
              aria-label="מחק"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  const totalAssignments = sections.reduce((sum, s) => sum + s.assignments.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          {warnings.length > 0 && (
            <div className="text-sm text-amber-500 space-y-0.5">
              {warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setMultiAssignOpen(true)}>
            <Users className="h-4 w-4 ml-1" />
            שיבוץ מרובה
          </Button>
          <Button size="sm" onClick={startAdd}>
            <Plus className="h-4 w-4 ml-1" />
            שבץ חייל
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-right py-2 px-2 font-medium">חייל</th>
              <th className="text-right py-2 px-2 font-medium">סוג</th>
              <th className="text-right py-2 px-2 font-medium">טנק/משימה</th>
              <th className="text-right py-2 px-2 font-medium">תפקיד</th>
              <th className="text-right py-2 px-2 font-medium">התחלה</th>
              <th className="text-right py-2 px-2 font-medium">סיום</th>
              <th className="text-right py-2 px-2 font-medium">שמ"פ</th>
              <th className="text-right py-2 px-2 font-medium w-24">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {/* New row at top */}
            {isNew && editingId && renderEditRow(editingId)}

            {sections.map((section) => {
              if (section.isHeader) {
                return (
                  <tr key={section.id} className="bg-muted/50">
                    <td colSpan={8} className="py-2 px-2 text-xs font-bold text-muted-foreground">
                      {section.label}
                    </td>
                  </tr>
                );
              }

              return (
                <Fragment key={section.id}>
                  {section.label && (
                    <tr className="bg-muted/20">
                      <td colSpan={8} className="py-1.5 px-2 text-xs font-medium">
                        {section.label}
                      </td>
                    </tr>
                  )}
                  {section.assignments.map(renderAssignmentRow)}
                </Fragment>
              );
            })}

            {totalAssignments === 0 && !isNew && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  <p>אין שיבוצים</p>
                  <p className="text-xs mt-1">לחץ "שבץ חייל" להתחלה</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <MultiAssignDialog
        open={multiAssignOpen}
        onClose={() => setMultiAssignOpen(false)}
        soldiers={soldiers}
        tanks={tanks}
        departments={departments}
      />
    </div>
  );
}
