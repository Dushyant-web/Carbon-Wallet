import { create } from "zustand";
import { Role } from "@/types";

interface AppState {
  activeHouseholdId: string;
  demoRole: Role;
  sidebarCollapsed: boolean;
  isLogModalOpen: boolean;
  isCreateModalOpen: boolean;
  setActiveHouseholdId: (id: string) => void;
  setDemoRole: (role: Role) => void;
  toggleSidebar: () => void;
  setLogModalOpen: (open: boolean) => void;
  setCreateModalOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeHouseholdId: "hh_01_sharma",
  demoRole: "OWNER",
  sidebarCollapsed: false,
  isLogModalOpen: false,
  isCreateModalOpen: false,
  setActiveHouseholdId: (id: string) => set({ activeHouseholdId: id }),
  setDemoRole: (role: Role) => set({ demoRole: role }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setLogModalOpen: (open: boolean) => set({ isLogModalOpen: open }),
  setCreateModalOpen: (open: boolean) => set({ isCreateModalOpen: open }),
}));
