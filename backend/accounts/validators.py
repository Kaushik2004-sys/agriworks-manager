# Strict email format check shared by registration and password reset.
# Rules: valid local part, exactly one @, valid domain with a dot,
# letter-only extension of at least 2 chars (e.g. .com, .in, .org).
import re
import unicodedata

PASSWORD_MESSAGE = (
    'Password must be at least 8 characters and include '
    'an uppercase letter, a lowercase letter, a number '
    'and a special character.'
)

_LOCAL_RE = re.compile(r'[A-Za-z0-9._%+-]+')
_LABEL_RE = re.compile(r'[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?')
_TLD_RE = re.compile(r'[A-Za-z]{2,}')

# Known provider domains. Anything else that is well-formed is accepted,
# so legitimate domains are never hardcoded to one provider.
_KNOWN_DOMAINS = {
    'gmail.com', 'googlemail.com',
    'yahoo.com', 'yahoo.in', 'yahoo.co.in',
    'outlook.com', 'outlook.in',
    'hotmail.com', 'live.com', 'live.in',
    'icloud.com', 'rediffmail.com',
    'zoho.com', 'zoho.in',
    'proton.me', 'protonmail.com', 'aol.com',
}
_KNOWN_PROVIDERS = {d.split('.')[0] for d in _KNOWN_DOMAINS}


def _damerau_le1(a, b):
    """True if a and b differ by a single typo (insert/delete/substitute
    or one adjacent transposition, e.g. gmial.com vs gmail.com)."""
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False
    # Substitution (same length) or transposition.
    if la == lb:
        diffs = [i for i in range(la) if a[i] != b[i]]
        if len(diffs) == 1:
            return True
        if (len(diffs) == 2 and diffs[1] == diffs[0] + 1
                and a[diffs[0]] == b[diffs[1]]
                and a[diffs[1]] == b[diffs[0]]):
            return True
        return False
    # Insertion/deletion.
    short, long = (a, b) if la < lb else (b, a)
    for i in range(len(long)):
        if short == long[:i] + long[i + 1:]:
            return True
    return False


def domain_typo_error(email):
    """Return an error message if the domain looks like a typo of a known
    provider (gmail.cm, gmail.co, gmail.con, gmial.com, ...), else None.

    Well-formed domains that are not close to a known provider
    (e.g. company.in, outlook.com) always pass.
    """
    try:
        domain = email.strip().lower().split('@')[1]
    except Exception:
        return None
    if domain in _KNOWN_DOMAINS:
        return None
    provider = domain.split('.')[0]
    # Exact provider name with an unknown variant (gmail.cm/co/con, ...).
    if provider in _KNOWN_PROVIDERS:
        return 'Please enter a valid email address.'
    # One-typo away from a known domain (gmial.com, gmaill.com, ...).
    for known in _KNOWN_DOMAINS:
        if _damerau_le1(domain, known):
            return 'Please enter a valid email address.'
    return None


def is_valid_email(value):
    """Return True only for strictly valid email addresses."""
    if not isinstance(value, str):
        return False
    email = value.strip()
    if not email or len(email) > 254 or ' ' in email:
        return False
    # Exactly one @ separator.
    if email.count('@') != 1:
        return False
    local, domain = email.split('@')
    # Local part: 1-64 chars, allowed chars, no leading/trailing dot,
    # no consecutive dots.
    if not local or len(local) > 64:
        return False
    if not _LOCAL_RE.fullmatch(local):
        return False
    if local.startswith('.') or local.endswith('.') or '..' in local:
        return False
    # Domain: labels separated by single dots, no empty labels
    # (rejects leading/trailing/consecutive dots like abc@.com).
    if '..' in domain:
        return False
    labels = domain.split('.')
    if len(labels) < 2:
        return False
    for label in labels:
        if not label or len(label) > 63:
            return False
        if not _LABEL_RE.fullmatch(label):
            return False
    # Extension: letters only, at least 2 (rejects abc@gmail.c).
    if not _TLD_RE.fullmatch(labels[-1]):
        return False
    return True


def password_error(value):
    """Return an error message if the password is weak, else None.

    Rule: min 8 chars + at least 1 uppercase, 1 lowercase,
    1 number and 1 special character. Login never uses this so
    existing (older, weaker) passwords keep working.
    """
    if not isinstance(value, str) or not value:
        return 'Password is required.'
    if (len(value) < 8
            or not re.search(r'[A-Z]', value)
            or not re.search(r'[a-z]', value)
            or not re.search(r'[0-9]', value)
            or not re.search(r'[^A-Za-z0-9]', value)):
        return PASSWORD_MESSAGE
    return None


def _is_name_word(word):
    """One name word: starts with a Unicode letter, rest letters/marks.

    Letters (L*) cover Latin and Devanagari consonants/vowels; marks
    (M*) cover Devanagari matras/nukta so words like 'राहुल' validate
    correctly. Numbers, punctuation, symbols and emoji are excluded.
    """
    if not word:
        return False
    if unicodedata.category(word[0])[0] != 'L':
        return False
    return all(unicodedata.category(ch)[0] in ('L', 'M')
               for ch in word[1:])


def is_valid_full_name(value):
    """Full Name: Unicode-letter words separated by single ASCII spaces.

    Rejects numbers, punctuation, symbols, emoji and leading/trailing/
    consecutive spaces. Operates on the raw submitted value.
    """
    if not isinstance(value, str) or not value:
        return False
    if value[0] == ' ' or value[-1] == ' ' or '  ' in value:
        return False
    return all(_is_name_word(word) for word in value.split(' '))


def is_valid_last_name(value):
    """Last Name: a single Unicode-letter word, no spaces."""
    if not isinstance(value, str) or not value:
        return False
    return _is_name_word(value)


# Business punctuation explicitly permitted inside Company Name.
# Everything else outside letters/marks/numbers/spaces is rejected,
# which also blocks HTML/script markup (<, >, /) and emoji.
_COMPANY_PUNCT = frozenset(" &.-'")


def is_valid_company_name(value):
    """Company Name: optional; otherwise letters/marks/numbers/spaces
    plus & . - ' only. Operates on the raw submitted value: exactly
    empty stays valid (field is optional), whitespace-only is rejected,
    and the stored value keeps existing strip behavior."""
    if value is None or value == '':
        return True
    if not isinstance(value, str):
        return False
    text = value.strip()
    if not text:
        return False
    return all(
        unicodedata.category(ch)[0] in ('L', 'M', 'N')
        or ch in _COMPANY_PUNCT
        for ch in text
    )
