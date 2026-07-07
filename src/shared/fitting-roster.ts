/**
 * The Verto model roster — a curated, platform-wide cast of diverse models that
 * every shop shares in the Look Studio. Each is a fixed persona (name + locked
 * appearance + seed) photographed once against the shared HOUSE_STYLE, so the
 * whole cast reads like one photoshoot and stays perfectly consistent across
 * uses. The image for each ships as a platform asset at `/roster/<id>.jpg`.
 *
 * Shops pick from this roster (filterable by gender/build/tone) to try garments
 * onto, and can still add their own models on top.
 */
import { HOUSE_STYLE, BASE_MODEL_OUTFIT } from "./fitting-models";

export type RosterGender = "female" | "male";
export type RosterBuild = "petite" | "straight" | "curvy" | "plus" | "tall" | "athletic";

export interface RosterModel {
  id: string;
  name: string;
  gender: RosterGender;
  build: RosterBuild;
  /** Short appearance descriptor woven into the generation prompt. */
  look: string;
  /** Fixed seed so the persona is reproducible for future poses. */
  seed: number;
}

// 16 women + 12 men, spanning build, skin tone, and age.
export const ROSTER: readonly RosterModel[] = [
  { id: "maya", name: "Maya", gender: "female", build: "curvy", look: "a 27-year-old woman with a curvy hourglass figure, warm medium-brown skin, and long dark wavy hair", seed: 101 },
  { id: "elise", name: "Elise", gender: "female", build: "straight", look: "a 24-year-old woman with a straight slim build, fair skin, and shoulder-length blonde hair", seed: 102 },
  { id: "priya", name: "Priya", gender: "female", build: "petite", look: "a 26-year-old petite South Asian woman with tan skin and long straight black hair", seed: 103 },
  { id: "nadia", name: "Nadia", gender: "female", build: "plus", look: "a 30-year-old plus-size woman with a full figure, olive skin, and dark curly shoulder-length hair", seed: 104 },
  { id: "zara", name: "Zara", gender: "female", build: "tall", look: "a 25-year-old tall long-limbed woman with deep dark skin and a short cropped afro", seed: 105 },
  { id: "ingrid", name: "Ingrid", gender: "female", build: "athletic", look: "a 29-year-old athletic woman with a toned build, light skin, and a light-brown ponytail", seed: 106 },
  { id: "sofia", name: "Sofia", gender: "female", build: "curvy", look: "a 28-year-old Latina woman with a curvy figure, olive skin, and long brown hair", seed: 107 },
  { id: "amara", name: "Amara", gender: "female", build: "straight", look: "a 31-year-old woman with a straight build, deep dark skin, and long box braids", seed: 108 },
  { id: "chloe", name: "Chloe", gender: "female", build: "petite", look: "a 23-year-old petite woman with fair freckled skin and a short auburn bob", seed: 109 },
  { id: "hana", name: "Hana", gender: "female", build: "straight", look: "a 27-year-old East Asian woman with a straight slim build, light skin, and long straight black hair", seed: 110 },
  { id: "bianca", name: "Bianca", gender: "female", build: "plus", look: "a 34-year-old plus-size woman with a full figure, tan skin, and dark shoulder-length hair", seed: 111 },
  { id: "freya", name: "Freya", gender: "female", build: "tall", look: "a 22-year-old tall woman with fair skin and long straight blonde hair", seed: 112 },
  { id: "yuki", name: "Yuki", gender: "female", build: "athletic", look: "a 26-year-old athletic East Asian woman with light skin and a short black bob", seed: 113 },
  { id: "rosa", name: "Rosa", gender: "female", build: "curvy", look: "a 48-year-old woman with a curvy figure, warm brown skin, and dark hair with elegant grey streaks", seed: 114 },
  { id: "lena", name: "Lena", gender: "female", build: "straight", look: "a 38-year-old woman with a straight build, olive skin, and auburn shoulder-length hair", seed: 115 },
  { id: "naomi", name: "Naomi", gender: "female", build: "tall", look: "a 24-year-old tall woman with deep dark skin and long sleek straight black hair", seed: 116 },
  { id: "marcus", name: "Marcus", gender: "male", build: "athletic", look: "a 28-year-old athletic man with a muscular build, warm brown skin, short black hair, and a trimmed beard", seed: 201 },
  { id: "tom", name: "Tom", gender: "male", build: "straight", look: "a 26-year-old man with an average straight build, fair skin, and short brown hair", seed: 202 },
  { id: "kenji", name: "Kenji", gender: "male", build: "straight", look: "a 29-year-old East Asian man with a slim straight build, light skin, and short black hair", seed: 203 },
  { id: "diego", name: "Diego", gender: "male", build: "athletic", look: "a 27-year-old Latino man with an athletic build, olive skin, dark hair, and light stubble", seed: 204 },
  { id: "amir", name: "Amir", gender: "male", build: "tall", look: "a 30-year-old tall Middle Eastern man with tan skin, black hair, and a full beard", seed: 205 },
  { id: "samuel", name: "Samuel", gender: "male", build: "plus", look: "a 33-year-old big-and-tall man with a large frame, deep dark skin, short hair, and a beard", seed: 206 },
  { id: "liam", name: "Liam", gender: "male", build: "tall", look: "a 24-year-old tall lanky man with fair skin and short blonde hair", seed: 207 },
  { id: "omar", name: "Omar", gender: "male", build: "straight", look: "a 31-year-old man with a straight build, warm brown skin, and short black hair", seed: 208 },
  { id: "david", name: "David", gender: "male", build: "straight", look: "a 52-year-old distinguished man with a straight build, light skin, and neat grey hair and beard", seed: 209 },
  { id: "noah", name: "Noah", gender: "male", build: "athletic", look: "a 25-year-old athletic man with light skin and short brown curly hair", seed: 210 },
  { id: "malik", name: "Malik", gender: "male", build: "straight", look: "a 28-year-old man with a straight build, deep dark skin, and a short afro", seed: 211 },
  { id: "ravi", name: "Ravi", gender: "male", build: "straight", look: "a 27-year-old South Asian man with a straight build, tan skin, and short black hair", seed: 212 },
] as const;

/** The full prompt that produces a persona's base roster shot (neutral outfit). */
export function rosterModelPrompt(m: RosterModel): string {
  return `${HOUSE_STYLE} The subject is ${m.look}, ${BASE_MODEL_OUTFIT}. Seamless light warm-grey studio background.`;
}

export function rosterModel(id: string | undefined): RosterModel | undefined {
  return ROSTER.find((m) => m.id === id);
}
