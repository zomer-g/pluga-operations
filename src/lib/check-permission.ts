import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/firebase';
import type { PermissionAction, PermissionGroup } from '@/db/schema';

export class PermissionDeniedError extends Error {
  constructor(route: string) {
    super(`אין הרשאה לביצוע פעולה זו (${route})`);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Non-hook permission check for use in mutation functions.
 * Reads user permission doc and groups from Firestore, then checks
 * if the current user has at least 'edit' access on the given route.
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
  const user = auth.currentUser;
  if (!user) throw new PermissionDeniedError(route);

  const permSnap = await getDoc(doc(db, 'userPermissions', user.uid));

  // No permission doc = first user / admin bootstrap — allow all
  if (!permSnap.exists()) return 'admin';

  const data = permSnap.data() as Record<string, unknown>;

  // Normalize groupIds (handle legacy single groupId)
  let groupIds: string[] = data.groupIds as string[] ?? [];
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    const legacyGroupId = data.groupId as string | undefined;
    groupIds = legacyGroupId ? [legacyGroupId] : [];
  }

  // Check custom overrides first
  const overrides = data.customPageOverrides as Record<string, PermissionAction> | undefined;
  if (overrides?.[route]) return overrides[route];

  // Check all groups — find highest permission
  const levels: Record<PermissionAction, number> = { view: 1, edit: 2, admin: 3 };
  let highest: PermissionAction | null = null;

  for (const gId of groupIds) {
    const groupSnap = await getDoc(doc(db, 'permissionGroups', gId));
    if (!groupSnap.exists()) continue;
    const group = groupSnap.data() as PermissionGroup;
    const action = group.pagePermissions[route];
    if (action && (!highest || levels[action] > levels[highest])) {
      highest = action;
    }
  }

  return highest;
}
