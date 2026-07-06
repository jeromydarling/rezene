import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useBrand } from "../../lib/brand";
import { api, ApiRequestError } from "../../lib/api";
import { PasswordInput } from "../../components/PasswordInput";

/**
 * Set-a-password page — backs both "forgot password" resets and "you've been
 * invited" onboarding (the ?welcome=1 flag just changes the copy). The token
 * is single-use and short-lived; the worker validates it.
 */
export function ResetPasswordPage() {
  const brand = useBrand();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const welcome = params.get("welcome") === "1";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Those passwords don’t match.");
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/reset", { token, password });
      setDone(true);
      setTimeout(() => navigate("/admin/login", { replace: true }), 1600);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-chalk">
          <p className="font-display text-2xl font-light">{brand.brandName}</p>
          <p className="mt-1 text-[0.65rem] uppercase tracking-editorial text-chalk/70">
            {welcome ? "Set up your account" : "Reset your password"}
          </p>
        </div>

        {!token ? (
          <div className="admin-card space-y-3 p-6 text-center">
            <p className="text-sm text-warmgrey">This link is missing its token. Request a new one from the sign-in page.</p>
            <Link to="/admin/login" className="link-quiet">
              Back to sign in
            </Link>
          </div>
        ) : done ? (
          <div className="admin-card space-y-2 p-6 text-center">
            <p className="font-display text-lg font-light">
              {welcome ? "You’re all set" : "Password updated"}
            </p>
            <p className="text-sm text-warmgrey">Taking you to sign in…</p>
          </div>
        ) : (
          <form onSubmit={submit} className="admin-card space-y-4 p-6">
            {welcome && (
              <p className="text-sm text-warmgrey">
                Welcome to {brand.brandName}. Choose a password to finish setting up your login.
              </p>
            )}
            <div>
              <label className="label" htmlFor="new-password">
                {welcome ? "Choose a password" : "New password"}
              </label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                required
                value={password}
                onChange={setPassword}
              />
              <p className="mt-1 text-xs text-warmgrey">At least 8 characters.</p>
            </div>
            <div>
              <label className="label" htmlFor="confirm-password">
                Confirm password
              </label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={setConfirm}
              />
            </div>
            {error && <p className="field-error">{error}</p>}
            <button type="submit" disabled={busy} className="btn btn-primary w-full">
              {busy ? "Saving…" : welcome ? "Create account" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
