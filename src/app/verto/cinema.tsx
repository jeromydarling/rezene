import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/**
 * Cinematic primitives for the Verto marketing site.
 *
 * Design rules every primitive obeys:
 *  1. Motion carries meaning — it directs attention, paces reading, or
 *     communicates depth. Nothing loops forever in the reading path.
 *  2. `prefers-reduced-motion` disables all of it (content is identical).
 *  3. Scroll work is IntersectionObserver + one passive rAF loop — no
 *     layout thrash, nothing runs for offscreen elements.
 */

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// ---------- Reveal: content enters as the reader reaches it ----------
// Why it helps: sections appearing on arrival paces the page like scenes —
// the reader is never confronted with a wall; each idea gets a beat.
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "h2" | "p" | "li" | "span";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return setVisible(true);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : `translateY(${y}px)`,
        transition: `opacity 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: visible ? undefined : "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}

/** Word-by-word headline reveal — reads like a title card being set. */
export function StaggerWords({
  text,
  className = "",
  step = 80,
  startDelay = 100,
}: {
  text: string;
  className?: string;
  step?: number;
  startDelay?: number;
}) {
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((word, i) => (
        <Reveal key={i} as="span" delay={startDelay + i * step} y={18} className="inline-block">
          <span className="inline-block">{word}&nbsp;</span>
        </Reveal>
      ))}
    </span>
  );
}

// ---------- Parallax: depth without dizziness ----------
// Why it helps: images drifting slower than the page reads as physical
// depth — a dolly move, not a gimmick. Clamped to ±8% so it never fights
// the layout; a single shared rAF loop keeps it at 60fps.
const parallaxTargets = new Set<{ el: HTMLElement; speed: number }>();
let parallaxLoop = 0;

function tickParallax() {
  for (const target of parallaxTargets) {
    const rect = target.el.getBoundingClientRect();
    const viewport = window.innerHeight;
    if (rect.bottom < -100 || rect.top > viewport + 100) continue;
    const progress = (rect.top + rect.height / 2 - viewport / 2) / viewport; // -0.5..0.5-ish
    target.el.style.transform = `translateY(${(-progress * target.speed * 100).toFixed(2)}px) scale(1.12)`;
  }
  parallaxLoop = requestAnimationFrame(tickParallax);
}

export function ParallaxImage({
  src,
  alt,
  speed = 0.5,
  className = "",
  imgClassName = "",
}: {
  src: string;
  alt: string;
  speed?: number;
  className?: string;
  imgClassName?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced || !ref.current) return;
    const target = { el: ref.current, speed };
    parallaxTargets.add(target);
    if (parallaxTargets.size === 1) parallaxLoop = requestAnimationFrame(tickParallax);
    return () => {
      parallaxTargets.delete(target);
      if (parallaxTargets.size === 0) cancelAnimationFrame(parallaxLoop);
    };
  }, [speed, reduced]);

  return (
    <div className={`overflow-hidden ${className}`}>
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading="lazy"
        className={`h-full w-full object-cover ${imgClassName}`}
        style={reduced ? undefined : { transform: "scale(1.12)", willChange: "transform" }}
      />
    </div>
  );
}

// ---------- Particle dust: the hero's atmosphere ----------
// Why it helps: ~36 slow, warm motes drifting like coastal dust in sunlight
// make the hero feel alive without motion in the text's reading path.
// Opacity is capped low; the canvas pauses when offscreen or reduced-motion.
export function ParticleField({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    let running = true;

    const resize = () => {
      const parent = canvas.parentElement!;
      width = canvas.width = parent.clientWidth;
      height = canvas.height = parent.clientHeight;
    };
    resize();

    const motes = Array.from({ length: 36 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.8,
      vx: (Math.random() - 0.3) * 0.00012,
      vy: -0.00004 - Math.random() * 0.00008,
      a: 0.06 + Math.random() * 0.14,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    const draw = () => {
      if (!running) return;
      t += 1;
      ctx.clearRect(0, 0, width, height);
      for (const m of motes) {
        m.x += m.vx + Math.sin(t / 240 + m.phase) * 0.00005;
        m.y += m.vy;
        if (m.y < -0.02) (m.y = 1.02), (m.x = Math.random());
        if (m.x < -0.02) m.x = 1.02;
        if (m.x > 1.02) m.x = -0.02;
        const twinkle = 0.75 + Math.sin(t / 90 + m.phase) * 0.25;
        ctx.beginPath();
        ctx.arc(m.x * width, m.y * height, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(250, 247, 240, ${(m.a * twinkle).toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    const io = new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting;
      if (running) raf = requestAnimationFrame(draw);
      else cancelAnimationFrame(raf);
    });
    io.observe(canvas);
    window.addEventListener("resize", resize, { passive: true });
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  if (reduced) return null;
  return <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden />;
}

// ---------- Scroll progress across a pinned scene ----------
// Why it helps: the manifesto reads one line at a time as the visitor
// scrolls — the pacing of the pitch is handed to their thumb.
export function useSceneProgress(ref: React.RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const done = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
        setProgress(total > 0 ? done / total : 0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
  return progress;
}

// ---------- Typewriter: the AI writing in front of you ----------
// Why it helps: "AI writes in your voice" is an abstract claim; watching a
// caption compose itself makes the product's core moment literal.
export function Typewriter({ lines, className = "" }: { lines: string[]; className?: string }) {
  const [display, setDisplay] = useState("");
  const [lineIndex, setLineIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setStarted(true), {
      threshold: 0.4,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    if (reduced) return setDisplay(lines[0]);
    const line = lines[lineIndex % lines.length];
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const type = () => {
      i += 1;
      setDisplay(line.slice(0, i));
      if (i < line.length) timer = setTimeout(type, 26 + Math.random() * 34);
      else timer = setTimeout(() => setLineIndex((n) => n + 1), 3200);
    };
    timer = setTimeout(type, 300);
    return () => clearTimeout(timer);
  }, [started, lineIndex, lines, reduced]);

  return (
    <div ref={ref} className={className}>
      {display}
      <span className="verto-cursor" aria-hidden>
        ▍
      </span>
    </div>
  );
}

// ---------- Magnetic CTA ----------
// Why it helps: the primary action responding to approach makes the most
// important element on the page feel touchable — a nudge, not a trick.
export function MagneticButton({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduced = usePrefersReducedMotion();

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el || reduced) return;
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.18}px)`;
    },
    [reduced],
  );
  const onLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = "";
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`verto-sheen transition-transform duration-200 ease-out ${className}`}
    >
      {children}
    </button>
  );
}

// ---------- Tilt card ----------
// Why it helps: pricing cards tilting toward the cursor communicates
// "pick one of these" — comparison becomes tactile. 3° max: presence, not
// a carnival.
export function TiltCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  return (
    <div
      ref={ref}
      className={`transition-transform duration-200 ease-out ${className}`}
      style={style}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el || reduced) return;
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-py * 3).toFixed(2)}deg) rotateY(${(px * 3).toFixed(2)}deg) translateY(-4px)`;
      }}
      onMouseLeave={() => {
        if (ref.current) ref.current.style.transform = "";
      }}
    >
      {children}
    </div>
  );
}

/** Has the page scrolled past a threshold (nav chrome state)? */
export function useScrolledPast(threshold = 40): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return past;
}
