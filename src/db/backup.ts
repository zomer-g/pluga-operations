import { db } from './database';

interface BackupData {
  version: number;
  exportDate: string;
  tables: {
    soldiers: unknown[];
    equipmentTypes: unknown[];
    equipmentAssignments: unknown[];
    statusEntries: unknown[];
    tanks: unknown[];
    tankCrewAssignments: unknown[];
    platoons: unknown[];
    squads: unknown[];
  };
}

export async function exportData(): Promise<string> {
  const backup: BackupData = {
    version: 1,
    exportDate: new Date().toISOString(),
    tables: {
      soldiers: await db.soldiers.toArray(),
      equipmentTypes: await db.equipmentTypes.toArray(),
      equipmentAssignments: await db.equipmentAssignments.toArray(),
      statusEntries: await db.statusEntries.toArray(),
      tanks: await db.tanks.toArray(),
      tankCrewAssignments: await db.tankCrewAssignments.toArray(),
      platoons: await db.platoons.toArray(),
      squads: await db.squads.toArray(),
    },
  };
  return JSON.stringify(backup, null, 2);
}

export async function importData(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const backup = JSON.parse(jsonString) as BackupData;

    if (!backup.version || !backup.tables) {
      return { success: false, message: 'קובץ גיבוי לא תקין' };
    }

    await db.transaction('rw', [db.soldiers, db.equipmentTypes, db.equipmentAssignments, db.statusEntries, db.tanks, db.tankCrewAssignments, db.platoons, db.squads], async () => {
        await db.soldiers.clear();
        await db.equipmentTypes.clear();
        await db.equipmentAssignments.clear();
        await db.statusEntries.clear();
        await db.tanks.clear();
        await db.tankCrewAssignments.clear();
        await db.platoons.clear();
        await db.squads.clear();

        if (backup.tables.soldiers.length) await db.soldiers.bulkAdd(backup.tables.soldiers as never[]);
        if (backup.tables.equipmentTypes.length) await db.equipmentTypes.bulkAdd(backup.tables.equipmentTypes as never[]);
        if (backup.tables.equipmentAssignments.length) await db.equipmentAssignments.bulkAdd(backup.tables.equipmentAssignments as never[]);
        if (backup.tables.statusEntries.length) await db.statusEntries.bulkAdd(backup.tables.statusEntries as never[]);
        if (backup.tables.tanks.length) await db.tanks.bulkAdd(backup.tables.tanks as never[]);
        if (backup.tables.tankCrewAssignments.length) await db.tankCrewAssignments.bulkAdd(backup.tables.tankCrewAssignments as never[]);
        if (backup.tables.platoons.length) await db.platoons.bulkAdd(backup.tables.platoons as never[]);
        if (backup.tables.squads.length) await db.squads.bulkAdd(backup.tables.squads as never[]);
      }
    );

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
