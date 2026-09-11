import { useMemo } from 'react';
import { useCollection, getCollection, writeBatch, updateDoc, deleteDoc } from '@/lib/datastore';
import type { StatusEntry, SoldierStatus } from '@/db/schema';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type { StatusEntryFormData } from '@/lib/validators';

export function useStatusHistory(soldierId?: string) {
  const all = useCollection<StatusEntry>('statusEntries');
  return useMemo(() => {
    if (!soldierId) return [];
    if (!all) return undefined;
    return all
      .filter(e => e.soldierId === soldierId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [all, soldierId]);
}

export function useCurrentStatus(soldierId?: string) {
  const all = useCollection<StatusEntry>('statusEntries');
  return useMemo(
    () => (soldierId ? all?.find(e => e.soldierId === soldierId && !e.endDate) : undefined),
    [all, soldierId],
  );
}

export function useAllCurrentStatuses() {
  const all = useCollection<StatusEntry>('statusEntries');
  return useMemo(() => {
    if (!all) return undefined;
    const currentMap = new Map<string, StatusEntry>();
    for (const entry of all) {
      if (!entry.endDate) currentMap.set(entry.soldierId, entry);
    }
    return currentMap;
  }, [all]);
}

export function useStatusCounts() {
  const all = useCollection<StatusEntry>('statusEntries');
  return useMemo(() => {
    if (!all) return undefined;
    const result: Record<string, number> = {};
    for (const entry of all) {
      if (!entry.endDate) {
        result[entry.status] = (result[entry.status] ?? 0) + 1;
      }
    }
    return result;
  }, [all]);
}

export function useAllStatusEntries() {
  return useCollection<StatusEntry>('statusEntries');
}

export async function addStatusEntry(
  soldierId: string,
  data: StatusEntryFormData
): Promise<string> {
  await requireEditPermission('/soldiers');
  const id = generateId();

  // Find open entries to close
  const openEntries = (await getCollection<StatusEntry>('statusEntries'))
    .filter(e => e.soldierId === soldierId && !e.endDate);

  const batch = writeBatch();

  // Close previous open statuses
  for (const entry of openEntries) {
    batch.update('statusEntries', entry.id, { endDate: data.startDate });
  }

  // Add new status entry
  const statusEntry: StatusEntry = {
    id,
    soldierId,
    status: data.status as SoldierStatus,
    startDate: data.startDate,
    endDate: data.endDate || undefined,
    notes: data.notes || undefined,
    orderNumber: data.orderNumber || undefined,
  };
  batch.set('statusEntries', id, stripUndefined(statusEntry as unknown as any));

  await batch.commit();
  return id;
}

export async function updateStatusEntry(id: string, data: Partial<StatusEntry>): Promise<void> {
  await requireEditPermission('/soldiers');
  await updateDoc('statusEntries', id, stripUndefined(data as any));
}

export async function deleteStatusEntry(id: string): Promise<void> {
  await requireEditPermission('/soldiers');
  await deleteDoc('statusEntries', id);
}
