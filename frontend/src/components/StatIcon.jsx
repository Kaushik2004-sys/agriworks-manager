// Lightweight inline SVG icon set for the Dashboard (no new dependencies).
// Simple stroke icons in currentColor so they inherit Bootstrap text colors.
// Professional, consistent 24x24 outline style; sizes controlled via `size` prop.
const PATHS = {
  // Sprout: agriculture / work.
  work: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-4 3-7 8-7 0 4-3 7-8 7z" />
      <path d="M12 13c0-4-3-7-8-7 0 4 3 7 8 7z" />
    </>
  ),
  // Banknote: income.
  income: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M5.5 9.5h.01M18.5 14.5h.01" />
    </>
  ),
  // Checkmark in circle: payment received.
  payment: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  // Clock: pending.
  pending: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  // Receipt: expenses.
  expense: (
    <>
      <path d="M5 3h14v18l-3.5-2.5L12 21l-3.5-2.5L5 21V3z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  // Two people: farmers.
  farmers: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16.2 14.7c2.5.4 4.4 2 5.1 4.8" />
    </>
  ),
};

export default function StatIcon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
