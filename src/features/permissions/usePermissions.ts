import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { generateId, stripUndefined } from '@/lib/utils';
import type { PermissionGroup, UserPermission, PermissionAction } from '@/db/schema';
import { ALL_PAGE_ROUTES } from '@/lib/constants';

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
      setPerms(snap.docs.map(d => ({ ...d.data(), id: d.id } as UserPermission)));
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
        setPerm({ ...snap.data(), id: snap.id } as UserPermission);
      } else {
        setPerm(null);
      }
    });
    return unsub;
  }, [user]);

  return perm;
}

export function useCanAccessPage(route: string): boolean | undefined {
  const userPerm = useCurrentUserPermission();
  const groups = usePermissionGroups();

  if (userPerm === undefined || groups === undefined) return undefined;

  // No permission doc = allow all (first user / admin bootstrap)
  if (userPerm === null) return true;

  // Check custom override first
  if (userPerm.customPageOverrides?.[route]) return true;

  // Find group
  const group = groups.find(g => g.id === userPerm.groupId);
  if (!group) return true; // No group found = allow (safety)

  return !!group.pagePermissions[route];
}

export function useHasEditAccess(route: string): boolean | undefined {
  const userPerm = useCurrentUserPermission();
  const groups = usePermissionGroups();

  if (userPerm === undefined || groups === undefined) return undefined;
  if (userPerm === null) return true;

  // Check custom override
  const customAction = userPerm.customPageOverrides?.[route];
  if (customAction === 'edit' || customAction === 'admin') return true;

  // Check group
  const group = groups.find(g => g.id === userPerm.groupId);
  if (!group) return true;

  const action = group.pagePermissions[route];
  return action === 'edit' || action === 'admin';
}

export function useIsAdmin(): boolean | undefined {
  const userPerm = useCurrentUserPermission();
  const groups = usePermissionGroups();

  if (userPerm === undefined || groups === undefined) return undefined;
  if (userPerm === null) return true; // No perm doc = first user = admin

  const group = groups.find(g => g.id === userPerm.groupId);
  if (!group) return true;

  // Admin if permissions page has admin access
  return group.pagePermissions['/permissions'] === 'admin';
}

// ===== Mutations =====

export async function addPermissionGroup(data: Omit<PermissionGroup, 'id'>) {
  const id = generateId();
  await setDoc(doc(db, 'permissionGroups', id), stripUndefined({ ...data, id }) as Record<string, unknown>);
  return id;
}

export async function updatePermissionGroup(id: string, data: Partial<PermissionGroup>) {
  await updateDoc(doc(db, 'permissionGroups', id), stripUndefined(data) as Record<string, unknown>);
}

export async function deletePermissionGroup(id: string) {
  await deleteDoc(doc(db, 'permissionGroups', id));
}

export async function setUserPermission(userId: string, data: Omit<UserPermission, 'id'>) {
  await setDoc(doc(db, 'userPermissions', userId), stripUndefined({ ...data, id: userId }) as Record<string, unknown>);
}

export async function removeUserPermission(userId: string) {
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
  if (existingDoc.exists()) return;

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
      groupId = adminGroup?.id ?? groupsSnap.docs[0].id;
    } else {
      // Not first user — find default group
      const defaultGroup = groupsSnap.docs.find(d => d.data().isDefault === true);
      groupId = defaultGroup?.id ?? groupsSnap.docs[0].id;
    }
  }

  // Create user permission doc
  await setDoc(userPermRef, {
    id: user.sub,
    email: user.email,
    displayName: user.name,
    groupId,
  });
}
