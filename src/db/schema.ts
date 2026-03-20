// ===== Enums & Types =====

export type SoldierRank =
  | 'private'
  | 'corporal'
  | 'sergeant'
  | 'staff_sergeant'
  | 'master_sergeant'
  | 'sergeant_major'
  | 'second_lieutenant'
  | 'first_lieutenant'
  | 'captain'
  | 'major'
  | 'lieutenant_colonel'
  | 'colonel';

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type ClothingSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';

export type EquipmentCategory =
  | 'weapon'
  | 'protective'
  | 'communication'
  | 'optics'
  | 'navigation'
  | 'clothing'
  | 'other';

export type EquipmentCondition = 'new' | 'good' | 'fair' | 'poor' | 'damaged';

export type SoldierStatus =
  | 'active'
  | 'reserve_ready'
  | 'training'
  | 'leave'
  | 'medical_leave'
  | 'released'
  | 'absent'
  | 'other';

export type TankStatus = 'operational' | 'maintenance' | 'damaged' | 'reserve';

export type CrewRole = 'commander' | 'gunner' | 'driver' | 'loader';

export type AssignmentType = 'tank_role' | 'general_mission';

// ===== Entities =====

export interface Soldier {
  id: string;
  militaryId?: string;
  firstName: string;
  lastName: string;
  rank?: SoldierRank;
  phoneNumber?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  email?: string;
  bloodType?: BloodType;
  medicalNotes?: string;
  uniformSizeTop?: ClothingSize;
  uniformSizeBottom?: ClothingSize;
  shoeSize?: number;
  helmetSize?: string;
  platoonId?: string;
  squadId?: string;
  trainedRole?: CrewRole;
  profileImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentType {
  id: string;
  name: string;
  nameHe: string;
  category: EquipmentCategory;
  serialNumberRequired: boolean;
  description?: string;
}

export interface EquipmentAssignment {
  id: string;
  soldierId: string;
  equipmentTypeId: string;
  serialNumber?: string;
  signedOutDate: string;
  signedInDate?: string;
  condition: EquipmentCondition;
  notes?: string;
}

export interface StatusEntry {
  id: string;
  soldierId: string;
  status: SoldierStatus;
  startDate: string;
  endDate?: string;
  notes?: string;
  orderNumber?: string;
}

export type VehicleCategory = 'tank' | 'standard';

export interface Tank {
  id: string;
  designation: string;
  type: string;
  vehicleCategory?: VehicleCategory;
  platoonId?: string;
  status: TankStatus;
  notes?: string;
}

export interface TankCrewAssignment {
  id: string;
  tankId: string;
  soldierId: string;
  role: CrewRole;
  startDate: string;
  endDate?: string;
}

export interface Platoon {
  id: string;
  name: string;
  number: number;
  commanderId?: string;
}

export interface Squad {
  id: string;
  platoonId: string;
  name: string;
  number: number;
  leaderId?: string;
}

// ===== הפעלה (Activation) =====

export interface Activation {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

// ===== שמ"פ & שיבוץ =====

export interface ShampafEntry {
  id: string;
  soldierId: string;
  startDateTime: string;
  endDateTime: string;
  orderNumber?: string;
  notes?: string;
}

export interface ShampafVacation {
  id: string;
  shampafEntryId: string;
  soldierId: string;
  startDateTime: string;
  endDateTime: string;
  reason?: string;
  notes?: string;
}

export interface Assignment {
  id: string;
  soldierId: string;
  type: AssignmentType;
  tankId?: string;
  role?: CrewRole;
  missionName?: string;
  startDateTime: string;
  endDateTime: string;
  notes?: string;
}
