"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TextField } from "@/components/ui/text-field";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import { loginErrorMessage } from "@/lib/login-error.mjs";

function authApiUrl(path: "register" | "login") {
  return `${apiBaseUrl}/api/v1/auth/${path}`;
}

function isAuthResponse(value: unknown): value is { userId: string } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.userId === "string" && record.userId.length > 0;
}

export function AuthPage({
  registering,
  initialEmail = "",
  initialStep = "email",
}: {
  registering: boolean;
  initialEmail?: string;
  initialStep?: "email" | "password";
}) {
  const [email, setEmail] = useState(initialEmail);
  const [emailStep, setEmailStep] = useState(!registering && initialStep === "email");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Stop native GET navigation first so passwords are never serialized into the URL.
    event.preventDefault();
    if (!registering && emailStep) {
      setError("");
      setEmailError("");
      const emailInput = event.currentTarget.elements.namedItem("email");
      if (!(emailInput instanceof HTMLInputElement) || !emailInput.validity.valid) {
        setEmailError("Enter a valid email address.");
        return;
      }
      window.location.assign(`/login/password?email=${encodeURIComponent(email.trim())}`);
      return;
    }
    if (loading) return;
    setError("");
    setFullNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
    if (registering && !fullName.trim()) {
      setFullNameError("Enter your full name.");
      return;
    }
    if (registering) {
      const emailInput = event.currentTarget.elements.namedItem("email");
      if (!(emailInput instanceof HTMLInputElement) || !emailInput.validity.valid) {
        setEmailError(emailInput instanceof HTMLInputElement && emailInput.validity.valueMissing
          ? "Enter your email address."
          : "Enter a valid email address.");
        return;
      }
    }
    if (!registering && !password) {
      setPasswordError("Enter your password.");
      return;
    }
    if (registering && password.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }
    if (registering && password !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      return;
    }
    setLoading(true);

    try {
      const loginUrl = authApiUrl(registering ? "register" : "login");
      const response = await fetch(loginUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registering
          ? { fullName: fullName.trim(), email: email.trim(), password, confirmPassword }
          : { email: email.trim(), password }),
      });

      if (!response.ok) {
        if (registering && response.status === 409) setError("This email is already registered. Sign in instead.");
        else if (registering && response.status === 400) {
          if (password.length < 8) setPasswordError("Use at least 8 characters.");
          else setError("Check your name, email address, and password, then try again.");
        } else if (registering && response.status === 429) setError("Too many account attempts. Wait a minute and try again.");
        else if (registering && response.status === 503) setError("The API proxy is not configured. Set NEXT_PUBLIC_API_URL on the frontend server and restart or redeploy it.");
        else if (registering && response.status === 502) setError("The frontend server cannot reach the API. Check that the backend is running and NEXT_PUBLIC_API_URL points to its reachable URL.");
        else if (registering && response.status === 403) setError("The API rejected this frontend origin. Set the backend WEB_ORIGIN to the exact frontend origin and restart the API.");
        else if (registering && response.status >= 500) setError(`The account service returned a server error (HTTP ${response.status}). Check the backend logs and try again.`);
        else if (registering) setError(`Account creation was rejected (HTTP ${response.status}). Check the submitted details and backend configuration.`);
        else {
          setError(loginErrorMessage(response.status));
        }
        return;
      }

      let result: unknown;
      try {
        result = await response.json();
      } catch {
        setError(registering
          ? "The registration result could not be verified. Try signing in before submitting again."
          : "The sign-in result could not be verified. Please try again.");
        return;
      }
      if (!isAuthResponse(result)) {
        setError(registering
          ? "The registration result could not be verified. Try signing in before submitting again."
          : "The sign-in result could not be verified. Please try again.");
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError(registering
        ? "Could not reach the account service. Check the frontend API proxy and backend availability, then try again."
        : "The sign-in service is unavailable. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-page__toolbar"><ThemeToggle /></div>
      <SurfaceCard className="auth-card" padding="lg">
        <div className="auth-brand" aria-label="Hostel Management">
          <span className="auth-brand__mark" aria-hidden="true">H</span>
          <span>Haven <span className="auth-brand__muted">Management</span></span>
        </div>
        <p className="auth-eyebrow">PRIVATE PORTAL</p>
        <h1>{registering
          ? "Create your account"
          : emailStep ? "Welcome back" : "Enter your password"}</h1>
        <p className="auth-intro">{registering
          ? "Set up your Haven Management workspace. Your account will have access to its hostel modules."
          : emailStep
            ? "Enter your email address to continue."
            : "Enter your password to sign in to Haven Management."}</p>

        <form
          className="auth-form"
          action={!registering && emailStep ? "/login/password" : undefined}
          method={!registering && emailStep ? "get" : "post"}
          onSubmit={handleSubmit}
          noValidate={registering || !emailStep}
        >
          {registering ? <TextField
            label="Full name"
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Your full name"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setFullNameError("");
            }}
            disabled={loading}
            required
            maxLength={200}
            fieldSize="lg"
            error={fullNameError}
          /> : null}
          <TextField
            label="Email address"
            type="email"
            name="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            readOnly={!registering && !emailStep}
            disabled={loading}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError("");
            }}
            onInvalid={() => setEmailError("Enter a valid email address.")}
            required
            maxLength={320}
            fieldSize="lg"
            error={emailError}
          />
          {!registering && !emailStep ? (
            <button
              className="auth-link auth-change-email"
              type="button"
              disabled={loading}
              onClick={() => {
                setEmailStep(true);
                setPassword("");
                setError("");
                setPasswordError("");
              }}
            >
              Change email
            </button>
          ) : null}
          {registering || !emailStep ? <div className="auth-password-field">
            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete={registering ? "new-password" : "current-password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError("");
              }}
              disabled={loading}
              required
              maxLength={1024}
              fieldSize="lg"
              error={passwordError}
            />
            <button
              className="auth-password-toggle"
              type="button"
              aria-pressed={showPassword}
              disabled={loading}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div> : null}
          {registering ? <TextField
            label="Confirm password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setConfirmError("");
            }}
            disabled={loading}
            required
            maxLength={1024}
            fieldSize="lg"
            error={confirmError}
          /> : null}
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <Button
            className="auth-submit"
            type="submit"
            size="lg"
            loading={loading}
            disabled={loading}
            loadingLabel={registering ? "Creating account" : emailStep ? "Continuing" : "Signing in"}
          >
            {registering ? "Create account" : emailStep ? "Continue" : "Sign in"}
          </Button>
        </form>
        <p className="auth-support">
          {registering ? "Already have an account? " : "New here? "}
          <a className="auth-link" href={registering ? "/login" : `/register${email ? `?email=${encodeURIComponent(email)}` : ""}`}>
            {registering ? "Back to sign in" : "Create account"}
          </a>
        </p>
        {!registering ? <p className="auth-reset-note">Password recovery is available through your administrator.</p> : null}
      </SurfaceCard>
      <p className="auth-footer">A considered space for better hostel living.</p>
    </main>
  );
}
