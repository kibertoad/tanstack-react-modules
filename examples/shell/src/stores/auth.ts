import { createStore } from "zustand/vanilla";
import type { AuthStore } from "@example/app-shared";

export const authStore = createStore<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (credentials) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    set({
      user: {
        id: "usr-001",
        name: "Demo User",
        email: credentials.email,
        role: "admin",
      },
      token: "mock-jwt-token",
      isAuthenticated: true,
    });
  },

  logout: () => {
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
