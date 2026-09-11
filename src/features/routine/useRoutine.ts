import { useMemo } from 'react';
import { useCollection, getCollection, setDoc, updateDoc, deleteDoc, writeBatch } from '@/lib/datastore';
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
  const all = useCollection<RoutineDepartment>('routineDepartments');
  return useMemo(() => all && [...all].sort((a, b) => a.order - b.order), [all]);
}

export async function addRoutineDepartment(name: string, order: number = 0): Promise<string> {
  await requireEditPermission('/routine');
  const id = generateId();
  await setDoc('routineDepartments', id, { id, name, order });
  return id;
}

export async function updateRoutineDepartment(id: string, data: { name?: string; order?: number }): Promise<void> {
  await requireEditPermission('/routine');
  await updateDoc('routineDepartments', id, stripUndefined(data as any));
}

export async function deleteRoutineDepartment(id: string): Promise<void> {
  await requireEditPermission('/routine');
  // Vehicles in this department keep existing; the database clears their departmentId.
  await deleteDoc('routineDepartments', id);
}

// ===== Routine Vehicles =====

export function useRoutineVehicles() {
  return useCollection<RoutineVehicle>('routineVehicles');
}

export async function addRoutineVehicle(data: {
  designation: string;
  vehicleCategory: VehicleCategory;
  departmentId?: string;
}): Promise<string> {
  await requireEditPermission('/routine');
  const id = generateId();
  await setDoc('routineVehicles', id, stripUndefined({ ...data, id }));
  return id;
}

export async function updateRoutineVehicle(id: string, data: { designation?: string; departmentId?: string }): Promise<void> {
  await requireEditPermission('/routine');
  await updateDoc('routineVehicles', id, stripUndefined(data as any));
}

export async function deleteRoutineVehicle(id: string): Promise<void> {
  await requireEditPermission('/routine');
  // The server removes the vehicle's templates and their change logs with it.
  await deleteDoc('routineVehicles', id);
}

// ===== Routine Templates =====

export function useRoutineTemplates() {
  return useCollection<RoutineTemplate>('routineTemplates');
}

export function useRoutineChangeLogs() {
  const all = useCollection<RoutineChangeLog>('routineChangeLogs');
  return useMemo(() => all && [...all].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [all]);
}

// ===== Change log helper =====

/** The server stamps changedBy / changedByName / timestamp from the session. */
function logChangeOp(data: Omit<RoutineChangeLog, 'id' | 'changedBy' | 'changedByName' | 'timestamp'>) {
  return { collection: 'routineChangeLogs' as const, id: generateId(), data: stripUndefined(data) };
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
  const batch = writeBatch();
  batch.set('routineTemplates', id, stripUndefined({
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  }));
  const log = logChangeOp({ templateId: id, action: 'create' });
  batch.set(log.collection, log.id, log.data);
  await batch.commit();
  return id;
}

export async function updateRoutineTemplate(id: string, data: Partial<RoutineTemplate>) {
  await requireEditPermission('/routine');
  await updateDoc('routineTemplates', id, stripUndefined({
    ...data,
    updatedAt: new Date().toISOString(),
  }));
}

export async function deleteRoutineTemplate(id: string) {
  await requireEditPermission('/routine');
  // The server drops the template's change logs together with it.
  await deleteDoc('routineTemplates', id);
}

async function getTemplate(templateId: string): Promise<RoutineTemplate | undefined> {
  return (await getCollection<RoutineTemplate>('routineTemplates')).find(t => t.id === templateId);
}

export async function assignRoutineSlot(
  templateId: string,
  role: CrewRole | 'fifth',
  soldierId: string,
  soldierName: string,
) {
  await requireEditPermission('/routine');

  const template = await getTemplate(templateId);
  if (!template) return;

  const crewSlots = [...(template.crewSlots ?? [])];

  if (role !== 'fifth') {
    // For named roles (tank), replace existing assignment for that role
    const existingIdx = crewSlots.findIndex(s => s.role === role);
    if (existingIdx >= 0) {
      crewSlots.splice(existingIdx, 1);
    }
    crewSlots.push({ role: role as CrewRole, soldierId });
  } else {
    // For standard vehicle, just add as crew member
    crewSlots.push({ role: 'driver' as CrewRole, soldierId });
  }

  const batch = writeBatch();
  batch.update('routineTemplates', templateId, {
    crewSlots,
    updatedAt: new Date().toISOString(),
  });
  const log = logChangeOp({
    templateId,
    action: 'assign',
    role: role === 'fifth' ? undefined : role as CrewRole,
    soldierId,
    soldierName,
  });
  batch.set(log.collection, log.id, log.data);
  await batch.commit();
}

export async function unassignRoutineSlot(
  templateId: string,
  role: CrewRole,
  soldierId: string,
  soldierName: string,
) {
  await requireEditPermission('/routine');

  const template = await getTemplate(templateId);
  if (!template) return;

  const crewSlots = (template.crewSlots ?? []).filter(
    s => !(s.role === role && s.soldierId === soldierId)
  );

  const batch = writeBatch();
  batch.update('routineTemplates', templateId, {
    crewSlots,
    updatedAt: new Date().toISOString(),
  });
  const log = logChangeOp({
    templateId,
    action: 'unassign',
    role,
    soldierId,
    soldierName,
  });
  batch.set(log.collection, log.id, log.data);
  await batch.commit();
}
