import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/firebase';
import type { EquipmentAssignment, EquipmentType } from '@/db/schema';
import { generateId, todayString, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type { EquipmentAssignFormData, EquipmentTypeFormData } from '@/lib/validators';

export function useEquipmentTypes(category?: string) {
  const [types, setTypes] = useState<EquipmentType[] | undefined>();

  useEffect(() => {
    const q = category
      ? query(collection(db, 'equipmentTypes'), where('category', '==', category))
      : query(collection(db, 'equipmentTypes'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setTypes(snap.docs.map(d => ({ ...d.data(), id: d.id } as EquipmentType)));
    });
    return unsub;
  }, [category]);

  return types;
}

export function useEquipmentAssignments(soldierId?: string) {
  const [assignments, setAssignments] = useState<EquipmentAssignment[] | undefined>();

  useEffect(() => {
    const q = soldierId
      ? query(collection(db, 'equipmentAssignments'), where('soldierId', '==', soldierId))
      : query(collection(db, 'equipmentAssignments'));
    const unsub = onSnapshot(q, (snap) => {
      setAssignments(snap.docs.map(d => ({ ...d.data(), id: d.id } as EquipmentAssignment)));
    });
    return unsub;
  }, [soldierId]);

  return assignments;
}

export function useActiveAssignments(soldierId?: string) {
  const [assignments, setAssignments] = useState<EquipmentAssignment[] | undefined>();

  useEffect(() => {
    const q = soldierId
      ? query(collection(db, 'equipmentAssignments'), where('soldierId', '==', soldierId))
      : query(collection(db, 'equipmentAssignments'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as EquipmentAssignment));
      setAssignments(all.filter(a => !a.signedInDate));
    });
    return unsub;
  }, [soldierId]);

  return assignments;
}

export function useActiveAssignmentCount() {
  const [count, setCount] = useState<number | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'equipmentAssignments'), (snap) => {
      const all = snap.docs.map(d => d.data() as EquipmentAssignment);
      setCount(all.filter(a => !a.signedInDate).length);
    });
    return unsub;
  }, []);

  return count;
}

export async function addEquipmentType(data: EquipmentTypeFormData): Promise<string> {
  await requireEditPermission('/equipment');
  const id = generateId();
  const equipType = { id, ...data } as EquipmentType;
  await setDoc(doc(db, 'equipmentTypes', id), equipType);
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
  await setDoc(doc(db, 'equipmentAssignments', id), stripUndefined(assignment as unknown as any));
  return id;
}

export async function returnEquipment(
  assignmentId: string,
  condition: string,
  notes?: string
): Promise<void> {
  await requireEditPermission('/equipment');
  await updateDoc(doc(db, 'equipmentAssignments', assignmentId), stripUndefined({
    signedInDate: todayString(),
    condition: condition as EquipmentAssignment['condition'],
    notes,
  } as any));
}

export async function deleteEquipmentType(id: string): Promise<void> {
  await requireEditPermission('/equipment');
  await deleteDoc(doc(db, 'equipmentTypes', id));
}
