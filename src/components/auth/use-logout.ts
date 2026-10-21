"use client";

import { useState } from "react";

import { hardNavigate } from "@/lib/hard-navigate";
import { signOut } from "@/lib/auth-client";

/**
 * Signs out, then does a full page load of the login page so every server-rendered, session-dependent
 * part of the app (including the separate /admin root layout) starts fresh.
 */
export function useLogout(loginPath: string) {
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    try {
      await signOut();
    } finally {
      hardNavigate(loginPath);
    }
  }
  return { logout, pending };
}
