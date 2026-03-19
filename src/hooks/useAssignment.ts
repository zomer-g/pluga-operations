import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Assignment, CrewRole } from '@/db/schema';
import { generateId, dateRangesOverlap } from '@/lib/utils';
import { getSoldierShampafStatusAt } from './useShampaf';

// ===== Queries =====

interface AssignmentFilters {
  soldierId?: string;
  tankId?: string;
  startDate?: string;
  endDate?: string;
}

export function useAssignments(filters?: AssignmentFilters) {
  return useLiveQuery(async () => {
    let results = await db.assignments.toArray();

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
  }, [filters?.soldierId, filters?.tankId, filters?.startDate, filters?.endDate]);
}

export function useTankAssignmentsAt(tankId: string | undefined, dateTime?: string) {
  return useLiveQuery(async () => {
    if (!tankId) return [];
    const now = dateTime ?? new Date().toISOString();
    const all = await db.assignments
      .where('tankId')
      .equals(tankId)
      .toArray();
    return all.filter(a => a.startDateTime <= now && a.endDateTime >= now);
  }, [tankId, dateTime]);
}

export type ConflictType = 'no_shampaf' | 'on_vacation';

export function useAssignmentConflicts() {
  return useLiveQuery(async () => {
    const assignments = await db.assignments.toArray();
    const now = new Date().toISOString();
    const activeAssignments = assignments.filter(a => a.endDateTime >= now);

    const conflicts = new Map<string, ConflictType[]>();

    for (const a of activeAssignments) {
      const shampafEntries = await db.shampafEntries
        .where('soldierId')
        .equals(a.soldierId)
        .toArray();

      const covering = shampafEntries.find(e =>
        e.startDateTime <= a.startDateTime && e.endDateTime >= a.endDateTime
      );

      if (!covering) {
        conflicts.set(a.id, ['no_shampaf']);
        continue;
      }

      const vacations = await db.shampafVacations
        .where('shampafEntryId')
        .equals(covering.id)
        .toArray();

      const onVacation = vacations.some(v =>
        dateRangesOverlap(v.startDateTime, v.endDateTime, a.startDateTime, a.endDateTime)
      );

      if (onVacation) {
        conflicts.set(a.id, ['on_vacation']);
      }
    }

    return conflicts;
  });
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
  const warnings: string[] = [];

  // Check role constraints
  if (data.type === 'tank_role' && data.role) {
    const soldier = await db.soldiers.get(data.soldierId);
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
  await db.assignments.add(assignment);

  return { id, warnings };
}

export async function updateAssignment(id: string, data: Partial<Assignment>): Promise<void> {
  await db.assignments.update(id, data);
}

export async function deleteAssignment(id: string): Promise<void> {
  await db.assignments.delete(id);
}
