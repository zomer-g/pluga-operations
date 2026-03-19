import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { ShampafEntry, ShampafVacation } from '@/db/schema';
import { generateId, dateRangesOverlap } from '@/lib/utils';

// ===== Queries =====

export function useShampafEntries(soldierId?: string) {
  return useLiveQuery(async () => {
    if (soldierId) {
      return db.shampafEntries.where('soldierId').equals(soldierId).toArray();
    }
    return db.shampafEntries.toArray();
  }, [soldierId]);
}

export function useShampafVacations(shampafEntryId?: string) {
  return useLiveQuery(async () => {
    if (shampafEntryId) {
      return db.shampafVacations.where('shampafEntryId').equals(shampafEntryId).toArray();
    }
    return db.shampafVacations.toArray();
  }, [shampafEntryId]);
}

export function useAllShampafVacations() {
  return useLiveQuery(() => db.shampafVacations.toArray());
}

export function useShampafForDateRange(startDate: string, endDate: string) {
  return useLiveQuery(async () => {
    const entries = await db.shampafEntries.toArray();
    return entries.filter(e => dateRangesOverlap(e.startDateTime, e.endDateTime, startDate, endDate));
  }, [startDate, endDate]);
}

export type ShampafStatus = 'mobilized' | 'vacation' | 'none';

export function useSoldierShampafStatus(soldierId: string | undefined, dateTime?: string): ShampafStatus | undefined {
  return useLiveQuery(async () => {
    if (!soldierId) return 'none';
    const now = dateTime ?? new Date().toISOString();

    const entries = await db.shampafEntries
      .where('soldierId')
      .equals(soldierId)
      .toArray();

    const activeEntry = entries.find(e => e.startDateTime <= now && e.endDateTime >= now);
    if (!activeEntry) return 'none';

    const vacations = await db.shampafVacations
      .where('shampafEntryId')
      .equals(activeEntry.id)
      .toArray();

    const onVacation = vacations.some(v => v.startDateTime <= now && v.endDateTime >= now);
    return onVacation ? 'vacation' : 'mobilized';
  }, [soldierId, dateTime]);
}

// Checks shampaf status for a soldier at a given time (non-hook version for mutations)
export async function getSoldierShampafStatusAt(
  soldierId: string,
  startDT: string,
  endDT: string
): Promise<{ covered: boolean; onVacation: boolean }> {
  const entries = await db.shampafEntries
    .where('soldierId')
    .equals(soldierId)
    .toArray();

  const covering = entries.find(e =>
    e.startDateTime <= startDT && e.endDateTime >= endDT
  );

  if (!covering) return { covered: false, onVacation: false };

  const vacations = await db.shampafVacations
    .where('shampafEntryId')
    .equals(covering.id)
    .toArray();

  const onVacation = vacations.some(v =>
    dateRangesOverlap(v.startDateTime, v.endDateTime, startDT, endDT)
  );

  return { covered: true, onVacation };
}

// ===== Mutations =====

export async function addShampafEntry(data: {
  soldierId: string;
  startDateTime: string;
  endDateTime: string;
  orderNumber?: string;
  notes?: string;
}): Promise<string> {
  const id = generateId();
  const entry: ShampafEntry = {
    id,
    soldierId: data.soldierId,
    startDateTime: data.startDateTime,
    endDateTime: data.endDateTime,
    orderNumber: data.orderNumber,
    notes: data.notes,
  };
  await db.shampafEntries.add(entry);
  return id;
}

export async function updateShampafEntry(id: string, data: Partial<ShampafEntry>): Promise<void> {
  await db.shampafEntries.update(id, data);
}

export async function deleteShampafEntry(id: string): Promise<void> {
  await db.transaction('rw', [db.shampafEntries, db.shampafVacations], async () => {
    await db.shampafVacations.where('shampafEntryId').equals(id).delete();
    await db.shampafEntries.delete(id);
  });
}

export async function addShampafVacation(data: {
  shampafEntryId: string;
  soldierId: string;
  startDateTime: string;
  endDateTime: string;
  reason?: string;
  notes?: string;
}): Promise<string> {
  const id = generateId();
  const vacation: ShampafVacation = {
    id,
    shampafEntryId: data.shampafEntryId,
    soldierId: data.soldierId,
    startDateTime: data.startDateTime,
    endDateTime: data.endDateTime,
    reason: data.reason,
    notes: data.notes,
  };
  await db.shampafVacations.add(vacation);
  return id;
}

export async function updateShampafVacation(id: string, data: Partial<ShampafVacation>): Promise<void> {
  await db.shampafVacations.update(id, data);
}

export async function deleteShampafVacation(id: string): Promise<void> {
  await db.shampafVacations.delete(id);
}
