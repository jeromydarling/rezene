import type { KbArticle } from "../types";

export const design: KbArticle[] = [
  {
    slug: "styles-vs-products",
    title: "Styles vs. Products (and where tech packs attach)",
    summary: "The design record vs. the storefront listing — and how they connect.",
    part: "design",
    moduleRoute: "/admin/styles",
    keywords: "style product tech pack relationship pipeline missing development",
    screenshot: "/kb/shots/styles.png",
    updated: "2026-07-06",
    body: `# Styles vs. Products

These two look similar but do different jobs:

- A **Style** is the **design-side record** of a garment as it moves through development: concept → design → tech pack → sampling → approved → production.
- A **Product** is the **storefront listing** you sell.

They're related but separate — a product can optionally point back to the style it came from, so you can trace a listing to its spec.

## Where tech packs live

> [!NOTE]
> Tech packs attach to **Styles**, not products. Each style has one tech pack — the manufacturing spec you send the factory.

## "Missing tech pack"

If a style shows **Missing tech pack**, that style simply has no tech pack record yet. Fix it by opening the style (or **Tech Packs → the style**) and creating one — start from a template, or let LLM rough it in, then refine the measurements, BOM, and construction. See [Building the factory spec](/admin/support/kb/tech-packs).`,
  },
  {
    slug: "tech-packs",
    title: "Tech packs: building the factory spec",
    summary: "Graded measurements, BOM, construction, annotated flats, and Excel export.",
    part: "design",
    moduleRoute: "/admin/tech-packs",
    keywords: "tech pack measurements bom construction grading factory export excel flat sketch annotate",
    screenshot: "/kb/shots/tech-packs.png",
    updated: "2026-07-06",
    body: `# Tech packs: building the factory spec

A **tech pack** is the complete manufacturing spec a factory needs to make your garment correctly and consistently.

## What's in it

- **Graded measurements** with tolerances (the points of measure across every size)
- **Bill of materials (BOM)** — every fabric, trim, and label
- **Construction & stitch details**
- **Labels & packaging**
- **Annotated flat sketches** — drop numbered pins on a flat to call out exact construction points

## Working in a tech pack

Open a tech pack and edit each section inline. When it's ready:

- **Export to Excel** — a clean, multi-sheet workbook the factory can open anywhere.
- **Share a factory link** — a read-only, tokenized web page for the maker (no login required). Revoke it anytime.

## Starting fast

You don't have to build from a blank page. Create a tech pack **from a template** for common garment types, or use **LLM assist** to rough in a first draft from a description or sketch, then refine. See also [Send a design straight to a maker](/admin/support/kb/design-studio#ship-to-a-maker).`,
  },
  {
    slug: "design-studio",
    title: "The LLM Design Studio",
    summary: "Generate real garment concepts with Flux, iterate, and ship them to a maker.",
    part: "design",
    moduleRoute: "/admin/ai-concepts",
    keywords: "design studio flux ai image generate concept reference prompt lookbook ship maker sample rename archive delete download",
    screenshot: "/kb/shots/design-studio.png",
    updated: "2026-07-08",
    body: `# The LLM Design Studio

The Design Studio turns an idea into real, editable garment imagery — powered by **Flux**, built in. No external tools and no bring-your-own API keys.

## Generating concepts

1. Open **Design & Development → Design Studio** and start a concept.
2. Describe the garment, or use the **prompt builder** to assemble silhouette, fabric, mood, and details.
3. **Generate**. Flux returns imagery in seconds. Favourite the ones you like; each keeps its seed so you can iterate coherently.

## Reference images

Upload up to a few **reference images** (a mood shot, a fabric, an existing piece) and Flux (FLUX.2) conditions the generation on them — carrying tone, drape, and detail across your concepts for a consistent line.

## Keep the studio tidy

Designs live in the left rail, newest first. **Rename** a design any time, **Archive** it when a direction is parked (archived designs tuck away under "Show archived"), or **Delete** it outright — deleting removes its generated looks too, so storage stays clean.

## Use a look on your site

Love an image? Use it right away — attach it to a **product** or a **lookbook** without leaving the studio, or hit **⤓** on any look to download the image itself. From the same hover bar, **▦ try on** sends the look straight to the Fitting Studio.

## Ship to a maker {#ship-to-a-maker}

When a concept is ready to become a physical sample, **ship it to a saved maker** in one move. Verto:

1. Creates a **Style** from the concept,
2. Builds a **tech pack** with the concept image as the cover,
3. Opens a **sample** request,
4. Generates a tokenized **factory-portal link**, and
5. **Emails the maker** with everything attached.

> [!SUCCESS]
> That whole design → maker handoff is one action and is race-free — the maker gets a working link to a real spec, not a screenshot.`,
  },
  {
    slug: "three-d",
    title: "The 3D simulation bridge",
    summary: "Track CLO/Browzwear/Style3D projects, fit status, and turn fit issues into tasks.",
    part: "design",
    moduleRoute: "/admin/3d",
    keywords: "3d clo browzwear style3d simulation fit render measurements project",
    updated: "2026-07-06",
    body: `# The 3D simulation bridge

Simulation happens in your 3D tool (CLO 3D, Browzwear, Style3D); the **record** lives in Verto so it's tied to the style, the samples, and the factory.

## What it tracks

- The 3D **project** attached to a style, its **tool**, and current **status**
- **Files, renders, and measurements**
- **Fit status** as it progresses

## Fit issues → tasks

Found a fit problem in simulation? **Log a fit issue** and Verto files a **sample-revision task** on the production board automatically — so the fix doesn't get lost between the 3D tool and the factory. Delete a project when it's retired.`,
  },
  {
    slug: "look-studio",
    title: "The Fitting Studio: your garment on a model",
    summary: "Try a real garment photo on a model, refit and style it, then send it to your site.",
    part: "design",
    moduleRoute: "/admin/fitting",
    keywords: "fitting room look studio virtual try on model mood board pinterest generate ai image garment photo drape 3d pattern freesewing",
    screenshot: "/kb/shots/fitting.png",
    updated: "2026-07-08",
    body: `# The Fitting Studio

One job, done properly: **see a real garment on a real body before you cut, buy, or shoot**. Bring a Design Studio creation or a photo of an actual sample, put it on a consistent model roster, then refine the fit and styling until it's right.

## Try it on

1. **Your garment** — pull an image straight from the Design Studio, or upload a photo (a flat lay or a photo of it worn both work).
2. Choose the **garment type** (top, bottom, dress, or auto).
3. **Choose models** — the shared roster spans shapes, sizes, and skin tones (the same bodies every season, so styles are comparable), or upload your own model/fit photo. Pick **up to three at once** and the same garment is fitted on each body in one pass — a mini line review.
4. **Try it on.**

> [!TIP]
> Verto **evens out the lighting** on your garment photo before the try-on, so a window
> shadow raking across a flat lay doesn't come back as a two-tone garment. It's on by
> default; if a colour ever looks off in the result, untick **Even out the photo's
> lighting** and try again with the untouched photo.

## Fit a real client

Your shop models aren't limited to the roster. When a client sends in a photo, upload it under **Your models & clients** with their name — and try looks on *them*. The render keeps their body, pose, and face; only the garment changes. Refits, colorways, and side-by-side compare all work on client renders, so "this dress, on you, in sage, cropped" is four clicks.

**Getting a good client photo:** full body head-to-toe, facing the camera, wearing fitted clothing (baggy layers hide the body line), even light, plain background. A phone photo is fine.

> [!NOTE]
> Be straight with clients: this is a styling preview, not a fitting. It shows how a look reads on their body — colour, proportion, vibe — not how the seams will sit. Their photo stays in your shop's private storage and is sent only to the AI engine that produces the render.

## Refit a look

Fittings spark changes — tighter here, shorter sleeves there. With any render open, use **Refit this look** under the image:

- **Fit** chips change the garment: **Tighter · Looser · Crop it · Longer hem · Shorter/Longer sleeves**.
- **Styling** chips change how it's worn: **Full tuck · French tuck · Untucked** (pick one), **Roll the sleeves**, **Cuff the pants**, **Open collar · Buttoned up** (pick one).
- **Finish** chips get it presentation-ready: **Complete the outfit** and **Press it** (freshly-steamed fabric).
- Combine chips across rows, or just describe it: *"sleeves to the elbow, a touch boxier."*

Each refit saves as a new render beside the original, so your gallery reads as a fit progression you can compare and share.

**Checking a refit really moved:** toggle the **Grid** button in the corner of the viewer. The proportion grid is a fixed overlay (never part of the image), and refits keep the same framing — so you can read exactly which line a hem or sleeve sits on, before and after.

**Basics vs a full outfit:** models wear fitted neutral basics on purpose — like a real fit model, the body line stays visible so ease and hem positions read true. When you want the look presentation-ready instead (line reviews, client decks), tap **Complete the outfit** and the model gets quiet grey trousers and clean white sneakers — or a plain white tee when your featured piece is the bottoms — without touching your garment.

## Colorways

Line planning's favourite trick: with a render open, type up to three colour names — *sage, rust, cream* — and **Recolour**. The same look comes back re-dyed in each colour, with every detail, the model, and the lighting untouched. Each colorway is a normal render (and one render from the daily budget).

## Compare side by side

Tap **Compare** in the viewer corner and the view splits: your current render on the left, any render you click in the gallery on the right. Toggle the **Grid** on top to read hems and sleeve lines across both. Perfect for before/after refits and colorway calls.

## Send it somewhere

A finished look shouldn't be a dead end. Under the refit chips:

- **Download** the image for a deck or a client message.
- **Use on your site** — add it straight to a product's photo gallery or a lookbook, live immediately.
- **Fit notes → Pattern Studio** — after refits, carry the session's fit decisions into the Pattern Studio as drafting adjustments on a real sewing pattern.

## Renders and the daily budget

Every result saves to **Model renders** at the bottom — click any to reopen it, or delete it. Try-on results are badged **Try-on**, refits **Refit**. Each try-on or refit uses one render from the shop's daily budget; the counter next to the button shows what's left (it resets at midnight UTC).

## Turning it on

Virtual try-on, refits, and mood-board style-matching use a best-in-class engine (fal.ai) that a platform admin enables with an API key — until then the page shows a short "needs a key" note.`,
  },
  {
    slug: "pattern-studio",
    title: "The Pattern Studio: real sewing patterns",
    summary: "Draft manufacturable 2D patterns — graded to a size or a person's measurements — and download the SVG.",
    part: "design",
    moduleRoute: "/admin/patterns",
    keywords: "pattern studio sewing pattern freesewing block draft made to measure seam allowance grade size tailor seamstress svg cut",
    updated: "2026-07-08",
    body: `# The Pattern Studio

For the shops with a tailor or seamstress in the room — and for the designers who want to become one — the Pattern Studio drafts **real, manufacturable 2D sewing patterns** in your browser. Genuine flat pattern pieces (front, back, sleeve) you can print at true scale, cut, and sew. Not a picture of a pattern; the pattern. And from the same draft, a **physically simulated drape** and a **photoreal model render**, so one screen carries a design from measurements to a garment you can show a client.

## The five-minute path

1. Pick a **block**, 2. pick a **size** (or type measurements), 3. move the **fit sliders**, 4. **Print PDF**, cut, sew. Everything below is depth on those four steps — none of it is required to get a working pattern in your hands.

## 1 · Pick your block

The full FreeSewing apparel catalogue is in — over thirty blocks across tops, shirts, hoodies, dresses, bottoms, tailoring & outerwear, foundation bodices, underwear and swim. Three ways in:

- **Browse** the grouped picker (Tops, Shirts, Hoodies & Sweats, Dresses, Bottoms, Tailoring…).
- **Describe it** to the ✨ assistant — *"a boxy cropped tee"* — and it picks the block, size and rough fit for you.
- **Arrive from a fitting** — fit notes sent from the Fitting Studio land here with the right block preselected and the adjustments already on the sliders.

## 2 · Size it — three levels of truth

- **Standard sizes (XS–XXL).** A proportional grade from the size chart. Honest scope: good enough to cut a first toile, not an industrial graded nest.
- **Quick made-to-measure.** Four fields — chest, waist, hips, height — get a draft that's already recognisably *that person's*.
- **Full measurements.** Opens every measurement the block actually drafts from — neck, shoulder-to-wrist, bicep, waist-to-hip, the lot — in **cm or inches**. Greyed values show what the draft is currently using; type over any of them for true bespoke input. This is the level a made-to-measure atelier works at, and every downstream feature (including the drape simulation) uses these same numbers.

## 3 · Shape the cut

- **Quick sliders** — ease, hem length, sleeve length. Each redrafts the real pattern, so what the sliders say is what the seams do. Every slider has −/+ steppers sized for a tablet at the cutting table.
- **All drafting options** — the block's complete native option tree, straight from the design itself. On the button-down that means six cuff styles, collar geometry, plackets, split yoke, back darts, button count and more; every block exposes its own set. Nothing here is a mock control: each option changes the drafted geometry.
- **✨ Style this block** — tell the assistant *"french cuffs, split yoke, eight buttons"* and it sets those native options for you. Everything it chooses lands on the visible manual controls, yours to override — a concierge, never a gatekeeper.

## 4 · Get it out of the screen

- **Seam allowance** — whatever your fabric and construction call for, in mm or inches; 0 draws none.
- **Paperless mode** — prints dimensions on the pattern so you can measure and mark directly without printing at scale.
- **Download SVG** — for your machinist or any vector tool.
- **Print PDF** — tiled at true scale on A4 or Letter. Print at 100%, check the **5 cm bar on every page**, tape along the dashed glue guides (overlaps and row/column labels are printed on each page), and cut.

> [!TIP]
> New to cutting? **✨ Explain this pattern** writes a plain-language guide to the drafted pieces — what each one is, how many to cut, grain lines, and the classic mistakes for that garment type.

## 5 · See it before you sew it — the two bridges

This is where the Pattern Studio becomes something genuinely new.

**True-drape preview (beta).** For a growing set of blocks — **t-shirt, tank, sweatshirt, raglan hoodie, the Simon/Simone button-downs, zip-up hoodie, crossover hoodie, waistcoat, slip dress, tabard, trousers (block, summer pants, and chinos), pencil skirt, circle skirt, the Bella bodice block, the Carlton and Carlita tailored overcoats, the Brian foundation block, the Bent jacket block with its tailored two-piece sleeve, the Uma briefs (draped on a mannequin with a true crotch, gusset and all), and the Shin swim trunks** — *Simulate the real drape* sews your exact draft together in a cloth simulator and drapes it on a ghost mannequin **scaled to the same measurements you drafted with**. The result is a physically true picture of the proportions: where the hem really sits, how far the sleeves really reach, how much ease really hangs at the waist. It takes a few minutes on a render server; when it's done, **Render on a model from this drape** feeds the simulated garment to the photoreal engine as a proportion reference — so the picture your client sees matches the pattern your cutter holds. Honest scope: hoods, collars, waistbands and the coats' collar/lapel roll aren't simulated (your description carries those), a coat's back pleats gather into the waist seam rather than folding crisply, and the tailored two-piece sleeve's underarm edge is placed, not sewn, and the sim's grey surface is deliberately rough — the render engine is told to read proportions from it, never texture.

**The fit map.** Every drape now arrives with a second view: toggle **Fit map** above the image and the same garment is repainted by how hard the fabric is working against your pattern — measured the way professional garment CAD does it, per stitch against the *flat pieces you'd actually cut*. **Green** skims at pattern width, **yellow** is snug, **red** is pulling tight (a real toile would show drag lines there), **blue** is slack pooling you could pinch out, and pale zones hang free of the form. The scale adapts to the block's cloth: a jersey tee is judged far more forgivingly than a woven shirt, because a knit worn at stretch is comfortable where a woven would split a seam. Read it comparatively: nudge the ease slider, re-drape, and watch the waist go from yellow to green. One honest caveat, printed under the map too — shoulder and armhole joins read warmer than they really are on the rigid stand (the same reason fitters judge sleeves on a live model), so trust the body of the garment and confirm the shoulders in a photoreal render.

**The pressure map.** A third view, **Pressure**, answers a different question: not "how stretched is the cloth" but "how hard does it push on the body" — in kilopascals, computed by Laplace's law (tension × body curvature at the contact). It's the physics of why a snug waistband digs in over a hip bone but never on a flat back: the same tension presses harder where the body curves more. **Green** is light contact (under ~1 kPa), **yellow** a firm hold (~2 kPa — a confident waistband), **red** (6 kPa and up) is squeezing, medical-compression territory. Pressure only exists where the garment both touches and stretches; slack or free-hanging cloth reads zero, exactly as it should. The honest print: the tension side uses an *indicative modulus for the fabric class* (real cloth spans an order of magnitude), so treat the numbers as a class estimate for comparing designs — not a laboratory reading.

**Render this cut on a model.** The faster, looser bridge: your block, fit and every styling choice that has a name (cuffs, collar, plackets, buttons) become a written description for the photoreal engine. It's a **visual sketch** of the cut, not a render of your draft — use the drape bridge when the proportions themselves are the point. There's also an experimental *show the engine the pattern sheet* toggle that sends a clean drawing of the pieces as a reference; judge it with **Compare** and the **Grid** in the Fitting Studio.

**The loop closes both ways.** After a fitting session in the Fitting Studio (tighter, cropped, shorter sleeves…), tap **Fit notes → Pattern Studio** and those decisions arrive here as drafting adjustments, already on the sliders. Adjust, re-drape, re-render, re-fit: picture and pattern never drift apart.

## A worked example: one client, one afternoon

1. A client sends measurements — enter them under **Full measurements** on the Simone button-down.
2. She wants it relaxed and cropped: ease slider up, hem slider down, *"rounded barrel cuffs, seven buttons"* to the assistant.
3. **Simulate the real drape** — five minutes later you're looking at *her* shirt on *her* form.
4. **Render on a model from this drape** — now it's a photograph you can send her.
5. She approves; **Print PDF**, cut, sew.
6. **Save this pattern** under her name — next season it reloads in one click.

## The client book

**Save this pattern** stores the whole recipe — block, size, measurements, adjustments — and reload is one click. Name patterns after clients, link them to a **style** to keep them with that piece's story. For ateliers doing alterations and one-offs, this quiet feature is the backbone: the pattern of record for every body you cut for.

## Honest limits

Grading from a standard size is a proportional first pass. Made-to-measure drafts use your numbers directly and are correspondingly better. Foundation blocks (Brian, Bella, Breanna, Noble) are drafting bases for pattern-makers rather than finished garments — though Bella supports the drape preview, because seeing a fitted bodice block on the client's own form is exactly what a foundation block is for. The drape simulation is a proportions instrument, not a fabric-physics oracle — it won't show you how *your* twill behaves, only how the drafted shape hangs. And no render replaces a real fitting; it replaces the guesswork before one.`,
  },
];
