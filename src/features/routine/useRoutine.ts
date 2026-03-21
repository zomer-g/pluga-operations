import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type {
  RoutineTemplate,
  RoutineCrewSlot,
  RoutineChangeLog,
  RoutineDepartment,
  RoutineVehicle,
  VehicleCategory,
  CrewRole,
} from '@/db/schema';

// ===== Routine Departments =====

export function useRoutineDepartments() {
  const [departments, setDepartments] = useState<RoutineDepartment[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'routineDepartments'), (snap) => {
      const result = snap.docs.map(d => ({ ...d.data(), id: d.id } as RoutineDepartment));
      result.sort((a, b) => a.order - b.order);
      setDepartments(result);
    });
    return unsub;
  }, []);

  return departments;
}

export async function addRoutineDepartment(name: string, order: number = 0): Promise<string> {
  await requireEditPermission('/routine');
  const id = generateId();
  await setDoc(doc(db, 'routineDepartments', id), { id, name, order });
  return id;
}

export async function deleteRoutineDepartment(id: string): Promise<void> {
  await requireEditPermission('/routine');
  const batch = writeBatch(db);
  batch.delete(doc(db, 'routineDepartments', id));
  // Clear departmentId from vehicles in this department
  const vehicleSnap = await getDocs(query(collection(db, 'routineVehicles'), where('departmentId', '==', id)));
  for (const d of vehicleSnap.docs) {
    batch.update(d.ref, { departmentId: '' });
  }
  await batch.commit();
}

// ===== Routine Vehicles =====

export function useRoutineVehicles() {
  const [vehicles, setVehicles] = useState<RoutineVehicle[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'routineVehicles'), (snap) => {
      setVehicles(snap.docs.map(d => ({ ...d.data(), id: d.id } as RoutineVehicle)));
    });
    return unsub;
  }, []);

  return vehicles;
}

export async function addRoutineVehicle(data: {
  designation: string;
  vehicleCategory: VehicleCategory;
  departmentId?: string;
}): Promise<string> {
  await requireEditPermission('/routine');
  const id = generateId();
  await setDoc(doc(db, 'routineVehicles', id), stripUndefined({ ...data, id }) as any);
  return id;
}

export async function deleteRoutineVehicle(id: string): Promise<void> {
  await requireEditPermission('/routine');
  const batch = writeBatch(db);
  batch.delete(doc(db, 'routineVehicles', id));
  // Delete routine templates for this vehicle
  const tmplSnap = await getDocs(query(collection(db, 'routineTemplates'), where('tankId', '==', id)));
  for (const d of tmplSnap.docs) {
    batch.delete(d.ref);
  }
  // Delete change logs for those templates
  for (const d of tmplSnap.docs) {
    const logSnap = await getDocs(query(collection(db, 'routineChangeLogs'), where('templateId', '==', d.id)));
    logSnap.docs.forEach(l => batch.delete(l.ref));
  }
  await batch.commit();
}

// ===== Routine Templates =====

export function useRoutineTemplates() {
  const [templates, setTemplates] = useState<RoutineTemplate[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'routineTemplates'), (snap) => {
      setTemplates(snap.docs.map(d => ({ ...d.data(), id: d.id } as RoutineTemplate)));
    });
    return unsub;
  }, []);

  return templates;
}

export function useRoutineChangeLogs() {
  const [logs, setLogs] = useState<RoutineChangeLog[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'routineChangeLogs'), (snap) => {
      const result = snap.docs.map(d => ({ ...d.data(), id: d.id } as RoutineChangeLog));
      result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setLogs(result);
    });
    return unsub;
  }, []);

  return logs;
}

// ===== Change log helper =====

async function logChange(data: Omit<RoutineChangeLog, 'id' | 'changedBy' | 'changedByName' | 'timestamp'>) {
  const user = auth.currentUser;
  const id = generateId();
  const log: RoutineChangeLog = {
    ...data,
    id,
    changedBy: user?.uid ?? 'unknown',
    changedByName: user?.displayName ?? 'unknown',
    timestamp: new Date().toISOString(),
  };
  await setDoc(doc(db, 'routineChangeLogs', id), stripUndefined(log as unknown as any));
}

// ===== Template Mutations =====

export async function addRoutineTemplate(data: {
  name: string;
  tankId: string;
  crewSlots: RoutineCrewSlot[];
  notes?: string;
}) {
  await requireEditPermission('/routine');
  const id = generateId();
  const now = new Date().toISOString();
  await setDoc(doc(db, 'routineTemplates', id), stripUndefined({
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  }) as any);

  await logChange({ templateId: id, action: 'create' });
  return id;
}

export async function updateRoutineTemplate(id: string, data: Partial<RoutineTemplate>) {
  await requireEditPermission('/routine');
  await updateDoc(doc(db, 'routineTemplates', id), stripUndefined({
    ...data,
    updatedAt: new Date().toISOString(),
  }) as any);
}

export async function deleteRoutineTemplate(id: string) {
  await requireEditPermission('/routine');

  await logChange({ templateId: id, action: 'delete' });

  const batch = writeBatch(db);
  batch.delete(doc(db, 'routineTemplates', id));

  const logsSnap = await getDocs(query(collection(db, 'routineChangeLogs'), where('templateId', '==', id)));
  logsSnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
}

export async function assignRoutineSlot(
  templateId: string,
  role: CrewRole | 'fifth',
  soldierId: string,
  soldierName: string,
) {
  await requireEditPermission('/routine');

  const { getDoc: getDocFn } = await import('firebase/firestore');
  const snap = await getDocFn(doc(db, 'routineTemplates', templateId));
  if (!snap.exists()) return;

  const template = snap.data() as RoutineTemplate;
  const crewSlots = [...(template.crewSlots ?? [])];

  const existingIdx = crewSlots.findIndex(s => s.role === role);
  if (existingIdx >= 0) {
    crewSlots.splice(existingIdx, 1);
  }

  if (role !== 'fifth') {
    crewSlots.push({ role: role as CrewRole, soldierId });
  }

  await updateDoc(doc(db, 'routineTemplates', templateId), {
    crewSlots,
    updatedAt: new Date().toISOString(),
  });

  await logChange({
    templateId,
    action: 'assign',
    role: role === 'fifth' ? undefined : role as CrewRole,
    soldierId,
    soldierName,
  });
}

export async function unassignRoutineSlot(
  templateId: string,
  role: CrewRole,
  soldierId: string,
  soldierName: string,
) {
  await requireEditPermission('/routine');

  const { getDoc: getDocFn } = await import('firebase/firestore');
  const snap = await getDocFn(doc(db, 'routineTemplates', templateId));
  if (!snap.exists()) return;

  const template = snap.data() as RoutineTemplate;
  const crewSlots = (template.crewSlots ?? []).filter(
    s => !(s.role === role && s.soldierId === soldierId)
  );

  await updateDoc(doc(db, 'routineTemplates', templateId), {
    crewSlots,
    updatedAt: new Date().toISOString(),
  });

  await logChange({
    templateId,
    action: 'unassign',
    role,
    soldierId,
    soldierName,
  });
}
