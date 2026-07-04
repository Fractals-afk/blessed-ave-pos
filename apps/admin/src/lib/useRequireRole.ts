"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import type { UserRole } from "@blessed-ave/types";

// Guards a page to a set of roles. Redirects to `loginPath` if there's no
// session or the logged-in user's role isn't in `allowed` — used to keep
// e.g. a POS-only account out of the Kitchen page and vice versa.
export function useRequireRole(allowed: UserRole[], loginPath: string) {
  const router = useRouter();
  const { user, accessToken } = useAuth();

  const authorized = !!user && !!accessToken && allowed.includes(user.role);

  useEffect(() => {
    if (!accessToken || !user) {
      router.replace(loginPath);
      return;
    }
    if (!allowed.includes(user.role)) {
      router.replace(loginPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken]);

  return authorized;
}
