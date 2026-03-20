import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import type { StatusEntry, SoldierStatus } from '@/db/schema';
import { generateId, stripUndefined } from '@/lib/utils';
import type { StatusEntryFormData } from '@/lib/validators';
import { useCacheEnabled } from '@/stores/useAppStore';

export function useStatusHistory(soldierId?: string) {
  const [entries, setEntries] = useState<StatusEntry[] | undefined>();
  const enabled = useCacheEnabled('statuses');

  useEffect(() => {
    if (!enabled) { setEntries(undefined); return; }
    if (!soldierId) {
      setEntries([]);
      return;
    }
    const q = query(collection(db, 'statusEntries'), where('soldierId', '==', soldierId));
    const unsub = onSnapshot(q, (snap) => {
      const result = snap.docs.map(d => ({ ...d.data(), id: d.id } as StatusEntry));
      result.sort((a, b) => b.startDate.localeCompare(a.startDate));
      setEntries(result);
    });
    return unsub;
  }, [enabled, soldierId]);

  return entries;
}

export function useCurrentStatus(soldierId?: string) {
  const [status, setStatus] = useState<StatusEntry | undefined>();
  const enabled = useCacheEnabled('statuses');

  useEffect(() => {
    if (!enabled || !soldierId) {
      setStatus(undefined);
      return;
    }
    const q = query(collection(db, 'statusEntries'), where('soldierId', '==', soldierId));
    const unsub = onSnapshot(q, (snap) => {
      const entries = snap.docs.map(d => ({ ...d.data(), id: d.id } as StatusEntry));
      setStatus(entries.find(e => !e.endDate));
    });
    return unsub;
  }, [enabled, soldierId]);

  return status;
}

export function useAllCurrentStatuses() {
  const [statusMap, setStatusMap] = useState<Map<string, StatusEntry> | undefined>();
  const enabled = useCacheEnabled('statuses');

  useEffect(() => {
    if (!enabled) { setStatusMap(undefined); return; }
    const unsub = onSnapshot(collection(db, 'statusEntries'), (snap) => {
      const currentMap = new Map<string, StatusEntry>();
      for (const d of snap.docs) {
        const entry = { ...d.data(), id: d.id } as StatusEntry;
        if (!entry.endDate) {
          currentMap.set(entry.soldierId, entry);
        }
      }
      setStatusMap(currentMap);
    });
    return unsub;
  }, [enabled]);

  return statusMap;
}

export function useStatusCounts() {
  const [counts, setCounts] = useState<Record<string, number> | undefined>();
  const enabled = useCacheEnabled('statuses');

  useEffect(() => {
    if (!enabled) { setCounts(undefined); return; }
    const unsub = onSnapshot(collection(db, 'statusEntries'), (snap) => {
      const result: Record<string, number> = {};
      for (const d of snap.docs) {
        const entry = d.data() as StatusEntry;
        if (!entry.endDate) {
          result[entry.status] = (result[entry.status] ?? 0) + 1;
        }
      }
      setCounts(result);
    });
    return unsub;
  }, [enabled]);

  return counts;
}

export function useAllStatusEntries() {
  const [entries, setEntries] = useState<StatusEntry[] | undefined>();
  const enabled = useCacheEnabled('statuses');

  useEffect(() => {
    if (!enabled) { setEntries(undefined); return; }
    const unsub = onSnapshot(collection(db, 'statusEntries'), (snap) => {
      setEntries(snap.docs.map(d => ({ ...d.data(), id: d.id } as StatusEntry)));
    });
    return unsub;
  }, [enabled]);

  return entries;
}

export async function addStatusEntry(
  soldierId: string,
  data: StatusEntryFormData
): Promise<string> {
  const id = generateId();

  // Find open entries to close
  const openSnap = await getDocs(
    query(collection(db, 'statusEntries'), where('soldierId', '==', soldierId))
  );
  const openEntries = openSnap.docs
    .map(d => ({ ...d.data(), id: d.id } as StatusEntry))
    .filter(e => !e.endDate);

  const batch = writeBatch(db);

  // Close previous open statuses
  for (const entry of openEntries) {
    batch.update(doc(db, 'statusEntries', entry.id), { endDate: data.startDate });
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
  batch.set(doc(db, 'statusEntries', id), stripUndefined(statusEntry as unknown as Record<string, unknown>));

  await batch.commit();
  return id;
}

export async function updateStatusEntry(id: string, data: Partial<StatusEntry>): Promise<void> {
  await updateDoc(doc(db, 'statusEntries', id), stripUndefined(data as Record<string, unknown>));
}

export async function deleteStatusEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, 'statusEntries', id));
}
