import type { ReactNode } from "react";
import { requireAuthenticatedUser } from "@/lib/authenticated-user";
import { LogoutButton } from "@/components/auth/logout-button";
import { ProtectedWorkspaceShell } from "@/components/navigation/protected-workspace-shell";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser();

  return <ProtectedWorkspaceShell account={user} accountAction={<LogoutButton />}>{children}</ProtectedWorkspaceShell>;
}
