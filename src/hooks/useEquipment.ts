import { useMemo } from 'react';
import { useCollection, setDoc, updateDoc, deleteDoc } from '@/lib/datastore';
import type { EquipmentAssignment, EquipmentType } from '@/db/schema';
import { generateId, todayString, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type { EquipmentAssignFormData, EquipmentTypeFormData } from '@/lib/validators';

export function useEquipmentTypes(category?: string) {
  const all = useCollection<EquipmentType>('equipmentTypes');
  return useMemo(
    () => (category ? all?.filter(t => t.category === category) : all),
    [all, category],
  );
}

export function useEquipmentAssignments(soldierId?: string) {
  const all = useCollection<EquipmentAssignment>('equipmentAssignments');
  return useMemo(
    () => (soldierId ? all?.filter(a => a.soldierId === soldierId) : all),
    [all, soldierId],
  );
}

export function useActiveAssignments(soldierId?: string) {
  const all = useCollection<EquipmentAssignment>('equipmentAssignments');
  return useMemo(
    () => all?.filter(a => !a.signedInDate && (!soldierId || a.soldierId === soldierId)),
    [all, soldierId],
  );
}

export function useActiveAssignmentCount() {
  const all = useCollection<EquipmentAssignment>('equipmentAssignments');
  return useMemo(() => all?.filter(a => !a.signedInDate).length, [all]);
}

export async function addEquipmentType(data: EquipmentTypeFormData): Promise<string> {
  await requireEditPermission('/equipment');
  const id = generateId();
  const equipType = { id, ...data } as EquipmentType;
  await setDoc('equipmentTypes', id, equipType);
  return id;
}

export async function assignEquipment(
  soldierId: string,
  data: EquipmentAssignFormData
): Promise<string> {
  await requireEditPermission('/equipment');
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
  await setDoc('equipmentAssignments', id, stripUndefined(assignment as unknown as any));
  return id;
}

export async function returnEquipment(
  assignmentId: string,
  condition: string,
  notes?: string
): Promise<void> {
  await requireEditPermission('/equipment');
  await updateDoc('equipmentAssignments', assignmentId, stripUndefined({
    signedInDate: todayString(),
    condition: condition as EquipmentAssignment['condition'],
    notes,
  } as any));
}

export async function deleteEquipmentType(id: string): Promise<void> {
  await requireEditPermission('/equipment');
  // Fails (with a message) while sign-out records still reference this type.
  await deleteDoc('equipmentTypes', id);
}
