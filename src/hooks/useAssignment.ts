import { useMemo } from 'react';
import { useCollection, getCollection, setDoc, updateDoc, deleteDoc, writeBatch } from '@/lib/datastore';
import type { Assignment, CrewRole, ShampafEntry, ShampafVacation, Soldier } from '@/db/schema';
import { generateId, dateRangesOverlap, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import { getSoldierShampafStatusAt } from './useShampaf';

// ===== Queries =====

interface AssignmentFilters {
  soldierId?: string;
  tankId?: string;
  startDate?: string;
  endDate?: string;
}

export function useAssignments(filters?: AssignmentFilters) {
  const all = useCollection<Assignment>('assignments');

  return useMemo(() => {
    if (!all) return undefined;
    let results = all;

    if (filters?.soldierId) {
      results = results.filter(a => a.soldierId === filters.soldierId);
    }
    if (filters?.tankId) {
      results = results.filter(a => a.tankId === filters.tankId);
    }
    if (filters?.startDate && filters?.endDate) {
      results = results.filter(a =>
        dateRangesOverlap(a.startDateTime, a.endDateTime, filters.startDate!, filters.endDate!)
      );
    }

    return results;
  }, [all, filters?.soldierId, filters?.tankId, filters?.startDate, filters?.endDate]);
}

export function useTankAssignmentsAt(tankId: string | undefined, dateTime?: string) {
  const all = useCollection<Assignment>('assignments');

  return useMemo(() => {
    if (!tankId) return [];
    if (!all) return undefined;
    const now = dateTime ?? new Date().toISOString();
    return all.filter(a => a.tankId === tankId && a.startDateTime <= now && a.endDateTime >= now);
  }, [all, tankId, dateTime]);
}

export type ConflictType = 'no_shampaf' | 'on_vacation' | 'overlapping_assignment';

export function useAssignmentConflicts() {
  const assignments = useCollection<Assignment>('assignments');
  const allShampafEntries = useCollection<ShampafEntry>('shampafEntries');
  const allVacations = useCollection<ShampafVacation>('shampafVacations');

  return useMemo(() => {
    if (!assignments || !allShampafEntries || !allVacations) return undefined;

    const now = new Date().toISOString();
    const activeAssignments = assignments.filter(a => a.endDateTime >= now);
    const result = new Map<string, ConflictType[]>();

    for (const a of activeAssignments) {
      const types: ConflictType[] = [];

      // Check overlapping assignments (same soldier, different assignment, overlapping dates)
      const overlapping = activeAssignments.find(other =>
        other.id !== a.id &&
        other.soldierId === a.soldierId &&
        dateRangesOverlap(a.startDateTime, a.endDateTime, other.startDateTime, other.endDateTime)
      );
      if (overlapping) types.push('overlapping_assignment');

      const covering = allShampafEntries.find(e =>
        e.soldierId === a.soldierId &&
        e.startDateTime <= a.startDateTime && e.endDateTime >= a.endDateTime
      );

      if (!covering) {
        types.push('no_shampaf');
        result.set(a.id, types);
        continue;
      }

      const onVacation = allVacations.some(v =>
        v.shampafEntryId === covering.id &&
        dateRangesOverlap(v.startDateTime, v.endDateTime, a.startDateTime, a.endDateTime)
      );

      if (onVacation) types.push('on_vacation');

      if (types.length > 0) result.set(a.id, types);
    }

    return result;
  }, [assignments, allShampafEntries, allVacations]);
}

// ===== Mutations =====

interface AddAssignmentResult {
  id: string;
  warnings: string[];
}

export async function addAssignment(data: {
  soldierId: string;
  type: 'tank_role' | 'general_mission';
  tankId?: string;
  role?: CrewRole;
  missionName?: string;
  startDateTime: string;
  endDateTime: string;
  notes?: string;
}): Promise<AddAssignmentResult> {
  await requireEditPermission('/assignments');
  const warnings: string[] = [];

  // Check role constraints
  if (data.type === 'tank_role' && data.role) {
    const soldier = (await getCollection<Soldier>('soldiers', { fresh: false })).find(s => s.id === data.soldierId);
    if (soldier?.trainedRole && soldier.trainedRole !== 'commander' && soldier.trainedRole !== data.role) {
      warnings.push(`החייל מאומן כ${soldier.trainedRole} ושובץ כ${data.role}`);
    }
  }

  // Check shampaf status
  const shampafStatus = await getSoldierShampafStatusAt(data.soldierId, data.startDateTime, data.endDateTime);
  if (!shampafStatus.covered) {
    warnings.push('לחייל אין שמ"פ פעיל בתקופה זו');
  } else if (shampafStatus.onVacation) {
    warnings.push('החייל בחופשה בתקופה זו');
  }

  const id = generateId();
  const assignment: Assignment = {
    id,
    soldierId: data.soldierId,
    type: data.type,
    tankId: data.tankId,
    role: data.role,
    missionName: data.missionName,
    startDateTime: data.startDateTime,
    endDateTime: data.endDateTime,
    notes: data.notes,
  };
  await setDoc('assignments', id, stripUndefined(assignment as unknown as any));

  return { id, warnings };
}

export async function updateAssignment(id: string, data: Partial<Assignment>): Promise<void> {
  await requireEditPermission('/assignments');
  await updateDoc('assignments', id, stripUndefined(data as any));
}

export async function deleteAssignment(id: string): Promise<void> {
  await requireEditPermission('/assignments');
  await deleteDoc('assignments', id);
}

// ===== Batch Operations =====

export interface SoldierConflict {
  soldierId: string;
  type: 'overlapping_assignment' | 'no_shampaf' | 'on_vacation';
  message: string;
  existingAssignmentId?: string;
  existingAssignment?: Assignment;
}

export async function checkBatchConflicts(
  soldierIds: string[],
  startDT: string,
  endDT: string,
): Promise<SoldierConflict[]> {
  const conflicts: SoldierConflict[] = [];

  // Fetch all data once
  const [allAssignments, allShampaf, allVacations] = await Promise.all([
    getCollection<Assignment>('assignments'),
    getCollection<ShampafEntry>('shampafEntries'),
    getCollection<ShampafVacation>('shampafVacations'),
  ]);

  for (const soldierId of soldierIds) {
    // Check overlapping assignments
    const overlapping = allAssignments.find(a =>
      a.soldierId === soldierId &&
      dateRangesOverlap(a.startDateTime, a.endDateTime, startDT, endDT)
    );
    if (overlapping) {
      conflicts.push({
        soldierId,
        type: 'overlapping_assignment',
        message: `משובץ ${overlapping.tankId ? `לטנק` : overlapping.missionName ?? 'למשימה'} (${overlapping.startDateTime.slice(0, 10)} - ${overlapping.endDateTime.slice(0, 10)})`,
        existingAssignmentId: overlapping.id,
        existingAssignment: overlapping,
      });
    }

    // Check shampaf
    const covering = allShampaf.find(e =>
      e.soldierId === soldierId &&
      e.startDateTime <= startDT && e.endDateTime >= endDT
    );
    if (!covering) {
      conflicts.push({
        soldierId,
        type: 'no_shampaf',
        message: 'לחייל אין שמ"פ פעיל בתקופה זו',
      });
      continue;
    }

    const onVacation = allVacations.some(v =>
      v.shampafEntryId === covering.id &&
      dateRangesOverlap(v.startDateTime, v.endDateTime, startDT, endDT)
    );
    if (onVacation) {
      conflicts.push({
        soldierId,
        type: 'on_vacation',
        message: 'החייל בחופשה בתקופה זו',
      });
    }
  }

  return conflicts;
}

export async function addAssignmentsBatch(
  assignments: Omit<Assignment, 'id'>[],
  deleteIds?: string[],
): Promise<{ ids: string[] }> {
  await requireEditPermission('/assignments');
  const batch = writeBatch();
  const ids: string[] = [];

  for (const did of deleteIds ?? []) {
    batch.delete('assignments', did);
  }

  for (const a of assignments) {
    const id = generateId();
    ids.push(id);
    const assignment: Assignment = { ...a, id } as Assignment;
    batch.set('assignments', id, stripUndefined(assignment as any));
  }

  await batch.commit();
  return { ids };
}
