import { z } from 'zod';

export const soldierSchema = z.object({
  militaryId: z.string().max(20).optional().or(z.literal('')),
  firstName: z.string().min(1, 'שם פרטי נדרש').max(50),
  lastName: z.string().min(1, 'שם משפחה נדרש').max(50),
  rank: z.string().optional().or(z.literal('')),
  phoneNumber: z.string().max(20).optional().or(z.literal('')),
  emergencyContact: z.string().max(100).optional().or(z.literal('')),
  emergencyPhone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('כתובת אימייל לא תקינה').max(100).optional().or(z.literal('')),
  bloodType: z.string().optional().or(z.literal('')),
  medicalNotes: z.string().max(1000).optional(),
  uniformSizeTop: z.string().optional().or(z.literal('')),
  uniformSizeBottom: z.string().optional().or(z.literal('')),
  shoeSize: z.coerce.number().optional(),
  helmetSize: z.string().optional(),
  platoonId: z.string().optional(),
  squadId: z.string().optional(),
  trainedRole: z.enum(['commander', 'gunner', 'driver', 'loader']).optional().or(z.literal('')),
});

export type SoldierFormData = z.infer<typeof soldierSchema>;

export const equipmentAssignSchema = z.object({
  equipmentTypeId: z.string().min(1, 'סוג ציוד נדרש'),
  serialNumber: z.string().optional(),
  signedOutDate: z.string().min(1, 'תאריך חתימה נדרש'),
  condition: z.string().min(1, 'מצב ציוד נדרש'),
  notes: z.string().optional(),
});

export type EquipmentAssignFormData = z.infer<typeof equipmentAssignSchema>;

export const statusEntrySchema = z.object({
  status: z.string().min(1, 'סטטוס נדרש'),
  startDate: z.string().min(1, 'תאריך התחלה נדרש'),
  endDate: z.string().optional(),
  notes: z.string().optional(),
  orderNumber: z.string().optional(),
});

export type StatusEntryFormData = z.infer<typeof statusEntrySchema>;

export const tankSchema = z.object({
  designation: z.string().min(1, 'שם/מספר רכב נדרש'),
  type: z.string().min(1, 'סוג רכב נדרש'),
  vehicleCategory: z.enum(['tank', 'standard']).optional(),
  platoonId: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.string().min(1, 'סטטוס נדרש'),
  notes: z.string().optional(),
});

export type TankFormData = z.infer<typeof tankSchema>;

export const departmentSchema = z.object({
  name: z.string().min(1, 'שם מחלקה נדרש'),
  order: z.coerce.number().default(0),
});

export type DepartmentFormData = z.infer<typeof departmentSchema>;

export const crewAssignSchema = z.object({
  soldierId: z.string().min(1, 'חייל נדרש'),
  role: z.string().min(1, 'תפקיד נדרש'),
  startDate: z.string().min(1, 'תאריך התחלה נדרש'),
});

export type CrewAssignFormData = z.infer<typeof crewAssignSchema>;

export const platoonSchema = z.object({
  name: z.string().min(1, 'שם מחלקה נדרש'),
  number: z.coerce.number().min(1, 'מספר מחלקה נדרש'),
  commanderId: z.string().optional(),
});

export type PlatoonFormData = z.infer<typeof platoonSchema>;

export const equipmentTypeSchema = z.object({
  name: z.string().min(1, 'שם באנגלית נדרש'),
  nameHe: z.string().min(1, 'שם בעברית נדרש'),
  category: z.string().min(1, 'קטגוריה נדרשת'),
  serialNumberRequired: z.boolean(),
  description: z.string().optional(),
});

export type EquipmentTypeFormData = z.infer<typeof equipmentTypeSchema>;

// ===== שמ"פ & שיבוץ =====

export const shampafEntrySchema = z.object({
  soldierId: z.string().min(1, 'חייל נדרש'),
  startDateTime: z.string().min(1, 'תאריך התחלה נדרש'),
  endDateTime: z.string().min(1, 'תאריך סיום נדרש'),
  orderNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type ShampafEntryFormData = z.infer<typeof shampafEntrySchema>;

export const shampafVacationSchema = z.object({
  shampafEntryId: z.string().min(1),
  soldierId: z.string().min(1),
  startDateTime: z.string().min(1, 'תאריך התחלה נדרש'),
  endDateTime: z.string().min(1, 'תאריך סיום נדרש'),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export type ShampafVacationFormData = z.infer<typeof shampafVacationSchema>;

export const assignmentSchema = z.object({
  soldierId: z.string().min(1, 'חייל נדרש'),
  type: z.enum(['tank_role', 'general_mission']),
  tankId: z.string().optional(),
  role: z.enum(['commander', 'gunner', 'driver', 'loader']).optional(),
  missionName: z.string().optional(),
  startDateTime: z.string().min(1, 'תאריך התחלה נדרש'),
  endDateTime: z.string().min(1, 'תאריך סיום נדרש'),
  notes: z.string().optional(),
});

export type AssignmentFormData = z.infer<typeof assignmentSchema>;

// ===== Routine Templates =====

export const routineTemplateSchema = z.object({
  name: z.string().min(1, 'שם שגרה נדרש'),
  tankId: z.string().min(1, 'רכב נדרש'),
  notes: z.string().optional(),
});

export type RoutineTemplateFormData = z.infer<typeof routineTemplateSchema>;

// ===== Training Content =====

export const trainingContentSchema = z.object({
  title: z.string().min(1, 'כותרת נדרשת'),
  description: z.string().optional(),
  contentType: z.enum(['document', 'video', 'presentation', 'link', 'other']),
  contentBody: z.string().optional(),
  externalUrl: z.string().url('כתובת URL לא תקינה').optional().or(z.literal('')),
  tags: z.array(z.string()).default([]),
  category: z.string().min(1, 'קטגוריה נדרשת'),
});

export type TrainingContentFormData = z.infer<typeof trainingContentSchema>;

export const trainingTagSchema = z.object({
  name: z.string().min(1, 'שם תגית נדרש'),
  color: z.string().optional(),
});

export type TrainingTagFormData = z.infer<typeof trainingTagSchema>;

export const trainingCategorySchema = z.object({
  name: z.string().min(1, 'שם קטגוריה נדרש'),
  order: z.coerce.number().default(0),
});

export type TrainingCategoryFormData = z.infer<typeof trainingCategorySchema>;

// ===== Donations =====

export const donationSchema = z.object({
  donorName: z.string().min(1, 'שם תורם נדרש'),
  donorContact: z.string().optional(),
  donorPhone: z.string().optional(),
  donorEmail: z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal('')),
  type: z.enum(['monetary', 'equipment', 'supplies', 'other']),
  amount: z.coerce.number().optional(),
  description: z.string().min(1, 'תיאור נדרש'),
  itemsList: z.string().optional(),
  date: z.string().min(1, 'תאריך נדרש'),
  notes: z.string().optional(),
});

export type DonationFormData = z.infer<typeof donationSchema>;

// ===== Permissions =====

export const permissionGroupSchema = z.object({
  name: z.string().min(1, 'שם קבוצה נדרש'),
  isDefault: z.boolean().default(false),
});

export type PermissionGroupFormData = z.infer<typeof permissionGroupSchema>;
