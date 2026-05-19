import { create } from "zustand";
import type { ConnectionProfile, ConnectionStatus, ManagementStatus, ExchangeSummary } from "@/lib/types";

interface ConnectionStore {
  profiles: ConnectionProfile[];
  activeProfileName: string | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  managementStatus: ManagementStatus;
  managementAuthError: string | null;
  queues: string[];
  exchanges: ExchangeSummary[];

  setProfiles: (profiles: ConnectionProfile[]) => void;
  setActiveProfile: (name: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string | null) => void;
  setManagementStatus: (status: ManagementStatus) => void;
  setManagementAuthError: (err: string | null) => void;
  setQueues: (queues: string[]) => void;
  setExchanges: (exchanges: ExchangeSummary[]) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  profiles: [] as ConnectionProfile[],
  activeProfileName: null as string | null,
  connectionStatus: "disconnected" as ConnectionStatus,
  connectionError: null as string | null,
  managementStatus: "unknown" as ManagementStatus,
  managementAuthError: null as string | null,
  queues: [] as string[],
  exchanges: [] as ExchangeSummary[],
} as const;

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...INITIAL_STATE,

  setProfiles: (profiles) => set({ profiles }),
  setActiveProfile: (name) => set({ activeProfileName: name }),
  setConnectionStatus: (status, error = null) =>
    set({ connectionStatus: status, connectionError: error }),
  setManagementStatus: (status) => set({ managementStatus: status }),
  setManagementAuthError: (err) => set({ managementAuthError: err }),
  setQueues: (queues) => set({ queues }),
  setExchanges: (exchanges) => set({ exchanges }),
  reset: () => set({ ...INITIAL_STATE }),
}));
