/**
 * Legacy data import script.
 * Run once from the browser console or a temporary page to import old system data.
 * Maps old CSV data to the current app schema.
 */
import { db } from './database';
import type { Soldier, Tank, Platoon, Assignment, ShampafEntry, CrewRole, AssignmentType } from './schema';
import { generateId } from '@/lib/utils';

// ===== Role mapping =====
const ROLE_MAP: Record<string, CrewRole | undefined> = {
  'מפקד': 'commander',
  'תותחן': 'gunner',
  'נהג': 'driver',
  'טען': 'loader',
  'אחר': undefined,
};

// ===== Parsed CSV types =====
interface OldSoldier {
  name: string;
  personalId: string;
  role: string;
  notes: string;
  phone: string;
  id: string;
}

interface OldDepartment {
  name: string;
  order: string;
  id: string;
}

interface OldTank {
  name: string;
  vehicle_type: string;
  department_id: string;
  order: string;
  id: string;
}

interface OldStatus {
  end_date: string;
  soldier_id: string;
  start_date: string;
  status: string;
  id: string;
}

interface OldAssignment {
  end_date: string;
  soldier_id: string;
  end_half: string;
  start_half: string;
  tank_id: string;
  position: string;
  start_date: string;
  id: string;
}

// ===== CSV Parser =====
function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  const headers = parseCSVLine(lines[0]!);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ===== Split Hebrew name into first/last =====
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' };
  const lastName = parts.pop()!;
  return { firstName: parts.join(' '), lastName };
}

// ===== Main import function =====
export async function importLegacyData(csvData: {
  soldiers: string;
  departments: string;
  tanks: string;
  statuses: string;
  assignments: string;
}): Promise<{ message: string; counts: Record<string, number> }> {
  const oldSoldiers = parseCSV(csvData.soldiers) as unknown as OldSoldier[];
  const oldDepts = parseCSV(csvData.departments) as unknown as OldDepartment[];
  const oldTanks = parseCSV(csvData.tanks) as unknown as OldTank[];
  const oldStatuses = parseCSV(csvData.statuses) as unknown as OldStatus[];
  const oldAssignments = parseCSV(csvData.assignments) as unknown as OldAssignment[];

  // ID maps: old ID -> new ID
  const soldierIdMap = new Map<string, string>();
  const deptIdMap = new Map<string, string>();
  const tankIdMap = new Map<string, string>();

  const now = new Date().toISOString();

  // ===== 1. Import Departments as Platoons =====
  const platoons: Platoon[] = oldDepts.map((d, i) => {
    const id = generateId();
    deptIdMap.set(d.id, id);
    return {
      id,
      name: d.name,
      number: parseInt(d.order) || (i + 1),
    };
  });

  // ===== 2. Import Soldiers =====
  const soldiers: Soldier[] = oldSoldiers.map(s => {
    const id = generateId();
    soldierIdMap.set(s.id, id);
    const { firstName, lastName } = splitName(s.name);
    const trainedRole = ROLE_MAP[s.role];
    return {
      id,
      firstName,
      lastName,
      militaryId: s.personalId,
      trainedRole: trainedRole,
      phoneNumber: s.phone || undefined,
      notes: s.notes || undefined,
      createdAt: now,
      updatedAt: now,
    } as Soldier;
  });

  // ===== 3. Import Tanks =====
  const tanks: Tank[] = oldTanks.map(t => {
    const id = generateId();
    tankIdMap.set(t.id, id);
    const isVehicle = t.vehicle_type === 'רכב';
    return {
      id,
      designation: t.name,
      type: isVehicle ? 'רכב' : 'מרכבה סימן 4',
      platoonId: deptIdMap.get(t.department_id),
      status: 'operational' as const,
    };
  });

  // ===== 4. Import Statuses as ShampafEntries =====
  const shampafEntries: ShampafEntry[] = oldStatuses
    .filter(s => s.status === 'פעיל')
    .map(s => {
      return {
        id: generateId(),
        soldierId: soldierIdMap.get(s.soldier_id) ?? s.soldier_id,
        startDateTime: s.start_date + 'T08:00',
        endDateTime: s.end_date + 'T18:00',
      };
    })
    // Deduplicate: keep only one entry per soldier (the one with the latest end date)
    .reduce((acc, entry) => {
      const existing = acc.find(e => e.soldierId === entry.soldierId);
      if (!existing) {
        acc.push(entry);
      } else if (entry.endDateTime > existing.endDateTime) {
        Object.assign(existing, entry);
      } else if (entry.startDateTime < existing.startDateTime) {
        existing.startDateTime = entry.startDateTime;
      }
      return acc;
    }, [] as ShampafEntry[]);

  // ===== 5. Import Assignments =====
  // Position mapping for tank roles
  const positionToRole: Record<string, CrewRole | undefined> = {
    'מפקד': 'commander',
    'תותחן': 'gunner',
    'נהג': 'driver',
    'טען': 'loader',
  };

  const assignments: Assignment[] = oldAssignments.map(a => {
    const newSoldierId = soldierIdMap.get(a.soldier_id) ?? a.soldier_id;
    const newTankId = tankIdMap.get(a.tank_id) ?? a.tank_id;
    const role = positionToRole[a.position];

    // Determine if this is a tank role or a general mission (numbered positions like "מקום 1")
    const isTankRole = !!role;

    const startHour = a.start_half === 'full' ? '08:00' : (a.start_half === 'morning' ? '08:00' : '12:00');
    const endHour = a.end_half === 'morning' ? '12:00' : '18:00';

    return {
      id: generateId(),
      soldierId: newSoldierId,
      type: (isTankRole ? 'tank_role' : 'general_mission') as AssignmentType,
      tankId: newTankId,
      role: role,
      missionName: isTankRole ? undefined : a.position,
      startDateTime: a.start_date + 'T' + startHour,
      endDateTime: a.end_date + 'T' + endHour,
    };
  });

  // ===== Write to database =====
  await db.transaction('rw', [
    db.soldiers, db.platoons, db.tanks,
    db.shampafEntries, db.assignments,
  ], async () => {
    // Clear existing data
    await db.soldiers.clear();
    await db.platoons.clear();
    await db.tanks.clear();
    await db.shampafEntries.clear();
    await db.assignments.clear();

    // Bulk insert
    await db.platoons.bulkAdd(platoons);
    await db.soldiers.bulkAdd(soldiers);
    await db.tanks.bulkAdd(tanks);
    await db.shampafEntries.bulkAdd(shampafEntries);
    await db.assignments.bulkAdd(assignments);
  });

  return {
    message: 'ייבוא הושלם בהצלחה',
    counts: {
      soldiers: soldiers.length,
      platoons: platoons.length,
      tanks: tanks.length,
      shampafEntries: shampafEntries.length,
      assignments: assignments.length,
    },
  };
}
