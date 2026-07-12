import type { Lesson, QuizQuestion } from "./types";

// Expansion lessons for S1 · Stitches and Seams — appended after the
// original four (progress is keyed by lesson index, so append-only).
export const S1_MORE_LESSONS: Lesson[] = [
  {
    title: "The workbasket: needles, thread and honest tools",
    minutes: 9,
    source: { label: "WI Essential Stitches, Sewing Materials and Tools", url: "https://archive.org/details/cu31924105503068" },
    bodyMd: `Before the Woman's Institute taught a single stitch, it taught the workbasket — because the wrong needle or thread quietly ruins good hands. A century on, the sizing systems it explained are the ones still printed on the packets.

**Needles.** Hand-sewing needles run from No. 1, the coarsest, to No. 12, the finest; the Institute recommended buying a **paper** (a mixed packet, usually twenty-five needles) of Nos. 5 to 10 for a working assortment. The families still matter:

- **Sharps** — long and slender; the general-purpose needle.
- **Betweens** — short and thick; fine control in heavy work (today they are sold as quilting needles).
- **Milliners' needles** — very long; the dressmaker's basting needle, because a long needle picks up a whole row of basting stitches at once.
- **Crewel and darning needles** — long eyes for embroidery floss and darning wool; **bodkins** — blunt, for threading tape and cord through casings.

Cheap needles break, blunt and drag through cloth; the Institute was blunt about it, and it is still true.

**Thread.** Cotton thread was numbered from 8 to about 200, and sewing silk lettered from E down to 000 — and here is the trick to reading every vintage pattern: **the higher the number, the finer the thread; the lower the letter, the finer the silk.** The Institute's table matched all three to the cloth. Very sheer lawns and organdies took 100 to 150 cotton on a No. 9 or finer needle; general shirtings and muslins took 60 to 80 cotton on a middling needle; heavy woolens took 36 to 40 cotton and a stout one. The rule beneath the table is the permanent lesson: **needle and thread must be in proportion to each other and to the material.** A fine thread in a coarse needle chafes and breaks; a coarse thread in a fine needle strains the machine and the cloth.

**Basting cotton** was made on purpose with a hard, glazed finish so that it breaks easily and pulls out without embedding — which is exactly what you want from a temporary stitch, and why you should not baste with your good sewing thread. **Buttonhole twist**, a heavier silk, was kept for worked buttonholes and sewing on buttons.

**The tools.** A **thimble** (sizes 6 to 11) belongs on the middle finger of the sewing hand, snug enough to stay, loose enough not to pinch — the Institute called it a wonderful aid, not an affectation, and hand sewing without one is slower and sorer. **Scissors** are under 6 inches (15 cm) with matching handles, for snipping at the machine; **shears** are 6 inches and longer — 7 or 8 inches (18–20 cm) for cutting out — with a big bow handle that takes several fingers so long cuts stay even and the hand does not tire. Left-handed shears existed then and exist now; use them if you are left-handed. **Buttonhole scissors** carry a little screw that sets the length of the cut so every buttonhole in a row is identical. Buy sharp, fine **pins**: cheap blunt pins pull threads in sheers and punch holes that never close.

> **Term note:** an **emery bag** is the little strawberry stuffed with abrasive emery powder that lived in every workbasket. A needle that squeaks, drags or has roughened is stabbed through it a few times and comes out polished. They are still sold, still strawberry-shaped.

None of this is nostalgia. A studio that matches thread weight to cloth, bastes in breakable glazed cotton, and cuts with real shears produces visibly better seams than one that runs all-purpose polyester through everything — and now you know how to read the numbers.`,
    checkpoints: [
      {
        q: "In period cotton-thread sizing, a higher number means…",
        options: ["a coarser thread", "a finer thread", "a longer spool"],
        answer: 1,
      },
      {
        q: "Shears differ from scissors in that they are…",
        options: [
          "6 inches or longer with a large bow handle, for cutting out",
          "always left-handed",
          "used only for buttonholes",
        ],
        answer: 0,
      },
      {
        q: "A thimble is worn on…",
        options: ["the thumb", "the middle finger of the sewing hand", "the little finger"],
        answer: 1,
      },
    ],
  },
  {
    title: "The sewing machine: tension, stitch length, control",
    minutes: 10,
    source: { label: "WI Essential Stitches, Care and Use of the Sewing Machine", url: "https://archive.org/details/cu31924105503068" },
    bodyMd: `The Institute's machine chapter was written for a treadle-powered **lock-stitch machine**, and here is the quietly astonishing thing: everything it says about the stitch itself is true of the computerized machine on your table, because the stitch has not changed since Elias Howe made it practical in 1846.

**How the stitch works.** Two threads: the needle thread from the spool, and the under thread from the **bobbin** (the period books also say **shuttle**, after the boat-shaped carrier that held it). At every stitch the needle carries its thread down through the cloth, and the loop it forms is locked around the bobbin thread. A correct stitch is locked **in the middle of the layers** — neither thread visible as a straight line on either face.

**Reading the tension.** This gives you a complete diagnostic, straight from 1922:

- Needle thread lying **straight along the top**, with the bobbin thread pulled up into it — upper tension too tight, or bobbin tension too loose.
- Thread lying **straight along the underside** — the reverse: bobbin too tight or upper too loose.
- Both tight — the seam **puckers** and draws.
- Both loose — little **loops** on one face or the other.

The Institute's rule: correct almost everything with the **upper tension** and leave the bobbin tension alone once it is right — and always **test on a scrap of the actual cloth** before you sew the garment. That habit, thirty seconds per fabric change, prevents most machine grief.

**Stitch length** is nothing mysterious: it is how far the **feed** (the toothed plate under the cloth) advances the work between needle strokes. Shorten the stitch for sheer and fine cloth, lengthen it for heavy — the same proportion rule as hand needles and thread.

**Handling.** Three period disciplines that still mark a trained machinist:

1. **Corners:** stop with the needle down in the cloth exactly at the corner, lift the presser foot, pivot the work around the needle, lower the foot, sew on. Square corners every time.
2. **Bias against the feed:** when a bias edge is sewn to a straight edge, put the **bias side down** toward the feed and the straight edge up under the presser foot. The feed eases the stretchy layer along while the foot holds the stable one — the machine does your easing for you.
3. **Never pull the cloth.** The feed advances the work; hands only guide. Pulling bends needles, scars the needle plate, and stretches seams. If the machine will not feed, something is wrong — fix that instead.

**When it misbehaves**, the Institute's troubleshooting list is still the order to check things in. Skipped stitches: needle blunt, bent, set in wrong, or too fine for the thread. Needle thread breaking: rethread first (most 'broken machines' are mis-threaded machines), then look at too-tight tension, thread too coarse for the needle, poor thread. Puckering: tensions too tight, or presser-foot pressure wrong for the cloth. Running heavily: lint and dirt in the works, or dry bearings — brush the lint out of the bobbin area and oil what your manual says to oil. Notice the pattern: **the machine is almost never broken; the needle, thread, threading or tension is.** The Institute told its students plainly that when the work is poor the fault is usually the operator's — kinder than it sounds, because everything on the list takes a minute to fix.

> **Term note:** a **chain-stitch machine** used a single thread looped into a chain on the underside — light-running but it unravels from the end, which is why every row had to be fastened off. The chain stitch survives today on the hems of your jeans and in your serger, and it still unravels exactly the way the 1922 book warns.`,
    checkpoints: [
      {
        q: "A correctly tensioned lock-stitch locks…",
        options: [
          "on top of the cloth",
          "in the middle of the layers, invisible from both faces",
          "on the underside of the cloth",
        ],
        answer: 1,
      },
      {
        q: "To turn a square corner by machine…",
        options: [
          "stop with the needle down, lift the foot, pivot on the needle",
          "pull the cloth around while sewing",
          "sew past the corner and fold back",
        ],
        answer: 0,
      },
      {
        q: "Sewing a bias edge to a straight edge, the bias side goes…",
        options: ["up under the presser foot", "down toward the feed", "it makes no difference"],
        answer: 1,
      },
    ],
  },
  {
    title: "Before the scissors: grain, nap and shrinking the cloth",
    minutes: 10,
    source: { label: "Butterick, ch. 6 Materials, Sponging, Cutting", url: "https://archive.org/details/newdressmakerwit00butt" },
    bodyMd: `Butterick put a whole chapter before the cutting chapter, because most cutting disasters happen before the shears open. Three questions to settle about any cloth: which is the right side, will it shrink, and which way does it run?

**Finding the right side.** In double-folded goods the right side is folded inside, protected from shop wear. When the faces look alike, the **selvedge** (the woven self-edge) is usually smoother on the right side; and in serge and other twills, the diagonal lines run downward from left to right on the right side. Mark the wrong side of every piece with chalk the moment you decide — arguments with yourself later are how half-shaded garments happen.

**Sponging** is the period word for pre-shrinking wool. The reasoning is airtight: if you do not shrink the cloth before making it up, it will shrink the first damp day *inside your finished garment*, puckering every seam. The home method: lay the wool face down, cover it with unbleached muslin wrung out of cold water, roll cloth and muslin together tightly, leave the roll overnight, then press the cloth dry on the wrong side as you unroll. Clip or trim the selvedge first so it cannot draw. Heavier cottons and linens that will be laundered get shrunk the same way. Two exceptions the book insists on: plush-like wools (velours, duvetyn) are **steamed**, not sponged — an iron held so it barely kisses a damp cloth, never resting — and crisp sheers (organdy, voile, Swiss) are not shrunk at all, because shrinking kills exactly the crispness you bought them for. The modern translation: pre-treat every fabric the way the finished garment will be cleaned, before you cut.

**Nap and pile.** Velvet, velveteen, corduroy, plush and napped wools like broadcloth change shade with direction, because the light strikes the pile differently up and down. So every pattern piece must be laid **the same way**. Which way? Run your hand along the cloth: rough means the pile is running up, smooth means down. Cut true pile fabrics (velvet, corduroy) with the **pile running up** the garment — the pile stands open and shows its full depth of color. Cut **broadcloth nap down**, or it roughens and wears woolly; flattened **panne** velvet also runs down. Get one piece backwards and the garment looks sewn from two dye lots.

**Stripes, plaids and figures.** Decide first which line or motif sits at center front and center back. Match the crosswise bars at the underarm seam so front and back read as one cloth around the body. For a gored skirt, cut the front, then lay the cut piece beside the uncut cloth and slide the next gore's pattern until the plaid matches — gore by gore, even when it wastes cloth. It always wastes cloth: **buy extra for plaids**, then as now. Flowers and figures with an up and a down must all run the same way.

**Handling the delicate ones.** Fine steel pins or needles only, in silk, chiffon and velvet — ordinary pins leave permanent holes and scars. Baste silks with silk thread; cotton basting prints marks. When chiffon or crepe de Chine puckers under the machine, stitch it over a strip of tissue paper and tear the paper away afterwards — a trick factories still use. On fray-prone cloth, allow an extra quarter inch (6 mm) on ordinary seam edges, and overcast the cut neck and armhole edges as soon as the piece leaves the shears, before handling frays them to nothing.

> **Term note:** **sponging** = pre-shrinking wool with damp cloths; **nap** is a brushed-up surface, **pile** a woven-in upright one — the cutting rule treats them alike.`,
    checkpoints: [
      {
        q: "Wool is sponged before cutting because otherwise…",
        options: [
          "it frays in the machine",
          "it will shrink the first damp day, inside the finished garment",
          "the dye rubs off",
        ],
        answer: 1,
      },
      {
        q: "Velvet is cut with the pile running…",
        options: ["up, so the color shows its full depth", "down, like broadcloth", "crosswise"],
        answer: 0,
      },
      {
        q: "The book's advice for buying plaid cloth is…",
        options: ["buy exactly the pattern amount", "buy extra — matching wastes cloth", "avoid plaids entirely"],
        answer: 1,
      },
    ],
  },
  {
    title: "Tucks and plaits: fullness folded flat",
    minutes: 9,
    source: { label: "Butterick, ch. 20 Tucks and Plaits", url: "https://archive.org/details/newdressmakerwit00butt" },
    bodyMd: `A **tuck** is a stitched fold; a **plait** (the period spelling of *pleat*) is a pressed one. Both are ways of holding fullness flat and both live or die on one virtue: evenness. Butterick's chapter is short and ruthless about how evenness is actually achieved.

**The gauge.** Tucks are never measured by eye, and — surprisingly — not by tape measure either. Cut a **gauge** from a strip of cardboard: from one end, measure down the width of the tuck and cut a small notch; measure on and cut a second notch for the space plus the next tuck. Working with this notched card is quicker *and more accurate* than a tape, the book says, because eyes blur among the little marks on a tape and one mis-read ruins a whole panel. Every tuck on the piece is then struck from the same physical object. That is factory thinking in 1921, and it is still how you should mark repeated measurements — hems, tuck spacing, buttonhole intervals.

**Nun's tucks** are wide ones, 2 inches (5 cm) or more, often marching around a skirt near the hem. The wider the tuck, the harder it is to keep tuck and spacing true, especially on a curved hem — so wide tucks are marked and basted before any stitching.

**Curved tucks** hide a genuinely interesting problem: a tuck sewn on a curve has an under side that must be *fuller* than its upper side. Mark the fold with tailor's tacks or pins, baste close to the folded edge, mark the depth with your gauge — and then, as you sew, **ease the extra fullness along the under side**, distributed evenly so it never bunches or drags the fold out of line. It is the curved-hem lesson from earlier in this course wearing different clothes.

**Cross tucking** — tucks run in one direction first, then crossed by tucks of exactly the same size and spacing — must form **perfect squares** where they meet; that is the whole effect. **Pin tucks** (the tiniest tucks) spaced about an inch (2.5 cm) apart make the daintiest version, still a signature of fine blouses and christening gowns.

**Plaits** get four working rules:

1. **Lay plaits before the seams are joined** where you can, and stitch them with at least one seam still open — a skirt off its belt, spread open and flat, is controllable under the machine; a closed tube is not.
2. As each plait is pressed flat, **baste it a little way in from the fold** to hold its shape while you keep working on the garment.
3. Where a plait's stitching stops partway down, **tie the thread ends** securely on the wrong side — an unfastened stitching line at a stress point is a rip waiting to happen.
4. In heavy cloth, **cut away the underlap** above where the stitching ends and bind the raw edges with a bias strip or seam binding. A plaited wool skirt loses remarkable bulk at the hip this way and hangs cleaner.

Plaits let into seams partway up a skirt tend to sag below the hem, and the book's fix is quietly clever: bind the plait tops and run a **stay tape** from plait top to plait top around the inside of the skirt so they carry each other.

Finally, plaits only exist when pressed: skirt wrong side out over the board, plaits pinned flat, a damp cloth pressed until dry. The crease from a proper damp-press is what survives wearing and cleaning.

> **Term note:** **plait** is pronounced and means *pleat*; an **inverted box plait** is two folds meeting face to face — the back-vent pleat on most skirts today.`,
    checkpoints: [
      {
        q: "Butterick marks tuck widths with…",
        options: ["a notched cardboard gauge", "the eye, checked afterwards", "chalk dots only"],
        answer: 0,
      },
      {
        q: "In a curved tuck, the extra fullness is…",
        options: [
          "trimmed away",
          "eased evenly along the under side as you sew",
          "gathered onto a cord",
        ],
        answer: 1,
      },
      {
        q: "Plaits are stitched with one seam left open because…",
        options: [
          "thread is saved",
          "the work lies open and flat under the machine",
          "the belt must go on first",
        ],
        answer: 1,
      },
    ],
  },
  {
    title: "Gathering and shirring: fullness on a thread",
    minutes: 9,
    source: { label: "Butterick, ch. 28 Gathering and Shirring", url: "https://archive.org/details/newdressmakerwit00butt" },
    bodyMd: `Where tucks fold fullness flat, gathering carries it live on a thread. It looks like the simplest thing in sewing, which is why it is so often done badly. Butterick's procedure produces even, durable gathers, and every step earns its place.

**Gathering.** One row of small running stitches — the stitches even, the spaces equal to the stitches or twice their length. Start by bringing the needle up **from the wrong side, so the knot is hidden**, and use a strong thread with a good knot: if the thread snaps or the knot pulls through halfway along a skirt breadth, you start again and the cloth suffers for it. Slide the stitches along the needle rather than pulling the needle out at every stitch. When the row is done, draw the fullness up and **wind the thread around a pin, set upright at the end of the stitching, in a figure 8** — instantly adjustable, completely secure, and unpicked in a second. That pin trick alone will improve your gathering.

**Stroking the gathers.** Drawn-up gathers are a crumple; **stroking** (the book also says *laying*) turns them into neat parallel pipes. Hold the work with your thumb below the gathering thread and draw the **side of the needle** — never the point, which scratches and weakens the threads of the cloth — down beside each tiny pleat, pressing it under the thumb as you go, above the thread as well as below. Stroked gathers set into a band evenly; unstroked ones bunch.

**Two rows of gathers.** Anywhere gathers are sewn to something and must stay put — a skirt into its waistband, a sleeve into a cuff or armhole — gather **twice**: the second row a quarter to three-eighths of an inch (6–10 mm) below the first, its stitches directly in line with the first row's. Double-rowed gathers need no stroking and cannot twist out of position under the presser foot. This is exactly the modern two-row machine-gathering rule; the 1921 book simply did it by hand.

**Gauging, or French gathers**, is for volume that must compress into a small space — a full skirt into a tiny band. The stitches are made long on the right side and short underneath, each successive row with its long and short stitches parallel to the last, all the threads drawn up together and fastened. The fullness stacks into deep, organized flutes. Gauging is the direct ancestor of the pleating done for smocking, and you will recognize it in every full-backed Victorian skirt in a costume collection.

**Shirring** is gathering promoted to decoration: successive rows of gathers left visible on the face. The book's discipline: **mark every sewing line first with colored thread** so the rows are true — doubly important when shirring by machine, which produces crooked rows at speed. The varieties are a small vocabulary of texture: **simple shirring** (parallel rows, the top edge turned in and shirred close to the fold); **tuck shirring**, prettiest on the bias, where each row is sewn through a small fold so the fullness stands out in soft ridges; **cord shirring**, tiny tucks sewn over an enclosed cord from the underside, giving firm ribs; and **scallop or snail shirring**, a zigzag thread across a narrow fold that draws up into a scalloped band.

How much fullness to allow? The book gives working ratios: soft materials such as chiffon want about **three times** the finished length; taffeta and other cloth with more body, about **twice**. Budget the fullness before you cut the strip — you cannot add cloth to a mean ruffle afterwards.

> **Term note:** **stroking** or **laying** gathers = combing the pleats even with the side of a needle; **gauging** = multiple parallel rows drawn up together. Both words still appear in couture and costuming.`,
    checkpoints: [
      {
        q: "Drawn-up gathers are secured by…",
        options: [
          "a knot tied hard at the end",
          "winding the thread around an upright pin in a figure 8",
          "a dab of glue",
        ],
        answer: 1,
      },
      {
        q: "Gathers are stroked with…",
        options: ["the point of the needle", "the side of the needle", "the thimble edge"],
        answer: 1,
      },
      {
        q: "A soft chiffon ruffle wants roughly…",
        options: [
          "one and a quarter times the finished length",
          "twice the finished length",
          "three times the finished length",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Bias trimmings: folds, cording and piping",
    minutes: 9,
    source: { label: "Butterick, ch. 26 Bias Trimmings", url: "https://archive.org/details/newdressmakerwit00butt" },
    bodyMd: `You already know bias binding as an edge finish. Butterick's bias chapter goes further: the bias strip as *trimming* — folds, cords and pipings that draw lines on a garment. Because bias bends without complaint, these trimmings follow any curve the design asks for, and they remain couture's favorite way to add structure you can see.

**Folds** are applied bands, and the chapter grades them by finish:

- The **unlined fold** is the workaday one: the lower edge turned up in a hem and stitched from the right side, the upper edge turned under and stitched down *through the garment* — one row of stitching doing two jobs, attaching the fold and closing its edge.
- The **lined fold** is finished before it touches the garment: a strip of lining cut to the finished width, the fashion-fabric edges turned over it and **catch-stitched** down. It goes on by hand, shows no machine line, and sits with the soft roundness that lined things have.
- The **milliners' fold** is the aristocrat: the top edge turned down half the finished width, then the bottom folded up and over it so the raw edge disappears inside, closed with slip stitches. It is the hat-maker's fold — hence the name — and still the neatest way to finish a soft self-fabric band. In very sheer cloth the book suggests slipping a strip of paper inside the fold as you work, to keep the layers from shifting.
- **Tailors' straps** are narrow folded bands laid over seams on tailored coats — cut bias in velvet or taffeta, crosswise in woolens — pressed open flat and stitched along both edges. Strapped seams are a whole tailoring aesthetic you can still find on vintage motoring coats.

**Cording** is a bias tube with a soft filling. Cut bias strips about 1 1/4 inches (3 cm) wide, fold lengthwise, seam a quarter inch (6 mm) from the fold — then, with the strip still wrong side out, sew soft wool strands to one end and use a loop of wire (a hairpin, says the book; a bodkin or loop turner, say we) to push the filling through **while turning the tube right side out** in the same motion. Made cording can be couched into scrolls and motifs: the design is drawn on paper, the cords basted to it face down, sewn together where they touch, then lifted off the paper as a finished ornament.

**Piping** is cording's disciplined sibling: a filled or flat bias strip caught into a seam so a crisp line beads along the join. A **corded tuck** brings the same idea into the body of the cloth — a cord laid under a fold and enclosed with fine running stitches tight against it, making a raised rib. Cord piping in an edge seam remains one of the highest-value details in dressmaking: cheap in materials, slow in care, unmistakable in the finished garment.

**Ruches** are gathered or plaited strips used as soft trimming, and the chapter's numbers are worth keeping. Cut off the selvedge first — it is stiff and will not gather. A **simple ruche** is a doubled strip gathered through the center. A **three-tuck ruche** starts from strips about seven inches (18 cm) wide folded in thirds and gathered through all layers at once. A **box-plaited ruche** needs a little under **three times** its finished length, is stitched through the center — and is *not pressed flat*: the plaits must stand out from the stitching, or the life of the trimming is ironed out of it. A **quilling** (a simple side-plaited band) wants three times its length too. Edges may be hemmed, **picoted**, pinked, or deliberately frayed — and for fraying, the strip must be cut on the straight, since bias will not fray to a clean fringe. One absolute from the fabric-behavior file: **chiffon is never cut on the bias for these trimmings**; lengthwise or crosswise only. Silks and satins, by contrast, fold softer cut bias or crosswise.

> **Term note:** a **ruche** (from the French for beehive) is any gathered or pleated strip trimming; **quilling** is side-plaiting named for its resemblance to a row of quills; **picot** is a tiny looped or cut edge finish.`,
    checkpoints: [
      {
        q: "The milliners' fold is prized because…",
        options: [
          "it is the fastest fold to machine",
          "its raw edge disappears inside and it closes with invisible slip stitches",
          "it needs no cutting",
        ],
        answer: 1,
      },
      {
        q: "A box-plaited ruche is…",
        options: [
          "pressed hard and flat",
          "left unpressed so the plaits stand out from the stitching",
          "always cut on the bias of chiffon",
        ],
        answer: 1,
      },
      {
        q: "Cording is filled by…",
        options: [
          "stuffing after the tube is finished",
          "drawing soft wool through with a wire loop while turning the tube right side out",
          "machine-sewing the cord on top",
        ],
        answer: 1,
      },
    ],
  },
  {
    title: "Lace and embroidery: joining the delicate things",
    minutes: 10,
    source: { label: "Butterick, ch. 27 Ruffles, Embroidery and Lace", url: "https://archive.org/details/newdressmakerwit00butt" },
    bodyMd: `Lace cannot be seamed like cloth — it has no grain to press, no body to hold a fold — so dressmaking evolved a separate grammar for it. Butterick's chapter is the fullest period statement of that grammar, and heirloom sewers work from the same rules today.

**The pull-thread.** Most lace edgings carry a heavier thread woven along the straight top edge. Find it and you own the lace: drawing the **pull-thread** gathers the lace evenly for a frill, or eases it around a curve so it lies flat instead of cockling. Never gather good lace with a sewn running thread when the maker has given you one for free.

**Whipping on an edge.** To join lace to sheer cloth, roll an inch or two (2–5 cm) of the garment edge tightly between thumb and forefinger, lay the lace right side to right side, and **whip** lace and roll together with small overhand stitches. The rolled edge takes the place of a hem, the join is a soft flexible bead, and nothing raw survives anywhere. Worked in fine thread this is nearly invisible, and it is the signature join of fine lingerie and christening wear.

**Insertion** — lace with two straight edges, made to be set *into* cloth rather than onto an edge — gets a beautifully economical method. Pin and baste the insertion where it is to go, on the right side. If it is narrow, simply **cut the material behind it through the center**; if wide, cut the material away beneath, leaving a small seam each side. Turn each raw edge back in a narrow hem behind the lace and stitch close along both edges of the insertion from the right side, catching the hems as you go. The cloth is whole until the lace is committed — so nothing is ruined by a change of mind — and the finished join is two tidy rows of stitching with no raw edge anywhere. For a straight edge, insertion can instead be caught into a series of narrow hems, row after row, the classic tucked-and-laced blouse front.

**Mitering and shaping.** Lace turns corners by being **mitered**: cut *between the motifs and cords, never across them*, then the edges overhanded together, or lapped and hemmed around the outline of a motif so the join hides inside the pattern. To shape rows of insertion around a curved yoke or collar, work over stiff paper: cut the paper to the finished shape, baste the longest row to it face down, **draw the pull-thread on the inner edge** of each row to curve it, whip the rows together edge to edge, and press before lifting the work off the paper. The paper is your workbench inside the work — the same trick as the cording motifs of the last lesson.

**Medallions** (motifs set into cloth) are basted in place, machine-stitched as close to their edge as possible, and then the material is **cut away from behind**, the raw edge either turned back and stitched again or rolled and closely overcast. Cutting away behind lace is what makes it read as lace — light must pass through.

**Embroidered edgings** carry plain cloth above their embroidery, and Butterick uses it structurally: creased and seamed on, the plain part turns up inside and becomes the **facing** — trimming and finish in one piece. Better still, an edging can be joined inside a **tuck**: seam it on, then fold a tuck with the seam lying exactly in the fold, among other tucks. The join disappears completely — the garment looks embroidered in one piece.

Two hand finishes complete the kit. **Hand hemstitching**: draw several parallel threads from the cloth at the hem line, then, working along the hem fold, take up four or five of the cross threads in a cluster with each stitch and catch the fold — an open, ladder-like line that is both hem and ornament. And its industrial child: **picot edging** is machine hemstitching **cut through the center**, leaving each half with a tiny looped edge — a dainty but strong finish for ruffle and collar edges, still done by specialist machines today.

> **Term note:** **insertion** = double-straight-edged lace or embroidery set into cloth; a **medallion** is a single motif; the **pull-thread** is the gathering thread woven into a lace's heading by its maker.`,
    checkpoints: [
      {
        q: "Narrow lace insertion is set in by…",
        options: [
          "cutting the material behind it through the center and hemming the edges back",
          "sewing it on top and leaving the cloth whole",
          "binding it with bias strips",
        ],
        answer: 0,
      },
      {
        q: "Lace is mitered by cutting…",
        options: ["straight across the cords", "between the motifs and cords", "on the true bias"],
        answer: 1,
      },
      {
        q: "Picot edging is…",
        options: [
          "machine hemstitching cut through the center",
          "a crocheted border",
          "a row of buttonhole stitch",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Darning, patching and the dignity of repair",
    minutes: 10,
    source: { label: "Butterick, ch. 30 Darning and Mending", url: "https://archive.org/details/newdressmakerwit00butt" },
    bodyMd: `The 1921 book treats mending as a craft with standards, not a chore — and its standards read remarkably like today's visible-mending revival, minus the visibility. Two principles frame the chapter. First: **mend at the first sign of wear** — reinforcing a thin place is quick; a hole is a project. Second: **mend before washing**, because laundering turns thin places into holes and doubles the work.

**Materials.** The darning thread must match the cloth in **thickness and color** — and for the most invisible work, the best thread is not thread at all but **a raveling drawn from the material itself**, from a hem or seam allowance. Sewing silk, however well matched in color, carries a luster that flashes the mend into view; the cloth's own thread cannot fail to match. Ravelings are short, and that is fine — short lengths work in perfectly well. Baste the area to be mended over stiff glazed paper or oilcloth so it stays flat and true while you work.

**Reinforcing and the running darn.** Over a place worn thin but not through, darn back and forth with the finest stitches you can, **following the grain**, keeping the threads slightly loose so they cannot draw. Do not knot: the ends are simply clipped close when the work is done. If the place needs more body, lay a piece of the material underneath and catch it up now and then as you darn.

**The woven darn** closes an actual hole by weaving new cloth in place, and its three counterintuitive rules are the heart of hand darning:

1. **Do not trim the frayed edge.** The ragged ends get caught into the new weave and blur the boundary — a trimmed hole gives a hard, visible outline.
2. Run all the **lengthwise threads first**, anchoring well into sound cloth each side, and **leave a tiny loop at each turn** — the allowance for the darning thread's own shrinkage, without which the finished darn puckers.
3. Then weave **crosswise, over and under the lengthwise threads, alternating on each return** — true cloth, made by hand, catching the frayed ends as they come.

**Knits** get their own physics. Stockings are darned **on the right side** (the smooth face goes against the skin) over a **darning egg**, stretched smoothly but never tightly. At knee and heel, run the darning threads **diagonally** — a diagonal web stretches with the knit, where a square one would snap. A dropped stitch is not darned at all: chase the run down with a fine **crochet hook**, catching each bar through the loop, and secure the last loop with a few stitches. And on a loosely knitted thing where an egg would leave the mend baggy, lay a matching piece *under* the hole and weave the lapped edges together flat.

**The tailor's mends.** **Stoting** closes a clean cut in heavy, closely woven cloth by running the needle *between the layers of the cloth itself* — inside its thickness — back and forth across the cut, using a raveling or even a human hair. Pressed afterwards, the mend is close to undetectable; it only works on a clean cut, never a frayed tear. For awkward three-cornered tears there was **mending tissue** — a heat-melting sheet, the direct ancestor of modern fusible web: push the torn edges back into position wrong side up, cover with tissue and a patch of the cloth, and press until fused.

**Patches**, for when the cloth around the damage is too far gone to darn: the **flannel patch**, basted behind and **catch-stitched** around both the patch edge and the trimmed hole — the catch stitch keeping the give a flannel needs; the **hemmed patch** for anything that launders (muslin, bedding, household linen) — stripes matched, corners clipped, both edges turned and hemmed so no raw edge survives repeated washing; and the **overhanded patch** where only one discreet line of stitching is wanted, patch and hole creased back on matching lines and overhand-sewn edge to edge, grain kept straight.

A mended garment, in this book's world, is not a diminished one — it is a garment somebody thought worth an hour. Your clients increasingly agree.

> **Term note:** **stoting** = the tailor's invisible between-the-layers mend; a **darning egg** is the hard form slipped inside a knit; **mending tissue** was the 1920s fusible.`,
    checkpoints: [
      {
        q: "The most invisible darning 'thread' is…",
        options: [
          "sewing silk matched by eye",
          "a raveling drawn from the material itself",
          "doubled polyester",
        ],
        answer: 1,
      },
      {
        q: "Before weaving a darn over a hole, the frayed edge is…",
        options: [
          "trimmed away cleanly",
          "left untrimmed, to be caught into the new weave",
          "turned under and hemmed",
        ],
        answer: 1,
      },
      {
        q: "At a stocking's knee or heel, darning threads run…",
        options: ["diagonally, so the mend stretches with the knit", "in perfect squares", "in circles"],
        answer: 0,
      },
    ],
  },
];

export const S1_MORE_QUIZ: QuizQuestion[] = [
  {
    id: "s1q15",
    q: "In period thread sizing, the finer cotton thread carries…",
    options: ["a lower number", "a higher number", "a letter near the start of the alphabet"],
    answer: 1,
  },
  {
    id: "s1q16",
    q: "If the needle thread lies straight along the top of the cloth, the fault is…",
    options: [
      "upper tension too tight (or bobbin too loose)",
      "stitch length too long",
      "the presser foot is up",
    ],
    answer: 0,
  },
  {
    id: "s1q17",
    q: "Every piece of a velvet garment is cut with the pile running the same way because…",
    options: [
      "the cloth is stronger one way",
      "pile catches the light differently up and down, so mixed pieces look like two shades",
      "the selvedge frays otherwise",
    ],
    answer: 1,
  },
  {
    id: "s1q18",
    q: "Cross tucking succeeds only when the crossing tucks…",
    options: [
      "are twice the size of the first set",
      "match the first set in size and spacing, forming perfect squares",
      "are sewn on the bias",
    ],
    answer: 1,
  },
  {
    id: "s1q19",
    q: "A skirt gathered into a waistband gets two rows of gathering stitches because…",
    options: [
      "one row is kept as a spare",
      "double rows hold the fullness in place and need no stroking",
      "the band is sewn between the rows",
    ],
    answer: 1,
  },
  {
    id: "s1q20",
    q: "For a nearly invisible darn, the best working thread is…",
    options: [
      "a raveling of the material itself — sewing silk shows a telltale luster",
      "the strongest thread available",
      "glazed basting cotton",
    ],
    answer: 0,
  },
];
