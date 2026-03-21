import type {
  SoldierRank,
  BloodType,
  ClothingSize,
  EquipmentCategory,
  EquipmentCondition,
  SoldierStatus,
  TankStatus,
  CrewRole,
  VehicleCategory,
  DonationType,
  TrainingContentType,
  PermissionAction,
} from '@/db/schema';

export const RANKS: { value: SoldierRank; label: string }[] = [
  { value: 'private', label: 'טוראי' },
  { value: 'corporal', label: 'רב-טוראי' },
  { value: 'sergeant', label: 'סמל' },
  { value: 'staff_sergeant', label: 'סמל ראשון' },
  { value: 'master_sergeant', label: 'רב-סמל' },
  { value: 'sergeant_major', label: 'רס"ם' },
  { value: 'second_lieutenant', label: 'סגן-משנה' },
  { value: 'first_lieutenant', label: 'סגן' },
  { value: 'captain', label: 'סרן' },
  { value: 'major', label: 'רב-סרן' },
  { value: 'lieutenant_colonel', label: 'סגן-אלוף' },
  { value: 'colonel', label: 'אלוף-משנה' },
];

export const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const CLOTHING_SIZES: ClothingSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export const EQUIPMENT_CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: 'weapon', label: 'נשק' },
  { value: 'protective', label: 'ציוד מגן' },
  { value: 'communication', label: 'תקשורת' },
  { value: 'optics', label: 'אופטיקה' },
  { value: 'navigation', label: 'ניווט' },
  { value: 'clothing', label: 'ביגוד' },
  { value: 'other', label: 'אחר' },
];

export const EQUIPMENT_CONDITIONS: { value: EquipmentCondition; label: string }[] = [
  { value: 'new', label: 'חדש' },
  { value: 'good', label: 'תקין' },
  { value: 'fair', label: 'סביר' },
  { value: 'poor', label: 'בלוי' },
  { value: 'damaged', label: 'פגום' },
];

export const SOLDIER_STATUSES: { value: SoldierStatus; label: string; color: string }[] = [
  { value: 'active', label: 'שירות פעיל', color: 'bg-status-active' },
  { value: 'reserve_ready', label: 'כשיר מילואים', color: 'bg-status-reserve' },
  { value: 'training', label: 'אימון', color: 'bg-status-training' },
  { value: 'leave', label: 'חופשה', color: 'bg-status-leave' },
  { value: 'medical_leave', label: 'חופשת מחלה', color: 'bg-status-medical' },
  { value: 'released', label: 'שוחרר', color: 'bg-status-released' },
  { value: 'absent', label: 'נעדר', color: 'bg-status-absent' },
  { value: 'other', label: 'אחר', color: 'bg-gray-500' },
];

export const TANK_STATUSES: { value: TankStatus; label: string }[] = [
  { value: 'operational', label: 'כשיר' },
  { value: 'maintenance', label: 'בתחזוקה' },
  { value: 'damaged', label: 'פגום' },
  { value: 'reserve', label: 'רזרבה' },
];

export const CREW_ROLES: { value: CrewRole; label: string; position: string }[] = [
  { value: 'driver', label: 'נהג', position: 'front-left' },
  { value: 'gunner', label: 'תותחן', position: 'front-right' },
  { value: 'loader', label: 'טען', position: 'back-left' },
  { value: 'commander', label: 'מפקד', position: 'back-right' },
];

/** Display order for roles inside a vehicle: מפקד, תותחן, טען, נהג */
export const ROLE_DISPLAY_ORDER: CrewRole[] = ['commander', 'gunner', 'loader', 'driver'];

export const VEHICLE_CATEGORIES: { value: VehicleCategory; label: string }[] = [
  { value: 'tank', label: 'טנק' },
  { value: 'standard', label: 'רכב רגיל' },
];

export function getVehicleCategoryLabel(category?: VehicleCategory): string {
  if (!category) return 'טנק';
  return VEHICLE_CATEGORIES.find(c => c.value === category)?.label ?? category;
}

export const SHAMPAF_COLORS = {
  mobilized: 'bg-emerald-600',
  vacation: 'bg-amber-500',
  conflict: 'bg-red-500',
};

export const ASSIGNMENT_COLORS = {
  tank_role: 'bg-blue-600',
  general_mission: 'bg-purple-600',
};

export function getRankLabel(rank: SoldierRank): string {
  return RANKS.find(r => r.value === rank)?.label ?? rank;
}

export function getStatusInfo(status: SoldierStatus) {
  return SOLDIER_STATUSES.find(s => s.value === status) ?? { value: status, label: status, color: 'bg-gray-500' };
}

export function getCategoryLabel(category: EquipmentCategory): string {
  return EQUIPMENT_CATEGORIES.find(c => c.value === category)?.label ?? category;
}

export function getConditionLabel(condition: EquipmentCondition): string {
  return EQUIPMENT_CONDITIONS.find(c => c.value === condition)?.label ?? condition;
}

export function getTankStatusLabel(status: TankStatus): string {
  return TANK_STATUSES.find(s => s.value === status)?.label ?? status;
}

export function getStatusBadgeVariant(status: SoldierStatus): string {
  const map: Record<SoldierStatus, string> = {
    active: 'active',
    reserve_ready: 'reserve',
    training: 'training',
    leave: 'leave',
    medical_leave: 'medical',
    released: 'released',
    absent: 'absent',
    other: 'secondary',
  };
  return map[status] ?? 'secondary';
}

export function getCrewRoleLabel(role: CrewRole): string {
  return CREW_ROLES.find(r => r.value === role)?.label ?? role;
}

// ===== Donation Types =====

export const DONATION_TYPES: { value: DonationType; label: string }[] = [
  { value: 'monetary', label: 'כספית' },
  { value: 'equipment', label: 'ציוד' },
  { value: 'supplies', label: 'אספקה' },
  { value: 'other', label: 'אחר' },
];

export function getDonationTypeLabel(type: DonationType): string {
  return DONATION_TYPES.find(t => t.value === type)?.label ?? type;
}

// ===== Training Content Types =====

export const TRAINING_CONTENT_TYPES: { value: TrainingContentType; label: string }[] = [
  { value: 'document', label: 'מסמך' },
  { value: 'video', label: 'סרטון' },
  { value: 'presentation', label: 'מצגת' },
  { value: 'link', label: 'קישור' },
  { value: 'other', label: 'אחר' },
];

export function getTrainingContentTypeLabel(type: TrainingContentType): string {
  return TRAINING_CONTENT_TYPES.find(t => t.value === type)?.label ?? type;
}

// ===== Permission Actions =====

export const PERMISSION_ACTIONS: { value: PermissionAction; label: string }[] = [
  { value: 'view', label: 'צפייה' },
  { value: 'edit', label: 'עריכה' },
  { value: 'admin', label: 'ניהול' },
];

export function getPermissionActionLabel(action: PermissionAction): string {
  return PERMISSION_ACTIONS.find(a => a.value === action)?.label ?? action;
}

// ===== Page Routes =====

export const ALL_PAGE_ROUTES: { route: string; label: string }[] = [
  { route: '/', label: 'לוח בקרה' },
  { route: '/soldiers', label: 'חיילים' },
  { route: '/equipment', label: 'ציוד' },
  { route: '/shampaf', label: 'שמ"פ' },
  { route: '/assignments', label: 'שיבוץ' },
  { route: '/routine', label: 'שגרה' },
  { route: '/officer-tasks', label: 'משימות קצין' },
  { route: '/training', label: 'הדרכה' },
  { route: '/donations', label: 'תרומות' },
  { route: '/reports', label: 'דוחות' },
  { route: '/settings', label: 'הגדרות' },
  { route: '/permissions', label: 'הרשאות' },
];
