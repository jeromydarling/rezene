import type { Lesson, QuizQuestion } from "./types";

// Expansion lessons for F2 · Fashion Drawing — appended after the original
// four (progress is keyed by lesson index, so append-only).
export const F2_MORE_LESSONS: Lesson[] = [
  {
    title: "Heads and faces: features on the oval",
    minutes: 10,
    source: { label: "Young, lessons 12–14", url: "https://archive.org/details/studentsmanualof00younrich" },
    bodyMd: `Young gives three full lessons to the head, and her order is the lesson: **the oval first, the features last**. Never begin with an eye you like and hope a face grows around it. Draw the egg — widest up through the eyebrows, narrowing to the chin — then rule the guide lines, and only then let the features arrive where the ruler says they live.

Her placement rules are worth memorizing whole. **The eyes sit in the middle of the head** — beginners put them far too high, which ages a face instantly, and "in fashions we want the faces to look fresh and new as well as the dresses." The eyes are **one eye's width apart**, with half an eye between each eye and the edge of the face. **The nose ends halfway between the eyebrows and the chin; the mouth sits one-third of the way from nose to chin.** The ears run between the eyebrow line and the nose line. Miss any one of these and the face reads as wrong before a viewer can say why.

The features themselves are built, not drawn. The **eye** is twice as long as it is high; the inner corner sits slightly lower than the outer; the iris is about a third of the eye's width and must tuck well under the upper lid — a full round ball makes a stare. The lower lid is soft and, in fashion work, often omitted altogether. The **mouth** is about two and a half times its height, with two little Vs at the center of the upper lip; the corners droop toward the ends and then lift — that lift is what carries the mouth *around* the face and lets it smile. The **nose** begins at the small diamond between the brows, and in fashion drawing the line of the bridge is usually left out: the end and wings do the work.

> **Term note:** the **center line** is the line down the middle of the *face*, not the middle of the drawing. On a three-quarter head it curves around the oval; every feature hangs on it. Young's other iron rule for the turned head: the far eye may be a trifle smaller, **never larger**.

Tipping and turning stop being frightening once you trust the guide lines. Head thrown back: every cross line **curves up**, you see under the chin, the neck lengthens. Head tipped down: the lines **curve down**, the nose appears longer, the top of the head grows full. The features simply ride their rails.

**Hair** must fit the head. Draw a few lines only, in the true direction — parted, dropping at the forehead, fitting the temples, lifting away over the ears — with broken, soft edges. Her reproduction trick still delights: **light hair is drawn with dark lines; black hair is inked solid and the direction left as white lines.** Same information, reversed.

And her hat rule belongs in every studio: **never draw the hat and place the face under it. Draw the full head first, then put the hat on it** — crown fitting the skull, far brim continuous, tipped slightly for style so that one eyebrow hides. A hat drawn hatless-first always floats.

For a designer today the payoff is proportion discipline, not portraiture. The face on a croquis is scaffolding — a well-placed oval, three guide lines, a gesture of hair — because the garment is the subject. But a face placed *wrong* hijacks the whole sketch, and on a presentation drawing or a lookbook brief for the Design Studio, the era's ratios are exactly the vocabulary you need to say what "fresh," "editorial," or "classic" means in measurable terms.

Practice as Young assigns it: a page of ovals in full, three-quarter and profile; features placed by the rules on each; then heads collected from fashion papers, redrawn with the construction lines ruled through them to check the artist's obedience — and yours.`,
    checkpoints: [
      {
        q: "Young's order of operations for a head is…",
        options: [
          "oval and guide lines first, features last",
          "start with the best eye and build outward",
          "hat first, face underneath",
        ],
        answer: 0,
      },
      {
        q: "In the fashion face, the eyes sit…",
        options: [
          "two-thirds of the way up the head",
          "in the middle of the head, one eye's width apart",
          "just under the eyebrow line, touching",
        ],
        answer: 1,
      },
      {
        q: "When a head tips back, the cross guide lines…",
        options: ["curve up, and you see under the chin", "stay straight", "curve down"],
        answer: 0,
      },
    ],
  },
  {
    title: "Hands, legs, and shoes: the giveaway details",
    minutes: 10,
    source: { label: "Young, lessons 15–16", url: "https://archive.org/details/studentsmanualof00younrich" },
    bodyMd: `Both books single out the same danger zone. Traphagen: "Great care should be given the study of hands and feet, as these play an important and telling part in fashion work." A figure can carry a slightly generic face; it cannot survive a mitten hand or a rubber-boot foot. These are the giveaway details — where a viewer decides, without knowing why, whether the drawing was made by someone who can draw.

**The arm** first, because the hand hangs from its logic. The upper arm equals the forearm in length; the arm tapers from shoulder to wrist except just below the elbow, the widest point. Young's grace rule: give the arm **three directions** — one for the upper arm, one for the forearm, one for the hand — and the limb becomes a gesture instead of a post. Her proportions: **the hand is as long as the face from chin to above the eyebrows; the foot is about the length of the head.** Check any figure that looks subtly wrong against those two measures before touching anything else.

**The hand** in fashion is slender, the fingers long and tapering — chubby hands belong to children only. The middle finger is longest and tends to fall together with its neighbor; the knuckle line sits **halfway between the wrist and the fingertips**; the fingers join the hand on a curve, and they are shorter on the palm side than on the back. The thumb joins slightly behind the knuckles and reaches almost to the first finger's second joint. The wrist, seen from the side, is startlingly narrow, with a small break where the hand joins it. Young's best model is free: pose your own hand in a mirror, turn it, bend it, and draw what the mirror reports. For a **gloved hand**, draw the bare hand first, then the glove lines slightly outside it, with the stitching lines on the back — the glove is a garment and obeys garment rules.

**The leg** in profile is a **reverse curve** — the lower leg set well back of the upper, the calf a decided outward swell, the knee projecting but sloping back. Two asymmetries make legs convincing: **the outside of the calf is higher than the inside, and the inside ankle bone is higher than the outside.** Get those two crossings right and a stocking-clad fashion leg draws itself; reverse them and no amount of rendering saves it.

**The shoe** deserves the same construction respect as a bodice. There are three planes across the vamp and tip, most visible at the seams; the heel must fit **well under** the foot, never trailing behind it; the top line of a shoe curves *down* in side view and *up* in back view, because you are seeing opposite sides of the same ellipse. The outer curve of the shoe is longer and stronger than the inner. Young's warning is timeless: draw a slipper "dainty and like a slipper, not like a rubber." And for a black shoe, plan the high lights before inking — the shine is left paper, not added later.

> **Term note:** drawing **breaks** — Young's charts leave small gaps where an outline changes direction. Keep the breaks while learning: they force you to notice each change of direction instead of sliding past it on one lazy curve. Connect the lines only in a finished drawing.

One rule ties the lesson to the garment: **a sleeve must take the shape of the arm inside it**, and a shoe must take the shape of the foot. In your flats and tech packs the same honesty applies in reverse — a cuff drawn where no wrist could be, or a heel pitched where no foot could bear weight, tells a maker the sketch was never checked against a body. Practice regime: a page of hands from the mirror, a page of legs and shoes from catalogues, keeping hands the same size as each other and the feet true mates — Young's phrase, and still the first thing a trained eye checks.`,
    checkpoints: [
      {
        q: "Young's quick proportion checks: the hand and the foot measure…",
        options: [
          "hand = chin to above the eyebrows; foot = about a head length",
          "hand = half a head; foot = two heads",
          "both exactly one head",
        ],
        answer: 0,
      },
      {
        q: "A graceful drawn arm has…",
        options: [
          "one continuous direction, like a post",
          "three directions — upper arm, forearm, hand",
          "as many directions as possible",
        ],
        answer: 1,
      },
      {
        q: "On a convincing leg…",
        options: [
          "the inside ankle is higher than the outside; the outside calf higher than the inside",
          "ankles and calves are level on both sides",
          "the outside ankle is higher and the inside calf is higher",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Action and balance: poses beyond the front view",
    minutes: 10,
    source: { label: "Young, lessons 17–25", url: "https://archive.org/details/studentsmanualof00younrich" },
    bodyMd: `One pose is not a repertoire. Young's later lessons walk the figure through walking, back, side and sitting views, and Traphagen contributes the simplest action tool in either book — and together they turn "I can draw a figure" into "I can draw the figure this garment needs."

Start with **balance**, because every pose is a solved balance problem. You know the standing rule from lesson one: weight on one leg, plumb line from the pit of the neck to the supporting ankle. Now the extensions. **When the weight is even on both feet — the walking figure — the standing line falls between the feet.** When the figure is in motion, the plumb line from the neck falls between the legs; destroy that balance and the figure must be leaning on something or falling. A kneeling figure leaning back needs its support drawn behind the vertical, or the eye reports the fall before the mind does.

Traphagen's **toothpick figures** make action cheap to rehearse: the body reduced to sticks, where the trunk, thigh and lower leg are each about a third of the body's length below the neck. Walking reads best on paper with **both feet on the ground** (though a real walker is mostly on one); running with one foot down; leaping with limbs stretched for the next effort; jumping with the feet gathered to land. Ten seconds of toothpick before any croquis buys you a pose that stands — then build the ovals and cylinders onto the sticks.

**The back figure** is the working designer's friend, because garments have backs and tech packs demand them. Its grammar inverts the front: the waistline and collar line **curve up**, not down; the legs join the body *below* the visible middle; the far shoulder is longer and more sloping. Turn the head only as far as a neck turns — Young's warning against "an almost full face on a back figure" is a warning against a broken neck. The center line of the back takes two long reverse curves; keep them gentle or the figure swaggers.

**The side figure** looks taller than it is, the body being narrower in profile — useful when a silhouette is the story. Note the long straight line of the front and the long curve of the back. **The sitting figure** divides into three nearly equal parts — head to below the bust, to the bend of the hips, to the sole of the foot — bends at the hips and again at the knees, and the knees push past the edge of the seat, because that is how people actually sit. Draw the far leg **through** the near one, as always.

Two pieces of studio wisdom ride along. First, **turn the head against the body** — a body angled one way with the face turned the other lends life to even a catalogue-stiff pose. Second, know your house style: Young distinguishes the "normal" up-and-down figures the pattern houses wanted from the **"swingy"** figures with dash that newspapers demanded. Learn the quiet figure first; swing is a seasoning, not a skeleton.

> **Term note:** an **action pose library** is the modern habit this lesson builds. Keep a folder of your own best toothpick-to-finished poses — front, three-quarter, back, side, seated — and reuse them the way Young's illustrators reused collected clippings. When you brief the Design Studio or assemble a lookbook, naming the pose ("three-quarter back, weight on left, head turned to camera") is part of the specification.

The rule that makes it professional: **choose the pose that shows the garment.** Illustrating a back-buttoned dress on a front figure, or hiding a signature sleeve under a hand-on-hip, wastes the drawing. Young says it plainly — if there is something particularly attractive under the arm, put the arm up. The figure serves the clothes; that is the whole job.`,
    checkpoints: [
      {
        q: "In a walking figure with weight even on both feet, the standing line…",
        options: ["falls between the feet", "runs to the front ankle", "runs to the back heel"],
        answer: 0,
      },
      {
        q: "On a back figure, the waist and collar lines…",
        options: ["curve down, as in front", "curve up", "stay perfectly straight"],
        answer: 1,
      },
      {
        q: "Traphagen's toothpick figures exist to…",
        options: [
          "replace anatomy entirely in finished drawings",
          "decorate margins",
          "rehearse balance and action cheaply before building the figure",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Drawing children: little people, different rules",
    minutes: 9,
    source: { label: "Traphagen, chapter 2 (Drawing without Models)", url: "https://archive.org/details/costumedesignill00trap" },
    bodyMd: `Both books pause on children, and both open with the same warning: children are not shrunken adults. Young: make them cute, "and not little old men and women." Everything that reads as childlike on the page comes from proportions — and the proportions change with every year of age.

**The head count by age** is the tool. Traphagen's chart: at about six months the head goes roughly **four** times into the height; at four years about **five and a quarter**; at seven, **six and a half**; at ten, **six and three-quarters**; at fifteen, about **seven**; in the adult, seven and a half to eight. Young's fashion-page figures run smaller still — a tiny baby at **three heads**, four years at three and a half, six-to-eight years around five, twelve-to-fourteen at six or so, sixteen at six and a half to seven. The two books disagree on the numbers and agree completely on the method, which is the real lesson: **the convention is a choice; the head-count is how you state the choice.** Decide how old the child is, set the count, and hold it.

![Rows of head-construction drawings above a chart of figures at different ages measured in head units](/school/fashion-drawing/lesson0-proportions-by-age.jpg)
*Traphagen, Costume Design and Illustration (1918) — the same chart you met in lesson one, now read for its bottom row: how many heads tall the figure stands at every age.*

Everything else follows the big head. A child's head is **round, not egg-shaped**, and the eyes sit at the middle of the head or — on a baby — a little below it. The eyes are large and wide apart, "wide-awake" in Young's phrase, with a peculiar turn to the upper lid; the nose is short and small, the mouth small and full, the cheeks push out past the jaw. Hands, arms, legs and feet are chubby on small children, and the shoes are **square and flat** — draw a toddler in a tapered heel and the whole figure collapses into a tiny adult. Boys get slightly squarer features than girls.

Traphagen adds a growth map worth keeping, from Professor Stratz: children grow in breadth and height to about four, in height from four to eight, in breadth from eight to ten, then in height again from ten to fifteen — **the lanky years, when hands and feet look too big.** Her craft advice for that slim period: keep the legs long and slender, and never draw a child's figure as developed — it destroys the childlike charm. At about fourteen, Young notes, the young miss takes something of a woman's build, and in her era the lengthening hemline itself announced age.

Two finishing habits make drawn children live. **Give them action** — Young insists a child be interested in something, a toy, a dog, each other; a child posed like a mannequin reads as eerie. And study the illustrators who did it best: Traphagen sends her students to Kate Greenaway, Jessie Willcox Smith and Helen Dryden, which is the same use-the-museum discipline this course applies to everything else.

> **Term note:** in modern production this lesson is the drawing side of **age-banded sizing**. A kidswear tech pack grades measurements by age band exactly the way these charts grade heads by age — and a flat sketch for a 4T garment drawn on 7-year-old proportions will mislead everyone who prices, patterns or photographs it. Say the age band in the sketch's annotation, and draw the body that matches.

The exercise: take one simple garment — a smock, a coat — and draw it four times, on a three-and-a-half-head toddler, a five-head six-year-old, a six-and-a-half-head twelve-year-old and an eight-head adult. Same garment, four different drawings; the cloth hangs differently on each because the bodies are genuinely different. That is the whole argument of the lesson, made by your own hand.`,
    checkpoints: [
      {
        q: "Compared with an adult's, a child's head is…",
        options: [
          "proportionally larger — the figure stands fewer heads tall",
          "proportionally smaller",
          "identical in proportion, just scaled down",
        ],
        answer: 0,
      },
      {
        q: "A child's face differs from the fashion adult's in that…",
        options: [
          "the eyes are smaller and closer together",
          "the head is round, eyes large and wide apart, nose short, cheeks full",
          "the features sit higher in the head",
        ],
        answer: 1,
      },
      {
        q: "Young's and Traphagen's age charts give different head-counts, which teaches…",
        options: [
          "one of the books is useless",
          "children cannot be drawn systematically",
          "the convention is a stated choice; counting heads is the constant method",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Texture is a line vocabulary: fur, silk, lace, feathers",
    minutes: 10,
    source: { label: "Young, lessons 22 and 26", url: "https://archive.org/details/studentsmanualof00younrich" },
    bodyMd: `Lesson two of this course taught that folds carry information about cloth. Young's texture lessons teach the companion truth: **the stroke itself carries information about the surface.** Her rule compresses a whole discipline into one sentence — to form a texture, "the lines of the drawing must take the form of the weave, and the whole mass of lines must follow the form on which the texture is placed." Two obediences at once: to the material, and to the body under it. Her example is a basket: lines shaped like straw, massed in the shape of the basket, and imagination does the rest — the identical strokes, laid on a nicely drawn sweater, become knitting.

The era's **stroke chart** is worth learning as a vocabulary list. Very fine lines for **chiffon** and thin goods; clusters of strokes fitted into one another for **silk**; crinkled strokes for **crepe**; and for woolens, **stipple** — dots made with the pen point, scattered for a light tone or crowded for shadow, with care not to leave little hooks on the dots. **Lace** is a criss-cross mesh drawn in squares or diamonds — never round holes — with the pattern worked out and a small shadow under each motif of **embroidery** so it sits on the cloth instead of floating. Shiny **black silk** is the boldest trick: draw the shapes to be inked solid, and leave the high lights as untouched paper; the white does the shining.

**Fur** gets its own grammar. If the fur has long hairs, use long lines; if curly, curly ones; short fur, short lines — massed where the shadows fall, always following the shape of the piece, and drawn full at the edges so the pelt has loft. Where a fur band is joined at its middle, the hairs fall both up and down from the seam — draw that and the trimming explains its own construction. And the reversal you now expect: **black fur is drawn with white lines.** A muff's strokes curve around its volume; get the direction right and three lines say "fur" better than three hundred wrong ones.

**Feathers** are pure direction. An ostrich plume is curvy lines whose ends form the edge, curling under; a paradise feather is long and short fine lines fitted between each other. Young's summary for all of it: when a mass confuses you, stop rendering and ask which way the lines *travel*.

Traphagen adds the brush-side of the same vocabulary: soften a color's edge with a clean damp brush for **velvet**; let the wash dry to a hard, crisp edge for shiny **taffeta**; keep dark blues and blacks lighter and more transparent than the real cloth so detail still shows. Delicate, light lines express thin material better than heavy ones — texture begins in the pencil, long before paint.

> **Term note:** Young ends the lesson with a **list of costume materials** — charmeuse, faille, duvetyn, batiste, melton, Cluny, Valenciennes, dozens more — and tells students who don't know one to go handle it in a store. The list is dated; the instruction isn't. You cannot draw, or specify, a cloth you have never touched.

For your studio this is the rendering half of **fabric truth**. When a tech pack says brushed fleece and the flat is drawn with taffeta-crisp edges, the sketch contradicts the spec. When you brief the Design Studio, the era's vocabulary transfers directly — "velvet: soft massed edges; satin: hard highlights left white" is a better prompt than any adjective. The exercise: pick three materials from Young's list that you own, and render one swatch-sized square of each three ways — pencil strokes, pen lines, flat wash — nine little studies. Label them. That page is the beginning of your own stroke chart, and it will outlive any single season's sketches.`,
    checkpoints: [
      {
        q: "Young's two-part rule for any drawn texture:",
        options: [
          "lines take the form of the weave, and the mass of lines follows the form beneath",
          "use as many lines as possible, evenly spaced",
          "always shade from left to right",
        ],
        answer: 0,
      },
      {
        q: "Black fur or black hair is rendered by…",
        options: [
          "solid black with no internal marks",
          "leaving white lines that carry the direction",
          "cross-hatching in gray",
        ],
        answer: 1,
      },
      {
        q: "For velvet versus shiny taffeta in wash, Traphagen says…",
        options: [
          "soften velvet's edges with a damp brush; let taffeta dry to crisp, hard edges",
          "treat both identically",
          "taffeta soft, velvet crisp",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Ink, wash, and the printing press: drawing for reproduction",
    minutes: 10,
    source: { label: "Young, lessons 19 and 28", url: "https://archive.org/details/studentsmanualof00younrich" },
    bodyMd: `Young's students were not drawing for the wall; they were drawing for the **photo-engraver**, and every technical habit she teaches follows from what a printing plate can and cannot hold. The constraints have changed; the discipline of drawing *for the destination* has not.

**The pen line** comes first. A professional line is "the right kind of a line in the right place," made with **one clean-cut stroke**, never patched — and the artist must know before the pen touches down what the line is for. Her training drills are humble and effective: practice on cheap shelf paper, not precious bristol; put two dots a hand-span apart and connect them, keeping **the eye in advance of the pen point**; fill sheets with parallel lines until the hand stops negotiating. Fine lines for faces and hands, very fine for lashes; and in shadow, wider lines under whatever projects — a belt, a collar, a cuff — with **the greater the projection, the wider the shadow.** That one rule turns outline into form.

Then the reproduction rules. Lines must not crowd, because a drawing was photographed *smaller* for the plate and **crowded lines run together when reduced**. A line may be hair-fine, but it must be dead **black** — the camera has no mercy on gray pencil. The era's tone tools each solved "how do I get gray out of pure black?": **stipple and spatter** (ink flicked from a toothbrush over masked areas) build tone from dots; **French wash** lays flat dilutions of lamp black over an ink outline — mixed in saucers, tested and dried first because wash dries lighter, carried across the dampened paper in one pass, never touched back into; and the **Ben Day machine** stamped mechanical dot and line patterns wherever the artist marked the drawing in blue, because **blue did not photograph**. The non-photo-blue pencil is this fact fossilized into every art-supply store since.

Lesson twenty-eight opens the shop door: the **layout**. A client orders a plate of a given size — and pays for every square inch of metal — so the figures must **touch the edges of the plate on all sides**; wasted margin is wasted money. To work larger than the plate, Young teaches the **diagonal method** of enlargement: draw the plate's rectangle in the corner of your sheet, extend its diagonal, and any rectangle whose corner sits on that diagonal is in true proportion. Reserve the **mortice** — the blank corner where the printer sets type. Then compose: vary the heads, vary the feet, make the figures "express interest in each other," place all the ovals before drawing any figure, and make a far figure smaller by the rules of perspective.

> **Term note:** **photo-engraving** — the drawing is photographed onto a sensitized zinc plate, and acid bites away everything except the (formerly black) lines, leaving them in relief for the press. Every rule above — black lines, open spacing, drawing oversize for reduction — is this process talking.

The modern translation is nearly one-to-one. Drawing to the plate is designing to the template: a lookbook page, a product-photo crop, a marketplace thumbnail all have fixed frames, and composing *into* the frame beats cropping after. Reduction still ruins crowded detail — a flat sketch that reads at tech-pack size turns to mud as a phone thumbnail unless the line weights were planned. And blue-that-doesn't-print lives on as every layer you mark "no export." The exercise: take one finished figure and prepare it twice — once large and open-lined so it survives reduction to a quarter of its size, once composed tight to a square frame with a mortice-corner left for text. Shrink both and judge. The engraver's acid is gone; the acid test isn't.`,
    checkpoints: [
      {
        q: "Lines in a drawing bound for reduction must be…",
        options: [
          "densely packed so detail survives",
          "well separated and truly black — crowded lines run together when reduced",
          "drawn in soft gray pencil",
        ],
        answer: 1,
      },
      {
        q: "Marks made in blue on an era drawing…",
        options: [
          "did not photograph, so they guided tools like the Ben Day machine",
          "printed darkest of all",
          "were forbidden in the trade",
        ],
        answer: 0,
      },
      {
        q: "Young's rule for filling a client's plate:",
        options: [
          "leave generous empty margins inside the plate",
          "center one small figure",
          "make the figures touch the plate's edges — the client pays per square inch",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Color for costume: harmonies you can wear",
    minutes: 11,
    source: { label: "Traphagen, chapter 4 (Color)", url: "https://archive.org/details/costumedesignill00trap" },
    bodyMd: `Traphagen's color chapter is a working system, not a mood board. She builds it on the painter's wheel — **primaries** red, yellow and blue; **secondaries** orange, green and violet between them; **complements** facing each other across the circle — and then hands over the definitions a designer actually uses daily. **Hue** is the step around the wheel (blue-green, yellow-green). **Value** is light versus dark — think *up and down*: yellow is lightest, violet darkest. **Intensity** (chroma) is brilliance — think *inward across the wheel*, and to lower it, add the complement: a color mixed with its complement makes gray. **Tint** adds white; **shade** adds dark. Six words, and suddenly two people can discuss "that blue" precisely.

Her catalogue of **harmonies** is the schemer's toolkit. Harmonies of likeness: **monochromatic** (tones of one color), **analogous** (neighbors on the wheel, related by a shared element), and **dominant** (several colors all subdued by one). Harmonies of difference: **complementary** (opposites, unified by graying both or mixing each slightly into the other); **split complementary** — a primary joined with the two colors flanking its complement, with her firm procedural rule, "always begin on the primary and split on the complement; never split a primary"; **double complementary** (two neighbors with both their opposites); and the **triad** — three colors forming an equilateral triangle on the wheel, of which **only one should be wholly intense**.

Then the laws, which are where costume lives or dies. **The larger the area, the less intense the color must be; the smaller the area, the more intense it may be.** A flame-red binding delights; a flame-red coat shouts. **Backgrounds must be more neutral than the objects shown on them** — true of a drawing's backdrop and equally of a skirt behind its own embroidery. Colors balance when alike in intensity and area; if unlike, **intensity must vary inversely with area**. And full-intensity colors should not meet unless relieved by black or white.

Costume adds a law no poster needs: the garment sits next to a face. A color reflects both its own tint **and its complement** onto the wearer's skin — Traphagen's **simultaneous contrast** — which is why a dress can turn its wearer sallow or florid, and why two different hues of the same color can "kill" each other side by side. Her practical defaults: in large areas, neutralized colors are always best; light colors near the face are good; and when one striking note of color is used, **repeat it somewhere** — a belt echoed at the sleeve — so it reads as intention.

She even wires color to feeling, quoting the trade's own folder: blue cold and formal, green cool and restful, yellow cheerful and unifying, red warm and aggressive; light tones for youth and gaiety, dark for dignity; full intensity loud and elemental, **neutralized color for subtlety, refinement and charm.** Sources for schemes are everywhere the design chapter will send you — nature, textiles, galleries; her own prize-winning gown pulled its blue-green and gray-brown harmony from a Whistler *Nocturne*.

> **Term note:** her homework is the **color chart** — paint the twelve full-intensity colors and their half-neutralized inner circle as small washes, punch coin-sized discs, and mount them as your own wheel. Painting the wheel, rather than looking at one, is how the mixing behavior gets into the hand. Remember while you work that watercolor **dries lighter**.

For a modern label this chapter is palette discipline. A seasonal palette is a stated harmony — name it (analogous with one split-complement accent, say), obey the area law (neutrals carry the big pieces, intensity lives in trims), and repeat the striking note across the range so the collection hangs together on a rack the way a triad hangs together on the wheel. Annotate the harmony on your Design Studio concepts and in tech-pack colorways: "brick, sand, deep spruce — dominant warm gray" briefs a factory and a photographer better than a dozen adjectives.`,
    checkpoints: [
      {
        q: "To lower a color's intensity, Traphagen says…",
        options: ["add its complement — graying it", "add more of the same color", "outline it in black"],
        answer: 0,
      },
      {
        q: "Her law of area and intensity:",
        options: [
          "big areas take the most intense color",
          "the larger the area, the less intense the color must be",
          "area and intensity are unrelated",
        ],
        answer: 1,
      },
      {
        q: "In a triad harmony…",
        options: [
          "all three colors should be at full intensity",
          "the three colors sit adjacent on the wheel",
          "only one of the three should be wholly intense",
        ],
        answer: 2,
      },
    ],
  },
  {
    title: "Designing from a source: the Greek Law and the storehouse",
    minutes: 11,
    source: { label: "Traphagen, chapters 3 and 5", url: "https://archive.org/details/costumedesignill00trap" },
    bodyMd: `The last lessons of both books turn from drawing garments to inventing them, and they agree on the two halves of the craft: a rule for proportion, and a method for finding ideas.

The rule first. Traphagen's **Greek Law** — the Renaissance distillation of classical proportion — says that when two lines or areas are in good relation, **the shorter is between one-half and two-thirds of the longer.** Mechanical divisions (exact halves, thirds, quarters) are inartistic because the eye solves them instantly; wildly unrelated sizes fail because the eye can't compare them at all. The fertile zone is between. Crudely stated as a ratio of about **5 : 7 : 11**, it governs page margins (widest at the bottom, next at the top, narrowest at the sides) and, on the body, everything: where a hem's tucks begin, the depth of a V-neck — Young independently warns never to open a V exactly a quarter, third or half of the way down — the length of an over-skirt against its under-skirt, a pocket's drop from the belt, a jacket's cut against the skirt. "Order is the law of all design," her design chapter opens: balance, rhythm, harmony, and always **simplicity and appropriateness**.

Her inventory of line effects is the fitting-room made explicit: horizontal lines shorten and widen; vertical lines lengthen — though conspicuous stripes exaggerate a tall figure rather than flatter it; square shoulders and a raised waistline add apparent height; a narrow belt slims the waist where a wide girdle broadens it; **over-decoration is always bad; broken line effects are always bad**, and a waist that continues into the skirt is good. Add her scale rule — never mix scales, in figured goods or trims; crystal bugles that sing on chiffon are absurd on serge — and you have a checklist to run over any croquis before it leaves the sketchbook.

Then the method. Traphagen frames the designer's problem like the architect's, two-fold: **find the best and most beautiful that has been conceived, and adapt it to present-day needs.** Her storehouse is deliberately vast — museums, historic costume from Egypt to the crinoline, textiles, nature, music, painting — and her book proves it with worked examples: a hat born from **a bowl of tulips**; a blouse from a **lily of the valley**; her own prize-winning evening gown translating a Whistler *Nocturne* into pastel-blue chiffon over putty color, one glint of flame kept from the painting. Young's final lessons supply the matching examples at desk level — a dress whose embroidery and color blocking are lifted from **a bobolink's plumage**, another built from the repeating motif of **a rug** — and, usefully, a ladder for beginners: first combine parts of published designs into a coherent whole (practice, she warns, not salable work); then design a modern dress *from* a modern dress, keeping its main lines; then work from historic costume with the present silhouette in mind; then from nature and objects, the free end of the ladder.

> **Term note:** a **source** is not a template. In every worked example, what transfers is a *structure* — the tulip's cup, the bird's color blocking, the painting's harmony, the rug motif's repeat — reattached to the living silhouette. Copying the surface produces costume; translating the structure produces design. This is Traphagen's whole difference between the storehouse and the shortcut.

This is the method behind this school's habit of pairing history lessons with sketch assignments, and it drops straight into your pipeline. Keep the idea notebook Young prescribes. When you save a concept in the Design Studio, name the source and the structure you took from it — "pleat cascade from the 1912 plate; storm-cloud palette; Greek-Law hem band" — because a cited source keeps you honest about what was borrowed and makes the brief reproducible. Then run the checklist: proportions in the fertile zone, lines doing what you claim, scale unmixed, one striking note repeated. That is a century-old quality gate, and it still catches almost everything.`,
    checkpoints: [
      {
        q: "The Greek Law places a good shorter length at…",
        options: [
          "exactly half the longer",
          "between one-half and two-thirds of the longer",
          "less than one-quarter of the longer",
        ],
        answer: 1,
      },
      {
        q: "Traphagen's two-fold design problem is…",
        options: [
          "find the most beautiful that exists, and adapt it to present-day needs",
          "sketch quickly and color slowly",
          "copy the current mode exactly",
        ],
        answer: 0,
      },
      {
        q: "What should transfer from a design source (a bird, a painting, a rug)?",
        options: [
          "its surface, copied faithfully",
          "nothing — sources are forbidden",
          "its structure — color blocking, motif, harmony — reattached to the living silhouette",
        ],
        answer: 2,
      },
    ],
  },
];

export const F2_MORE_QUIZ: QuizQuestion[] = [
  {
    id: "f2q15",
    q: "In the fashion head, the eyes are placed…",
    options: ["in the middle of the head, one eye's width apart", "two-thirds of the way up", "wherever looks pretty"],
    answer: 0,
  },
  {
    id: "f2q16",
    q: "Young's rule for hats on heads:",
    options: [
      "draw the hat first and fit a face under it",
      "draw the full head first, then place the hat on it",
      "never tip a hat",
    ],
    answer: 1,
  },
  {
    id: "f2q17",
    q: "When a figure's weight is even on both feet, the standing line falls…",
    options: ["between the feet", "through the leading ankle", "outside the body"],
    answer: 0,
  },
  {
    id: "f2q18",
    q: "A drawing destined for reduction must keep its lines…",
    options: [
      "crowded, to preserve detail",
      "soft gray, for subtlety",
      "well separated and truly black, or they run together",
    ],
    answer: 2,
  },
  {
    id: "f2q19",
    q: "Traphagen's area law for color:",
    options: [
      "the larger the area, the less intense the color must be",
      "the larger the area, the more intense the color",
      "area never affects color choice",
    ],
    answer: 0,
  },
  {
    id: "f2q20",
    q: "By the Greek Law, two lengths relate well when the shorter is…",
    options: ["exactly half the longer", "between one-half and two-thirds of the longer", "one-tenth of the longer"],
    answer: 1,
  },
];
