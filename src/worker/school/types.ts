/** Shared curriculum types — see content.ts for the why-this-lives-in-the-worker note. */

export interface SchoolDef {
  key: string;
  title: string;
  tagline: string;
}

export interface Checkpoint {
  q: string;
  options: string[];
  answer: number; // index — SERVER ONLY, stripped by API
}

export interface Lesson {
  title: string;
  minutes: number; // reading floor, enforced via heartbeats
  bodyMd: string;
  checkpoints: Checkpoint[];
  source?: { label: string; url: string };
}

export interface QuizQuestion {
  id: string;
  q: string;
  options: string[];
  answer: number; // SERVER ONLY
}

export interface PracticalDef {
  kind:
    | "none"
    | "client_measurements"
    | "construction_notes"
    | "measurement_points"
    | "bom_linked"
    | "trend_board"
    | "design_concept"
    | "price_study";
  title: string;
  instructions: string;
}

export interface CourseDef {
  slug: string;
  school: string;
  title: string;
  summary: string;
  level: "foundation" | "intermediate" | "advanced";
  sources: { label: string; iaId?: string; url: string }[];
  lessons: Lesson[];
  quiz: QuizQuestion[];
  quizDraw: number;
  passPercent: number;
  practical: PracticalDef;
}
