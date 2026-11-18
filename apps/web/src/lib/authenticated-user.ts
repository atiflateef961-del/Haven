import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AuthenticatedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const cookieStore = await cookies();
  const session = cookieStore.get("hms_session")?.value;
  if (!session) redirect("/login");

  const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
    headers: { Cookie: `hms_session=${encodeURIComponent(session)}` },
    cache: "no-store",
  });

  if (response.status === 401) redirect("/login");
  if (!response.ok) throw new Error("Unable to verify the current session.");

  const user: unknown = await response.json();
  if (
    typeof user !== "object" || user === null ||
    !("id" in user) || typeof user.id !== "string" ||
    !("email" in user) || typeof user.email !== "string" ||
    !("firstName" in user) || typeof user.firstName !== "string" ||
    !("lastName" in user) || typeof user.lastName !== "string"
  ) {
    throw new Error("The session service returned an invalid profile.");
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}
