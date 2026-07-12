import type { Lesson, QuizQuestion } from "./types";

// Expansion lessons for S2 · Drafting and Draping — appended after the
// original four (progress is keyed by lesson index, so append-only).
export const S2_MORE_LESSONS: Lesson[] = [
  {
    title: "The square, the paper, and the discipline of the draft",
    minutes: 9,
    source: { label: "Picken, The Making of Drafts", url: "https://archive.org/details/patterdraftingpicken" },
    bodyMd: `Before Picken lets a student draw a single pattern line, she teaches the language the lines are written in — and it is worth learning, because every drafting book of the era (and every modern one) speaks it.

**The lines.** A draft uses five kinds of line, each with a job. The **light full line** is a construction or foundation line — scaffolding, not garment. The **heavy full line** is the pattern line itself: what you will eventually cut. The **dotted line** shows new design lines laid over a foundation; the **heavy dash line** connects points, as along the bottom of a skirt; and the **broken-and-dotted line** marks the center of a pattern. Read any period draft with this key and it stops being a spider's web and becomes a set of instructions. Lines are named by their end points — the line AC runs from point A to point C — and that plain convention is still how pattern books talk.

**The square.** The Picken square is an L of two arms — a long arm of 27 inches (68.5 cm) and a short arm of 12 inches (30.5 cm) — with straight outer edges and curved inner ones. Its trick is twofold. First, the arms carry ready-made scales of halves, thirds, fifths, sixths, sevenths, and eighths, so the drafter never sits doing fractions: one-sixth of a 13-inch neck is read straight off the scale of sixths. Second, the inner curves are not decorative — Picken says they were settled by making more than five thousand drafts for figures of every shape, so that a curve laid between two drafted points blends into a line the human body actually has. The long arm even carries separate front and back sleeve curves. You may never hold a Picken square, but every French curve and hip curve in a modern studio is the same idea: stored knowledge of the body, cast in a tool.

![Diagrams showing a drafting square and curve laid on a bodice pattern draft](/school/drafting-and-draping/lesson1-drafting-with-the-square.jpg)
*Mary Brooks Picken, Pattern Drafting (c. 1920) — the square and curve in position on a draft: the tool doing the geometry.*

**The workshop.** Her material advice is charmingly practical and still sound. A big smooth surface — she recommends a lightweight compo board of 4 by 8 feet (1.2 by 2.4 m), big enough to lay out a whole dress length. Plain wrapping paper for practice drafts; a good medium-weight paper 32 to 36 inches (81 to 91 cm) wide for real ones. A moderately soft lead pencil — never ink or crayon, which slow you down and blur your points. For arcs, a string tied into a notch cut near a pencil's point, a pin at the center, and a steady swing.

**The discipline.** Two of her rules deserve to be framed. First: expect the first draft to take 3 or 4 hours, and expect the fiftieth to take 5 or 10 minutes — the system is a skill, and speed is the reward of repetition, not a requirement of the start. Second: **test every draft against the measurements that made it before any cloth is cut**. Measure the back length on the draft; measure the bust line; walk the tape (held on edge, for curves) around the neck. If a draft fails a test, she tells the student not merely to fix it but to draft it again fresh, so the mistake cannot become a habit. She also published a table of the averaged measurements of five hundred women — not to replace the client's measures, but as a sanity check: a set of measures wildly out of proportion with the table usually means the tape slipped, not that the body is strange.

> **Term note:** *draft* in these books means the full-size drawing of a pattern constructed from measurements — as distinct from a *drape*, which is modeled in cloth, and a *commercial pattern*, which is bought. All three roads end at the same place: a tested paper pattern.

Nothing in this lesson touches cloth, and that is the point. Drafting is drawing with rules, and the rules are cheap: a square, paper, a soft pencil, and the patience to test.`,
    checkpoints: [
      {
        q: "On a period draft, the heavy full line represents…",
        options: [
          "the pattern line itself — what will be cut",
          "scaffolding to be erased",
          "the center of the pattern",
        ],
        answer: 0,
      },
      {
        q: "The curves on the Picken square were settled by…",
        options: [
          "making more than five thousand drafts for figures of every shape",
          "copying an architect's French curve",
          "pure geometry with no bodies involved",
        ],
        answer: 0,
      },
      {
        q: "Before any cloth is cut, a finished draft must be…",
        options: [
          "tested against the measurements that made it",
          "photographed for the record",
          "traced in ink",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "The shirt-waist draft, step by step",
    minutes: 11,
    source: { label: "Fales, ch. V Drafting and Pattern-Making", url: "https://archive.org/details/dressmaking00fale" },
    bodyMd: `Fales built her Columbia textbook around one promise: a drafting system with **few measures, no expensive charts, and a reason for every direction**. All the tools required are a square, a tape measure, drafting paper, a soft pencil, and a good eraser. Her shirt-waist — the era's blouse, and usually the first garment a student ever made — is the system's first problem, and walking her actual draft teaches you how all flat drafting thinks.

**The regulation measures.** Beginners draft first to a standard set, so mistakes belong to the hand and not the figure: length of back 15 inches (38 cm), length of front 15 1/2 inches (39.5 cm), bust 38 inches (96.5 cm), waist 26 inches (66 cm), neck 13 1/2 inches (34.5 cm), width of back 14 inches (35.5 cm), width of chest 14 1/2 inches (37 cm). Notice the front is drafted half an inch (1.3 cm) longer than the back before anything else happens — the length that walks over the bust, exactly as in your block lesson.

**The back, in one breath.** Two lines at right angles in the corner of the paper. Down the vertical, the back length AB; a horizontal at B is the waist line. The bust line sits a fixed fraction of the way up; the width-of-back line above that. The neck curve is set out as a fraction of the neck measure and lifted a scant amount to curve; the center back slants in 1 inch (2.5 cm) at the waist, giving the back its gentle shaping; the shoulder is hung on half the width of back; the underarm seam is placed from quarter-bust and quarter-waist points; and the **armseye** — the era's word for the armhole — is drawn as one good curve through three known points. A **basque** extension of 4 inches (10 cm) below the waist finishes the bottom. The front repeats the logic, longer, with its own neck curve and with the shoulder line drafted a shade shorter than the back's — so that in sewing, the back shoulder eases on and cups the shoulder blade.

**Then she makes you prove it.** This is the heart of Fales. The finished draft is tested, line by line, against the measures: the back length exact; the underarm equal to its measure plus its small allowance; and — the telling one — the back bust line plus the front bust width must equal **half the whole bust measure plus 1 inch (2.5 cm)**. That inch, doubled at the fold, is the shirt-waist's built-in **ease**: about 2 inches (5 cm) of breathing room at the bust, written into the arithmetic where you can audit it. If any test fails badly, she says plainly: you made a drafting error — redraft before you touch cloth.

**From draft to cloth pattern.** Fales prefers a paper pattern cut exactly on the drafted lines, with no seam allowances added — allowances complicate every later use of the pattern for designing (add them in the cutting instead: about an inch, 2.5 cm, at shoulder and underarm, a small fixed amount at neck and armseye). Trace the waist line and the shoulder cross-marks with the wheel. On the material: **center front on the lengthwise straight grain, center back on a lengthwise fold**, with an extra inch at each center front so the trial waist can be pinned closed. And cut the **complete** waist — both halves. Half a garment, she warns, never gives a trustworthy fitting, because no body is symmetric and no pinning on half tells the truth about the whole.

![Geometric bodice drafting diagram with lettered construction lines](/school/drafting-and-draping/lesson1-shirt-waist-draft.jpg)
*Jane Fales, Dressmaking (1917) — the shirt-waist draft this lesson walks: every line lettered, every length testable.*

> **Term note:** a *regulation* measure is a standard practice measure, not a claim about real bodies; Fales drafts to regulation first and to the individual second, the way a music student plays scales before repertoire.

Drafted, tested, cut whole, traced, and basted — the shirt-waist then goes to a fitting, where the previous lesson's fault-reading takes over. The draft gives you a garment that is right by arithmetic; the fitting makes it right in the mirror.`,
    checkpoints: [
      {
        q: "Fales's bust test — back bust line plus front width = half bust plus 1 inch — exists because…",
        options: [
          "the extra inch per half is the waist's built-in ease, auditable on paper",
          "tape measures of the era ran short",
          "seam allowances were included in the draft",
        ],
        answer: 0,
      },
      {
        q: "For the trial fitting, Fales insists on cutting…",
        options: [
          "the complete waist — half a garment never gives a trustworthy fitting",
          "half the waist, to save muslin",
          "only the back",
        ],
        answer: 0,
      },
      {
        q: "On the material, the center back of the shirt-waist is placed…",
        options: [
          "on a lengthwise fold, with center front on the lengthwise straight",
          "on the bias for flexibility",
          "anywhere the pieces fit most economically",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Drafting sleeves, collars, and cuffs",
    minutes: 10,
    source: { label: "Picken, sleeve and collar drafts", url: "https://archive.org/details/patterdraftingpicken" },
    bodyMd: `A sleeve is drafted from just three measures — Picken's model uses an **armhole of 15 inches (38 cm), an inside length of 17 inches (43 cm), and a hand measure of 8 inches (20 cm)** — and the whole art is in how the top curve spends the first of them.

**The one-piece foundation sleeve.** The draft is made on paper folded lengthwise, so the sleeve comes out symmetrical and whole. From a corner point the width is set from half the armhole measure; a point one-third of the armhole along the fold fixes the slope; and the cap is drawn through a midpoint raised by an eighth of the diagonal — the square's own front and back sleeve curves swinging the lines. At the wrist, half the hand measure plus a half inch (1.3 cm) gives a bottom the hand can actually pass through. Cut through both thicknesses along the seam lines, open the paper, and the sleeve is one piece.

**The space that rules the cap.** Picken singles out one distance — from the fold to the top of the cap — as the sleeve's steering wheel: it regulates how much length the armhole takes up. A blouse drafted with long shoulders needs this space *shorter*; a puffed sleeve needs it *greater*. Short, narrow shoulders demand a longer, narrower cap. When you alter any sleeve, this region above the widest line is where the fit lives.

**Fulness is deliberate.** A sleeve cut from these drafts measures about 2 1/4 to 2 3/4 inches (5.5 to 7 cm) more around than the armhole it enters, and that surplus is *eased in*, not an error: sleeve and bodice are cut on different grains, and the tip of the shoulder is a curve that must be traveled. If a perfectly plain, smooth armhole is wanted, she gives the correction — start the width from half the armhole minus an inch or more, and push the one-third point out a fraction — leaving only 1 1/2 to 2 inches (4 to 5 cm) to ease, which vanishes into the seam. And for a tight-fitting sleeve, the standing remedy: take the surplus out with a **dart** at the back of the arm, run from the wrist to a point 2 inches (5 cm) below the elbow, where the arm's own bend wants shaping anyway.

**The shirtwaist sleeve** is the same draft with a working wrist. The bottom line moves up by the width of the cuff — a roughly 2 1/2 inch (6.5 cm) cuff shortens the sleeve body by exactly that much — and the wrist is drafted a good inch (2.5 cm) or more wider than the plain sleeve, the surplus gathered into the cuff. A short slash drafted up from the bottom edge becomes the **placket**, the finished opening that lets the hand through before the cuff buttons.

**Collar and cuff: geometry you can memorize.** Both are drafted on folded paper as simple parallelograms, and Picken points out the lovely part: the three set-out points along the fold — 1 inch (2.5 cm) in from the edge, then 3 1/2 inches (9 cm), then 1 inch more for the collar — **hold true regardless of the size**. Only one line changes with the wearer: the collar's depth line is half the neck measure (6 1/2 inches, 16.5 cm, for a 13-inch neck), and the cuff's is half the hand measure plus a half inch. Everything personal about a collar lives in a single measurement; the rest is a recipe. The neck edge then gets its curve from the square's long-arm curve, so the band sits to the neck instead of standing off it.

> **Term note:** *inside length* is the sleeve measured from armpit to wrist along the inner arm — not the outer shoulder-to-wrist length — which is why the cap height is added above it rather than contained in it.

Draft the foundation sleeve once to the model measures, prove it against the tape, and you own every sleeve in this course: the puff, the shirtwaist, the tight sleeve with its elbow dart are all this draft with one region redrawn.`,
    checkpoints: [
      {
        q: "A drafted sleeve measures 2 1/4 to 2 3/4 inches more than its armhole because…",
        options: [
          "the surplus is eased in — different grains and the shoulder's curve demand it",
          "period machines stretched the cloth",
          "the drafts contain an error Picken never fixed",
        ],
        answer: 0,
      },
      {
        q: "A tight-fitting sleeve takes out its surplus with…",
        options: [
          "a dart at the back, from the wrist to about 2 inches below the elbow",
          "a wider cuff",
          "gathering at the cap only",
        ],
        answer: 0,
      },
      {
        q: "In the collar draft, the one line that changes with the wearer is…",
        options: [
          "the depth line of half the neck measure — the set-out points are fixed",
          "every point, recalculated each time",
          "the 1-inch margin from the paper's edge",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Drafting the foundation skirt",
    minutes: 11,
    source: { label: "Fales, ch. V skirt draft", url: "https://archive.org/details/dressmaking00fale" },
    bodyMd: `A skirt draft answers a different question than a bodice draft. The bodice asks: how do I wrap this shape? The skirt asks: **how do I hang this much cloth from that waist and hip so the hem floats level?** Fales's foundation skirt is built from two governing numbers — the hip measure and the width you want at the bottom — and everything else follows.

**The measures.** Waist 26 inches (66 cm). Then *two* hip measures, and this doubling is her signature care: the first at 6 inches (15 cm) below the waist — 38 inches (96.5 cm) on the regulation figure — and the second at 10 inches (25 cm) down, 43 inches (109 cm), always 4 to 6 inches (10 to 15 cm) larger than the first. One hip number describes a circumference; two describe a *shape*. Finally three lengths: front 40 inches (102 cm), side 41, back 41 — measured separately because the body spends length unevenly around the waist.

**The width at the bottom is a fashion decision with a floor under it.** A narrow skirt should be a little more than 1 1/2 times the hip measure around the hem; as fashion widens, 1 3/4, 2, 2 1/2, up to 3 times the hip. Less than that and the wearer cannot walk. And here is a wonderfully honest trick: for any skirt under two yards (183 cm) around the bottom, **add 2 inches (5 cm) to the full hip measure before drafting**, and take the surplus out later with darts or gores in the fitting. A narrow skirt has no spare width to lend the hip, so the draft lends it up front.

**The draft in outline.** A tall rectangle is set out from half the first hip measure and the skirt length; the waist line is drawn as a curve whose character depends on the width below — for a narrow skirt the waist curve is long and shallow, and as the hem widens the curve grows **shorter and deeper**, tilting each panel so the extra hem width swings in flare from the waist. The hip line is drawn next, and Fales is explicit about a subtlety: the hip line does *not* parallel the waist line — it parallels **the bottom of the skirt**, and the hem line is drawn parallel to it by measuring equal distances down. The center back line must pass through the drafted hip point even if it misses the waist corner; the waist can be corrected later, the hip cannot.

**All adjustment lives above the hip line.** Below the hip, front, side, and back lengths are drafted identical; every difference between the three length measures is spent between waist and hip. Her sentence is worth memorizing: *it is above the hip line that the contour of the normal figure varies.* This is why the hem-leveling rule from your fitting lesson works — a hem that dips was mis-spent at the waist, never at the bottom.

**Testing.** As always she audits the finished draft: at the 6-inch hip line, a straight skirt should measure the hip plus the borrowed 2 inches, a full skirt the true hip; at 10 inches down, never less than the required size; the three full lengths must match their measures, and must be *identical* below the hip line.

**Then the waist is fitted with darts.** Subtract half the true waist measure from the waist of the draft; the difference comes out in **darts** running from the waist toward (never past) the 6-inch hip line. Several small darts beat one large one, and the largest — deepest and longest — always goes **over the hip**, where the figure curves most; smaller ones sit at side front and side back. A waist small in proportion to its hip needs longer, deeper darts; a thick waist may need almost none.

> **Term note:** *foundation skirt* means this dartless, seamless master shape — the skirt's equivalent of the bodice block. Gores, panels, and every skirt style in the next lesson are cut from it, which is why Fales has you test it so hard.`,
    checkpoints: [
      {
        q: "For a skirt under two yards around the hem, Fales adds 2 inches to the hip measure because…",
        options: [
          "a narrow skirt has no spare width, so the draft lends ease that darts remove later",
          "period tapes measured short",
          "seam allowances were forgotten otherwise",
        ],
        answer: 0,
      },
      {
        q: "As a skirt grows wider at the bottom, its waist curve becomes…",
        options: [
          "shorter and deeper, swinging the extra width into flare",
          "longer and shallower",
          "perfectly straight",
        ],
        answer: 0,
      },
      {
        q: "The largest waist dart in a skirt always goes…",
        options: [
          "over the hip, where the figure curves most",
          "at center front",
          "wherever the placket falls",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Gores: cutting the skirt into good lines",
    minutes: 10,
    source: { label: "Fales, gore divisions and skirt designs", url: "https://archive.org/details/dressmaking00fale" },
    bodyMd: `A **gore** is a skirt panel that is narrower at the top than at the bottom — the device that lets a skirt fit the hip and still flare at the hem, spending the difference gradually down a seam instead of suddenly in a dart. Fales turns the foundation skirt into gored skirts with a method so orderly you can carry it in your head.

**The procedure.** Divisions are marked twice — once on the hip line, once at the bottom — and the marks are connected with lines carried up to the waist, where the leftover fulness comes out in darts along the new seams. The proportions breathe with fashion, but the rule of thumb holds: a gore's width at the bottom runs from about one and a quarter to one and a half times its width at the hip, and the wider the whole skirt, the more generous the ratio.

**The family of divisions.** The *four-gore* skirt has a front panel, a back panel, and one wide side gore on each half with a **dart** over the hip. The *six-gore* is the four-gore with that hip dart simply extended all the way down into a seam — the dart tells you exactly where the seam wants to be, a perfect miniature of the dart-into-seam logic from your bodice lessons. The *five-gore* trades the front panel for a center-front seam — homely but practical, since (as she notes) a front seam suits wash skirts and gives the **placket** and its finish a natural home. The *seven-gore* hangs a front panel and three side gores per side, sized so the two side-front gores match and the back gore runs smaller, keeping the figure narrow at the back. Wherever the darts fall, the deep ones go on the seams nearest the hip, the shallowest near the front, a medium amount at the back — the darts map the body's curves.

**Truing the seams.** Once darts and gore lines are drawn, the gore edges are unequal little curves, and Fales trues them with a compass move worth stealing: with the dart's meeting point on the hip line as a pivot, and the distance up the original dividing line to the waist as a radius, **swing an arc across both sides of the dart** — where the arc cuts them is the corrected length of each edge. Then cut the gores apart, and before anything else *number each gore and notch its matching edges*: once separated, a stack of gores is anonymous, and — her dry warning — the grain of the *paper* is no guide to which edge was straight and which bias.

**Grain and design.** In cutting, the lengthwise straight of the material falls at the center front, at the front edge of each gore below the hip line, and down the middle of a back panel — so every seam pairs a straight edge against a **bias** one, the straight edge holding the line while the bias eases to the body. On this skeleton she builds the simple designs: tucks laid at the back edges of gores; a panel front outlined in stitching; gathers or fine tucks in place of the hip dart, the tucks tapering to nothing near the hip line so they do not bulge over the curve. And one seam is left alone: the hip seam itself takes no tuck and no trim, because decoration will not lie flat over the roundest part of the figure.

Her cleverest cutting detail: when a tuck is wanted at a gore seam, the tuck's material is **added half to each adjoining gore edge** — equal strips on the back edge of one gore and the front edge of the next — so the gores keep their drafted sizes and the skirt its drafted sweep. Add the whole tuck to one gore and the skirt grows; steal it and the back gores shrink out of proportion.

> **Term note:** to *true up* a pattern is to correct its lines after any change — matching seam lengths, smoothing curves, restoring right angles at hem and waist. Every dart moved, gore cut, or tuck added earns a truing before cloth is cut.

Gores are where drafting becomes design: the same foundation, divided with taste, is a different skirt every time.`,
    checkpoints: [
      {
        q: "A six-gore skirt is made from the four-gore by…",
        options: [
          "extending the hip dart down into a seam — the dart shows where the seam belongs",
          "adding two gores at the hem only",
          "cutting the front panel in half",
        ],
        answer: 0,
      },
      {
        q: "Gore edges around a dart are trued by…",
        options: [
          "swinging an arc from the dart's hip-line point to correct both edge lengths",
          "trimming both edges to the shorter one by eye",
          "steaming the paper flat",
        ],
        answer: 0,
      },
      {
        q: "Material for a tuck at a gore seam is added…",
        options: [
          "half to each adjoining gore edge, so gore sizes stay as drafted",
          "entirely to the front gore",
          "as a separate strip sewn on later",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Altering commercial patterns to the figure",
    minutes: 10,
    source: { label: "Fales, ch. VI The Use of Commercial Patterns", url: "https://archive.org/details/dressmaking00fale" },
    bodyMd: `Fales names three roads to a pattern: drafting it, modeling it on the form, and the road most sewers actually take — buying it. Her chapter on commercial patterns is a century old and reads like it was written for the pattern envelope on your table, because the geometry of altering a printed pattern to a real figure has not changed at all.

**Before scissors touch cloth.** Read the directions — she notes, tartly, that many patterns are discarded as useless merely because nobody read them. Then **test the pattern to the individual's measures and alter it on paper first**: an alteration discovered after cutting often cannot be made at all without wrecking the style. A waist pattern is bought by bust measure, but the bust is only one number — neck, armseye, widths, and lengths must each be checked, because they vary independently. And any pattern used for the first time gets cut in inexpensive material for a preliminary fitting; the printed average has never met this body. Two handling rules follow the pattern to the cloth: never cut the joining notches *into* the material — mark them with a thread or tracing, because a slip of the scissors at a notch is a wound the seam allowance cannot spare — and treat the straight-of-material perforations as law, since nothing cut off grain can be made to hang right afterward.

**The golden rule of waist alterations.** Where a waist is too large or too small in the bust, the change is made by a tuck or a slash **from the middle of the shoulder down to the bottom of the waist** — fold out a lengthwise tuck to shrink it, slash and spread a strip of paper in to grow it. What you must *never* do is add or subtract at the center front or center back: that rewrites the neck curve, and the trouble it causes, she says plainly, is one that fitting cannot remove. The neck itself, if too large, is raised into a smaller curve — better a touch too small than too large, since a neck is easily cut out in fitting but cannot be put back. An armseye too large is lifted at the underarm, adding more to the front than the back.

**Reading shoulders.** Patterns are cut for the average slope, and the two failures announce themselves exactly as drags did in your fitting lesson. **Square shoulders**: a wrinkle straight across front and back from shoulder to shoulder. The tempting fix — letting out the shoulder seam at the armseye end — is wrong, because it enlarges the armseye; instead, take the seam *up at the neck end* and then cut the neck out to size. **Sloping shoulders**: the wrinkle slants from the neck down toward the armseye; take the seam up at the shoulder point and free the armseye near the underarm. Same diagnosis discipline as ever: the wrinkle points at the cause.

**Sleeves and the fitted lining.** A shirt-waist sleeve alters by the lengthwise line: lay a **plait** or tuck the full length of the upper sleeve to remove fulness, or slash the same line and spread to add it — then re-true the cap's curve, which the alteration has broken. Length changes go in above or below the elbow, matching where the arm itself is long. The tight-fitting waist pattern — seven pieces, counting both sleeve pieces — admits four alterations beyond the shirt-waist's: the size at the waist line, the length of the waist, the size of the bust, and the length of the back, that last one for round shoulders or a short straight back.

> **Term note:** commercial patterns of Fales's day, unlike her drafts, came *with* seam allowances included — one reason she has you trace the actual seam lines before cutting, so the fitting is pinned on truth rather than on allowance.

The deeper lesson: a bought pattern is somebody else's draft to somebody else's average. Testing, altering on paper, and a muslin first fitting are how you make it yours — the same three habits, in the same order, as with a draft of your own.`,
    checkpoints: [
      {
        q: "A waist too small in the bust is enlarged by…",
        options: [
          "slashing from mid-shoulder to the bottom of the waist and spreading — never at center front or back",
          "adding at the center front",
          "letting out the neck curve",
        ],
        answer: 0,
      },
      {
        q: "The wrinkle of square shoulders — straight across from shoulder to shoulder — is fixed by…",
        options: [
          "taking up the shoulder seam at the neck end, then cutting out the neck",
          "letting out the shoulder seam at the armseye end",
          "shortening the sleeve cap",
        ],
        answer: 0,
      },
      {
        q: "Pattern notches should be…",
        options: [
          "marked with thread or tracing — never cut into the material",
          "cut generously so they are easy to find",
          "ignored entirely",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Draping with straight lengths",
    minutes: 10,
    source: { label: "WI Draping, Draping With Straight Lengths", url: "https://archive.org/details/draping-and-designing-with-scissors-and-cloth" },
    bodyMd: `The Institute's boldest chapters teach garments made from **straight, uncut lengths of cloth, shaped entirely on the body** — no pattern, almost no seams, the scissors arriving late and cutting little. They are the purest demonstration of the draping creed from your earlier lesson: grain first, pins second, scissors last.

**The negligee in dolman effect.** A soft house-gown from 40-inch (102 cm) silk crepe, and the first surprise is the grain: the **crosswise grain runs down the figure** — the fabric's width becomes the garment's length. Since 40 inches rarely reaches the floor, a plain harmonizing band is added at the hem, doing double duty as length and as trim, with matching bands on the sleeves to balance it. Fashion's constraint becomes the design.

The draping: place a crosswise edge at the center front, **selvage** reaching the shoulder line, and pin it securely down the front. Carry the cloth around the figure and set one pin at the hip, exactly where an underarm seam would fall — this garment has none, but the body's landmarks still steer. Now the era's most elegant move: **follow a single thread** from that pin up to the selvage, and from that point slash down about 15 inches (38 cm) — never below the natural waist — and the armhole exists. No curve was drawn; a drawn thread guaranteed the slash is truly on grain. Carry the cloth to the back, pin the shoulder in a line slanting down from neck to arm, and mind her caution: the back must hang so the grain is plumb at every point, close but never baggy — a drape pulled tight lies about how it will hang.

The bloused back and sleeves come from a second straight piece, cut wrist-to-wrist (arms outstretched) minus 8 inches (20 cm), its lengthwise threads running *across* the figure. Its center is pinned at the back neck, its ends carried over the arms to the front. When the back neckline is trimmed, cut one half only — **then use the piece you removed as the template for the other half**, symmetry borrowed from the scrap. Finishing is a lesson in respecting a drape's softness: bind the front edges in contrasting **bias**, hem the sleeve edges narrow, and stay the back of the neck by stitching a narrow tape into the seam, so the one point carrying real weight cannot stretch.

**The drop-shoulder dress.** Two straight lengths of 40-inch cloth, one for front and one for back. A foundation belt is tied at the waist, closing at the left underarm — the anchor every drape hangs from. The front length is folded lengthwise and placed with the folded edge a quarter to a half inch (6 to 13 mm) *beyond* the center front: deliberate insurance, so if the cloth shifts during draping the dress errs large, and cloth can be taken away where it can never be put back. The hem is cut along a drawn thread; then an 8-inch (20 cm) slash at the waist line lets the straight width break over the hip. And one rule in capitals: **never cut both thicknesses at once** — the under layer drifts off the line of the upper, and the two sides of the dress come out unlike.

![Figures draping straight cloth lengths and shaping darts on a standing figure](/school/drafting-and-draping/lesson2-shaping-straight-lengths.jpg)
*Woman's Institute, Draping and Designing with Scissors and Cloth (1924) — straight lengths shaped on the body: the pin and the drawn thread doing the work of a pattern.*

> **Term note:** the *selvage* is the woven, self-finished edge running the length of the cloth — always exactly on the lengthwise grain, which is why drapers pin from it and measure to it: it is the one edge that cannot lie.

What these projects teach is economy of decision. A drafted garment makes a hundred choices on paper; a straight-length drape makes six on the body — where the grain falls, where the pins anchor, where the thread is drawn, where the slash stops, what the band adds, what the scissors finally remove. Learn to make those six well and cloth starts answering you directly.`,
    checkpoints: [
      {
        q: "The dolman negligee's armhole is made by…",
        options: [
          "following a drawn thread from the hip pin and slashing about 15 inches, never below the waist",
          "cutting a drafted curve transferred from paper",
          "leaving the selvage unsewn",
        ],
        answer: 0,
      },
      {
        q: "The folded edge is placed slightly beyond the center front so that…",
        options: [
          "if the cloth shifts, the dress errs large — cloth can be taken away but not put back",
          "the closure has an overlap for buttons",
          "the fold is easier to press out later",
        ],
        answer: 0,
      },
      {
        q: "When trimming a draped neckline, the Institute cuts…",
        options: [
          "one half first, then uses the removed piece as a guide for the other half",
          "both thicknesses at once to guarantee symmetry",
          "by eye, both sides freehand",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Draping collars: rolled, flat, shawl, and bertha",
    minutes: 10,
    source: { label: "WI Draping, collar drapes", url: "https://archive.org/details/draping-and-designing-with-scissors-and-cloth" },
    bodyMd: `The Institute closes its draping course at the neck, with a chapter built on a claim any client will confirm: **the neck line and the collar can make or mar a dress**. Collar fashions churn season to season, but the same few types recur forever, and the method of draping each never changes.

**The neckline is chosen for the face.** A round, full face is only emphasized by a round neckline; a V detracts from the roundness and lengthens the whole figure. Long, pointed features want the opposite — a round or U-shaped line — though if the features are decidedly long, the softly rounded U beats the full circle, correcting without contrast. The line is determined *on the person*, then transferred: dress on the form, and the chosen neck edge marked just inside with tailors' chalk or a row of pins, straightened until true. (If the form's neck or shoulder slope differs much from the wearer's, drape the collar on the wearer — a collar tolerates no approximation.)

**Rolled collars** stand and hug the back of the neck, and their secret is not in the collar: **the dress's own neck line must be cut and fitted high enough at the back to hold the roll up**. On crepe, voile, or anything that stretches, run a stay-thread across the back neck first; a stretched neckline can never be fitted snugly again. Then take **muslin** the depth of the collar, torn off about 16 inches (40 cm), set its selvage at the center back, pin one edge smoothly around the neck, and fold the other edge down over it. Where the front lands — pinned to a turned-back lapel, run parallel to the center front, or brought down 3, 4, or 10 inches (7.5, 10, 25 cm) — decides which of the classic rolled styles you have drawn.

**Flat collars** — the Peter Pan family — lie on the shoulders without rolling, and hide a geometric trap: a flat collar's neck edge must match the dress's neck edge *exactly*, yet its outer edge must travel a longer path over the shoulders. The Institute's solution is one fold: turn back about 2 inches (5 cm) of the muslin at the selvage **on a diagonal line tapering to nothing**, and pin that fold at the center back. The diagonal fold quietly supplies the extra width the outer edge needs — a dart's worth of shaping, borrowed before any cutting. Smooth over the shoulder, mark the neck base and the outline, notch the neck seam, and when cutting the real collar lay that bias folded edge along a straight fold of the cloth.

**Shawl collars** roll continuously from high at the back neck down to nothing at the front closure — the youthful bertha-like version and the tailored roll that the booklet recommends as slenderizing. Take a 10-inch (25 cm) length of muslin, turn back about 3 inches (7.5 cm) on the same tapering diagonal, pin at the marked back neck — and then comes the discipline: **cut on the curve only 1 1/2 to 2 inches (4 to 5 cm) at a time, clipping upward and smoothing after each cut**, working forward and down toward the waist. A shawl collar carved in one confident stroke is a shawl collar ruined; the curve is discovered, not declared. Keep the roll high at the center back and let it die gradually to flat at the front.

**Bertha, or cape, collars** — deep, sheer, spilling over the shoulders — drape from a 12 to 15 inch (30 to 38 cm) length with the same diagonal fold, a little fulness laid in at the top of the shoulder to be shirred into the binding later. Flimsy muslin drapes these best, because the real collar will be lace, Georgette, or chiffon, and a stiff toile lies about a soft cloth. High, close collars are fitted on the person, never the form — at the neck, the smallest discrepancy shows.

> **Term note:** *muslin* here is the cheap plain cotton used for trial draping (the British say *calico*; the trial garment itself is a *toile*). The pattern you keep is the muslin, marked and trued — the collar is cut from it in the real cloth.

A collar is small enough to drape in an evening and prominent enough to justify the care. Of everything in this course, it is the fastest route from draping practice to a visible difference in a finished dress.`,
    checkpoints: [
      {
        q: "Before a rolled collar can fit snugly, the dress itself must…",
        options: [
          "have its neck line cut and fitted high enough at the back — stayed if the fabric stretches",
          "be finished with a facing",
          "be cut on the bias at the neck",
        ],
        answer: 0,
      },
      {
        q: "The diagonal turned-back fold at a flat collar's center back exists to…",
        options: [
          "supply the extra width the outer edge needs while the neck edge stays exact",
          "mark the center back for cutting",
          "stiffen the collar",
        ],
        answer: 0,
      },
      {
        q: "A shawl collar's curve is cut…",
        options: [
          "1 1/2 to 2 inches at a time, clipping and smoothing between cuts",
          "in one confident stroke",
          "with pinking shears for stretch",
        ],
        answer: 0,
      },
    ],
  },
];

export const S2_MORE_QUIZ: QuizQuestion[] = [
  { id: "s2q15", q: "On a draft, light full lines are…", options: ["construction and foundation lines — scaffolding, not garment", "the lines to cut", "decoration"], answer: 0 },
  { id: "s2q16", q: "Fales tests the shirt-waist draft's bust by checking that back plus front width equals…", options: ["half the bust measure plus 1 inch — the built-in ease, auditable on paper", "the exact bust measure", "the waist measure plus 4 inches"], answer: 0 },
  { id: "s2q17", q: "A drafted sleeve is larger than its armhole because…", options: ["the surplus is deliberately eased in — grain and the shoulder's curve require it", "drafts always err large", "cuffs take up the difference"], answer: 0 },
  { id: "s2q18", q: "In a skirt draft, all differences between front, side, and back lengths are adjusted…", options: ["above the hip line — below it all lengths are identical and the hip line parallels the hem", "at the hem", "evenly along the whole length"], answer: 0 },
  { id: "s2q19", q: "A commercial waist pattern too large or small in the bust is altered…", options: ["by a tuck or slash from mid-shoulder to the bottom of the waist — never at center front or back", "at the center front seam", "by changing the neck curve"], answer: 0 },
  { id: "s2q20", q: "A flat draped collar gets the extra width its outer edge needs from…", options: ["a diagonal turn-back fold at the center back, tapering to nothing", "stretching the neck edge", "a deeper seam allowance"], answer: 0 },
];
