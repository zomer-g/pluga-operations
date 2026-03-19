import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/firebase';
import type { EquipmentAssignment, EquipmentType } from '@/db/schema';
import { generateId, todayString } from '@/lib/utils';
import type { EquipmentAssignFormData, EquipmentTypeFormData } from '@/lib/validators';
import { useCacheEnabled } from '@/stores/useAppStore';

export function useEquipmentTypes(category?: string) {
  const [types, setTypes] = useState<EquipmentType[] | undefined>();
  const enabled = useCacheEnabled('equipment');

  useEffect(() => {
    if (!enabled) { setTypes(undefined); return; }
    const q = category
      ? query(collection(db, 'equipmentTypes'), where('category', '==', category))
      : query(collection(db, 'equipmentTypes'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setTypes(snap.docs.map(d => ({ ...d.data(), id: d.id } as EquipmentType)));
    });
    return unsub;
  }, [enabled, category]);

  return types;
}

export function useEquipmentAssignments(soldierId?: string) {
  const [assignments, setAssignments] = useState<EquipmentAssignment[] | undefined>();
  const enabled = useCacheEnabled('equipment');

  useEffect(() => {
    if (!enabled) { setAssignments(undefined); return; }
    const q = soldierId
      ? query(collection(db, 'equipmentAssignments'), where('soldierId', '==', soldierId))
      : query(collection(db, 'equipmentAssignments'));
    const unsub = onSnapshot(q, (snap) => {
      setAssignments(snap.docs.map(d => ({ ...d.data(), id: d.id } as EquipmentAssignment)));
    });
    return unsub;
  }, [enabled, soldierId]);

  return assignments;
}

export function useActiveAssignments(soldierId?: string) {
  const [assignments, setAssignments] = useState<EquipmentAssignment[] | undefined>();
  const enabled = useCacheEnabled('equipment');

  useEffect(() => {
    if (!enabled) { setAssignments(undefined); return; }
    const q = soldierId
      ? query(collection(db, 'equipmentAssignments'), where('soldierId', '==', soldierId))
      : query(collection(db, 'equipmentAssignments'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as EquipmentAssignment));
      setAssignments(all.filter(a => !a.signedInDate));
    });
    return unsub;
  }, [enabled, soldierId]);

  return assignments;
}

export function useActiveAssignmentCount() {
  const [count, setCount] = useState<number | undefined>();
  const enabled = useCacheEnabled('equipment');

  useEffect(() => {
    if (!enabled) { setCount(undefined); return; }
    const unsub = onSnapshot(collection(db, 'equipmentAssignments'), (snap) => {
      const all = snap.docs.map(d => d.data() as EquipmentAssignment);
      setCount(all.filter(a => !a.signedInDate).length);
    });
    return unsub;
  }, [enabled]);

  return count;
}

export async function addEquipmentType(data: EquipmentTypeFormData): Promise<string> {
  const id = generateId();
  const equipType = { id, ...data } as EquipmentType;
  await setDoc(doc(db, 'equipmentTypes', id), equipType);
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
  await setDoc(doc(db, 'equipmentAssignments', id), assignment);
  return id;
}

export async function returnEquipment(
  assignmentId: string,
  condition: string,
  notes?: string
): Promise<void> {
  await updateDoc(doc(db, 'equipmentAssignments', assignmentId), {
    signedInDate: todayString(),
    condition: condition as EquipmentAssignment['condition'],
    notes,
  });
}

export async function deleteEquipmentType(id: string): Promise<void> {
  await deleteDoc(doc(db, 'equipmentTypes', id));
}
