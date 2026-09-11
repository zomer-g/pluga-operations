import { useMemo } from 'react';
import { useCollection, getCollection, setDoc, updateDoc, deleteDoc, writeBatch } from '@/lib/datastore';
import type { ShampafEntry, ShampafVacation } from '@/db/schema';
import { generateId, dateRangesOverlap, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';

// ===== Queries =====

export function useShampafEntries(soldierId?: string) {
  const all = useCollection<ShampafEntry>('shampafEntries');
  return useMemo(
    () => (soldierId ? all?.filter(e => e.soldierId === soldierId) : all),
    [all, soldierId],
  );
}

export function useShampafVacations(shampafEntryId?: string) {
  const all = useCollection<ShampafVacation>('shampafVacations');
  return useMemo(
    () => (shampafEntryId ? all?.filter(v => v.shampafEntryId === shampafEntryId) : all),
    [all, shampafEntryId],
  );
}

export function useAllShampafVacations() {
  return useCollection<ShampafVacation>('shampafVacations');
}

export function useShampafForDateRange(startDate: string, endDate: string) {
  const all = useCollection<ShampafEntry>('shampafEntries');
  return useMemo(
    () => all?.filter(e => dateRangesOverlap(e.startDateTime, e.endDateTime, startDate, endDate)),
    [all, startDate, endDate],
  );
}

export type ShampafStatus = 'mobilized' | 'vacation' | 'preparation' | 'none';

export function useSoldierShampafStatus(soldierId: string | undefined, dateTime?: string): ShampafStatus | undefined {
  const entries = useCollection<ShampafEntry>('shampafEntries');
  const vacations = useCollection<ShampafVacation>('shampafVacations');

  return useMemo(() => {
    if (!soldierId) return 'none';
    if (!entries || !vacations) return undefined;

    const now = dateTime ?? new Date().toISOString();
    const activeEntry = entries.find(e => e.soldierId === soldierId && e.startDateTime <= now && e.endDateTime >= now);
    if (!activeEntry) return 'none';

    const activeVac = vacations.find(v =>
      v.shampafEntryId === activeEntry.id && v.startDateTime <= now && v.endDateTime >= now
    );
    if (activeVac) {
      return (activeVac.type || 'vacation') === 'preparation' ? 'preparation' : 'vacation';
    }
    return 'mobilized';
  }, [entries, vacations, soldierId, dateTime]);
}

// Checks shampaf status for a soldier at a given time (non-hook version for mutations)
export async function getSoldierShampafStatusAt(
  soldierId: string,
  startDT: string,
  endDT: string
): Promise<{ covered: boolean; onVacation: boolean }> {
  const [entries, vacations] = await Promise.all([
    getCollection<ShampafEntry>('shampafEntries'),
    getCollection<ShampafVacation>('shampafVacations'),
  ]);

  const covering = entries.find(e =>
    e.soldierId === soldierId && e.startDateTime <= startDT && e.endDateTime >= endDT
  );

  if (!covering) return { covered: false, onVacation: false };

  const onVacation = vacations.some(v =>
    v.shampafEntryId === covering.id &&
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
  await requireEditPermission('/shampaf');
  const id = generateId();
  const entry: ShampafEntry = {
    id,
    soldierId: data.soldierId,
    startDateTime: data.startDateTime,
    endDateTime: data.endDateTime,
    orderNumber: data.orderNumber,
    notes: data.notes,
  };
  await setDoc('shampafEntries', id, stripUndefined(entry as unknown as any));
  return id;
}

export async function updateShampafEntry(id: string, data: Partial<ShampafEntry>): Promise<void> {
  await requireEditPermission('/shampaf');
  await updateDoc('shampafEntries', id, stripUndefined(data as any));
}

export async function deleteShampafEntry(id: string): Promise<void> {
  await requireEditPermission('/shampaf');
  // The database cascades to the entry's vacations.
  await deleteDoc('shampafEntries', id);
}

export async function addShampafVacation(data: {
  shampafEntryId: string;
  soldierId: string;
  type?: 'vacation' | 'preparation';
  startDateTime: string;
  endDateTime: string;
  reason?: string;
  notes?: string;
}): Promise<string> {
  await requireEditPermission('/shampaf');
  const id = generateId();
  const vacation: ShampafVacation = {
    id,
    shampafEntryId: data.shampafEntryId,
    soldierId: data.soldierId,
    type: data.type || 'vacation',
    startDateTime: data.startDateTime,
    endDateTime: data.endDateTime,
    reason: data.reason,
    notes: data.notes,
  };
  await setDoc('shampafVacations', id, stripUndefined(vacation as unknown as any));
  return id;
}

export async function updateShampafVacation(id: string, data: Partial<ShampafVacation>): Promise<void> {
  await requireEditPermission('/shampaf');
  await updateDoc('shampafVacations', id, stripUndefined(data as any));
}

export async function deleteShampafVacation(id: string): Promise<void> {
  await requireEditPermission('/shampaf');
  await deleteDoc('shampafVacations', id);
}

// ===== Batch Operations =====

export interface ShampafConflict {
  soldierId: string;
  type: 'existing_shampaf';
  message: string;
  existingEntryId: string;
}

export async function checkShampafBatchConflicts(
  soldierIds: string[],
  startDT: string,
  endDT: string,
): Promise<ShampafConflict[]> {
  const allEntries = await getCollection<ShampafEntry>('shampafEntries');
  const conflicts: ShampafConflict[] = [];

  for (const sid of soldierIds) {
    const overlap = allEntries.find(e =>
      e.soldierId === sid &&
      dateRangesOverlap(e.startDateTime, e.endDateTime, startDT, endDT)
    );
    if (overlap) {
      conflicts.push({
        soldierId: sid,
        type: 'existing_shampaf',
        message: `שמ"פ קיים (${overlap.startDateTime.split('T')[0]} - ${overlap.endDateTime.split('T')[0]})`,
        existingEntryId: overlap.id,
      });
    }
  }
  return conflicts;
}

export async function addShampafEntriesBatch(
  entries: { soldierId: string; startDateTime: string; endDateTime: string; orderNumber?: string }[],
): Promise<{ ids: string[] }> {
  await requireEditPermission('/shampaf');
  const batch = writeBatch();
  const ids: string[] = [];

  for (const data of entries) {
    const id = generateId();
    ids.push(id);
    const entry: ShampafEntry = {
      id,
      soldierId: data.soldierId,
      startDateTime: data.startDateTime,
      endDateTime: data.endDateTime,
      orderNumber: data.orderNumber,
    };
    batch.set('shampafEntries', id, stripUndefined(entry as unknown as any));
  }

  await batch.commit();
  return { ids };
}
