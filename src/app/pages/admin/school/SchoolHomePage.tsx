import { Link } from "react-router";
import { PageHeader } from "../../../components/admin/ui";
import { useFetch } from "../../../lib/useFetch";

/**
 * The Verto School's front hall: three schools, their courses with live
 * progress, and the badge wall. Every course is adapted from verified
 * public-domain masters (pre-1931) — trends come and go; this shelf
 * doesn't.
 */

interface CatalogCourse {
  slug: string;
  title: string;
  summary: string;
  level: string;
  lessonCount: number;
  quizDraw: number;
  enrolled: boolean;
  completed: boolean;
  lessonsDone: number;
  practical: { title: string };
}

interface Catalog {
  curriculumVersion: string;
  schools: { key: string; title: string; tagline: string; courses: CatalogCourse[] }[];
  certificates: { id: string; scope: string; ref: string; title: string; issuedAt: string }[];
}

const LEVEL_TONE: Record<string, string> = {
  foundation: "bg-sky-50 text-sky-700",
  intermediate: "bg-amber-100 text-amber-800",
  advanced: "bg-violet-50 text-violet-700",
};

export function SchoolHomePage() {
  const catalog = useFetch<Catalog>("/api/admin/school");
  const data = catalog.data;

  return (
    <div>
      <PageHeader
        title="The Verto School"
        eyebrow="School & Library"
        description="Tailoring, seamstressing and fashion — taught from the era's own masters, with timed lessons, real examinations, and certificates you earn with work in your own studio."
        help="school"
      />

      {/* Badge wall */}
      {data && data.certificates.length > 0 && (
        <div className="mb-5 rounded-xl border border-terracotta/25 bg-terracotta/[0.04] p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-terracotta">Your certificates</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.certificates.map((cert) => (
              <a
                key={cert.id}
                href={`/certified/${cert.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/40 bg-white px-3 py-1 text-sm text-ink hover:border-terracotta"
                title={`Issued ${cert.issuedAt.slice(0, 10)} — click for the public verification page`}
              >
                <span className="text-terracotta">◈</span> {cert.title}
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs text-warmgrey">
            Each badge links to its public verification page — that link is the credential; share it anywhere.
          </p>
        </div>
      )}

      {catalog.loading && <div className="skeleton h-64 rounded-xl" />}

      <div className="space-y-8">
        {data?.schools.map((school) => (
          <section key={school.key}>
            <h2 className="font-display text-xl text-ink">{school.title}</h2>
            <p className="mt-0.5 text-sm text-warmgrey">{school.tagline}</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {school.courses.map((course) => (
                <Link
                  key={course.slug}
                  to={`/admin/school/${course.slug}`}
                  className="flex flex-col rounded-xl border border-ink/10 bg-white p-4 transition hover:border-navy/40 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base text-ink">{course.title}</h3>
                    {course.completed ? (
                      <span className="shrink-0 rounded-full bg-terracotta/15 px-2 py-0.5 text-xs text-terracotta">◈ certified</span>
                    ) : (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${LEVEL_TONE[course.level] ?? "bg-ink/5 text-ink/60"}`}>
                        {course.level}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 flex-1 text-sm text-warmgrey">{course.summary}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-warmgrey">
                    <span>
                      {course.lessonCount} lessons · examination · practical
                    </span>
                    {course.enrolled && !course.completed && (
                      <span className="text-navy">
                        {course.lessonsDone}/{course.lessonCount} done
                      </span>
                    )}
                  </div>
                  {course.enrolled && !course.completed && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/5">
                      <div
                        className="h-full rounded-full bg-navy transition-all"
                        style={{ width: `${Math.round((course.lessonsDone / course.lessonCount) * 100)}%` }}
                      />
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {data && (
        <p className="mt-8 text-xs text-warmgrey">
          Curriculum v{data.curriculumVersion} · Every course credits and links its public-domain sources — the
          originals are always one click away on the Internet Archive.
        </p>
      )}
    </div>
  );
}
