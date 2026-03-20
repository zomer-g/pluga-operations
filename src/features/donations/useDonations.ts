import { useState, useEffect, useMemo } from 'react';
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
import type { Donation, DonationType } from '@/db/schema';

interface DonationFilters {
  type?: DonationType;
  startDate?: string;
  endDate?: string;
}

export function useDonations(filters?: DonationFilters) {
  const [donations, setDonations] = useState<Donation[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'donations'), orderBy('date', 'desc')),
      (snap) => {
        let result = snap.docs.map(d => ({ ...d.data(), id: d.id } as Donation));

        if (filters?.type) {
          result = result.filter(d => d.type === filters.type);
        }
        if (filters?.startDate) {
          result = result.filter(d => d.date >= filters.startDate!);
        }
        if (filters?.endDate) {
          result = result.filter(d => d.date <= filters.endDate!);
        }

        setDonations(result);
      }
    );
    return unsub;
  }, [filters?.type, filters?.startDate, filters?.endDate]);

  return donations;
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
  const id = generateId();
  await setDoc(doc(db, 'donations', id), stripUndefined({
    ...data,
    id,
    createdAt: new Date().toISOString(),
  }) as any);
  return id;
}

export async function updateDonation(id: string, data: Partial<Donation>) {
  await updateDoc(doc(db, 'donations', id), stripUndefined(data) as any);
}

export async function deleteDonation(id: string) {
  await deleteDoc(doc(db, 'donations', id));
}
