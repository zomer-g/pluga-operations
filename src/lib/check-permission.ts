import { getCollection } from '@/lib/datastore';
import type { PermissionAction, PermissionGroup, UserPermission } from '@/db/schema';

export class PermissionDeniedError extends Error {
  constructor(route: string) {
    super(`אין הרשאה לביצוע פעולה זו (${route})`);
    this.name = 'PermissionDeniedError';
  }
}

let currentUserId: string | null = null;

/** Set by AuthProvider once the session is known. */
export function setCurrentUserId(id: string | null) {
  currentUserId = id;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

/**
 * Non-hook permission check for use in mutation functions. This is only an
 * early, friendly check — the server enforces the same rules on every write.
 */
export async function requireEditPermission(route: string): Promise<void> {
  const level = await getPermissionLevel(route);
  if (level !== 'edit' && level !== 'admin') {
    throw new PermissionDeniedError(route);
  }
}

/**
 * Require 'admin' permission on the given route.
 */
export async function requireAdminPermission(route: string): Promise<void> {
  const level = await getPermissionLevel(route);
  if (level !== 'admin') {
    throw new PermissionDeniedError(route);
  }
}

async function getPermissionLevel(route: string): Promise<PermissionAction | null> {
  if (!currentUserId) throw new PermissionDeniedError(route);

  const [users, groups] = await Promise.all([
    getCollection<UserPermission>('userPermissions', { fresh: false }),
    getCollection<PermissionGroup>('permissionGroups', { fresh: false }),
  ]);
  const perm = users.find(u => u.id === currentUserId);
  if (!perm) return null;

  // Check custom overrides first
  const override = perm.customPageOverrides?.[route];
  if (override) return override;

  // Check all groups — find highest permission
  const levels: Record<PermissionAction, number> = { view: 1, edit: 2, admin: 3 };
  let highest: PermissionAction | null = null;

  for (const gId of perm.groupIds ?? []) {
    const group = groups.find(g => g.id === gId);
    const action = group?.pagePermissions[route];
    if (action && (!highest || levels[action] > levels[highest])) {
      highest = action;
    }
  }

  return highest;
}
