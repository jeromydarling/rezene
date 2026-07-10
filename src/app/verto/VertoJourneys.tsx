import { useNavigate } from "react-router";
import { MagneticButton, ParallaxImage, ParticleField, Reveal } from "./cinema";

/**
 * /stories — two founding journeys, told hour by hour. The features page
 * says what Verto does; this page shows a life changing around it: a
 * tailor going from zero to a paying client overnight, and a label going
 * from a blank screen to money in the till. Same cinematic grammar as
 * /why: reveals pace the narrative, one anchored image per act.
 */

const TAILOR_BEATS: { time: string; beat: string; detail: string }[] = [
  {
    time: "9:40 pm",
    beat: "She signs up.",
    detail:
      "Amara has altered suits for friends for years. Tonight she gives the studio a name. Verto spins up her shop while the kettle boils — storefront, admin, her own corner of the internet.",
  },
  {
    time: "9:55 pm",
    beat: "She shares one link.",
    detail:
      "Her shop came with a public “Book a consult” page. She puts the link in her Instagram bio and goes to bed. That's the whole launch.",
  },
  {
    time: "7:30 am",
    beat: "Three requests are waiting.",
    detail:
      "“A coat for autumn — something structured, in wool.” Each request sits at the top of her Client Book. One tap confirms it: the visitor becomes a client, their words already on the timeline.",
  },
  {
    time: "11:00 am",
    beat: "She measures her first client.",
    detail:
      "Chest, waist, shoulder — a dated set in the Client Book. Next season, when she measures again, this set stays. Bodies change; her records remember.",
  },
  {
    time: "2:00 pm",
    beat: "The coat exists before the cloth is cut.",
    detail:
      "She drafts the pattern to her client's exact measurements, then runs the true drape — real cloth physics hanging her actual pattern on a mannequin with her client's proportions, a fit map showing where it skims and where it pulls.",
  },
  {
    time: "4:30 pm",
    beat: "The client says yes from the bus.",
    detail:
      "Amara opens a commission and shares a portal link. Her client sees the renders on her own body, the stages in plain words — and taps Approve. The sign-off is on record before scissors touch wool.",
  },
  {
    time: "4:45 pm",
    beat: "The deposit is requested — and paid.",
    detail:
      "Half now, half at the final fitting. The request shows on the client's portal; the bank transfer lands that evening; Amara marks it paid. Less than a day after signing up, she is a business.",
  },
];

const LABEL_BEATS: { time: string; beat: string; detail: string }[] = [
  {
    time: "Day one, morning",
    beat: "A name becomes a brand.",
    detail:
      "Theo signs up with nothing but a name. The brand studio interviews him — who it's for, how it should feel — and hands back a logo, a palette, a voice. His storefront wears it everywhere, automatically.",
  },
  {
    time: "Day one, afternoon",
    beat: "The first capsule appears.",
    detail:
      "In the Design Studio he describes the line he's imagined for years. Flux generates looks that hold together — same house style, same light. He pins six. That's the capsule.",
  },
  {
    time: "Day one, evening",
    beat: "He sees it on real bodies.",
    detail:
      "Every look tries on across the model roster — different shapes, sizes, skin tones, the same bodies for every style. Two looks get refit tighter. One gets a second colorway. The line hangs together before a metre of fabric exists.",
  },
  {
    time: "Day two",
    beat: "Designs become specs.",
    detail:
      "Each look drafts into a real sewing pattern, and each pattern into a tech pack — measurements, BOM, construction — the document a factory can actually quote.",
  },
  {
    time: "Day three",
    beat: "He finds his maker.",
    detail:
      "Sourcing research turns up small-batch factories that match his cloth and his quantities. The tech pack travels to the factory portal; the sample conversation starts in one place, not seven email threads.",
  },
  {
    time: "Week two",
    beat: "Money arrives before production does.",
    detail:
      "He opens pre-orders that can't oversell, with real checkout and taxes handled. The campaign — written in his voice, for his edit — goes out to the list his site has been quietly collecting. Orders fund the production run.",
  },
];

function StoryTimeline({ beats, dark }: { beats: typeof TAILOR_BEATS; dark?: boolean }) {
  return (
    <ol className="relative mt-10 space-y-10 border-l border-current/15 pl-8">
      {beats.map((b, i) => (
        <Reveal key={b.time + b.beat} delay={i * 100}>
          <li className="relative">
            <span
              className={
                "absolute -left-[2.42rem] top-1 h-3 w-3 rounded-full " +
                (dark ? "bg-terracotta" : "bg-navy")
              }
            />
            <p className={"text-xs uppercase tracking-widest " + (dark ? "text-chalk/50" : "text-warmgrey")}>
              {b.time}
            </p>
            <h3 className="mt-1 font-display text-2xl font-light">{b.beat}</h3>
            <p className={"prose-editorial mt-2 max-w-2xl " + (dark ? "!text-chalk/75" : "")}>{b.detail}</p>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}

export function VertoJourneys() {
  const navigate = useNavigate();
  return (
    <>
      {/* Opening: two people, one platform. */}
      <section className="relative flex min-h-[75vh] items-end overflow-hidden bg-navy">
        <img
          src="/verto/dusk.jpg"
          alt="A studio window at dusk, work still on the table"
          fetchPriority="high"
          decoding="async"
          className="verto-kenburns absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy-deep/30 to-transparent" />
        <ParticleField />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-20 pt-40 text-chalk">
          <Reveal>
            <p className="eyebrow mb-4 !text-chalk/70">Two stories</p>
          </Reveal>
          <Reveal delay={150}>
            <h1 className="max-w-3xl font-display text-4xl font-light md:text-6xl">
              What actually happens when you press “create my shop.”
            </h1>
          </Reveal>
          <Reveal delay={300}>
            <p className="prose-editorial mt-6 max-w-2xl !text-chalk/80">
              Not a feature list — two nights and the mornings after them. A tailor with a phone
              full of people asking for coats. A designer with a capsule in his head and no
              factory. Here's how each of them gets to money.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Story one: the tailor — zero to a paying client overnight. */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="eyebrow mb-3">Story one · The tailor</p>
        </Reveal>
        <Reveal delay={150}>
          <h2 className="max-w-3xl font-display text-3xl font-light md:text-5xl">
            Zero to a paying client, overnight.
          </h2>
        </Reveal>
        <Reveal delay={250}>
          <p className="prose-editorial mt-4 max-w-2xl">
            Amara doesn't need a storefront full of products. Her product is her hands and her
            eye. What she needs is the machinery around a client — booking, measurements,
            sign-off, money — without hiring anyone or duct-taping five apps together.
          </p>
        </Reveal>
        <StoryTimeline beats={TAILOR_BEATS} />
        <Reveal delay={200}>
          <p className="prose-editorial mt-10 max-w-2xl text-lg">
            The next morning there are two more requests in her book. Nothing about her craft
            changed overnight. Everything about her business did.
          </p>
        </Reveal>
      </section>

      {/* Interlude image. */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-24 md:grid-cols-2">
        <Reveal>
          <ParallaxImage
            src="/verto/atelier.jpg"
            alt="A tailor pressing a seam on cream linen trousers"
            speed={0.3}
            className="aspect-[3/4] max-h-[70vh]"
          />
        </Reveal>
        <div>
          <Reveal delay={150}>
            <p className="eyebrow mb-3">The point</p>
          </Reveal>
          <Reveal delay={250}>
            <h2 className="font-display text-3xl font-light md:text-4xl">
              The craft was never the hard part.
            </h2>
          </Reveal>
          <Reveal delay={350}>
            <p className="prose-editorial mt-4">
              Every tailor and stylist already knows how to do the work. What stops them charging
              properly is everything around the work: the follow-ups in DMs, the measurements on
              paper scraps, the awkward “so, about the deposit” conversation. Verto turns that
              whole layer into a link you share and a page you glance at.
            </p>
          </Reveal>
          <Reveal delay={450}>
            <p className="prose-editorial mt-4">
              And the client feels it too — a portal with their own renders, plain-word progress,
              and a record of what they approved. Professional, before the first stitch.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Story two: the label — spin up, design, make money. */}
      <section className="bg-navy text-chalk">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Reveal>
            <p className="eyebrow mb-3 !text-chalk/50">Story two · The label</p>
          </Reveal>
          <Reveal delay={150}>
            <h2 className="max-w-3xl font-display text-3xl font-light md:text-5xl">
              Spin up a shop. Design the clothes. Get paid before production.
            </h2>
          </Reveal>
          <Reveal delay={250}>
            <p className="prose-editorial mt-4 max-w-2xl !text-chalk/80">
              Theo's problem is the opposite of Amara's: no clients yet, just a line he can see
              with his eyes closed — and no idea how solo designers get from picture to product
              to payment.
            </p>
          </Reveal>
          <StoryTimeline beats={LABEL_BEATS} dark />
          <Reveal delay={200}>
            <p className="prose-editorial mt-10 max-w-2xl text-lg !text-chalk/80">
              Week three, the samples arrive. The pre-orders already paid for them.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Close: the invitation. */}
      <section className="mx-auto max-w-6xl px-5 py-24 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-light md:text-5xl">
            Both stories start the same way.
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="prose-editorial mx-auto mt-4 max-w-xl">
            A name, an email, and a shop that exists before the kettle boils. The rest is your
            craft.
          </p>
        </Reveal>
        <Reveal delay={350}>
          <div className="mt-8 flex justify-center">
            <MagneticButton onClick={() => navigate("/signup")}>Create my shop</MagneticButton>
          </div>
        </Reveal>
      </section>
    </>
  );
}
