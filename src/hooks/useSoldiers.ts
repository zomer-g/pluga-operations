import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Soldier, SoldierRank } from '@/db/schema';
import { generateId } from '@/lib/utils';
import type { SoldierFormData } from '@/lib/validators';

interface SoldierFilters {
  search?: string;
  rank?: SoldierRank;
  platoonId?: string;
  status?: string;
}

export function useSoldiers(filters?: SoldierFilters) {
  return useLiveQuery(async () => {
    let soldiers = await db.soldiers.orderBy('lastName').toArray();

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      soldiers = soldiers.filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.militaryId.includes(q) ||
          s.phoneNumber.includes(q)
      );
    }

    if (filters?.rank) {
      soldiers = soldiers.filter((s) => s.rank === filters.rank);
    }

    if (filters?.platoonId) {
      soldiers = soldiers.filter((s) => s.platoonId === filters.platoonId);
    }

    if (filters?.status) {
      const activeStatuses = await db.statusEntries
        .where('status')
        .equals(filters.status)
        .filter((se) => !se.endDate)
        .toArray();
      const activeSoldierIds = new Set(activeStatuses.map((se) => se.soldierId));
      soldiers = soldiers.filter((s) => activeSoldierIds.has(s.id));
    }

    return soldiers;
  }, [filters?.search, filters?.rank, filters?.platoonId, filters?.status]);
}

export function useSoldier(id: string | undefined) {
  return useLiveQuery(
    () => (id ? db.soldiers.get(id) : undefined),
    [id]
  );
}

export function useSoldierCount() {
  return useLiveQuery(() => db.soldiers.count());
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
  await db.soldiers.add(soldier);
  return id;
}

export async function updateSoldier(id: string, data: SoldierFormData): Promise<void> {
  await db.soldiers.update(id, { ...data, email: data.email || undefined, updatedAt: new Date().toISOString() } as Partial<Soldier>);
}

export async function deleteSoldier(id: string): Promise<void> {
  await db.transaction('rw', db.soldiers, db.equipmentAssignments, db.statusEntries, db.tankCrewAssignments, async () => {
    await db.soldiers.delete(id);
    await db.equipmentAssignments.where('soldierId').equals(id).delete();
    await db.statusEntries.where('soldierId').equals(id).delete();
    await db.tankCrewAssignments.where('soldierId').equals(id).delete();
  });
}
