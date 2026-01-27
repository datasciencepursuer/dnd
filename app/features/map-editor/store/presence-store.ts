import { create } from "zustand";

export interface PresenceUser {
  id: string;
  name: string;
  image: string | null;
}

interface PresenceState {
  users: PresenceUser[];
  isConnected: boolean;
  error: string | null;
  connectionId: string | null;
}

interface PresenceActions {
  setUsers: (users: PresenceUser[]) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  setConnectionId: (connectionId: string | null) => void;
  reset: () => void;
}

const initialState: PresenceState = {
  users: [],
  isConnected: false,
  error: null,
  connectionId: null,
};

export const usePresenceStore = create<PresenceState & PresenceActions>(
  (set) => ({
    ...initialState,

    setUsers: (users) => set({ users }),
    setConnected: (isConnected) => set({ isConnected }),
    setError: (error) => set({ error }),
    setConnectionId: (connectionId) => set({ connectionId }),
    reset: () => set(initialState),
  })
);
