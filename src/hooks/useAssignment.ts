import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs, where, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Assignment, CrewRole, ShampafEntry, ShampafVacation } from '@/db/schema';
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
  const [assignments, setAssignments] = useState<Assignment[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'assignments'), (snap) => {
      let results = snap.docs.map(d => ({ ...d.data(), id: d.id } as Assignment));

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

      setAssignments(results);
    });
    return unsub;
  }, [filters?.soldierId, filters?.tankId, filters?.startDate, filters?.endDate]);

  return assignments;
}

export function useTankAssignmentsAt(tankId: string | undefined, dateTime?: string) {
  const [assignments, setAssignments] = useState<Assignment[] | undefined>();

  useEffect(() => {
    if (!tankId) {
      setAssignments([]);
      return;
    }
    const q = query(collection(db, 'assignments'), where('tankId', '==', tankId));
    const unsub = onSnapshot(q, (snap) => {
      const now = dateTime ?? new Date().toISOString();
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as Assignment));
      setAssignments(all.filter(a => a.startDateTime <= now && a.endDateTime >= now));
    });
    return unsub;
  }, [tankId, dateTime]);

  return assignments;
}

export type ConflictType = 'no_shampaf' | 'on_vacation' | 'overlapping_assignment';

export function useAssignmentConflicts() {
  const [conflicts, setConflicts] = useState<Map<string, ConflictType[]> | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'assignments'), async (snap) => {
      const assignments = snap.docs.map(d => ({ ...d.data(), id: d.id } as Assignment));
      const now = new Date().toISOString();
      const activeAssignments = assignments.filter(a => a.endDateTime >= now);

      const result = new Map<string, ConflictType[]>();

      // Get all shampaf entries and vacations for batch processing
      const shampafSnap = await getDocs(collection(db, 'shampafEntries'));
      const allShampafEntries = shampafSnap.docs.map(d => ({ ...d.data(), id: d.id } as ShampafEntry));

      const vacSnap = await getDocs(collection(db, 'shampafVacations'));
      const allVacations = vacSnap.docs.map(d => d.data() as ShampafVacation);

      for (const a of activeAssignments) {
        const types: ConflictType[] = [];

        // Check overlapping assignments (same soldier, different assignment, overlapping dates)
        const overlapping = activeAssignments.find(other =>
          other.id !== a.id &&
          other.soldierId === a.soldierId &&
          dateRangesOverlap(a.startDateTime, a.endDateTime, other.startDateTime, other.endDateTime)
        );
        if (overlapping) types.push('overlapping_assignment');

        const soldierEntries = allShampafEntries.filter(e => e.soldierId === a.soldierId);

        const covering = soldierEntries.find(e =>
          e.startDateTime <= a.startDateTime && e.endDateTime >= a.endDateTime
        );

        if (!covering) {
          types.push('no_shampaf');
          result.set(a.id, types);
          continue;
        }

        const entryVacations = allVacations.filter(v => v.shampafEntryId === covering.id);
        const onVacation = entryVacations.some(v =>
          dateRangesOverlap(v.startDateTime, v.endDateTime, a.startDateTime, a.endDateTime)
        );

        if (onVacation) types.push('on_vacation');

        if (types.length > 0) result.set(a.id, types);
      }

      setConflicts(result);
    });
    return unsub;
  }, []);

  return conflicts;
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
    const soldierSnap = await getDoc(doc(db, 'soldiers', data.soldierId));
    if (soldierSnap.exists()) {
      const soldier = soldierSnap.data() as { trainedRole?: string };
      if (soldier.trainedRole && soldier.trainedRole !== 'commander' && soldier.trainedRole !== data.role) {
        warnings.push(`החייל מאומן כ${soldier.trainedRole} ושובץ כ${data.role}`);
      }
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
  await setDoc(doc(db, 'assignments', id), stripUndefined(assignment as unknown as any));

  return { id, warnings };
}

export async function updateAssignment(id: string, data: Partial<Assignment>): Promise<void> {
  await requireEditPermission('/assignments');
  await updateDoc(doc(db, 'assignments', id), stripUndefined(data as any));
}

export async function deleteAssignment(id: string): Promise<void> {
  await requireEditPermission('/assignments');
  await deleteDoc(doc(db, 'assignments', id));
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
  const [assignSnap, shampafSnap, vacSnap] = await Promise.all([
    getDocs(collection(db, 'assignments')),
    getDocs(collection(db, 'shampafEntries')),
    getDocs(collection(db, 'shampafVacations')),
  ]);

  const allAssignments = assignSnap.docs.map(d => ({ ...d.data(), id: d.id } as Assignment));
  const allShampaf = shampafSnap.docs.map(d => ({ ...d.data(), id: d.id } as ShampafEntry));
  const allVacations = vacSnap.docs.map(d => d.data() as ShampafVacation);

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
    const soldierEntries = allShampaf.filter(e => e.soldierId === soldierId);
    const covering = soldierEntries.find(e =>
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

    const entryVacations = allVacations.filter(v => v.shampafEntryId === covering.id);
    const onVacation = entryVacations.some(v =>
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
  const batch = writeBatch(db);
  const ids: string[] = [];

  if (deleteIds) {
    for (const did of deleteIds) {
      batch.delete(doc(db, 'assignments', did));
    }
  }

  for (const a of assignments) {
    const id = generateId();
    ids.push(id);
    const assignment: Assignment = { ...a, id } as Assignment;
    batch.set(doc(db, 'assignments', id), stripUndefined(assignment as any));
  }

  await batch.commit();
  return { ids };
}
