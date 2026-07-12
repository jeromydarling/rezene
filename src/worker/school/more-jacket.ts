import type { Lesson, QuizQuestion } from "./types";

// Expansion lessons for T3 · The Jacket and Coat — appended after the
// original four (progress is keyed by lesson index, so append-only).
export const T3_MORE_LESSONS: Lesson[] = [
  {
    title: "Taking the order: the measures that carry the fit",
    minutes: 10,
    source: { label: "Vincent, taking the order and measures", url: "https://archive.org/details/cutters-prac-guide-jacket-cutting" },
    bodyMd: `Vincent does not open his jacket volume with a draft. He opens it with a conversation: put a series of fashion plates in front of the customer, settle the style, the pockets, the small details, and *write everything in the measure book* before a tape comes out. The order is half the garment; the measures are the other half — and the CPG takes more of them than most systems, because it wants the body to dictate the draft rather than a table of averages.

The sequence is fixed: **chest, waist, hips** first (the girths), then **across chest**, **depth of scye**, natural waist length, full length, **width of back**, sleeve to elbow and cuff, and finally the two measures Vincent calls almost peculiar to his system — the **front shoulder** and the **over shoulder**.

The chest is taken close up under the armpits, and here Vincent gives the best single line in the book. As you pass the tape, ask: *"Do you like a close or an easy fit, sir?"* The question does two jobs at once — the customer answers, which tells you his taste, and in answering he exhausts his lungs, which gives you an honest chest. The waist follows at the natural waist, the hips some 7 or 8 inches (18–20 cm) below it, all three with the same degree of ease so they stay comparable.

The **across chest** is taken from front of scye to front of scye, about 3 inches (7.5 cm) above the bottom of the armhole. The **depth of scye** needs a landmark: pass the tape over both shoulders saddle-fashion and back under the arm, pinning where it sits level with the bottom of the scye — or stand a square under the arm and mark across to the back seam. From the nape you then run depth of scye, natural waist, and full length in one continuous measure.

The **width of back** is taken with the arm hanging at the side — Vincent warns that this measure is nearly always taken too wide. For the sleeve the customer raises his arm to a right angle and brings the hand to the centre of his chest; measure over the bent elbow to the wrist bone.

Then the shoulder pair. The **front shoulder** runs from the nape round to the bottom of the scye in front, taken rather closely; the **over shoulder** goes from the bottom of the scye behind, up over the shoulder, and down to scye level in front. These two are the system's secret. Taken accurately, they make the draft self-correcting: stooping and erect figures, square and sloping shoulders, long and short necks, forward or backward scyes all register in the measures themselves, and the draft absorbs them without a single special rule. Vincent is explicit — the only places left to judgment are the **suppression** of the waist (how much you take in) and the balance of the sleeve.

What if you cannot measure the customer — a mail-order form with only the ordinary measures? The book provides **proportions of the breast measure** to fill the gaps: across breast is one-quarter breast less 1 inch (2.5 cm); scye depth about one-quarter breast; front shoulder one-third breast plus a half inch; over shoulder half breast less about an inch; hips run 1 to 2 inches more than the chest. A printed scale of these sectional quantities, worked out from hundreds of real customers, sits beside the system for exactly this case.

One trap remains: people come to be measured in the coat they like best, and that coat may have built-up, wadded shoulders. Politely ask to measure under the coat when you suspect it — Vincent notes customers rarely mind — and whatever slips past the tape, *leave to the try-on*: the basted fitting is where padding, posture and wishful measuring are found out with chalk, before cloth is cut past recall.

> **Term note:** the *nape* is the bone at the back of the neck where the collar seam sits — every length starts there. *Suppression* is the amount taken in at the waist. A *try-on* (or baste fitting) is the garment tacked together with long stitches so it can be marked and pulled apart.`,
    checkpoints: [
      {
        q: "Vincent's question 'Do you like a close or an easy fit, sir?' works because…",
        options: [
          "it flatters the customer into ordering more",
          "it reveals his taste and empties his lungs for an honest chest measure",
          "it distracts him while the tape is read",
        ],
        answer: 1,
      },
      {
        q: "The front shoulder and over shoulder measures matter because they…",
        options: [
          "make the draft self-correcting for shoulder shape and balance",
          "replace the chest measure entirely",
          "set the width of the lapel",
        ],
        answer: 0,
      },
      {
        q: "When you suspect built-up shoulders in the coat being measured over…",
        options: [
          "add an inch to every measure",
          "refuse the order",
          "measure under the coat if you can, and leave the rest to the try-on",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "The lounge draft, line by line",
    minutes: 12,
    source: { label: "Vincent, the lounge system", url: "https://archive.org/details/cutters-prac-guide-jacket-cutting" },
    bodyMd: `Now the measures go to work. Vincent's lounge system needs four tools — a square, an inch tape, crayon, and paper or cloth — and it builds the jacket in three moves: depths, widths, **sweeps**. Work it once on paper at quarter scale and the logic stays with you for life. The worked example is a 36 chest (91 cm): scye depth 9, natural waist 17, and the rest from the scale.

![Four-stage tailoring draft showing system lines and completed lounge jacket outline](/school/the-jacket-and-coat/lesson0-lounge-draft-system-lines.jpg)
*W.D.F. Vincent, The Cutter's Practical Guide: Jackets (1897), plate 3 — the same plate you met in the first lesson, now to be read line by line.*

**The depths.** Draw a construction line and mark from O: one-third of the scye depth (point 3); the full **depth of scye** at 9 inches (23 cm); the natural waist at 17 (43 cm); the full length plus seams at 28½ (72 cm). Square lines out at right angles from each. Everything hangs off these levels, and all but the first come straight off the customer's body.

**The widths.** The back neck comes out about one-twelfth of the breast; raise its end three-quarters of an inch (2 cm) and shape the back neck. On the line below point 3, mark the width of back plus a seam and curve the back scye down. On the scye-depth line, mark from the back seam the *half chest plus 2¾ inches (7 cm)* — that allowance is ease and making-up, the room the body and the seams will drink. Measuring back from that front edge by the **across chest** measure fixes the front of scye — the single most important point on the draft, because it positions the armhole on the body rather than by proportion.

**The sweeps.** Here is the CPG's signature. A *sweep* is an arc: pinch the tape at a pivot point, hold the crayon at a measured length, and swing it. First sweep — from the front of scye, by the front shoulder measure less what the back has already used (the nape-to-back-neck bit). Second sweep — from the breast-line point, by the same quantity *plus one inch* (2.5 cm). Where the two arcs cross is the **neck point** F. That added inch is not carelessness: it is length worked into the front that will later be drawn in and shrunk over the chest. Third sweep — from the front of scye again, by the **over shoulder** measure less the back's share: it fixes the **shoulder point** D. Notice what just happened: neck point and shoulder point were not placed by rule of thumb — they were *triangulated from the customer's own shoulder measures*.

**Completing the outline.** Draw the front shoulder seam a quarter inch (6 mm) shorter than the back shoulder seam — the difference is fulled on, as you learned in the making lessons. Shape the scye from D, touching about 1¼ inches (3 cm) above the scye-depth line in front, and keep it snug: the first law of the scye still rules. Draw the sideseam; hollow the forepart at the waist; let the hips overlap about an inch, or half the difference between chest and seat. Take out a **fish** of about an inch under the arm, dying out some 4 inches (10 cm) below the waist. Drop the bottom of the front half an inch (1.3 cm) below the bottom line, add a button stand of about 1¼ inches (3 cm), and shape the front and lapel to the style agreed at the order.

> **Term note:** a *fish* is a shaped dart, pointed at both ends like its namesake, that suppresses the waist inside a panel. A *sweep* is an arc drawn with the tape as a compass. The *button stand* is the width added beyond the centre line to carry buttons and holes.

The system, Vincent says, completes the jacket "as far as the normal figure is concerned" — and because the sweeps are driven by direct measures, most abnormal figures are already provided for before you consciously do anything about them. What the sweeps cannot do — waist, style, cloth — the later lessons take up.`,
    checkpoints: [
      {
        q: "The neck point in the CPG draft is found by…",
        options: [
          "the crossing of two sweeps taken from the front of scye and the breast line",
          "measuring one-sixth of the breast from the back seam",
          "copying it from a block pattern",
        ],
        answer: 0,
      },
      {
        q: "The extra inch added to the second sweep is…",
        options: [
          "a safety margin in case the tape slipped",
          "front length that will be drawn in and shrunk over the chest",
          "seam allowance for the gorge",
        ],
        answer: 1,
      },
      {
        q: "The front of scye is fixed by…",
        options: [
          "a proportion of the natural waist",
          "the width of the lapel",
          "measuring the across chest back from the front edge",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Studies in style: backs, fronts, and the reefer",
    minutes: 10,
    source: { label: "Vincent, studies in style and reefers", url: "https://archive.org/details/cutters-prac-guide-jacket-cutting" },
    bodyMd: `"Style," Vincent quotes, "is the clothes of the mind" — and his Studies in Style plates are a quiet manifesto: an enormous amount of a jacket's character can be varied *without touching the fit*, if you know which lines are structure and which are taste.

**Backs first.** The back neck may be wide or narrow, the shoulder seam high or low, the back wide or narrow at the waist, the back cut whole or with a seam. His gallery runs from the uniform back — neck cut wide, seam brought right on top of the shoulder, back scye and waist kept a narrow two inches — to the "old style" he shows purely as a warning: a 4-inch (10 cm) shoulder slope and a back waist over 7 inches (18 cm) wide. His own preference is the moderate middle: a slope of about 3 inches (7.5 cm), a whole back about 5 inches (12.5 cm) wide at the waist, or, for a **three-seamer**, a back waist of one-sixth breast so the sideseam sits well to the side and can be kept fairly straight. The key sentence: *any alteration in the back is compensated for in the forepart* — the system rebalances, so back style is genuinely free.

**Fronts.** The step roll for single-breasted coats buttoning at a moderate height; the low-rolling front that borrows dress-jacket character, gorge lowered, buttoning one; the square-cut front with a peaked lapel. And the rule that unlocks all of it: **everything outside the crease row is style only.** The lapel beyond the line where it folds can be stepped, peaked, rounded or squared without any effect on fit. Harmony is the only law — a peaked lapel wants a square front and square pocket flaps to match.

**The reefer** is the style lesson worked whole. For the double-breasted reefer, add about 2½ inches (6.5 cm) beyond the breast line for the **wrap** — up to 3 or 3½ for heavy cloth. Cut it straighter than a lounge: with no lapel seam to manipulate, less can be worked up in making, so add only a ¼ to ½ inch at the second sweep, taking out a small V in the pattern if the breast line will not come straight. Give it ease — quite 2½ inches over the half breast — because "its character demands a fair amount of ease." And place the buttons by the tidiest rule in the book: **as far behind the breast line as the eye of the hole is in front of it**, so the coat balances closed on its true centre.

**Pockets** carry proportion. On the lounge, the breast **welt** — about 5 by 1 inches (12.5 × 2.5 cm) — sits level with the bottom of the scye, its end kept fully an inch in front of the armhole "to leave a little latitude for advancing the scye." Hip pockets go about 4 inches (10 cm) below the waist line, midway between sideseam and breast line, with flaps about 6½ by 2¼ inches (16.5 × 5.5 cm); the little ticket pocket rides at waist level with a flap about 3½ by 1¾. Whatever the front's outline — rounded or square — *the flaps follow suit*.

**Edges** finish the argument. The cloth votes again: rough cheviots and Harris tweeds take a double row of stitching; smoother makes want a narrow single stitching; serges and vicunas look best with a single row right on the edge. An edge finish fighting its cloth looks wrong at ten paces even when the fit is faultless.

> **Term note:** a *three-seamer* has a centre-back seam plus two sidesems; a *whole back* is cut in one on the fold. The *wrap* is the overlap of a double-breasted front beyond the centre line. A *welt* is a standing pocket mouth, as on the breast; a *flap* hangs over the pocket opening.

For a studio, this lesson is a checklist for line sheets: back treatment, lapel beyond the crease row, pocket geometry, edge stitching — four style levers that never endanger the fit you drafted.`,
    checkpoints: [
      {
        q: "Back style is 'free' in the CPG system because…",
        options: [
          "the back does not affect fit at all",
          "customers never see the back",
          "any alteration in the back is compensated for in the forepart",
        ],
        answer: 2,
      },
      {
        q: "On a D.B. reefer the buttons are placed…",
        options: [
          "as far behind the breast line as the eye of the hole is in front of it",
          "exactly on the breast line",
          "wherever the flaps allow",
        ],
        answer: 0,
      },
      {
        q: "Serges and vicunas are best finished with…",
        options: [
          "a double row of heavy stitching",
          "a single row of stitching right on the edge",
          "raw unstitched edges",
        ],
        answer: 1,
      },
    ],
  },
  {
    title: "The collar: stand, fall, and the crease row",
    minutes: 10,
    source: { label: "Vincent, the collar system", url: "https://archive.org/details/cutters-prac-guide-jacket-cutting" },
    bodyMd: `A collar is a small piece of cloth doing precise geometry: it must hug the neck, turn over cleanly, and hand the roll on to the lapel without a wrinkle at the join. Vincent's collar system is drafted *on the forepart* — never in the abstract — because its whole shape depends on where the front breaks.

First the anatomy. The **stand** is the part that rises from the neck seam; the **fall** (or leaf) turns down over it; the **crease row** is the fold line between them, running off into the lapel's roll line at the **gorge**. The **break** is the point where the front begins to turn — on a buttoning coat, about 1½ inches (4 cm) above the top button, and that is exactly where Vincent starts the draft: mark the break, come out from the crease line a little less than the depth of the stand, and draw the crease row from the break up through that point past the shoulder. Lay the width of the back neck along it beyond the shoulder seam, then set off the stand below the line and the fall above it, and shape the ends to the style of the front.

The system's principle is worth stating slowly, because it explains most collar failures you will ever see. **A low-rolling coat needs a collar with a short fall edge; a coat that buttons high at the neck needs a long fall edge.** The fall's outer edge has to travel around the shoulders and lie flat on the coat; the deeper the fall and the higher the coat fastens, the more length and **spring** that edge needs. A fall edge cut too short lifts the collar away from the neck and drags the lapels; too long, and the edge ripples like a lettuce leaf.

The same length-logic governs the **V question** in lapels — the little wedge some cutters take out of the lapel's outer edge. Vincent's answer to his puzzled students: a V *shortens the outside edge*. On a coat meant to roll low, that shortening helps the lapel hug its long curve. On a coat meant to button up high — which needs all the length it can get at that edge — a V is simply wrong. One idea, two opposite prescriptions, both correct.

Body-coat practice adds the refinements. On dress fronts the gorge is lowered 1 to 2 inches (2.5–5 cm), and the run from the hollow of the gorge to the front should be made straight or nearly so, to give "a straight **drawing seam** to your collar" — a straight gorge is far easier to sew and press clean than a snaking one. On double-breasted morning coats Vincent cautions against cutting the gorge too low in front, because the general tendency is to get lapels too short for the run of the front. And always, before cutting: draw the crease line on the pattern and *turn the lapel over* to see the finished shape — what you drafted flat is not what the eye will meet.

In making, the collar is a creature of the iron as much as the shears. The under collar (cut on the bias in trade practice) is pad stitched along and below the crease row to teach it the neck's curve; then, going on, it is **put on full just in the hollow of the gorge** and held slightly tight across the back neck and in front of the neck. That fulness in the hollow is the detail Vincent keeps returning to — it lets the collar settle down into the neck curve instead of bridging it, and its absence is one of his listed causes of a coat standing away at the back.

> **Term note:** *spring* is curvature built into an edge so it can open out to a larger circle in wear. The *drawing seam* is the seam joining collar to gorge, traditionally sewn with a drawing (running) action. The *step* is the notch between collar end and lapel point.

Get the stand-and-fall arithmetic right, respect the fall edge's appetite for length, and put the collar on full in the hollow — the top of the coat will then do what the canvas lessons promised the front would do: roll, not crease.`,
    checkpoints: [
      {
        q: "A coat that fastens high at the neck needs a collar with…",
        options: [
          "a long fall edge, with plenty of spring",
          "a short fall edge",
          "no stand at all",
        ],
        answer: 0,
      },
      {
        q: "A V taken out of a lapel's outer edge…",
        options: [
          "adds length for high-buttoning coats",
          "shortens the outside edge — right for low rolls, wrong for high fronts",
          "is purely decorative",
        ],
        answer: 1,
      },
      {
        q: "When going on, the collar should be…",
        options: [
          "eased evenly all round",
          "stretched tight everywhere",
          "put on full in the hollow of the gorge, snug across the back neck and front",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "The body coat: sidebody, skirts, and the frock family",
    minutes: 11,
    source: { label: "Vincent, body coat operations and skirts", url: "https://archive.org/details/cutters-prac-guide-part-2-coats" },
    bodyMd: `The **body coat** — frock, morning coat, dress coat — is the lounge's senior relative: cut with a waist seam, a separate **sidebody**, and **skirts**, it fits the torso closely and lets the skirt do the draping. Vincent's Body Coats volume opens by refusing to begin with a draft at all. First come what he calls the *principles of coat cutting* — seven quantities every cutter must control whatever system he uses: height of neck, position and size of scye, balance, waist suppression, spring over the hips, allowance for making and ease, and the location of the neck point. Systems are merely ways of regulating these seven; understand them and you can vary any cut to suit any customer.

The draft itself proceeds as seven numbered **operations**, and the order is the lesson. First the depths — including a *fashion waist* about 2 inches (5 cm) below the natural waist, the level where the waist seam actually sits. Second, the widths, with the back seam coming in a full inch (2.5 cm) at the waist: body coats are shaped from the centre back as much as the sides. Third, the back and the sidebody, with a small wedge — about a quarter inch (6 mm) — taken out between back and sidebody at the scye so the back hugs the blades. Fourth, the sweeps for neck and shoulder points, exactly as in the lounge. Fifth, the breast line and gorge. Sixth, the skirts. Seventh, the sleeve. Nothing in it will surprise a lounge cutter; what is new is the *anatomy* — back, sidebody, forepart, skirt — four pieces where the lounge had two.

The skirt system deserves its own attention because Vincent draws every style on one diagram to make a point. Square out a line parallel with the waist; round the top edge as much as the forepart and sidebody were hollowed, with about an inch of fulness allowed; square down some 9 inches (23 cm); come out an inch and draw the run of the front; then **round over the prominence of the seat about half an inch** (1.3 cm) — more for a very prominent seat. And then the point: the region at the top of the skirt where it meets the body **does not change between styles** — "that part requiring to fit the same in even such extreme styles as a Livery Greatcoat and a gentleman's Dress Coat." All the drama between a morning coat's cutaway sweep and a frock's straight front lives in the run of the front and the amount of *crinoline* — drapery — at the sides. Fit is constant; style is peripheral. It is the crease-row rule again, translated to the waist seam.

The making hints are pure gold, and mostly about giving the body somewhere to be. Put a little wadding round the back scye, nicely graded off. Commence the sleeve-head fulness an inch from the shoulder seam and keep the sleeve tight round the back scye. Put the collar on slightly long in the hollow of the gorge. **Shrink the sidebody** midway down its front edge and give it "a wee stretch" below, so it goes home to the figure at the waist. Spread the skirt's hip fulness over about 4 inches (10 cm), just forward of the sideseam; pleat the lining over the hips; make the facing *wider than the outside* through the shoulder; flash-baste the sleeve linings to the sleeve seams; finish the cuffs with slits even without working buttons. Every item is the same doctrine: more lining and length where the body is hollow, receptacles where it is prominent.

And the family resemblance is closer than beginners fear. Vincent reports a clerical frock coat, tried on and fitting excellently, that was converted — fronts cut away, skirts re-shaped, lapels re-basted on — into "as good a fitting Dress Coat as it had been previously a Clerical Frock." His moral, verbatim in spirit: *if you can cut a good fitting morning coat, you can cut a dress coat* — the variations in skirt and front are only style.

> **Term note:** the *sidebody* is the narrow panel between back and forepart that gives a body coat its waist; the *skirt* is everything below the waist seam; the *fashion waist* is the styled waist-seam level, below the natural waist; *spring* over the hips is the outward flare that clears the seat.`,
    checkpoints: [
      {
        q: "Across all skirt styles, the part that never changes is…",
        options: [
          "the region at the top where the skirt meets the body",
          "the length of the skirt",
          "the amount of drapery at the sides",
        ],
        answer: 0,
      },
      {
        q: "Vincent's seven 'principles of coat cutting' are…",
        options: [
          "seven decorative details of livery",
          "the quantities every system must regulate, whatever plan is used",
          "seven kinds of body coat",
        ],
        answer: 1,
      },
      {
        q: "The converted clerical frock coat proved that…",
        options: [
          "dress coats need a completely different system",
          "frock coats cannot be altered",
          "frock, morning and dress coats differ in style, not in fit",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Cutting for the figure as it is: stooping, erect, corpulent",
    minutes: 11,
    source: { label: "Vincent, deviations for abnormalities", url: "https://archive.org/details/cutters-prac-guide-part-2-coats" },
    bodyMd: `Vincent's chapters on **disproportion** begin with a working assumption modern pattern rooms would do well to frame: bodies vary, so the *standard* draft is merely a starting position, and every deviation has a named correction. If you take direct measures, most corrections happen by themselves; if you work from a scale, you must apply them by hand. Either way you should know them, because they teach you what each line of the draft is *for*.

**The stooping figure** is longer and broader in the back, shorter and narrower in the front; head and shoulders carried forward, blades prominent, the arm hanging forward. So: shorten the front shoulder measure a quarter inch (6 mm) and add only ¾ inch instead of the usual 1 inch at the second sweep; add about half an inch (1.3 cm) to the depth of scye; make the back a bare quarter inch wider and the front the same amount narrower; take out a trifle more between back and sidebody at the scye; hang the sleeve more forward; and cut the collar with a shorter crease edge and a relatively longer fall edge. Every change simply follows the body: length and width migrate from front to back.

**The erect figure** reverses it: lengthen the front shoulder a quarter, sweep with 1¼ instead of 1, shorten the back, make the back a shade narrower and the front wider, give more spring below, hang the sleeve a trifle backward, and give the collar the longer crease edge. And here Vincent adds the sentence that turns a recipe into understanding: the extra quarter at the sweep "really amounts to **a wedge let in across the front** to provide room for the prominence of chest," which must then be *drawn in and shrunk away* if the front is to sit snug. Drafting and pressing are one system — the wedge is drafted flat and ironed into shape.

**Corpulency** gets the fullest treatment, in both volumes. Vincent fixes the ideal at a waist 4 inches (10 cm) *smaller* than the chest; his worked example is a 50 chest with a 54 waist — 8 inches of disproportion on the whole, so 4 on the half draft. The trade rule: **one-third of the disproportion goes at the side, two-thirds to the front.** In a lounge, the third at the side goes in as a plain V (not a fish) under the arm, less whatever the normal draft already took out there; the front is lengthened a little and kept *straight* — "a straight line will fit down the centre of any figure far better than any curved or hollow one," with the fulness drawn in at the edge and pressed back over the stomach. Remember, too, what usually accompanies a big waist: corpulent figures are mostly erect, square-shouldered or short-necked, small in the scye, shoulders carried backward and blades flat — so the sleeve head wants to be flatter, the sleeve hangs less forward, and the collar stand is kept shallow on a short neck. Even the cloth is prescribed: run any stripe with the front edge, favour a neat stripe or small bird's-eye, in dark colours that do not catch the light.

The remaining corrections read like a fitter's field guide. **Long neck and sloping shoulders:** add to both the depth of scye and the front shoulder. **Short neck and square shoulders:** reverse it — reduce both. **Forward shoulders:** take a little off the across chest and add it to the width of back; **backward shoulders**, the opposite. **Prominent blades:** take out more between back and sidebody, top and waist; **flat blades**, less. Hollow waists come in more at the centre back; flat waists, less. And a short-waisted man is served squarer in the shoulders, his scye and front shoulder shortened a quarter inch for every inch he is short in the waist.

> **Term note:** *disproportion* is the measured departure from the standard chest-waist relation, not a judgment of the body — the era's cutters treated the customer's figure as the specification. A *V* is an open wedge cut from an edge; a *fish* is a closed dart within the panel.

The deep lesson survives every fashion since: a fit correction is never "make it bigger." It is *find where the body departs from the block, and move exactly that quantity to exactly that place.*`,
    checkpoints: [
      {
        q: "Vincent's rule for placing corpulent disproportion is…",
        options: [
          "all of it at the centre back",
          "one-third at the side in a V under the arm, two-thirds to the front",
          "half at each sideseam",
        ],
        answer: 1,
      },
      {
        q: "For a stooping figure the draft moves length and width…",
        options: [
          "from the front to the back, with a deeper scye and forward-hanging sleeve",
          "from the back to the front",
          "into the collar stand",
        ],
        answer: 0,
      },
      {
        q: "The extra amount swept for an erect figure's neck point amounts to…",
        options: [
          "pure seam allowance",
          "a longer button stand",
          "a wedge across the front for the chest, later drawn in and shrunk away",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Fulness at the top of the sideseam: seven causes, one method",
    minutes: 10,
    source: { label: "Vincent, fulness at top of sideseam", url: "https://archive.org/details/cutters-prac-guide-jacket-cutting" },
    bodyMd: `Vincent closes his jacket volume with a whole plate devoted to one defect, because it is *the* defect of the lounge: **fulness at the top of the sideseam** — a loose vertical wave just behind the armhole. Body coats rarely show it, because their seam over the blades gives the shoulder-blade a receptacle; a lounge, with no seam there, must make room some other way, and when it fails, the surplus collects at the top of the sideseam. Round-backed, prominent-bladed figures show it worst.

![Diagrams of jacket forepart and scye corrections for fulness at the sideseam](/school/the-jacket-and-coat/lesson0-scye-fulness-corrections.jpg)
*Vincent, plate 30 — eight diagrams on fulness at the top of the sideseam: how to avoid it in cutting and making, and how to cure it cause by cause.*

His framing sentence deserves memorising: **"semi-identical effects are produced by different causes."** The same wrinkle can come from at least seven distinct faults — among them: too long a back; a badly put-in sleeve; the waist over-suppressed at the sideseam; too tight on the hip; too short a front shoulder; too tight a collar. Which is why he insists there is *no universal remedy*: trace the defect to its source first, then correct the source. Diagnosis before surgery — the whole discipline of fitting in one rule.

**Avoiding it in the cut.** See that the back **balance** is not too long and the front shoulder not too short — "err on the side of shortness of back and length of front." For a round back with prominent blades, use a centre-back seam and round it slightly opposite the back scye — the effect of a small wedge, an eighth of an inch or so (3 mm) at the top of the sideseam dying to nothing at the centre seam — creating shortness exactly where the surplus would gather. Keep the back scye close up to the figure and allow no looseness on the shoulder point.

**Avoiding it in the making.** Draw in slightly along the top of the sideseam and pass the fulness down. Put a **drawing thread** round the back scye, work the fulness downward, and baste on a narrow stay — a strip of silk selvedge — sewing it in with the scye seam so the eased edge can never grow back. Set the sleeve rather tight at the back scye, with any under-sleeve fulness pleated right at the bottom of the armhole. Lay a half-ply of **wadding** 3 to 4 inches (7.5–10 cm) wide round the back scye, with a narrower extra half-ply over it — padding the hollow beside the blade so the cloth has something to lie on. And put the collar on full in the hollow of the gorge. Vincent's economics are blunt: *"Half an hour's attention in the making up will do more than two hours after the garment is finished."*

**Curing it, cause by cause.** If the coat is full right across the back: the back is too long — shorten it at the top. If the waist is tight and only the top of the sideseam loose: let out the waist and re-suppress with a fish under the arm — the commonest case. If the coat looks *held up in front*: let out the neck point and put on a longer collar; the front was borrowing length from the back. If there is looseness at the shoulder ends with a dropping look: nip up the outer end of the shoulder seam. If the hips are too tight and the back consequently "all alive": let out over the hips — the wrinkle was pressure, not surplus. Five different alterations for one appearance; only the diagnosis tells you which.

> **Term note:** *balance* is the relative length of back and front from shoulder to hem; a coat "out of balance" hangs wrong however well each seam measures. A *drawing thread* is a running thread pulled up to ease an edge in before it is stayed.

For a modern studio this lesson is the template for every fit-session note you will ever write: name the symptom, list the candidate causes, test them in order, and record which one it was — because next season's block inherits the answer.`,
    checkpoints: [
      {
        q: "Vincent's first rule for fixing fulness at the top of the sideseam is…",
        options: [
          "always take in the sideseam",
          "find the cause first — the same effect has many different causes",
          "press it out with steam",
        ],
        answer: 1,
      },
      {
        q: "In cutting, you should err on the side of…",
        options: [
          "a short back and a long front",
          "a long back and a short front",
          "a deep scye and a wide back",
        ],
        answer: 0,
      },
      {
        q: "A jacket that looks 'held up in front' is cured by…",
        options: [
          "shortening the sleeves",
          "taking in the hips",
          "letting out the neck point and putting on a longer collar",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "The repair bench: buttonholes, felling, and second lives",
    minutes: 10,
    source: { label: "Copeland, repairing and alterations", url: "https://archive.org/details/copelandmethodco00cope" },
    bodyMd: `Copeland's manual is not only about the iron. Its longest lessons teach **repairing and altering** — relining coats, renewing silk facings and velvet collars, making buttonholes, darning tears — because in 1908 a garment was an asset to be maintained, and the tailor who maintained it kept the customer. A studio that offers repair and alteration today is reviving his business model, and his methods still work stitch for stitch.

**Relining a coat** is his set piece, and the procedure is a model of working from evidence. Rip out the old lining — sleeves first — press it flat, and *use it as the pattern* for the new, adding working allowances: a couple of seams top and bottom in the sleeves, half an inch (1.3 cm) all round in the body. Do one side at a time, leaving the other side's lining in place as a guide. Baste the new lining in with long, loose stitches, seams landing on the coat's seams; put a 1-inch (2.5 cm) **plait** down the centre back for ease; then **fell** everything — fronts, bottom, pocket mouths, sleeve ends. His governing caution: never baste a lining in tight or short. *"Coats will not hang well with tight or short lining"* — rather too long than too short, a truth every alterations bench relearns weekly.

The **felling** itself gets its own doctrine. The needle takes up only the folded edge and just enough of the cloth beneath to hold; the stitches small, close, and even; the thread never drawn so tight that the edge scallops "like the teeth of a saw." Where a seam takes strain, use **back stitching** — each stitch entering the end of the last so the line is continuous. **Basting** is scaffolding only: it holds the work while it is sewn and is cut and drawn out afterward, never left in the finished garment.

**Buttonholes** are the visible signature of hand finishing. Overcast the cut at once, before it frays. Then work the buttonhole stitch: insert the needle at the edge, pass the threads at the eye under its point, and draw away so the **purl** — the little knotted loop — lands exactly on the cut edge. Keep the stitches close and of uniform length, closer still at the end where the button bears, "as most wear comes there." For thin, ravelly goods, Copeland offers a shop trick: outline the hole first by machine — down one side, two stitches across, back up the other — which replaces overcasting and lets you stitch every hole in a garment without leaving the machine.

**Darning a three-cornered tear** — the L-shaped rip a pocket corner or a nail leaves — has two methods: darn diagonally back and forth through the tear, fanning the stitches at the corner; or, stronger, darn a square patch of new threads over the angle, first with the **warp** direction, then across it with the **woof**, finishing beyond each end of the tear. Done in matching thread, the repair vanishes into the weave.

**Renewals** extend the coat's life at its wear points. Sleeves worn through at the cuff edge are darned, taken up an eighth of an inch, and re-felled. New silk facings are cut by the old ones plus ¾ inch (2 cm) allowance and felled with fine silk, never drawing the edge; Copeland's ambition is exact — *"try to have the new silk facing put on so that it will look better than the old one did when new. This will bring you customers."* A fresh velvet collar is cut a trifle larger than the old, steamed over the iron, basted with silk thread in rows from crease to leaf, a little cushion of ease left at each end so the corners curl *under*, then felled and herringboned in place.

> **Term note:** to *fell* is to hem an edge down with tiny slanting stitches; a *plait* here is a pressed fold of surplus lining left for ease; the *purl* is the knotted edge-loop of a buttonhole stitch; *warp* and *woof* are the lengthwise and crosswise thread systems of the cloth.

And two lines of Copeland's shopkeeping to close the course's circle: charge by the hour and the material — repair work priced honestly is profitable — and never deliver a garment still damp from pressing. Craft, priced and finished; that is the whole method.`,
    checkpoints: [
      {
        q: "When relining a coat, the pattern for the new lining is…",
        options: [
          "the old lining, ripped out, pressed flat, plus working allowances",
          "the coat's original paper pattern",
          "a standard block in the nearest size",
        ],
        answer: 0,
      },
      {
        q: "A lining basted in too tight or too short means…",
        options: [
          "a lighter coat",
          "the coat will not hang well",
          "less felling to do",
        ],
        answer: 1,
      },
      {
        q: "In a hand-worked buttonhole the purl should…",
        options: [
          "sit on the underside where it cannot be seen",
          "be spaced widely for speed",
          "land exactly on the cut edge, stitches closest where the button bears",
        ],
        answer: 2,
      },
    ],
  },
];

export const T3_MORE_QUIZ: QuizQuestion[] = [
  {
    id: "t3q15",
    q: "The CPG's front shoulder and over shoulder measures…",
    options: [
      "make the draft self-correcting for stooping, erect, square and sloping figures",
      "replace the need for a chest measure",
      "are only used for sleeves",
    ],
    answer: 0,
  },
  {
    id: "t3q16",
    q: "In Vincent's lounge draft, the neck point is located by…",
    options: [
      "a fixed proportion of the breast",
      "the intersection of two sweeps driven by the shoulder measures",
      "tracing a block pattern",
    ],
    answer: 1,
  },
  {
    id: "t3q17",
    q: "A collar for a coat that buttons high at the neck needs…",
    options: [
      "a short fall edge",
      "no stand",
      "a long fall edge with plenty of spring",
    ],
    answer: 2,
  },
  {
    id: "t3q18",
    q: "In the body-coat skirt system, the part that fits the same from a livery greatcoat to a dress coat is…",
    options: [
      "the top of the skirt where it joins the body",
      "the run of the front",
      "the drapery at the sides",
    ],
    answer: 0,
  },
  {
    id: "t3q19",
    q: "For a corpulent figure, the trade rule places the disproportion…",
    options: [
      "entirely at the centre back",
      "one-third at the side in a V under the arm, two-thirds to the front",
      "all in the skirt",
    ],
    answer: 1,
  },
  {
    id: "t3q20",
    q: "Copeland warns that a coat lining put in tight or short…",
    options: [
      "wears longer",
      "saves cloth without any drawback",
      "stops the coat hanging well",
    ],
    answer: 2,
  },
];
