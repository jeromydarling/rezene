import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../lib/auth";
import { useBrand } from "../../lib/brand";
import { api, ApiRequestError } from "../../lib/api";
import { isDemoShop } from "../../lib/shop";

export function LoginPage() {
  const { user, loading, login, refresh } = useAuth();
  const brand = useBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // On the demo shop the gate is the default; credentials are one tap away.
  const [showCredentials, setShowCredentials] = useState(false);
  const demo = isDemoShop();

  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from ?? "/admin";
    return <Navigate to={from} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? "/admin", { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitDemo(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/demo-access", { email });
      await refresh();
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong — try again");
    } finally {
      setBusy(false);
    }
  }

  if (demo && !showCredentials) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy px-5">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center text-chalk">
            <p className="eyebrow !text-terracotta">Verto demo</p>
            <p className="mt-2 font-display text-2xl font-light">Step inside the admin</p>
            <p className="mx-auto mt-3 max-w-xs text-sm text-chalk/70">
              {brand.brandName} is a fictional label running on Verto — real catalog, production
              calendar, tech packs, and AI marketing. Leave your email and look around.
            </p>
          </div>
          <form onSubmit={submitDemo} className="admin-card space-y-4 p-6">
            <div>
              <label className="label" htmlFor="demo-email">
                Work email
              </label>
              <input
                id="demo-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@yourlabel.com"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="field-error">{error}</p>}
            <button type="submit" disabled={busy} className="btn btn-primary w-full">
              {busy ? "Opening the demo…" : "Explore the demo admin"}
            </button>
            <p className="text-center text-xs text-warmgrey">
              Read-only tour — look at everything, break nothing. We'll only use your email to
              follow up about Verto.
            </p>
          </form>
          <p className="mt-4 text-center text-xs text-chalk/50">
            <button type="button" className="underline hover:text-chalk" onClick={() => setShowCredentials(true)}>
              Have credentials? Sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-chalk">
          <p className="font-display text-2xl font-light">{brand.brandName}</p>
          <p className="mt-1 text-[0.65rem] uppercase tracking-editorial text-chalk/50">
            Brand Operating System
          </p>
        </div>
        <form onSubmit={submit} className="admin-card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="username"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="field-error">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-xs text-warmgrey">
            First run? Sign in with ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD to
            bootstrap the founder account.
          </p>
        </form>
      </div>
    </div>
  );
}
