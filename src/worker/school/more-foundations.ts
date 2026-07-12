import type { Lesson, QuizQuestion } from "./types";

// Expansion lessons for T1 · Foundations of Cutting — appended after the
// original four (progress is keyed by lesson index, so append-only).
export const T1_MORE_LESSONS: Lesson[] = [
  {
    title: "The shoulder that never moves",
    minutes: 10,
    source: { label: "Madison, ch. I–II", url: "https://archive.org/details/elementsofgarmen00madi" },
    bodyMd: `Every drafting book of the era treats the **shoulder point** — where the shoulder seam meets the neck — as the great mystery. Madison opens his book by calling it the point cutters regard as "the key to the whole coat," and then spends two chapters demolishing the mystery with one of the best experiments in the trade's literature.

Try it yourself, exactly as he describes. Take an oblong piece of cloth, lay it over your shoulders like a small poncho, and trim it until it sits smoothly around the neck. Now put that same piece on anyone else — tall, short, stooped, square. It fits. The middle of the back may show a little too much cloth for sloping shoulders or a little too little for high ones, but the shoulder itself — the slope of cloth from neck to arm — is right on every body. Cut the same piece to clear the arms and you are holding the upper portion of a coat.

From this Madison draws his first heresy: **the pitch of the shoulder is the same for every shape.** The shoulder point is always in the same place; as most cutters use the term, he says, it is really no point at all.

Then what are cutters doing when they "repitch the shoulder" for an erect or a stooping customer — and why do those coats fit? Madison's answer: they are not changing the shoulder at all. Hold the back panel still and slide the **forepart** (the front panel) to meet it, and you can see that the so-called new pitch is simply *more cloth moved onto the breast and the same amount taken from the back*, or the reverse. The shoulder's slope is untouched. The coat fits a different figure because the cloth is distributed differently on either side of the **scye** — the period word for the armhole.

Chapter two turns that observation into a working law. A round-shouldered body is bigger over the **blade** — the shoulder-blade region of the back — and flatter in the breast, with the head carried farther forward. Because we draft from the back seam, a larger blade pushes the front of the scye forward, draws in the top of the **sidebody** (the narrow panel between forepart and back), and narrows the breast. Madison illustrates it with an imaginary **fish** — a tapered wedge of cloth, what we would call a dart-shaped insertion — slipped in under the arm: the blade grows, the top of the sidebody is trimmed down so the shoulder measure is preserved, and the front gets narrower by exactly what the blade gained.

His rule, italicized in the original because he knew how much malpractice it would correct: draft the coat for a stooping man *precisely as for a well-shaped man*, except make it as much larger behind the scye and over the blade as the blade actually requires. And the law that follows: adjust the blade for round-shouldered or flat-backed figures **without moving the top of the sidebody or the sidebody's waist point** from where a well-proportioned draft would put them. Carry the top of the sidebody out along with the blade and your shoulder measure goes oversize; let the waist point drift and the balance goes with it.

> **Term note:** *forepart* = front panel; *sidebody* = the underarm side panel of a body coat; *scye* = armhole; *blade* = the shoulder-blade area; a *fish* = a tapered, dart-like wedge seamed out of (or into) the cloth.

Why this matters a century and a half later: when a fit problem appears at the shoulder, the beginner's instinct is to redraw the shoulder seam. Madison's experiment says the shoulder is almost never the culprit — look instead at how the cloth is shared front and back of the armhole. Chase the blade, not the shoulder point, and most "shoulder problems" solve themselves.`,
    checkpoints: [
      {
        q: "Madison's cloth-over-the-shoulders experiment demonstrates that…",
        options: [
          "the pitch of the shoulder is the same for every shape of body",
          "every figure needs a differently pitched shoulder",
          "woven cloth stretches enough to fit any shoulder",
        ],
        answer: 0,
      },
      {
        q: "When a cutter 'repitches the shoulder' for an erect figure, what has actually changed?",
        options: [
          "The slope of the shoulder seam",
          "The distribution of cloth between breast and back — the shoulder itself is untouched",
          "The depth of the armhole",
        ],
        answer: 1,
      },
      {
        q: "For a round-shouldered figure, Madison says to enlarge over the blade while…",
        options: [
          "moving the top of the sidebody outward to match",
          "shortening the shoulder seam",
          "keeping the top of the sidebody and its waist point exactly where a well-proportioned draft puts them",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Drafting the Rational coat, step by step",
    minutes: 12,
    source: { label: "Madison, Coat System (plate F)", url: "https://archive.org/details/elementsofgarmen00madi" },
    bodyMd: `Having spent half a book on principles, Madison finally shows his own method — the **Rational Coat System** — and it is a beautiful example of everything this course has taught so far: a proportionate frame, corrected by exactly two direct measures, needing nothing but a common square and a tape.

![Shaded coat draft crossed by geometric construction lines with lettered drafting points](/school/foundations-of-cutting/lesson3-madison-rational-draft.jpg)
*Madison, Elements of Garment Cutting (1878), plate F — the Rational Coat System draft this lesson walks through.*

**The measures.** The client takes off his coat and is measured over the vest, in a fixed order, every number written down at once. Madison's specimen set: natural length of waist 16 1/2 in (42 cm), fashionable length of waist 19 in (48 cm), whole length of coat 38 in (97 cm), **upper shoulder measure** 26 in (66 cm) — from the neck joint around the shoulder and back to the start — **lower shoulder measure** 25 1/2 in (65 cm) — the tape dropped down the back seam between the two back scyes, then carried around the arm — sleeve to elbow 20 in, sleeve to hand 32 in, breast 37 in (94 cm), and the hip. Nine or ten numbers for any coat; the waist girth is only needed for the vest.

The two shoulder measures do the real work, and Madison assigns each its duties. The **lower shoulder** governs the width of back, the amount of cloth behind the scye, the cloth over the **droop of shoulder**, and the shoulder's position. The **upper shoulder** governs the height of neck, the depth of scye, and the length of shoulder. *The two combined govern the balance* — which is why he calls the system self-balancing.

**The frame.** The whole draft hangs on half the lower shoulder — here 12 3/4 in (32 cm). Lay the square on the paper and mark that half-measure along both arms; those two lines, squared up and down, locate the height of back, the depth of scye and the width of the frame. The remaining points follow as small fixed amounts and simple fractions — the back width, for instance, comes off the quarter of the lower shoulder plus a small constant — until back, sidebody and forepart stand on the paper. A **V** about 1 1/2 in (4 cm) wide at the waist and 3/4 in (2 cm) at the hip is cut out under the arm, and the bottom of the sidebody is swept to match the back.

**The self-balancing step.** Now compare your two shoulder measures. In the model set the upper runs 1/2 in (1.3 cm) longer than the lower, so Madison adds a quarter inch (6 mm) at the top of the back and the same at the shoulder point — half the difference in each place. If the upper measure is *smaller*, reverse the process. On very sloping-shouldered men he found as much as 2 in (5 cm) of difference — drafted the same way, half the difference to the top of back, half to the shoulder. If the two measures are alike, the first draft stands. That one comparison is the whole posture correction: no guessing at stoop, no repitching, just two honest numbers arguing with each other.

He allowed himself one dry boast about proof measures — the check measurements some rival systems piled on at the end: a system that is right, he says, needs none.

**The sleeve** is drafted from the garment, not the body: before cutting the forepart, measure the finished scye and note it on the pattern. One-sixth of the scye here, one-half there, a sweep, and the sleeve head matches its armhole by construction — the closure check from our earlier lesson, built into the method. Width at the hand: 6 to 6 1/2 in (15–16.5 cm) for an undercoat, 7 to 7 1/2 in for an overcoat. In practice Madison cut the outside sleeve 2 to 3 in wider than the inside sleeve, taking what he added from the under sleeve — better looking, and a material saving of cloth.

> **Term note:** an *undercoat* is the ordinary suit coat (worn under an overcoat); the *droop of shoulder* is the cloth allowed over the slope from neck toward the shoulder end.

You are not learning this to draft 1870s frock coats. You are learning it because it is the cleanest possible specimen of the hybrid method: frame by proportion, correction by two direct measures, closures proven by construction.`,
    checkpoints: [
      {
        q: "The Rational coat is drafted principally by…",
        options: [
          "half of the lower shoulder measure",
          "the full breast measure",
          "the fashionable length of waist",
        ],
        answer: 0,
      },
      {
        q: "When the upper shoulder measure runs half an inch longer than the lower, Madison…",
        options: [
          "repitches the shoulder seam forward",
          "adds a quarter inch at the top of back and a quarter at the shoulder point",
          "adds the whole half inch to the depth of scye",
        ],
        answer: 1,
      },
      {
        q: "Madison's sleeve is drafted from…",
        options: [
          "the client's arm girth",
          "a fixed fraction of the breast measure",
          "the measured size of the finished scye, noted on the pattern",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Probable faults: what a wrinkle is telling you",
    minutes: 10,
    source: { label: "Madison, Probable Faults & Optical Illusions", url: "https://archive.org/details/elementsofgarmen00madi" },
    bodyMd: `After the principles, Madison writes a chapter he calls **Probable Faults** — a bestiary of the ways coats go wrong, each fault traced back to the drafting decision that caused it. It reads like a fitter's casebook, and every entry is still current.

**The short shoulder — the trade's favorite mistake.** Not more than one cutter in three, Madison claims, cuts the shoulder long enough. The cause is a subtle bookkeeping error: trying to make **actual measures** prove. If the tape says a man's shoulder measures 26 1/2 in (67 cm), most cutters cannot bring themselves to let the draft measure 28 in (71 cm) — yet it must, because the body's measure allows nothing for the play of muscles or the ease that grace requires. A coat cut to the bare number may look smooth at the first try-on, especially if it is well stiffened with haircloth; wear it a week and it wrinkles and breaks through the shoulders. His diagnosis for the specimen in his figure: three-quarters of an inch (2 cm) too short from the **socket-bone** — the prominent bone at the base of the neck in front — to the front of scye. Adding that amount smooths the shoulder and, he is careful to say, does not disturb the balance.

**The long shoulder.** Rarer but common enough: the coat visibly hangs off from the neck. The tempting repair is to add cloth over the droop of shoulder so the coat can settle down into place. Madison calls this exactly wrong: it deepens the armhole, and a coat with a too-deep scye climbs toward the wearer's ears every time he sits down. Shorten the shoulder between socket-bone and front of scye instead.

**The flaring roll.** When the coat is buttoned and the lapel roll bows away from the chest instead of lying down, there are two possible culprits. If the coat also swings at the waist, it is a balance fault — buttoning drags the coat to a place it does not hang to naturally, and the surplus piles into the break of the lapel; carry the sidebody's side seam farther forward at the waist. If the coat hangs properly, the fault is too little cloth over the droop of shoulder — add it there.

**Wrinkles from underarm to side seam.** Usually caused by greed with the shears: cutting too much out of the **V** under the arm between sidebody and forepart. Madison's numbers are blunt: half an inch (1.3 cm) out of the V is enough for ninety-nine men in a hundred, and even for the hundredth do not exceed three-quarters. Cut more and the sidebody twists when seamed, throwing loose cloth behind the arm — and the coat splays open at the hips when unbuttoned. His safer discipline: take an actual hip measure and cut the hip to it plus 2 1/2 in (6 cm) for making and necessary ease, so the coat buttons without any forcing and you never need to carve the underarm to buy spring over the hips.

Then comes the strangest and most modern chapter in the book: **Optical Illusions**. Madison had known first-class cutters ruin good drafts because a pattern *looked* wrong. A man accustomed to wide backs drafts a narrow back, decides the skirt has too much spring, trims it — and kills the coat, because the spring was correct and only the unfamiliar proportion deceived his eye. The same draft judged against a different habit reads as faulty in the opposite direction. Optical illusions, he says, are killing coats every day.

His safeguard is one sentence of pure gold: **judge the outlines, never the seams.** The outer edges of the assembled draft carry the fit; where the seams fall inside it is taste and fashion. Check the outline against the measures, and if it proves, leave it alone — no matter how odd this season's proportions make it look.

> **Term note:** the *break* is where the lapel begins to roll away from the buttoned front; *haircloth* is the stiff interlining of the period, ancestor of modern canvas.`,
    checkpoints: [
      {
        q: "A coat that wrinkles and breaks through the shoulders after a week of wear most likely has…",
        options: [
          "a shoulder cut too short, because the draft was made to match the bare body measure",
          "a back cut too wide",
          "too much cloth over the blade",
        ],
        answer: 0,
      },
      {
        q: "Fixing a too-long shoulder by adding cloth over the droop is wrong because…",
        options: [
          "it makes the collar stand away",
          "it deepens the scye, so the coat climbs when the wearer sits",
          "it shortens the front of the coat",
        ],
        answer: 1,
      },
      {
        q: "Madison's defense against optical illusions in drafting is to…",
        options: [
          "always cut the familiar shape",
          "have a colleague approve every pattern",
          "judge the draft by its outlines and measures, not by the look of the seams",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "The cutter's devices: scye, gorge and the tailor's V",
    minutes: 10,
    source: { label: "Madison, Practical Hints to Cutters", url: "https://archive.org/details/elementsofgarmen00madi" },
    bodyMd: `Madison follows his theory chapters with a long, generous chapter of **Practical Hints** — the accumulated devices, he admits, of thousands of the best cutters he had known, offered to anyone willing to study them. These are the small decisions that separate a coat that fits from a coat that fits *and* looks cut by an artist.

**The scye.** The comfort and much of the style of a coat depend on the armhole's shape and size. A small scye can be comfortable if perfectly shaped, but medium is safer: it keeps the breast from breaking when the arms swing forward. Two features of his one proven shape: it is cut well out at the front where the arm is most prominent, and the bottom is comparatively flat rather than a tight round.

**The gorge** — the neckline seam where the collar joins the forepart. Fashion sets its height, but one rule holds: the lower the lapel roll, the shorter the neck and the lower and straighter the gorge should be. Ignore it and you get a heavy, bossy breast and a coat that pulls from the neck.

**The tailor's V.** Two mismatched-figure problems, two opposite devices. When a client measures small about the shoulders but very large in the breast, the draft leaves you with a neck too long or a breast too round: release yourself by cutting a **V** — a narrow wedge — in the neck of the forepart, closing the surplus. But when the client has enormous shoulders and a narrow breast, *never* put a V in the neck: it shortens the neck and forces fullness into a breast that has no flesh to fill it. Instead run the gorge a little farther past the break, keep the breast flatter, and if help is needed, take the V out between the forepart and the **lapel** instead. General rule: the larger the breast, the larger the V between lapel and forepart.

**Daylight between collar and lapel.** Cutters kept finding a gap between collar and lapel on the finished coat and blaming the **jour** — the journeyman tailor who made it up. Madison's diagram shows the collar and lapel laid together on the draft exactly as they will seam, apparently touching; made up, they gape anyway. If you want them to close on the body, the draft must show the collar *lapping over* the lapel by a quarter to half an inch (6–13 mm), the smaller amount for a low roll, the larger for a high one. The paper must overpromise for the garment to keep its word.

**Marking the side seam honestly.** Many cutters shape the sidebody's side seam by eye alone — dangerous, because any change in the back's shape misleads the judgment (the optical illusions again). His method: establish the three governing points — top of sidebody, blade point, waist point — then lay the actual back pattern on the draft touching those points and pencil down its side seam as a guide line. Against that line you can *see* how much cloth you are giving the blade, how far down back and sidebody lap, and how much spring you are giving the hip. The spring should run from a quarter inch to one inch (6 mm–2.5 cm) over the guide line: about three-quarters (2 cm) at the hip for a well-proportioned man, only a quarter for a stooping man whose back has little curve below the blade. And let the seams merge about halfway between blade point and natural waist — carried down nearly to the waist, the back of the coat turns baggy, as though cut too long.

One more quiet rule: draft the sidebody's side seam a touch *longer* than the back's — about a quarter inch — because making up shortens the sidebody while it lengthens the back.

> **Term note:** the *gorge* is the collar-to-forepart seam at the neck; a *jour* (journeyman) is the tailor who sews what the cutter cuts; *spring* is the outward flare a seam gives the garment below the waist.

Notice the theme. Every device here manages the gap between paper and cloth — what the draft must say so that the sewn, pressed, worn garment comes out true. A pattern is not a picture of a coat; it is a set of instructions to cloth, written in the knowledge of what cloth will do.`,
    checkpoints: [
      {
        q: "For a client with a very large breast and small shoulders, Madison's device is…",
        options: [
          "a V cut in the neck of the forepart",
          "a deeper scye",
          "extra length added to the shoulder seam",
        ],
        answer: 0,
      },
      {
        q: "For collar and lapel to close on the finished coat, the draft must show them…",
        options: [
          "just touching, edge to edge",
          "lapping by a quarter to half an inch",
          "separated by a seam allowance",
        ],
        answer: 1,
      },
      {
        q: "The sidebody's side seam is drafted slightly longer than the back's because…",
        options: [
          "the hip needs extra spring",
          "the back is always cut on the bias",
          "making up shortens the sidebody and lengthens the back",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Cloth sense: stretch, shrink, and six yards where others use eight",
    minutes: 10,
    source: { label: "Madison, Making & Economy in Cutting", url: "https://archive.org/details/elementsofgarmen00madi" },
    bodyMd: `A draft is only half a garment; the other half is what hands and a hot iron do to the cloth. Madison's chapters on **making** and on **economy in cutting** are short, but they carry the working knowledge of wool that every cutter needs even today — because wool can be *shaped*: stretched where you need length, shrunk where you need hollow, and it remembers.

**Where to work the cloth — and where never to.** Coats of his day were worn easy, so little manipulation was needed, but the rules he gives are precise. For an extra-erect man, stretch the **gorge** a little for a couple of inches out from the shoulder seam — lengthening the neckline where an erect posture demands it. Cut the breast with enough round that the maker can shrink it in to create shape: the fullness is drafted so the iron can turn it into a chest. The collar should never be put on tight, and the edge stay — the tape stabilizing the front edge — goes on *fair*, meaning smooth and without tension. For round-shouldered men, the sidebody is put on a trifle short against the back over the round of the blade, easing the back onto it. For close-fitting coats, stretch the front of the scye half to three-quarters of an inch (1.3–2 cm).

And one prohibition, with the reason attached: **never stretch or shrink the sidebody lengthwise.** Stretched cloth there will relax and shrink back with wear, and the back of the coat goes full and baggy. The lesson generalizes: only manipulate cloth where the shaping is held by a seam, a stay or a collar; cloth shaped in the open air of a panel will creep home.

The trouser rules show the same logic in the opposite direction. The backpart is stretched half an inch (1.3 cm) along the in-seam between crotch and knee and the same on the side seam between hip and knee, the resulting length kept full over the calf; after seaming, the backpart is shrunk from seat to the top of the calf and pressed into shape. Stretch, then shrink: the leg is literally ironed into the curve of a leg.

**Economy in cutting.** Then comes the chapter that paid for the book. Most cutters of his day could not get a suit out of less than 7 to 8 yards (6.4–7.3 m) of cloth. Madison rarely used more than 6 1/2 (5.9 m), often 6: on cloth 29 in (74 cm) wide he cut a full business suit — for a man of 5 ft 8, 38 breast, coat 35 in long — from 6 yards; 28-in cloth needed 6 1/4; 27-in cloth 6 1/2. The method is a discipline, not a trick:

- **Cut the pantaloons first,** and save the piece that comes from between the legs. It is often enough for a sidebody, always enough for the collars, sometimes for the vest facings too.
- **Let the pattern flex where fit permits.** The outside sleeve can be cut wider or narrower to serve the lay, the difference traded with the under sleeve. If crowded, an inch may be moved from the vest forepart to its backpart at the side, or the vest shoulder shortened half an inch and the amount added to the back — seams relocated, dimensions preserved.
- **Never piece** — never assemble a panel from scraps — except at the facing or the top of the lapel, where it hides.

He closes with the arithmetic: a shop cutting four suits a day, saving half a yard on each, keeps one to two thousand dollars' worth of cloth a year — a fortune in 1878. That is why his book carries plate after plate of **lays** — arrangements of pattern pieces on the cloth's width — for each cloth width.

> **Term note:** a *lay* (or lay-plan) is the arrangement of all pattern pieces on the cloth before cutting — exactly what a modern marker-making program optimizes, and what Verto's bill of materials assumes when it prices your yardage.

Two crafts, one habit of mind: respect what the cloth will do after you cut it, and waste none of it before.`,
    checkpoints: [
      {
        q: "Madison forbids stretching the sidebody lengthwise because…",
        options: [
          "it weakens the seam",
          "the cloth shrinks back with wear and the coat's back goes full",
          "it changes the shoulder pitch",
        ],
        answer: 1,
      },
      {
        q: "His first rule of an economical lay is to…",
        options: [
          "cut the pantaloons first and save the piece from between the legs",
          "cut the coat forepart first",
          "piece the sidebody from scraps",
        ],
        answer: 0,
      },
      {
        q: "Piecing is acceptable only…",
        options: [
          "on the under sleeve",
          "at the center back",
          "at the facing or the top of the lapel, where it hides",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Before the tape measure: the rock-of-eye years",
    minutes: 9,
    source: { label: "Giles, Society of Adepts & Hearn chapters", url: "https://archive.org/details/historyofartofcu00gile" },
    bodyMd: `It is hard to imagine the trade without the tape measure — so hard that Giles has to prove, with documents, that at the beginning of the nineteenth century the inch tape still needed *advocates*. This lesson is about what cutting was before it, and how the tape won.

For centuries the working method was **rock of eye**: drafting by practiced judgment, chalk moving over the cloth guided by experience and a stock of inherited paper patterns. Measures were few and crude — dimensions of the figure or of an existing garment — and they were recorded not in a book of numbers but as marks on **strips of parchment or brown paper**, one notched strip per customer, a practice Giles says some shoemakers and breeches-makers still followed in his own day. The strip could say *how long* and *how big around*; it could not locate a single interior point of the pattern.

![Plate of numbered antique pattern pieces including a large curved cape piece and coat sections](/school/foundations-of-cutting/lesson0-early-pattern-pieces.jpg)
*Giles, The History of the Art of Cutting in England (1887), plate 2 — the inherited pattern shapes a rock-of-eye cutter worked from.*

In 1796 appeared the first English book on cutting, published anonymously by "a Society of Adepts." Giles's affectionate verdict: it differed scarcely but in name from rock of eye. Its diagrams have almost no construction lines; the student is told to study the plates and copy the shapes freehand — at a time, Giles notes, when many tailors could barely be expected to copy an outline well. Yet it contains one genuine seed: a single **guide line**, drawn from the shoulder-neck point through the front of the scye down to the side-seam point at the waist, which the Adepts call an indispensable certainty in cutting a coat. One line — but it is a *rule*, checkable and teachable, and Giles marks it as the first printed departure from pure eye-work. He adds, feelingly, that we should picture the fear and trepidation of a tailor of that period about to put shears into costly cloth, with nothing between him and ruin but his eye.

The revolution has a name attached: **Mr. Hearn**, whose works Giles dates around 1818 and earlier, and whom he treats as the great pioneer of measurement in English cutting. Hearn had to argue for the inch tape in print. In his section on measuring he grants that the tape may look difficult to those unaccustomed, but promises that anyone who practices a few times — measuring a coat rather than a customer, and writing the figures down in order — will find it quicker, more convenient and more correct than what he witheringly calls the contemptible mode of using slips of parchment. He even sold the tool with the theory: his *Rudiments of Cutting* came with a painted tape inch measure at two shillings, and his advertisements warned country buyers to order the measure with the book, since none might be had locally.

Hearn also gives us one of the earliest **cross measures** — a diagonal taken on the body to locate an interior point. To find the true height of neck, he directs: mark a point one-eighth of the breast measure out from the back seam (on a 36 breast, 4 1/2 in ≈ 11.5 cm — which is also the proportionate back width), then measure obliquely from the top of the back seam to that mark; a proportionate figure gives about 7 in (18 cm), and any departure is the client telling you his neck is long or short. Giles notes with amusement that cutters of the 1880s were still presenting this measure as a modern discovery.

Who invented the tape itself? Giles can only report claims: one author asserted he had introduced it in 1809 with Duncan McAra, first graduated by McIntyre of Glasgow — but, Giles adds dryly, no one who knew the man would rely on his word. The honest answer is that the tape has no single inventor; it spread because writing numbers down beats notching parchment.

> **Term note:** *rock of eye* = drafting by trained eye and experience rather than by measured construction; a *cross measure* is any diagonal check measure taken across the body.

The moral is not that eye-work was foolish — a great rock-of-eye cutter was formidable. It is that his skill died with him. Numbers, written in order, made skill *transmissible* — and made this school possible.`,
    checkpoints: [
      {
        q: "Before the inch tape, a customer's measures were typically kept as…",
        options: [
          "entries in a ledger of inches",
          "notched strips of parchment or brown paper",
          "wax impressions of the figure",
        ],
        answer: 1,
      },
      {
        q: "The 1796 book by the 'Society of Adepts' mattered because…",
        options: [
          "it printed a complete proportionate system",
          "it introduced graduated tapes",
          "its single guide line was the first printed rule breaking from pure rock-of-eye cutting",
        ],
        answer: 2,
      },
      {
        q: "Hearn's height-of-neck measure locates its chalk mark…",
        options: [
          "one-eighth of the breast measure out from the back seam",
          "one-third of the waist length below the collar",
          "at the front of the scye",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Three families: Golding, Wampen, and Compaing & Devere",
    minutes: 11,
    source: { label: "Giles, systems survey (Golding, Wampen, Compaing & Devere)", url: "https://archive.org/details/historyofartofcu00gile" },
    bodyMd: `Giles reviews dozens of systems — some brilliant, some quackery he skewers with relish. Set three of the serious ones side by side and you can see the whole map of nineteenth-century cutting, because each stakes out a different answer to the question this course opened with: *how many measurements do you trust?*

**Golding — geometry finds its feet (1818).** Golding's *Tailor's Assistant* announces that its scheme rests on geometrical rules applied to the anatomical proportions of the figure. Giles teases him — there is very little geometry in it and less anatomy — but calls it the glimmering of the truth: cutting really is anatomy applied by geometry. The back is always the first part cut; its width comes off as one-eighth of the breast measure; and the waist length is found by a rule Giles calls droll — measuring from the back seam to the elbow point with the arm held square, instead of simply measuring to the waist. But Golding also writes down, as words already well understood, the trade's first printed posture vocabulary: for a stooping figure, throw the shoulder point of the forepart nearer the front line and cut the scye forwarder, producing a **straighter forepart**; for an upright figure, throw the shoulder point back for a **more crooked forepart**. Straight and crooked — the axis every fitter still adjusts, under one name or another.

![Foldout plate of coat and trouser drafts annotated with fractional measurements](/school/foundations-of-cutting/lesson3-giles-proportional-plate9.jpg)
*Giles, plate 9 — a proportionate draft annotated in fractions of the breast measure: the family Golding and Read belong to.*

The pure proportionate wing of this family ran to extremes. Benjamin Read's tables (from 1815) subdivided every size from 20 to 60 inches into ten parts, sold through five editions with no diagrams at all; by 1848 the house of Read was publishing a system worked entirely by **graduated measures** — the divided tapes you met earlier, one scale per breast size. Proportion industrialized.

**Dr. Wampen — the scientist (from 1834).** Henry Wampen was not a tailor. As a student in Berlin he set out to test whether the Greek ideal of beauty was mere fancy or had a scientific basis, and took his calipers to classical statues; the tailor who fitted his clothes, a Mr. Freitag, saw the drawings on his table and told him: you are just the man we want. Pressed into a prize-essay competition on cutting, Wampen won it — and spent the rest of his life founding what he called **anthropometry**: man-measurement, the geometry of the human figure. His system classifies figures by the relation of height proportion to width — equal, greater, or less — and constructs every pattern point from body-derived coordinates set under right angles, each length a stated proportion number. Giles quotes the construction and admits the terms are abstruse; tailors complained the books were unreadable, and Wampen himself told Giles they were never meant for self-instruction — they were textbooks for his pupils. Yet Giles judges his the most complete and elaborate system published in England, and the quiet foundation of a crowd of later "original" systems whose authors did not always name their source.

**Compaing & Devere — direct measure disciplined (1820–1875).** The elder Compaing published *L'Art du Tailleur* in Paris in 1820; with Louis Devere he brought *The Tailor's Guide* to England in 1856. Theirs is the great direct-measure house, and its history is a lesson in itself: the original method required **24 measures**; successive editions cut that to 17, then 11, and by 1866 to just **6 for ordinary figures** — refinement meaning *fewer* numbers, better chosen, taken from a fixed centre point used by no other author. Their stated creed, which Giles quotes approvingly, is that progress in cutting lies in further combining anatomy and physiology with true mathematical principles.

Three families, then: **proportion** (Golding, Read) — fast, average, industrial; **science** (Wampen) — the body mapped whole, demanding but deep; **direct measure** (Compaing & Devere) — the individual body trusted, measure by measure, disciplined down to the essential few. Every system you will ever be sold — and every parametric block in modern software — is a descendant of one of these houses, or a marriage between them. Giles's own working advice survives every fashion cycle: methods are only means of applying principles; study the principles first, and the mechanical steps afterwards.

> **Term note:** *forepart straight or crooked* describes how far the neck point stands from the front construction line — straighter suits the stooping figure, crookeder the erect one.`,
    checkpoints: [
      {
        q: "Golding's posture correction for a stooping figure is…",
        options: [
          "a straighter forepart — shoulder point nearer the front line, scye forwarder",
          "a more crooked forepart — shoulder point thrown back",
          "a deeper scye and shorter back",
        ],
        answer: 0,
      },
      {
        q: "Wampen came to cutting by…",
        options: [
          "apprenticing in a London shop",
          "measuring classical statues to test whether Greek beauty had a scientific basis",
          "inheriting his father's system",
        ],
        answer: 1,
      },
      {
        q: "Across their editions, Compaing & Devere's direct measures went…",
        options: [
          "from 6 up to 24, adding checks each time",
          "unchanged at 17",
          "from 24 down to 6 — fewer measures, better chosen",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "One customer, start to finish",
    minutes: 12,
    source: { label: "Madison, Etiquette of the Cutting-Room", url: "https://archive.org/details/elementsofgarmen00madi" },
    bodyMd: `Madison ends his book where the trade actually begins: with a person standing in your shop. His chapter on the **etiquette of the cutting-room** is a code of conduct, and folded inside it is the whole workflow this course has taught. So for a capstone, let us walk one customer through, from greeting to finished coat, with Madison over one shoulder and Giles over the other.

**1. Receive the client like the professional you are.** Madison's rules of the measuring board have not aged an hour. Touch the client only with the open hand, and gently — never prod with thumbs, never jerk or pull, never breathe in his face. Do not call out the measures like an auctioneer. And the rule that shows the man's decency: if the client has any deformity, do not refer to it; note it in your book without remark. Cutters who announce "very stooping — prominent blades — left shoulder an inch low" to impress the room are, in his flat verdict, simply rude. The figure's truth belongs in the record, not in the air. (In Verto, that record is the Client Book: dated, versioned, private.)

**2. Measure in a fixed order and write every number at once.** Lengths first, then the shoulder measures, then girths — the same sequence every time, so a missing number is instantly visible. You know from the Rational system why the order matters: each measure has assigned duties in the draft, and the two shoulder measures together will carry the balance.

**3. Choose your strategy before your chalk moves.** This is Giles's gift: you now know the three families. A proportionate frame is your scaffolding; your direct measures — shoulder, blade, the balance pair — are the corrections. If the figure is near average, proportion does most of the work. The farther the body departs from average — the stoop, the square shoulder, the large blade — the more you shift weight onto the direct measures, exactly as the trade itself shifted over the century.

**4. Draft in the eternal order: frame, widths, curves, style.** Apply the shoulder law — the pitch never moves; distribute cloth front and back of the scye instead. Balance the upper portion against the lower for the client's attitude. Keep the top of the sidebody and its waist point where the well-proportioned draft puts them, and give the blade what the blade demands.

**5. Prove the draft before the shears.** Walk the seams. Check the collar laps the lapel its quarter inch on paper. Judge outlines, never seam-shapes — optical illusions are killing coats every day. Then plan the lay: pantaloons first, save the crotch piece, flex the outside sleeve, piece nothing but the facing.

**6. Write the making notes.** The draft is instructions to cloth: stretch the gorge for the erect figure, put the sidebody on short over the blade for the stooped one, never manipulate the sidebody lengthwise, collar never tight.

**7. At the fitting, read the creases and hold your nerve.** Diagnose like a fitter: collar standing away and front hem kicking forward is a balance cry, not a size problem; wrinkles breaking through the shoulder after a week means the shoulder was starved of ease. And here Madison's etiquette returns as quality control. Ask the client's opinion of the garment. If he finds a real fault, remedy it cheerfully — never persuade a customer that a bad garment is a good one, and never refuse to see a fault that is pointed out. If he is mistaken, show him the fashion plates and the work on your board, firmly and without offense — then, if he still wants the change, make it *as a favor, not as a right*, and he leaves thinking you courteous instead of unskillful. Never promise a delivery you do not intend to keep; never criticize another cutter's garment in front of a customer — Madison compares it to a barber sneering at your last haircut. A reputation for integrity, he says, is worth almost or quite as much as a reputation for skill.

That is the whole craft in one pass: measurement taken with respect, principles chosen consciously, a draft that proves before cloth is cut, cloth handled with knowledge of what it will do, and a fitting conducted with both a diagnostic eye and good manners. Systems date; this workflow does not. It is the same loop you run in Verto today — client record, block, pattern, fit notes, order — with a hundred and fifty years of cutters nodding behind you.`,
    checkpoints: [
      {
        q: "Madison's rule when a client has a deformity is to…",
        options: [
          "announce it clearly so the record is accurate",
          "note it in the book without remark, and never refer to it unnecessarily",
          "decline the order",
        ],
        answer: 1,
      },
      {
        q: "If a customer finds fault where none exists, Madison advises…",
        options: [
          "showing him he is mistaken, then making any change as a favor, not a right",
          "refusing all alteration",
          "remaking the garment silently",
        ],
        answer: 0,
      },
      {
        q: "The farther a figure departs from average, the more the cutter should…",
        options: [
          "trust the proportionate fractions",
          "add ease everywhere",
          "shift weight from proportion onto direct measures",
        ],
        answer: 2,
      },
    ],
  },
];

export const T1_MORE_QUIZ: QuizQuestion[] = [
  {
    id: "t1q15",
    q: "Madison's cloth-over-the-shoulders experiment showed that the pitch of the shoulder…",
    options: [
      "must be redrawn for every posture",
      "is the same for every shape — apparent 'repitching' is really redistribution of cloth front and back of the scye",
      "depends on the breast measure",
    ],
    answer: 1,
  },
  {
    id: "t1q16",
    q: "In Madison's Rational Coat System, posture is corrected by…",
    options: [
      "comparing the upper and lower shoulder measures and splitting their difference between top of back and shoulder point",
      "taking a separate stoop measure with a plumb line",
      "repitching the shoulder seam by eye",
    ],
    answer: 0,
  },
  {
    id: "t1q17",
    q: "A shoulder cut to the bare body measure, with nothing for muscle play and ease, produces a coat that…",
    options: [
      "hangs off from the neck",
      "flares at the hips",
      "wrinkles and breaks through the shoulders after a week of wear",
    ],
    answer: 2,
  },
  {
    id: "t1q18",
    q: "Madison forbids stretching or shrinking the sidebody lengthwise because…",
    options: [
      "stretched cloth there shrinks back with wear and throws fullness into the back",
      "it spoils the nap of the cloth",
      "the sidebody carries the seam allowances",
    ],
    answer: 0,
  },
  {
    id: "t1q19",
    q: "In the rock-of-eye era, before the inch tape, customers' measures were kept…",
    options: [
      "in decimal ledgers",
      "as notched strips of parchment or brown paper",
      "on graduated wooden rules",
    ],
    answer: 1,
  },
  {
    id: "t1q20",
    q: "Dr. Wampen's 'anthropometry' is best described as…",
    options: [
      "a table of average breast measures",
      "a method of draping on a live model",
      "man-measurement — geometry applied to the human figure to derive pattern construction",
    ],
    answer: 2,
  },
];
