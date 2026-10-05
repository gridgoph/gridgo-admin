import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/**
 * Hub-duty checklist ticks, kept per hub day.
 *
 * Ticks are a personal aide-mémoire, not a record: nothing is sent to GRIDGO,
 * and a new hub day starts unticked. The SOP text itself always comes from the
 * API (`GET /staff/hub`), so an edited SOP never inherits stale ticks — ticks
 * are keyed by the item's text.
 */
const KEY = "gridgo.admin.sopChecks";

type Stored = { day: string; checked: string[] };

type SopState = {
  day: string | null;
  checked: string[];
  hydrate: (day: string) => Promise<void>;
  toggle: (item: string) => void;
  clear: () => void;
};

function persist(day: string | null, checked: string[]) {
  if (!day) return;
  const value: Stored = { day, checked };
  void AsyncStorage.setItem(KEY, JSON.stringify(value)).catch(() => undefined);
}

export const useSop = create<SopState>((set, get) => ({
  day: null,
  checked: [],
  hydrate: async (day) => {
    if (get().day === day) return;
    let checked: string[] = [];
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const stored = raw ? (JSON.parse(raw) as Stored) : null;
      if (stored?.day === day && Array.isArray(stored.checked)) checked = stored.checked;
    } catch {
      // A broken entry starts the day unticked.
    }
    set({ day, checked });
  },
  toggle: (item) => {
    const { day, checked } = get();
    const next = checked.includes(item) ? checked.filter((c) => c !== item) : [...checked, item];
    set({ checked: next });
    persist(day, next);
  },
  clear: () => {
    set({ checked: [] });
    persist(get().day, []);
  },
}));
