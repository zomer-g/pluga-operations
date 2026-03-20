import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Soldier, SoldierRank } from '@/db/schema';
import { generateId, stripUndefined } from '@/lib/utils';
import type { SoldierFormData } from '@/lib/validators';

interface SoldierFilters {
  search?: string;
  rank?: SoldierRank;
  platoonId?: string;
  status?: string;
}

export function useSoldiers(filters?: SoldierFilters) {
  const [soldiers, setSoldiers] = useState<Soldier[] | undefined>();

  useEffect(() => {
    const q = query(collection(db, 'soldiers'), orderBy('lastName'));
    const unsub = onSnapshot(q, async (snap) => {
      let result = snap.docs.map(d => ({ ...d.data(), id: d.id } as Soldier));

      if (filters?.search) {
        const searchQ = filters.search.toLowerCase();
        result = result.filter(
          (s) =>
            s.firstName.toLowerCase().includes(searchQ) ||
            s.lastName.toLowerCase().includes(searchQ) ||
            (s.militaryId || '').includes(searchQ) ||
            (s.phoneNumber || '').includes(searchQ)
        );
      }

      if (filters?.rank) {
        result = result.filter((s) => s.rank === filters.rank);
      }

      if (filters?.platoonId) {
        result = result.filter((s) => s.platoonId === filters.platoonId);
      }

      if (filters?.status) {
        const statusSnap = await getDocs(
          query(collection(db, 'statusEntries'), where('status', '==', filters.status))
        );
        const activeSoldierIds = new Set(
          statusSnap.docs
            .map(d => d.data() as { soldierId: string; endDate?: string })
            .filter(se => !se.endDate)
            .map(se => se.soldierId)
        );
        result = result.filter((s) => activeSoldierIds.has(s.id));
      }

      setSoldiers(result);
    });
    return unsub;
  }, [filters?.search, filters?.rank, filters?.platoonId, filters?.status]);

  return soldiers;
}

export function useSoldier(id: string | undefined) {
  const [soldier, setSoldier] = useState<Soldier | undefined>();

  useEffect(() => {
    if (!id) {
      setSoldier(undefined);
      return;
    }
    const unsub = onSnapshot(doc(db, 'soldiers', id), (snap) => {
      if (snap.exists()) {
        setSoldier({ ...snap.data(), id: snap.id } as Soldier);
      } else {
        setSoldier(undefined);
      }
    });
    return unsub;
  }, [id]);

  return soldier;
}

export function useSoldierCount() {
  const [count, setCount] = useState<number | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'soldiers'), (snap) => {
      setCount(snap.size);
    });
    return unsub;
  }, []);

  return count;
}

export async function addSoldier(data: SoldierFormData): Promise<string> {
  const now = new Date().toISOString();
  const id = generateId();
  const soldier: Soldier = {
    id,
    ...data,
    rank: data.rank as Soldier['rank'],
    bloodType: data.bloodType as Soldier['bloodType'],
    uniformSizeTop: data.uniformSizeTop as Soldier['uniformSizeTop'],
    uniformSizeBottom: data.uniformSizeBottom as Soldier['uniformSizeBottom'],
    email: data.email || undefined,
    trainedRole: (data.trainedRole || undefined) as Soldier['trainedRole'],
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, 'soldiers', id), stripUndefined(soldier as unknown as any));
  return id;
}

export async function updateSoldier(id: string, data: SoldierFormData): Promise<void> {
  await updateDoc(doc(db, 'soldiers', id), stripUndefined({ ...data, email: data.email || undefined, updatedAt: new Date().toISOString() } as any));
}

export async function deleteSoldier(id: string): Promise<void> {
  const batch = writeBatch(db);

  // Delete soldier
  batch.delete(doc(db, 'soldiers', id));

  // Cascade: delete equipment assignments
  const eqSnap = await getDocs(query(collection(db, 'equipmentAssignments'), where('soldierId', '==', id)));
  eqSnap.docs.forEach(d => batch.delete(d.ref));

  // Cascade: delete status entries
  const seSnap = await getDocs(query(collection(db, 'statusEntries'), where('soldierId', '==', id)));
  seSnap.docs.forEach(d => batch.delete(d.ref));

  // Cascade: delete tank crew assignments
  const tcSnap = await getDocs(query(collection(db, 'tankCrewAssignments'), where('soldierId', '==', id)));
  tcSnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
}
