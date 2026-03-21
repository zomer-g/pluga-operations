import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Tank, TankCrewAssignment, CrewRole, Department } from '@/db/schema';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type { TankFormData, CrewAssignFormData } from '@/lib/validators';

export function useTanks(platoonId?: string) {
  const [tanks, setTanks] = useState<Tank[] | undefined>();

  useEffect(() => {
    const q = platoonId
      ? query(collection(db, 'tanks'), where('platoonId', '==', platoonId))
      : query(collection(db, 'tanks'), orderBy('designation'));
    const unsub = onSnapshot(q, (snap) => {
      setTanks(snap.docs.map(d => ({ ...d.data(), id: d.id } as Tank)));
    });
    return unsub;
  }, [platoonId]);

  return tanks;
}

export function useTank(id: string | undefined) {
  const [tank, setTank] = useState<Tank | undefined>();

  useEffect(() => {
    if (!id) {
      setTank(undefined);
      return;
    }
    const unsub = onSnapshot(doc(db, 'tanks', id), (snap) => {
      if (snap.exists()) {
        setTank({ ...snap.data(), id: snap.id } as Tank);
      } else {
        setTank(undefined);
      }
    });
    return unsub;
  }, [id]);

  return tank;
}

export function useTankCount() {
  const [counts, setCounts] = useState<{ total: number; operational: number } | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tanks'), (snap) => {
      const tanks = snap.docs.map(d => d.data() as Tank);
      setCounts({
        total: tanks.length,
        operational: tanks.filter(t => t.status === 'operational').length,
      });
    });
    return unsub;
  }, []);

  return counts;
}

export function useTankCrew(tankId: string | undefined) {
  const [crew, setCrew] = useState<TankCrewAssignment[] | undefined>();

  useEffect(() => {
    if (!tankId) {
      setCrew([]);
      return;
    }
    const q = query(collection(db, 'tankCrewAssignments'), where('tankId', '==', tankId));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as TankCrewAssignment));
      setCrew(all.filter(a => !a.endDate));
    });
    return unsub;
  }, [tankId]);

  return crew;
}

export function useSoldierCrewAssignment(soldierId: string | undefined) {
  const [assignment, setAssignment] = useState<TankCrewAssignment | undefined>();

  useEffect(() => {
    if (!soldierId) {
      setAssignment(undefined);
      return;
    }
    const q = query(collection(db, 'tankCrewAssignments'), where('soldierId', '==', soldierId));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as TankCrewAssignment));
      setAssignment(all.find(a => !a.endDate));
    });
    return unsub;
  }, [soldierId]);

  return assignment;
}

export function useAllCrewAssignments() {
  const [assignments, setAssignments] = useState<TankCrewAssignment[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tankCrewAssignments'), (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as TankCrewAssignment));
      setAssignments(all.filter(a => !a.endDate));
    });
    return unsub;
  }, []);

  return assignments;
}

export async function addTank(data: TankFormData): Promise<string> {
  await requireEditPermission('/assignments');
  const id = generateId();
  const tank: Tank = {
    id,
    designation: data.designation,
    type: data.type,
    platoonId: data.platoonId || undefined,
    departmentId: data.departmentId || undefined,
    status: data.status as Tank['status'],
    notes: data.notes || undefined,
  };
  await setDoc(doc(db, 'tanks', id), stripUndefined(tank as unknown as any));
  return id;
}

export async function updateTank(id: string, data: TankFormData): Promise<void> {
  await requireEditPermission('/assignments');
  await updateDoc(doc(db, 'tanks', id), stripUndefined({ ...data, platoonId: data.platoonId || undefined, notes: data.notes || undefined } as any));
}

export async function deleteTank(id: string): Promise<void> {
  await requireEditPermission('/assignments');
  const batch = writeBatch(db);

  batch.delete(doc(db, 'tanks', id));

  // Cascade: delete crew assignments for this tank
  const crewSnap = await getDocs(query(collection(db, 'tankCrewAssignments'), where('tankId', '==', id)));
  crewSnap.docs.forEach(d => batch.delete(d.ref));

  // Cascade: delete assignments referencing this tank
  const assignSnap = await getDocs(query(collection(db, 'assignments'), where('tankId', '==', id)));
  assignSnap.docs.forEach(d => batch.delete(d.ref));

  // Cascade: delete routine templates for this tank
  const routineSnap = await getDocs(query(collection(db, 'routineTemplates'), where('tankId', '==', id)));
  routineSnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
}

export async function assignCrew(
  tankId: string,
  data: CrewAssignFormData
): Promise<string> {
  await requireEditPermission('/assignments');
  const id = generateId();
  const batch = writeBatch(db);

  // Remove soldier from any existing crew
  const existingSnap = await getDocs(
    query(collection(db, 'tankCrewAssignments'), where('soldierId', '==', data.soldierId))
  );
  for (const d of existingSnap.docs) {
    const a = d.data() as TankCrewAssignment;
    if (!a.endDate) {
      batch.update(d.ref, { endDate: data.startDate });
    }
  }

  // Remove anyone currently in this role on this tank
  const roleSnap = await getDocs(
    query(collection(db, 'tankCrewAssignments'), where('tankId', '==', tankId))
  );
  for (const d of roleSnap.docs) {
    const a = d.data() as TankCrewAssignment;
    if (!a.endDate && a.role === data.role) {
      batch.update(d.ref, { endDate: data.startDate });
    }
  }

  // Add new assignment
  const assignment: TankCrewAssignment = {
    id,
    tankId,
    soldierId: data.soldierId,
    role: data.role as CrewRole,
    startDate: data.startDate,
  };
  batch.set(doc(db, 'tankCrewAssignments', id), stripUndefined(assignment as unknown as any));

  await batch.commit();
  return id;
}

export async function unassignCrew(assignmentId: string): Promise<void> {
  await requireEditPermission('/assignments');
  await updateDoc(doc(db, 'tankCrewAssignments', assignmentId), {
    endDate: new Date().toISOString().split('T')[0],
  });
}

export function usePlatoons() {
  const [platoons, setPlatoons] = useState<{ id: string; name: string; number: number }[] | undefined>();

  useEffect(() => {
    const q = query(collection(db, 'platoons'), orderBy('number'));
    const unsub = onSnapshot(q, (snap) => {
      setPlatoons(snap.docs.map(d => ({ ...d.data(), id: d.id } as { id: string; name: string; number: number })));
    });
    return unsub;
  }, []);

  return platoons;
}

export async function addPlatoon(name: string, number: number): Promise<string> {
  await requireEditPermission('/settings');
  const id = generateId();
  await setDoc(doc(db, 'platoons', id), { id, name, number });
  return id;
}

export async function deletePlatoon(id: string): Promise<void> {
  await requireEditPermission('/settings');
  await deleteDoc(doc(db, 'platoons', id));
}

// ===== Departments (מחלקות) =====

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[] | undefined>();

  useEffect(() => {
    const q = query(collection(db, 'departments'), orderBy('order'));
    const unsub = onSnapshot(q, (snap) => {
      setDepartments(snap.docs.map(d => ({ ...d.data(), id: d.id } as Department)));
    });
    return unsub;
  }, []);

  return departments;
}

export async function addDepartment(name: string, order: number = 0): Promise<string> {
  await requireEditPermission('/assignments');
  const id = generateId();
  await setDoc(doc(db, 'departments', id), { id, name, order });
  return id;
}

export async function updateDepartment(id: string, data: { name?: string; order?: number }): Promise<void> {
  await requireEditPermission('/assignments');
  await updateDoc(doc(db, 'departments', id), stripUndefined(data as any));
}

export async function deleteDepartment(id: string): Promise<void> {
  await requireEditPermission('/assignments');
  await deleteDoc(doc(db, 'departments', id));
}

export async function setTankDepartment(tankId: string, departmentId: string | undefined): Promise<void> {
  await requireEditPermission('/assignments');
  if (departmentId) {
    await updateDoc(doc(db, 'tanks', tankId), { departmentId });
  } else {
    await updateDoc(doc(db, 'tanks', tankId), { departmentId: '' });
  }
}
