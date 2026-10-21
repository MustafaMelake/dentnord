"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/shared/button";

import { useLogout } from "./use-logout";

export function LogoutButton({
  label,
  loginPath,
  className,
}: {
  label: string;
  loginPath: string;
  className?: string;
}) {
  const { logout, pending } = useLogout(loginPath);
  return (
    <Button variant="secondary" onClick={logout} disabled={pending} className={className}>
      <span className="inline-flex items-center gap-2">
        <LogOut aria-hidden className="size-4" />
        {label}
      </span>
    </Button>
  );
}
