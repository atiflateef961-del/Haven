import { AuthPage } from "@/components/auth/auth-page";

export default async function RegisterPage({ searchParams }: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <AuthPage registering initialEmail={email} />;
}
