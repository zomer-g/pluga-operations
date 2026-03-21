import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { generateId, stripUndefined } from '@/lib/utils';
import { requireAdminPermission } from '@/lib/check-permission';
import type { PermissionGroup, UserPermission, PermissionAction } from '@/db/schema';
import { ALL_PAGE_ROUTES } from '@/lib/constants';

// ===== Migration helper =====

/** Normalize a UserPermission doc — migrate old `groupId` to `groupIds[]` */
function normalizeUserPerm(data: Record<string, unknown>, id: string): UserPermission {
  const raw = data as unknown as UserPermission & { groupId?: string };
  let groupIds = raw.groupIds;
  if (!groupIds || !Array.isArray(groupIds)) {
    // Migrate from legacy single groupId
    groupIds = raw.groupId ? [raw.groupId] : [];
  }
  return {
    id,
    email: raw.email ?? '',
    displayName: raw.displayName ?? '',
    groupIds,
    customPageOverrides: raw.customPageOverrides,
  };
}

// ===== Hooks =====

export function usePermissionGroups() {
  const [groups, setGroups] = useState<PermissionGroup[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'permissionGroups'), (snap) => {
      setGroups(snap.docs.map(d => ({ ...d.data(), id: d.id } as PermissionGroup)));
    });
    return unsub;
  }, []);

  return groups;
}

export function useUserPermissions() {
  const [perms, setPerms] = useState<UserPermission[] | undefined>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'userPermissions'), (snap) => {
      setPerms(snap.docs.map(d => normalizeUserPerm(d.data(), d.id)));
    });
    return unsub;
  }, []);

  return perms;
}

export function useCurrentUserPermission() {
  const { user } = useAuth();
  const [perm, setPerm] = useState<UserPermission | null | undefined>(undefined);

  useEffect(() => {
    if (!user) { setPerm(null); return; }
    const unsub = onSnapshot(doc(db, 'userPermissions', user.sub), (snap) => {
      if (snap.exists()) {
        setPerm(normalizeUserPerm(snap.data(), snap.id));
      } else {
        setPerm(null);
      }
    });
    return unsub;
  }, [user]);

  return perm;
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

export function useCanAccessPage(route: string): boolean | undefined {
  const userPerm = useCurrentUserPermission();
  const groups = usePermissionGroups();

  if (userPerm === undefined || groups === undefined) return undefined;

  // No permission doc = allow all (first user / admin bootstrap)
  if (userPerm === null) return true;

  const perm = getHighestPermission(userPerm, groups, route);
  return !!perm;
}

export function useHasEditAccess(route: string): boolean | undefined {
  const userPerm = useCurrentUserPermission();
  const groups = usePermissionGroups();

  if (userPerm === undefined || groups === undefined) return undefined;
  if (userPerm === null) return true;

  const perm = getHighestPermission(userPerm, groups, route);
  return perm === 'edit' || perm === 'admin';
}

export function useIsAdmin(): boolean | undefined {
  const userPerm = useCurrentUserPermission();
  const groups = usePermissionGroups();

  if (userPerm === undefined || groups === undefined) return undefined;
  if (userPerm === null) return true; // No perm doc = first user = admin

  const perm = getHighestPermission(userPerm, groups, '/permissions');
  return perm === 'admin';
}

// ===== Mutations =====

export async function addPermissionGroup(data: Omit<PermissionGroup, 'id'>) {
  await requireAdminPermission('/permissions');
  const id = generateId();
  await setDoc(doc(db, 'permissionGroups', id), stripUndefined({ ...data, id }) as any);
  return id;
}

export async function updatePermissionGroup(id: string, data: Partial<PermissionGroup>) {
  await requireAdminPermission('/permissions');
  await updateDoc(doc(db, 'permissionGroups', id), stripUndefined(data) as any);
}

export async function deletePermissionGroup(id: string) {
  await requireAdminPermission('/permissions');
  await deleteDoc(doc(db, 'permissionGroups', id));
}

export async function setUserPermission(userId: string, data: Omit<UserPermission, 'id'>) {
  await requireAdminPermission('/permissions');
  await setDoc(doc(db, 'userPermissions', userId), stripUndefined({ ...data, id: userId }) as any);
}

export async function removeUserPermission(userId: string) {
  await requireAdminPermission('/permissions');
  await deleteDoc(doc(db, 'userPermissions', userId));
}

/**
 * Called on login — ensures the user has a permission doc.
 * First user gets admin group (auto-created if needed).
 * Subsequent users get the default group.
 */
export async function ensureUserPermission(user: { sub: string; email: string; name: string }) {
  // Check if user already has a permission doc
  const userPermRef = doc(db, 'userPermissions', user.sub);
  const { getDoc: getDocFn } = await import('firebase/firestore');
  const existingDoc = await getDocFn(userPermRef);

  if (existingDoc.exists()) {
    // Migrate old single groupId to groupIds[] if needed
    const data = existingDoc.data() as Record<string, unknown>;
    if (!data.groupIds && data.groupId) {
      await updateDoc(userPermRef, {
        groupIds: [data.groupId],
      });
    }
    return;
  }

  // Check if any permission groups exist
  const groupsSnap = await getDocs(collection(db, 'permissionGroups'));

  let groupId: string;

  if (groupsSnap.empty) {
    // No groups at all — this is the first user. Create admin + viewer groups.
    const adminGroupId = generateId();
    const viewerGroupId = generateId();

    const allPagePerms: Record<string, PermissionAction> = {};
    ALL_PAGE_ROUTES.forEach(p => { allPagePerms[p.route] = 'admin'; });

    const viewerPagePerms: Record<string, PermissionAction> = {};
    ALL_PAGE_ROUTES.forEach(p => {
      if (p.route !== '/permissions' && p.route !== '/settings') {
        viewerPagePerms[p.route] = 'view';
      }
    });

    await setDoc(doc(db, 'permissionGroups', adminGroupId), {
      id: adminGroupId,
      name: 'מנהל מערכת',
      isDefault: false,
      pagePermissions: allPagePerms,
    });

    await setDoc(doc(db, 'permissionGroups', viewerGroupId), {
      id: viewerGroupId,
      name: 'צופה',
      isDefault: true,
      pagePermissions: viewerPagePerms,
    });

    groupId = adminGroupId; // First user gets admin
  } else {
    // Check if any users exist
    const usersSnap = await getDocs(collection(db, 'userPermissions'));
    if (usersSnap.empty) {
      // First user but groups already exist — find admin group or first group
      const adminGroup = groupsSnap.docs.find(d => d.data().name === 'מנהל מערכת');
      groupId = adminGroup?.id ?? groupsSnap.docs[0]?.id ?? '';
    } else {
      // Not first user — find default group
      const defaultGroup = groupsSnap.docs.find(d => d.data().isDefault === true);
      groupId = defaultGroup?.id ?? groupsSnap.docs[0]?.id ?? '';
    }
  }

  // Create user permission doc with groupIds array
  await setDoc(userPermRef, {
    id: user.sub,
    email: user.email,
    displayName: user.name,
    groupIds: [groupId],
  });
}
