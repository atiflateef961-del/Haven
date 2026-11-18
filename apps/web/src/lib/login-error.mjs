export function loginErrorMessage(status) {
  if (status === 429) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (status >= 500) {
    return "The sign-in service is unavailable. Please try again shortly.";
  }
  return "Sign-in failed. Check your email and password, then try again. For a password reset, contact your administrator.";
}
