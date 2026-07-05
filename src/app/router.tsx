import { Route, Routes } from "react-router";

// Placeholder route table — public and admin shells land in the next milestones.
export function AppRouter() {
  return (
    <Routes>
      <Route
        path="*"
        element={
          <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="eyebrow">Casablanca · Atlantic Riviera</p>
            <h1 className="display-hero text-5xl">Maison Atlantique</h1>
            <p className="prose-editorial max-w-md">
              Tailored resortwear cut in Casablanca. The site is being fitted —
              like a good trouser, it takes a few passes.
            </p>
          </main>
        }
      />
    </Routes>
  );
}
