import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { StatusEntry, SoldierStatus } from '@/db/schema';
import { generateId } from '@/lib/utils';
import type { StatusEntryFormData } from '@/lib/validators';

export function useStatusHistory(soldierId?: string) {
  return useLiveQuery(async () => {
    if (!soldierId) return [];
    return db.statusEntries
      .where('soldierId')
      .equals(soldierId)
      .reverse()
      .sortBy('startDate');
  }, [soldierId]);
}

export function useCurrentStatus(soldierId?: string) {
  return useLiveQuery(async () => {
    if (!soldierId) return undefined;
    const entries = await db.statusEntries
      .where('soldierId')
      .equals(soldierId)
      .toArray();
    return entries.find((e) => !e.endDate);
  }, [soldierId]);
}

export function useAllCurrentStatuses() {
  return useLiveQuery(async () => {
    const all = await db.statusEntries.toArray();
    const currentMap = new Map<string, StatusEntry>();
    for (const entry of all) {
      if (!entry.endDate) {
        currentMap.set(entry.soldierId, entry);
      }
    }
    return currentMap;
  });
}

export function useStatusCounts() {
  return useLiveQuery(async () => {
    const all = await db.statusEntries.toArray();
    const counts: Record<string, number> = {};
    for (const entry of all) {
      if (!entry.endDate) {
        counts[entry.status] = (counts[entry.status] ?? 0) + 1;
      }
    }
    return counts;
  });
}

export function useAllStatusEntries() {
  return useLiveQuery(() => db.statusEntries.toArray());
}

export async function addStatusEntry(
  soldierId: string,
  data: StatusEntryFormData
): Promise<string> {
  const id = generateId();
  // Close previous open status
  const openEntries = await db.statusEntries
    .where('soldierId')
    .equals(soldierId)
    .filter((e) => !e.endDate)
    .toArray();

  await db.transaction('rw', db.statusEntries, async () => {
    for (const entry of openEntries) {
      await db.statusEntries.update(entry.id, { endDate: data.startDate });
    }
    const statusEntry: StatusEntry = {
      id,
      soldierId,
      status: data.status as SoldierStatus,
      startDate: data.startDate,
      endDate: data.endDate || undefined,
      notes: data.notes || undefined,
      orderNumber: data.orderNumber || undefined,
    };
    await db.statusEntries.add(statusEntry);
  });

  return id;
}

export async function updateStatusEntry(id: string, data: Partial<StatusEntry>): Promise<void> {
  await db.statusEntries.update(id, data);
}

export async function deleteStatusEntry(id: string): Promise<void> {
  await db.statusEntries.delete(id);
}
