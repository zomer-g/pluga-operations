import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CacheCategory =
  | 'soldiers'
  | 'tanks'
  | 'assignments'
  | 'shampaf'
  | 'equipment'
  | 'platoons'
  | 'statuses'
  | 'activations';

const ALL_CATEGORIES: CacheCategory[] = [
  'soldiers', 'tanks', 'assignments', 'shampaf',
  'equipment', 'platoons', 'statuses', 'activations',
];

interface AppState {
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
  offlineCategories: Record<CacheCategory, boolean>;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleOfflineCategory: (category: CacheCategory) => void;
  isCategoryEnabled: (category: CacheCategory) => boolean;
}

export function useCacheEnabled(category: CacheCategory): boolean {
  return useAppStore(state => state.offlineCategories[category] ?? true);
}

const defaultOfflineCategories: Record<CacheCategory, boolean> = {
  soldiers: true,
  tanks: true,
  assignments: true,
  shampaf: false,
  equipment: false,
  platoons: true,
  statuses: false,
  activations: false,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      sidebarOpen: false,
      offlineCategories: { ...defaultOfflineCategories },
      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark';
          document.documentElement.classList.toggle('light', newTheme === 'light');
          return { theme: newTheme };
        }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleOfflineCategory: (category) =>
        set((state) => ({
          offlineCategories: {
            ...state.offlineCategories,
            [category]: !state.offlineCategories[category],
          },
        })),
      isCategoryEnabled: (category) => get().offlineCategories[category] ?? true,
    }),
    {
      name: 'pluga-app-settings',
      partialize: (state) => ({
        theme: state.theme,
        offlineCategories: state.offlineCategories,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme === 'light') {
          document.documentElement.classList.add('light');
        }
      },
    }
  )
);
