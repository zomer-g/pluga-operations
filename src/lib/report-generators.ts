import type { Assignment, Soldier, Tank, Department, ShampafEntry, ShampafVacation, CrewRole } from '@/db/schema';
import { getCrewRoleLabel, ROLE_DISPLAY_ORDER } from '@/lib/constants';

type FieldPrefs = Record<string, boolean>;

/** Check if a field is visible (defaults to true if not set) */
function isVisible(prefs: FieldPrefs, field: string): boolean {
  return prefs[field] !== false;
}

/** Format soldier name, optionally with military ID */
function soldierLabel(s: Soldier, showMilitaryId: boolean): string {
  const name = `${s.firstName} ${s.lastName}`;
  if (showMilitaryId && s.militaryId) return `${name} (${s.militaryId})`;
  return name;
}

/** Extract date part from datetime string */
function toDate(dt: string): string {
  return dt.split('T')[0]!;
}

/** Format date as dd/MM/yyyy */
function formatDateHe(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// =====================================================
// 1. Assignment Daily Report (דוח שיבוצים)
// =====================================================

export function generateAssignmentDailyReport(
  date: string,
  assignments: Assignment[],
  soldiers: Soldier[],
  tanks: Tank[],
  departments: Department[],
  prefs: FieldPrefs,
): string {
  const showMilitaryId = isVisible(prefs, 'militaryId');
  const showRole = isVisible(prefs, 'role');
  const showDeptHeaders = isVisible(prefs, 'departmentHeaders');

  // Filter assignments active on date
  const dateStart = date + 'T00:00:00';
  const dateEnd = date + 'T23:59:59';
  const active = assignments.filter(a =>
    a.type === 'tank_role' && a.startDateTime <= dateEnd && a.endDateTime >= dateStart
  );

  // Build soldier map
  const soldierMap = new Map(soldiers.map(s => [s.id, s]));

  // Group by tank
  const tankAssignments = new Map<string, Assignment[]>();
  for (const a of active) {
    if (!a.tankId) continue;
    if (!tankAssignments.has(a.tankId)) tankAssignments.set(a.tankId, []);
    tankAssignments.get(a.tankId)!.push(a);
  }

  // Group tanks by department
  const deptOrder = new Map(departments.map((d, i) => [d.id, i]));
  const deptNameMap = new Map(departments.map(d => [d.id, d.name]));

  const sortedTanks = [...tanks].sort((a, b) => {
    const da = a.departmentId ? (deptOrder.get(a.departmentId) ?? 999) : 999;
    const db2 = b.departmentId ? (deptOrder.get(b.departmentId) ?? 999) : 999;
    if (da !== db2) return da - db2;
    return a.designation.localeCompare(b.designation, 'he');
  });

  const tanksByDept = new Map<string, Tank[]>();
  for (const tank of sortedTanks) {
    if (!tankAssignments.has(tank.id)) continue;
    const key = tank.departmentId || '__none__';
    if (!tanksByDept.has(key)) tanksByDept.set(key, []);
    tanksByDept.get(key)!.push(tank);
  }

  const lines: string[] = [];

  const orderedKeys: string[] = [];
  for (const dept of departments) {
    if (tanksByDept.has(dept.id)) orderedKeys.push(dept.id);
  }
  if (tanksByDept.has('__none__')) orderedKeys.push('__none__');

  for (const key of orderedKeys) {
    const deptTanks = tanksByDept.get(key) ?? [];

    if (showDeptHeaders && key !== '__none__' && deptNameMap.has(key)) {
      lines.push(deptNameMap.get(key)!);
      lines.push('───────');
    }

    for (const tank of deptTanks) {
      const assigns = tankAssignments.get(tank.id) ?? [];
      lines.push(`  ${tank.designation}:`);

      // Sort by role display order
      const sorted = [...assigns].sort((a, b) => {
        const oa = a.role ? ROLE_DISPLAY_ORDER.indexOf(a.role) : ROLE_DISPLAY_ORDER.length;
        const ob = b.role ? ROLE_DISPLAY_ORDER.indexOf(b.role) : ROLE_DISPLAY_ORDER.length;
        return oa - ob;
      });

      for (const a of sorted) {
        const soldier = soldierMap.get(a.soldierId);
        if (!soldier) continue;
        const name = soldierLabel(soldier, showMilitaryId);
        if (showRole && a.role) {
          lines.push(`    ${getCrewRoleLabel(a.role)} - ${name}`);
        } else {
          lines.push(`    ${name}`);
        }
      }
    }
  }

  const header = `דוח שיבוצים ליום ${formatDateHe(date)}\n=================================`;
  return header + '\n' + lines.join('\n');
}

// =====================================================
// 2. Assignment Changes Report (דוח חילופים)
// =====================================================

export function generateAssignmentChangesReport(
  date: string,
  assignments: Assignment[],
  soldiers: Soldier[],
  prefs: FieldPrefs,
): string {
  const showMilitaryId = isVisible(prefs, 'militaryId');
  const soldierMap = new Map(soldiers.map(s => [s.id, s]));

  const starting = assignments.filter(a => toDate(a.startDateTime) === date);
  const ending = assignments.filter(a => toDate(a.endDateTime) === date);

  const lines: string[] = [];
  lines.push(`דוח חילופים ליום ${formatDateHe(date)}`);
  lines.push('=================================');

  if (starting.length > 0) {
    lines.push('שיבוצים חדשים:');
    const seen = new Set<string>();
    for (const a of starting) {
      if (seen.has(a.soldierId)) continue;
      seen.add(a.soldierId);
      const s = soldierMap.get(a.soldierId);
      if (s) lines.push(`  • ${soldierLabel(s, showMilitaryId)}`);
    }
  }

  if (ending.length > 0) {
    lines.push('סיום שיבוצים:');
    const seen = new Set<string>();
    for (const a of ending) {
      if (seen.has(a.soldierId)) continue;
      seen.add(a.soldierId);
      const s = soldierMap.get(a.soldierId);
      if (s) lines.push(`  • ${soldierLabel(s, showMilitaryId)}`);
    }
  }

  if (starting.length === 0 && ending.length === 0) {
    lines.push('אין שינויים ביום זה.');
  }

  return lines.join('\n');
}

// =====================================================
// 3. Shampaf Changes Report (דוח שינויים)
// =====================================================

export function generateShampafChangesReport(
  date: string,
  shampafEntries: ShampafEntry[],
  soldiers: Soldier[],
  prefs: FieldPrefs,
): string {
  const showMilitaryId = isVisible(prefs, 'militaryId');
  const soldierMap = new Map(soldiers.map(s => [s.id, s]));

  const starting = shampafEntries.filter(e => toDate(e.startDateTime) === date);
  const ending = shampafEntries.filter(e => toDate(e.endDateTime) === date);

  const lines: string[] = [];
  lines.push(`דוח שינויים ליום ${formatDateHe(date)}`);
  lines.push('=================================');

  if (starting.length > 0) {
    lines.push('תחילת פעילות:');
    for (const e of starting) {
      const s = soldierMap.get(e.soldierId);
      if (s) lines.push(`  • ${soldierLabel(s, showMilitaryId)}`);
    }
  }

  if (ending.length > 0) {
    lines.push('שחרור:');
    for (const e of ending) {
      const s = soldierMap.get(e.soldierId);
      if (s) lines.push(`  • ${soldierLabel(s, showMilitaryId)}`);
    }
  }

  if (starting.length === 0 && ending.length === 0) {
    lines.push('אין שינויים ביום זה.');
  }

  return lines.join('\n');
}

// =====================================================
// 4. Shampaf Status Report (דוח מצב)
// =====================================================

export function generateShampafStatusReport(
  date: string,
  shampafEntries: ShampafEntry[],
  assignments: Assignment[],
  soldiers: Soldier[],
  tanks: Tank[],
  prefs: FieldPrefs,
  vacations?: ShampafVacation[],
): string {
  const showMilitaryId = isVisible(prefs, 'militaryId');
  const showVehicle = isVisible(prefs, 'vehicle');
  const showRole = isVisible(prefs, 'role');

  const soldierMap = new Map(soldiers.map(s => [s.id, s]));
  const tankMap = new Map(tanks.map(t => [t.id, t]));

  // Find soldiers with active shampaf on this date
  const dateStart = date + 'T00:00:00';
  const dateEnd = date + 'T23:59:59';

  const activeSoldierIds = new Set<string>();
  for (const e of shampafEntries) {
    if (e.startDateTime <= dateEnd && e.endDateTime >= dateStart) {
      activeSoldierIds.add(e.soldierId);
    }
  }

  // Build vacation/preparation lookup per soldier
  const soldierVacStatus = new Map<string, string>();
  if (vacations) {
    for (const v of vacations) {
      if (v.startDateTime <= dateEnd && v.endDateTime >= dateStart && activeSoldierIds.has(v.soldierId)) {
        const type = (v.type || 'vacation') === 'preparation' ? 'התארגנות' : 'חופשה';
        soldierVacStatus.set(v.soldierId, type);
      }
    }
  }

  // For each active soldier, find their assignment
  const activeAssignments = assignments.filter(a =>
    a.startDateTime <= dateEnd && a.endDateTime >= dateStart
  );
  const soldierAssignment = new Map<string, Assignment>();
  for (const a of activeAssignments) {
    if (activeSoldierIds.has(a.soldierId) && a.type === 'tank_role') {
      soldierAssignment.set(a.soldierId, a);
    }
  }

  // Build report
  const activeSoldiers = [...activeSoldierIds]
    .map(id => soldierMap.get(id))
    .filter(Boolean)
    .sort((a, b) => a!.firstName.localeCompare(b!.firstName, 'he')) as Soldier[];

  const lines: string[] = [];
  lines.push(`דוח מצב ליום ${formatDateHe(date)}`);
  lines.push('=================================');
  lines.push(`חיילים פעילים (${activeSoldiers.length}):`);

  for (const s of activeSoldiers) {
    const vacStatus = soldierVacStatus.get(s.id);
    if (vacStatus) {
      lines.push(`  • ${soldierLabel(s, showMilitaryId)} - ${vacStatus}`);
      continue;
    }
    const parts = [`  • ${soldierLabel(s, showMilitaryId)}`];
    const assign = soldierAssignment.get(s.id);
    if (assign) {
      if (showVehicle && assign.tankId) {
        const tank = tankMap.get(assign.tankId);
        if (tank) parts.push(tank.designation);
      }
      if (showRole && assign.role) {
        parts.push(getCrewRoleLabel(assign.role as CrewRole));
      }
    } else {
      parts.push('בית');
    }
    lines.push(parts.join(' - '));
  }

  if (activeSoldiers.length === 0) {
    lines.pop(); // remove count line
    lines.push('אין חיילים פעילים ביום זה.');
  }

  return lines.join('\n');
}
