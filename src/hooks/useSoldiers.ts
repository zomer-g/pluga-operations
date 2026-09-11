import { useMemo } from 'react';
import { useCollection, setDoc, updateDoc, deleteDoc } from '@/lib/datastore';
import type { Soldier, SoldierRank, StatusEntry } from '@/db/schema';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type { SoldierFormData } from '@/lib/validators';

interface SoldierFilters {
  search?: string;
  rank?: SoldierRank;
  platoonId?: string;
  status?: string;
}

export function useSoldiers(filters?: SoldierFilters) {
  const all = useCollection<Soldier>('soldiers');
  const statusEntries = useCollection<StatusEntry>('statusEntries');

  return useMemo(() => {
    if (!all) return undefined;
    let result = all;

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
      if (!statusEntries) return undefined;
      const activeSoldierIds = new Set(
        statusEntries
          .filter(se => se.status === filters.status && !se.endDate)
          .map(se => se.soldierId)
      );
      result = result.filter((s) => activeSoldierIds.has(s.id));
    }

    return result;
  }, [all, statusEntries, filters?.search, filters?.rank, filters?.platoonId, filters?.status]);
}

export function useSoldier(id: string | undefined) {
  const all = useCollection<Soldier>('soldiers');
  return useMemo(() => (id ? all?.find(s => s.id === id) : undefined), [all, id]);
}

export function useSoldierCount() {
  return useCollection<Soldier>('soldiers')?.length;
}

export async function addSoldier(data: SoldierFormData): Promise<string> {
  await requireEditPermission('/soldiers');
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
  await setDoc('soldiers', id, stripUndefined(soldier as unknown as any));
  return id;
}

export async function updateSoldier(id: string, data: SoldierFormData): Promise<void> {
  await requireEditPermission('/soldiers');
  await updateDoc('soldiers', id, stripUndefined({ ...data, email: data.email || undefined, updatedAt: new Date().toISOString() } as any));
}

export async function deleteSoldier(id: string): Promise<void> {
  await requireEditPermission('/soldiers');
  // The database cascades to equipment assignments, status entries, crew
  // assignments, assignments, shampaf entries (and their vacations) and routine crew slots.
  await deleteDoc('soldiers', id);
}
