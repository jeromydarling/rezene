import { useNavigate } from "react-router";
import { MagneticButton, ParallaxImage, ParticleField, Reveal } from "./cinema";

/**
 * /stories — founding journeys, told hour by hour. The features page says
 * what Verto does; this page shows a life changing around it: a tailor
 * going from zero to a paying client overnight, a label going from a blank
 * screen to money in the till, a founder deciding a season on evidence
 * instead of feelings, and an established brand moving in over one
 * afternoon. Same cinematic grammar as /why: reveals pace the narrative,
 * one anchored image per act, light and dark sections alternating. Every
 * beat is a shipped feature wearing a person; every story ends at money.
 */

const TAILOR_BEATS: { time: string; beat: string; detail: string }[] = [
  {
    time: "9:40 pm",
    beat: "She signs up.",
    detail:
      "Amara is a stylist. She has the eye, the Instagram following, and a phone full of people asking where to get a jacket like hers — and she has never cut a jacket in her life. She doesn't need to. Verto spins up her studio while the kettle boils.",
  },
  {
    time: "9:55 pm",
    beat: "She shares one link.",
    detail:
      "Her shop came with a public “Book a consult” page. She puts the link in her bio and goes to bed. That's the whole launch.",
  },
  {
    time: "7:30 am",
    beat: "Three requests are waiting.",
    detail:
      "“A structured wool jacket — something I can wear to everything.” Each request sits at the top of her Client Book. One tap confirms it: the visitor becomes a client, their words already on the timeline.",
  },
  {
    time: "11:00 am",
    beat: "She measures her first client.",
    detail:
      "Chest, waist, shoulder — a dated set in the Client Book. Next season, when she measures again, this set stays. Bodies change; her records remember.",
  },
  {
    time: "2:00 pm",
    beat: "The jacket exists before the cloth.",
    detail:
      "She styles the design and Verto drafts the real pattern to her client's exact measurements — she never touches a ruler. Then the true drape: actual cloth physics hanging that pattern on her client's proportions, with a fit map showing where it skims and where it pulls.",
  },
  {
    time: "4:30 pm",
    beat: "The client says yes from the bus — and the quote is real.",
    detail:
      "Amara opens a commission at $850 — the going rate for made-to-measure, and she already knows her side of it: about $95 in cloth and trims, around $220 for a maker's cut-and-sew, roughly $535 for her eye and her fittings. Her client sees the renders on her own body and taps Approve.",
  },
  {
    time: "4:45 pm",
    beat: "The deposit lands.",
    detail:
      "Half now — $425 — half at the final fitting. The request shows on the client's portal; the transfer arrives that evening; Amara marks it paid. Less than a day after signing up, she is a business.",
  },
  {
    time: "Day three",
    beat: "She finds her maker.",
    detail:
      "Amara designs and fits; someone else sews. Verto's sourcing research turns up a small workshop forty minutes away that takes single tailored pieces at around $220 cut-and-make — and the pattern, the drape, and the fitting notes travel to them as one clean brief. The two runners-up stay warm in her R&D pipeline for the week she needs more hands. The deposit already covers the make before a metre of wool is bought.",
  },
]

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
      "The overshirt goes up for pre-order at $145 — mid-band in his R&D price study of real comparables, not a number pulled from the air. His Verto cost sheet — not a guess — says $46 landed: $14 cloth, $23 cut-and-sew, $4 trims and packaging, $5 freight and duties. Forty-four pre-orders in two weeks banks $6,380 against a $2,760 run of sixty. The campaign, written in his voice for his edit, did the selling.",
  },
];

const FOUNDER_BEATS: { time: string; beat: string; detail: string }[] = [
  {
    time: "Sunday, 4:00 pm",
    beat: "She names the competition.",
    detail:
      "Leila's label is two years old, and every price she has ever set was a feeling. She opens R&D and adds the three brands her customer cross-shops. One research pass each builds the dossier: who they sell to, what things actually cost, whose racks they hang on — every claim with its source sitting underneath it.",
  },
  {
    time: "4:30 pm",
    beat: "Two go on watch.",
    detail:
      "The direct competitors get the watch flag. From now on Verto re-researches them about once a week and tells her what changed — a price move, a new stockist, a campaign — in the same morning digest that chases her late samples. Competitive research stops being a thing she means to do.",
  },
  {
    time: "5:00 pm",
    beat: "The price question gets a study.",
    detail:
      "“Linen maxi dress — US direct-to-consumer.” The comps table fills with real garments at real prices, from a $69 fast-fashion maxi to a $420 hand-woven one, each with its fabric and where it's made. The defensible band for a label with a making story reads clearly: $125–265.",
  },
  {
    time: "5:20 pm",
    beat: "The number lands in costing.",
    detail:
      "She decides $145 and pushes it straight into the style's cost sheet. Margin appears next to the cloth she already priced: 62 points. The season's first price is a decision with receipts — and when a buyer later asks “why $145?”, she has an answer that isn't a shrug.",
  },
  {
    time: "That evening",
    beat: "A direction earns its place.",
    detail:
      "Her trend board on fluid tailoring comes back grounded: who's actually showing it, which cloths carry the look, and how to cut it small-batch without chasing drops. She adopts the board and the brief lands in the Design Studio as a concept, directions attached, ready to generate.",
  },
  {
    time: "Tuesday, week two",
    beat: "The digest catches a move.",
    detail:
      "“Watched brand refreshed — see what changed.” Her closest competitor raised knit prices and landed two new boutiques; the dossier keeps the old version as a snapshot, so the change is a diff, not a memory. She adjusts nothing yet. But she knows, and knowing cost her nothing.",
  },
  {
    time: "Week three",
    beat: "She pitches the doors that already believe.",
    detail:
      "Her stockist list started inside the dossiers — the boutiques already carrying her comp set, profiled with what they stock and how they buy. Two pitched, one in talks. When the buyer says yes, they sign into her wholesale portal and write the first order at their own pricing, net terms attached.",
  },
];

const SWITCHER_BEATS: { time: string; beat: string; detail: string }[] = [
  {
    time: "Saturday, 10:00 am",
    beat: "She exports four years of business.",
    detail:
      "Nadia's label is real — forty styles, three makers, a season mid-flight — and it lives in spreadsheets, a template storefront, and DM threads. Moving always felt like moving house. She exports three CSVs from her old tools and signs up.",
  },
  {
    time: "10:20 am",
    beat: "The catalog imports itself.",
    detail:
      "The Import Studio reads her odd column names, maps them to fields on its own, and flags the two rows missing prices instead of choking on them. Forty products land with their variants, images queued to follow. She corrects one mapping. That was the migration.",
  },
  {
    time: "11:00 am",
    beat: "Her makers become records.",
    detail:
      "The maker spreadsheet lands in R&D with its research phrasing intact — “1–50 (managed)”, “2–4 wks sample” stay as words, because flattening them to a number would lie. The three workshops she actually works with get promoted into Factories & Suppliers and marked verified; the maybes stay warm in the pipeline.",
  },
  {
    time: "Noon",
    beat: "The season in flight comes with her.",
    detail:
      "The two purchase orders sitting at factories go onto the board with their real dates. The sample ladder picks up mid-rung — one style at proto, one waiting on a fit sample. Nothing pretends the season started today.",
  },
  {
    time: "2:00 pm",
    beat: "Materials carry their origins.",
    detail:
      "Her linen, her trims, the mills they come from and the countries they ship from — entered once, then working everywhere: landed-cost math, duty estimates, and the product passports her stockists have started asking about.",
  },
  {
    time: "3:00 pm",
    beat: "The domain follows her.",
    detail:
      "She points her domain at Verto and saves it in settings. The certificate issues; the first visit over HTTPS flips it live automatically. Her customers never see the move happen — Saturday afternoon, the same address, a better shop behind it.",
  },
  {
    time: "Monday morning",
    beat: "The season starts running itself.",
    detail:
      "A sample approval drafts its own purchase order. The confirmed PO files its own chase task for the promised date. Her digest lists the three things that actually need her, and the calendar filled itself in from orders and fittings she never typed twice. Four years of spreadsheet discipline, replaced in an afternoon.",
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
            <p className="eyebrow mb-4 !text-chalk/70">Four stories</p>
          </Reveal>
          <Reveal delay={150}>
            <h1 className="max-w-3xl font-display text-4xl font-light md:text-6xl">
              What actually happens when you press “create my shop.”
            </h1>
          </Reveal>
          <Reveal delay={300}>
            <p className="prose-editorial mt-6 max-w-2xl !text-chalk/80">
              Not a feature list — four people and the hours that changed their businesses. A
              stylist with a phone full of people asking for jackets. A designer with a capsule in
              his head and no factory. A founder tired of pricing by feel. A label four years deep
              in spreadsheets. Here's how each of them gets to money.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Story one: the tailor — zero to a paying client overnight. */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="eyebrow mb-3">Story one · The stylist</p>
        </Reveal>
        <Reveal delay={150}>
          <h2 className="max-w-3xl font-display text-3xl font-light md:text-5xl">
            Zero to a paying client, overnight.
          </h2>
        </Reveal>
        <Reveal delay={250}>
          <p className="prose-editorial mt-4 max-w-2xl">
            Amara doesn't need a storefront full of products, and she doesn't need to know how
            to sew. Her product is her eye. What she needs is the machinery around a client —
            booking, measurements, a real pattern, a maker, sign-off, money — without hiring
            anyone or duct-taping five apps together.
          </p>
        </Reveal>
        <StoryTimeline beats={TAILOR_BEATS} />
        <Reveal delay={200}>
          <p className="prose-editorial mt-10 max-w-2xl text-lg">
            The next morning there are two more requests in her book. At $535 kept per jacket,
            two commissions a week is a living; four is a studio. Nothing about her taste changed
            overnight. Everything about her business did.
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
              Every stylist already knows what looks right on a body, and every good maker can sew
              it. What kept them apart was everything in between: the pattern drafting, the
              follow-ups in DMs, the measurements on paper scraps, the awkward “so, about the
              deposit” conversation. Verto turns that whole layer into a link you share, a brief
              your maker receives, and a page you glance at.
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
              Week three, the samples arrive. The pre-orders already paid for them — and the
              margin was never a guess: 68 points, printed on his cost sheet before he sold a
              single piece.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Story three: the founder — a season decided on evidence. */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="eyebrow mb-3">Story three · The founder</p>
        </Reveal>
        <Reveal delay={150}>
          <h2 className="max-w-3xl font-display text-3xl font-light md:text-5xl">
            A season decided on evidence, not vibes.
          </h2>
        </Reveal>
        <Reveal delay={250}>
          <p className="prose-editorial mt-4 max-w-2xl">
            Leila can design and she can make. What has always been foggy is everything around the
            work: what the competition actually charges, what her linen maxi should retail for,
            which direction deserves the season, and which boutiques would ever say yes. Big brands
            have research departments for those questions. She has a Sunday afternoon and R&D.
          </p>
        </Reveal>
        <StoryTimeline beats={FOUNDER_BEATS} />
        <Reveal delay={200}>
          <p className="prose-editorial mt-10 max-w-2xl text-lg">
            Nothing in her season is a feeling anymore. The price has comparables, the direction
            has sources, the pitch list came from evidence — and the watching continues while she
            cuts. She spent one afternoon deciding and kept the receipts.
          </p>
        </Reveal>
      </section>

      {/* Interlude image two. */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-24 md:grid-cols-2">
        <div className="md:order-2">
          <Reveal>
            <ParallaxImage
              src="/verto/research.jpg"
              alt="A studio wall of pinned research — swatches, tearsheets and handwritten notes in raking afternoon light"
              speed={0.3}
              className="aspect-[3/4] max-h-[70vh]"
            />
          </Reveal>
        </div>
        <div className="md:order-1">
          <Reveal delay={150}>
            <p className="eyebrow mb-3">The point</p>
          </Reveal>
          <Reveal delay={250}>
            <h2 className="font-display text-3xl font-light md:text-4xl">
              Research you can act on keeps its receipts.
            </h2>
          </Reveal>
          <Reveal delay={350}>
            <p className="prose-editorial mt-4">
              Every founder does this research already — in seventeen tabs, a screenshot folder,
              and a note that says “competitor raised prices??”. It evaporates. In Verto every
              answer lands with its sources attached, every dossier remembers what it said last
              month, and the decisions flow into the tools that spend the money: the cost sheet,
              the Design Studio, the pitch list.
            </p>
          </Reveal>
          <Reveal delay={450}>
            <p className="prose-editorial mt-4">
              And the watching runs on the same allowance as your own questions, capped and
              honest — an assistant, not a meter that spins while you sleep.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Story four: the switcher — an established brand moves in. */}
      <section className="bg-navy text-chalk">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Reveal>
            <p className="eyebrow mb-3 !text-chalk/50">Story four · The switcher</p>
          </Reveal>
          <Reveal delay={150}>
            <h2 className="max-w-3xl font-display text-3xl font-light md:text-5xl">
              Four years of business, moved in one afternoon.
            </h2>
          </Reveal>
          <Reveal delay={250}>
            <p className="prose-editorial mt-4 max-w-2xl !text-chalk/80">
              Nadia isn't starting — she's switching, which is scarier. A real catalog, real
              makers, a season already at the factory, customers who know her address. The move
              only works if nothing gets dropped and nobody notices the seams.
            </p>
          </Reveal>
          <StoryTimeline beats={SWITCHER_BEATS} dark />
          <div className="mt-12 grid items-center gap-10 md:grid-cols-2">
            <Reveal delay={200}>
              <p className="prose-editorial max-w-2xl text-lg !text-chalk/80">
                Sunday she did nothing, because nothing needed her. The catalog, the makers, the
                season, the domain — all of it moved; none of it broke. The only thing she left
                behind was the spreadsheet.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <ParallaxImage
                src="/verto/move.jpg"
                alt="A garment rail of cream linen wheeled down a whitewashed coastal street at golden hour"
                speed={0.25}
                className="aspect-[3/4] max-h-[60vh]"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Close: the invitation. */}
      <section className="mx-auto max-w-6xl px-5 py-24 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-light md:text-5xl">
            Every story starts the same way.
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
