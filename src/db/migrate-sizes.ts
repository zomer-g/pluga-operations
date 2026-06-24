import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import { requireAdminPermission } from '@/lib/check-permission';

interface CsvSoldierItems {
  personalId: string;
  uniformsB: string;
  overalls: string;
  underwear: string;
  shoes: string;
  cigarettes: string;
}

function parseCsvRow(row: string): CsvSoldierItems | null {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i]!;
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);

  const personalId = fields[1]?.trim() ?? '';
  if (!personalId) return null;

  const personalItemsRaw = fields[8] ?? '';
  if (!personalItemsRaw || personalItemsRaw === '""') return null;

  try {
    const items = JSON.parse(personalItemsRaw);
    return {
      personalId,
      uniformsB: items.uniformsB ?? '',
      overalls: items.overalls ?? '',
      underwear: items.underwear ?? '',
      shoes: items.shoes ?? '',
      cigarettes: items.cigarettes ?? '',
    };
  } catch {
    return null;
  }
}

function parseCsv(csvContent: string): CsvSoldierItems[] {
  const lines = csvContent.split('\n');
  const results: CsvSoldierItems[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const parsed = parseCsvRow(line);
    if (parsed) results.push(parsed);
  }
  return results;
}

export interface MigrationResult {
  updated: number;
  skipped: number;
  notFound: string[];
  details: string[];
}

export async function migrateSizesFromCsv(csvContent: string): Promise<MigrationResult> {
  await requireAdminPermission('/settings');

  const csvSoldiers = parseCsv(csvContent);
  const result: MigrationResult = { updated: 0, skipped: 0, notFound: [], details: [] };

  const snap = await getDocs(collection(db, 'soldiers'));
  const soldiersByMilitaryId = new Map<string, { docId: string; data: Record<string, unknown> }>();
  for (const d of snap.docs) {
    const data = d.data();
    const mid = data.militaryId as string | undefined;
    if (mid) soldiersByMilitaryId.set(mid, { docId: d.id, data });
  }

  interface UpdateEntry { docId: string; personalItems: Record<string, string>; name: string }
  const updates: UpdateEntry[] = [];

  for (const csv of csvSoldiers) {
    const match = soldiersByMilitaryId.get(csv.personalId);
    if (!match) {
      result.notFound.push(csv.personalId);
      continue;
    }

    const existing = (match.data.personalItems ?? {}) as Record<string, string>;
    const personalItems: Record<string, string> = { ...existing };
    let changed = false;

    for (const key of ['uniformsB', 'overalls', 'underwear', 'shoes', 'cigarettes'] as const) {
      const val = csv[key].trim();
      if (val && !existing[key]) {
        personalItems[key] = val;
        changed = true;
      }
    }

    if (!changed) {
      result.skipped++;
      continue;
    }

    const name = `${match.data.firstName ?? ''} ${match.data.lastName ?? ''}`.trim();
    updates.push({ docId: match.docId, personalItems, name });
  }

  for (let i = 0; i < updates.length; i += 500) {
    const batch = writeBatch(db);
    const chunk = updates.slice(i, i + 500);
    for (const u of chunk) {
      batch.update(doc(db, 'soldiers', u.docId), { personalItems: u.personalItems });
      const fieldDesc = Object.entries(u.personalItems).map(([k, v]) => `${k}=${v}`).join(', ');
      result.details.push(`${u.name}: ${fieldDesc}`);
    }
    await batch.commit();
  }

  result.updated = updates.length;
  return result;
}
