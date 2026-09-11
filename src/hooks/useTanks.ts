import { useMemo } from 'react';
import { useCollection, getCollection, setDoc, updateDoc, deleteDoc, writeBatch } from '@/lib/datastore';
import type { Tank, TankCrewAssignment, CrewRole, Department, Platoon } from '@/db/schema';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type { TankFormData, CrewAssignFormData } from '@/lib/validators';

export function useTanks(platoonId?: string) {
  const all = useCollection<Tank>('tanks');
  return useMemo(
    () => (platoonId ? all?.filter(t => t.platoonId === platoonId) : all),
    [all, platoonId],
  );
}

export function useTank(id: string | undefined) {
  const all = useCollection<Tank>('tanks');
  return useMemo(() => (id ? all?.find(t => t.id === id) : undefined), [all, id]);
}

export function useTankCount() {
  const all = useCollection<Tank>('tanks');
  return useMemo(
    () => all && { total: all.length, operational: all.filter(t => t.status === 'operational').length },
    [all],
  );
}

export function useTankCrew(tankId: string | undefined) {
  const all = useCollection<TankCrewAssignment>('tankCrewAssignments');
  return useMemo(() => {
    if (!tankId) return [];
    return all?.filter(a => a.tankId === tankId && !a.endDate);
  }, [all, tankId]);
}

export function useSoldierCrewAssignment(soldierId: string | undefined) {
  const all = useCollection<TankCrewAssignment>('tankCrewAssignments');
  return useMemo(
    () => (soldierId ? all?.find(a => a.soldierId === soldierId && !a.endDate) : undefined),
    [all, soldierId],
  );
}

export function useAllCrewAssignments() {
  const all = useCollection<TankCrewAssignment>('tankCrewAssignments');
  return useMemo(() => all?.filter(a => !a.endDate), [all]);
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
  await setDoc('tanks', id, stripUndefined(tank as unknown as any));
  return id;
}

export async function updateTank(id: string, data: Partial<TankFormData>): Promise<void> {
  await requireEditPermission('/assignments');
  await updateDoc('tanks', id, stripUndefined(data as any));
}

export async function deleteTank(id: string): Promise<void> {
  await requireEditPermission('/assignments');
  // The database cascades to crew assignments and assignments for this tank.
  await deleteDoc('tanks', id);
}

export async function assignCrew(
  tankId: string,
  data: CrewAssignFormData
): Promise<string> {
  await requireEditPermission('/assignments');
  const id = generateId();
  const batch = writeBatch();
  const crew = await getCollection<TankCrewAssignment>('tankCrewAssignments');

  for (const a of crew) {
    if (a.endDate) continue;
    // Remove soldier from any existing crew, and anyone currently in this role on this tank
    if (a.soldierId === data.soldierId || (a.tankId === tankId && a.role === data.role)) {
      batch.update('tankCrewAssignments', a.id, { endDate: data.startDate });
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
  batch.set('tankCrewAssignments', id, stripUndefined(assignment as unknown as any));

  await batch.commit();
  return id;
}

export async function unassignCrew(assignmentId: string): Promise<void> {
  await requireEditPermission('/assignments');
  await updateDoc('tankCrewAssignments', assignmentId, {
    endDate: new Date().toISOString().split('T')[0],
  });
}

export function usePlatoons() {
  return useCollection<Platoon>('platoons');
}

export async function addPlatoon(name: string, number: number): Promise<string> {
  await requireEditPermission('/settings');
  const id = generateId();
  await setDoc('platoons', id, { id, name, number });
  return id;
}

export async function deletePlatoon(id: string): Promise<void> {
  await requireEditPermission('/settings');
  await deleteDoc('platoons', id);
}

// ===== Departments (מחלקות) =====

export function useDepartments() {
  return useCollection<Department>('departments');
}

export async function addDepartment(name: string, order: number = 0): Promise<string> {
  await requireEditPermission('/assignments');
  const id = generateId();
  await setDoc('departments', id, { id, name, order });
  return id;
}

export async function updateDepartment(id: string, data: { name?: string; order?: number }): Promise<void> {
  await requireEditPermission('/assignments');
  await updateDoc('departments', id, stripUndefined(data as any));
}

export async function deleteDepartment(id: string): Promise<void> {
  await requireEditPermission('/assignments');
  await deleteDoc('departments', id);
}

export async function setTankDepartment(tankId: string, departmentId: string | undefined): Promise<void> {
  await requireEditPermission('/assignments');
  await updateDoc('tanks', tankId, { departmentId: departmentId || '' });
}
