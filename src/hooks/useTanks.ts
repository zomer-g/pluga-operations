import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Tank, TankCrewAssignment, CrewRole } from '@/db/schema';
import { generateId } from '@/lib/utils';
import type { TankFormData, CrewAssignFormData } from '@/lib/validators';

export function useTanks(platoonId?: string) {
  return useLiveQuery(async () => {
    if (platoonId) {
      return db.tanks.where('platoonId').equals(platoonId).toArray();
    }
    return db.tanks.orderBy('designation').toArray();
  }, [platoonId]);
}

export function useTank(id: string | undefined) {
  return useLiveQuery(() => (id ? db.tanks.get(id) : undefined), [id]);
}

export function useTankCount() {
  return useLiveQuery(async () => {
    const tanks = await db.tanks.toArray();
    return {
      total: tanks.length,
      operational: tanks.filter((t) => t.status === 'operational').length,
    };
  });
}

export function useTankCrew(tankId: string | undefined) {
  return useLiveQuery(async () => {
    if (!tankId) return [];
    const assignments = await db.tankCrewAssignments
      .where('tankId')
      .equals(tankId)
      .toArray();
    return assignments.filter((a) => !a.endDate);
  }, [tankId]);
}

export function useSoldierCrewAssignment(soldierId: string | undefined) {
  return useLiveQuery(async () => {
    if (!soldierId) return undefined;
    const assignments = await db.tankCrewAssignments
      .where('soldierId')
      .equals(soldierId)
      .toArray();
    return assignments.find((a) => !a.endDate);
  }, [soldierId]);
}

export function useAllCrewAssignments() {
  return useLiveQuery(async () => {
    const all = await db.tankCrewAssignments.toArray();
    return all.filter((a) => !a.endDate);
  });
}

export async function addTank(data: TankFormData): Promise<string> {
  const id = generateId();
  const tank: Tank = {
    id,
    designation: data.designation,
    type: data.type,
    platoonId: data.platoonId || undefined,
    status: data.status as Tank['status'],
    notes: data.notes || undefined,
  };
  await db.tanks.add(tank);
  return id;
}

export async function updateTank(id: string, data: TankFormData): Promise<void> {
  await db.tanks.update(id, { ...data, platoonId: data.platoonId || undefined, notes: data.notes || undefined } as Partial<Tank>);
}

export async function deleteTank(id: string): Promise<void> {
  await db.transaction('rw', db.tanks, db.tankCrewAssignments, async () => {
    await db.tanks.delete(id);
    await db.tankCrewAssignments.where('tankId').equals(id).delete();
  });
}

export async function assignCrew(
  tankId: string,
  data: CrewAssignFormData
): Promise<string> {
  const id = generateId();

  await db.transaction('rw', db.tankCrewAssignments, async () => {
    // Remove soldier from any existing crew
    const existing = await db.tankCrewAssignments
      .where('soldierId')
      .equals(data.soldierId)
      .filter((a) => !a.endDate)
      .toArray();
    for (const a of existing) {
      await db.tankCrewAssignments.update(a.id, { endDate: data.startDate });
    }

    // Remove anyone currently in this role on this tank
    const roleConflict = await db.tankCrewAssignments
      .where('tankId')
      .equals(tankId)
      .filter((a) => !a.endDate && a.role === data.role)
      .toArray();
    for (const a of roleConflict) {
      await db.tankCrewAssignments.update(a.id, { endDate: data.startDate });
    }

    const assignment: TankCrewAssignment = {
      id,
      tankId,
      soldierId: data.soldierId,
      role: data.role as CrewRole,
      startDate: data.startDate,
    };
    await db.tankCrewAssignments.add(assignment);
  });

  return id;
}

export async function unassignCrew(assignmentId: string): Promise<void> {
  await db.tankCrewAssignments.update(assignmentId, {
    endDate: new Date().toISOString().split('T')[0],
  });
}

export function usePlatoons() {
  return useLiveQuery(() => db.platoons.orderBy('number').toArray());
}

export async function addPlatoon(name: string, number: number): Promise<string> {
  const id = generateId();
  await db.platoons.add({ id, name, number });
  return id;
}

export async function deletePlatoon(id: string): Promise<void> {
  await db.platoons.delete(id);
}
