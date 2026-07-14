import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AppRouter } from "./router";
import { VertoApp } from "./verto/VertoApp";
import { getShop } from "./lib/shop";
import { initSentry, Sentry } from "./lib/sentry";
import "./styles/global.css";

// Start error monitoring before anything renders, so a crash during the
// first paint is still captured. No-op until the edge injects a DSN.
initSentry();

// The edge injects window.__VERTO__: a shop context on /<slug> (or a
// CNAME'd shop domain) boots the shop app under that base path; the
// platform root boots Verto's marketing site.
const shop = getShop();

// Verto HQ lives at the bare platform root under /admin (no shop context —
// the SuperAdmin session is in the platform database). Without a shop, the
// marketing app owns routing and has no /admin routes, so we must boot the
// admin AppRouter for /admin paths on the platform root. Shop admins already
// boot AppRouter via their shop context; this only covers the shopless HQ.
const path = typeof window !== "undefined" ? window.location.pathname : "";
const isPlatformAdmin = !shop && (path === "/admin" || path.startsWith("/admin/"));

/** Full-page fallback when a render crashes — captured by Sentry, friendly to the user. */
function CrashFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#2b2b2b",
      }}
    >
      <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>Something went wrong on this page.</p>
      <p style={{ maxWidth: "28rem", color: "#6b6b6b" }}>
        We've been notified and are looking into it. Reloading usually clears it — your work is
        saved.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: "0.5rem 1.25rem",
          borderRadius: "0.5rem",
          border: "1px solid #2b2b2b",
          background: "#2b2b2b",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        Reload
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      {shop || isPlatformAdmin ? (
        <BrowserRouter basename={shop?.basePath ?? ""}>
          <AppRouter />
        </BrowserRouter>
      ) : (
        <BrowserRouter>
          <VertoApp />
        </BrowserRouter>
      )}
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
