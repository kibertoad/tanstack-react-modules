import { createScopedStore } from "@tanstack-react-modules/core";

interface UserNotesState {
  notes: string;
  lastSaved: number | null;
}

/**
 * Per-user notes — each userId gets its own independent store.
 * State persists across navigations within the same session.
 */
export const userNotes = createScopedStore<UserNotesState>(() => ({
  notes: "",
  lastSaved: null,
}));
