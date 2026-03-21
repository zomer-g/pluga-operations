import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';

const COLLECTIONS = [
  'soldiers', 'equipmentTypes', 'equipmentAssignments', 'statusEntries',
  'tanks', 'tankCrewAssignments', 'platoons', 'squads', 'departments',
  'shampafEntries', 'shampafVacations', 'assignments', 'activations',
  'routineTemplates', 'trainingContent', 'trainingTags', 'trainingCategories',
  'donations', 'userPermissions', 'permissionGroups',
];

interface BackupData {
  version: number;
  exportDate: string;
  tables: Record<string, unknown[]>;
}

export async function exportData(): Promise<string> {
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
  try {
    const backup = JSON.parse(jsonString) as BackupData;
    if (!backup.version || !backup.tables) {
      return { success: false, message: 'קובץ גיבוי לא תקין' };
    }

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
          const record = item as Record<string, unknown>;
          const id = record['id'] as string;
          if (id) {
            batch.set(doc(db, name, id), record);
          }
        }
        await batch.commit();
      }
    }

    return { success: true, message: 'הנתונים יובאו בהצלחה' };
  } catch {
    return { success: false, message: 'שגיאה בייבוא הנתונים' };
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
