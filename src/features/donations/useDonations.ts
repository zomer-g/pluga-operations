import { useMemo } from 'react';
import { useCollection, setDoc, updateDoc, deleteDoc } from '@/lib/datastore';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireEditPermission } from '@/lib/check-permission';
import type { Donation, DonationType } from '@/db/schema';

interface DonationFilters {
  type?: DonationType;
  startDate?: string;
  endDate?: string;
}

export function useDonations(filters?: DonationFilters) {
  const all = useCollection<Donation>('donations');

  return useMemo(() => {
    if (!all) return undefined;
    let result = all;

    if (filters?.type) {
      result = result.filter(d => d.type === filters.type);
    }
    if (filters?.startDate) {
      result = result.filter(d => d.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      result = result.filter(d => d.date <= filters.endDate!);
    }

    return result;
  }, [all, filters?.type, filters?.startDate, filters?.endDate]);
}

export function useDonationStats(donations: Donation[] | undefined) {
  return useMemo(() => {
    if (!donations) return undefined;

    const totalMonetary = donations
      .filter(d => d.type === 'monetary')
      .reduce((sum, d) => sum + (d.amount ?? 0), 0);

    const countByType: Record<string, number> = {};
    for (const d of donations) {
      countByType[d.type] = (countByType[d.type] ?? 0) + 1;
    }

    const uniqueDonors = new Set(donations.map(d => d.donorName)).size;

    return { totalMonetary, countByType, uniqueDonors, total: donations.length };
  }, [donations]);
}

// ===== Mutations =====

export async function addDonation(data: Omit<Donation, 'id' | 'createdAt'>) {
  await requireEditPermission('/donations');
  const id = generateId();
  await setDoc('donations', id, stripUndefined({
    ...data,
    id,
    createdAt: new Date().toISOString(),
  }));
  return id;
}

export async function updateDonation(id: string, data: Partial<Donation>) {
  await requireEditPermission('/donations');
  await updateDoc('donations', id, stripUndefined(data));
}

export async function deleteDonation(id: string) {
  await requireEditPermission('/donations');
  await deleteDoc('donations', id);
}
