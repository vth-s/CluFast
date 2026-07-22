import { create } from "zustand";
import { wsClient } from "../lib/ws-client.js";
import type { User } from "@cordfast/shared";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("cf_token"),
  isAuthenticated: !!localStorage.getItem("cf_token"),

  login: (user, token) => {
    localStorage.setItem("cf_token", token);
    set({ user, token, isAuthenticated: true });
    wsClient.connect(token);
  },

  logout: () => {
    localStorage.removeItem("cf_token");
    wsClient.disconnect();
    set({ user: null, token: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),
}));
