/**
 * Controlled design vocabularies for the Design Studio prompt builder. Large,
 * curated option sets for "Fabric & texture" and "Details & trims" so the
 * design process is guided and consistent — designers pick from these (grouped
 * for scanning) and can still add their own via an "Other" entry. Kept in
 * shared/ so both the client picker and any server-side validation use one list.
 */

export interface VocabGroup {
  label: string;
  options: string[];
}

// ── Fabric & texture ───────────────────────────────────────────────────────
export const FABRIC_GROUPS: readonly VocabGroup[] = [
  {
    label: "Cotton",
    options: [
      "cotton poplin", "cotton twill", "brushed cotton", "cotton canvas", "cotton sateen",
      "cotton jersey", "combed cotton", "organic cotton", "cotton piqué", "oxford cloth",
      "chambray", "seersucker", "cotton voile", "cotton lawn", "cotton flannel", "cotton drill",
      "corduroy", "cotton terry", "muslin", "cheesecloth",
    ],
  },
  {
    label: "Linen & hemp",
    options: [
      "sun-washed linen", "heavy linen", "lightweight linen", "slubbed linen", "linen-cotton blend",
      "washed linen", "Irish linen", "hemp canvas", "hemp-cotton blend", "ramie",
    ],
  },
  {
    label: "Wool",
    options: [
      "merino wool", "wool flannel", "wool gabardine", "worsted wool", "boiled wool", "wool crepe",
      "wool bouclé", "tweed", "herringbone wool", "houndstooth wool", "melton wool", "loden wool",
      "cashmere", "camel hair", "mohair", "felted wool", "wool jersey",
    ],
  },
  {
    label: "Silk & luxe",
    options: [
      "silk charmeuse", "silk crepe de chine", "silk chiffon", "silk organza", "silk satin",
      "silk georgette", "dupioni silk", "habotai silk", "raw silk", "sandwashed silk", "velvet",
      "silk velvet", "taffeta", "brocade", "jacquard", "lamé",
    ],
  },
  {
    label: "Denim & workwear",
    options: [
      "raw denim", "washed denim", "stretch denim", "selvedge denim", "black denim", "ecru denim",
      "duck canvas", "waxed cotton", "moleskin", "ripstop cotton",
    ],
  },
  {
    label: "Knits",
    options: [
      "rib knit", "cable knit", "fine-gauge merino knit", "chunky knit", "French terry", "loopback terry",
      "ponte", "interlock", "waffle knit", "jersey knit", "pointelle", "intarsia knit", "ribbed jersey",
    ],
  },
  {
    label: "Sheer & delicate",
    options: [
      "tulle", "lace", "guipure lace", "broderie anglaise", "eyelet", "mesh", "organza", "gauze",
      "crinkle chiffon", "dotted swiss",
    ],
  },
  {
    label: "Leather & pile",
    options: [
      "full-grain leather", "nappa leather", "suede", "nubuck", "patent leather", "vegan leather",
      "faux shearling", "sherpa fleece", "faux fur", "shearling", "quilted fabric",
    ],
  },
  {
    label: "Technical & performance",
    options: [
      "recycled polyester", "nylon ripstop", "coated nylon", "softshell", "neoprene", "scuba knit",
      "technical mesh", "water-repellent taffeta", "Gore-Tex laminate", "bonded jersey", "power mesh",
      "Tencel/lyocell", "cupro", "bamboo viscose", "modal",
    ],
  },
  {
    label: "Finish & hand-feel",
    options: [
      "garment-dyed", "stonewashed", "enzyme-washed", "acid-washed", "over-dyed", "brushed / peached",
      "crinkled", "pleated finish", "matte", "high-sheen", "metallic", "iridescent", "coated / waxed",
      "napped", "sandwashed", "distressed", "raw / undyed",
    ],
  },
];

// ── Details & trims ──────────────────────────────────────────────────────────
export const DETAIL_GROUPS: readonly VocabGroup[] = [
  {
    label: "Closures",
    options: [
      "horn buttons", "corozo buttons", "mother-of-pearl buttons", "covered buttons", "shank buttons",
      "snap buttons", "metal snaps", "press studs", "exposed zip", "invisible zip", "two-way zip",
      "chunky zip", "toggle fastening", "hook-and-eye", "hook-and-bar", "lacing", "drawstring closure",
      "magnetic closure", "tie fastening", "buckle closure",
    ],
  },
  {
    label: "Pleats, darts & gathers",
    options: [
      "knife pleats", "box pleats", "inverted box pleat", "sunburst pleats", "accordion pleats",
      "bust darts", "waist darts", "French darts", "gathers", "shirring", "smocking", "ruching",
      "tucks", "pin tucks", "cartridge pleats",
    ],
  },
  {
    label: "Pockets",
    options: [
      "patch pockets", "welt pockets", "jetted pockets", "flap pockets", "cargo pockets", "kangaroo pocket",
      "coin pocket", "hidden seam pockets", "besom pockets", "bellows pockets", "chest pocket", "ticket pocket",
    ],
  },
  {
    label: "Collars & necklines",
    options: [
      "notch lapel", "peak lapel", "shawl collar", "mandarin collar", "camp collar", "band collar",
      "spread collar", "cutaway collar", "Peter Pan collar", "funnel neck", "cowl neck", "boat neck",
      "crew neck", "V-neck", "scoop neck", "halter neck", "square neck", "sweetheart neckline", "keyhole neckline",
    ],
  },
  {
    label: "Sleeves & cuffs",
    options: [
      "barrel cuff", "French cuff", "ribbed cuff", "elasticated cuff", "roll-up tab", "buttoned tab cuff",
      "raglan sleeve", "dropped shoulder", "set-in sleeve", "puff sleeve", "bishop sleeve", "bell sleeve",
      "cap sleeve", "kimono sleeve", "gauntlet cuff",
    ],
  },
  {
    label: "Seams, stitching & edges",
    options: [
      "topstitching", "contrast topstitching", "double-needle topstitch", "saddle stitch", "flat-felled seams",
      "bound seams", "French seams", "raw hem", "rolled hem", "blind hem", "blanket-stitch edge", "piping",
      "contrast piping", "bias binding", "overlocked edge", "raw / frayed edge", "scalloped edge", "lettuce edge",
    ],
  },
  {
    label: "Hardware & embellishment",
    options: [
      "eyelets", "grommets", "rivets", "studs", "aglets / metal tips", "D-rings", "adjuster sliders",
      "cord stoppers", "embroidery", "chain-stitch embroidery", "appliqué", "patches", "sequins", "beading",
      "quilting", "contrast panelling", "colour-blocking", "screen print", "woven label", "leather patch",
    ],
  },
  {
    label: "Waist & structure",
    options: [
      "elastic waistband", "drawcord waist", "belt loops", "self-belt", "tab-and-buckle waist",
      "adjustable side tabs", "boning", "shoulder pads", "half-lining", "full lining", "bagged-out lining",
      "storm flap", "yoke", "gusset", "vent (single)", "vent (double)", "side slits",
    ],
  },
];

/** Flat lookup of every known value (for validation / "is this custom?"). */
export const KNOWN_FABRICS = new Set(FABRIC_GROUPS.flatMap((g) => g.options));
export const KNOWN_DETAILS = new Set(DETAIL_GROUPS.flatMap((g) => g.options));
