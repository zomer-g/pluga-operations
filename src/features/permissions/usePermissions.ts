import { useMemo } from 'react';
import { useCollection, setDoc, updateDoc, deleteDoc } from '@/lib/datastore';
import { useAuth } from '@/components/auth/AuthProvider';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireAdminPermission } from '@/lib/check-permission';
import type { PermissionGroup, UserPermission, PermissionAction } from '@/db/schema';

// ===== Hooks =====

export function usePermissionGroups() {
  return useCollection<PermissionGroup>('permissionGroups');
}

export function useUserPermissions() {
  return useCollection<UserPermission>('userPermissions');
}

export function useCurrentUserPermission() {
  const { user } = useAuth();
  const all = useCollection<UserPermission>('userPermissions');

  return useMemo(() => {
    if (!user) return null;
    if (!all) return undefined;
    return all.find(u => u.id === user.sub) ?? null;
  }, [all, user]);
}

/** Get the highest permission level for a route across all user groups */
function getHighestPermission(
  userPerm: UserPermission,
  groups: PermissionGroup[],
  route: string,
): PermissionAction | null {
  // Check custom overrides first
  const customAction = userPerm.customPageOverrides?.[route];
  if (customAction) return customAction;

  // Check all groups the user belongs to — take the highest permission
  const levels: Record<PermissionAction, number> = { view: 1, edit: 2, admin: 3 };
  let highest: PermissionAction | null = null;

  for (const gId of userPerm.groupIds) {
    const group = groups.find(g => g.id === gId);
    if (!group) continue;
    const action = group.pagePermissions[route];
    if (action && (!highest || levels[action] > levels[highest])) {
      highest = action;
    }
  }

  return highest;
}

// The server creates a permission row for every user at sign-in, so a missing
// row means the user was removed — no access (the Firebase version treated it as admin).

export function useCanAccessPage(route: string): boolean | undefined {
  const userPerm = useCurrentUserPermission();
  const groups = usePermissionGroups();

  if (userPerm === undefined || groups === undefined) return undefined;
  if (userPerm === null) return false;

  const perm = getHighestPermission(userPerm, groups, route);
  return !!perm;
}

export function useHasEditAccess(route: string): boolean | undefined {
  const userPerm = useCurrentUserPermission();
  const groups = usePermissionGroups();

  if (userPerm === undefined || groups === undefined) return undefined;
  if (userPerm === null) return false;

  const perm = getHighestPermission(userPerm, groups, route);
  return perm === 'edit' || perm === 'admin';
}

export function useIsAdmin(): boolean | undefined {
  const userPerm = useCurrentUserPermission();
  const groups = usePermissionGroups();

  if (userPerm === undefined || groups === undefined) return undefined;
  if (userPerm === null) return false;

  const perm = getHighestPermission(userPerm, groups, '/permissions');
  return perm === 'admin';
}

// ===== Mutations =====

export async function addPermissionGroup(data: Omit<PermissionGroup, 'id'>) {
  await requireAdminPermission('/permissions');
  const id = generateId();
  await setDoc('permissionGroups', id, stripUndefined({ ...data, id }));
  return id;
}

export async function updatePermissionGroup(id: string, data: Partial<PermissionGroup>) {
  await requireAdminPermission('/permissions');
  await updateDoc('permissionGroups', id, stripUndefined(data));
}

export async function deletePermissionGroup(id: string) {
  await requireAdminPermission('/permissions');
  await deleteDoc('permissionGroups', id);
}

export async function setUserPermission(userId: string, data: Omit<UserPermission, 'id'>) {
  await requireAdminPermission('/permissions');
  await setDoc('userPermissions', userId, stripUndefined({ ...data, id: userId }));
}

export async function removeUserPermission(userId: string) {
  await requireAdminPermission('/permissions');
  await deleteDoc('userPermissions', userId);
}
