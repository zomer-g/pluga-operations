import { db } from './database';
import type { EquipmentType, Platoon } from './schema';

const defaultEquipmentTypes: EquipmentType[] = [
  { id: 'eq-1', name: 'M4 Rifle', nameHe: 'רובה M4', category: 'weapon', serialNumberRequired: true },
  { id: 'eq-2', name: 'Negev LMG', nameHe: 'מקלע נגב', category: 'weapon', serialNumberRequired: true },
  { id: 'eq-3', name: 'MAG GPMG', nameHe: 'מקלע מאג', category: 'weapon', serialNumberRequired: true },
  { id: 'eq-4', name: 'Pistol', nameHe: 'אקדח', category: 'weapon', serialNumberRequired: true },
  { id: 'eq-5', name: 'Ceramic Vest', nameHe: 'אפוד קרמי', category: 'protective', serialNumberRequired: true },
  { id: 'eq-6', name: 'Combat Helmet', nameHe: 'קסדה קרבית', category: 'protective', serialNumberRequired: false },
  { id: 'eq-7', name: 'Ballistic Goggles', nameHe: 'משקפי מגן', category: 'protective', serialNumberRequired: false },
  { id: 'eq-8', name: 'Radio - Motorola', nameHe: 'מכשיר קשר מוטורולה', category: 'communication', serialNumberRequired: true },
  { id: 'eq-9', name: 'Radio - Harris', nameHe: 'מכשיר קשר האריס', category: 'communication', serialNumberRequired: true },
  { id: 'eq-10', name: 'Night Vision Goggles', nameHe: 'משקפי לילה', category: 'optics', serialNumberRequired: true },
  { id: 'eq-11', name: 'Binoculars', nameHe: 'משקפת', category: 'optics', serialNumberRequired: true },
  { id: 'eq-12', name: 'Red Dot Sight', nameHe: 'כוונת נקודה אדומה', category: 'optics', serialNumberRequired: true },
  { id: 'eq-13', name: 'GPS Device', nameHe: 'מכשיר GPS', category: 'navigation', serialNumberRequired: true },
  { id: 'eq-14', name: 'Compass', nameHe: 'מצפן', category: 'navigation', serialNumberRequired: false },
  { id: 'eq-15', name: 'Combat Uniform Set', nameHe: 'סט מדים קרביים', category: 'clothing', serialNumberRequired: false },
  { id: 'eq-16', name: 'Combat Boots', nameHe: 'נעלי קרב', category: 'clothing', serialNumberRequired: false },
  { id: 'eq-17', name: 'Tactical Gloves', nameHe: 'כפפות טקטיות', category: 'clothing', serialNumberRequired: false },
  { id: 'eq-18', name: 'First Aid Kit', nameHe: 'ערכת עזרה ראשונה', category: 'other', serialNumberRequired: false },
  { id: 'eq-19', name: 'Sleeping Bag', nameHe: 'שק שינה', category: 'other', serialNumberRequired: false },
  { id: 'eq-20', name: 'Canteen', nameHe: 'מימייה', category: 'other', serialNumberRequired: false },
];

const defaultPlatoons: Platoon[] = [
  { id: 'plt-1', name: 'מחלקה 1', number: 1 },
  { id: 'plt-2', name: 'מחלקה 2', number: 2 },
  { id: 'plt-3', name: 'מחלקה 3', number: 3 },
];

export async function seedDatabase(): Promise<void> {
  const equipCount = await db.equipmentTypes.count();
  if (equipCount === 0) {
    await db.equipmentTypes.bulkAdd(defaultEquipmentTypes);
  }

  const platoonCount = await db.platoons.count();
  if (platoonCount === 0) {
    await db.platoons.bulkAdd(defaultPlatoons);
  }
}

export async function isDatabaseEmpty(): Promise<boolean> {
  const soldierCount = await db.soldiers.count();
  return soldierCount === 0;
}
