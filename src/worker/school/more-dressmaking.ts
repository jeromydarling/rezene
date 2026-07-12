import type { Lesson, QuizQuestion } from "./types";

// Expansion lessons for S3 · Dressmaking in Detail — appended after the
// original four (progress is keyed by lesson index, so append-only).
export const S3_MORE_LESSONS: Lesson[] = [
  {
    title: "Collars and necklines: framing the face",
    minutes: 10,
    source: { label: "Picken, Perfection in Details, neck lines", url: "https://archive.org/details/DressmakingPerfectioninDetails" },
    bodyMd: `Picken opens her neck-line chapter with a calming observation: necklines seem capable of infinite variation, but every one of them falls into two classes — the **collarless neckline**, which is bound, faced or corded, and the neckline with a collar. Master the finishes for each class and every variation becomes a recombination.

**Shaping a collarless neckline.** Cut the dress with a rather high neckline first, close up to the neck. At the fitting, outline the becoming line — square, V, U, round or **bateau** (boat-shaped) — with pins, then cut on the pinned line. Her trick for symmetry: cut one side only, from center front to center back, then fold the cut-out piece over to the other side with the shoulder seams meeting, pin, and cut along its edge. The two sides cannot help matching.

**Binding.** For a finish that accents the line without shouting, use a narrow bias binding of self-material. Bias, never straight: the **true bias** — the 45-degree grain — is slightly elastic and conforms to the curve, where a straight strip would cockle. For machine application cut it exactly 1 inch (2.5 cm) wide; for hand work, narrower. Two of her rules repay memorizing. First, never let the joining of the binding's ends land on a corner — start on a straight or gently curved stretch, and join the ends on a lengthwise thread so the seam is a true lengthwise seam, pressed open and invisible. Second, match the method to the cloth: machine stitching suits ginghams, linens and flat crepes, where a tailored effect is wanted; voile, crepe de Chine and chiffon want the second stitching done softly by hand, the hemming stitches caught through the machine stitching rather than the material so nothing shows on the face.

**Corners.** An inside corner (a square neck, the point of a V, the end of a slash) fails by accumulating fullness. Stretch the binding slightly at the corner, stitch a fraction past it, slash the garment diagonally almost to the stitching, and let the edge straighten out — the binding forms a small fold that presses flat, and may be tacked for a mitered effect. An outside corner is creased across on the direct bias so the binding turns with a neat diagonal fold on both faces.

**The double binding for sheers.** On chiffon or sheer crepe, cut the bias four times the finished width plus seams, fold it lengthwise, and stitch both raw edges to the right side together; the folded edge turns over to be finished with no raw edge to turn under at all. It is the correct bound finish for any emphasized edge in transparent cloth.

> **Term note:** A *convertible collar* is a straight double strip applied to a close-cut neckline with the center front slashed, so the dress fronts turn back into lapels — convertible because it wears open or closed. The sailor collar and the scarf collar are its relatives.

For the convertible collar, bind the front slash first — running the seam out almost to nothing at the slash's end so it cannot draw — and slip-stitch the binding's free edge, so that when the lapels turn back no stitches show. Cut the collar as long as the neckline plus 1 inch (2.5 cm) for ease and seams, and twice the finished width plus seams. If you face the opening instead, make the facing's outer edge with a single 6 mm turn and one row of stitching — never a double hem turn, which builds a ridge that prints through when pressed — and taper the opening seam to almost nothing at the point.

Butterick adds the workroom detail for applied collars: sew an unlined collar on with a narrow bias facing strip and clip the seam at intervals so it cannot draw the neck. The neckline is where the customer's eye lives; it is the one seam of the dress that is always in the mirror.`,
    checkpoints: [
      {
        q: "Neckline bindings are cut on the bias because…",
        options: [
          "bias is slightly elastic and conforms to the curve",
          "bias is cheaper to cut",
          "straight strips fray more",
        ],
        answer: 0,
      },
      {
        q: "The double binding for chiffon is cut…",
        options: [
          "four times the finished width, folded, so no raw edge needs turning",
          "twice the finished width, single thickness",
          "on the straight grain for strength",
        ],
        answer: 0,
      },
      {
        q: "A front-opening facing gets a single turn and one stitching because…",
        options: [
          "a double hem turn builds a ridge that prints through when pressed",
          "it saves thread",
          "double turns cannot curve",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Sleeves and their finishes: set in without a pucker",
    minutes: 11,
    source: { label: "Picken, Perfection in Details, sleeves and sleeve finishes", url: "https://archive.org/details/DressmakingPerfectioninDetails" },
    bodyMd: `Picken sorts all sleeves into four or five types by the shape of the upper end where they join the garment — **kimono**, drop-shoulder, **set-in**, raglan and epaulet — and insists that once you can handle the types, any seasonal variation is just recombination.

**The kimono sleeve** is cut in one with the body of the garment, and the only really successful one has a seam along the shoulder: that gentle slant from neck to sleeve end does a quiet amount of fitting and keeps the sleeve from humping on the shoulder. Both shoulder edges are slightly bias, so pin them generously and do not stretch them in joining. At the under-arm curve, if you use a plain seam, clip four or five slashes in the turn so the seam cannot draw; if French seams, trim close and keep the finished seam about 6 mm deep.

**The set-in sleeve** is the workhorse, and its doctrine is the course's best example of engineered ease. The pattern deliberately cuts the sleeve cap a little larger than the armhole. To dispose of that surplus, run two gathering threads across the top between the notches — the first on the seam line, the second just outside it — with the ends left loose but knotted. Set the sleeve into the armhole right sides together, notches matched, pins at right angles to the edge, and draw the threads until the fullness is eased in so evenly that it is *lost over the top of the sleeve*. That is the standard: no sign of fullness in the finished cap unless gathers are a design feature. Two more of her laws: keep the lengthwise grain of the sleeve in line with the shoulder seam — a sleeve hung off grain twists on the arm forever — and if the material has no right or wrong side, lay the two sleeves side by side as you pin, or you will make two for the same arm.

> **Term note:** *Ease* is extra length or width built into one seam edge to be shrunk or gathered invisibly into its partner. The elbow of a fitted sleeve carries ease the same way the cap does — one seam edge cut longer, the surplus gathered between two marks.

**Finishes.** As a rule the sleeve finish echoes the neck finish of the same garment — bound sleeves with a bound neck, faced with faced. Beyond that, the wrist is placket-and-cuff territory:

- **The wrist opening on the seam.** For a close sleeve, leave the seam unstitched for 3 or 4 inches (7.5 to 10 cm). Slash across the back-of-arm side of the seam allowance near the top of the opening, hem that edge, and face the other with straight seam binding so there are two thicknesses to carry the snaps. The overlap side comes from the back of the arm and closes flat.
- **The band cuff.** A full sleeve gathers into a double band. Make a 2 to 3 inch (5 to 7.5 cm) placket at the seam end first; cut the band the finished length plus the width of the opening for the **underlap** — the extension that sits beneath the closing — plus seam allowances, and twice the finished width. Gather, distribute, seam the band on, fold, and hem its free edge over the stitching.
- **The tie cuff.** Here is a detail worth stealing: the opening for a tie cuff is *not* placed on the sleeve seam, which would throw the bow to an awkward point. Cut a 2 to 3 inch (5 to 7.5 cm) slash along the back of the arm *in line with the little finger*, bind it narrowly, gather the sleeve close to the wrist, and set on the tie ends so they knot exactly where a bow wants to sit.

Press the finished cap over a cushion, never flat, and the sleeve will hold the round shape you eased into it. A sleeve that hangs on grain, eased clean, with its opening where the hand actually enters — that is most of what "well made" means to the person wearing it.`,
    checkpoints: [
      {
        q: "The ease at the top of a set-in sleeve should be…",
        options: [
          "lost over the top — no visible fullness in the finished cap",
          "bunched at the shoulder seam",
          "trimmed away before sewing",
        ],
        answer: 0,
      },
      {
        q: "The opening for a tie cuff is cut…",
        options: [
          "along the back of the arm, in line with the little finger",
          "on the sleeve seam",
          "at the front of the wrist",
        ],
        answer: 0,
      },
      {
        q: "A set-in sleeve hangs correctly when…",
        options: [
          "its lengthwise grain lines up with the shoulder seam",
          "its seam faces the front",
          "the cap is stretched to fit the armhole",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Skirts that hang true: leveling, hems and plaits",
    minutes: 10,
    source: { label: "Butterick, skirts, hems, tucks and plaits", url: "https://archive.org/details/newdressmakerwit00butt" },
    bodyMd: `A skirt is judged from across the room by one thing: whether its hem is level. Butterick devotes real machinery to getting it so.

**Hanging a gored skirt.** Cut a strip of cardboard and notch it at the height you want the hem to clear the floor. Put the skirt on, stand on a table, and have a helper work around you marking with the notch and pins. Alone, use the yardstick trick: stand a stick upright against your body just below the fullest part of the hips, pin where its top touches the skirt, move it around the figure, then measure down from the pin line evenly. Either way, the length is marked *on the body*, because floors are flat and figures are not.

**Hanging a circular skirt.** A circular skirt is cut partly on the bias, and bias stretches — so make it stretch *before* you hem, not after. Fold strips of scrap material three or four thicknesses deep, pin them around the lower edge as weights, and hang the skirt for two or three days until its own weighted length has pulled all the stretch out. Then level and hem. Skip this and the skirt grows an uneven hem in the first month of wear.

**The circular hem.** A shaped hem is bigger at its raw edge than the skirt it must lie against. In soft cloth, turn the edge under, run a gathering thread close to the turn, and draw it up until the hem's top matches the skirt; blind-stitch. In heavy cloth, gather the raw edge without turning it and cover it with seam binding, sewing the binding's lower edge to the hem only. Before sewing, slip a piece of muslin between hem and skirt and press, shrinking out as much fullness as the cloth allows — the muslin keeps the gathers from printing marks on the right side.

> **Term note:** A *plait* is the period spelling of *pleat* — a fold of cloth laid on itself. An *inverted plait* is a box plait in reverse, its folds meeting on the face; an inlaid plait is one let into a seam.

**Plaits.** Lay plaits before the seams are joined if the pattern allows, and stitch them with at least one seam open — a skirt off the belt and open lies flat under the machine. Baste each plait a little way from its fold as you flatten it, so it keeps shape through the rest of the work. In heavy material, bulk is cut away honestly: after stitching, trim the under-lapping cloth away above where the stitching stops, and bind the raw edges with a bias strip of lining across the top of each plait. And for gored skirts with side or inverted plaits set into seams partway up — the ancestors of the modern kick plait — Butterick names the classic failure: the plait sags below the hem because nothing holds its top. The cure is a stay: a tape or lining strap sewn from plait top to plait top around the inside of the skirt, with a diagonal stay to the next seam in heavy woolens.

**Tucks** get the same discipline. Cut a cardboard gage notched for tuck width and space — quicker and more accurate than reading a tape measure a hundred times. Curved tucks are sewed on a curved line, which makes the under side fuller than the upper; ease that surplus evenly as you sew or the tuck twists.

The pattern behind everything in this lesson: cloth moves — bias stretches, hems crowd, plaits sag — and the maker's job is to let it finish moving, or stay it, before the garment ships. A leveled, stayed, evenly pressed skirt reads as quality at ten paces, which is exactly where customers first see it.`,
    checkpoints: [
      {
        q: "A circular skirt hangs weighted for two or three days before hemming so that…",
        options: [
          "the bias finishes stretching before the hem is leveled",
          "the color sets evenly",
          "the waistband relaxes",
        ],
        answer: 0,
      },
      {
        q: "Inlaid plaits set into seams partway up a skirt are kept from sagging by…",
        options: [
          "a tape or strap stay sewn from plait top to plait top inside",
          "heavier hem allowance",
          "starching the folds",
        ],
        answer: 0,
      },
      {
        q: "Pressing a circular hem over a slip of muslin…",
        options: [
          "keeps the shrunken gathers from printing marks on the right side",
          "adds body to the hem",
          "speeds the iron's heating",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Pockets: patch, slashed, bound and welted",
    minutes: 10,
    source: { label: "Butterick, pockets", url: "https://archive.org/details/newdressmakerwit00butt" },
    bodyMd: `Butterick's pocket chapter is a short course in cutting holes in finished cloth on purpose — the most nerve-testing operation in dressmaking, and the most rule-bound.

**The patch pocket** is the honest one: a shaped patch sewed to the outside on three sides, its open edge hemmed, faced or trimmed to suit the garment. The book's whole doctrine for it is one word — *neatness* — because every edge is on display. Turn, baste, press, then stitch.

**The slash pocket** lives inside the garment with only a slit showing. Its sequence never varies. Mark the opening with tailors' tacks and a line of colored basting that shows on both sides. Baste a facing of self-material — about 3 inches (7.5 cm) wide, an inch (2.5 cm) longer than the opening — face down over the line on the right side. Stitch a row 3 mm each side of the line, tie the thread ends so nothing can pull out, then cut the slit through facing and garment with one clean stroke of a sharp knife. Push the facing through and rebaste it so it forms a little **head** — a corded lip about 3 mm deep — at each edge of the opening. The pocket bag itself is cut from strong cotton or drill, about 12.5 inches (32 cm) long, slipped in behind, stitched, and closed up the sides. The ends of the opening, where every pull concentrates, are finished with an **arrowhead** or bar tack — the small embroidered triangle that is really a structural reinforcement wearing a decoration's clothes.

**The bound pocket opening** is the dressmaker's version: a bias strip of self or contrasting material about 1¼ inches (3 cm) wide, stitched each side of the marked line, cut, and pushed through to bind the slit with a 3 mm edge on each lip — a bound buttonhole grown up. Slip-stitch the corners so they cannot fray; corners are where a bound opening dies. The pocket sections behind it are cut of satin or lining, and the under section is *faced with garment material* for 3 inches (7.5 cm) below the opening — so that what shows when the pocket gapes is self-fabric, not lining. That facing is pure Picken-style perfection: invisible until the exact moment it matters.

**The pocket with a lap** (the in-and-out lap of tailored garments) finishes the lap completely first — grain and stripe matched to the garment beneath, edges double-stitched, lined with silk slip-stitched on — and only then is it set face down on the opening line and built in. In checks, stripes and plaids the lines of the lap must match the lines of the garment; a mismatched lap is the loudest quarter-inch in tailoring.

**The welt pocket** stands its lap upright. The welt is interfaced with an interlining cut a shade smaller, its edges turned over and mitered at the corners, pressed, and laid *below* the opening line. The opening is cut to within 3 mm of the ends, then diagonally to the stitching at each corner, forming the little triangles that let everything turn cleanly. The pocket sections go through, the welt turns up to cover the mouth, its ends are blind-sewn, and the corners are bar-tacked. Depths are specified like engineering: a breast pocket about 3½ inches (9 cm), a lower pocket about 5 inches (13 cm).

Across all five constructions the constants are the same: mark twice and cut once, with basting that shows on both sides; stitch *before* you cut so the geometry cannot shift; and reinforce both ends of every opening, because a pocket is a placket that carries keys. For a studio, pockets are also a selling detail — a dress with real, faced, bar-tacked pockets photographs and fits like tailoring, and customers notice before they can say why.`,
    checkpoints: [
      {
        q: "In a slash or welt pocket, you stitch each side of the marked line before cutting because…",
        options: [
          "the stitching fixes the geometry so nothing shifts when the slit is cut",
          "it is faster than cutting first",
          "the knife needs a guide rail",
        ],
        answer: 0,
      },
      {
        q: "The under pocket section of a bound opening is faced with garment material so that…",
        options: [
          "self-fabric, not lining, shows if the pocket gapes",
          "the pocket is stiffer",
          "the lining costs less",
        ],
        answer: 0,
      },
      {
        q: "The arrowhead or bar tack at a pocket's ends is…",
        options: [
          "a structural reinforcement at the stress points, dressed as decoration",
          "purely ornamental",
          "a maker's signature mark",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Belts, casings and the waist-line joining",
    minutes: 9,
    source: { label: "Picken, Perfection in Details, waist-line joinings", url: "https://archive.org/details/DressmakingPerfectioninDetails" },
    bodyMd: `The waistline is where a dress carries its load and hides its engineering. Two books split the subject: Butterick handles belts and casings, Picken the joining of blouse to skirt.

**Belts, per Butterick.** A belt may be cut double with the edges turned in toward each other and stitched, or in two portions seamed face to face on three sides, turned, and slip-stitched closed. The fastening rule is oddly memorable: a belt of average width takes **three** hooks and eyes — number eight hooks, sewed through the rings and over the bill, a quarter inch (6 mm) in from the edge, with the eyes extending just past the opposite end. With only two, a belt of ordinary width *bulges at the center*. Three points define a straight line under strain; two invite a gape.

**Casings.** Where the waist (or knee, or ankle) must stay comfortable rather than fitted, a **casing** — a flat tunnel of cloth carrying an elastic or drawstring — replaces the belt. It can be a hem stitched on both turned edges, or an applied strip sewed flat along both edges. If the garment fabric would make a clumsy casing (a heavy mohair serge, say), cut the casing of strong silk or lining instead: the casing serves the elastic, not the fashion fabric. A belt casing is simply a double belt cut a little larger than the waist, ends left open, elastic run through to regulate the fullness.

**The waist-line joining, per Picken.** When blouse and skirt are cut separately and joined, the join is where evenness is won or lost, and her method is all about *halves*. Gather the blouse's lower edge with two rows — the first on the seam line, the second just below — but gather each half separately, center front to center back, breaking and knotting the thread at the back. Two threads mean each side adjusts independently and no fullness migrates around the body. Gather the skirt the same way. Then fit on the figure: draw up, pin, and check that center front, center back and under-arm lines all hang *vertically* in their correct positions, with the fullness between them distributed so nothing pulls or bunches. If a side seam refuses to hang plumb, she says plainly: unpin it and redistribute — do not hope.

Where blouse opens at front and skirt at the side, the fullness is held by **stay strips** pinned over the gathers before the dress comes off the figure — a narrow strip over the skirt fullness, a wider one, about 2 inches (5 cm), turned and folded over the waist fullness to form a wide binding. One row of stitching then secures skirt to waist and binding to blouse in a single pass, with the facing hemmed by hand below. The strips do for a soft dress what the boned inside belt does for a structured one: they make the waistline a *measured, stayed length* instead of a hopeful ribbon of gathers.

> **Term note:** A *stay* is any tape, strip or belt sewn inside to hold a measurement against strain — the waistline's quiet skeleton.

Two more of her cases: for children's clothes, blouse and skirt join in a plain seam with a narrow straight cotton tape stitched into it as a stay, edges overcast. And when the joining must fit very tightly, do not trust a row of stitching at all — set a narrow belt *between* blouse and skirt, cut double (an outside and a lining), seaming each garment edge into it. The tight waist rides on the belt; the fashion fabric just comes along.

For your studio the takeaway is a habit: every waistline in the tech pack should name its stay — tape, strip, binding or inner belt — the same way a lining names its problem. Gathers are a design; the stay is the reason they still measure the same in a year.`,
    checkpoints: [
      {
        q: "A belt of ordinary width fastens with three hooks and eyes because…",
        options: [
          "with only two, the belt bulges at the center",
          "three is decorative tradition",
          "hooks are sold in threes",
        ],
        answer: 0,
      },
      {
        q: "Picken gathers each half of the waist separately, center front to center back, so that…",
        options: [
          "fullness cannot migrate and each side adjusts independently",
          "the thread is shorter",
          "the machine can sew faster",
        ],
        answer: 0,
      },
      {
        q: "A very tight waist-line joining should be…",
        options: [
          "carried on a narrow double belt set between blouse and skirt",
          "sewn with a single row of stitching",
          "left unstayed to stretch in wear",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Bias trimmings: folds, cording and piping",
    minutes: 10,
    source: { label: "Butterick, bias trimmings", url: "https://archive.org/details/newdressmakerwit00butt" },
    bodyMd: `Butterick's bias-trimmings chapter is the toolbox behind Picken's finishing doctrine: nearly every "detail" that distinguishes a dress — the piped seam, the corded edge, the neat contrast band — starts as a bias strip.

**Folds and bands.** The unlined fold is the economy model: its lower edge is hemmed up and stitched from the right side, its upper edge turned and stitched *through the garment*, so one stitching does two jobs — attaching and finishing. The lined fold is built first — a strip of lining cut to the finished width, the material's edges turned over it and catch-stitched — then applied as a finished object. Double folds are cut twice the finished width plus turnings, folded, edges turned in and slip-stitched; they often stand in for tucks. The milliners' fold rolls its own raw edge inside itself. Two workroom refinements: in very sheer material, slide a slip of paper inside the fold as you sew so the layers cannot crawl, and cut crepe folds on the *straight* grain so the crinkles run diagonally across the finished fold.

**Grain is chosen, not assumed.** Tailors' straps — the folded bands that strap seams on tailored garments — are cut on the bias for velvet or taffeta, crosswise for woolens, lengthwise for cottons. The grain of a trimming is a decision about how it will bend, press and catch the light.

**Cording.** Cut bias strips about 1¼ inches (3 cm) wide, fold, and seam 6 mm from the fold to make a tube. Then the period's charming trick: anchor several strands of soft Germantown or eiderdown wool in one end, and with the loop of a wire hairpin push the wool deeper and deeper into the tube while turning the tube right side out around it. For corded motifs, stamp the design on wrapping paper, baste the cording to it seam-side up, and sew the crossings — the paper is a temporary loom. A corded tuck simply folds the garment cloth over a cord and sews close against it with fine running stitches.

> **Term note:** *Piping* is a folded bias strip caught into a seam or along an edge so only a thread-fine line of it shows; *cord piping* runs a cord inside the fold first. It is the cheapest signature in dressmaking — a seam you were sewing anyway, wearing a line of color.

**Piping.** Cut the bias 1¼ inches (3 cm) wide for firm silks like taffeta, a trifle wider for loose weaves. Join all strips first, press the seams open, fold along the center, and baste flat without letting the strip twist — the chapter repeats *do not twist* like a drumbeat, because a twisted bias never lies down again. On a shaped or scalloped edge, turn the garment edge, clipping at corners and folding in at points, run a guide basting an even 1 cm from the edge, and baste the piping to that line, avoiding scantiness at points and bagginess at corners.

**Bias bindings** here get the same arithmetic as at the neckline: twice the finished width plus a seam each edge, sewn to the right side, turned, and hemmed to the first line of sewing. Or, for a visible hand finish, turn the binding to the *right* side and hold it with long running stitches in contrasting embroidery silk — trimming and attachment in one.

**The rolled hem** finishes the family: allow 1½ inches (4 cm), fold to the right side, stitch 6 mm from the fold, turn the raw edge under and hem over the stitches on the wrong side. Two laws: it belongs on straight edges only, never curved; and the finished hem must look *round like a cord, not flat*. A rolled hem pressed flat is a rolled hem wasted.

Every technique in this chapter is priced in minutes and read in seconds. Pick one — a self-piping, a corded edge, a milliners' fold — and make it a house signature; repetition is what turns a trimming into a brand.`,
    checkpoints: [
      {
        q: "A finished rolled hem should…",
        options: [
          "look round like a cord, and be used on straight edges only",
          "be pressed as flat as possible",
          "be used mainly on curved edges",
        ],
        answer: 0,
      },
      {
        q: "Cording is filled by…",
        options: [
          "pushing soft wool through the bias tube with a hairpin loop while turning it right side out",
          "stuffing after both ends are sewn shut",
          "threading wire through the fold",
        ],
        answer: 0,
      },
      {
        q: "Crepe folds are cut on the straight grain so that…",
        options: [
          "the crinkles run diagonally across the finished fold",
          "less fabric is wasted",
          "the fold stretches more",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Buttonholes worked, bound and looped",
    minutes: 10,
    source: { label: "Butterick, buttonholes, buttons and loops", url: "https://archive.org/details/newdressmakerwit00butt" },
    bodyMd: `Butterick opens the chapter with a sentence every maker should frame: a well-made garment that is otherwise perfect may be greatly injured in appearance by badly made buttonholes. The closure row is the garment's spine in a photograph — and the hardest detail to fake.

**Before the scissors.** Buttonholes are spaced and marked *before* they are cut: mark the top and bottom holes, divide the distance between into even spaces. Cut on the thread of the goods wherever possible, and cut generously — a buttonhole tightens as it is worked. Use buttonhole scissors and make the slit in one clean stroke; a ragged slit is the most visible fault in the finished hole, and it comes from dull scissors or shifting cloth. The cure for shifting is to baste around the cutting line first.

**Three worked buttonholes.** The **barred buttonhole**, with a bar tack worked across each end, serves underwear, waists and shirts — anywhere the hole sits upright in a plait or the strain does not land on an end. The **round-end buttonhole** answers strain that comes at one end, as on a cuff or belt: the rounded end gives the button a resting place, with a bar at the inner end only. The **tailors' buttonhole** is the round-end grown up for heavy cloth: a small eyelet is cut at the outer end for the button's shank, and the whole hole is worked over a taut cord — several strands of twist, or gimp — held under tension so the finished edge stands firm and distinct, the stitches at the eyelet radiating like the spokes of a wheel. All three are **stranded** first: a thread laid along each edge of the slit and anchored, so the edges cannot stretch as the purl stitches are worked over them. Finished buttonholes are basted closed, pressed under a damp cloth, and — for the tailors' hole — a stiletto is pushed up through each eyelet while still damp until the ring of stitches sits perfectly round.

> **Term note:** The *purl* is the tiny knot the buttonhole stitch throws exactly on the cut edge; a row of even purls is the visible difference between a worked buttonhole and an overcast slit.

**The bound buttonhole** trades thread for cloth: a bias strip of self or contrasting material about 2.2 cm wide, sewn 3 mm each side of the marked line, the hole then cut clean and the strip pushed through to bind each lip. Slip-stitch the corners so they cannot fray. It suits wool, silk, linen or cotton, and in a contrasting color it is a deliberate design line — the same geometry as the bound pocket opening, at buttonhole scale.

**Loops and their relatives.** A **loop buttonhole** is a strip of finished bias piping, corded or not, curved to slip over its button, the raw ends tacked between an edge and its facing — or to the back of the button itself. A *simulated* buttonhole is the same piping folded in half, its ends drawn through to the wrong side with a stiletto and tacked: closure as pure costume. **Eyelets** — for cords or laced closings — are pierced with a stiletto, ringed with running stitches, and worked over in buttonhole stitch.

**Buttons.** Sew them with a coarse single thread rather than a fine double one — it wears longer and never tangles into a false shank. To place them, lap the closing exactly and push a pin through at the outer end of each buttonhole; the pin's point marks where each button belongs. Placement is measured off the *buttonhole*, never guessed off the edge.

The through-line of the chapter: every closure is built for where its strain lands — bars where strain crosses, round ends where it pulls, cord where cloth is heavy, binding where thread would look thin. Choose the buttonhole the way you choose a seam: by the forces, then by the look.`,
    checkpoints: [
      {
        q: "A round-end buttonhole is used where…",
        options: [
          "the strain comes at one end and the button needs a resting place",
          "the cloth is transparent",
          "no strain ever occurs",
        ],
        answer: 0,
      },
      {
        q: "Buttonholes are stranded before working so that…",
        options: [
          "the cut edges cannot stretch as the stitches are worked",
          "the slit shows more clearly",
          "less thread is needed",
        ],
        answer: 0,
      },
      {
        q: "Buttons are placed by…",
        options: [
          "lapping the closing and pinning through the outer end of each buttonhole",
          "measuring from the hem upward",
          "eye, after the buttonholes are cut",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "The fabric guide: testing cloth before you buy",
    minutes: 11,
    source: { label: "WI Sewing Materials, purchasing tests", url: "https://archive.org/details/sewingmaterialsd00woma" },
    bodyMd: `The Institute's *Sewing Materials* booklet ends each fiber chapter the same way: with tests you can run at the counter, because in 1923 the label could not be trusted and the swatch could. A century later the fiber-content label exists — and deadstock, vintage and market-stall fabric shopping still runs on exactly these tests.

**Cotton: the dressing problem.** Cotton is cheap enough that it is rarely adulterated; instead, an inferior cloth is made to *feel* better by loading it with **dressing** — starch and filler pressed into the weave. Hold thin cotton up to the light and the starch shows between the threads; rub it between the hands and the dressing powders out, revealing the real cloth. The convincing test is to wash a sample and compare it with the original — a dressed cotton loses weight and firmness in the first laundering. Test color two ways: fastness to light (cover half a sample with cardboard, expose the rest to sun for several days) and **crocking** — rub a dark sample briskly on white cotton; properly dyed cloth leaves no color behind. And untwist a thread: fibers of half an inch (1.3 cm) or more wear well, short fluff does not.

**Linen: the impostor's fiber.** A starched, glossed cotton imitates linen well enough that the book admits only a microscope settles it — but the counter tests come close. Press a dampened finger to the wrong side: linen's absorbency takes the moisture straight through; cotton's frayed surface fibers drink it first. Break a thread: cotton snaps easily with fuzzy, tufted ends; linen breaks hard, with an uneven, drawn-out break. A drop of glycerine turns unsized linen translucent and leaves cotton opaque.

**Wool: feel, weave and shoddy.** Ravel a corner: wool fiber is *kinky* where substitutes lie straight, and a wool thread pulls apart rather than snapping. Train your hand — pure wool feels soft, a cotton mixture harsh and stiff; the book says plainly that this ability comes only from handling cloth. Judge the weave against the light: threads that separate and show daylight when pulled will not hold shape, and cords or ribs running one way only are weaker than ribs running both. Then the era's most misunderstood word: **shoddy** — reclaimed wool, shredded from old cloth and respun. The book defends it: good shoddy, cut from new tailors' clippings, makes genuinely serviceable cloth. The sin is not reclaimed fiber; it is undisclosed reclaimed fiber sold as new — a sentence that could headline a recycled-textiles policy today.

> **Term note:** The *selvage* is the woven self-edge of the cloth, running parallel to the **warp** (the lengthwise threads); the **weft** crosses it. Tests that pull "warp and weft" are checking that the two systems are matched in strength — unbalanced cloth splits along its weaker thread.

**Silk: the burn test.** Pull a thread each of warp and weft and put a match to them. Pure silk melts, bubbles along the burned edge, and smells of burning hair or feathers. **Weighted silk** — silk loaded with metallic salts to sell water-weight as fiber — betrays itself by holding its shape and *glowing* rather than melting. Rayon flashes quickly and leaves no ash; cotton smolders and smells of burning leaves. Back at the counter: crush the goods in the hand and draw a fingernail diagonally across — a cloth that stays crushed or whose threads spread will not wear. Hold it to the light and look for pinholes, the scars of the weighting salts. Buy on quality of fiber, never on weight of hand. For velvet, press a finger into the pile: all-silk pile brushes up and forgets the print; cotton pile remembers it.

For your studio, this lesson is the buying half of the materials literacy your BOM practical documents: a fabric library entry is only as good as what you verified when the cloth came in. A burn-test scrap stapled to the record card is one minute of work and the difference between a library and a rumor.`,
    checkpoints: [
      {
        q: "In the burn test, pure silk…",
        options: [
          "melts and bubbles, smelling of burning hair or feathers",
          "flashes instantly and leaves nothing",
          "smolders like burning leaves",
        ],
        answer: 0,
      },
      {
        q: "Weighted silk reveals itself in the burn test by…",
        options: [
          "holding its form and glowing instead of melting",
          "burning faster than pure silk",
          "refusing to burn at all",
        ],
        answer: 0,
      },
      {
        q: "The Institute's view of shoddy is that…",
        options: [
          "good reclaimed wool makes serviceable cloth — the sin is selling it undisclosed",
          "any reclaimed wool is worthless",
          "shoddy is stronger than new wool",
        ],
        answer: 0,
      },
    ],
  },
];

export const S3_MORE_QUIZ: QuizQuestion[] = [
  { id: "s3q15", q: "Neckline bindings are cut on the true bias because…", options: ["bias is slightly elastic and conforms to the curve", "bias frays less", "bias is easier to press flat"], answer: 0 },
  { id: "s3q16", q: "The ease in a set-in sleeve cap should be…", options: ["lost over the top, with no visible fullness", "gathered into one point at the shoulder", "trimmed away before basting"], answer: 0 },
  { id: "s3q17", q: "Before hemming, a circular skirt is hung with weights for two or three days so that…", options: ["the bias stretches fully before the hem is leveled", "the fibers relax the dye", "the waist seam settles"], answer: 0 },
  { id: "s3q18", q: "A round-end buttonhole belongs where…", options: ["strain pulls at one end and the button needs a resting place", "no strain occurs", "the cloth is sheer"], answer: 0 },
  { id: "s3q19", q: "A belt of ordinary width takes three hooks and eyes because…", options: ["with only two it bulges at the center", "three spread the sewing time", "hooks come carded in threes"], answer: 0 },
  { id: "s3q20", q: "In the burn test, weighted silk…", options: ["keeps its form and glows instead of melting", "melts into bubbles like pure silk", "flashes and vanishes like rayon"], answer: 0 },
];
