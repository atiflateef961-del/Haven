import { AuthPage } from "@/components/auth/auth-page";

export default async function LoginPasswordPage({ searchParams }: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return <AuthPage registering={false} initialEmail={email} initialStep="password" />;
}
