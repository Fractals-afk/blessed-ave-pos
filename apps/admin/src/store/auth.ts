import { create } from "zustand";
import type { User } from "@blessed-ave/types";

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

function readStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("authUser");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export const useAuth = create<AuthStore>((set) => ({
  user: readStoredUser(),
  accessToken: typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,

  setAuth: (user, accessToken, refreshToken) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("authUser", JSON.stringify(user));
    }
    set({ user, accessToken });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("authUser");
    }
    set({ user: null, accessToken: null });
  },
}));
