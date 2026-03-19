import { z } from 'zod';

export const soldierSchema = z.object({
  militaryId: z.string().optional().or(z.literal('')),
  firstName: z.string().min(1, 'שם פרטי נדרש'),
  lastName: z.string().min(1, 'שם משפחה נדרש'),
  rank: z.string().optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
  emergencyContact: z.string().optional().or(z.literal('')),
  emergencyPhone: z.string().optional().or(z.literal('')),
  email: z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal('')),
  bloodType: z.string().optional().or(z.literal('')),
  medicalNotes: z.string().optional(),
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
  designation: z.string().min(1, 'שם/מספר טנק נדרש'),
  type: z.string().min(1, 'סוג טנק נדרש'),
  platoonId: z.string().optional(),
  status: z.string().min(1, 'סטטוס נדרש'),
  notes: z.string().optional(),
});

export type TankFormData = z.infer<typeof tankSchema>;

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
