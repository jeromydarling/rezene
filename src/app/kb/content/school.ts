import type { KbArticle } from "../types";

export const school: KbArticle[] = [
  {
    slug: "school",
    title: "The Verto School — courses, examinations and certificates",
    summary: "Learn tailoring, seamstressing and fashion from the era's own masters — and earn certificates backed by real work in your studio.",
    part: "account",
    moduleRoute: "/admin/school",
    keywords: "school course lesson quiz examination certificate badge tailoring seamstressing dressmaking fashion learn education lms certified verto",
    updated: "2026-07-11",
    body: `# The Verto School

**System → Verto School** is a working education in the three crafts behind your shop — tailoring, seamstressing, and fashion — taught from the golden-age masters. Every course is adapted from verified public-domain books (published before 1931): the Woman's Institute lessons, the great cutting systems, Nystrom's founding economics of fashion. We modernized the language, not the craft; each lesson links its original on the Internet Archive.

## How a course works

1. **Enroll** — courses are included with your shop; there's nothing to buy.
2. **Read the lessons, in order.** Lessons unlock sequentially, and the school credits **real reading time** — a progress rail fills as you read, and each lesson has checkpoint questions woven in. You can't skip, and you can't skim your way through: completion is earned on the server, not clicked in the browser.
3. **Sit the examination.** Each course draws a random paper from a larger question bank, graded entirely on Verto's servers — the answers never reach your browser, and every attempt sees a different paper. Pass mark is 80%; two misses in a row locks the paper for 24 hours (reread, then return).
4. **Pass the practical.** The part no quiz site can copy: the school verifies **real work in your own shop** — a recorded measurement set, construction notes that name real techniques, a decided price study with comparables. The work is the exam.
5. **Claim your certificate.**

## Certificates and badges

Every certificate is issued to **you** (the person, not the shop) and gets a public verification page at \`verto.style/certified/<id>\`. That link is the credential — a badge image can be copied; the link resolves only if the certificate was really earned, and shows what, when, and under which curriculum version.

Badges come in tiers: **course badges** for each completed course, **school diplomas** for finishing every course in a school, and the **Verto Certified Studio** mark for all three schools.

> [!NOTE]
> On the demo shop the school is read-only — sign into your own shop to enroll.

## Why the old books?

Because very little has changed. Balance, seams, pressing, price zones — the fundamentals of 1907 are the fundamentals of today, written by people who taught them for a living. Trends come and go; fashion is forever.`,
  },
];
