import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Activation } from '@/db/schema';
import { generateId } from '@/lib/utils';

export function useActivations() {
  return useLiveQuery(() => db.activations.toArray());
}

export function useCurrentActivation() {
  return useLiveQuery(async () => {
    const all = await db.activations.toArray();
    const today = new Date().toISOString().split('T')[0]!;
    // Find activation that covers today, or the most recent one
    const current = all.find(a => a.startDate <= today && a.endDate >= today);
    if (current) return current;
    // Fallback: return the latest activation
    return all.sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null;
  });
}

export async function addActivation(data: {
  name: string;
  startDate: string;
  endDate: string;
  notes?: string;
}): Promise<string> {
  const id = generateId();
  const activation: Activation = { id, ...data };
  await db.activations.add(activation);
  return id;
}

export async function updateActivation(id: string, data: Partial<Activation>): Promise<void> {
  await db.activations.update(id, data);
}

export async function deleteActivation(id: string): Promise<void> {
  await db.activations.delete(id);
}
