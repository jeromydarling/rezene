import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ChevronDown } from "lucide-react";
import { Reveal } from "./cinema";
import { FAQ, faqSlug } from "../../shared/faq";

/**
 * The marketing FAQ — real questions independent labels ask about web software
 * (from community research), answered honestly against what Verto actually
 * does. Content lives in src/shared/faq.ts so this page and the FAQPage JSON-LD
 * (injected at the edge) stay in lockstep, which is what keeps the rich-result
 * markup legitimate.
 */
export function VertoFaq() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-28">
      <div className="mb-12 text-center">
        <Reveal>
          <p className="eyebrow mb-2">FAQ</p>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="display-hero text-4xl md:text-5xl">Questions, answered straight</h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="prose-editorial mx-auto mt-4 max-w-xl">
            The real things independent labels ask before they trust a platform with their shop — on
            cost, getting found, making clothes, getting paid, and owning your own data. No spin.
          </p>
        </Reveal>
      </div>

      <div className="space-y-10">
        {FAQ.map((category, ci) => (
          <Reveal key={category.title} delay={ci * 60}>
            <section>
              <h2 className="mb-3 font-display text-sm font-medium uppercase tracking-widest text-terracotta">
                {category.title}
              </h2>
              <div className="divide-y divide-ink/10 rounded-lg border border-ink/10 bg-white">
                {category.items.map((item) => (
                  <FaqRow key={item.q} slug={faqSlug(item)} q={item.q} a={item.a} />
                ))}
              </div>
            </section>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mt-16 rounded-lg border border-ink/10 bg-navy px-8 py-10 text-center text-chalk">
          <h2 className="font-display text-2xl font-light">Still weighing it up?</h2>
          <p className="prose-editorial mx-auto mt-2 max-w-md !text-chalk/70">
            Open a shop free for 14 days — no card — and see it with your own products, or read the
            honest, capability-by-capability comparison.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="btn btn-primary verto-sheen">
              Start free
            </Link>
            <Link to="/compare" className="btn btn-secondary !border-chalk/30 !text-chalk">
              Compare honestly
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function FaqRow({ slug, q, a }: { slug: string; q: string; a: string }) {
  const [open, setOpen] = useState(false);

  // Deep links: /faq#slug opens the question and scrolls it into view.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === `#${slug}`) {
      setOpen(true);
      document.getElementById(slug)?.scrollIntoView({ block: "center" });
    }
  }, [slug]);

  return (
    <div id={slug} className="scroll-mt-24">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-[0.95rem] font-medium text-ink">{q}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-warmgrey transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <p className="px-5 pb-5 text-sm leading-relaxed text-ink/70">{a}</p>}
    </div>
  );
}
