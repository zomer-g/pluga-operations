import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { generateId, stripUndefined } from '@/lib/utils';
import type { TrainingContent, TrainingTag, TrainingCategory } from '@/db/schema';

// ===== Hooks =====

interface TrainingFilters {
  search?: string;
  tags?: string[];
  category?: string;
}

export function useTrainingContent(filters?: TrainingFilters) {
  const [content, setContent] = useState<TrainingContent[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'trainingContent'), orderBy('updatedAt', 'desc')),
      (snap) => {
        let result = snap.docs.map(d => ({ ...d.data(), id: d.id } as TrainingContent));

        if (filters?.search) {
          const s = filters.search.toLowerCase();
          result = result.filter(c =>
            c.title.toLowerCase().includes(s) ||
            (c.description?.toLowerCase().includes(s)) ||
            c.tags.some(t => t.toLowerCase().includes(s))
          );
        }
        if (filters?.category) {
          result = result.filter(c => c.category === filters.category);
        }
        if (filters?.tags && filters.tags.length > 0) {
          result = result.filter(c =>
            filters.tags!.some(t => c.tags.includes(t))
          );
        }

        setContent(result);
      }
    );
    return unsub;
  }, [filters?.search, filters?.category, filters?.tags?.join(',')]);

  return content;
}

export function useTrainingTags() {
  const [tags, setTags] = useState<TrainingTag[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'trainingTags'), (snap) => {
      setTags(snap.docs.map(d => ({ ...d.data(), id: d.id } as TrainingTag)));
    });
    return unsub;
  }, []);

  return tags;
}

export function useTrainingCategories() {
  const [categories, setCategories] = useState<TrainingCategory[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'trainingCategories'), orderBy('order')),
      (snap) => {
        setCategories(snap.docs.map(d => ({ ...d.data(), id: d.id } as TrainingCategory)));
      }
    );
    return unsub;
  }, []);

  return categories;
}

// ===== Mutations =====

export async function addTrainingContent(data: Omit<TrainingContent, 'id' | 'createdAt' | 'updatedAt'>) {
  const id = generateId();
  const now = new Date().toISOString();
  await setDoc(doc(db, 'trainingContent', id), stripUndefined({
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  }) as any);
  return id;
}

export async function updateTrainingContent(id: string, data: Partial<TrainingContent>) {
  await updateDoc(doc(db, 'trainingContent', id), stripUndefined({
    ...data,
    updatedAt: new Date().toISOString(),
  }) as any);
}

export async function deleteTrainingContent(id: string) {
  await deleteDoc(doc(db, 'trainingContent', id));
}

export async function addTrainingTag(name: string, color?: string) {
  const id = generateId();
  await setDoc(doc(db, 'trainingTags', id), stripUndefined({ id, name, color }) as any);
  return id;
}

export async function deleteTrainingTag(id: string) {
  await deleteDoc(doc(db, 'trainingTags', id));
}

export async function addTrainingCategory(name: string, order: number = 0) {
  const id = generateId();
  await setDoc(doc(db, 'trainingCategories', id), { id, name, order });
  return id;
}

export async function deleteTrainingCategory(id: string) {
  await deleteDoc(doc(db, 'trainingCategories', id));
}
