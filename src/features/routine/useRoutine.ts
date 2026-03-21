import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type { RoutineTemplate, RoutineCrewSlot, RoutineChangeLog, CrewRole } from '@/db/schema';

// ===== Hooks =====

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

export function useRoutineChangeLogs(templateId?: string) {
  const [logs, setLogs] = useState<RoutineChangeLog[] | undefined>();

  useEffect(() => {
    const q = templateId
      ? query(collection(db, 'routineChangeLogs'), where('templateId', '==', templateId), orderBy('timestamp', 'desc'))
      : query(collection(db, 'routineChangeLogs'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ ...d.data(), id: d.id } as RoutineChangeLog)));
    });
    return unsub;
  }, [templateId]);

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

// ===== Mutations =====

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

  // Clean up change logs for this template
  const logsSnap = await getDocs(query(collection(db, 'routineChangeLogs'), where('templateId', '==', id)));
  logsSnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
}

/**
 * Assign a soldier to a role in a routine template.
 * Removes any previous soldier from that role.
 */
export async function assignRoutineSlot(
  templateId: string,
  role: CrewRole | 'fifth',
  soldierId: string,
  soldierName: string,
) {
  await requireEditPermission('/routine');

  // Get current template
  const { getDoc: getDocFn } = await import('firebase/firestore');
  const snap = await getDocFn(doc(db, 'routineTemplates', templateId));
  if (!snap.exists()) return;

  const template = snap.data() as RoutineTemplate;
  const crewSlots = [...(template.crewSlots ?? [])];

  // Remove existing soldier in this role
  const existingIdx = crewSlots.findIndex(s => s.role === role);
  if (existingIdx >= 0) {
    crewSlots.splice(existingIdx, 1);
  }

  // Add new slot (skip for 'fifth' which has no CrewRole)
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

/**
 * Unassign a soldier from a role in a routine template.
 */
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
