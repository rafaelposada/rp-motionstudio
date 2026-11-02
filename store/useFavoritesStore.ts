// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import { create } from 'zustand';

const KEY = 'rp-favorite-templates-v1';
export const useFavoritesStore = create<{
  ids: string[]; error: boolean; load: () => void; toggle: (id: string) => void;
}>((set, get) => ({
  ids: [], error: false,
  load: () => {
    try { const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]'); set({ ids: Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : [] }); }
    catch { set({ error: true }); }
  },
  toggle: id => {
    const ids = get().ids.includes(id) ? get().ids.filter(item => item !== id) : [...get().ids, id];
    try { localStorage.setItem(KEY, JSON.stringify(ids)); set({ ids, error: false }); }
    catch { set({ ids, error: true }); }
  },
}));
