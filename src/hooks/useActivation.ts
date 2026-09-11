import { useMemo } from 'react';
import { useCollection, setDoc, updateDoc, deleteDoc } from '@/lib/datastore';
import type { Activation } from '@/db/schema';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';

export function useActivations() {
  return useCollection<Activation>('activations');
}

export function useCurrentActivation() {
  const all = useCollection<Activation>('activations');

  return useMemo(() => {
    if (!all) return undefined;
    const today = new Date().toISOString().split('T')[0]!;
    // Find activation that covers today, or the most recent one
    const current = all.find(a => a.startDate <= today && a.endDate >= today);
    if (current) return current;
    // Fallback: return the latest activation
    return [...all].sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null;
  }, [all]);
}

export async function addActivation(data: {
  name: string;
  startDate: string;
  endDate: string;
  notes?: string;
}): Promise<string> {
  await requireEditPermission('/soldiers');
  const id = generateId();
  const activation: Activation = { id, ...data };
  await setDoc('activations', id, stripUndefined(activation as unknown as any));
  return id;
}

export async function updateActivation(id: string, data: Partial<Activation>): Promise<void> {
  await requireEditPermission('/soldiers');
  await updateDoc('activations', id, stripUndefined(data as any));
}

export async function deleteActivation(id: string): Promise<void> {
  await requireEditPermission('/soldiers');
  await deleteDoc('activations', id);
}
