import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('he-IL');
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('he-IL');
}

export function todayString(): string {
  return new Date().toISOString().split('T')[0]!;
}
