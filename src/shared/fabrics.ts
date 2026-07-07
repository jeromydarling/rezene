/**
 * A starter library of common apparel fabrics, described in plain language so a
 * first-time founder can pick by feel ("soft and cozy") instead of needing to
 * know "cotton jersey 180gsm". Used by the Launch Playbook's fabric picker and
 * its "describe what you want" drill-down. Not exhaustive — a sensible menu.
 */
export interface FabricRef {
  id: string;
  name: string;
  composition: string;
  gsm: string;
  feel: string; // plain-language hand-feel
  goodFor: string; // typical garments
  weight: "light" | "medium" | "heavy";
  keywords: string;
}

export const FABRIC_LIBRARY: FabricRef[] = [
  { id: "cotton-jersey", name: "Cotton jersey", composition: "100% cotton", gsm: "150–200 gsm", feel: "Soft, breathable, a little stretchy — the classic t-shirt knit.", goodFor: "T-shirts, tanks, easy dresses", weight: "light", keywords: "soft breathable tshirt basic casual knit stretch" },
  { id: "organic-cotton-jersey", name: "Organic cotton jersey", composition: "100% GOTS organic cotton", gsm: "160–200 gsm", feel: "Same soft t-shirt hand, grown without synthetic pesticides.", goodFor: "Elevated basics, conscious lines", weight: "light", keywords: "organic sustainable soft tshirt eco gots" },
  { id: "french-terry", name: "French terry", composition: "100% cotton (or cotton blend)", gsm: "250–350 gsm", feel: "Soft loops on the inside, smooth outside — cozy but not fuzzy.", goodFor: "Sweatshirts, joggers, relaxed layers", weight: "medium", keywords: "cozy sweatshirt jogger loungewear soft warm" },
  { id: "brushed-fleece", name: "Brushed fleece", composition: "Cotton / poly blend", gsm: "300–400 gsm", feel: "Fuzzy, warm, plush inside — proper hoodie weight.", goodFor: "Hoodies, warm sweatpants", weight: "heavy", keywords: "warm fuzzy cozy hoodie plush winter" },
  { id: "rib-knit", name: "Rib knit", composition: "Cotton / elastane", gsm: "200–300 gsm", feel: "Stretchy, body-hugging vertical ribs.", goodFor: "Fitted tops, bodysuits, cuffs", weight: "medium", keywords: "stretch fitted ribbed hugging body" },
  { id: "waffle-knit", name: "Waffle knit", composition: "Cotton / blend", gsm: "200–280 gsm", feel: "Textured honeycomb, a bit rugged and cozy.", goodFor: "Henleys, thermal-look tops", weight: "medium", keywords: "textured cozy henley thermal casual" },
  { id: "merino-knit", name: "Merino wool knit", composition: "100% merino wool", gsm: "180–260 gsm", feel: "Fine, soft, warm without bulk, breathes and resists odour.", goodFor: "Sweaters, base layers, refined knitwear", weight: "medium", keywords: "warm soft wool sweater luxury breathable knit" },
  { id: "linen", name: "Linen", composition: "100% linen", gsm: "150–220 gsm", feel: "Crisp, cool, breezy — relaxes and softens with wear; wrinkles proudly.", goodFor: "Summer shirts, trousers, easy dresses", weight: "light", keywords: "cool breezy summer crisp natural relaxed airy" },
  { id: "cotton-linen", name: "Cotton–linen blend", composition: "55% linen / 45% cotton", gsm: "170–230 gsm", feel: "Linen's breeze with a softer, less-creased hand.", goodFor: "Shirts, blazers, warm-weather tailoring", weight: "light", keywords: "breathable summer soft shirt blend" },
  { id: "poplin", name: "Cotton poplin", composition: "100% cotton", gsm: "100–140 gsm", feel: "Smooth, crisp, lightweight with a clean drape.", goodFor: "Dress shirts, blouses, shirt-dresses", weight: "light", keywords: "crisp smooth shirt dress lightweight formal" },
  { id: "oxford", name: "Oxford cloth", composition: "100% cotton", gsm: "140–180 gsm", feel: "Slightly textured basketweave, sturdy and casual.", goodFor: "Button-downs, casual shirts", weight: "medium", keywords: "shirt casual textured sturdy buttondown" },
  { id: "chambray", name: "Chambray", composition: "100% cotton", gsm: "130–180 gsm", feel: "Soft, denim-look but lightweight and breezy.", goodFor: "Shirts, light workwear", weight: "light", keywords: "denim-look soft shirt casual blue lightweight" },
  { id: "twill", name: "Cotton twill", composition: "100% cotton", gsm: "200–320 gsm", feel: "Diagonal weave, sturdy with a smooth face — chino territory.", goodFor: "Chinos, jackets, structured pieces", weight: "medium", keywords: "sturdy structured chino pants jacket durable" },
  { id: "denim", name: "Denim", composition: "100% cotton (or w/ stretch)", gsm: "10–14 oz", feel: "Rugged twill that fades and moulds to you.", goodFor: "Jeans, jackets, skirts", weight: "heavy", keywords: "jeans rugged durable indigo workwear jacket" },
  { id: "canvas", name: "Cotton canvas", composition: "100% cotton", gsm: "300–450 gsm", feel: "Stiff, tough, holds structure.", goodFor: "Outerwear, workwear, totes", weight: "heavy", keywords: "tough stiff structured workwear jacket bag durable" },
  { id: "corduroy", name: "Corduroy", composition: "100% cotton", gsm: "250–380 gsm", feel: "Soft raised cords, warm and retro.", goodFor: "Trousers, overshirts, jackets", weight: "heavy", keywords: "warm retro soft ribbed pants jacket autumn" },
  { id: "viscose-crepe", name: "Viscose crepe", composition: "100% viscose", gsm: "120–180 gsm", feel: "Fluid, soft, with a lovely drape and slight texture.", goodFor: "Dresses, blouses, wide trousers", weight: "light", keywords: "drapey fluid soft dress blouse flowy elegant" },
  { id: "silk-charmeuse", name: "Silk charmeuse", composition: "100% silk", gsm: "16–22 momme", feel: "Liquid, lustrous, cool to the touch — pure luxury.", goodFor: "Slip dresses, blouses, linings", weight: "light", keywords: "luxury shiny smooth drapey slip dress elegant silky" },
  { id: "wool-suiting", name: "Wool suiting", composition: "Wool (often w/ a touch of elastane)", gsm: "200–280 gsm", feel: "Smooth, structured, holds a press — tailoring cloth.", goodFor: "Blazers, trousers, suits", weight: "medium", keywords: "tailored structured suit blazer formal smart wool" },
  { id: "ponte", name: "Ponte knit", composition: "Rayon / nylon / spandex", gsm: "250–350 gsm", feel: "Structured stretch knit that smooths and holds shape.", goodFor: "Ponte trousers, blazers, dresses", weight: "medium", keywords: "structured stretch smoothing dress pants ponte" },
  { id: "modal-jersey", name: "Modal jersey", composition: "Modal / cotton", gsm: "140–190 gsm", feel: "Extra-soft, silky, drapes better than plain cotton.", goodFor: "Premium tees, loungewear", weight: "light", keywords: "silky soft drapey tshirt luxury lounge" },
  { id: "sateen", name: "Cotton sateen", composition: "100% cotton", gsm: "120–170 gsm", feel: "Smooth with a soft sheen and gentle drape.", goodFor: "Dresses, refined shirts", weight: "light", keywords: "smooth sheen drapey dress soft elegant" },
  { id: "recycled-poly", name: "Recycled polyester", composition: "100% recycled polyester", gsm: "varies", feel: "Durable, quick-drying, easy-care — from recycled bottles.", goodFor: "Activewear, outer shells, linings", weight: "light", keywords: "sustainable durable activewear technical recycled quickdry" },
  { id: "wool-cashmere", name: "Wool–cashmere", composition: "Wool / cashmere blend", gsm: "300–450 gsm", feel: "Soft, warm, plush — coat-weight luxury.", goodFor: "Coats, heavy knits", weight: "heavy", keywords: "warm luxury soft coat plush winter cashmere" },
];

/** Simple keyword search over the library for the picker. */
export function searchFabrics(q: string): FabricRef[] {
  const s = q.trim().toLowerCase();
  if (!s) return FABRIC_LIBRARY;
  return FABRIC_LIBRARY.filter((f) =>
    `${f.name} ${f.composition} ${f.feel} ${f.goodFor} ${f.keywords} ${f.weight}`.toLowerCase().includes(s),
  );
}
