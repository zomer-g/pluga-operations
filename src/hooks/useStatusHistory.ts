import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import type { StatusEntry, SoldierStatus } from '@/db/schema';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type { StatusEntryFormData } from '@/lib/validators';

export function useStatusHistory(soldierId?: string) {
  const [entries, setEntries] = useState<StatusEntry[] | undefined>();

  useEffect(() => {
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
  }, [soldierId]);

  return entries;
}

export function useCurrentStatus(soldierId?: string) {
  const [status, setStatus] = useState<StatusEntry | undefined>();

  useEffect(() => {
    if (!soldierId) {
      setStatus(undefined);
      return;
    }
    const q = query(collection(db, 'statusEntries'), where('soldierId', '==', soldierId));
    const unsub = onSnapshot(q, (snap) => {
      const entries = snap.docs.map(d => ({ ...d.data(), id: d.id } as StatusEntry));
      setStatus(entries.find(e => !e.endDate));
    });
    return unsub;
  }, [soldierId]);

  return status;
}

export function useAllCurrentStatuses() {
  const [statusMap, setStatusMap] = useState<Map<string, StatusEntry> | undefined>();

  useEffect(() => {
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
  }, []);

  return statusMap;
}

export function useStatusCounts() {
  const [counts, setCounts] = useState<Record<string, number> | undefined>();

  useEffect(() => {
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
  }, []);

  return counts;
}

export function useAllStatusEntries() {
  const [entries, setEntries] = useState<StatusEntry[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'statusEntries'), (snap) => {
      setEntries(snap.docs.map(d => ({ ...d.data(), id: d.id } as StatusEntry)));
    });
    return unsub;
  }, []);

  return entries;
}

export async function addStatusEntry(
  soldierId: string,
  data: StatusEntryFormData
): Promise<string> {
  await requireEditPermission('/soldiers');
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
  batch.set(doc(db, 'statusEntries', id), stripUndefined(statusEntry as unknown as any));

  await batch.commit();
  return id;
}

export async function updateStatusEntry(id: string, data: Partial<StatusEntry>): Promise<void> {
  await requireEditPermission('/soldiers');
  await updateDoc(doc(db, 'statusEntries', id), stripUndefined(data as any));
}

export async function deleteStatusEntry(id: string): Promise<void> {
  await requireEditPermission('/soldiers');
  await deleteDoc(doc(db, 'statusEntries', id));
}
