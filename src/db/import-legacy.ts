import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Soldier, Tank, Platoon, Assignment, ShampafEntry, CrewRole } from './schema';
import { generateId, stripUndefined } from '@/lib/utils';

const ROLE_MAP: Record<string, CrewRole | undefined> = {
  'מפקד': 'commander',
  'תותחן': 'gunner',
  'נהג': 'driver',
  'טען': 'loader',
  'אחר': undefined,
};

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length === 0) return [];
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
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += ch;
  }
  result.push(current);
  return result;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' };
  const lastName = parts.pop()!;
  return { firstName: parts.join(' '), lastName };
}

export async function importLegacyData(csvData: {
  soldiers: string;
  departments: string;
  tanks: string;
  statuses: string;
  assignments: string;
}): Promise<{ message: string; counts: Record<string, number> }> {
  const oldSoldiers = parseCSV(csvData.soldiers);
  const oldDepts = csvData.departments ? parseCSV(csvData.departments) : [];
  const oldTanks = csvData.tanks ? parseCSV(csvData.tanks) : [];
  const oldStatuses = csvData.statuses ? parseCSV(csvData.statuses) : [];
  const oldAssignments = csvData.assignments ? parseCSV(csvData.assignments) : [];

  const soldierIdMap = new Map<string, string>();
  const deptIdMap = new Map<string, string>();
  const tankIdMap = new Map<string, string>();
  const now = new Date().toISOString();

  // Build data
  const platoons: Platoon[] = oldDepts.map((d, i) => {
    const id = generateId();
    deptIdMap.set(d['id'] ?? '', id);
    return { id, name: d['name'] ?? '', number: parseInt(d['order'] ?? '') || (i + 1) };
  });

  const soldiers: Soldier[] = oldSoldiers.map(s => {
    const id = generateId();
    soldierIdMap.set(s['id'] ?? '', id);
    const { firstName, lastName } = splitName(s['name'] ?? '');
    const role = ROLE_MAP[s['role'] ?? ''];
    const soldier: Record<string, unknown> = {
      id, firstName, lastName,
      militaryId: s['personalId'] || '',
      createdAt: now, updatedAt: now,
    };
    if (role) soldier.trainedRole = role;
    return soldier as unknown as Soldier;
  });

  const tanks: Tank[] = oldTanks.map(t => {
    const id = generateId();
    tankIdMap.set(t['id'] ?? '', id);
    const tank: Record<string, unknown> = {
      id,
      designation: t['name'] ?? '',
      type: t['vehicle_type'] === 'רכב' ? 'רכב' : 'מרכבה סימן 4',
      status: 'operational',
    };
    const platoonId = deptIdMap.get(t['department_id'] ?? '');
    if (platoonId) tank.platoonId = platoonId;
    return tank as unknown as Tank;
  });

  const positionToRole: Record<string, CrewRole | undefined> = {
    'מפקד': 'commander', 'תותחן': 'gunner', 'נהג': 'driver', 'טען': 'loader',
  };

  // Deduplicate shampaf per soldier
  const shampafMap = new Map<string, ShampafEntry>();
  for (const s of oldStatuses) {
    if (s['status'] !== 'פעיל') continue;
    const newSoldierId = soldierIdMap.get(s['soldier_id'] ?? '') ?? s['soldier_id'] ?? '';
    const startDT = (s['start_date'] ?? '') + 'T08:00';
    const endDT = (s['end_date'] ?? '') + 'T18:00';
    const existing = shampafMap.get(newSoldierId);
    if (!existing) {
      shampafMap.set(newSoldierId, { id: generateId(), soldierId: newSoldierId, startDateTime: startDT, endDateTime: endDT });
    } else {
      if (startDT < existing.startDateTime) existing.startDateTime = startDT;
      if (endDT > existing.endDateTime) existing.endDateTime = endDT;
    }
  }
  const shampafEntries = [...shampafMap.values()];

  const assignments: Assignment[] = oldAssignments.map(a => {
    const newSoldierId = soldierIdMap.get(a['soldier_id'] ?? '') ?? a['soldier_id'] ?? '';
    const newTankId = tankIdMap.get(a['tank_id'] ?? '') ?? a['tank_id'] ?? '';
    const role = positionToRole[a['position'] ?? ''];
    const isTankRole = !!role;
    const startHour = a['start_half'] === 'evening' ? '12:00' : '08:00';
    const assignment: Record<string, unknown> = {
      id: generateId(),
      soldierId: newSoldierId,
      type: isTankRole ? 'tank_role' : 'general_mission',
      tankId: newTankId,
      startDateTime: (a['start_date'] ?? '') + 'T' + startHour,
      endDateTime: (a['end_date'] ?? '') + 'T18:00',
    };
    if (role) assignment.role = role;
    if (!isTankRole && a['position']) assignment.missionName = a['position'];
    return assignment as unknown as Assignment;
  });

  // Write to Firestore in batches
  const writeBatchData = async (collectionName: string, items: Record<string, unknown>[]) => {
    // Clear existing
    const existing = await getDocs(collection(db, collectionName));
    if (!existing.empty) {
      const batch = writeBatch(db);
      existing.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    // Write in chunks of 500
    for (let i = 0; i < items.length; i += 500) {
      const batch = writeBatch(db);
      for (const item of items.slice(i, i + 500)) {
        const id = item['id'] as string;
        batch.set(doc(db, collectionName, id), stripUndefined(item));
      }
      await batch.commit();
    }
  };

  await writeBatchData('platoons', platoons as unknown as Record<string, unknown>[]);
  await writeBatchData('soldiers', soldiers as unknown as Record<string, unknown>[]);
  await writeBatchData('tanks', tanks as unknown as Record<string, unknown>[]);
  await writeBatchData('shampafEntries', shampafEntries as unknown as Record<string, unknown>[]);
  await writeBatchData('assignments', assignments as unknown as Record<string, unknown>[]);

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
