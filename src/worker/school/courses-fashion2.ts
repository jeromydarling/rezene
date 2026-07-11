import type { CourseDef } from "./types";

/**
 * School of Fashion, courses 1–2: costume literacy and fashion drawing —
 * adapted from Talbot Hughes (written FOR dressmakers, with patterns cut
 * from surviving garments), Lester's 1925 classroom textbook, Racinet's
 * plates, Edith Young's thirty-lesson drawing manual and Traphagen's
 * standard illustration text. All verified public-domain scans.
 */

export const F1: CourseDef = {
  slug: "language-of-costume",
  school: "fashion",
  title: "The Language of Costume",
  summary:
    "Silhouette is a language with a history. Learn to read it — line, volume, and the recurring shapes of Western dress — so your own designs quote on purpose.",
  level: "foundation",
  sources: [
    { label: "Talbot Hughes — Dress Design: An Account of Costume for Artists & Dressmakers (1920)", iaId: "dressdesignaccou0000unse", url: "https://archive.org/details/dressdesignaccou0000unse" },
    { label: "Katherine Morris Lester — Historic Costume (1925)", iaId: "historiccostume0000kath", url: "https://archive.org/details/historiccostume0000kath" },
    { label: "Auguste Racinet — Le Costume Historique (1888, Getty scan)", iaId: "gri_33125008521722", url: "https://archive.org/details/gri_33125008521722" },
  ],
  lessons: [
    {
      title: "Why designers read costume history",
      minutes: 8,
      source: { label: "Hughes, introduction", url: "https://archive.org/details/dressdesignaccou0000unse" },
      bodyMd: `Talbot Hughes wrote his 1920 costume history *for artists and dressmakers*, and his premise is this course's premise: costume history is not trivia — it is the **working vocabulary of design**. Every silhouette you will ever sketch has been worn before, argued about before, and solved technically before. Knowing where a line comes from lets you quote it on purpose, break it on purpose, and answer a client's "make it feel Edwardian, but modern" with something better than a mood.

His method is the one to copy: Hughes worked from **surviving garments**, not paintings alone — he cut patterns from period pieces in his own collection and printed the diagrams, garment by garment, at the back of the book. (This is why his book, of all era costume histories, remains a working tool: the plates show the look; the pattern diagrams show *how the look is a piece of cutting*.) When this school's tailoring courses talk about balance and suppression, Hughes shows you five centuries of answers.

Three habits of reading a garment historically, from his introduction:

1. **Read the silhouette first** — the outline a dressed figure cuts against the light. Periods are recognized by outline before any detail: where is the waist? how wide the shoulder? does volume live in the skirt, the sleeve, the hip?
2. **Then read where the structure is** — silhouettes are engineered. A 1690 mantua, an 1830 leg-of-mutton sleeve, a 1900 S-bend: each outline exists because something underneath (boning, padding, cut, corsetry) holds it. Ask "what makes this shape stand?" and costume history becomes a construction course.
3. **Then read the surface** — fabric, trim, ornament — knowing it is the most fashion-sensitive and least structural layer. Surfaces date fastest; silhouettes rhyme across centuries.

> **Using the sources:** Racinet's six volumes are the era's great visual atlas — 500 chromolithograph plates of world costume; browse them like a picture library. Lester's 1925 textbook is the readable narrative (with chapter review questions — the era examining itself). Hughes is the designer's working copy. All three are one click from every lesson here.`,
      checkpoints: [
        {
          q: "Hughes's book remains a working tool because it includes…",
          options: [
            "pattern diagrams cut from surviving garments",
            "color photography",
            "price lists for period fabrics",
          ],
          answer: 0,
        },
        {
          q: "The first thing to read on any historical garment is…",
          options: ["the silhouette — its outline against the light", "the trim", "the fiber content"],
          answer: 0,
        },
      ],
    },
    {
      title: "The silhouette timeline, 1800–1930",
      minutes: 10,
      source: { label: "Lester; Hughes, 19th-c. chapters", url: "https://archive.org/details/historiccostume0000kath" },
      bodyMd: `The century-and-a-quarter before our sources were written is the stretch a modern designer quotes most, and it swings like a pendulum between column and volume. The waypoints every designer should be able to sketch from memory:

**1800s–1810s · The Empire column.** Waist directly under the bust, fabric falling in a slim column — the neoclassical moment. Structure: almost none (the corset briefly nearly died). The recurring revival whenever fashion wants "liberation."

**1830s · Romantic volume.** The waist returns to place and cinches; sleeves balloon into the **gigot** (leg-of-mutton); skirts bell. Volume high on the body.

**1850s–60s · The crinoline.** Volume moves down: the cage crinoline swings skirts to their widest in history — an engineering solution (steel hoops) replacing dozens of petticoats. Silhouette: a bell on a fitted bodice.

**1870s–80s · The bustle.** Volume migrates *backward*: skirts flatten in front, project behind over a bustle frame; bodices lengthen into the boned **cuirass**. The most sculptural, upholstered moment of the century.

**1890s · The hourglass.** Bustle collapses; sleeves balloon again (the gigot's revival); skirts gore into smooth flares: the Gibson-girl hourglass. This is Hecklinger's and Vincent's customer.

**1900s · The S-bend.** The "health" corset tips the figure — bust forward, hips back — into the pouter-pigeon curve; lace and lingerie surfaces. Croonborg's 1907 customer.

**1910s · The revolt into the column.** Poiret and the directoire revival kill the S-bend; waists rise, skirts narrow (the hobble), Orientalism arrives; war then simplifies everything.

**1920s · La garçonne.** The waist *disappears* (dropped to the hip), the silhouette goes straight tube, hems make their historic climb to the knee, and — the deep change — **cut replaces corsetry as the source of shape**. The bias, the drape, the soft block: our S2 draping booklet is this revolution's textbook.

The pattern to internalize is not the dates but the **mechanism**: volume migrates (up → around → back → gone), waists rise and fall in opposition to skirt volume, and every extreme begets its reversal. When your trend board says "volume is back," this timeline tells you where it will sit and what it will demand structurally.`,
      checkpoints: [
        {
          q: "Across the 19th century, skirt volume moved…",
          options: [
            "from all-around bell (crinoline) to backward projection (bustle) before collapsing",
            "steadily smaller from 1800 to 1900",
            "only with fabric prices",
          ],
          answer: 0,
        },
        {
          q: "The deep change of the 1920s silhouette was…",
          options: [
            "cut replacing corsetry as the source of shape",
            "the return of the crinoline",
            "the invention of the waist seam",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Reading structure: what makes a shape stand",
      minutes: 9,
      source: { label: "Hughes, pattern diagrams", url: "https://archive.org/details/dressdesignaccou0000unse" },
      bodyMd: `Hughes's pattern diagrams teach the deepest lesson in costume literacy: **every silhouette is a construction method wearing a dress.** Walk the mechanisms:

**Suppression silhouettes** (the fitted eras: 1840s bodice, 1890s hourglass, 1950s revival): shape made by *removing* — darts, seams, and a boned foundation garment doing the heavy compression. To quote these silhouettes without their corsetry, the structure moves into the garment (S3's boned linings) or the silhouette softens honestly.

**Suspension silhouettes** (crinoline, bustle, pannier, the modern ballgown): shape made by *hanging cloth on a frame*. The cloth's own weight is the enemy and the frame's geometry is the design. Quote these and your real design object is the understructure — which is why couture still employs *flou* AND *tailleur*.

**Padding silhouettes** (the gigot sleeve, the Edwardian pouf, the 1980s shoulder): shape made by *filling*. Fast, light, reversible — padding is the cheapest historical quote in the book, which is exactly why it recurs.

**Cut silhouettes** (the 1920s tube, the bias 30s, the tent, the cocoon): shape made by *the pattern itself* — geometry, grain and drape doing everything. The hardest to copy from a photograph because the effect IS the pattern; Hughes's diagrams and a muslin are the honest route.

Two designer's corollaries. First, **fabric is structural**: the same pattern in organza and in melton is two different silhouettes; period designers chose cloth as engineering, not surface (the crinoline-era taffetas rustle *and* stand). Second, **undergarments are part of the design** — every period silhouette assumes its foundation, and a "modernized" quote must decide consciously what replaces it: cut, interior structure, or acceptance of a softer line.

This lesson is the bridge to your practical: a trend board that names a direction ("sculpted shoulders," "bias slip revival") should also name its *mechanism* — pad, cut, suspend, suppress — because the mechanism is what your pattern studio and your maker must actually deliver.`,
      checkpoints: [
        {
          q: "A crinoline silhouette is a…",
          options: [
            "suspension silhouette — cloth hung on a frame",
            "cut silhouette",
            "padding silhouette",
          ],
          answer: 0,
        },
        {
          q: "The same pattern in organza and melton yields…",
          options: [
            "two different silhouettes — fabric is structural",
            "identical silhouettes",
            "a grading error",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Quoting the archive: from plate to trend board",
      minutes: 8,
      source: { label: "Racinet plates; Lester", url: "https://archive.org/details/gri_33125008521722" },
      bodyMd: `The last skill of costume literacy is using it *forward* — turning the archive into design directions without costume-party pastiche. The working method, assembled from how the era's own designers used these very books:

**1. Collect by silhouette, not by decade.** Pull plates that share a *line* — high-waisted columns, say — across periods (Empire 1805, directoire-revival 1910, bias 1935). What survives the periods is the idea; what changes is the technology. The idea is what you're licensing.

**2. Name the mechanism** (lesson 3). A plate is a result; your board needs the cause. "1890s sleeve: volume by padding + pleating onto a fitted armhole" is actionable; "big sleeves" is a mood.

**3. Translate the foundation.** Decide explicitly what plays the corset/crinoline/bustle's role today: interior structure, clever cut, knit stretch, or nothing (accepting the soft version). This single decision separates a modern quote from a costume.

**4. Steal the details literally.** Surfaces date, but *techniques* are timeless and legal tender: a Racinet border becomes an embroidery placement; an 1870s bound edge becomes your signature finish. Period detail on a modern silhouette reads as taste; period silhouette with period detail reads as reenactment.

**5. Cite your sources on the board.** Not academically — practically. A trend board whose directions link the plates that seeded them briefs a design team (or a Design Studio prompt) with precision no adjective reaches. "Sleeve per Racinet vol. 5, plate 312, volume moved to the forearm" generates better than "romantic sleeve."

That is your practical: build a trend board in R&D with at least three directions, worded as mechanisms, sourced from the archive you now know how to read. (When we open the Timeless Library — the plate collections and magazine runs this school researched — this exercise will have twelve thousand plates one click away; the method is already yours.)`,
      checkpoints: [
        {
          q: "The archive is collected most usefully by…",
          options: [
            "silhouette line across periods, not by decade",
            "strict chronology",
            "fabric color",
          ],
          answer: 0,
        },
        {
          q: "What separates a modern quote from a costume is…",
          options: [
            "explicitly translating the foundation (what replaces the corset/frame)",
            "using only recent references",
            "avoiding all ornament",
          ],
          answer: 0,
        },
      ],
    },
  ],
  quizDraw: 10,
  passPercent: 80,
  quiz: [
    { id: "f1q01", q: "Hughes cut his book's pattern diagrams from…", options: ["surviving period garments", "paintings only", "imagination"], answer: 0 },
    { id: "f1q02", q: "Periods are recognized first by…", options: ["silhouette outline", "button styles", "thread fiber"], answer: 0 },
    { id: "f1q03", q: "The Empire silhouette places the waist…", options: ["directly under the bust", "at the hip", "at the natural waist, tightly corseted"], answer: 0 },
    { id: "f1q04", q: "The cage crinoline was, at heart…", options: ["an engineering replacement for dozens of petticoats", "a warmth garment", "a mourning custom"], answer: 0 },
    { id: "f1q05", q: "The bustle era moved skirt volume…", options: ["backward, over a frame", "to the sleeves", "to the hem evenly"], answer: 0 },
    { id: "f1q06", q: "The 1900s 'S-bend' figure was produced by…", options: ["the straight-fronted 'health' corset tipping the posture", "shoulder pads", "bias cutting"], answer: 0 },
    { id: "f1q07", q: "The gigot (leg-of-mutton) sleeve appears in…", options: ["both the 1830s and 1890s — extremes revive", "only the 1920s", "only menswear"], answer: 0 },
    { id: "f1q08", q: "A 'suspension' silhouette makes shape by…", options: ["hanging cloth on a frame", "removing cloth with darts", "stretching knits"], answer: 0 },
    { id: "f1q09", q: "Padding recurs historically because it is…", options: ["the cheapest, most reversible structural quote", "invisible", "required by looms"], answer: 0 },
    { id: "f1q10", q: "Cut silhouettes are hardest to copy from photos because…", options: ["the effect IS the pattern geometry", "the fabrics no longer exist", "they were never photographed"], answer: 0 },
    { id: "f1q11", q: "Every period silhouette assumes its…", options: ["foundation garments", "climate", "national anthem"], answer: 0 },
    { id: "f1q12", q: "Period detail on a modern silhouette reads as…", options: ["taste; period-on-period reads as reenactment", "always costume", "plagiarism"], answer: 0 },
    { id: "f1q13", q: "A useful trend-board direction names…", options: ["the mechanism (pad/cut/suspend/suppress), not just the mood", "a celebrity", "a decade only"], answer: 0 },
    { id: "f1q14", q: "Racinet's Costume Historique is best used as…", options: ["a visual atlas to browse and cite", "a drafting system", "a sewing manual"], answer: 0 },
  ],
  practical: {
    kind: "trend_board",
    title: "Build a sourced trend board",
    instructions:
      "In R&D → Trends, build a board with at least three directions worded as mechanisms (e.g. 'sleeve volume by pleated padding'), ideally citing archive plates in its notes. The school verifies the board and its directions exist.",
  },
};

export const F2: CourseDef = {
  slug: "fashion-drawing",
  school: "fashion",
  title: "Fashion Drawing",
  summary:
    "Edith Young's thirty-lesson course and Traphagen's standard text, distilled: the croquis, drapery that means something, and drawing as a design instrument rather than an illustration contest.",
  level: "intermediate",
  sources: [
    { label: "Edith Young — Student's Manual of Fashion Drawing: Thirty Lessons (1919)", iaId: "studentsmanualof00younrich", url: "https://archive.org/details/studentsmanualof00younrich" },
    { label: "Ethel Traphagen — Costume Design and Illustration (1918)", iaId: "costumedesignill00trap", url: "https://archive.org/details/costumedesignill00trap" },
  ],
  lessons: [
    {
      title: "The figure: proportion before beauty",
      minutes: 9,
      source: { label: "Young, lessons 1–8", url: "https://archive.org/details/studentsmanualof00younrich" },
      bodyMd: `Young's course begins where every fashion drawing must: a figure in believable proportion, built from simple measures rather than talent. Her scaffold:

**Heads as the unit.** The classical figure stands 7.5–8 heads tall; the fashion figure of her era stretches to 8.5 (today's stretches further — the *convention* moves, the *method* doesn't). Landmarks fall on head-lines: chin at 1, bust near 2, waist near 3, hips at 4, knees around 5.5–6, ankles just above 8. Draw the ruler-of-heads first; hang the figure on it.

![Diagram of a standing female figure divided into head-length units with labeled proportion lines](/school/fashion-drawing/lesson0-heads-tall-grid.jpg)
*Ethel Traphagen, Costume Design and Illustration (1918) — the figure ruled into head units, every landmark labeled against the count.*

**The action line.** Before anatomy, one long stroke establishes the pose — the spine's sweep from head to weight-bearing heel. Every convincing figure drawing starts as this single line; stiff figures are figures whose action line was never drawn.

**Weight and the standing leg.** A standing figure bears weight on one leg; the weight-bearing ankle sits under the pit of the neck (drop a plumb line — the era's test and the studio's still). The hip over the standing leg rises; the shoulder above it drops: the counterpose that makes a figure stand instead of float.

**Simplify the anatomy.** Young's era drew ovals and cylinders — egg head, cylinder neck, oval ribcage and hip masses, tapered cylinder limbs — assembled on the action line, refined only after the assembly stands. Anatomy in a fashion drawing is scaffolding for cloth; the drawing exists to carry the garment.

![Side-by-side line drawings showing a fashion figure first as construction guide lines, then as a finished outline](/school/fashion-drawing/lesson0-figure-construction-steps.jpg)
*Edna Woolman Young, A Student's Manual of Fashion Drawing (1919) — the same figure blocked in with guide lines, then cleaned up and ready to dress.*

Her practice regime is the unglamorous secret: **a page of figures a day**, thirty seconds to five minutes each, from life or photographs, drawn *through* (light lines continuing where limbs pass behind cloth or each other, so the body under the clothes is never guessed). Thirty lessons of it and the hand stops negotiating with the pencil — which is the entire point: a designer's drawing speed is a design speed.

> **Adapting the era:** Young's proportions and poses reflect 1919's figure conventions. Draw today's variety of bodies with the same method — the head-unit scaffold, action line and plumb test are body-neutral tools; the convention layered on top is yours to set.

![Rows of head-construction drawings above a chart of figures at different ages measured in head units](/school/fashion-drawing/lesson0-proportions-by-age.jpg)
*Traphagen — heads constructed in five views, and how many heads tall the figure stands at every age.*`,
      checkpoints: [
        {
          q: "The plumb test for a standing figure drops from…",
          options: [
            "the pit of the neck to the weight-bearing ankle",
            "the chin to the toes",
            "the shoulder to the same-side knee",
          ],
          answer: 0,
        },
        {
          q: "Drawing 'through' means…",
          options: [
            "lightly continuing forms where they pass behind cloth or limbs",
            "using tracing paper",
            "pressing hard with the pencil",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "Drapery: folds are information",
      minutes: 9,
      source: { label: "Young, drapery lessons; Traphagen", url: "https://archive.org/details/costumedesignill00trap" },
      bodyMd: `Fashion drawing's real subject is cloth, and the era's texts teach drapery as a *system* — folds are not texture, they are **information about the body, the cloth and the cut**. The fold families Young drills:

**Pipe (organ) folds** — parallel rounded tubes falling from a gathered or pleated source: a gathered skirt hangs in pipes. Drawn as long strokes from the source, widening downward.

**Zigzag folds** — where a tube of cloth crumples against a support (a sleeve at a bent elbow, a trouser break at the shoe): the fold snaps side to side. The fitting-room "wrinkle vectors" of T2, drawn on purpose.

**Spiral folds** — around a wrapped or twisted form (a rolled cuff, a wrapped bodice).

**Half-lock folds** — the sharp diamond where a hanging plane changes direction abruptly (a knee lifting under a skirt).

**Falling/cascade folds** — the flared zigzag edge of a bias or circular piece: a jabot, a cascade ruffle, a circle skirt's hem.

![Line drawings of five draped skirts showing cascading folds, pleats, and gathered fabric](/school/fashion-drawing/lesson1-skirt-drapery-on-the-form.jpg)
*Young — five skirts on the form: where cascades, accordion pleats, gathers and tucks each fall.*

Two principles govern all of them. **Folds radiate from points of support or tension** — shoulder, bust, belt, knee; begin every fold at its cause and the drawing explains the garment. And **fabric weight sets fold scale**: chiffon makes many small soft folds, melton few large firm ones; the pencil pressure and stroke length should change with the cloth. An era exercise worth stealing whole: drape one meter of muslin, then of charmeuse, then of coating over the same chair and draw all three — same support, three languages.

![Chart of fabric texture strokes and four skirt studies showing folds rendered in different materials](/school/fashion-drawing/lesson1-rendering-fabric-folds.jpg)
*Young — the same folds rendered as velvet, taffeta, chiffon and crepe: fabric weight is the drawing's real subject.*

Traphagen adds the drawing-from-history discipline this school loves: her assignments send students to redraw silhouettes from museum plates *as working sketches* — not to copy the rendering but to extract the line. Drawing a garment is the fastest way to understand its cut; her book is a bridge between F1's plates and your own croquis.`,
      checkpoints: [
        {
          q: "Every fold should be drawn starting from…",
          options: [
            "its point of support or tension — its cause",
            "the hem upward",
            "the darkest shadow",
          ],
          answer: 0,
        },
        {
          q: "Fabric weight changes drapery by…",
          options: [
            "setting fold scale — chiffon many small folds, coating few large ones",
            "changing the figure's proportions",
            "nothing; folds are constant",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "The working sketch: drawing as specification",
      minutes: 8,
      source: { label: "Traphagen, design chapters", url: "https://archive.org/details/costumedesignill00trap" },
      bodyMd: `Traphagen's deepest usefulness to a working studio is her insistence that fashion drawing splits into **two different instruments**, and confusing them wastes both:

**The croquis (design sketch)** — fast, front-and-attitude, exploring proportion and line. Its audience is you; its virtue is speed; its quantity should be embarrassing. Design happens across twenty croquis, not inside one.

**The working drawing** — the era's name for what production calls the **flat**: garment drawn off the body (or on a neutral figure), both halves, true proportions, with the seams, darts, closures and construction lines *drawn where they actually are*. Its audience is the maker; its virtue is truth. Traphagen's rules for it read like a tech-pack standard a century early: show every seam; indicate the closure (which side laps, how far it opens); draw the back; note the fabric; if a detail can't be drawn clearly, draw it enlarged in a corner ("detail sketches," her term — the ancestor of every tech pack's callout).

![Drawing of a shirred and scalloped dress with enlarged margin studies of lacing, fringe, and tassels](/school/fashion-drawing/lesson2-shirring-scallops-lacing.jpg)
*Young — trims specified in a sketch: shirring, scalloped tiers, lacing and tassels, each redrawn enlarged in the margin.*

Between them sits her **presentation drawing** — the rendered, attitudinal illustration for the client or the page. It borrows the croquis's life and the working drawing's honesty, and its era-specific techniques (wash, line economy, the dramatically elongated figure) are style; borrow what suits your brand.

The modern mapping is exact and worth saying aloud: croquis → your sketchbook and Design Studio prompts; working drawing → the flat sketch on your tech pack; presentation drawing → your lookbook and product page imagery. One design, three drawings, three audiences — and the discipline of knowing which one you're making at any moment.

![Line drawing of a plaid dress with the pattern following seams and folds, surrounded by plaid swatch studies](/school/fashion-drawing/lesson2-plaids-follow-construction.jpg)
*Young — a check pattern bending truthfully around bodice, sleeve and gored skirt: the working drawing's honesty applied to cloth.*

Her assignment structure also survives translation: design *in series* (six variations on one block beat one masterpiece), and **annotate every sketch** — fabric, key measure, the one construction note that makes it buildable. An annotated croquis is halfway to a spec; an unannotated beauty is halfway to nothing.

![Line drawings of two blouses on the waist form with detail studies of collars, cuffs, and a buckle](/school/fashion-drawing/lesson2-waists-collars-details.jpg)
*Young — waists on the form with their collars, cuffs and frills drawn as separate construction studies.*`,
      checkpoints: [
        {
          q: "The working drawing's audience and virtue are…",
          options: [
            "the maker, and truth — every seam and closure where it really is",
            "the client, and glamour",
            "the artist, and speed",
          ],
          answer: 0,
        },
        {
          q: "Traphagen's 'detail sketches' correspond today to…",
          options: [
            "a tech pack's enlarged callouts",
            "mood boards",
            "fabric swatches",
          ],
          answer: 0,
        },
      ],
    },
    {
      title: "From sketch to studio: drawing in a modern pipeline",
      minutes: 8,
      source: { label: "Young, closing lessons; Traphagen", url: "https://archive.org/details/studentsmanualof00younrich" },
      bodyMd: `The closing lessons of both books are about drawing *as a job* — reproduction constraints, deadlines, working for an audience — and they translate cleanly into a modern label's pipeline:

**Line survives; rendering seduces.** The era's reproduction processes rewarded confident line drawings (halftones were costly), which trained a virtue worth keeping: if the design reads in pure line, it is a design; if it needs the rendering to read, it is a mood. Test your croquis by what a pattern maker could do with them.

![Art-deco fashion plate of a woman in a Paquin travel coat standing between two dark stylized trees](/school/fashion-drawing/lesson3-barbier-les-colchiques.jpg)
*George Barbier, 'Les Colchiques' (1913), for a Paquin coat, reproduced in Traphagen — line economy carrying an entire composition.*

**Draw for the brief, in series.** Young's later lessons assign garments to constraints — a walking suit for such a figure, a frock in such a cloth — never "draw something beautiful." Series thinking (six necklines on one bodice; four sleeve volumes on one jacket) is design's real motion, and it maps directly onto how you'd brief a generation batch in the Design Studio: one block, one fabric truth, several disciplined variations.

**The sketch is a contract with the make.** Every drawing that leaves your hands toward a maker is a promise about grain, volume and construction — which is why the era annotated relentlessly and why your flats live *inside* tech packs, not beside them. A sleeve drawn with pipe folds promises gathering; drawn smooth it promises a fitted cap; the maker will price and sew what you drew.

![Soft etching of a woman in a broad-brimmed hat and long dress holding an open parasol](/school/fashion-drawing/lesson3-steinmetz-parasol-etching.jpg)
*E. M. A. Steinmetz for Harper's Bazar, in Traphagen — atmosphere as a brand voice: the presentation drawing at full power.*

**Practice remains the engine.** Thirty lessons, a page a day — the books end where they began. A studio habit that survives a century of technology deserves the last word: designers who draw daily see garments more precisely, brief makers and machines more precisely, and recognize in a fitting what others only feel.

![Decorative cover illustration of a masked couple in costume among fireworks, flowers, and night sky](/school/fashion-drawing/lesson3-brunelleschi-cover-design.jpg)
*Umberto Brunelleschi's cover design, in Traphagen — how far a costume drawing can carry mood and story.*

Your practical closes the loop with the modern instrument: save a concept in the Design Studio — a disciplined brief in the era's spirit (block, fabric, three variations) rather than an adjective cloud. The school verifies the concept exists; the discipline it verifies is Young's and Traphagen's.`,
      checkpoints: [
        {
          q: "The line test for a croquis is…",
          options: [
            "whether the design reads in pure line, without rendering",
            "how dramatic the shading is",
            "whether it fits on one page",
          ],
          answer: 0,
        },
        {
          q: "A sleeve drawn with pipe folds promises the maker…",
          options: ["gathering at its source", "a fitted, smooth cap", "a raglan cut"],
          answer: 0,
        },
      ],
    },
  ],
  quizDraw: 10,
  passPercent: 80,
  quiz: [
    { id: "f2q01", q: "The fashion figure is measured in…", options: ["head-heights", "centimeters only", "hand-spans"], answer: 0 },
    { id: "f2q02", q: "The action line is…", options: ["the single stroke establishing the pose before anatomy", "the hem line", "the seam line"], answer: 0 },
    { id: "f2q03", q: "In a standing figure, the hip over the weight-bearing leg…", options: ["rises while that shoulder drops", "drops", "stays level"], answer: 0 },
    { id: "f2q04", q: "Era students built figures from…", options: ["ovals and cylinders on the action line", "tracing photographs", "grids of squares"], answer: 0 },
    { id: "f2q05", q: "Pipe folds appear where…", options: ["cloth falls from a gathered or pleated source", "cloth is wrapped tightly", "a knee lifts a plane"], answer: 0 },
    { id: "f2q06", q: "Zigzag folds are the signature of…", options: ["a tube of cloth crumpling against a support (elbow, trouser break)", "bias cascades", "starched fabric"], answer: 0 },
    { id: "f2q07", q: "A cascade/falling fold edge belongs to…", options: ["bias or circular pieces — jabots, circle hems", "flat-felled seams", "pleated skirts only"], answer: 0 },
    { id: "f2q08", q: "Chiffon vs coating in drapery:", options: ["many small soft folds vs few large firm ones", "identical folds", "coating folds more"], answer: 0 },
    { id: "f2q09", q: "The croquis's virtue is…", options: ["speed and quantity — design happens across many", "perfect rendering", "archival permanence"], answer: 0 },
    { id: "f2q10", q: "The working drawing must show…", options: ["every seam, the closure's lap and reach, and the back", "only the front silhouette", "the model's face"], answer: 0 },
    { id: "f2q11", q: "The modern descendant of the working drawing is…", options: ["the tech pack's flat sketch", "the mood board", "the runway photo"], answer: 0 },
    { id: "f2q12", q: "Designing 'in series' means…", options: ["disciplined variations on one block/constraint", "drawing many unrelated garments", "copying a series of magazines"], answer: 0 },
    { id: "f2q13", q: "An unannotated beautiful sketch is…", options: ["halfway to nothing — annotation makes it buildable", "ready for the factory", "a working drawing"], answer: 0 },
    { id: "f2q14", q: "Redrawing museum plates as working sketches (Traphagen) trains…", options: ["extracting the line and cut, not copying the rendering", "watercolor technique", "handwriting"], answer: 0 },
  ],
  practical: {
    kind: "design_concept",
    title: "Brief like a designer",
    instructions:
      "Save a concept in the Design Studio built as a disciplined brief — one block or garment type, a fabric truth, and variations — rather than an adjective cloud. The school verifies a saved concept exists.",
  },
};
