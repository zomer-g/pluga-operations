import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { EquipmentAssignment, EquipmentType } from '@/db/schema';
import { generateId, todayString } from '@/lib/utils';
import type { EquipmentAssignFormData, EquipmentTypeFormData } from '@/lib/validators';

export function useEquipmentTypes(category?: string) {
  return useLiveQuery(async () => {
    if (category) {
      return db.equipmentTypes.where('category').equals(category).toArray();
    }
    return db.equipmentTypes.orderBy('name').toArray();
  }, [category]);
}

export function useEquipmentAssignments(soldierId?: string) {
  return useLiveQuery(async () => {
    if (soldierId) {
      return db.equipmentAssignments
        .where('soldierId')
        .equals(soldierId)
        .toArray();
    }
    return db.equipmentAssignments.toArray();
  }, [soldierId]);
}

export function useActiveAssignments(soldierId?: string) {
  return useLiveQuery(async () => {
    let assignments: EquipmentAssignment[];
    if (soldierId) {
      assignments = await db.equipmentAssignments
        .where('soldierId')
        .equals(soldierId)
        .toArray();
    } else {
      assignments = await db.equipmentAssignments.toArray();
    }
    return assignments.filter((a) => !a.signedInDate);
  }, [soldierId]);
}

export function useActiveAssignmentCount() {
  return useLiveQuery(async () => {
    const all = await db.equipmentAssignments.toArray();
    return all.filter((a) => !a.signedInDate).length;
  });
}

export async function addEquipmentType(data: EquipmentTypeFormData): Promise<string> {
  const id = generateId();
  const equipType = { id, ...data } as EquipmentType;
  await db.equipmentTypes.add(equipType);
  return id;
}

export async function assignEquipment(
  soldierId: string,
  data: EquipmentAssignFormData
): Promise<string> {
  const id = generateId();
  const assignment: EquipmentAssignment = {
    id,
    soldierId,
    equipmentTypeId: data.equipmentTypeId,
    serialNumber: data.serialNumber || undefined,
    signedOutDate: data.signedOutDate,
    condition: data.condition as EquipmentAssignment['condition'],
    notes: data.notes || undefined,
  };
  await db.equipmentAssignments.add(assignment);
  return id;
}

export async function returnEquipment(
  assignmentId: string,
  condition: string,
  notes?: string
): Promise<void> {
  await db.equipmentAssignments.update(assignmentId, {
    signedInDate: todayString(),
    condition: condition as EquipmentAssignment['condition'],
    notes,
  });
}

export async function deleteEquipmentType(id: string): Promise<void> {
  await db.equipmentTypes.delete(id);
}
