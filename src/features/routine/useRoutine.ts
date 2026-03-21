import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type { RoutineTemplate, RoutineCrewSlot } from '@/db/schema';
import { addAssignment } from '@/hooks/useAssignment';

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

export function useRoutineTemplate(id: string | undefined) {
  const [template, setTemplate] = useState<RoutineTemplate | undefined>();

  useEffect(() => {
    if (!id) { setTemplate(undefined); return; }
    const unsub = onSnapshot(doc(db, 'routineTemplates', id), (snap) => {
      if (snap.exists()) {
        setTemplate({ ...snap.data(), id: snap.id } as RoutineTemplate);
      } else {
        setTemplate(undefined);
      }
    });
    return unsub;
  }, [id]);

  return template;
}

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
  await deleteDoc(doc(db, 'routineTemplates', id));
}

/**
 * Apply a routine template to create real assignments for a date range.
 * Returns array of warnings from conflict detection.
 */
export async function applyRoutineToAssignments(
  templateId: string,
  startDateTime: string,
  endDateTime: string
): Promise<string[]> {
  await requireEditPermission('/routine');
  const snap = await getDoc(doc(db, 'routineTemplates', templateId));
  if (!snap.exists()) throw new Error('Template not found');

  const template = snap.data() as RoutineTemplate;
  const allWarnings: string[] = [];

  for (const slot of template.crewSlots) {
    const result = await addAssignment({
      soldierId: slot.soldierId,
      type: 'tank_role',
      tankId: template.tankId,
      role: slot.role,
      startDateTime,
      endDateTime,
    });
    allWarnings.push(...result.warnings);
  }

  return allWarnings;
}
