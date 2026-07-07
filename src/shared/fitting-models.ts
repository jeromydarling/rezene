/**
 * AI Look Studio — model and setting presets for the "On a model" view of the
 * Fitting Room. Each preset carries a short prompt descriptor that we splice
 * into the image-generation prompt. Kept in shared/ so the worker (prompt
 * building) and the client (picker UI) use the exact same list.
 */

export interface FittingModelPreset {
  id: string;
  label: string;
  /** Woven into the prompt to describe the model's body/build. */
  descriptor: string;
}

export interface FittingSettingPreset {
  id: string;
  label: string;
  /** Woven into the prompt to describe the backdrop/lighting/mood. */
  descriptor: string;
}

// A deliberately inclusive spread of builds. Descriptors avoid loaded language
// and just give the generator enough to vary body shape realistically.
export const FITTING_MODELS: readonly FittingModelPreset[] = [
  { id: "straight", label: "Straight / regular", descriptor: "a woman fashion model with a straight, regular build and average height" },
  { id: "petite", label: "Petite", descriptor: "a petite woman fashion model, shorter stature with a slender frame" },
  { id: "curvy", label: "Curvy", descriptor: "a curvy woman fashion model with an hourglass figure and fuller hips and bust" },
  { id: "plus", label: "Plus", descriptor: "a plus-size woman fashion model with a full, confident figure" },
  { id: "tall", label: "Tall / editorial", descriptor: "a tall, long-limbed editorial woman fashion model with runway proportions" },
  { id: "athletic", label: "Athletic", descriptor: "an athletic woman fashion model with a toned, broad-shouldered build" },
  { id: "mature", label: "Mature", descriptor: "an elegant mature woman fashion model in her fifties with silver hair" },
  { id: "male", label: "Menswear", descriptor: "a man fashion model with an average athletic build" },
] as const;

export const FITTING_SETTINGS: readonly FittingSettingPreset[] = [
  { id: "studio", label: "Studio", descriptor: "Neutral seamless light-grey studio background, soft even studio lighting, e-commerce lookbook style" },
  { id: "runway", label: "Runway", descriptor: "On a fashion-show runway with dramatic spotlighting and a dark blurred audience behind, editorial runway photography" },
  { id: "street", label: "Street", descriptor: "Candid street-style photograph on a sunlit city sidewalk, softly blurred urban background, natural daylight" },
  { id: "editorial", label: "Editorial", descriptor: "High-fashion editorial photograph with a warm minimalist interior, large window light, cinematic mood" },
] as const;

export const DEFAULT_FITTING_MODEL = "straight";
export const DEFAULT_FITTING_SETTING = "studio";

export function fittingModel(id: string | undefined): FittingModelPreset {
  return FITTING_MODELS.find((m) => m.id === id) ?? FITTING_MODELS[0];
}
export function fittingSetting(id: string | undefined): FittingSettingPreset {
  return FITTING_SETTINGS.find((s) => s.id === id) ?? FITTING_SETTINGS[0];
}
