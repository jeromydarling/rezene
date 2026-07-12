/**
 * Session/token expiry lives in a TEXT column compared as a string. That makes
 * the STORAGE FORMAT load-bearing: a space-separated SQLite datetime
 * ("2026-07-12 14:00:00") sorts BEFORE an ISO 'T' timestamp of the same instant
 * ("2026-07-12T14:00:00.000Z") because ' ' < 'T' in ASCII — which once made
 * freshly-minted sessions read as already expired. Always store ISO
 * (Date#toISOString) and compare with this helper so the rule lives in one
 * place and is unit-tested.
 */
export function isExpired(expiresAtIso: string, nowIso: string = new Date().toISOString()): boolean {
  return expiresAtIso < nowIso;
}
