import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import { requireAdminPermission } from '@/lib/check-permission';

const COLLECTIONS = [
  'soldiers', 'equipmentTypes', 'equipmentAssignments', 'statusEntries',
  'tanks', 'tankCrewAssignments', 'platoons', 'squads', 'departments',
  'shampafEntries', 'shampafVacations', 'assignments', 'activations',
  'routineTemplates', 'routineChangeLogs', 'routineDepartments', 'routineVehicles', 'trainingContent', 'trainingTags', 'trainingCategories',
  'donations', 'userPermissions', 'permissionGroups',
];

/** Fields that should never appear in imported data (prototype pollution prevention) */
const DANGEROUS_FIELDS = new Set(['__proto__', 'constructor', 'prototype']);

interface BackupData {
  version: number;
  exportDate: string;
  tables: Record<string, unknown[]>;
}

/** Sanitize a record: remove dangerous fields and ensure id is a non-empty string */
function sanitizeRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  const id = record['id'];
  if (typeof id !== 'string' || id.length === 0) return null;

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!DANGEROUS_FIELDS.has(key)) {
      clean[key] = value;
    }
  }
  return clean;
}

export async function exportData(): Promise<string> {
  await requireAdminPermission('/settings');
  const tables: Record<string, unknown[]> = {};
  for (const name of COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    tables[name] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  }
  const backup: BackupData = {
    version: 3,
    exportDate: new Date().toISOString(),
    tables,
  };
  return JSON.stringify(backup, null, 2);
}

export async function importData(jsonString: string): Promise<{ success: boolean; message: string }> {
  await requireAdminPermission('/settings');

  try {
    let backup: BackupData;
    try {
      backup = JSON.parse(jsonString);
    } catch {
      return { success: false, message: 'קובץ JSON לא תקין' };
    }

    if (typeof backup.version !== 'number' || typeof backup.tables !== 'object' || backup.tables === null) {
      return { success: false, message: 'קובץ גיבוי לא תקין — חסרים שדות version או tables' };
    }

    let skippedRecords = 0;

    for (const name of COLLECTIONS) {
      const data = backup.tables[name];
      if (!data || !Array.isArray(data)) continue;

      // Clear existing
      const existing = await getDocs(collection(db, name));
      if (!existing.empty) {
        const batch = writeBatch(db);
        existing.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // Write new data in batches of 500 (Firestore limit)
      for (let i = 0; i < data.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = data.slice(i, i + 500);
        for (const item of chunk) {
          if (typeof item !== 'object' || item === null) {
            skippedRecords++;
            continue;
          }
          const record = sanitizeRecord(item as Record<string, unknown>);
          if (!record) {
            skippedRecords++;
            continue;
          }
          batch.set(doc(db, name, record['id'] as string), record);
        }
        await batch.commit();
      }
    }

    const msg = skippedRecords > 0
      ? `הנתונים יובאו בהצלחה (${skippedRecords} רשומות לא תקינות דולגו)`
      : 'הנתונים יובאו בהצלחה';
    return { success: true, message: msg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בייבוא הנתונים';
    return { success: false, message: msg };
  }
}

export function downloadBackup(jsonString: string): void {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pluga-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
