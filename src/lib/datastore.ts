import { useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

/**
 * Client data layer on top of the server API — the replacement for Firestore.
 *
 * - Each collection is fetched whole (the data set is one company, hundreds of
 *   rows) and kept in memory; hooks filter/sort in memory as before.
 * - Live updates: the server pushes "collection X changed" over SSE and every
 *   loaded collection that changed is refetched.
 * - Offline: the last snapshot of each collection is kept in localStorage and
 *   shown when the server can't be reached (read-only).
 */

const ALL_COLLECTIONS = [
  'soldiers', 'statusEntries', 'platoons', 'squads', 'activations',
  'equipmentTypes', 'equipmentAssignments',
  'departments', 'tanks', 'tankCrewAssignments',
  'shampafEntries', 'shampafVacations', 'assignments',
  'routineDepartments', 'routineVehicles', 'routineTemplates', 'routineChangeLogs',
  'trainingContent', 'trainingTags', 'trainingCategories',
  'donations', 'userPermissions', 'permissionGroups',
] as const;

export type CollectionName = (typeof ALL_COLLECTIONS)[number];

interface Entry {
  data: unknown[] | undefined;
  listeners: Set<() => void>;
  inflight: Promise<unknown[]> | null;
  fetched: boolean;
}

const CACHE_PREFIX = 'pluga:cache:v1:';
const entries = new Map<CollectionName, Entry>();

function readCache(name: CollectionName): unknown[] | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + name);
    return raw ? (JSON.parse(raw) as unknown[]) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(name: CollectionName, data: unknown[]) {
  try {
    localStorage.setItem(CACHE_PREFIX + name, JSON.stringify(data));
  } catch {
    // Quota or privacy mode — the in-memory copy still works.
  }
}

function getEntry(name: CollectionName): Entry {
  let e = entries.get(name);
  if (!e) {
    e = { data: readCache(name), listeners: new Set(), inflight: null, fetched: false };
    entries.set(name, e);
  }
  return e;
}

function emit(e: Entry) {
  for (const l of e.listeners) l();
}

/** Refetch a collection from the server and notify subscribers. */
export function refresh<T>(name: CollectionName): Promise<T[]> {
  const e = getEntry(name);
  if (e.inflight) return e.inflight as Promise<T[]>;
  e.inflight = api<T[]>(`/api/data/${name}`)
    .then((data) => {
      e.data = data;
      e.fetched = true;
      writeCache(name, data);
      emit(e);
      return data;
    })
    .finally(() => {
      e.inflight = null;
    });
  return e.inflight as Promise<T[]>;
}

/** Subscribe a component to a collection (Firestore onSnapshot equivalent). `undefined` while loading. */
export function useCollection<T>(name: CollectionName): T[] | undefined {
  const e = getEntry(name);
  return useSyncExternalStore(
    (onChange) => {
      e.listeners.add(onChange);
      if (!e.fetched && !e.inflight) refresh(name).catch(() => {});
      return () => {
        e.listeners.delete(onChange);
      };
    },
    () => e.data as T[] | undefined,
  );
}

/**
 * One-off read for mutations and checks (Firestore getDocs equivalent).
 * `fresh` (default) goes to the server; when offline it falls back to the cached copy.
 */
export async function getCollection<T>(name: CollectionName, { fresh = true } = {}): Promise<T[]> {
  const e = getEntry(name);
  if (!fresh && e.fetched && e.data) return e.data as T[];
  try {
    return await refresh<T>(name);
  } catch (err) {
    if (e.data) return e.data as T[];
    throw err;
  }
}

// ===== Writes =====

export type WriteOp =
  | { op: 'set'; collection: CollectionName; id: string; data: object }
  | { op: 'update'; collection: CollectionName; id: string; data: object }
  | { op: 'delete'; collection: CollectionName; id: string };

/** Apply operations atomically on the server, then refresh what they touched. */
export async function commit(ops: WriteOp[]): Promise<void> {
  if (ops.length === 0) return;
  const { affected } = await api<{ affected: CollectionName[] }>('/api/batch', {
    method: 'POST',
    body: { ops },
  });
  await Promise.all(
    affected.filter((n) => entries.get(n)?.fetched).map((n) => refresh(n).catch(() => {})),
  );
}

export const setDoc = (collection: CollectionName, id: string, data: object) =>
  commit([{ op: 'set', collection, id, data }]);

export const updateDoc = (collection: CollectionName, id: string, data: object) =>
  commit([{ op: 'update', collection, id, data }]);

export const deleteDoc = (collection: CollectionName, id: string) =>
  commit([{ op: 'delete', collection, id }]);

export function writeBatch() {
  const ops: WriteOp[] = [];
  return {
    set(collection: CollectionName, id: string, data: object) {
      ops.push({ op: 'set', collection, id, data });
    },
    update(collection: CollectionName, id: string, data: object) {
      ops.push({ op: 'update', collection, id, data });
    },
    delete(collection: CollectionName, id: string) {
      ops.push({ op: 'delete', collection, id });
    },
    get size() {
      return ops.length;
    },
    commit: () => commit(ops),
  };
}

// ===== Live updates =====

let source: EventSource | null = null;
let hadError = false;

function refreshLoaded(names?: CollectionName[]) {
  for (const [name, e] of entries) {
    if (!e.fetched && e.listeners.size === 0) continue;
    if (names && !names.includes(name)) continue;
    refresh(name).catch(() => {});
  }
}

function onVisible() {
  if (document.visibilityState === 'visible') refreshLoaded();
}

function onOnline() {
  refreshLoaded();
}

export function startLiveUpdates() {
  if (source) return;
  // Load everything once in the background so every page has an offline copy,
  // not only the pages visited while online.
  for (const name of ALL_COLLECTIONS) {
    if (!getEntry(name).fetched) refresh(name).catch(() => {});
  }
  source = new EventSource('/api/events');
  source.addEventListener('change', (ev) => {
    try {
      const { collections } = JSON.parse((ev as MessageEvent).data) as { collections: CollectionName[] };
      refreshLoaded(collections);
    } catch {
      refreshLoaded();
    }
  });
  source.onopen = () => {
    // Anything may have changed while the stream was down.
    if (hadError) refreshLoaded();
    hadError = false;
  };
  source.onerror = () => {
    hadError = true;
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
}

export function stopLiveUpdates() {
  source?.close();
  source = null;
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onOnline);
}

/** Forget every cached snapshot (on sign-out, so the next user on this device sees nothing). */
export function clearDataCache() {
  entries.clear();
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
