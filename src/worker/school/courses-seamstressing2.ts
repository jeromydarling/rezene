import type { CourseDef } from "./types";

/**
 * School of Seamstressing, courses 2–3: drafting & draping, then the
 * finishing details — adapted from Mary Brooks Picken's Woman's Institute
 * booklets, Jane Fales's Columbia textbook, and Butterick's manuals. All
 * verified public-domain scans.
 */

export const S2: CourseDef = {
  slug: "drafting-and-draping",
  school: "seamstressing",
  title: "Drafting & Draping",
  summary:
    "The two roads from body to pattern — Picken's drafting lessons and her scissors-and-cloth draping method, with Fales's textbook rigor underneath.",
  level: "intermediate",
  sources: [
    { label: "Mary Brooks Picken — Pattern Drafting (1920)", iaId: "patterdraftingpicken", url: "https://archive.org/details/patterdraftingpicken" },
    { label: "Woman's Institute — Draping and Designing with Scissors and Cloth (1924)", iaId: "draping-and-designing-with-scissors-and-cloth", url: "https://archive.org/details/draping-and-designing-with-scissors-and-cloth" },
    { label: "Jane Fales — Dressmaking (1917)", iaId: "dressmaking00fale", url: "https://archive.org/details/dressmaking00fale" },
  ],
  lessons: [
    {
      title: "Measuring a woman's figure (and trusting it)",
      minutes: 8,
      source: { label: "Picken, Pattern Drafting, opening", url: "https://archive.org/details/patterdraftingpicken" },
      bodyMd: `Picken opens where every failure of fit begins: the measures. A dress block needs about a dozen, and the discipline of taking them hasn't changed:

**Girths** — bust (over the fullest point, tape level behind), waist (at the natural waist, found by tying a cord and letting the body place it — the era's best trick, still unbeaten), and hip (at the fullest, typically 18–22 cm below the waist; period books say "7 to 9 inches").

**Lengths** — nape to waist at the back; shoulder to bust point and on to waist at the front (the front is measured *through* the bust point because that is where the length is spent); waist to knee or floor for the skirt; shoulder length; arm length bent, shoulder to wrist over a slightly crooked elbow.

**Widths** — back width between the arm joints; chest width above the bust.

Three rules Picken drills. **The tape stays snug and level** — a drooping tape adds phantom centimeters. **Measure over the foundation garments the dress will be worn with** — fit is relative to what's underneath (as true of a modern bra as of a 1920 corset). **Record immediately, dated** — her Institute's record cards are the direct ancestors of the Client Book's dated measurement sets, and her reason is the modern one: bodies change, and a dated history tells you *how*.

The quiet radicalism of her method: she teaches students to trust the measures over the mirror. A drafted bodice that matches honest measures and still looks wrong is revealing a **posture correction** to make (the balance lesson of the tailoring school applies to dresses identically), not a reason to distrust the tape.

> **Term note:** the *waist* in period dressmaking often means the bodice garment itself ("shirtwaist"); the *waist line* is the body's. *Basque* = a bodice extending below the waist. Where this course says waist, it means the body line.`,
      checkpoints: [
        {
          q: "The natural waist is best located by…",
          options: [
            "tying a cord and letting the body place it",
            "measuring 20 cm below the bust",
            "the navel",
          ],
          answer: 0,
        },
        {
          q: "Front length is measured through the bust point because…",
          options: [
            "that is where the front's length is actually spent",
            "the tape slips otherwise",
            "period fashion demanded it",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Drafting the bodice block",
      minutes: 9,
      source: { label: "Picken; Fales ch. on drafting", url: "https://archive.org/details/dressmaking00fale" },
      bodyMd: `The dress block drafts on the same frame-widths-curves logic as the tailor's coat (T1), with one great difference at its center: **the bust dart**. A woman's block must spend the difference between the bust girth and the smaller frame above and below it, and everything characteristic about dress drafting is strategies for spending it well.

The draft in brief (Picken's and Fales's methods agree in structure): a rectangle of back length by half-bust plus ease; the scye depth set from the nape; back and chest widths hung on it; the neck curves cut; the shoulder slopes drawn. Then the front is drafted *longer* than the back — the extra front length walks over the bust — and the surplus between bust and waist gathers into the **waist dart(s)**, while the surplus at the side, between bust and underarm, closes into the **underarm/side dart**. Where the dart points converge is the **bust point**, and every dart must stop short of it (2–3 cm) or the block sculpts a cone instead of a curve.

What Picken wants a student to understand — and what separates pattern literacy from recipe-following — is that **the dart is movable**. Slash the block to the bust point from any edge, close the original dart, and it opens where you slashed: shoulder, neck, armhole, center front, French dart at the hip. Same fit, different design line. Gathering, tucks, and princess seams are all the same suppression wearing different clothes; a princess seam is simply the shoulder-or-armhole dart and the waist dart joined into one continuous seam and cut apart.

**Ease** in a dress block is smaller than a coat's (the era: about 5–8 cm at the bust for a fitted bodice) and, exactly as in trousers, positional: bust and hip carry it; the waist carries almost none; the back carries a little more than the front because arms live forward.

The block, once fitted and proven, is the studio's capital — Picken's students traced theirs onto card. Yours lives as a dated pattern in your shop, and the practical for this course is the block's raw material: a complete dress-measure set recorded on a client.`,
      checkpoints: [
        {
          q: "Every dart must stop short of the bust point because…",
          options: [
            "sewing to the point sculpts a cone instead of a curve",
            "thread is saved",
            "the era's machines couldn't turn",
          ],
          answer: 0,
        },
        {
          q: "A princess seam is…",
          options: [
            "the shoulder/armhole and waist darts joined into one seam and cut apart",
            "a seam with no suppression",
            "purely decorative",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Draping: designing with scissors and cloth",
      minutes: 9,
      source: { label: "WI, Draping and Designing (1924)", url: "https://archive.org/details/draping-and-designing-with-scissors-and-cloth" },
      bodyMd: `The Institute's 1924 draping booklet teaches the second road to a pattern — starting not from measurements but from **cloth on a form**, designing in three dimensions with your hands. The 1920s were draping's golden hour (the era's soft silhouettes were *conceived* draped), and the method it codified is the one design schools still teach:

**Prepare the form** — pad a dress form to the client's measures (the era padded with cotton wadding toward the figure's asymmetries; a modern studio fits the form to the measurement set — same idea). Mark its landmarks with tape: center front, center back, bust line, waist line, side seams. The tapes are the draft's frame, transplanted onto the form.

**Prepare the cloth** — muslin (period: "cambric or cheap lining") torn, not cut, to blocks, because tearing follows a thread and guarantees grain. Mark the grain boldly. **Grain discipline is the whole secret of draping**: a lengthwise grain hung plumb at center front, a crosswise grain level at the bust — violate them and the drape lies to you, hanging in ways cut cloth never will.

**Drape** — pin at the landmarks, let the cloth fall, and *move the fullness where the design wants it*: smooth toward a seam and pin; sweep into folds and let them cascade; cut away only what the design has firmly rejected (her scissors are confident but late — cloth removed is an option destroyed). The bust suppression appears under your fingers as the cloth chooses its dart — often the most natural dart position for *this* figure, which is knowledge no flat draft provides.

**Truing** — the drape comes off the form and becomes a pattern: fold lines become seams, pin lines become stitching lines, curves get smoothed with the rulers, grain arrows carry over, seam allowances go on. An untrued drape is a sketch; the truing is where it becomes an instruction.

Drafting and draping are not rivals; the era used them as a pair. Draft the block for accuracy; drape the design over the block for life. A cowl, a twist, a cascade — cloth answers in a minute what geometry would take an evening to guess. (This is precisely the division of labor in Verto: the Pattern Studio drafts the accurate block; the drape render shows the cloth's opinion.)`,
      checkpoints: [
        {
          q: "Muslin is torn rather than cut because…",
          options: [
            "tearing follows a thread, guaranteeing true grain",
            "it is faster",
            "scissors were expensive",
          ],
          answer: 0,
        },
        {
          q: "'Truing' a drape means…",
          options: [
            "turning pin and fold lines into smoothed, seam-allowed pattern lines",
            "washing the muslin",
            "photographing the form",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "The fitting: reading a dress on a body",
      minutes: 8,
      source: { label: "Fales, fitting chapters", url: "https://archive.org/details/dressmaking00fale" },
      bodyMd: `Fales's fitting chapters are the dressmaker's mirror of Vincent's trouser remedies (T2): faults, signatures, causes, cuts. The recurring ones:

**Neckline stands away or gapes.** The neck curve is too big or the shoulder seam misplaced — never fix with a tighter facing (it puckers); re-pin the shoulder seam, deepening at the neck end, or dart the surplus into the neckline seam.

**Diagonal drags from bust point toward underarm.** The bust dart under-spends its allowance — deepen the dart or add one where the drag points. The **drag points at the missing dart**: the single most useful sentence in dress fitting.

**Bodice rides up in front.** Front length insufficient over the bust (the through-the-bust-point measure from lesson 1 was skimped) — let down the front waist seam or add front length at the shoulder.

**Skirt hem rises at front or back.** Not a hem problem — a **balance** problem: the waist seam is spending length unevenly. Lift or drop the skirt at the waist until the hem hangs level, *then* mark the hem. Period books level hems with a chalk marker on a stand at fixed height from the floor — still the most accurate method in the room.

**Sleeve wrinkles.** As in tailoring: spiral drags = pitch; crown dents = ease misplaced; tightness across the upper arm = the block, not the seam allowance.

Fales's protocol for the fitting itself is worth adopting whole: fit over the correct undergarments, **fit one side of the body** (the right, traditionally) and transfer symmetric corrections to the pattern, pin corrections rather than describing them, and **write every change down before the client leaves** — a fitting that lives in memory is a fitting that happens twice. In Verto that ledger is the commission's fitting notes and the client's timeline; the habit is a century older than the software.`,
      checkpoints: [
        {
          q: "A skirt hem rising at the front is corrected at…",
          options: [
            "the waist seam — it is a balance fault, not a hem fault",
            "the hem, by trimming",
            "the side seams",
          ],
          answer: 0,
        },
        {
          q: "A diagonal drag from the bust toward the underarm points to…",
          options: [
            "the missing or under-spent dart",
            "a long shoulder seam",
            "heavy fabric",
          ],
          answer: 0,
        },
      ],
    },
  ],
  quizDraw: 10,
  passPercent: 80,
  quiz: [
    { id: "s2q01", q: "Hip girth is taken…", options: ["at the fullest point, roughly 18-22cm below the waist", "at the waist", "at mid-thigh"], answer: 0 },
    { id: "s2q02", q: "Measurements should be taken over…", options: ["the foundation garments the dress will be worn with", "bare skin always", "outdoor clothing"], answer: 0 },
    { id: "s2q03", q: "The front bodice drafts longer than the back because…", options: ["the extra length walks over the bust", "backs are always shorter", "seam allowances differ"], answer: 0 },
    { id: "s2q04", q: "Dart rotation works by…", options: ["slashing to the bust point and closing the original dart", "cutting the dart off", "pressing the dart flat"], answer: 0 },
    { id: "s2q05", q: "Gathering, tucks and princess seams are all…", options: ["the same bust suppression in different design clothes", "decorations without fit function", "period-only techniques"], answer: 0 },
    { id: "s2q06", q: "Ease at the waist of a fitted bodice is…", options: ["almost none", "the largest in the garment", "equal to the bust ease"], answer: 0 },
    { id: "s2q07", q: "A dress form is prepared for draping by…", options: ["taping its landmarks: CF, CB, bust, waist, sides", "covering it in paper", "oiling the surface"], answer: 0 },
    { id: "s2q08", q: "Grain discipline in draping means…", options: ["lengthwise plumb at CF, crosswise level at bust", "cutting everything on the bias", "ignoring grain until truing"], answer: 0 },
    { id: "s2q09", q: "In draping, cloth is cut away…", options: ["late — removed cloth is an option destroyed", "immediately to save weight", "never"], answer: 0 },
    { id: "s2q10", q: "Drafting and draping relate as…", options: ["a pair: draft for accuracy, drape for design life", "rivals: choose one", "identical methods"], answer: 0 },
    { id: "s2q11", q: "A gaping neckline is fixed by…", options: ["re-pinning the shoulder seam or darting the surplus into the neck seam", "a tighter facing", "starching the collar"], answer: 0 },
    { id: "s2q12", q: "Hems are leveled…", options: ["with a fixed-height marker from the floor, after balancing at the waist", "by measuring down from the waist everywhere", "by eye from the front only"], answer: 0 },
    { id: "s2q13", q: "Fales's fitting protocol fits…", options: ["one side of the body and transfers corrections symmetrically", "both sides independently", "the garment on a hanger"], answer: 0 },
    { id: "s2q14", q: "Every fitting change must be…", options: ["written down before the client leaves", "memorized", "photographed only"], answer: 0 },
  ],
  practical: {
    kind: "client_measurements",
    title: "Record a complete dress-measure set",
    instructions:
      "In the Client Book, record a dated measurement set with at least six measures for a real client (bust/chest, waist, hip, back length, arm, plus one more). The block's raw material — the school verifies it exists.",
  },
};

export const S3: CourseDef = {
  slug: "dressmaking-in-detail",
  school: "seamstressing",
  title: "Dressmaking in Detail",
  summary:
    "Butterick's construction canon and Picken's 'perfection in details': plackets, linings, sheer-fabric finishes, and the materials literacy that makes a garment last.",
  level: "advanced",
  sources: [
    { label: "Butterick — The New Dressmaker (1921)", iaId: "newdressmakerwit00butt", url: "https://archive.org/details/newdressmakerwit00butt" },
    { label: "Woman's Institute — Dressmaking: Perfection in Details (1927)", iaId: "DressmakingPerfectioninDetails", url: "https://archive.org/details/DressmakingPerfectioninDetails" },
    { label: "Woman's Institute — Sewing Materials (1923)", iaId: "sewingmaterialsd00woma", url: "https://archive.org/details/sewingmaterialsd00woma" },
  ],
  lessons: [
    {
      title: "Plackets, openings and the discipline of getting dressed",
      minutes: 8,
      source: { label: "Butterick, plackets", url: "https://archive.org/details/newdressmakerwit00butt" },
      bodyMd: `A fitted garment must open somewhere, and the finished opening — the **placket** — is where construction quality is most nakedly on display. Butterick's placket rules:

**The continuous-bound placket** — a slash bound with one continuous strip, one side folding under as a facing, the other standing as an underlap. The workhorse for sleeve openings and children's clothes; strong, quick, invisible when closed. Its one law: **the slash's end is the stress point** — reinforce it (small stitches pivoting at the point, or a tiny bar tack) or it tears the first time the garment is pulled on impatiently.

**The seam placket** — the opening built into a seam (a skirt's left side, a dress's back), faced on one edge, underlapped on the other, closing with snaps or hooks so the seam line appears unbroken. The period's dress zipper, essentially — and when you *do* set a zipper today, the same geometry applies: faced edge, underlap, nothing visible when closed.

**The tailored/shirt placket** — the topstitched tower of a shirt cuff opening: a two-piece binding whose upper piece finishes in the little peaked "steeple." Decorative and structural at once; the machine-age placket.

Two universal placket judgments, per Butterick: an opening must be **long enough to dress through without strain** (a too-short placket destroys itself; the classic fault of skimpy making), and it must **lie dead flat when closed** — a placket that gapes or ripples announces every other shortcut in the garment.

Fastenings recap from S1 apply here with one addition the dress trade lived by: **snaps take alignment, hooks take strain, buttons take both but slowly.** A side placket closes with hooks at the waist (strain) and snaps along the rest (alignment). That little composition — mixed closures, each doing what it's best at — is the sort of detail Picken's "perfection" booklet is made of.`,
      checkpoints: [
        {
          q: "The stress point of a slashed placket is…",
          options: [
            "the end of the slash — reinforce it or it tears",
            "the top edge",
            "the underlap fold",
          ],
          answer: 0,
        },
        {
          q: "In mixed closures, hooks are placed…",
          options: [
            "where the strain is (e.g. the waist)",
            "where alignment matters only",
            "at random intervals",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Linings, underlinings and the inner life of a dress",
      minutes: 9,
      source: { label: "Picken, Tight Linings; Butterick", url: "https://archive.org/details/TightLiningsandBoning" },
      bodyMd: `Period dressmaking distinguished layers that modern sewing often blurs, and the distinctions are worth keeping because each layer does one job:

**Underlining (mounting)** — a layer cut identical to the fashion fabric and handled *as one with it* through construction. It gives a fragile or sheer cloth body, hides construction from show-through, and carries marks the face fabric shouldn't. The era mounted georgettes and laces on net or China silk; the method is unchanged for a modern chiffon.

**Lining** — a separate inner garment, constructed apart and joined at the edges, so the dress slides on and the seams live in a closed room. A lining is drafted from the same block, *slightly eased* (the era cut linings a touch larger through the bust and back) because a lining cut exactly grips and creeps.

**Interlining** — warmth or body between the two (the era: flannel in winter coats; today: the same idea in a quilted lining).

**The fitted, boned lining** — the Institute's *Tight Linings and Boning* booklet documents the Edwardian bodice's engine room: a snug inner bodice, seams channeled and **boned** so the bodice stands without strain on the face fabric. Couture never abandoned it — a strapless dress today stands on exactly this foundation garment sewn inside — and a made-to-measure studio should know the anatomy: bones on the seams, casings eased not taut, every bone end capped and cushioned, the lining fitted *tighter than the dress* so it, not the silk, takes the load.

The judgment call the era teaches: **not every dress earns every layer.** A washable day dress wants no lining it can't launder with; a beaded silk wants underlining, lining, and possibly bones. The layers are answers to named problems — show-through, fragility, structure, slide — and the tech pack should name the problem next to the layer ("underline bodice: chiffon show-through") so the choice survives to production.`,
      checkpoints: [
        {
          q: "An underlining differs from a lining because it is…",
          options: [
            "handled as one with the fashion fabric through construction",
            "always heavier",
            "sewn in last",
          ],
          answer: 0,
        },
        {
          q: "A boned inner bodice is fitted tighter than the dress so that…",
          options: [
            "it, not the face fabric, takes the structural load",
            "it saves fabric",
            "the bones stay warm",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Sheers, silks and the fabrics that punish shortcuts",
      minutes: 9,
      source: { label: "Picken, Perfection in Details; Sewing Materials", url: "https://archive.org/details/DressmakingPerfectioninDetails" },
      bodyMd: `The Institute's later booklets are a masterclass in the fabrics that expose every shortcut — sheers, silks, laces, velvets — and the accommodations they demand. The recurring lessons:

**Sheers (chiffon, georgette, organdy).** Every raw edge and seam allowance is on display, so the seam *is* the finish: French seams (S1) at 6 mm or narrower; hems rolled by hand or finished as a fine machine roll; facings replaced by bindings or simply by a rolled edge, because a facing's shadow reads through. Stitch length shortens, needles go fine and *new* (a burred needle pulls a thread that runs the garment's whole life), and tissue under the seam stops the machine eating the cloth.

**Silks (crepes, satins, charmeuse).** The era's rules: fine pins in the seam allowances only; no pressing over pins ever (satin remembers); a press cloth always; test every iron temperature on a scrap because scorch and glaze are one second apart. Slippery cuts want a single layer, weighted not pinned, on a surface the cloth grips (the old trick: a sheet over the table).

**Velvet.** Nap has direction — the whole garment cuts one way (period rule: pile *up* for depth of color) — and it cannot be pressed flat, only steamed over a needle board or velvet scrap. Seams finger-pressed; basting with silk thread which leaves no bruise.

**Lace.** Never darted if it can be helped — lace is *appliquéd*: motifs lapped and whipped along their own outlines so joins vanish into the pattern. The era's lace-mending logic is also its seam logic: follow the design, not the geometry.

Underneath all of these sits the Institute's *Sewing Materials* doctrine: **thread, needle and stitch scale to the cloth as a system.** Silk thread for silk; fine cottons for sheers; needle sized so the thread fills its eye; machine stitch length shortening as fabric fineness rises. Half of "my machine hates this fabric" is a system mismatch, 1923 or now. Materials literacy is the practical for this course: your bill of materials, linked to real fabrics and trims from your library, is where these choices become production instead of good intentions.`,
      checkpoints: [
        {
          q: "On sheer fabrics, facings are often replaced by bindings because…",
          options: [
            "a facing's shadow shows through the sheer",
            "bindings are cheaper",
            "facings cannot curve",
          ],
          answer: 0,
        },
        {
          q: "Velvet seams are…",
          options: [
            "finger-pressed or steamed over a needle board, never pressed flat",
            "pressed hard with a dry iron",
            "always topstitched",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Perfection in details: the finishing doctrine",
      minutes: 8,
      source: { label: "Picken, Perfection in Details (1927)", url: "https://archive.org/details/DressmakingPerfectioninDetails" },
      bodyMd: `Picken's 1927 booklet gave this course its name, and its thesis deserves to close the school's construction track: **a garment is remembered by its details in inverse proportion to their size.**

Her late-1920s catalogue of distinguishing details, all still current:

- **Bindings and pipings** that turn edges into design lines — a self-fabric piping in a seam is nearly free and reads as intent; a contrast binding is a signature.
- **Hand-finished hems on anything that moves** — a skirt's hem is its motion made visible; machine-blind it on dailywear, slip-stitch it on occasion wear, and *interface* it (bias strips of soft canvas in the fold) on coats and full skirts so the hem swings instead of flutters.
- **The hidden neatnesses**: seams graded (allowances trimmed to stepped widths so edges never print through), corners built out with a stitch across the point before turning (a sharp corner is *constructed*, not poked), facings understitched and tacked, threads buried. Nobody sees any of it; everybody sees their absence.
- **Weights** — the couture trick the era used freely: small lead (today: steel) weights in coat hems and a fine chain inside a jacket's hem to make cloth hang plumb. The most literal example in all dressmaking of spending money where only the drape shows.
- **Pressing as punctuation** — her final chapters return to the iron (Copeland's doctrine from the tailoring school, in a dressmaker's accent): every detail pressed as it is made, the finished garment pressed as little as possible.

And her closing counsel, which is really a business lesson wearing a thimble: details are **where a small maker beats a factory**. Industry can match your seams and undercut your price; it cannot afford your hand-rolled hem, your matched plaid at every seam, your buried threads. The details are the moat. Document them (that's this course's practical — a BOM whose materials are real, so the details are *ordered*, not improvised), price them honestly, and photograph them for the product page — the customer who can't name understitching can still see it.`,
      checkpoints: [
        {
          q: "Seam allowances are graded (trimmed to stepped widths) so that…",
          options: [
            "edges never print through to the face",
            "the seam is weaker but lighter",
            "less thread is used",
          ],
          answer: 0,
        },
        {
          q: "Picken's business point about details is that they are…",
          options: [
            "where a small maker beats a factory — the moat",
            "obsolete in modern production",
            "only for couture houses",
          ],
          answer: 0,
        },
      ],
    },
  ],
  quizDraw: 10,
  passPercent: 80,
  quiz: [
    { id: "s3q01", q: "A continuous-bound placket fails first at…", options: ["the end of the slash if unreinforced", "the top hem", "the binding fold"], answer: 0 },
    { id: "s3q02", q: "A placket must be long enough to…", options: ["dress through without strain", "reach the hem", "fit three snaps"], answer: 0 },
    { id: "s3q03", q: "Snaps vs hooks: the rule is…", options: ["hooks take strain, snaps take alignment", "snaps take strain, hooks decorate", "either, interchangeably"], answer: 0 },
    { id: "s3q04", q: "An underlining is…", options: ["cut like the fashion fabric and handled as one with it", "a separate inner garment", "a hem treatment"], answer: 0 },
    { id: "s3q05", q: "Linings are cut slightly eased because…", options: ["an exact lining grips and creeps", "fabric shrinks in wear", "seams need inspection room"], answer: 0 },
    { id: "s3q06", q: "In a boned bodice, bones run…", options: ["on the seams, in eased casings, ends capped", "across the bust horizontally", "only at center back"], answer: 0 },
    { id: "s3q07", q: "The right seam for chiffon is…", options: ["a narrow French seam", "a flat-felled seam", "a pinked plain seam"], answer: 0 },
    { id: "s3q08", q: "A burred machine needle on silk…", options: ["pulls a thread that runs for the garment's life", "is harmless", "only matters on knits"], answer: 0 },
    { id: "s3q09", q: "Velvet garments cut…", options: ["with all panels in one nap direction", "panels in alternating directions to save cloth", "ignoring nap"], answer: 0 },
    { id: "s3q10", q: "Lace is joined by…", options: ["appliqué along its own motifs", "deep darts", "flat-felled seams"], answer: 0 },
    { id: "s3q11", q: "Thread, needle and stitch length should…", options: ["scale to the cloth as one system", "stay constant across fabrics", "be chosen by machine brand"], answer: 0 },
    { id: "s3q12", q: "A sharp corner is achieved by…", options: ["a stitch across the point before turning", "trimming to zero and poking hard", "pressing only"], answer: 0 },
    { id: "s3q13", q: "A chain in a jacket hem exists to…", options: ["make the cloth hang plumb", "carry keys", "stiffen the lining"], answer: 0 },
    { id: "s3q14", q: "Hems on coats and full skirts are interfaced so that…", options: ["the hem swings instead of fluttering", "they can be shortened later", "the color deepens"], answer: 0 },
  ],
  practical: {
    kind: "bom_linked",
    title: "Build a real bill of materials",
    instructions:
      "On a style in your shop, build a bill of materials with at least three components linked to real fabrics or trims in your materials library. Details are ordered, not improvised — the school verifies the links exist.",
  },
};
