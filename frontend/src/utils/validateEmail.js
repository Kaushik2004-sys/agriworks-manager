// Shared strict email check (mirrors backend accounts/validators.py).
// Rules: valid local part, exactly one @, valid domain with a dot,
// letter-only extension of at least 2 chars (e.g. .com, .in, .org),
// plus typo-domain rejection (gmail.cm, gmail.co, gmail.con, gmial.com).
// Well-formed domains not close to a known provider always pass, so
// legitimate domains are never limited to one provider.
const LOCAL_RE = /^[A-Za-z0-9._%+-]+$/;
const LABEL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const TLD_RE = /^[A-Za-z]{2,}$/;

const KNOWN_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.in', 'yahoo.co.in',
  'outlook.com', 'outlook.in',
  'hotmail.com', 'live.com', 'live.in',
  'icloud.com', 'rediffmail.com',
  'zoho.com', 'zoho.in',
  'proton.me', 'protonmail.com', 'aol.com',
];
const KNOWN_PROVIDERS = new Set(KNOWN_DOMAINS.map((d) => d.split('.')[0]));

// Single-typo difference (insert/delete/substitute or one transposition).
function isOneTypoAway(a, b) {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    const diffs = [];
    for (let i = 0; i < la; i++) {
      if (a[i] !== b[i]) diffs.push(i);
    }
    if (diffs.length === 1) return true;
    if (
      diffs.length === 2 &&
      diffs[1] === diffs[0] + 1 &&
      a[diffs[0]] === b[diffs[1]] &&
      a[diffs[1]] === b[diffs[0]]
    ) {
      return true;
    }
    return false;
  }
  const [short, long] = la < lb ? [a, b] : [b, a];
  for (let i = 0; i < long.length; i++) {
    if (short === long.slice(0, i) + long.slice(i + 1)) return true;
  }
  return false;
}

function isTypoDomain(domain) {
  const lower = domain.toLowerCase();
  if (KNOWN_DOMAINS.includes(lower)) return false;
  const provider = lower.split('.')[0];
  // Exact provider name with an unknown variant (gmail.cm/co/con, ...).
  if (KNOWN_PROVIDERS.has(provider)) return true;
  // One typo away from a known domain (gmial.com, gmaill.com, ...).
  return KNOWN_DOMAINS.some((known) => isOneTypoAway(lower, known));
}

export function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const email = value.trim();
  if (!email || email.length > 254 || email.includes(' ')) return false;
  // Exactly one @ separator.
  if (email.split('@').length !== 2) return false;
  const [local, domain] = email.split('@');
  // Local part: allowed chars, no leading/trailing dot, no consecutive dots.
  if (!local || local.length > 64) return false;
  if (!LOCAL_RE.test(local)) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return false;
  }
  // Domain: labels separated by single dots (rejects abc@.com, test@domain.).
  if (domain.includes('..')) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (!LABEL_RE.test(label)) return false;
  }
  // Extension: letters only, at least 2 (rejects abc@gmail.c).
  if (!TLD_RE.test(labels[labels.length - 1])) return false;
  // Typo domains (gmail.cm, gmial.com, ...) fail even though well-formed.
  if (isTypoDomain(domain)) return false;
  return true;
}

export const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.';
