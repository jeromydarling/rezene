import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * In-app product tours: coach-marks on the real UI. A tour is a list of steps;
 * each step targets a DOM element (by CSS selector — in practice a
 * [data-tour="…"] attribute, which survives styling refactors) and shows a
 * spotlight + a small card explaining it. Steps whose target isn't on the
 * page right now are skipped silently, so one tour definition tolerates
 * feature flags, empty states, and small layout changes.
 *
 * No dependencies: the spotlight is a fixed box with a huge box-shadow, the
 * card is clamped to the viewport, and everything recomputes on scroll/resize.
 */

export interface TourStep {
  /** CSS selector; omit for a centered intro/outro card. */
  target?: string;
  title: string;
  body: string;
}

export interface TourDef {
  key: string;
  label: string;
  steps: TourStep[];
}

interface TourContextValue {
  start: (tour: TourDef) => void;
  stop: () => void;
  activeKey: string | null;
}

const TourContext = createContext<TourContextValue>({ start: () => {}, stop: () => {}, activeKey: null });

export function useTour(): TourContextValue {
  return useContext(TourContext);
}

const PAD = 8; // spotlight breathing room around the target

function findTarget(step: TourStep): HTMLElement | null {
  if (!step.target) return null;
  try {
    return document.querySelector<HTMLElement>(step.target);
  } catch {
    return null;
  }
}

/** Steps that can actually render right now (target present, or targetless). */
function usableSteps(tour: TourDef): TourStep[] {
  return tour.steps.filter((s) => !s.target || findTarget(s));
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [tour, setTour] = useState<TourDef | null>(null);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef(0);

  const stop = useCallback(() => {
    setTour(null);
    setSteps([]);
    setIdx(0);
    setRect(null);
  }, []);

  const start = useCallback((t: TourDef) => {
    const usable = usableSteps(t);
    if (usable.length === 0) return;
    setTour(t);
    setSteps(usable);
    setIdx(0);
    try {
      localStorage.setItem(`verto_tour_${t.key}`, "seen");
    } catch {
      /* private mode */
    }
  }, []);

  const step = tour ? steps[idx] : null;

  // Track the current target's rectangle; follow scroll/resize cheaply.
  useEffect(() => {
    if (!step) return;
    const el = findTarget(step);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => {
      const node = findTarget(step);
      setRect(node ? node.getBoundingClientRect() : null);
      rafRef.current = requestAnimationFrame(measure);
    };
    rafRef.current = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step]);

  // Keyboard: arrows navigate, Escape leaves.
  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      if (e.key === "ArrowRight" && idx < steps.length - 1) setIdx((i) => i + 1);
      if (e.key === "ArrowLeft" && idx > 0) setIdx((i) => i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, idx, steps.length, stop]);

  // Card position: under the target when there's room, above otherwise,
  // clamped to the viewport; centered when the step has no target.
  const cardStyle: React.CSSProperties = (() => {
    const W = Math.min(340, window.innerWidth - 24);
    if (!step?.target || !rect) {
      return { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: W };
    }
    const below = rect.bottom + PAD + 12;
    const spaceBelow = window.innerHeight - below;
    const top = spaceBelow > 220 ? below : Math.max(12, rect.top - PAD - 12 - 200);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - W - 12);
    return { position: "fixed", top, left, width: W };
  })();

  return (
    <TourContext.Provider value={{ start, stop, activeKey: tour?.key ?? null }}>
      {children}
      {tour && step && (
        <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label={`${tour.label} tour`}>
          {/* Spotlight: the cutout is a fixed box whose shadow dims the rest. */}
          {step.target && rect ? (
            <div
              className="pointer-events-none fixed rounded-lg transition-all duration-200"
              style={{
                top: rect.top - PAD,
                left: rect.left - PAD,
                width: rect.width + PAD * 2,
                height: rect.height + PAD * 2,
                boxShadow: "0 0 0 100vmax rgba(16, 22, 32, 0.62)",
              }}
            />
          ) : (
            <div className="pointer-events-none fixed inset-0 bg-navy-deep/60" />
          )}
          {/* Click-away layer (under the card, over the page). */}
          <button type="button" aria-label="End tour" className="fixed inset-0 h-full w-full cursor-default" onClick={stop} />

          <div className="admin-card z-[121] p-4 shadow-2xl" style={cardStyle}>
            <p className="text-[0.62rem] font-semibold uppercase tracking-wider text-terracotta">
              {tour.label} · {idx + 1} of {steps.length}
            </p>
            <h3 className="mt-1 text-sm font-semibold">{step.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-warmgrey">{step.body}</p>
            <div className="mt-3 flex items-center justify-between">
              <button type="button" className="text-xs text-warmgrey hover:text-ink" onClick={stop}>
                Skip tour
              </button>
              <div className="flex gap-2">
                {idx > 0 && (
                  <button type="button" className="btn btn-secondary !px-3 !py-1 text-xs" onClick={() => setIdx((i) => i - 1)}>
                    Back
                  </button>
                )}
                {idx < steps.length - 1 ? (
                  <button type="button" className="btn btn-primary !px-3 !py-1 text-xs" onClick={() => setIdx((i) => i + 1)}>
                    Next
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary !px-3 !py-1 text-xs" onClick={stop}>
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </TourContext.Provider>
  );
}
