import type { CourseDef } from "./types";

/**
 * School of Tailoring, courses 2–3: the trouser and the coat — adapted from
 * W.D.F. Vincent's Cutter's Practical Guide volumes (the Tailor & Cutter
 * academy canon, which uniquely covered making and FITTING, not just
 * drafting), Croonborg's American Supreme System, and the Copeland Method
 * for pressing and alteration. All verified public-domain scans.
 */

export const T2: CourseDef = {
  slug: "the-trouser",
  school: "tailoring",
  title: "The Trouser",
  summary:
    "Vincent's trouser volume is still the best course ever written on legs: the anatomy of a trouser draft, the crutch and the seat, and the fitting remedies that diagnose every wrinkle.",
  level: "intermediate",
  sources: [
    { label: "W.D.F. Vincent — The Cutter's Practical Guide: Trousers, Breeches and Knickers (1905)", iaId: "cutters-practical-guide-trousers", url: "https://archive.org/details/cutters-practical-guide-trousers" },
    { label: "F.T. Croonborg — Grand Edition of Supreme System (1907)", iaId: "grandeditionofsu00croo", url: "https://archive.org/details/grandeditionofsu00croo" },
  ],
  lessons: [
    {
      title: "Anatomy of a trouser draft",
      minutes: 9,
      source: { label: "Vincent, opening plates", url: "https://archive.org/details/cutters-practical-guide-trousers" },
      bodyMd: `A trouser is two tubes joined at a fork, and every line on its draft exists to manage that fork. Learn the names and the whole diagram opens up:

- **The rise** (body rise) — waist to seat-level in the sitting position; it sets how high the tube reaches above the fork. Everything above the crutch line is rise.
- **The crutch (crotch) line** — the horizontal where the legs divide; the single most important level in the draft.
- **The fork** — the extension the draft throws forward (front) and backward (back) past the leg's vertical to wrap the inner thigh. The back fork is always longer than the front — the seat needs the room.
- **The seat angle** — the slant of the back rise away from the vertical. This is the trouser's *balance*: a steep seat angle gives room for movement and a fuller seat; a shallow one gives a cleaner back on a flat seat and less room to sit.
- **The leg lines** — from fork and seat, straight runs to knee and bottom, split evenly around the **crease line**, which is the leg's grain and plumb line. A trouser hangs from the crease the way a coat hangs from the shoulder.

Vincent's method (and Croonborg's American variant) drafts the frame from four measures — side length, leg (inseam), waist, seat — with the crutch line placed by the difference between side and leg. Widths at waist and seat are quarter-girths plus ease; the fork extensions are fractions of the seat, because the fork wraps a body whose depth scales with its girth.

Two period disciplines worth keeping verbatim. First, **the seat measure is taken easy, never tight** — a trouser that measures exactly the seat cannot be sat in. Second, **the leg is measured to the heel seam of the shoe the trouser will be worn with**; a trouser has no hem length in the abstract.

> **Term note:** *crutch* = crotch; *small* = the narrowest waist point; *dress* = the side on which the wearer, historically, "dresses" — period drafts cut the left fork slightly larger. Modern blocks usually ignore it; bespoke cutters still ask.`,
      checkpoints: [
        {
          q: "Why is the back fork always longer than the front fork?",
          options: [
            "Tradition from military uniforms",
            "The seat needs more wrap and room than the front of the thigh",
            "To make pressing easier",
          ],
          answer: 1,
        },
        {
          q: "The crease line functions as…",
          options: [
            "a decoration added at pressing",
            "the leg's grain and plumb line — the trouser hangs from it",
            "the sewing line for the side seam",
          ],
          answer: 1,
        },
      ],
    },
    {
      title: "The seat angle and the sitting body",
      minutes: 9,
      source: { label: "Vincent, breeches & seat chapters", url: "https://archive.org/details/cutters-practical-guide-trousers" },
      bodyMd: `Everything a trouser must do that a skirt need not do comes down to one motion: sitting. Sitting lengthens the back of the body from waist to fork by several centimeters and does nothing to the front. The draft has exactly one tool for that asymmetry: the **seat angle** on the back panel.

Swing the back rise away from vertical and you *bank* extra back length that standing hides in soft vertical folds under the seat and sitting spends. Vincent's rule of thumb: a **normal figure takes a moderate slant; an erect, flat-seated figure less; a stooped or full-seated figure more.** Breeches and riding trousers — cut for a permanently "sitting" posture in the saddle — take the steepest angles in the book, which is why the breeches chapters are the clearest demonstration of the principle.

The seat angle trades against cleanliness. More angle = more sitting room and more standing slack; less angle = a cleaner standing back that binds when seated. Where the customer lives on that trade is a question about their life, not their body: a barrister who stands to speak wants clean; a driver wants room. Period cutters asked. So should a modern studio brief.

Companion decisions that live with the angle:

- **Waist suppression and darts.** The back waist is smaller than the seat; the difference is suppressed in the side seam, the back darts, and the center-back seam. The center-back seam is also the alteration bank — period trousers were cut with generous back-seam inlays precisely so the waist could follow the customer through the years.
- **The front: flat or pleated.** A flat front is drafted nearly on the quarter-waist; pleats add width at the waist that opens over the thigh when seated. Pleats are the front's version of the seat angle: banked room.
- **Ease is positional.** Vincent's tables put ease at the seat and thigh, near-none at the waist, taper to choice at the knee and bottom. A trouser that is "2 cm bigger everywhere" fits nowhere.`,
      checkpoints: [
        {
          q: "The seat angle exists because…",
          options: [
            "sitting lengthens the back of the body but not the front",
            "cloth shrinks more in the back",
            "belts pull trousers backward",
          ],
          answer: 0,
        },
        {
          q: "A steeper seat angle gives…",
          options: [
            "a cleaner standing back but binds when sitting",
            "more sitting room at the cost of standing slack",
            "a smaller waist",
          ],
          answer: 1,
        },
      ],
    },
    {
      title: "Reading trouser wrinkles: the fitting remedies",
      minutes: 10,
      source: { label: "Vincent, 'Fitting' section", url: "https://archive.org/details/cutters-practical-guide-trousers" },
      bodyMd: `The glory of Vincent's volume is its remedies section — a diagnostic table for trouser faults that reads today like it was written for your last fitting. The faults, their signatures, and the cuts that cure them:

**Folds under the seat (standing).** Some slack is the price of sitting room; *excessive* horizontal folds mean the back fork or seat angle over-banked for this figure. Remedy: lift the back — take a wedge out of the back rise at the seat seam (period cutters pinned the surplus at the waist and transferred it to the draft).

**Tight, dragging seat; front pockets gape.** The opposite fault: not enough seat room. Drags radiate from the fork toward the hip; sitting strains the seam. Remedy: let out the center-back seam (that inlay again), or re-cut with more seat angle and fork.

**Drags from the fork down the inner thigh.** The fork itself is too short — the tube is hung on the body's fork like a too-small sling. Remedy: lengthen the fork extension; no amount of waist or seam adjustment substitutes.

**Trouser twists around the leg; crease swings off plumb.** The leg lines are unbalanced around the crease — inseam and side seam disagree — or the cloth was cut off grain. Remedy: re-plumb the leg on the draft; check grain before blaming the body.

**Diagonal drags from the knee, front.** The leg is dressed straighter than the wearer's actual leg-line; period books politely call the cause "bow legs" or "knock knees." The remedy is honest: swing the leg of the draft to follow the limb.

**Waistband rolls or gapes at back.** Suppression in the wrong place: gaping wants more dart/seam suppression; rolling wants less, or the rise is simply too long for the figure's hollow.

The method behind all of these is the method of this whole school: **a wrinkle is a vector.** It points from where the cloth is trapped toward where it wants to go. Read the direction, find which line of the draft governs that region, and change that line — never chase a wrinkle by taking in whatever seam is nearest. Verto's fit map draws these vectors in color before cloth is cut; Vincent taught the same reading on the living customer.`,
      checkpoints: [
        {
          q: "Drags radiating from the fork down the inner thigh mean…",
          options: [
            "the fork extension is too short",
            "the waist is too tight",
            "the hem is uneven",
          ],
          answer: 0,
        },
        {
          q: "The general method for any fitting fault is…",
          options: [
            "take in the nearest seam until the wrinkle disappears",
            "read the wrinkle as a vector and change the draft line that governs that region",
            "press harder",
          ],
          answer: 1,
        },
      ],
    },
    {
      title: "From draft to trouser: making notes that matter",
      minutes: 8,
      source: { label: "Vincent, making-up notes; Croonborg", url: "https://archive.org/details/grandeditionofsu00croo" },
      bodyMd: `Vincent ends where most drafting books stop short: what the maker must know that the draft cannot say. The trouser-specific making points, still the difference between bought and bespoke:

**The crease is pressed, and it is permanent geometry.** Front crease runs to meet the pleat (or dies into the fly area on a flat front); back crease stops traditionally below the seat. Creases are pressed *before* assembly on the flat panels — trying to find a straight crease on a sewn tube is guesswork.

**Stretch and shrink.** The iron is a shaping tool: the back panel is *stretched* along the inside of the leg at the fork and *shrunk* over the seat, easing the flat cloth toward the body's curves before a stitch is sewn. This is the invisible half of why bespoke trousers hang cleanly; it belongs in construction notes ("shrink back-seat; stretch fork") or it doesn't happen.

**The order of assembly** — pockets and fly details on flat panels first; then side seams; then inseams; the two legs joined at the seat seam *last*, sewn twice for strength. The seat seam is left with its generous inlay and a loose double stitch: it is the alteration seam, and every period book protects it.

**Waistband and finish.** The band is interfaced (period: linen canvas), closed with hook and bar (takes strain better than a button), and carries the brace buttons or belt loops the customer's habits demand — ask, don't assume. Bottoms: plain or cuffed ("permanent turn-up"), hemmed to the shoe with a slight back-drop (the back hem 1–2 cm longer so it sits on the shoe's heel).

Your practical for this course is exactly this translation: take a real trouser (or any lower-body style you're developing) and write its tech pack's **graded measurement points** — waist, seat, thigh, knee, leg opening, front and back rise at minimum. Five points that a factory can measure on the finished garment is the difference between "fits like the sample" and an email thread. The school verifies the points exist.`,
      checkpoints: [
        {
          q: "The iron's stretch-and-shrink work happens…",
          options: [
            "on the flat panels before assembly",
            "after the trouser is finished",
            "only during alterations",
          ],
          answer: 0,
        },
        {
          q: "The seat seam is sewn last, doubly, and with inlay because…",
          options: [
            "it is decorative",
            "it takes the most strain and is the trouser's alteration seam",
            "machines cannot sew it earlier",
          ],
          answer: 1,
        },
      ],
    },
  ],
  quizDraw: 10,
  passPercent: 80,
  quiz: [
    { id: "t2q01", q: "The 'rise' of a trouser is…", options: ["waist to seat level — the tube above the fork", "the leg length", "the hem circumference"], answer: 0 },
    { id: "t2q02", q: "The crutch line is…", options: ["the horizontal where the legs divide", "the side seam", "the waistband seam"], answer: 0 },
    { id: "t2q03", q: "Fork extensions are drafted as fractions of the…", options: ["waist", "seat", "inseam"], answer: 1 },
    { id: "t2q04", q: "The seat measure is taken…", options: ["easy, never tight — you must be able to sit", "as tight as possible", "over the trouser waistband"], answer: 0 },
    { id: "t2q05", q: "Riding breeches take the steepest seat angles because…", options: ["riders are heavier", "the saddle posture is permanently 'seated'", "tradition"], answer: 1 },
    { id: "t2q06", q: "Pleats at a trouser front are functionally…", options: ["banked width that opens over the seated thigh", "purely decorative", "a waist reduction"], answer: 0 },
    { id: "t2q07", q: "Ease in a trouser belongs mainly at…", options: ["the waist", "the seat and thigh", "the hem"], answer: 1 },
    { id: "t2q08", q: "Excessive horizontal folds under the seat when standing mean…", options: ["too little fork", "over-banked seat angle/back fork for this figure", "the crease is off"], answer: 1 },
    { id: "t2q09", q: "A twisting leg with the crease off plumb points to…", options: ["unbalanced leg lines or off-grain cutting", "a short fork", "a long rise"], answer: 0 },
    { id: "t2q10", q: "A gaping back waistband wants…", options: ["more suppression (darts/seams)", "less suppression", "a longer fork"], answer: 0 },
    { id: "t2q11", q: "Creases are pressed…", options: ["before assembly, on flat panels", "after the first wearing", "only on formal trousers"], answer: 0 },
    { id: "t2q12", q: "'Shrink back-seat, stretch fork' is an instruction for…", options: ["the iron shaping flat cloth toward body curves", "the washing instructions", "grading between sizes"], answer: 0 },
    { id: "t2q13", q: "The back hem sits slightly lower than the front because…", options: ["it covers the shoe's heel cleanly", "cloth stretches in wear", "it saves fabric"], answer: 0 },
    { id: "t2q14", q: "A wrinkle in fitting should be read as…", options: ["a vector pointing from trapped cloth toward where it wants to go", "a fabric defect", "a pressing error, always"], answer: 0 },
  ],
  practical: {
    kind: "measurement_points",
    title: "Write a graded spec a factory can measure",
    instructions:
      "On a tech pack in your shop, define at least five measurement points (e.g. waist, seat, thigh, knee, leg opening, front/back rise). The school verifies a real graded spec exists — the document that makes 'fits like the sample' checkable.",
  },
};

export const T3: CourseDef = {
  slug: "the-jacket-and-coat",
  school: "tailoring",
  title: "The Jacket & Coat",
  summary:
    "The tailored upper half: how a jacket draft carries the shoulder, what the canvas does, why pressing is half the making — Vincent's jacket volumes plus the Copeland pressing method.",
  level: "advanced",
  sources: [
    { label: "W.D.F. Vincent — CPG: Jacket Cutting and Making (1897)", iaId: "cutters-prac-guide-jacket-cutting", url: "https://archive.org/details/cutters-prac-guide-jacket-cutting" },
    { label: "W.D.F. Vincent — CPG: Body Coats (1893)", iaId: "cutters-prac-guide-part-2-coats", url: "https://archive.org/details/cutters-prac-guide-part-2-coats" },
    { label: "Vanness Copeland — The Copeland Method (1908)", iaId: "copelandmethodco00cope", url: "https://archive.org/details/copelandmethodco00cope" },
  ],
  lessons: [
    {
      title: "How a jacket hangs: scye, shoulder, balance",
      minutes: 9,
      source: { label: "Vincent, jacket drafts", url: "https://archive.org/details/cutters-prac-guide-jacket-cutting" },
      bodyMd: `A trouser hangs from the waist; a jacket hangs from about ten centimeters of shoulder seam. That is why coat cutting is the senior branch of the trade, and why every line in a jacket draft ultimately serves the shoulder and the **scye** (the armhole — "arm's eye").

The frame of Vincent's jacket draft sets three depths from the nape: **depth of scye**, natural waist, full length. Across it hang the three widths: back width, chest width, over-shoulder. Between back and chest widths lives the scye — and the first law of the scye is that *smaller is better than bigger*. A high, snug armhole moves with the arm; a deep, generous one drags the whole coat every time the arm lifts. Beginners lower the scye for comfort and achieve the opposite; the comfort lives in the **sleeve**, not the hole.

The **shoulder seam** carries balance, exactly as in T1 but with sharper consequences: square shoulders on a sloping draft throw drags from the neck; sloping shoulders on a square draft collapse the chest. Vincent drafts a standard slope and immediately lists its corrections — the era assumed bodies vary; the draft is a starting position.

**Waist suppression** turns the tube into a figure: front dart, side-body seam (the panel between front and back that period coats made much of), and the center-back seam each take a share. How the shares are distributed is house style — a soft Neapolitan-adjacent jacket suppresses gently and low; a structured English coat takes more, higher. The draft is the same geometry either way; the *distribution* is design.

> **Term note:** the *side-body* is the underarm panel of a body coat; the *forepart* is the front panel; the *top-side/under-side* are a sleeve's two pieces. The *break* is where the lapel turns; the *gorge* is the seam where collar meets lapel.`,
      checkpoints: [
        {
          q: "The first law of the scye is…",
          options: [
            "smaller (higher) is better than bigger — mobility lives in the sleeve",
            "as deep as possible for comfort",
            "it must equal the chest width",
          ],
          answer: 0,
        },
        {
          q: "Waist suppression in a coat is shared between…",
          options: [
            "front dart, side-body seam and center-back seam",
            "the hem and cuffs",
            "the collar and gorge",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "The sleeve and its pitch",
      minutes: 9,
      source: { label: "Vincent, sleeve chapters", url: "https://archive.org/details/cutters-prac-guide-part-2-coats" },
      bodyMd: `The two-piece coat sleeve — top-side and under-side — is drafted *to its scye*, never in the abstract: the sleeve head's length is the scye's circumference plus the ease the cloth can drink (period wool: 3–4 cm; modern high-twist: less; the cloth votes).

**Crown ease is not optional.** The sleeve head is deliberately longer than the scye and is *worked in* — fulled over the shoulder region so the sleeve rounds over the deltoid instead of denting under it. A sleeve set clean like a shirt sleeve reads flat and cheap on a tailored shoulder. This is Vincent's "fulling on" from T1 at its most visible.

**Pitch** is the sleeve's rotation in the scye, and it is the most common sleeve fault in ready-to-wear. The arm does not hang straight; it hangs slightly forward. The sleeve must be pitched to match — its seams rotated so the sleeve's natural curve follows the arm. Mis-pitched sleeves announce themselves precisely: **drags from the sleeve head spiraling around the arm.** Forward drags (toward the chest): pitched too far back. Backward spirals: too far forward. The remedy is never pressing and never the sleeve seams — the sleeve comes out and goes back in rotated. Period fitters marked pitch at the try-on with a chalk line down the hanging arm; nothing better has been invented.

**The elbow bend** is drafted, not eased: the top-side is longer at the back seam through the elbow, the under-side shorter, so the empty sleeve already crooks the way an arm does. A dead-straight sleeve on a hanger is a warning sign.

Cuff and finish carry the signatures — working buttonholes ("surgeon's cuffs") are period bespoke's calling card — but the craft is above: a small high scye, a fulled crown, correct pitch, a drafted bend. Get those four right and the jacket moves like clothing; miss one and no button will save it.`,
      checkpoints: [
        {
          q: "Crown ease exists so that…",
          options: [
            "the sleeve rounds over the shoulder muscle instead of denting under it",
            "the sleeve can be lengthened later",
            "the scye can be cut larger",
          ],
          answer: 0,
        },
        {
          q: "Spiral drags around the arm mean…",
          options: [
            "the sleeve's pitch is wrong — rotate it in the scye",
            "the cuff is too tight",
            "the cloth is off grain",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Canvas: the coat inside the coat",
      minutes: 9,
      source: { label: "Vincent, making-up; trade practice", url: "https://archive.org/details/cutters-prac-guide-jacket-cutting" },
      bodyMd: `Take the cloth off a tailored jacket and a ghost of the jacket remains: the **canvas** — a shaped interior of hair cloth and linen that gives the front its body, the lapel its roll, and the chest its quiet fullness. The era's making chapters treat it as the making; everything else is assembly.

The classic structure, unchanged from Vincent's day to today's bespoke: a **body canvas** of wool-and-hair interlining through the forepart; over its chest, a **hair-cloth chest piece** feathered out with a softer **domette** layer so no edge telegraphs; the whole shaped to the body's curve not by cutting but by **pad stitching** — rows of small diagonal stitches through canvas and cloth (or canvas alone), each row rolling the layers slightly over the fingers as it is sewn. Pad stitching is how flat materials are *taught a curve they keep*.

Nowhere does pad stitching matter more than the **lapel**: stitched in rows parallel to the roll line, curling the lapel toward the body so it rolls — not creases — at the break. A lapel that lies flat as paper was fused, not padded; the roll is the tell.

The **roll line itself is taped** — a stay tape sewn along it slightly tight, so the break hugs the chest and never bows away. Edges, too: tape the front edge and the gorge, or the bias-adjacent curves grow in wear and the front swings open. Period books are absolute about taping; modern factories skip it at price points, and the fronts tell you.

Fusible interfacings replaced all this in industrial making — honest at the price, stiff at the soul, and famously mortal (the bubble of a delaminated fused front is the twentieth century's contribution to coat pathology). A studio doesn't need to hand-pad everything; it needs to **know which garment deserves which interior** and write it in the tech pack: "fronts: sew-in canvas, padded lapels, taped roll line" is a sentence a maker can price and a customer can feel.`,
      checkpoints: [
        {
          q: "Pad stitching shapes the lapel by…",
          options: [
            "rows of small stitches that roll the layers into a curve they keep",
            "cutting the canvas on the bias",
            "pressing with steam only",
          ],
          answer: 0,
        },
        {
          q: "The roll line is taped slightly tight so that…",
          options: [
            "the lapel's break hugs the chest instead of bowing away",
            "the collar can be removed",
            "the canvas stays dry",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Pressing: the Copeland method",
      minutes: 8,
      source: { label: "Copeland Method (1908)", url: "https://archive.org/details/copelandmethodco00cope" },
      bodyMd: `Copeland's little 1908 manual is about the least glamorous work in the trade — pressing, cleaning, repairing — and it contains more usable craft per page than books five times its size. Its core claim: **pressing is construction.** The iron does three different jobs, and confusing them ruins garments:

1. **Setting** — flattening a sewn seam to bed the stitches, then opening or turning it. Every seam, as sewn, before it is crossed (the seamstress's rule from S1, promoted to law in tailoring).
2. **Shaping** — the stretch-and-shrink work: shrinking fullness out of a collapsing area (the back-seat of trousers, the crown of a sleeve after setting), stretching length into a curve (the fork, the front edge's roll). Shaping happens on the tailor's shaped tools — the ham for curves, the sleeve board for tubes — because pressing a curved region flat *presses the curve out of it*.
3. **Finishing** — the final press that makes the garment shop-ready without making it shiny.

Copeland's rules of the iron, verbatim in spirit: **moisture, then heat, then pressure — and none of them in excess.** Steam relaxes wool; the iron sets it; pressure without moisture glazes it (the dreaded shine on dark worsteds — his fix: press under a dampened cloth, never iron-to-cloth on the face). Wool has memory: what you press in wrong, you must press out first — you cannot press a correction *over* an error.

He is equally practical about **alteration pressing**: let out a seam and the old crease line remains as a ghost; it must be steamed and worked out before the new line is pressed, or the garment forever shows both. Every alterations studio learns this in week one; Copeland wrote it down in 1908.

The remainder of his method — brushing, sponging, the care that keeps a garment alive between wearings — is the ancestor of every "care" page. It belongs in yours: garments whose care is documented come back for the next commission, not for repairs.

With this course's quiz passed and a construction-documented tech pack from the practical, your jacket knowledge stands on the full stack: draft, sleeve, canvas, iron.`,
      checkpoints: [
        {
          q: "Copeland's order of the iron is…",
          options: [
            "moisture, then heat, then pressure — none in excess",
            "maximum heat, then steam",
            "pressure first to set the cloth",
          ],
          answer: 0,
        },
        {
          q: "Shine on a dark worsted comes from…",
          options: [
            "pressing dry face-to-iron — glazing the fibers",
            "too much moisture",
            "cheap thread",
          ],
          answer: 0,
        },
      ],
    },
  ],
  quizDraw: 10,
  passPercent: 80,
  quiz: [
    { id: "t3q01", q: "'Scye' means…", options: ["the armhole", "the lapel", "the back seam"], answer: 0 },
    { id: "t3q02", q: "A deep, generous armhole…", options: ["moves better with the arm", "drags the whole coat when the arm lifts", "is required for canvas"], answer: 1 },
    { id: "t3q03", q: "The 'gorge' is…", options: ["the seam where collar meets lapel", "the waist dart", "the sleeve's under-side"], answer: 0 },
    { id: "t3q04", q: "A coat sleeve's head is cut…", options: ["exactly the scye length", "longer than the scye, the surplus fulled in as crown ease", "shorter than the scye for tension"], answer: 1 },
    { id: "t3q05", q: "Sleeve pitch corrects for…", options: ["the arm's natural forward hang", "shoulder padding", "cuff buttons"], answer: 0 },
    { id: "t3q06", q: "The fix for a mis-pitched sleeve is…", options: ["pressing the drags out", "removing and re-setting the sleeve rotated", "taking in the under-side seam"], answer: 1 },
    { id: "t3q07", q: "The elbow bend of a two-piece sleeve is…", options: ["drafted into the seams", "eased at the cuff", "pressed in after making"], answer: 0 },
    { id: "t3q08", q: "Pad stitching teaches canvas and cloth…", options: ["a curve they keep", "extra strength at the hem", "a permanent crease"], answer: 0 },
    { id: "t3q09", q: "A lapel that lies flat as paper was probably…", options: ["fused rather than padded", "cut on the bias", "over-pressed"], answer: 0 },
    { id: "t3q10", q: "Front and gorge edges are taped because…", options: ["bias-adjacent curves grow in wear otherwise", "tape is decorative", "the canvas requires it"], answer: 0 },
    { id: "t3q11", q: "Fused fronts' famous failure is…", options: ["delamination bubbling", "color fading", "shrinking hems"], answer: 0 },
    { id: "t3q12", q: "Pressing a curved region on a flat board…", options: ["presses the curve out of it", "sets the curve permanently", "is required for wool"], answer: 0 },
    { id: "t3q13", q: "Copeland's three jobs of the iron are…", options: ["setting, shaping, finishing", "steaming, drying, folding", "basting, felling, hemming"], answer: 0 },
    { id: "t3q14", q: "Before pressing a let-out seam's new line you must…", options: ["steam and work out the old crease ghost", "wash the garment", "trim the inlay away"], answer: 0 },
  ],
  practical: {
    kind: "construction_notes",
    title: "Specify a tailored interior",
    instructions:
      "On a tech pack for a tailored style, write construction notes for at least three areas that name real tailoring decisions — canvas or fusible fronts, padded/taped lapel and roll line, crown ease, pressing instructions. The school verifies the notes exist and name techniques.",
  },
};
