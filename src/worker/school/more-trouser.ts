import type { Lesson, QuizQuestion } from "./types";

// Expansion lessons for T2 · The Trouser — appended after the original four
// (progress is keyed by lesson index, so append-only).
export const T2_MORE_LESSONS: Lesson[] = [
  {
    title: "Taking the trouser measures: the tape and the eye",
    minutes: 9,
    source: { label: "Vincent, 'The Measures'", url: "https://archive.org/details/cutters-practical-guide-trousers" },
    bodyMd: `Every fault a trouser can have is cheaper to catch at the measuring than at the fitting, and both of our books open with the tape for exactly that reason. Vincent's rule of order sounds fussy until you see what it protects: **take the lengths first, then the widths — and take the leg before the side.**

Here is why. The side length and the leg (inseam) length differ by the **body rise** — the height of the tube above the **fork**. A cutter who measures the side first, then asks the customer to hitch the trousers hard up before taking the leg, can end up recording a body rise of barely 10 inches (25 cm); Vincent is blunt that it is *seldom wise to give less than twelve inches* (30 cm) of body rise for an adult figure. Measure the leg first, honestly, down to the heel seam of the shoe the trousers will be worn with, and the rise takes care of itself. Getting the tape truly home to the crutch was a real trade problem — Vincent describes brass tape-ends and, best of all, a hook-and-cord rig buttoned to the bottom of the waistcoat so the tape sits at the fork without awkwardness for measurer or customer. The gadget is period; the principle is permanent: *the leg measure is only as good as its top end.*

Then the widths — waist, seat, knee, bottom, with the thigh added if wanted. Each girth has its own manners:

- **Waist:** most customers like ease for what Vincent charmingly calls "after-dinner expansion." Take it as worn, then ask about ease rather than guessing.
- **Seat:** taken round the most prominent part, *moderately easy* — Croonborg has the customer stand with heels together for it — but fairly close if a smart fit is wanted. The draft adds its own ease later; do not add it twice.
- **Knee:** the trade rule is that trousers are *stretched* at the knee in making, so the knee measure is taken closely.
- **Bottom:** follow the customer's taste — Vincent concedes the hem width is "more a matter of taste than fit."

Croonborg's American procedure adds the stagecraft: the customer adjusts his trousers up to the crotch as he likes to wear them, stands erect with feet about 8 inches (20 cm) apart, and the measures go into the order book in a fixed layout — outside seam, inside seam, waist, seat, knee, bottom — so any cutter in the shop can read any other cutter's line. A fixed measure block that everyone writes the same way is a tech pack habit with a 1907 pedigree.

But the tape is only half the order. Both authors insist the measures be **supplemented by observation**, and Croonborg turns it into a physical exam: with the customer's heels together, place your hand between the legs at the knee. A gap of *two fingers' breadth* means slightly bow-legged; *three fingers*, a medium degree; *the breadth of the hand*, extreme. Note whether he bends forward or carries himself erect, whether the seat is large or flat, whether the feet splay or stand close. All of it goes in the measuring book, because — his words in spirit — the tape can be perfectly right about lengths and girths and the trousers still fail if the figure's attitude was never written down.

> **Term note:** the *order book* (Croonborg's "measuring book") is the ancestor of your client record — measures plus figure notes plus style choices, captured once, at the source. Vincent's parallel advice to "train the eye to take measurements" as you walk about is the oldest fit-model program in the trade.

The habit to steal for a modern studio: a measure sheet where every trouser order records six girths and two lengths *in the same order every time*, plus a free-text line for attitude and figure notes. The books differ on gadgets; they agree completely on that.`,
    checkpoints: [
      {
        q: "Vincent takes the leg measure before the side length because…",
        options: [
          "it protects the body rise — seldom wisely less than 12 inches for an adult",
          "the leg measure is harder to remember",
          "customers prefer it",
        ],
        answer: 0,
      },
      {
        q: "The seat measure is taken…",
        options: [
          "as tight as the tape allows",
          "round the most prominent part, moderately easy, heels together",
          "over the thickest coat",
        ],
        answer: 1,
      },
      {
        q: "Croonborg's finger test at the knee estimates…",
        options: [
          "the knee girth",
          "the degree of bow leg",
          "the trouser bottom width",
        ],
        answer: 1,
      },
    ],
  },
  {
    title: "The proportionate draft, worked step by step",
    minutes: 12,
    source: { label: "Vincent, 'Drafting the System'", url: "https://archive.org/details/cutters-practical-guide-trousers" },
    bodyMd: `This is the lesson to read with a pencil. Vincent's proportionate system builds the whole trouser from four measures — side, leg, waist, seat — and a handful of fractions of the seat. We will work his own example: a 36 inch (91 cm) seat, 30 waist, 32 leg, 18 knee, 17 bottom.

**The scaffolding.** Draw the side length from 1 down to 3, and from 3 the leg length up to 2 — the difference is the **body rise**. Square the **fork (crutch) line** across through 2. On it, three points, and here are the fractions the whole system stands on:

- 2 to 4 = **one-sixth seat** (6 in / 15 cm) — the *centre line*, which becomes the crease.
- 2 to 5 = **one-fourth seat** (9 in / 23 cm) — the *fly line*.
- 2 to 6 = **one-third seat** (12 in / 30 cm) — the *fork point*.

One-sixth, one-fourth, one-third: locate them with accuracy, says Vincent, for they fit "the principal points in the system." If arithmetic slows you, the period sold **graduated tapes** — you pick the tape marked with your half-seat (the 18 tape for a 36 seat) and read 6, 9, 12 units straight off, each unit being one-eighteenth of the size marked. A proportionate system is exactly that: a ruler that scales with the body.

Drop the centre line square from 4, and *test your square*: if the line is truly at right angles, 3 to 8 must equal 2 to 4. Vincent even tells you how to prove a doubtful square by drawing a 12 inch box with it. Trust nothing you have not tested — including your tools.

**Levels and widths.** Knee level: from 4 down, half the leg less 2 inches (leg 32 gives 14 in / 36 cm) — knee and bottom lines always squared to the *centre* line. Waist: 10 to 11 is one-fourth waist plus a quarter inch (6 mm) for seams — and note the trade constant hiding there: *the recognised tailoring seam is a quarter of an inch*. Knee: one-fourth of the knee each side of the centre line (4½ in for an 18 knee). Bottom: one-fourth of the bottom to the side, a quarter inch less to the leg. The topside hangs symmetrically about the centre line because that line is the crease, and the crease is the plumb.

**The outlines.** Spring the side seam out above the waist ("the body gets larger directly above the waist"), round it in to touch the construction line a few inches above the fork level, then run to knee and bottom. The leg seam runs straight from bottom to knee, then a slight curve into the fork point. The fork curve starts about one-sixth of the seat above the fly line and comes round to point 6 — and mind Vincent's warning, verbatim: *"A too hollow fork must at all times be avoided."* Hollow the bottom edge three-quarters to one inch, deepest about an inch to the side of the centre — the foot turns outward, and the hollow sits over the instep.

**The undersides are drafted over the cut-out topsides.** Up from 5, one-fourth of the seat gives the seat line; the back fork extension is **one-eighth of the seat** beyond the front (4½ in / 11.5 cm on our example), dropped slightly below the front fork's level — sweep it, using the knee as a pivot. Then the two honest measurements: measure the topside's width and make the underside up to **half seat plus 2 inches** — one inch for seams, one inch for ease — and at the waist to **half waist plus 2½ inches** — 1½ for the seams, 1 for the **fish**, the back dart, placed 3 or 4 inches from the side seam, pointing backward, dying out 6 or 7 inches above the fork line so no blister of cloth forms. The underside leg seam is hollowed about half an inch more than the topside's; worked up skilfully, that extra hollow eases the back of the thigh.

> **Term note:** *topside* = the front panel, *underside* = the back. The names come from how the panels lie on the cutting board, not on the body.

Notice what the system is: every longitudinal position is a fraction of the seat, every width is a quarter of a girth plus stated seams and ease. Nothing is style; everything is accountable. Style comes later — this frame is what it varies from.`,
    checkpoints: [
      {
        q: "On the fork line, the centre line, fly line and fork point sit at…",
        options: [
          "one-half, one-third and one-quarter of the waist",
          "one-sixth, one-fourth and one-third of the seat",
          "fixed inches regardless of size",
        ],
        answer: 1,
      },
      {
        q: "The underside is made up to half seat plus 2 inches, which is…",
        options: [
          "1 inch for seams and 1 inch for ease",
          "all ease",
          "an arbitrary period habit",
        ],
        answer: 0,
      },
      {
        q: "Vincent's warning about the fork curve is…",
        options: [
          "cut it as hollow as possible",
          "a too hollow fork must at all times be avoided",
          "never curve it at all",
        ],
        answer: 1,
      },
    ],
  },
  {
    title: "Croonborg's American draft: pivots, sweeps and stipulated variations",
    minutes: 10,
    source: { label: "Croonborg, Trousers section", url: "https://archive.org/details/grandeditionofsu00croo" },
    bodyMd: `Cross the Atlantic and the trouser draft changes accent. Croonborg's Supreme System (1907) drafts from six recorded measures — outside seam, inside seam, waist, seat, knee, bottom; his worked example is 41½, 32, 32, 37, 18, 16 — and where Vincent reasons in fractions along a fork line, Croonborg reasons in **sweeps**: arcs swung from pivot points, so that the back part is literally rotated into position around the leg.

![Clean line diagram of a proportionate trouser draft with lettered points, front and back combined](/school/the-trouser/lesson0-proportionate-trousers.jpg)
*Frederick Croonborg, Grand Edition of Supreme System (1907) — the proportionate trouser draft, front and back in one lettered diagram.*

The frame first. Square out and down from A; A to B is the outside length, B to C the inside length — the difference is the rise, exactly as in Vincent. The knee line does not sit at the bare halfway point: D is half way between B and C, and the knee line is squared out **2 inches (5 cm) above it** — a drafted acknowledgment that the visual knee sits above the geometric middle of the leg. Widths are the familiar quarters: a quarter seat along the crotch line with the fork extension beyond it, quarter waist each way at the top, quarter knee and quarter bottom about the centre. The front finishes an inch shorter at the bottom edge — the same back-drop over the shoe you met in the making lesson.

Then the American move. **Cut out the front part first** and lay it on fresh paper: the back is drafted *over* it, by sweeping. Sweep forward from the side-seam point using the knee as a pivot; sweep forward and backward from the waist using fork and knee points as pivots. The back fork extension is **one-twelfth of the seat** beyond the front part; the seat measure is then *applied* — walked across the pattern with the tape — and the back waist closed with a **V** (Croonborg's name for the fish) sized to whatever the tape says is surplus, minus two seams. Where Vincent computes, Croonborg measures up the actual pattern and lets the tape decide. Both are honest; Croonborg's way self-corrects as the figures get odd.

The most modern thing in the chapter is the word **stipulate**. Every departure from normal is a named variation with a stated amount, chosen at the order:

- **Long or short front** — for the erect or stooping carriage: stipulate a quarter, half or three-quarters of an inch at the seat-seam point and re-square the top. One wedge, three sanctioned sizes.
- **Open or closed trousers** — large or small hip, legs carried apart or together: swing the leg line at the bottom by half an inch, an inch, or an inch and a half, and re-hang knee and bottom widths about the new line.
- **Large or flat seat** — tilt the back part at the seat by a quarter to three-quarters of an inch, pivoting the square on the fork.
- **Peg top** — the fashion cut, full at hip and narrow at the ankle: knee measure ignored, an *excess over the hip* recorded (his example carries 4 inches), rated at a quarter inch of pattern per inch of exaggeration.

And behind it all sit his **proportionate tables**: inseam and rise laid out in a grid of height (5 ft 4 to 6 ft) against seat size, so that a mail-order house in Chicago could cut a plausible trouser for a man it never saw. Rise grows with height *and* with girth — the table encodes what Vincent teaches as principle.

> **Term note:** to *sweep* is to draw an arc with the tape or a stick pinned at a pivot point; to *stipulate* is Croonborg's word for fixing a variation's amount at order-taking, not at the fitting. His V = Vincent's *fish* = the modern back dart.

For your studio, the Supreme System's lesson is organizational as much as geometric: normal is a base pattern, and every figure adjustment is a **named, quantified option** — a dropdown, not a scrawl. That is grading and made-to-measure logic, thirty years before anyone called it that.`,
    checkpoints: [
      {
        q: "Croonborg drafts the back part by…",
        options: [
          "sweeping arcs from pivots over the cut-out front part",
          "a separate unrelated draft",
          "folding the front part in half",
        ],
        answer: 0,
      },
      {
        q: "His knee line sits…",
        options: [
          "exactly halfway between fork and bottom",
          "2 inches above the halfway point of the inside length",
          "wherever the customer asks",
        ],
        answer: 1,
      },
      {
        q: "'Stipulate' in the Supreme System means…",
        options: [
          "guess at the fitting",
          "fix a variation's amount at order-taking as a named option",
          "leave extra inlay",
        ],
        answer: 1,
      },
    ],
  },
  {
    title: "Breeches and the riding cut: drafting for the saddle",
    minutes: 10,
    source: { label: "Vincent, Breeches chapters", url: "https://archive.org/details/cutters-practical-guide-trousers" },
    bodyMd: `Vincent's second book-within-the-book opens on a garment with a different job. Breeches in 1905 owned the outdoors — riding, cycling, shooting, golf — and the whole family obeys one style law he states up front: **livery breeches fit close, riding breeches are "nothing if not baggy," dress breeches sit between.** The fullness is not slack tailoring; it is drafted function.

Start, as he does, with the body in the saddle. A horse measures **16 to 20 inches (40–50 cm) through between the rider's knees**, so the legs must open to sit astride. First surprise: measured along the body, fork-to-knee does *not* grow when the legs open — so the extra room is provided **by opening the legs of the draft, not by lengthening the fork**. Similar result, different geometry, and Vincent insists on proceeding "on right lines." Second observation: opening the legs *does* lengthen the leg seam — brace your own trousers close and take a striding stance, and the fork drops an inch or an inch and a half away from the body. And third, the side view: the rider sits in a permanent half-sit, with a bend at the seat and a bend at the knee. The draft answers each bend by name:

- More **seat angle** on the undersides — the steepest in the book, as you met in the seat-angle lesson.
- The undersides **fulled on** to the topsides at the seat — the back put on short, so the seat curves in over the saddle instead of hammocking.
- Extra length **worked and fulled over the knee cap** on the topside, with a fish taken out of the underside behind the knee — a bent knee, pre-sewn.

![Riding trouser pattern draft with shaded reinforcement panels on the inside of the leg](/school/the-trouser/lesson3-riding-trousers-draft.jpg)
*Vincent, plate 9 — the riding cut, its reinforcement strapping shaded on the inside of the leg.*

**The measures multiply.** Down the side: to the knee, to the **small** (the narrow of the leg just below the knee), to the calf, to full length — plus fork-to-knee on the inside. Round: knee, small, calf, bottom, **taken over the bare leg if possible**; if over trousers, deduct a quarter to half an inch. Close-fitting styles add a thigh measure. And if you hold only trouser measures, his relative-lengths rules convert: half the leg length reaches from fork to small; the knee sits one-sixteenth of the leg above the small, the calf one-tenth below. Each garment then claims its own stopping place — dress breeches extend to the small, knickers fasten round it, livery breeches run to the calf, riding breeches stop near the calf and are carried on by thinner **continuations** to the ankle.

**The draft itself** keeps the trouser skeleton — one-sixth, one-fourth, one-third of seat along the fork line; body rise found by deducting leg from side; front dropped an inch or so at the top. The differences are all purposeful: the fork swung "fairly high up"; the underside fork strictly one-eighth of the seat but — his advice — *err on the side of excess of fork* in a riding cut, where fork fullness "is a virtue"; the side seam ballooned in the famous West End curve over the thigh; the seat measured up a generous **4 inches (10 cm) over the half seat**, variable from 3 to 5. Below the knee everything reverses and fits like a gaiter: quarter of knee, small and calf each side, made up to measure plus one inch on the undersides, four buttons showing above the gaiter with the first at the small.

Even the order-taking is a checklist of decisions: whole falls or fly front, buttons or lacing at the knee, cross or **frog pockets**, strappings to the inside leg, continuations in Melton or self material. Vincent expects the cutter to know the answers before the chalk moves.

> **Term note:** *continuations* = the close-fitting lower legs added below a riding breech; *strapping* = the reinforcing panel on the inside leg where rider meets saddle; the *small* = the narrowest girth of the leg, just below the knee.`,
    checkpoints: [
      {
        q: "The rider's straddle is provided for by…",
        options: [
          "lengthening the fork extension",
          "opening the legs of the draft — the fork quantity stays",
          "raising the waist",
        ],
        answer: 1,
      },
      {
        q: "At the seat, riding breeches undersides are…",
        options: [
          "fulled on short to the topsides so the seat curves over the saddle",
          "cut without a seat seam",
          "stretched longer than the topsides",
        ],
        answer: 0,
      },
      {
        q: "Girths at knee, small and calf are best taken…",
        options: [
          "over the bare leg, or with a deduction if over cloth",
          "over the thickest trousers",
          "only by proportion",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Knickers and the sporting leg",
    minutes: 8,
    source: { label: "Vincent, Knickers chapter", url: "https://archive.org/details/cutters-practical-guide-trousers" },
    bodyMd: `If riding breeches are the fitted end of the sporting wardrobe, **knickers** (knickerbockers) are its easy end — Vincent calls them "the favourite nether garment for cyclists," worn equally for shooting, golf and walking. Their character comes from exactly two drafted quantities, and it is worth seeing how little separates them from the trouser you already know.

**Width and bag.** The leading characteristics, in his words, are *the width of the leg* and *the length provided for fulling over* — the pouch that bags over the knee band. Knickers are cut to reach the **small**, with about **4 inches (10 cm) of surplus length** allowed for the bagging over. In the draft this appears as bluntly as possible: square down from the fork line and mark **the leg length plus 4 inches**. The bag is not styling added at the sewing machine; it is four honest inches on the pattern.

The rest of the system is the trouser skeleton at its friendliest. One-sixth, one-fourth, one-third of seat along the fork line; body rise by deducting leg from side; a quarter waist plus a quarter inch at the top with a little spring over the hip. The knee is cut wide to order — *a good plan for a 36 seat is a 20 inch (51 cm) knee* — and split evenly each side of the centre line, the bottom of the topside slightly rounded. Undersides come off the cut-out topsides as always: seat line a quarter of the seat up, back fork one-eighth of the seat beyond, waist made up to measure plus 2½ inches, seat plus 2, and a modest **fish** — an inch wide and about 6 inches long — out of the underside back. Nothing new to memorize; only the proportions relax.

**The knee band is the garment's engineering.** Vincent draws it both ways: in two pieces, half the small plus an inch, about 4 to 4½ inches (10–11.5 cm) deep; or in one piece, curved so it "clips close to the shin with ample spring over the calf" — the band hollowed and sprung, not a straight strip, because the leg it wraps is a cone, not a cylinder. Either way the slit for the buttons is left about 3 inches from the side seam *so the buttons come well to the front*, where the wearer can reach them. His plate of fashionable finishes runs from a plain elastic-drawn bag through narrow garters with buckle and strap to the broad box-cloth band with four buttons — the same leg, dressed for different sports and prices.

Below, the ensemble finishes with **spats and short gaiters** — cut in three pieces with a seam up front and back, lined through with stout cotton or canvas, a strap (preferably leather) under the foot, usual length about 7 inches (18 cm). They are the reason a knicker can stop at the small and the outfit still meet the shoe.

> **Term note:** *box cloth* = a dense, felted woollen — stiff enough that a knee band cut from it holds its shape; *spring* = deliberate outward curve added to an edge so it clears what lies beneath, here the swell of the calf.

Two studio lessons hide in this cheerful chapter. First, **ease has an address**: the knicker's four extra inches live in length above the band, its width lives at the knee, and the waist stays a fitted waist — the baggiest garment in the book is still drafted tight where it must carry. Second, a style family (trouser, breech, knicker) can share one measure block and one skeleton, differing only in a short list of stated quantities. That is exactly how a modern size-and-style matrix should be built: one base, few numbers, all of them written down.`,
    checkpoints: [
      {
        q: "The knicker's bag over the knee comes from…",
        options: [
          "about 4 inches of surplus length drafted above the band",
          "elastic alone",
          "cutting the waist oversized",
        ],
        answer: 0,
      },
      {
        q: "The one-piece knee band is curved and sprung because…",
        options: [
          "straight strips waste cloth",
          "the leg is a cone — the band must clip the shin and clear the calf",
          "it is easier to sew",
        ],
        answer: 1,
      },
      {
        q: "The button slit sits about 3 inches from the side seam so that…",
        options: [
          "the buttons come well to the front where the wearer can reach them",
          "the band can be removed",
          "the seam is hidden",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Cutting for the figure as it is: corpulent, bow-legged, knock-kneed",
    minutes: 11,
    source: { label: "Vincent, 'Disproportion'", url: "https://archive.org/details/cutters-practical-guide-trousers" },
    bodyMd: `The proportionate draft fits the figure the scale book imagines. Vincent's disproportion chapters fit everyone else, and they begin by defining the baseline: **a man whose waist is 6 inches (15 cm) smaller than his seat is proportionate**; every departure is disproportion, to be *provided for*, not argued with.

**Corpulency** is the great case, and his analysis is better than his arithmetic — though the arithmetic is famous. The corpulent figure is not merely larger: it is **extra erect** (the body leans back to keep its equilibrium over the load), *smaller in the thigh relative to the seat*, shorter in the leg, longer in the front. The draft answers with one clean rule: **raise the front by one-sixth of the disproportion.** His worked example: a 53 inch waist on a 50 seat, where proportion says the waist should be 44 — so 9 inches (23 cm) of disproportion, and the front rises 1½ inches (4 cm). Some cutters measured this length directly with a bent instrument over the belly; Vincent finds the sixth-rule simpler and just as sound. Around it cluster the supporting moves: fronts kept **receding rather than advanced** (an advanced front shortens the fork, strains the fly and "aggravates horseshoe folds"; a receding one risks only loose cloth in the lap — the safer error), legs slightly opened, and a half inch added to the leg length because *opening the legs lengthens them*.

![Trouser draft altered for small hip, knock knee, short front and large seat, dashed lines showing the standard draft](/school/the-trouser/lesson3-knock-knee-large-seat-variation.jpg)
*Croonborg — one base draft, four figure variations dashed against the standard; his large- and flat-seat wedges are stipulated in quarter-inch steps.*

**The bent legs** get the book's most humane page. Vincent tells of a Glasgow cutter whose breeches fitted a deformed customer so *perfectly* that they showed every line of the deformity — and made the man ill with distress. The moral is stated outright: for these figures **it is far more necessary to hide the deformity than to fit it.**

- **Bow legs:** the limb curves outward, increasing the distance from fork to side seam at the knee; unfitted, the trouser drags from fork to knee and strains the fly buttons. Remedy: **bend the centre (crease) line outward** — about an inch at the knee for a figure bent two inches — and divide the knee width about the *new* line, filling the fork a touch to relieve the strain.
- **Knock knees:** the opposite bend, judged with a straight-edge from hip to ankle (a normal leg hollows 1 to 1½ inches at the knee). Remedy: bend the centre line the other way, **about half the disproportion**, and hollow the fork to clear away surplus cloth. Where one leg bows and the other knocks, cut each leg its own way — the pattern is per-leg, not per-pair.
- **Erect and stooping figures:** men who carry the hips forward or back. Cut the pattern across 6 or 7 inches below the top and open a **wedge at the fly seam for the erect figure**, or take one out of the underside seat seam for the stooping — lengthening the front, shortening the seat seam, leaving the side length alone.

Croonborg systematizes the same territory: his **large seat** and **flat seat** variations tilt the back part at the seat by a stipulated quarter, half or three-quarters of an inch, pivoting the square on the fork; his finger-test from the measuring lesson decides who gets them. Between the two books you get the full modern method — *diagnose at measurement, name the variation, quantify it, and record it* — which is precisely what a made-to-measure block system does today.

> **Term note:** *horseshoe folds* = the curved drags under the seat of a too-short or too-forward front; *receding front* = a fly line leaned back at the top; *disproportion* = any departure from the 6-inch waist-to-seat relation.

The chapter's ethic outlives its arithmetic: measure honestly, cut generously, and let the trouser tell a kinder story about the body than the calipers would. Vincent would have called that good trade sense. It still is.`,
    checkpoints: [
      {
        q: "Vincent's proportionate baseline is a waist…",
        options: [
          "equal to the seat",
          "6 inches smaller than the seat",
          "6 inches larger than the seat",
        ],
        answer: 1,
      },
      {
        q: "For a corpulent figure the front is raised by…",
        options: [
          "one-sixth of the disproportion",
          "the full disproportion",
          "a fixed 3 inches",
        ],
        answer: 0,
      },
      {
        q: "For bow legs and knock knees the key move is…",
        options: [
          "taking in the side seam",
          "bending the centre (crease) line to follow the limb — hiding, not outlining, the defect",
          "adding a wider waistband",
        ],
        answer: 1,
      },
    ],
  },
  {
    title: "Falls, flies, pockets and waistbands: the top of the trouser",
    minutes: 10,
    source: { label: "Vincent, 'Different Styles of Fronts'", url: "https://archive.org/details/cutters-practical-guide-trousers" },
    bodyMd: `Everything above the fork line is hardware, and Vincent catalogues it like the engineer he was. The chapter matters because every closure and pocket is also a *cutting* decision — tops shortened, bearers added, mouths placed — made at the draft, not discovered at the machine.

**The fly front** was the modern option in 1905, and his spec is complete: usually **five fly buttons**, holes and buttons matched so the finished fly edge just meets the seam of the **catch** (the underlying button stand, sewn to the right side or grown on the front); the **top button set on the inside of the fly** with its hole worked through the catch — the detail that keeps the waist closure flat under a waistcoat. For corpulent figures he recommends **French bearers**: the catch extended into a wide tab, about 2 inches at its end, buttoning to the side seam — an internal belt that takes the strain of the front before the fly feels it, often paired with a hook and eye at the top. Inside, the finish is layered and named: silesia facings brought wide enough to cover the seams, a striped waist lining, pockets sewn to stand toward the front, and a good-sized **crutch lining** covering the linen and the fork seams — the trouser's hidden wear point armored in cloth.

**The falls** are the older answer, and still living in workwear and naval dress. In the **whole fall** — "mostly worn by working men and old men" — the topsides are cut **2 inches (5 cm) shorter** and the gap is bridged by a **bearer**, a deep under-piece about 6 inches at the side and 3½ to 4 inches wide at the front, carrying the pocket; the fall flap is faced, four holes cross its top, and three buttons hold the bearers below. The **split fall** — "very popular for riding breeches" — narrows the flap: tops cut only 1 inch shorter, a slit about 6 inches long, the sides finished with welts and a **D-tack** at the corners, the top pieced up with a waistband. Bilton's variant fells the lining deeper so the opening is smaller and warmer. Read the family as one idea: *the closure is a panel system, and the tops are cut shorter by exactly what the panel replaces.*

**Pockets.** Hip pockets come jetted, welted, or — his preference — with a **flap, hole and button**. Placement is prescribed, not eyeballed: for a body of ordinary height the front of the mouth sits about **3½ inches (9 cm) down from the top, the back about 4½ inches**, the mouth thus sloping with the hip. And a warning every jeans brand has since rediscovered: *hip pockets should not be too deep, or they are uncomfortable when the wearer is seated.* The inside gets a blind low enough to cover stays and tacking, and a hanger-up at the seat seam under the waist lining — 1905's loop for the clothes hook.

**Waistbands and their alternatives.** Trousers may be cut *without* a band, the tops running whole to the waist; a banded trouser has its top reduced and a separate band added, a touch over 2 inches deep — and the band is **hollowed about an inch**, curved rather than straight, "to produce spring on the top edge," because the waist is smaller than the line an inch below it. A straight-strip band on a curved body must gape; a hollowed one sits. For braces-wearers there is the **buckle and strap** at the center back, 6 or 7 inches long in the hollow of the waist — adjustability, drafted in. And at the formal extreme, **dress trousers** show how restraint is itself a spec: black, cut to fit smartly with only about an inch over the seat, side seams left plain (braid the exception), side pockets omitted on Eton cuts along with deep seat pieces and fishes — nothing that would bulge under a short jacket.

> **Term note:** the *catch* = the button stand under a fly; a *bearer* = an interior panel carrying strain or a pocket behind a fall or fly; a *jetted* pocket = one finished with narrow piped lips; *silesia* = the tough twilled cotton of period pocketing.

The takeaway for a tech pack is Vincent's own habit: every closure choice implies numbers — how much shorter the tops, how deep the bearer, how far down the pocket mouth. Name the style *and* its numbers, and the maker never has to guess.`,
    checkpoints: [
      {
        q: "In a whole fall front, the topsides are cut…",
        options: [
          "2 inches shorter, the gap bridged by a pocket-carrying bearer",
          "2 inches longer for the flap",
          "identically to a fly front",
        ],
        answer: 0,
      },
      {
        q: "The waistband is hollowed about an inch so that…",
        options: [
          "it stretches in wear",
          "its top edge springs to the smaller waist above instead of gaping",
          "it uses less cloth",
        ],
        answer: 1,
      },
      {
        q: "Vincent's caution about hip pockets is…",
        options: [
          "never use flaps",
          "cut them as deep as possible",
          "not too deep, or they are uncomfortable when seated",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Grading the trouser: one pattern into a range",
    minutes: 9,
    source: { label: "Vincent, 'Trouser Grading'", url: "https://archive.org/details/cutters-practical-guide-trousers" },
    bodyMd: `The last skill in Vincent's trouser volume is the one that turns a cutter into a manufacturer: producing a whole *set* of model patterns from proven ones. His chapter is startlingly close to a modern grading seminar, down to the vocabulary fight in its first paragraphs.

**Grading versus graduation.** The two words were rivals, and Vincent takes a side. *Graduation* — scaling a pattern uniformly, as the graduated tapes scale a draft — quietly assumes that "the man who gets larger is expected to get taller." Human growth disobeys: once a man reaches maturity **his height stays practically the same while waist and seat enlarge — and the length of his leg actually decreases** (the figure opens and settles). The man of 40 is inches bigger round than he was at 30, and no taller. So graduation "can only be applied to certain parts of the garment, and even then with limitations"; *grading*, which follows "the peculiar evolutions of human growth," is what the large manufacturing houses use for their ready-made models. When your size chart adds girth without adding height between sizes, you are honoring this exact distinction.

**The best method** is beautifully mechanical. Cut two trusted patterns of well-separated sizes — say a 36 seat and a 50 (91 and 127 cm), or a 38 and a 44. Lay them together on two principal points: in his plate, **the top of the fly seam and the bottom of the leg seam**. Draw straight lines through every corresponding point of the two outlines — waist corners, seat, knee, bottom. Then decide how many sizes you want between: for seven patterns from 36 to 50, divide each connecting line into **six equal parts** — find the middle, then thirds of each half — and connect the divisions. Every intermediate size inherits its shape from both parents, "the leading features of style kept the same throughout the entire set, and the progress from normal to corpulent gradual." Two masters, straight lines, arithmetic: that is grading, 1905 or now.

**The single-pattern shortcut** exists, and he rates it honestly. From one good pattern, per 2 inches (5 cm) of seat: add a sixth of an inch (about 4 mm) at the fork, a like small step at the side and the knee, an inch to the waist — and *shorten the leg* a sixth, growth's signature again. Useful when only one pattern survives; but Vincent "confesses a liking for the former method," and would rather draft a second, larger master — attending to the known peculiarities of growth — and grade between the two.

**Where the masters come from** is the chapter's slyest section. A **scale of proportionate measures** — his table runs fourteen sizes from a 4-year-old (24 waist, 26 seat) to a 48-seat adult, side lengths peaking while legs shorten in the large sizes — will produce a set by drafting. But patterns were also *taken*: with "a few weights and a fine awl," a made-up trouser from an admired house is pinned flat and its seams pricked through to paper — and, he notes without blushing, "scores of tailors have ripped garments apart" to capture a cut whose style built a trade. Grade that capture and "the style of noted firms may be retained" across a whole range. Competitive teardown plus grading: the ready-to-wear playbook, complete by 1905.

Croonborg's contribution is the demand side of the same trade: his **proportionate tables** cross height (5 ft 4 to 6 ft) against seat to give inseam and rise for every cell — a size chart in the modern sense, letting a house cut for a customer represented only by numbers. Between Vincent's nets of connecting lines and Croonborg's grids, the whole apparatus of sized production is on the table.

> **Term note:** a *model pattern* = the approved master for one size — today's *block*; a *set of models* = a graded run; *scale* = a table of proportionate measures by size or age.

For your practical eye: whenever you grade, ask Vincent's question of every measurement point — *does this quantity grow with girth, with height, or against them?* Waist and seat grow; rise creeps; leg, past maturity, gives ground. A grade rule that moves every point the same way is graduation wearing grading's clothes.`,
    checkpoints: [
      {
        q: "Vincent prefers grading between two cut patterns because…",
        options: [
          "it follows real growth and keeps one style through the set",
          "it needs no arithmetic",
          "graduated tapes were expensive",
        ],
        answer: 0,
      },
      {
        q: "In his two-pattern method the masters are laid together at…",
        options: [
          "the waistband and hem",
          "the top of the fly seam and the bottom of the leg seam",
          "the two side seams",
        ],
        answer: 1,
      },
      {
        q: "As the mature figure grows in seat, the leg length…",
        options: [
          "grows in proportion",
          "stays exactly the same",
          "actually decreases — grading must shorten it",
        ],
        answer: 2,
      },
    ],
  },
];

export const T2_MORE_QUIZ: QuizQuestion[] = [
  {
    id: "t2q15",
    q: "The leg measure is taken before the side length because…",
    options: [
      "it protects the body rise — seldom wisely under 12 inches for an adult",
      "the tape is easier to hold that way",
      "the side length never matters",
    ],
    answer: 0,
  },
  {
    id: "t2q16",
    q: "In Vincent's system the centre line, fly line and fork point sit at…",
    options: [
      "one-sixth, one-fourth and one-third of the seat along the fork line",
      "fixed inches for every size",
      "one-half, one-third and one-quarter of the waist",
    ],
    answer: 0,
  },
  {
    id: "t2q17",
    q: "A rider's straddle room is drafted by…",
    options: [
      "lengthening the fork extension",
      "opening the legs of the draft — fork-to-body length is unchanged",
      "adding width at the waistband",
    ],
    answer: 1,
  },
  {
    id: "t2q18",
    q: "For a corpulent figure Vincent raises the front by…",
    options: [
      "one-sixth of the disproportion",
      "the whole disproportion",
      "nothing — the waistband absorbs it",
    ],
    answer: 0,
  },
  {
    id: "t2q19",
    q: "A whole fall front requires the topsides cut…",
    options: [
      "2 inches shorter, with a deep bearer carrying the pocket",
      "on the bias",
      "2 inches longer for the flap facing",
    ],
    answer: 0,
  },
  {
    id: "t2q20",
    q: "Graduation fails as a grading method because…",
    options: [
      "it assumes larger men are taller — mature figures grow in girth while legs shorten",
      "it requires two patterns",
      "it only works on breeches",
    ],
    answer: 0,
  },
];
