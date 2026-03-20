import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Activation } from '@/db/schema';
import { generateId, stripUndefined } from '@/lib/utils';
import { useCacheEnabled } from '@/stores/useAppStore';

export function useActivations() {
  const [activations, setActivations] = useState<Activation[] | undefined>();
  const enabled = useCacheEnabled('activations');

  useEffect(() => {
    if (!enabled) { setActivations(undefined); return; }
    const unsub = onSnapshot(collection(db, 'activations'), (snap) => {
      setActivations(snap.docs.map(d => ({ ...d.data(), id: d.id } as Activation)));
    });
    return unsub;
  }, [enabled]);

  return activations;
}

export function useCurrentActivation() {
  const [activation, setActivation] = useState<Activation | null | undefined>();
  const enabled = useCacheEnabled('activations');

  useEffect(() => {
    if (!enabled) { setActivation(undefined); return; }
    const unsub = onSnapshot(collection(db, 'activations'), (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as Activation));
      const today = new Date().toISOString().split('T')[0]!;
      // Find activation that covers today, or the most recent one
      const current = all.find(a => a.startDate <= today && a.endDate >= today);
      if (current) {
        setActivation(current);
      } else {
        // Fallback: return the latest activation
        setActivation(all.sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null);
      }
    });
    return unsub;
  }, [enabled]);

  return activation;
}

export async function addActivation(data: {
  name: string;
  startDate: string;
  endDate: string;
  notes?: string;
}): Promise<string> {
  const id = generateId();
  const activation: Activation = { id, ...data };
  await setDoc(doc(db, 'activations', id), stripUndefined(activation as unknown as Record<string, unknown>));
  return id;
}

export async function updateActivation(id: string, data: Partial<Activation>): Promise<void> {
  await updateDoc(doc(db, 'activations', id), stripUndefined(data as Record<string, unknown>));
}

export async function deleteActivation(id: string): Promise<void> {
  await deleteDoc(doc(db, 'activations', id));
}
