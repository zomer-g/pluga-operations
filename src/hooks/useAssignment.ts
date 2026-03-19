import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs, where, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Assignment, CrewRole, ShampafEntry, ShampafVacation } from '@/db/schema';
import { generateId, dateRangesOverlap } from '@/lib/utils';
import { getSoldierShampafStatusAt } from './useShampaf';
import { useCacheEnabled } from '@/stores/useAppStore';

// ===== Queries =====

interface AssignmentFilters {
  soldierId?: string;
  tankId?: string;
  startDate?: string;
  endDate?: string;
}

export function useAssignments(filters?: AssignmentFilters) {
  const [assignments, setAssignments] = useState<Assignment[] | undefined>();
  const enabled = useCacheEnabled('assignments');

  useEffect(() => {
    if (!enabled) { setAssignments(undefined); return; }
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
  }, [enabled, filters?.soldierId, filters?.tankId, filters?.startDate, filters?.endDate]);

  return assignments;
}

export function useTankAssignmentsAt(tankId: string | undefined, dateTime?: string) {
  const [assignments, setAssignments] = useState<Assignment[] | undefined>();
  const enabled = useCacheEnabled('assignments');

  useEffect(() => {
    if (!enabled) { setAssignments(undefined); return; }
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
  }, [enabled, tankId, dateTime]);

  return assignments;
}

export type ConflictType = 'no_shampaf' | 'on_vacation';

export function useAssignmentConflicts() {
  const [conflicts, setConflicts] = useState<Map<string, ConflictType[]> | undefined>();
  const enabled = useCacheEnabled('assignments');

  useEffect(() => {
    if (!enabled) { setConflicts(undefined); return; }
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
        const soldierEntries = allShampafEntries.filter(e => e.soldierId === a.soldierId);

        const covering = soldierEntries.find(e =>
          e.startDateTime <= a.startDateTime && e.endDateTime >= a.endDateTime
        );

        if (!covering) {
          result.set(a.id, ['no_shampaf']);
          continue;
        }

        const entryVacations = allVacations.filter(v => v.shampafEntryId === covering.id);
        const onVacation = entryVacations.some(v =>
          dateRangesOverlap(v.startDateTime, v.endDateTime, a.startDateTime, a.endDateTime)
        );

        if (onVacation) {
          result.set(a.id, ['on_vacation']);
        }
      }

      setConflicts(result);
    });
    return unsub;
  }, [enabled]);

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
  await setDoc(doc(db, 'assignments', id), assignment);

  return { id, warnings };
}

export async function updateAssignment(id: string, data: Partial<Assignment>): Promise<void> {
  await updateDoc(doc(db, 'assignments', id), data);
}

export async function deleteAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'assignments', id));
}
