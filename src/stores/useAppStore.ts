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
  | 'activations'
  | 'routine'
  | 'training'
  | 'donations';

interface AppState {
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
  offlineCategories: Record<CacheCategory, boolean>;
  selectedActivationId: string | null;
  reportPrefs: Record<string, Record<string, boolean>>;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleOfflineCategory: (category: CacheCategory) => void;
  isCategoryEnabled: (category: CacheCategory) => boolean;
  setSelectedActivationId: (id: string | null) => void;
  setReportFieldVisibility: (reportType: string, field: string, visible: boolean) => void;
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
  platoons: false,
  statuses: false,
  activations: false,
  routine: false,
  training: false,
  donations: false,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      sidebarOpen: false,
      offlineCategories: { ...defaultOfflineCategories },
      selectedActivationId: null,
      reportPrefs: {},
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
      setSelectedActivationId: (id) => set({ selectedActivationId: id }),
      isCategoryEnabled: (category) => get().offlineCategories[category] ?? true,
      setReportFieldVisibility: (reportType, field, visible) =>
        set((state) => ({
          reportPrefs: {
            ...(state.reportPrefs ?? {}),
            [reportType]: {
              ...(state.reportPrefs?.[reportType] ?? {}),
              [field]: visible,
            },
          },
        })),
    }),
    {
      name: 'pluga-app-settings',
      partialize: (state) => ({
        theme: state.theme,
        offlineCategories: state.offlineCategories,
        selectedActivationId: state.selectedActivationId,
        reportPrefs: state.reportPrefs,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme === 'light') {
          document.documentElement.classList.add('light');
        }
      },
    }
  )
);
