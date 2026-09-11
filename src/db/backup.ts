import { api, ApiError } from '@/lib/api';
import { requireAdminPermission } from '@/lib/check-permission';

// Backup files keep the Firebase-era format (version 3, one array per
// collection), so a backup exported from the old system restores here as-is.

export async function exportData(): Promise<string> {
  await requireAdminPermission('/settings');
  const backup = await api('/api/admin/backup');
  return JSON.stringify(backup, null, 2);
}

export async function importData(jsonString: string): Promise<{ success: boolean; message: string }> {
  await requireAdminPermission('/settings');

  let backup: unknown;
  try {
    backup = JSON.parse(jsonString);
  } catch {
    return { success: false, message: 'קובץ JSON לא תקין' };
  }

  try {
    return await api<{ success: boolean; message: string }>('/api/admin/restore', {
      method: 'POST',
      body: backup,
    });
  } catch (err) {
    const msg = err instanceof ApiError || err instanceof Error ? err.message : 'שגיאה בייבוא הנתונים';
    return { success: false, message: msg };
  }
}

export async function clearAllData(): Promise<void> {
  await requireAdminPermission('/settings');
  await api('/api/admin/clear', { method: 'POST', body: {} });
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
