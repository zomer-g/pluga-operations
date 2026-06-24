import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import { requireAdminPermission } from '@/lib/check-permission';
import type { ClothingSize } from '@/db/schema';

const HEBREW_SIZE_MAP: Record<string, ClothingSize> = {
  'ק': 'S',
  'ב': 'M',
  'ג': 'L',
  'מ': 'XL',
  'ממ': 'XXL',
};

function parseHebrewSize(raw: string): { top?: ClothingSize; bottom?: ClothingSize } {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  // Handle special case: "ב במכנס, ג' בחולצה"
  const splitMatch = trimmed.match(/([קבגמ]{1,2})\s*(?:ב|')?\s*במכנס.*?([קבגמ]{1,2})\s*(?:ב|')?\s*בחולצה/);
  if (splitMatch) {
    return {
      bottom: HEBREW_SIZE_MAP[splitMatch[1]!],
      top: HEBREW_SIZE_MAP[splitMatch[2]!],
    };
  }

  const size = HEBREW_SIZE_MAP[trimmed];
  if (size) return { top: size, bottom: size };

  return {};
}

function parseEnglishSize(raw: string): ClothingSize | undefined {
  const normalized = raw.trim().toUpperCase();
  const valid: ClothingSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  return valid.find(s => s === normalized);
}

interface CsvSoldierSizes {
  personalId: string;
  uniformsB: string;
  overalls: string;
  underwear: string;
  shoes: string;
}

function parseCsvRow(row: string): CsvSoldierSizes | null {
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
    };
  } catch {
    return null;
  }
}

export function parseCsvSizes(csvContent: string): CsvSoldierSizes[] {
  const lines = csvContent.split('\n');
  const results: CsvSoldierSizes[] = [];
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

  const csvSoldiers = parseCsvSizes(csvContent);
  const result: MigrationResult = { updated: 0, skipped: 0, notFound: [], details: [] };

  const snap = await getDocs(collection(db, 'soldiers'));
  const soldiersByMilitaryId = new Map<string, { docId: string; data: Record<string, unknown> }>();
  for (const d of snap.docs) {
    const data = d.data();
    const mid = data.militaryId as string | undefined;
    if (mid) soldiersByMilitaryId.set(mid, { docId: d.id, data });
  }

  const updates: { docId: string; fields: Record<string, unknown>; name: string }[] = [];

  for (const csv of csvSoldiers) {
    const match = soldiersByMilitaryId.get(csv.personalId);
    if (!match) {
      result.notFound.push(csv.personalId);
      continue;
    }

    const fields: Record<string, unknown> = {};
    const { top, bottom } = parseHebrewSize(csv.uniformsB);

    if (top && !match.data.uniformSizeTop) fields.uniformSizeTop = top;
    if (bottom && !match.data.uniformSizeBottom) fields.uniformSizeBottom = bottom;

    const shoeNum = csv.shoes ? parseInt(csv.shoes, 10) : NaN;
    if (!isNaN(shoeNum) && !match.data.shoeSize) fields.shoeSize = shoeNum;

    if (Object.keys(fields).length === 0) {
      result.skipped++;
      continue;
    }

    const name = `${match.data.firstName ?? ''} ${match.data.lastName ?? ''}`.trim();
    updates.push({ docId: match.docId, fields, name });
  }

  for (let i = 0; i < updates.length; i += 500) {
    const batch = writeBatch(db);
    const chunk = updates.slice(i, i + 500);
    for (const u of chunk) {
      batch.update(doc(db, 'soldiers', u.docId), u.fields);
      const fieldDesc = Object.entries(u.fields).map(([k, v]) => `${k}=${v}`).join(', ');
      result.details.push(`${u.name}: ${fieldDesc}`);
    }
    await batch.commit();
  }

  result.updated = updates.length;
  return result;
}
