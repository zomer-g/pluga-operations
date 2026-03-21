import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import type { ShampafEntry, ShampafVacation } from '@/db/schema';
import { generateId, dateRangesOverlap, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';

// ===== Queries =====

export function useShampafEntries(soldierId?: string) {
  const [entries, setEntries] = useState<ShampafEntry[] | undefined>();

  useEffect(() => {
    const q = soldierId
      ? query(collection(db, 'shampafEntries'), where('soldierId', '==', soldierId))
      : query(collection(db, 'shampafEntries'));
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(d => ({ ...d.data(), id: d.id } as ShampafEntry)));
    });
    return unsub;
  }, [soldierId]);

  return entries;
}

export function useShampafVacations(shampafEntryId?: string) {
  const [vacations, setVacations] = useState<ShampafVacation[] | undefined>();

  useEffect(() => {
    const q = shampafEntryId
      ? query(collection(db, 'shampafVacations'), where('shampafEntryId', '==', shampafEntryId))
      : query(collection(db, 'shampafVacations'));
    const unsub = onSnapshot(q, (snap) => {
      setVacations(snap.docs.map(d => ({ ...d.data(), id: d.id } as ShampafVacation)));
    });
    return unsub;
  }, [shampafEntryId]);

  return vacations;
}

export function useAllShampafVacations() {
  const [vacations, setVacations] = useState<ShampafVacation[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shampafVacations'), (snap) => {
      setVacations(snap.docs.map(d => ({ ...d.data(), id: d.id } as ShampafVacation)));
    });
    return unsub;
  }, []);

  return vacations;
}

export function useShampafForDateRange(startDate: string, endDate: string) {
  const [entries, setEntries] = useState<ShampafEntry[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shampafEntries'), (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as ShampafEntry));
      setEntries(all.filter(e => dateRangesOverlap(e.startDateTime, e.endDateTime, startDate, endDate)));
    });
    return unsub;
  }, [startDate, endDate]);

  return entries;
}

export type ShampafStatus = 'mobilized' | 'vacation' | 'none';

export function useSoldierShampafStatus(soldierId: string | undefined, dateTime?: string): ShampafStatus | undefined {
  const [status, setStatus] = useState<ShampafStatus | undefined>();

  useEffect(() => {
    if (!soldierId) {
      setStatus('none');
      return;
    }

    // Listen to shampaf entries for this soldier
    const q = query(collection(db, 'shampafEntries'), where('soldierId', '==', soldierId));
    const unsub = onSnapshot(q, async (snap) => {
      const now = dateTime ?? new Date().toISOString();
      const entries = snap.docs.map(d => ({ ...d.data(), id: d.id } as ShampafEntry));
      const activeEntry = entries.find(e => e.startDateTime <= now && e.endDateTime >= now);

      if (!activeEntry) {
        setStatus('none');
        return;
      }

      // Check vacations for the active entry
      const vacSnap = await getDocs(
        query(collection(db, 'shampafVacations'), where('shampafEntryId', '==', activeEntry.id))
      );
      const vacations = vacSnap.docs.map(d => d.data() as ShampafVacation);
      const onVacation = vacations.some(v => v.startDateTime <= now && v.endDateTime >= now);
      setStatus(onVacation ? 'vacation' : 'mobilized');
    });
    return unsub;
  }, [soldierId, dateTime]);

  return status;
}

// Checks shampaf status for a soldier at a given time (non-hook version for mutations)
export async function getSoldierShampafStatusAt(
  soldierId: string,
  startDT: string,
  endDT: string
): Promise<{ covered: boolean; onVacation: boolean }> {
  const entriesSnap = await getDocs(
    query(collection(db, 'shampafEntries'), where('soldierId', '==', soldierId))
  );
  const entries = entriesSnap.docs.map(d => ({ ...d.data(), id: d.id } as ShampafEntry));

  const covering = entries.find(e =>
    e.startDateTime <= startDT && e.endDateTime >= endDT
  );

  if (!covering) return { covered: false, onVacation: false };

  const vacSnap = await getDocs(
    query(collection(db, 'shampafVacations'), where('shampafEntryId', '==', covering.id))
  );
  const vacations = vacSnap.docs.map(d => d.data() as ShampafVacation);

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
  await setDoc(doc(db, 'shampafEntries', id), stripUndefined(entry as unknown as any));
  return id;
}

export async function updateShampafEntry(id: string, data: Partial<ShampafEntry>): Promise<void> {
  await requireEditPermission('/shampaf');
  await updateDoc(doc(db, 'shampafEntries', id), stripUndefined(data as any));
}

export async function deleteShampafEntry(id: string): Promise<void> {
  await requireEditPermission('/shampaf');
  const batch = writeBatch(db);

  // Cascade: delete child vacations
  const vacSnap = await getDocs(
    query(collection(db, 'shampafVacations'), where('shampafEntryId', '==', id))
  );
  vacSnap.docs.forEach(d => batch.delete(d.ref));

  // Delete the entry itself
  batch.delete(doc(db, 'shampafEntries', id));

  await batch.commit();
}

export async function addShampafVacation(data: {
  shampafEntryId: string;
  soldierId: string;
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
    startDateTime: data.startDateTime,
    endDateTime: data.endDateTime,
    reason: data.reason,
    notes: data.notes,
  };
  await setDoc(doc(db, 'shampafVacations', id), stripUndefined(vacation as unknown as any));
  return id;
}

export async function updateShampafVacation(id: string, data: Partial<ShampafVacation>): Promise<void> {
  await requireEditPermission('/shampaf');
  await updateDoc(doc(db, 'shampafVacations', id), stripUndefined(data as any));
}

export async function deleteShampafVacation(id: string): Promise<void> {
  await requireEditPermission('/shampaf');
  await deleteDoc(doc(db, 'shampafVacations', id));
}
