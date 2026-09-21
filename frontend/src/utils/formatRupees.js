// Shared monetary display for user-visible rupee values (BUG-10).
// Whole-rupee language: trims unnecessary trailing zeros
// (1500, not 1500.00), matching the original Works displayRupees
// behavior this was extracted from. Non-whole legacy values keep
// at most 2 decimals; empty/non-numeric values pass through so the
// existing null/empty guards at call sites keep working.
// Callers always add the ₹ symbol themselves: ₹{formatRupees(value)}.
export function formatRupees(v) {
  if (v === '' || v === null || v === undefined) return v;
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}
