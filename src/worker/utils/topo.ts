/**
 * Foreign-key-safe table ordering. The DO's SQLite enforces foreign keys (D1
 * historically didn't), so copying/wiping the primary shop must respect the FK
 * graph: insert parents before children, wipe children before parents. This is
 * Kahn's algorithm over the schema's own FK metadata; self-references and
 * genuine cycles are appended at the end rather than dropped, so every table is
 * always returned exactly once.
 *
 * Extracted from the migrate-primary path so the ordering can be unit-tested
 * without a database — getting it wrong silently corrupts a shop's data.
 */
export function topoSortByParents(
  names: string[],
  parentsOf: Map<string, Set<string>>,
): string[] {
  const ordered: string[] = [];
  const done = new Set<string>();
  while (ordered.length < names.length) {
    const ready = names.filter(
      (n) => !done.has(n) && [...(parentsOf.get(n) ?? [])].every((p) => done.has(p)),
    );
    // No table became ready → a cycle remains. Append the rest to guarantee
    // termination and total coverage; the caller batches inserts, so a cycle
    // just means those rows aren't strictly ordered against each other.
    const batch = ready.length ? ready : names.filter((n) => !done.has(n));
    for (const n of batch) {
      ordered.push(n);
      done.add(n);
    }
  }
  return ordered;
}
