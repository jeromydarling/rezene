/**
 * The Verto School curriculum. This file is the single source of truth for
 * courses, lessons, checkpoint questions, quiz banks and practical
 * requirements — and it deliberately lives in WORKER code:
 *
 *  - Checkpoint and quiz answers never ship to the client. The API strips
 *    them; grading happens server-side only. That, plus randomized question
 *    draws and server-held progression state, is what makes a Verto
 *    certificate mean something.
 *  - Every course is adapted from verified public-domain sources
 *    (pre-1931 US publications, scanned by the Library of Congress,
 *    university libraries, or community uploads on archive.org). Each
 *    course credits its sources and links the originals — the era's own
 *    correspondence-school format, revived.
 *
 * Curriculum text is modernized: units and archaic trade terms are
 * explained inline, but the craft content is faithful to the sources.
 */

export const CURRICULUM_VERSION = "2026.07";

export type {
  SchoolDef,
  Checkpoint,
  Lesson,
  QuizQuestion,
  PracticalDef,
  CourseDef,
} from "./types";

import type { SchoolDef, CourseDef } from "./types";
import { T2, T3 } from "./courses-tailoring2";
import { S2, S3 } from "./courses-seamstressing2";
import { F1, F2 } from "./courses-fashion2";

export const SCHOOLS: SchoolDef[] = [
  {
    key: "tailoring",
    title: "School of Tailoring",
    tagline: "Cutting, balance, and fit — the trade as the great cutters taught it.",
  },
  {
    key: "seamstressing",
    title: "School of Seamstressing",
    tagline: "Stitches, seams and construction — the hands that make the garment.",
  },
  {
    key: "fashion",
    title: "School of Fashion",
    tagline: "Silhouette, drawing and the economics of taste — design literacy with receipts.",
  },
];

// ---------------------------------------------------------------------------
// T1 · Foundations of Cutting (Madison 1878, Giles 1887)
// ---------------------------------------------------------------------------

const T1: CourseDef = {
  slug: "foundations-of-cutting",
  school: "tailoring",
  title: "Foundations of Cutting",
  summary:
    "Before any system, the principles: how cloth relates to the body, what balance actually is, and why every drafting system since 1800 is a different answer to the same three questions.",
  level: "foundation",
  sources: [
    { label: "J.O. Madison — Elements of Garment Cutting (1878)", iaId: "elementsofgarmen00madi", url: "https://archive.org/details/elementsofgarmen00madi" },
    { label: "E.B. Giles — The History of the Art of Cutting in England (1887)", iaId: "historyofartofcu00gile", url: "https://archive.org/details/historyofartofcu00gile" },
  ],
  lessons: [
    {
      title: "What a cutter actually does",
      minutes: 8,
      source: { label: "Giles, ch. 1–2", url: "https://archive.org/details/historyofartofcu00gile" },
      bodyMd: `Tailoring divides into two crafts that the trade has always kept distinct: **cutting** — turning a body's measurements into flat pattern shapes — and **making** — sewing, shaping and pressing those shapes into a garment. This course is about the first craft, and about the ideas underneath it that haven't changed since Giles wrote his history in 1887.

A garment is a set of flat panels wrapped around a curved, moving body. Everything difficult about cutting comes from that one sentence.

![Plate of numbered antique pattern pieces including a large curved cape piece and coat sections](/school/foundations-of-cutting/lesson0-early-pattern-pieces.jpg)
*E.B. Giles, The History of the Art of Cutting in England (1887), plate 2 — the cutter's product: flat shapes destined for a curved body.* The cloth cannot stretch much (in a woven, almost not at all along the warp), so the shape must come from where you cut, not from where you pull. Three questions decide every draft:

1. **How big?** — the girths: chest, waist, seat. These set the widths of your panels.
2. **How long?** — the lengths: nape to waist, waist to knee, shoulder to wrist. These set the heights.
3. **In what attitude?** — the *balance*: how the body stands, stoops, or squares its shoulders. This decides how the panels hang relative to each other, and it is where good cutting is won or lost.

Early cutters worked by draping and rock-of-eye — experience guiding chalk directly on the cloth. The nineteenth century's revolution, which Giles documents system by system, was **measurement-led drafting**: the idea that a small set of body measurements, run through a repeatable geometric method, produces a pattern that fits *before the first fitting*. Every named system you will ever meet — proportionate, direct-measure, sectional — is a strategy for getting from those three questions to lines on paper.

![Engraved plate with two costumed gentlemen, a tunic, and a semicircular Spanish cape pattern](/school/foundations-of-cutting/lesson0-spanish-cape-and-costumes.jpg)
*Giles, plate 1 — one of the earliest recorded drafts: the semicircular Spanish cape, beside the figures who wore it.*

None of them is magic. As Madison put it a decade earlier, a system is only "organized experience" — a way of writing down what the eye of a good cutter already knows. Learn the principles and every system becomes readable; learn only one system's steps and you are lost the moment a body disagrees with its proportions.

> **Term note:** period books measure in inches and speak of "breast measure" (we say chest) and "small of the waist." A *block* or *foundation pattern* is the plain, fit-proven base pattern from which styled patterns are cut — exactly what Verto's Pattern Studio drafts for you today.`,
      checkpoints: [
        {
          q: "Why must a woven garment's shape come from cutting rather than stretching?",
          options: [
            "Because woven cloth barely stretches along its threads",
            "Because stretching cloth weakens the dye",
            "Because period tailors lacked elastic thread",
          ],
          answer: 0,
        },
        {
          q: "What is a 'block' (foundation pattern)?",
          options: [
            "A wooden form for pressing",
            "A plain, fit-proven base pattern that styled patterns are cut from",
            "A ruler used in proportionate drafting",
          ],
          answer: 1,
        },
      ],
    },
    {
      title: "Girths, lengths and the divided tape",
      minutes: 9,
      source: { label: "Madison, part I", url: "https://archive.org/details/elementsofgarmen00madi" },
      bodyMd: `Every drafting method starts with measurement, and the argument between methods is really an argument about **how many measurements to trust**.

The **proportionate school** trusts few. Take the chest, and derive nearly everything else from it by fixed fractions — a third of chest here, a sixth there — on the theory that human bodies are, on average, proportional. The famous "divided tape" of the era was literally a tape measure printed in thirds and sixths of the breast measure, so the cutter could draft without arithmetic. Proportionate drafts are fast and remarkably good for **average figures** — which is why they powered the ready-to-wear industry — but they fail exactly where bodies stop being average: the stooped back, the prominent seat, the square shoulder.

![Coat draft diagrams above a fan of graduated measuring scales marked with breast sizes](/school/foundations-of-cutting/lesson1-graduated-measures-plate8.jpg)
*Giles, plate 8 — the divided-measure idea made visible: drafts drawn over a fan of graduated scales, one per breast size.*

The **direct-measure school** trusts many. Measure the actual back width, the actual shoulder, the actual sleeve; put each number where it belongs on the draft. More honest, slower, and every extra measurement is an extra chance for a taking error — a tape held slack at the shoulder ruins a direct draft in a way a proportionate draft would have quietly averaged away.

Madison's *Elements* takes the view that has aged best: **use proportion as scaffolding and direct measures as corrections.** Draft the frame proportionately, then check it against the handful of measures where real bodies most often disagree with the average — shoulder slope, back length, seat. That hybrid is exactly how modern block drafting (including the parametric drafting in Verto's Pattern Studio) works: a proportional model, adjusted by the measurements that matter.

![Printed table of blade measures against seven columns of corresponding shoulder measures](/school/foundations-of-cutting/lesson1-proportional-shoulder-table.jpg)
*J.O. Madison, Elements of Garment Cutting (1878) — the arithmetic of proportion: blade measure against shoulder measures, in fractional steps.*

Practical discipline for taking measures, unchanged since 1878: measure over the garments the piece will be worn over, keep the tape snug but never compressing, take girths level to the floor, and **write every number down at once** — the memory of a tape reading does not survive three more measurements. A dated, complete measurement set is the raw material of everything else in this school, which is why Verto's Client Book keeps them versioned per client.`,
      checkpoints: [
        {
          q: "The proportionate school's core bet is that…",
          options: [
            "bodies are, on average, proportional to the chest measure",
            "every body must be measured in full",
            "cloth stretch will hide small errors",
          ],
          answer: 0,
        },
        {
          q: "Where do proportionate drafts fail?",
          options: [
            "On average figures",
            "On figures that depart from average — stooped, square-shouldered, prominent seat",
            "They never fail",
          ],
          answer: 1,
        },
      ],
    },
    {
      title: "Balance: the invisible measurement",
      minutes: 9,
      source: { label: "Madison, part II", url: "https://archive.org/details/elementsofgarmen00madi" },
      bodyMd: `Ask a bench tailor what separates a good coat from a bad one and the answer is one word: **balance**. It is the least visible idea in cutting and the most important.

![Line diagram of a coat back and forepart divided into upper and lower balance portions](/school/foundations-of-cutting/lesson2-balance-upper-lower.jpg)
*Madison, diagram 16 — the coat divided into upper and lower portions: their adjustment to each other is the balance.*

Balance is the relationship between the *front length* and *back length* of a garment — how the panels share the body's attitude. Stand a figure upright: front and back lengths in a certain ratio. Let the figure **stoop** (round the back, carry the head forward — the posture of everyone who works at a bench or a desk): the back needs *more* length, the front *less*. **Erect** figures (chest carried high, shoulders drawn back) need the opposite.

![Coat draft with dotted overlay lines showing balance adjustment for a stooping figure](/school/foundations-of-cutting/lesson2-stooping-balance.jpg)
*Madison, diagram 17 — the stooping figure's draft: dotted lines showing the lower portion swung against the upper.*

Cut a coat with the wrong balance and no amount of pressing will save it. Too short in the back for a stooped figure and the coat **rides up**: the collar stands away from the neck, the front hem swings forward, diagonal drags run from the shoulder blades toward the side seams. Too long in the back and the cloth **piles above the waist** while the front hangs open. Nineteenth-century fitters read these creases the way a doctor reads symptoms, and their diagnosis table still works:

- **Collar stands away; front hem kicks forward** → back too short: add back length or pass the shoulder seam forward.
- **Horizontal folds under the collar; hem sweeps backward** → back too long: shorten it.
- **Diagonal drags from the neck toward the underarm** → shoulder slope wrong for this body: square or slope the shoulder line.

Notice what balance is *not*: it is not size. A coat can be the right chest and still hang wrong — and a slightly-wrong chest with the right balance will often look better than the reverse. This is why Madison ranks attitude with girth and length as the third fundamental question, and why Verto's fit map colors strain the way it does: it is showing you balance errors before cloth is cut.

![Diagram of a coat made in two separate parts used to demonstrate garment balance](/school/foundations-of-cutting/lesson2-balance-experiment.jpg)
*Madison, diagram 20 — his padding-coat experiment: a coat built in two parts to prove where balance actually lives.*`,
      checkpoints: [
        {
          q: "A coat's collar stands away from the neck and the front hem kicks forward. The classic diagnosis is…",
          options: [
            "the chest is too large",
            "the back is too short for this figure's stoop",
            "the sleeves are set too low",
          ],
          answer: 1,
        },
        {
          q: "Balance is best described as…",
          options: [
            "the ratio of front length to back length matching the body's attitude",
            "the garment's total weight distribution",
            "equal seam allowances front and back",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Reading any system: a cutter's map",
      minutes: 8,
      source: { label: "Giles, survey chapters", url: "https://archive.org/details/historyofartofcu00gile" },
      bodyMd: `Open any drafting book from Croonborg to a modern blockmaking text and the diagrams look like geometry homework: lettered points, construction lines, sweeping arcs. They all decode the same way. Every draft, in every system, is built in the same order:

1. **The frame** — verticals and horizontals locating the great landmarks: the depth of scye (armhole depth), the natural waist, the seat line, the full length. Usually derived from lengths and fractions of the chest.
2. **The widths** — back width, chest width, over-shoulder — hung on the frame at the right heights.
3. **The curves** — neck, scye (armhole), side seams — drawn through the plotted points. The points carry the fit; the curves carry the eye.
4. **The style** — only after the block is true: lapels, fashion lines, flare, pockets. Style lines added to an untrue block just decorate a fault.

![Shaded coat draft crossed by geometric construction lines with lettered drafting points](/school/foundations-of-cutting/lesson3-madison-rational-draft.jpg)
*Madison, plate F — the Rational Coat System: frame, widths, curves and style readable in one shaded draft.*

Two habits make old drafts (and new software) trustworthy:

**Check the closures.** A draft is a promise that seam lines which will be sewn together are the same length. Walk your side seams, walk the sleeve against the scye. Period books call the deliberate exceptions *fulling on* or *holding in* — extra length in one seam that the maker shrinks or eases in (the back shoulder onto the front, the sleeve cap into the scye). Ease is a tool; an accidental mismatch is a defect. The distinction is whether the draft *says so*.

![Foldout plate of five historical drafting diagrams with lettered construction points](/school/foundations-of-cutting/lesson3-giles-system-plate5.jpg)
*Giles, plate 5 — a complete early system on one foldout: coat, sleeve and breeches, lettered points, written measures.*

**Know your seam allowances.** Most nineteenth-century drafts are drawn **net** — sewing lines only, seams added in the cutting. Croonborg's American drafts often include them. Confuse the two conventions and every panel is wrong by a centimeter before you start. (Verto's Pattern Studio makes allowance explicit per pattern for exactly this reason.)

![Foldout plate of coat and trouser drafts annotated with fractional measurements](/school/foundations-of-cutting/lesson3-giles-proportional-plate9.jpg)
*Giles, plate 9 — a rival system annotated in fractional proportions at every construction point: same order, different dialect.*

With the frame–widths–curves–style order in your head and those two checks in your hands, you can sit down with any system in the archive — or audit any pattern a factory sends back — and know what you are looking at. That literacy is what this course certifies.`,
      checkpoints: [
        {
          q: "The correct order of any draft is…",
          options: [
            "style lines → curves → widths → frame",
            "frame → widths → curves → style",
            "curves → frame → style → widths",
          ],
          answer: 1,
        },
        {
          q: "A draft drawn 'net' means…",
          options: [
            "sewing lines only — seam allowances get added at cutting",
            "it includes seam allowances",
            "it is drawn at half scale",
          ],
          answer: 0,
        },
      ],
    },
  ],
  quizDraw: 10,
  passPercent: 80,
  quiz: [
    { id: "t1q01", q: "The two historically distinct crafts of tailoring are…", options: ["cutting and making", "drafting and grading", "fitting and pressing"], answer: 0 },
    { id: "t1q02", q: "The three fundamental questions of any draft are size (girths), length, and…", options: ["fabric weight", "balance / attitude of the figure", "seam class"], answer: 1 },
    { id: "t1q03", q: "A 'divided tape' was printed with…", options: ["metric and imperial units", "fractions of the breast measure for arithmetic-free proportionate drafting", "the customer's name"], answer: 1 },
    { id: "t1q04", q: "Direct-measure systems are most vulnerable to…", options: ["average figures", "errors in taking the measurements", "cloth shrinkage"], answer: 1 },
    { id: "t1q05", q: "Madison's hybrid position was to…", options: ["reject all systems", "draft proportionately, then correct with key direct measures", "measure everything twice"], answer: 1 },
    { id: "t1q06", q: "A stooped figure needs…", options: ["more back length and less front length", "less back length and more front length", "a larger chest measure"], answer: 0 },
    { id: "t1q07", q: "Cloth piling in horizontal folds below the collar suggests…", options: ["the back is too long", "the back is too short", "the sleeve pitch is wrong"], answer: 0 },
    { id: "t1q08", q: "Balance is independent of…", options: ["posture", "size — a right-sized coat can still hang wrong", "the back seam"], answer: 1 },
    { id: "t1q09", q: "'Depth of scye' locates…", options: ["the armhole depth on the frame", "the waist suppression", "the trouser rise"], answer: 0 },
    { id: "t1q10", q: "Deliberate extra length eased into a seam (e.g. sleeve cap into armhole) is called…", options: ["fulling on / holding in", "grading", "blocking"], answer: 0 },
    { id: "t1q11", q: "Style lines should be added…", options: ["before the frame, to set the mood", "only after the block is proven true", "at the first fitting"], answer: 1 },
    { id: "t1q12", q: "Walking the seams of a draft checks that…", options: ["the pattern fits the paper", "seam lines to be sewn together match in length (except declared ease)", "the grain is straight"], answer: 1 },
    { id: "t1q13", q: "Diagonal drags from the neck toward the underarm most likely indicate…", options: ["wrong shoulder slope for the body", "waist too tight", "hem out of level"], answer: 0 },
    { id: "t1q14", q: "Ready-to-wear manufacturing leaned on which school of drafting?", options: ["direct-measure", "proportionate", "rock-of-eye draping"], answer: 1 },
  ],
  practical: {
    kind: "client_measurements",
    title: "Take and record a complete measurement set",
    instructions:
      "In the Client Book, record a dated measurement set for a real client (or yourself) with at least six measurements including chest/waist and one length. This is the cutter's raw material — the school checks that a complete, dated set exists in your shop.",
  },
};

// ---------------------------------------------------------------------------
// S1 · Essential Stitches & Seams (Woman's Institute 1922, Butterick 1921)
// ---------------------------------------------------------------------------

const S1: CourseDef = {
  slug: "stitches-and-seams",
  school: "seamstressing",
  title: "Essential Stitches & Seams",
  summary:
    "The hand stitches, machine seams and edge finishes every garment is built from — the Woman's Institute's first lessons, which have not aged a day.",
  level: "foundation",
  sources: [
    { label: "Woman's Institute — Essential Stitches and Seams (1922)", iaId: "cu31924105503068", url: "https://archive.org/details/cu31924105503068" },
    { label: "Butterick — The New Dressmaker (1921)", iaId: "newdressmakerwit00butt", url: "https://archive.org/details/newdressmakerwit00butt" },
  ],
  lessons: [
    {
      title: "The hand stitches that still matter",
      minutes: 8,
      source: { label: "WI, Essential Stitches", url: "https://archive.org/details/cu31924105503068" },
      bodyMd: `Machines sew seams; hands finish garments. A century after the Woman's Institute wrote its first lesson, high-end garments are still distinguished by exactly the hand stitches it taught. Six earn their keep in a modern studio:

- **Basting** — long, quick running stitches that hold layers for fitting or machining, then come out. Uneven basting (long on top, short beneath) for holding a fold; even basting where the machine will follow. Never iron over basting in dark thread on pale cloth — it prints.

![Photograph of diagonal basting stitches holding two layers of fabric together](/school/stitches-and-seams/lesson0-diagonal-basting.jpg)
*Woman's Institute — diagonal basting across two layers, the corner turned back to show the wrong side.*
- **Running stitch** — the smallest, evenest stitch; gathering and delicate seams.
- **Backstitch** — the strongest hand stitch: the needle steps back into the previous stitch on top, forward beneath. Before the sewing machine, whole garments were built with it; today it repairs seams a machine can't reach.
- **Hemming (slip stitch / felling)** — the invisible finishes. A slip stitch travels inside the fold and takes a thread or two of the body cloth, so nothing shows on the face. Felling secures a folded edge flat, as on the inside of a cuff.
- **Overcasting** — slanting stitches over a raw edge to stop fraying; the ancestor of the overlock/serger, and still the right call on a single seam of a fray-prone woven.

![Diagrams of overcasting stitches worked over a raw fabric edge](/school/stitches-and-seams/lesson0-overcasting.jpg)
*Woman's Institute — overcasting a raw edge, several slanting stitches taken on the needle at once.*
- **Catch stitch (herringbone)** — a crossed stitch that holds a raw or folded edge flat while keeping *give*; the classic hem for heavy or stretchy cloth and the tailor's stitch for holding canvas to cloth.

Two disciplines the Institute drilled that separate professional from home work: **thread length** (no longer than elbow-to-fingertip — long thread frays and knots) and **tension** (the stitch should sit on the cloth, never pucker it; if it puckers, your stitches are too tight or too long for the fabric's weight).

![Diagrams of half-back-stitch and combination stitch being worked with a needle](/school/stitches-and-seams/lesson0-backstitch-and-combination-stitch.jpg)
*Woman's Institute, Essential Stitches and Seams (1922) — the half-back and combination stitches: running and back stitches joined for strength.*

> **Term note:** period books say *cambric* and *lawn* (fine plain-weave cottons), *stay* (a small reinforcing piece), and *fell* (to sew a folded edge down flat). All still in use in ateliers.`,
      checkpoints: [
        {
          q: "The strongest hand stitch, once used to build whole garments, is the…",
          options: ["running stitch", "backstitch", "overcast"],
          answer: 1,
        },
        {
          q: "A slip stitch is prized because…",
          options: [
            "it is the fastest stitch",
            "it travels inside the fold and barely shows on the face",
            "it needs no needle",
          ],
          answer: 1,
        },
      ],
    },
    {
      title: "Seams: plain, French, felled, and when",
      minutes: 9,
      source: { label: "WI + Butterick, seams chapters", url: "https://archive.org/details/newdressmakerwit00butt" },
      bodyMd: `A seam is a decision about strength, bulk, and what the inside of the garment is allowed to look like. The four that cover ninety percent of dressmaking:

**Plain seam** — two edges, one line of stitching, pressed open. The default. Its raw edges must be finished (overcast, pinked on firm cloth, bound on unlined jackets, or overlocked today). A plain seam pressed open is the flattest seam there is — which is why tailored garments live on it.

**French seam** — a seam sewn twice: first wrong sides together close to the edge, trimmed, then right sides together so the raw edges are swallowed inside a tiny channel. The inside shows a clean fold. Right on sheers and fine lingerie fabrics where raw edges would shadow through or fray to nothing; wrong on curves and thick cloth (too much bulk, won't press flat).

![Two-step diagrams showing how a French seam encloses its raw edges](/school/stitches-and-seams/lesson1-french-seam.jpg)
*Woman's Institute — the French seam in two stages: first stitching, then the fold reversed to swallow the raw edges.*

**Flat-felled seam** — one allowance trimmed, the other folded over it and stitched down flat. Two visible rows, everything enclosed, immensely strong. The seam of shirts, jeans and workwear — anything washed hard and worn harder.

**Lapped seam** — one edge folded and lapped over the other, stitched from the face. The yoke seam; also the way stubborn fabrics (leather, felted wool) join without bulk.

![Illustrations of French seam variations from The New Dressmaker seams chapter](/school/stitches-and-seams/lesson1-seams-chapter-french-and-fell.jpg)
*Butterick, The New Dressmaker (1921) — French, turned-in French and fell French seams.*

The Institute's rule of choice still holds: **let the fabric and the garment's life pick the seam.** Sheer and fine → French. Washed and hard-worn → felled. Tailored and pressed → plain, edges finished. Seen from the outside as a style line → lapped.

![Illustrations of bound seam edges and tailored seam finishes](/school/stitches-and-seams/lesson1-bound-and-tailored-seams.jpg)
*Butterick — bound edges and the tailored seam family: joined, broad, cord and tuck seams.*

And its most-quoted commandment: **press as you go.** A seam is not finished when it is sewn; it is finished when it is pressed — each seam pressed flat as sewn to set the stitches, then open or to its side, *before* it is crossed by another seam. A crossed unpressed seam is locked in wrong forever. This one habit is the visible difference between home-made and made.`,
      checkpoints: [
        {
          q: "The right seam for a sheer, fray-prone fabric is the…",
          options: ["flat-felled seam", "French seam", "lapped seam"],
          answer: 1,
        },
        {
          q: "'Press as you go' means…",
          options: [
            "press each seam before it is crossed by another",
            "press the finished garment once at the end",
            "press only the hem",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Edges: hems, facings and bindings",
      minutes: 8,
      source: { label: "Butterick, finishing chapters", url: "https://archive.org/details/newdressmakerwit00butt" },
      bodyMd: `Garments are judged at their edges. The three families of edge finish, and the logic for choosing:

**Hems** — the folded edge. A plain hem turns twice (raw edge hidden in the first fold) and is slip-stitched or machined. Depth is proportion, not habit: deep hems (4–8 cm) give skirts and coats weight and swing; narrow rolled hems suit sheers and flounces. On a *curved* hem the outer edge is longer than where it must land — ease it in with a gathering thread or, on heavy cloth, catch-stitch a single fold flat. Fighting a curved hem with a straight-hem technique is the classic beginner's pucker.

![Illustrations of a plain hem, napery hem, and square hem corner](/school/stitches-and-seams/lesson2-hems-and-mitered-corners.jpg)
*Butterick — turning and basting a plain hem, the napery hem, and folding a square corner.*

**Facings** — a shaped piece, cut to the same curve as the edge, sewn on and turned to the inside; the edge itself shows nothing. Necklines, armholes, shaped front openings. The professional moves: clip the curve so it can turn, **understitch** (a row through facing and allowances, just inside the seam) so the facing rolls to the inside and stays there, and tack it down at the seams only.

![Illustrations of bias, shaped, and sewed-on facings for garment edges](/school/stitches-and-seams/lesson2-facings-straight-bias-shaped.jpg)
*Butterick — stretching a bias facing to a curve with the iron; shaped and sewed-on facings.*

**Bindings** — a bias strip wrapping the raw edge, visible on both sides. Bias-cut strips bend around curves without complaint. Binding is both finish and decoration: a contrast bound neckline is a design line, a matched binding on an unlined jacket's seams is couture's oldest interior finish.

![Diagrams of vertical hemming stitches and a napery hem in progress](/school/stitches-and-seams/lesson2-vertical-hemming-and-french-hem.jpg)
*Woman's Institute — vertical hemming along a turned edge, and the napery (French) hem.*

The Institute's test for any edge: **would it survive the garment's life, and does it deserve to be seen?** A wedding dress hem is slip-stitched invisible; an apron hem is machined and proud of it. Neither is wrong — the failure is mismatching finish to garment.

These choices belong in your construction documentation. When a tech pack's construction notes say "neckline: bias bound, 6 mm finished" instead of just "finish neckline," a factory three time zones away sews what you meant. That is the practical for this course.`,
      checkpoints: [
        {
          q: "Understitching exists to…",
          options: [
            "make the facing roll to the inside and stay there",
            "strengthen the shoulder seam",
            "gather a curved hem",
          ],
          answer: 0,
        },
        {
          q: "Bias-cut binding is used on curves because…",
          options: ["it is cheaper", "bias bends around curves without puckering", "it never frays"],
          answer: 1,
        },
      ],
    },
    {
      title: "Fastenings and the last details",
      minutes: 8,
      source: { label: "WI tailored details; Butterick", url: "https://archive.org/details/pickentailoredbuttonholes1923" },
      bodyMd: `The Institute devoted whole booklets to closures, because closures are where garments fail first and where quality announces itself.

**Buttonholes.** A hand-worked buttonhole is buttonhole stitch (a knotted purl edge) worked over a cut slit, with a **bar tack** at the inner end and a fanned or keyhole end where the button shank sits. Length: button diameter plus its thickness. Direction: horizontal where there is strain (the button then pulls against the end, not the middle), vertical only on plackets with no sideways pull. A bound buttonhole — the slit finished with tiny fabric lips — is the dressmaker's showpiece; period books demand it on any good coat front.

![Step-by-step diagrams of working a hand-sewn buttonhole](/school/stitches-and-seams/lesson3-worked-buttonhole-steps.jpg)
*Woman's Institute — the full sequence of a hand-worked buttonhole: stranding, overcasting, buttonhole stitch, finishing bar.*

**Buttons.** Sewn with a **thread shank** (wind the thread beneath the button before finishing) tall enough for the layers the button must hold — a shankless button on a thick front strangles the cloth. Coat buttons get a small backing button inside on fine cloth so strain never tears the face fabric.

![Photographs of a round-end buttonhole and a tailors' buttonhole](/school/stitches-and-seams/lesson3-round-end-and-tailors-buttonhole.jpg)
*Butterick — the round-end buttonhole and the corded tailors' buttonhole, bar and eyelet ends.*

**Hooks, snaps, and plackets.** Hooks take strain (waistbands); snaps take alignment (inner edges that must lie quietly); a placket is any finished opening that lets a fitted garment be put on — its two rules are *reinforce the stress end* and *nothing shows when closed*.

![Step photographs of constructing a braid-bound buttonhole](/school/stitches-and-seams/lesson3-braid-bound-buttonhole.jpg)
*Mary Brooks Picken, Tailored Buttonholes, Buttons, and Trimmings (1923) — a braid-bound buttonhole from basted strips to finished opening.*

**The last details** the era graded harshly and clients still notice: thread ends buried, not clipped proud; inside as tidy as the outside; a hanging loop where the garment will live on a hook; and every point of strain — pocket corners, placket ends, the top of a slit — finished with a bar tack. A bar tack costs eight seconds. Its absence costs a repair.

Finish this lesson, pass the quiz, and complete the practical — documented construction, in your own tech pack, precise enough that another maker could sew your intent. That is what this certificate says you can do.`,
      checkpoints: [
        {
          q: "Buttonholes are placed horizontally where there is strain because…",
          options: [
            "it looks more traditional",
            "the button pulls against the buttonhole's end rather than gaping its middle",
            "vertical buttonholes are weaker to sew",
          ],
          answer: 1,
        },
        {
          q: "A thread shank on a button exists to…",
          options: [
            "give the buttoned layers room so the cloth isn't strangled",
            "save thread",
            "mark the button's position",
          ],
          answer: 0,
        },
      ],
    },
  ],
  quizDraw: 10,
  passPercent: 80,
  quiz: [
    { id: "s1q01", q: "Basting is…", options: ["a permanent decorative stitch", "temporary stitching that holds layers for fitting or machining", "a pressing technique"], answer: 1 },
    { id: "s1q02", q: "The hand stitch with a crossed pattern that keeps 'give', used on heavy hems and tailor's canvas, is the…", options: ["catch stitch (herringbone)", "running stitch", "whip stitch"], answer: 0 },
    { id: "s1q03", q: "Thread longer than elbow-to-fingertip is avoided because…", options: ["it wastes money", "it frays and knots as it is worked", "it is bad luck"], answer: 1 },
    { id: "s1q04", q: "A plain seam's greatest virtue is…", options: ["flatness when pressed open", "that it needs no finishing", "maximum strength"], answer: 0 },
    { id: "s1q05", q: "A French seam encloses raw edges by…", options: ["binding them in bias", "sewing wrong sides first, trimming, then right sides", "folding one edge over the other"], answer: 1 },
    { id: "s1q06", q: "Jeans and hard-worn shirts use which seam?", options: ["French", "flat-felled", "plain, pinked"], answer: 1 },
    { id: "s1q07", q: "Pressing each seam before another crosses it matters because…", options: ["a crossed unpressed seam is locked in wrong", "it dries the thread", "it shrinks the garment to size"], answer: 0 },
    { id: "s1q08", q: "A curved hem puckers when…", options: ["it is eased with a gathering thread", "its longer outer edge is forced flat with straight-hem technique", "the hem is too shallow"], answer: 1 },
    { id: "s1q09", q: "Understitching runs through…", options: ["the facing and seam allowances, just inside the seam", "the hem fold", "the buttonhole lips"], answer: 0 },
    { id: "s1q10", q: "The correct buttonhole length is…", options: ["button diameter", "button diameter plus its thickness", "twice the diameter"], answer: 1 },
    { id: "s1q11", q: "A bound buttonhole is…", options: ["a slit finished with small fabric lips", "a buttonhole sewn by machine", "a hole edged with metal"], answer: 0 },
    { id: "s1q12", q: "A bar tack belongs at…", options: ["every point of strain — pocket corners, placket ends, slit tops", "the middle of every seam", "the center back neck only"], answer: 0 },
    { id: "s1q13", q: "Overcasting is the hand ancestor of…", options: ["the overlock/serger finish", "the buttonhole", "topstitching"], answer: 0 },
    { id: "s1q14", q: "The Institute's test for an edge finish is…", options: ["speed of sewing", "whether it survives the garment's life and suits being seen", "whether it uses matching thread"], answer: 1 },
  ],
  practical: {
    kind: "construction_notes",
    title: "Document construction like a professional",
    instructions:
      "On any tech pack in your shop, write construction notes for at least three areas (e.g. neckline, side seams, hem) that name the specific seam or finish — 'French seam', 'bias bound 6mm', 'blind hem, 5cm deep'. The school verifies real notes exist naming real techniques.",
  },
};

// ---------------------------------------------------------------------------
// F3 · The Economics of Fashion (Nystrom 1928, Pope 1905)
// ---------------------------------------------------------------------------

const F3: CourseDef = {
  slug: "economics-of-fashion",
  school: "fashion",
  title: "The Economics of Fashion",
  summary:
    "Nystrom's 1928 founding text, newly public domain: why fashion moves, what a price says, and how a small label survives the cycle — the business half of design literacy.",
  level: "intermediate",
  sources: [
    { label: "Paul H. Nystrom — Economics of Fashion (1928)", iaId: "economics-of-fashion-1928-paul-nystrom", url: "https://archive.org/details/economics-of-fashion-1928-paul-nystrom" },
    { label: "J.E. Pope — The Clothing Industry in New York (1905)", iaId: "clothingindustry00poperich", url: "https://archive.org/details/clothingindustry00poperich" },
  ],
  lessons: [
    {
      title: "Fashion, style, and the difference that pays",
      minutes: 8,
      source: { label: "Nystrom, ch. 1–3", url: "https://archive.org/details/economics-of-fashion-1928-paul-nystrom" },
      bodyMd: `Nystrom opens with a distinction the industry still trips over. A **style** is a characteristic mode of expression — the sailor collar, the trench coat, the bias-cut slip. Styles are permanent: once invented, they exist forever, available to be revived. A **fashion** is a style *currently accepted* — a social fact, not an aesthetic one. Fashion is what people are wearing; style is what exists to be worn.

Why does this matter commercially? Because the two make money differently. Selling **fashion** is a timing business: value peaks while acceptance rises and evaporates when it passes — mistime it and you own markdowns. Selling **style** — a signature cut you return to season after season — is a compounding business: every year the same block gets better known, better made and cheaper to produce.

Nystrom's second axiom: **fashion is social, not aesthetic.** A design does not become fashion because it is beautiful; it becomes fashion when people with influence adopt it and others follow — his word for much of it was the "philosophy of futility," consumption as social signaling. The practical consequence for a label: you cannot argue a market into a silhouette. You can only watch acceptance move (this is literally what your R&D brand watches do) and decide whether to ride, wait, or hold your own line.

His third: fashions move in **cycles** — introduction by leaders, rise, mass acceptance, decline into ubiquity, death by association with the out-of-date, and, a generation later, revival. The cycle cannot be stopped, only read. Trend research is the reading; a trend board with sources is Nystrom's method with better plumbing.

![Line chart of four neckline styles' popularity, 1920-1926](/school/economics-of-fashion/lesson0-neckline-trends.jpg)
*Paul Nystrom, Economics of Fashion (1928), plate 2 — four neckline styles displacing one another, season by season, 1920–1926.*

> **A century's inflation note:** period retail prices in these sources multiply by roughly 18× to 2026 dollars. A $25 dress in 1928 was a ~$450 purchase — contemporary designer money, which reframes what "ordinary" garments once cost.`,
      checkpoints: [
        {
          q: "In Nystrom's terms, a fashion is…",
          options: [
            "any beautiful design",
            "a style currently accepted by the buying public",
            "a garment under $25",
          ],
          answer: 1,
        },
        {
          q: "Selling a signature style year after year is attractive because…",
          options: [
            "it compounds — known better, made better, produced cheaper over time",
            "it avoids all competition",
            "styles never stop selling",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "What a price says",
      minutes: 9,
      source: { label: "Nystrom, pricing chapters", url: "https://archive.org/details/economics-of-fashion-1928-paul-nystrom" },
      bodyMd: `Nystrom taught marketing at Columbia, and his chapters on price read like they were written for a founder setting her first line sheet.

**Price is a message before it is a margin.** Consumers read price as information about quality, exclusivity and intended wearer — often *the* primary information, since quality is hard to judge on a rack. Price too low for the story you tell and the customer disbelieves the story; too high without visible justification and she feels foolish. Every market settles into **price zones** — bands the customer recognizes (his era's "popular price," "better," "fine") — and a garment priced *between* zones inherits the doubts of both. This is precisely what your comps table in a price study maps: where the zones sit today, in your category, in your market.

**The demand curve bends around the zones.** Within a zone, small price differences barely move sales; crossing a zone boundary moves them violently. So the working question is never "is $138 better than $145?" — it is "which zone do we claim, and does everything about the garment agree with the claim?" Fabric, make, photography, stockists and price must all tell one story; the customer buys the coherence, not the number.

**Markdowns are the tax on misreading fashion.** Nystrom's merchandising rule: goods whose value is fashion-driven lose value as acceptance passes, on a schedule no one can suspend. The discipline is to buy (or cut) shallow on the fashion-driven part of a line, deep on the style-driven part — and to take the first markdown early, when it is small, rather than late, when it is fatal.

![Curve of consumer buying cycle peaking before the consumer use cycle](/school/economics-of-fashion/lesson1-consumer-buying-cycle.jpg)
*Nystrom, plate 3 — buying peaks and collapses before use does: the timing logic behind early premiums and late markdowns.* Pre-orders, small-batch runs and made-to-measure — the modern independent's toolkit — are all ways of pushing that risk toward zero. Your ancestors in this book managed it with open-to-buy budgets, which is why Verto has one.`,
      checkpoints: [
        {
          q: "Pricing between two recognized zones tends to…",
          options: [
            "capture both markets",
            "inherit the doubts of both zones",
            "have no effect",
          ],
          answer: 1,
        },
        {
          q: "Nystrom's markdown discipline is…",
          options: [
            "never mark down",
            "take the first markdown early, while it is small",
            "mark down only at season end",
          ],
          answer: 1,
        },
      ],
    },
    {
      title: "The trade behind the label",
      minutes: 8,
      source: { label: "Pope, The Clothing Industry in New York", url: "https://archive.org/details/clothingindustry00poperich" },
      bodyMd: `Pope's 1905 study of the New York garment trade is the anatomy of an industry structure that, renamed, is still yours.

**The contracting system.** The manufacturer (today: the brand) designs, buys cloth and sells; the **contractor** (today: your factory or atelier) organizes labor to sew it. Pope shows why the split exists: sewing capacity is spiky — seasons, fashion swings — and contractors absorb the spikes so brands don't carry idle workrooms. Everything in your Factories & Suppliers module descends from this: the brand-contractor negotiation over price per piece, minimums, and who eats the risk of a slow season.

**Piece rates and the season.** The trade ran on piece-work priced per operation, renegotiated each season as styles changed — a more complex style meant re-pricing every operation on it. That is still exactly what a cut-and-sew quote is: your tech pack decomposed into operations, priced, summed. A vague tech pack gets a padded quote; the padding is the contractor pricing *uncertainty*. (Pope also documents where the era went dark — sweated home work, the conditions that led to the reforms and the union contracts that followed. Knowing that history is part of buying production responsibly.)

**The season's arithmetic.** Two seasons, cloth committed months ahead of sales, cash tied up between cutting and payment — Pope's merchants lived on exactly the cash-flow cycle your finance pages model. Their instruments were credit terms and factoring; yours are deposits, pre-orders and net-terms wholesale. The problem is unchanged: the money is spent in the season before it is earned.

Read Pope and the modern supply chain loses its mystery: you are the manufacturer of 1905 with better tools, and your maker is the contractor — which is why clarity, fair terms and good tech packs have been the whole game for a hundred and twenty years.`,
      checkpoints: [
        {
          q: "In Pope's structure, today's independent brand plays the role of the…",
          options: ["contractor", "manufacturer", "jobber"],
          answer: 1,
        },
        {
          q: "A vague tech pack gets a padded quote because…",
          options: [
            "contractors price the uncertainty",
            "factories dislike paperwork",
            "piece rates are illegal now",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Reading the cycle without being eaten by it",
      minutes: 8,
      source: { label: "Nystrom, cycle & forecasting chapters", url: "https://archive.org/details/economics-of-fashion-1928-paul-nystrom" },
      bodyMd: `Nystrom's closing counsel to merchants is a survival manual for small labels, translated here into the tools you already run:

**1. Separate your line into cycle-riders and keepers.** The keepers (your signature blocks, your best fabrics) are style; produce them confidently and improve them yearly. The cycle-riders are fashion; cut them shallow, sell them fast, and let them go without sentiment. Most failed labels die of treating fashion inventory like style inventory.

![Bell-shaped curve labeled theoretical representation of normal fashion cycle](/school/economics-of-fashion/lesson3-normal-fashion-cycle.jpg)
*Nystrom, plate 1 — the normal fashion cycle: adoption rising to a peak and decaying on a schedule no one can suspend.*

**2. Watch acceptance, not opinion.** Nystrom's forecasting method was systematic observation — what the leading stores show, what the leading customers actually buy, tracked continuously rather than divined. He would have recognized your R&D instantly: watched brand dossiers with "what changed," trend boards with sources, price studies with comps. The instruments are new; the method is his.

![Two historical line charts of skirt width and skirt length, 1845-1920](/school/economics-of-fashion/lesson3-skirt-width-length-trends.jpg)
*Nystrom, plates 4–5 (after Kroeber) — skirt width and length, 1845–1920: the long swings underneath fashion's noise.*

**3. Let price carry the story you can defend.** Claim the zone your making genuinely supports — Belgian linen and Casablanca tailoring defend a zone; wishing does not. Push the target retail into the cost sheet and check that the margin survives wholesale math *before* the season, not after.

**4. Respect the futility.** Nystrom's phrase — the "philosophy of futility" — was half critique, half warning: much fashion consumption is signaling, restless and irrational, and it will not become rational because your spreadsheet needs it to. The defense is not cynicism; it is keeping your fixed costs low, your keepers strong, and your fashion bets small enough to be wrong about.

Pass the quiz, then complete the practical: a real price study, decided, with at least five comparables — Nystrom's method, executed in your own market. That is the artifact this certificate stands on.`,
      checkpoints: [
        {
          q: "Most failed labels, in this course's framing, die of…",
          options: [
            "treating fashion inventory like style inventory",
            "pricing too high",
            "having too few Instagram followers",
          ],
          answer: 0,
        },
        {
          q: "Nystrom's forecasting method was…",
          options: [
            "systematic observation of acceptance, continuously tracked",
            "intuition of the designer",
            "copying Paris exactly",
          ],
          answer: 0,
        },
      ],
    },
  ],
  quizDraw: 10,
  passPercent: 80,
  quiz: [
    { id: "f3q01", q: "A style, unlike a fashion, is…", options: ["always expensive", "permanent — it exists to be revived", "whatever sells this season"], answer: 1 },
    { id: "f3q02", q: "Fashion becomes fashion through…", options: ["aesthetic merit alone", "social acceptance and imitation", "government standards"], answer: 1 },
    { id: "f3q03", q: "Nystrom's 'philosophy of futility' referred to…", options: ["consumption as restless social signaling", "the pointlessness of tailoring", "bankruptcy law"], answer: 0 },
    { id: "f3q04", q: "The fashion cycle ends with…", options: ["permanent death", "decline into ubiquity, then later revival", "a fixed five-year rerun"], answer: 1 },
    { id: "f3q05", q: "Price acts primarily as…", options: ["a message consumers read about quality and intended wearer", "a pure cost calculation", "a legal requirement"], answer: 0 },
    { id: "f3q06", q: "Within a price zone, small price differences…", options: ["move sales violently", "barely move sales", "are illegal"], answer: 1 },
    { id: "f3q07", q: "The garment priced between two zones…", options: ["captures both", "inherits the doubts of both", "defines a new zone automatically"], answer: 1 },
    { id: "f3q08", q: "Nystrom's markdown rule: the first markdown should be…", options: ["early and small", "late and deep", "never taken"], answer: 0 },
    { id: "f3q09", q: "In the contracting system, the contractor exists to…", options: ["absorb spiky sewing demand so brands don't carry idle workrooms", "design the line", "own the retail stores"], answer: 0 },
    { id: "f3q10", q: "A cut-and-sew quote is essentially…", options: ["your tech pack decomposed into priced operations", "a flat fee per garment type", "a percentage of retail"], answer: 0 },
    { id: "f3q11", q: "The garment trade's core cash problem, 1905 and now:", options: ["money is spent in the season before it is earned", "banks refuse the industry", "cloth is paid after sales"], answer: 0 },
    { id: "f3q12", q: "'Keepers' in a line should be…", options: ["cut shallow and dropped fast", "produced confidently and improved yearly", "priced between zones"], answer: 1 },
    { id: "f3q13", q: "Modern tools that push fashion-timing risk toward zero include…", options: ["pre-orders, small batches, made-to-measure", "deeper wholesale discounts", "longer seasons"], answer: 0 },
    { id: "f3q14", q: "Roughly, $25 retail in 1928 corresponds to what in 2026 dollars?", options: ["about $45", "about $450", "about $4,500"], answer: 1 },
  ],
  practical: {
    kind: "price_study",
    title: "Run a real price study and decide",
    instructions:
      "In R&D → Pricing, complete a price study for one of your categories: at least five comparables in the comps table and the study marked 'decided'. Nystrom's method, your market — the school verifies the artifact.",
  },
};

/** Courses in catalog order. PR waves append to this list. */
export const COURSES: CourseDef[] = [T1, T2, T3, S1, S2, S3, F1, F2, F3];

export function getCourse(slug: string): CourseDef | undefined {
  return COURSES.find((c) => c.slug === slug);
}

export function coursesForSchool(key: string): CourseDef[] {
  return COURSES.filter((c) => c.school === key);
}
