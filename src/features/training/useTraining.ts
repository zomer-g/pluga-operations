import { useMemo } from 'react';
import { useCollection, setDoc, updateDoc, deleteDoc } from '@/lib/datastore';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type { TrainingContent, TrainingTag, TrainingCategory } from '@/db/schema';

// ===== Hooks =====

interface TrainingFilters {
  search?: string;
  tags?: string[];
  category?: string;
}

export function useTrainingContent(filters?: TrainingFilters) {
  const all = useCollection<TrainingContent>('trainingContent');
  const tagsKey = filters?.tags?.join(',');

  return useMemo(() => {
    if (!all) return undefined;
    let result = all;

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

    return result;
  }, [all, filters?.search, filters?.category, tagsKey]);
}

export function useTrainingTags() {
  return useCollection<TrainingTag>('trainingTags');
}

export function useTrainingCategories() {
  return useCollection<TrainingCategory>('trainingCategories');
}

// ===== Mutations =====

export async function addTrainingContent(data: Omit<TrainingContent, 'id' | 'createdAt' | 'updatedAt'>) {
  await requireEditPermission('/training');
  const id = generateId();
  const now = new Date().toISOString();
  await setDoc('trainingContent', id, stripUndefined({
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  }));
  return id;
}

export async function updateTrainingContent(id: string, data: Partial<TrainingContent>) {
  await requireEditPermission('/training');
  await updateDoc('trainingContent', id, stripUndefined({
    ...data,
    updatedAt: new Date().toISOString(),
  }));
}

export async function deleteTrainingContent(id: string) {
  await requireEditPermission('/training');
  await deleteDoc('trainingContent', id);
}

export async function addTrainingTag(name: string, color?: string) {
  await requireEditPermission('/training');
  const id = generateId();
  await setDoc('trainingTags', id, stripUndefined({ id, name, color }));
  return id;
}

export async function deleteTrainingTag(id: string) {
  await requireEditPermission('/training');
  await deleteDoc('trainingTags', id);
}

export async function addTrainingCategory(name: string, order: number = 0) {
  await requireEditPermission('/training');
  const id = generateId();
  await setDoc('trainingCategories', id, { id, name, order });
  return id;
}

export async function deleteTrainingCategory(id: string) {
  await requireEditPermission('/training');
  await deleteDoc('trainingCategories', id);
}
