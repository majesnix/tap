import { create } from "zustand";
import type { ConnectionProfile, ConnectionStatus, ManagementStatus } from "@/lib/types";

interface ConnectionStore {
  profiles: ConnectionProfile[];
  activeProfileName: string | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  managementStatus: ManagementStatus;
  queues: string[];
  exchanges: string[];

  setProfiles: (profiles: ConnectionProfile[]) => void;
  setActiveProfile: (name: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string | null) => void;
  setManagementStatus: (status: ManagementStatus) => void;
  setQueues: (queues: string[]) => void;
  setExchanges: (exchanges: string[]) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  profiles: [] as ConnectionProfile[],
  activeProfileName: null as string | null,
  connectionStatus: "disconnected" as ConnectionStatus,
  connectionError: null as string | null,
  managementStatus: "unknown" as ManagementStatus,
  queues: [] as string[],
  exchanges: [] as string[],
} as const;

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...INITIAL_STATE,

  setProfiles: (profiles) => set({ profiles }),
  setActiveProfile: (name) => set({ activeProfileName: name }),
  setConnectionStatus: (status, error = null) =>
    set({ connectionStatus: status, connectionError: error }),
  setManagementStatus: (status) => set({ managementStatus: status }),
  setQueues: (queues) => set({ queues }),
  setExchanges: (exchanges) => set({ exchanges }),
  reset: () => set({ ...INITIAL_STATE }),
}));
