import { z } from 'zod';

export const soldierSchema = z.object({
  militaryId: z.string().min(4, 'מספר אישי חייב להכיל לפחות 4 תווים').max(10),
  firstName: z.string().min(1, 'שם פרטי נדרש'),
  lastName: z.string().min(1, 'שם משפחה נדרש'),
  rank: z.string().min(1, 'דרגה נדרשת'),
  phoneNumber: z.string().min(9, 'מספר טלפון לא תקין').max(15),
  emergencyContact: z.string().min(1, 'איש קשר חירום נדרש'),
  emergencyPhone: z.string().min(9, 'מספר טלפון חירום לא תקין').max(15),
  email: z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal('')),
  bloodType: z.string().min(1, 'סוג דם נדרש'),
  medicalNotes: z.string().optional(),
  uniformSizeTop: z.string().min(1, 'מידת חולצה נדרשת'),
  uniformSizeBottom: z.string().min(1, 'מידת מכנסיים נדרשת'),
  shoeSize: z.coerce.number().min(36, 'מידה לא תקינה').max(50, 'מידה לא תקינה'),
  helmetSize: z.string().optional(),
  platoonId: z.string().optional(),
  squadId: z.string().optional(),
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
